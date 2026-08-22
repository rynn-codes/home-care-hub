-- Joy Health — the addendum's schema claims
--
--   an authorization is history: revocation is attributed, settled rows are settled
--   one active authorization per account
--   an invoice number exists, is human, and is unique per organization
--   a processor event is received once, however many times it arrives
--   what Joy holds of a payment method is brand and last four, nothing more
--   a family reads their method summary through their grant; a caregiver reads nothing
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

create temporary table sa_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — addendum') returning id
),
client_p as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
payer as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
cg as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Jamisha', 'Harper' from org returning id
),
auth_bill as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_dau  as (insert into auth.users (id, email) values (gen_random_uuid(), 'susan@x.com') returning id),
auth_cg   as (insert into auth.users (id, email) values (gen_random_uuid(), 'j@x.com') returning id),
u_bill as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_bill.id, 'Bill', 'Ing', 'bill@x.com', 'billing', 'active'
  from org, auth_bill returning id
),
u_dau as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_dau.id, payer.id, 'Susan', 'Bell', 'susan@x.com', 'client_contact', 'active'
  from org, auth_dau, payer returning id
),
u_cg as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_cg.id, cg.id, 'Jamisha', 'Harper', 'j@x.com', 'employee', 'active'
  from org, auth_cg, cg returning id
),
acct as (
  insert into billing_accounts (organization_id, payer_person_id, billing_email)
  select org.id, payer.id, 'susan@example.com' from org, payer returning id
),
link as (
  insert into billing_account_clients (billing_account_id, client_person_id)
  select acct.id, client_p.id from acct, client_p returning billing_account_id
),
g_dau as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state,
                             role, allowed_actions, effective_from)
  select org.id, 'family', payer.id, client_p.id, 'active',
         'responsible_party', array['view_invoices', 'pay_invoice', 'manage_autopay'], current_date - 30
  from org, payer, client_p returning id
),
g_cg as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', cg.id, 'active' from org, cg returning id
)
select org.id as org_id, client_p.id as client_p, payer.id as payer, acct.id as acct,
       auth_bill.id as auth_bill, auth_dau.id as auth_dau, auth_cg.id as auth_cg,
       u_bill.id as u_bill
from org, client_p, payer, cg, acct, link,
     auth_bill, auth_dau, auth_cg, u_bill, u_dau, u_cg, g_dau, g_cg;

do $$
declare
  f record;
  evt text := 'evt_test_' || replace(gen_random_uuid()::text, '-', '');
  pm text := 'pm_test_' || replace(gen_random_uuid()::text, '-', '');
  auth_id uuid;
  inv1 uuid;
  inv2 uuid;
  n1 text;
  n2 text;
  visible int;
