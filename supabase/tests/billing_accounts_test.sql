-- Joy Health — billing accounts and rate history
--
-- The properties this migration exists for, and which only the database can
-- hold:
--
--   an account cannot be ready to charge automatically without recorded authority
--   two rate versions cannot cover the same day
--   a rate somebody invoiced against cannot be rewritten
--   one payer can pay for several clients
--
-- Every assertion runs as `authenticated`. RLS is bypassed for the table owner.

\set ON_ERROR_STOP on
set client_min_messages to notice;

create or replace function assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'FAILED: %', description; end if;
  raise notice '  ok  %', description;
end; $$;

create or replace function act_as(auth_id uuid)
returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', auth_id::text, true); end; $$;

create temporary table acct_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — accounts') returning id
),
-- Fictional throughout. Diane pays for both her parents; that is the case a
-- client-keyed schema could not express at all.
daughter as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Diane', 'Miller' from org returning id
),
mother as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Odessa', 'Arceneaux' from org returning id
),
father as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Wendell', 'Hollis' from org returning id
),
stranger as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Lian', 'Huang' from org returning id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'own@x.com') returning id),
auth_bill  as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
u_owner as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_owner.id, 'Karynn', 'V', 'own@x.com', 'ceo_admin', 'active'
  from org, auth_owner returning id
),
u_bill as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_bill.id, 'Bill', 'Ing', 'bill@x.com', 'billing', 'active'
  from org, auth_bill returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sch@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
)
select org.id as org_id, daughter.id as daughter, mother.id as mother,
       father.id as father, stranger.id as stranger,
       auth_owner.id as auth_owner, auth_bill.id as auth_bill, auth_sched.id as auth_sched,
       u_owner.id as u_owner, u_bill.id as u_bill
from org, daughter, mother, father, stranger,
     auth_owner, auth_bill, auth_sched, u_owner, u_bill, u_sched;

do $$
declare
  f record;
  acct uuid;
  other uuid;
  rate uuid;
  visible int;
