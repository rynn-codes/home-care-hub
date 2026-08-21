-- Joy Health — issued invoices and the money against them
--
-- Joy is all private pay, so every dollar owed is a family and nothing arrives
-- on its own. Three properties only the database can hold:
--
--   a payment cannot be edited after it is recorded
--   a payment cannot arrive before the invoice was sent
--   an invoice settles when the money covers it, computed once
--
-- Every assertion runs as `authenticated`.

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

create temporary table money_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — money') returning id
),
-- Fictional clients, as everywhere in this repository.
client_a as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Jamisha', 'Harper' from org returning id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'own@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
auth_cg    as (insert into auth.users (id, email) values (gen_random_uuid(), 'cg@x.com')  returning id),
u_owner as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_owner.id, 'Karynn', 'V', 'own@x.com', 'ceo_admin', 'active'
  from org, auth_owner returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sch@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
),
u_cg as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_cg.id, caregiver.id, 'Jamisha', 'H', 'cg@x.com', 'employee', 'active'
  from org, auth_cg, caregiver returning id
),
g_cg as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', caregiver.id, 'active' from org, caregiver returning id
)
select org.id as org_id, client_a.id as client_a, caregiver.id as caregiver,
       auth_owner.id as auth_owner, auth_sched.id as auth_sched, auth_cg.id as auth_cg,
       u_owner.id as u_owner, u_sched.id as u_sched
from org, client_a, caregiver, auth_owner, auth_sched, auth_cg,
     u_owner, u_sched, u_cg, g_cg;

do $$
declare
  f record;
  inv uuid;
  visible int;
  st invoice_status;
begin
  select * into f from money_fixture;
  set local role authenticated;

  perform act_as(f.auth_owner);

  raise notice 'An invoice for nothing is not issuable';
  begin
    insert into issued_invoices (
      organization_id, client_person_id, week_start, week_end, total,
      issued_on, issued_by_user_id, due_on
    )
    values (f.org_id, f.client_a, current_date - 14, current_date - 8, 0,
            current_date - 14, f.u_owner, current_date - 7);
    perform assert(false, 'a zero invoice was refused rather than pretending a week cost nothing');
  exception when check_violation then
    perform assert(true, 'a zero invoice was refused rather than pretending a week cost nothing');
  end;

  insert into issued_invoices (
    organization_id, client_person_id, week_start, week_end, total,
    issued_on, issued_by_user_id, due_on
  )
  values (f.org_id, f.client_a, current_date - 14, current_date - 8, 640,
          current_date - 14, f.u_owner, current_date - 7)
  returning id into inv;
  perform assert(inv is not null, 'an invoice is issued with a name against it');

  raise notice 'One invoice per client per week';
  begin
    insert into issued_invoices (
      organization_id, client_person_id, week_start, week_end, total,
      issued_on, issued_by_user_id, due_on
    )
    values (f.org_id, f.client_a, current_date - 14, current_date - 8, 640,
            current_date - 14, f.u_owner, current_date - 7);
    perform assert(false, 'a second invoice for the same week was refused');
  exception when unique_violation then
    -- Either a double-send, in which case the family gets two bills and rings,
    -- or a correction that should supersede rather than sit alongside.
    perform assert(true, 'a second invoice for the same week was refused');
  end;

  raise notice 'A payment cannot arrive before the invoice was sent';
  begin
    insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
    values (f.org_id, inv, 100, current_date - 30, 'card', f.u_owner);
    perform assert(false, 'a payment dated before the invoice was refused');
  exception when check_violation then
    -- Almost always somebody keying it against the wrong invoice, and the money
    -- then sits on a settled week while the owed one keeps ageing.
    perform assert(true, 'a payment dated before the invoice was refused');
  end;

  raise notice 'A refund is its own act, not a payment with a minus sign';
  begin
    insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
    values (f.org_id, inv, -50, current_date - 5, 'card', f.u_owner);
    perform assert(false, 'a negative payment was refused');
  exception when check_violation then
    perform assert(true, 'a negative payment was refused');
  end;

  raise notice 'Part payments are normal, and do not settle anything';
  insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
  values (f.org_id, inv, 200, current_date - 5, 'check', f.u_owner);

  perform assert(invoice_balance(inv) = 440, 'the balance is what is left, computed rather than stored');
  select status into st from issued_invoices where id = inv;
  perform assert(st = 'issued', 'and the invoice is still open');

  raise notice 'The money covering it settles it, once';
  insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
  values (f.org_id, inv, 440, current_date - 2, 'card', f.u_owner);

  select status into st from issued_invoices where id = inv;
  perform assert(st = 'settled', 'the invoice settles when the balance reaches zero');
  perform assert(invoice_balance(inv) = 0, 'with nothing left on it');

  raise notice 'A payment cannot be edited or deleted';
  begin
    update payments set amount = 1 where invoice_id = inv;
    perform assert(false, 'a recorded payment cannot be changed');
  exception when insufficient_privilege then
    -- There is no version of editing this that is not a mistake or a cover-up.
    -- A payment keyed wrongly is corrected by recording the correction.
    perform assert(true, 'a recorded payment cannot be changed');
  end;

  begin
    delete from payments where invoice_id = inv;
    perform assert(false, 'nor deleted');
  exception when insufficient_privilege then
    perform assert(true, 'nor deleted');
  end;

  raise notice 'An overpayment settles rather than going negative in status';
  insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
  values (f.org_id, inv, 640, current_date - 1, 'ach', f.u_owner);
  select status into st from issued_invoices where id = inv;
  perform assert(st = 'settled', 'a family who paid twice has still settled the invoice');
  perform assert(
    invoice_balance(inv) = -640,
    'and the credit is a negative balance the report shows separately, not a reduction in somebody else''s arrears'
  );

  raise notice 'A write-off carries a name and a reason';
  begin
    update issued_invoices set status = 'written_off' where id = inv;
    perform assert(false, 'a write-off with no reason was refused');
  exception when check_violation then
    perform assert(true, 'a write-off with no reason was refused');
  end;

  raise notice 'Money is not everybody''s business';
  perform act_as(f.auth_sched);
  select count(*) into visible from issued_invoices where id = inv;
  perform assert(visible = 0, 'a scheduler does not read what a family owes');

  begin
    insert into payments (organization_id, invoice_id, amount, received_on, method, recorded_by_user_id)
    values (f.org_id, inv, 10, current_date, 'card', f.u_sched);
    perform assert(false, 'nor record a payment');
  exception when insufficient_privilege then
    perform assert(true, 'nor record a payment');
  end;

  perform act_as(f.auth_cg);
  select count(*) into visible from issued_invoices where id = inv;
  perform assert(
    visible = 0,
    'and a caregiver certainly does not — arriving knowing a family is three invoices behind changes the visit'
  );
  select count(*) into visible from payments;
  perform assert(visible = 0, 'nor reads the payments');

  raise notice 'ALL INVOICE AND PAYMENT ASSERTIONS PASSED';
end;
$$;