begin
  select * into f from sa_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  -- ------------------------------------------------------ authorizations --
  raise notice 'An authorization is a record with history';
  insert into payment_authorizations (
    organization_id, billing_account_id, authorized_by_person_id,
    payment_mode, authorization_text_version
  )
  values (f.org_id, f.acct, f.payer, 'autopay', 'joy-epay-v1')
  returning id into auth_id;

  begin
    insert into payment_authorizations (
      organization_id, billing_account_id, authorized_by_person_id,
      payment_mode, authorization_text_version
    )
    values (f.org_id, f.acct, f.payer, 'pay_invoice', 'joy-epay-v1');
    perform assert(false, 'a second active authorization was refused');
  exception when unique_violation then
    -- Two answers to "may Joy charge this" is the disagreement §11 forbids
    -- resolving silently.
    perform assert(true, 'a second active authorization was refused');
  end;

  begin
    update payment_authorizations set payment_mode = 'pay_invoice' where id = auth_id;
    perform assert(false, 'rewriting what was authorized was refused');
  exception when check_violation then
    perform assert(true, 'rewriting what was authorized was refused');
  end;

  begin
    update payment_authorizations set status = 'revoked' where id = auth_id;
    perform assert(false, 'an anonymous revocation was refused');
  exception when check_violation then
    perform assert(true, 'an anonymous revocation was refused');
  end;

  update payment_authorizations
  set status = 'revoked', revoked_at = now(), revoked_by_person_id = f.payer,
      revoked_reason = 'Switching from autopay to paying each invoice.'
  where id = auth_id;
  perform assert(
    (select status from payment_authorizations where id = auth_id) = 'revoked',
    'a named, dated, reasoned revocation goes through'
  );

  begin
    update payment_authorizations set status = 'active', revoked_at = null,
      revoked_by_person_id = null, revoked_reason = null
    where id = auth_id;
    perform assert(false, 'a revoked authorization cannot be resurrected');
  exception when check_violation then
    -- Un-revoking would erase the family's change of mind. A new authorization
    -- is a new row.
    perform assert(true, 'a revoked authorization cannot be resurrected');
  end;

  insert into payment_authorizations (
    organization_id, billing_account_id, authorized_by_person_id,
    payment_mode, authorization_text_version
  )
  values (f.org_id, f.acct, f.payer, 'pay_invoice', 'joy-epay-v1');
  perform assert(
    (select count(*) from payment_authorizations where billing_account_id = f.acct) = 2,
    'and the history keeps both — the change of mind is on the record'
  );

  -- ------------------------------------------------------ invoice numbers --
  raise notice 'An invoice has a number a family can read over the phone';
  insert into issued_invoices (organization_id, client_person_id, billing_account_id,
                               week_start, week_end, total, status,
                               issued_on, issued_by_user_id, due_on)
  values (f.org_id, f.client_p, f.acct, '2026-08-22', '2026-08-28', 480, 'issued',
          current_date, f.u_bill, current_date + 1)
  returning id, invoice_number into inv1, n1;

  insert into issued_invoices (organization_id, client_person_id, billing_account_id,
                               week_start, week_end, total, status,
                               issued_on, issued_by_user_id, due_on)
  values (f.org_id, f.client_p, f.acct, '2026-08-29', '2026-09-04', 480, 'issued',
          current_date, f.u_bill, current_date + 1)
  returning id, invoice_number into inv2, n2;

  perform assert(n1 like 'JH-%', 'the number reads as Joy''s: ' || n1);
  perform assert(n1 <> n2, 'and no two invoices share one');

  -- ------------------------------------------------------- event receipts --
  raise notice 'A processor event lands once, however many times it arrives';
  set local role postgres;  -- receipts are the webhook worker's, not a person's
  insert into stripe_event_receipts (organization_id, stripe_event_id, event_type)
  values (f.org_id, evt, 'payment_intent.succeeded');

  begin
    insert into stripe_event_receipts (organization_id, stripe_event_id, event_type)
    values (f.org_id, evt, 'payment_intent.succeeded');
    perform assert(false, 'the redelivered event was refused by constraint');
  exception when unique_violation then
    -- Idempotency as a unique index, not a promise in a handler.
    perform assert(true, 'the redelivered event was refused by constraint');
  end;
  set local role authenticated;
  perform act_as(f.auth_bill);

  -- -------------------------------------------------------- method summary --
  raise notice 'What Joy holds of a payment method is display-safe, by shape';
  insert into payment_method_summaries (
    organization_id, billing_account_id, stripe_payment_method_id,
    method_type, brand_or_bank, last_four, exp_month, exp_year, is_default
  )
  values (f.org_id, f.acct, pm, 'card', 'Visa', '4242', 12, 2028, true);

  begin
    insert into payment_method_summaries (
      organization_id, billing_account_id, stripe_payment_method_id,
      method_type, brand_or_bank, last_four
    )
    values (f.org_id, f.acct, pm || 'b', 'card', 'Visa', '424242424242');
    perform assert(false, 'more digits than the last four were refused');
  exception when check_violation then
    -- A column that would take five digits would eventually be handed sixteen.
    perform assert(true, 'more digits than the last four were refused');
  end;

  raise notice 'The family reads their summary through their grant';
  perform act_as(f.auth_dau);
  select count(*) into visible from family_payment_methods;
  perform assert(visible = 1, 'Susan sees Visa •••• 4242');
  select count(*) into visible from information_schema.columns
   where table_name = 'family_payment_methods' and column_name like 'stripe%';
  perform assert(visible = 0, 'and no Stripe id reaches her — the column is not there');

  perform act_as(f.auth_cg);
  select count(*) into visible from family_payment_methods;
  perform assert(visible = 0, 'a caregiver reads no payment method');
  select count(*) into visible from payment_authorizations;
  perform assert(visible = 0, 'and no authorization');

  raise notice 'ALL ADDENDUM ASSERTIONS PASSED';
end;
$$;