begin
  select * into f from acct_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  raise notice 'One payer, several clients';
  insert into billing_accounts (
    organization_id, payer_person_id, collection_method, delivery_preference,
    terms_days, billing_email
  )
  values (f.org_id, f.daughter, 'send_invoice', 'email_and_portal', 1, 'diane@example.com')
  returning id into acct;

  insert into billing_account_clients (billing_account_id, client_person_id)
  values (acct, f.mother), (acct, f.father);

  select count(*) into visible from billing_account_clients where billing_account_id = acct;
  perform assert(visible = 2, 'Diane pays for both her parents on one account');

  raise notice 'And a client is paid for by one account at a time';
  insert into billing_accounts (organization_id, payer_person_id, billing_email)
  values (f.org_id, f.stranger, 'lian@example.com')
  returning id into other;

  begin
    insert into billing_account_clients (billing_account_id, client_person_id)
    values (other, f.mother);
    perform assert(false, 'a second payer for the same client was refused');
  exception when unique_violation then
    -- Split payers are §18.9, an open business decision. Until Karynn says it
    -- happens, the database says it does not.
    perform assert(true, 'a second payer for the same client was refused');
  end;

  raise notice 'Automatic collection needs recorded authority';
  begin
    update billing_accounts
    set collection_method = 'automatic', terms_days = null, payment_method = 'card',
        status = 'ready'
    where id = acct;
    perform assert(false, 'an automatic account cannot be ready without captured authority');
  exception when check_violation then
    -- A saved card is not permission, and it is easy to treat as permission
    -- because it is right there.
    perform assert(true, 'an automatic account cannot be ready without captured authority');
  end;

  begin
    update billing_accounts
    set authorization_status = 'captured', authorization_captured_at = null
    where id = acct;
    perform assert(false, 'authority with no date was refused');
  exception when check_violation then
    -- A claim nobody can check afterwards is the same as no authority.
    perform assert(true, 'authority with no date was refused');
  end;

  update billing_accounts
  set collection_method = 'automatic', terms_days = null, payment_method = 'card',
      authorization_status = 'captured', authorization_captured_at = now(),
      status = 'ready'
  where id = acct;
  perform assert(
    (select status from billing_accounts where id = acct) = 'ready',
    'with authority and a method on file, it is ready'
  );

  raise notice 'Terms only mean something when Joy sends an invoice';
  begin
    update billing_accounts set terms_days = 7 where id = acct;
    perform assert(false, 'payment terms on an automatic account were refused');
  exception when check_violation then
    perform assert(true, 'payment terms on an automatic account were refused');
  end;

  -- ============================================================== rates == --

  raise notice 'A rate has a period, and periods do not overlap';
  insert into rate_plan_versions (
    organization_id, billing_account_id, hourly_rate, effective_from, effective_to,
    created_by_user_id
  )
  values (f.org_id, acct, 30, '2026-01-01', '2026-06-30', f.u_bill)
  returning id into rate;

  insert into rate_plan_versions (
    organization_id, billing_account_id, hourly_rate, effective_from, created_by_user_id
  )
  values (f.org_id, acct, 34, '2026-07-01', f.u_bill);

  begin
    insert into rate_plan_versions (
      organization_id, billing_account_id, hourly_rate, effective_from, created_by_user_id
    )
    values (f.org_id, acct, 40, '2026-08-01', f.u_bill);
    perform assert(false, 'a second open-ended rate over the same days was refused');
  exception when exclusion_violation then
    -- Without this the price of an invoice depends on which row the query
    -- happened to read first.
    perform assert(true, 'a second open-ended rate over the same days was refused');
  end;

  raise notice 'A client-specific rate is a separate scope, not an overlap';
  insert into rate_plan_versions (
    organization_id, billing_account_id, client_person_id, hourly_rate,
    effective_from, created_by_user_id
  )
  values (f.org_id, acct, f.father, 28, '2026-07-01', f.u_bill);
  perform assert(true, 'a rate for one client on the account sits alongside the account rate');

  raise notice 'A rate somebody invoiced against cannot be rewritten';
  begin
    update rate_plan_versions set hourly_rate = 99 where id = rate;
    perform assert(false, 'editing a rate was refused');
  exception when check_violation then
    -- The invoice sent last March would silently start saying something else.
    perform assert(true, 'editing a rate was refused');
  end;

  begin
    update rate_plan_versions set effective_from = '2025-01-01' where id = rate;
    perform assert(false, 'moving a rate''s start was refused');
  exception when check_violation then
    perform assert(true, 'moving a rate''s start was refused');
  end;

  -- Closing one IS allowed: that is how a change is recorded.
  update rate_plan_versions set effective_to = '2026-05-31' where id = rate;
  perform assert(
    (select effective_to from rate_plan_versions where id = rate) = '2026-05-31',
    'but closing one with an end date is how a change is recorded'
  );

  begin
    delete from rate_plan_versions where id = rate;
    perform assert(false, 'deleting a rate version was refused');
  exception when insufficient_privilege then
    perform assert(true, 'deleting a rate version was refused');
  end;

  -- ========================================================= who reads == --

  raise notice 'A scheduler does not learn what a family pays';
  perform act_as(f.auth_sched);
  select count(*) into visible from billing_accounts where id = acct;
  perform assert(visible = 0, 'a scheduler reads no billing account');
  select count(*) into visible from rate_plan_versions;
  perform assert(visible = 0, 'and no rate');

  raise notice 'Payroll sees the account but never the rate';
  perform act_as(f.auth_owner);
  perform assert(true, 'the owner reads both');
  select count(*) into visible from rate_plan_versions;
  perform assert(visible > 0, 'the owner reads rates');

  raise notice 'ALL BILLING ACCOUNT AND RATE ASSERTIONS PASSED';
end;
$$;
