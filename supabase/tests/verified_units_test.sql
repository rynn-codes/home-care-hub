-- Joy Health — the one approved fact about a visit
--
-- The properties 0015 exists for, and which only the database can hold:
--
--   no approved figure without a name and a time against it
--   verified means both figures, never one
--   the two figures differing requires a reason
--   a verified unit is superseded, never edited
--   one live unit per visit
--   payroll's view has never heard of billing, and vice versa
--   a caregiver reads nothing here
--
-- Every assertion runs as `authenticated`. RLS is bypassed for the table owner,
-- so a suite that forgets this proves nothing at all.

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

create temporary table unit_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — service units') returning id
),
-- The client is fictional. Being a care recipient is health information; the
-- caregiver is a name on a roster, which is not.
client_p as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Jamisha', 'Harper' from org returning id
),
ep as (
  insert into employee_profiles (person_id, job_role, employee_status)
  select id, 'cna', 'active' from caregiver returning person_id
),
cp as (
  insert into client_profiles (person_id, client_status)
  select id, 'active' from client_p returning person_id
),
visit_one as (
  insert into visits (organization_id, client_person_id, caregiver_person_id,
                      service, starts_at, ends_at, status)
  select org.id, client_p.id, caregiver.id, 'personal_care',
         '2026-08-17T09:00:00Z', '2026-08-17T13:00:00Z', 'completed'
  from org, client_p, caregiver returning id
),
visit_two as (
  insert into visits (organization_id, client_person_id, caregiver_person_id,
                      service, starts_at, ends_at, status)
  select org.id, client_p.id, caregiver.id, 'personal_care',
         '2026-08-18T09:00:00Z', '2026-08-18T13:00:00Z', 'completed'
  from org, client_p, caregiver returning id
),
auth_owner as (insert into auth.users (id, email) values (gen_random_uuid(), 'own@x.com') returning id),
auth_bill  as (insert into auth.users (id, email) values (gen_random_uuid(), 'bill@x.com') returning id),
auth_pay   as (insert into auth.users (id, email) values (gen_random_uuid(), 'pay@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
auth_cg    as (insert into auth.users (id, email) values (gen_random_uuid(), 'j@x.com') returning id),
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
u_pay as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_pay.id, 'Pay', 'Roll', 'pay@x.com', 'payroll', 'active'
  from org, auth_pay returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sch@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
),
u_cg as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_cg.id, caregiver.id, 'Jamisha', 'Harper', 'j@x.com', 'employee', 'active'
  from org, auth_cg, caregiver returning id
),
g_work as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', caregiver.id, 'active' from org, caregiver returning id
)
select org.id as org_id, client_p.id as client_p, caregiver.id as caregiver,
       visit_one.id as visit_one, visit_two.id as visit_two,
       auth_owner.id as auth_owner, auth_bill.id as auth_bill,
       auth_pay.id as auth_pay, auth_sched.id as auth_sched, auth_cg.id as auth_cg,
       u_owner.id as u_owner, u_bill.id as u_bill
from org, client_p, caregiver, cp, ep, visit_one, visit_two,
     auth_owner, auth_bill, auth_pay, auth_sched, auth_cg,
     u_owner, u_bill, u_pay, u_sched, u_cg, g_work;

do $$
declare
  f record;
  unit uuid;
  second_unit uuid;
  correction uuid;
  visible int;
  cols int;
begin
  select * into f from unit_fixture;
  set local role authenticated;
  perform act_as(f.auth_bill);

  -- ================================================= approval is a name == --

  raise notice 'A proposed unit approves nothing';
  insert into verified_service_units (
    organization_id, visit_id, client_person_id, caregiver_person_id,
    served_on, scheduled_minutes, actual_minutes, service_code
  )
  values (f.org_id, f.visit_one, f.client_p, f.caregiver, '2026-08-17', 240, 265, 'personal_care')
  returning id into unit;

  perform assert(
    (select approved_payable_minutes is null and approved_billable_minutes is null
       from verified_service_units where id = unit),
    'a unit read off the clock carries no approved figure'
  );

  raise notice 'No approved figure without somebody''s name against it';
  begin
    update verified_service_units
    set approved_payable_minutes = 265, approved_billable_minutes = 265
    where id = unit;
    perform assert(false, 'an approved figure with nobody''s name was refused');
  exception when check_violation then
    -- A number that appears with no name on it is a number everybody downstream
    -- assumes somebody checked.
    perform assert(true, 'an approved figure with nobody''s name was refused');
  end;

  begin
    update verified_service_units
    set approved_payable_minutes = 265, approved_billable_minutes = 265,
        verified_by_user_id = f.u_bill, verified_at = null
    where id = unit;
    perform assert(false, 'an approval with no time on it was refused');
  exception when check_violation then
    perform assert(true, 'an approval with no time on it was refused');
  end;

  raise notice 'Verified means both figures, never one';
  begin
    update verified_service_units
    set state = 'verified', approved_payable_minutes = 265,
        verified_by_user_id = f.u_bill, verified_at = now()
    where id = unit;
    perform assert(false, 'verifying with only the payable figure was refused');
  exception when check_violation then
    -- Half-verified is exactly the drift this table exists to prevent: payroll
    -- reading an approved figure while billing reads nothing.
    perform assert(true, 'verifying with only the payable figure was refused');
  end;

  raise notice 'Two different figures need a reason';
  begin
    update verified_service_units
    set state = 'verified', approved_payable_minutes = 265,
        approved_billable_minutes = 240,
        verified_by_user_id = f.u_bill, verified_at = now()
    where id = unit;
    perform assert(false, 'paying for more than was billed, unexplained, was refused');
  exception when check_violation then
    -- Jamisha stayed twenty-five minutes because the family asked. Whether Joy
    -- bills for that is a decision, and a decision with no reason recorded is
    -- one nobody can defend in March.
    perform assert(true, 'paying for more than was billed, unexplained, was refused');
  end;

  update verified_service_units
  set state = 'verified', approved_payable_minutes = 265,
      approved_billable_minutes = 240,
      note = 'Stayed 25 minutes at the daughter''s request; not billed.',
      verified_by_user_id = f.u_bill, verified_at = now()
  where id = unit;
  perform assert(
    (select state from verified_service_units where id = unit) = 'verified',
    'with the reason written down, the same approval goes through'
  );

  -- ================================================ verified is settled == --

  raise notice 'A verified unit is not editable';
  begin
    update verified_service_units set approved_billable_minutes = 265 where id = unit;
    perform assert(false, 'rewriting an approved figure was refused');
  exception when check_violation then
    -- Payroll may have paid on this figure and an invoice may have gone out
    -- from it. Overwriting leaves both pointing at a record that no longer says
    -- what they acted on.
    perform assert(true, 'rewriting an approved figure was refused');
  end;

  begin
    update verified_service_units set note = 'never mind' where id = unit;
    perform assert(false, 'rewriting the reason was refused too');
  exception when check_violation then
    perform assert(true, 'rewriting the reason was refused too');
  end;

  raise notice 'A correction is a new record, not a changed one';
  -- Both rows in one transaction, and the order is forced: the original has to
  -- step aside before the correction can take its place as the live unit, and it
  -- names its successor before that successor exists. The deferred foreign key
  -- is what makes that expressible; it is still checked at commit.
  correction := gen_random_uuid();

  update verified_service_units
  set state = 'superseded', superseded_by = correction
  where id = unit;

  insert into verified_service_units (
    id, organization_id, visit_id, client_person_id, caregiver_person_id,
    served_on, scheduled_minutes, actual_minutes, service_code, note,
    approved_payable_minutes, approved_billable_minutes,
    state, verified_by_user_id, verified_at
  )
  values (correction, f.org_id, f.visit_one, f.client_p, f.caregiver, '2026-08-17',
          240, 265, 'personal_care',
          'Corrected: the family asked and agreed to pay for the extra time.',
          265, 265, 'verified', f.u_bill, now());
  perform assert(
    (select state from verified_service_units where id = unit) = 'superseded',
    'superseding is allowed, because that is how a correction is recorded'
  );
  perform assert(
    (select superseded_by from verified_service_units where id = unit) = correction,
    'and the superseded record says which one replaced it'
  );

  begin
    update verified_service_units set state = 'superseded', superseded_by = null
    where id = correction;
    perform assert(false, 'superseding into thin air was refused');
  exception when check_violation then
    -- Otherwise "superseded" is indistinguishable from deleted, and the figure
    -- somebody acted on has no successor to point at.
    perform assert(true, 'superseding into thin air was refused');
  end;

  raise notice 'One live answer per visit';
  begin
    insert into verified_service_units (
      organization_id, visit_id, client_person_id, caregiver_person_id,
      served_on, scheduled_minutes, service_code
    )
    values (f.org_id, f.visit_one, f.client_p, f.caregiver, '2026-08-17', 240, 'personal_care');
    perform assert(false, 'a second live unit for the same visit was refused');
  exception when unique_violation then
    -- Two answers to "how long was this visit", and whichever the query read
    -- first would win.
    perform assert(true, 'a second live unit for the same visit was refused');
  end;

  perform assert(
    (select count(*) from verified_service_units where visit_id = f.visit_one) = 2,
    'both the original and the correction are still on the record'
  );

  -- ======================================== what each ledger can reach == --

  raise notice 'Payroll''s view has never heard of billing';
  select count(*) into cols from information_schema.columns
   where table_name = 'payable_service_units'
     and column_name in ('client_person_id', 'approved_billable_minutes');
  perform assert(cols = 0, 'payable_service_units carries no client and no billable figure');

  select count(*) into cols from information_schema.columns
   where table_name = 'billable_service_units'
     and column_name in ('caregiver_person_id', 'approved_payable_minutes');
  perform assert(cols = 0, 'billable_service_units carries no caregiver and no payable figure');

  perform assert(
    (select minutes from payable_service_units where id = correction) = 265,
    'payroll reads the approved payable figure'
  );
  perform assert(
    (select minutes from billable_service_units where id = correction) = 265,
    'billing reads the approved billable figure'
  );

  raise notice 'And neither view shows a unit nobody has approved';
  insert into verified_service_units (
    organization_id, visit_id, client_person_id, caregiver_person_id,
    served_on, scheduled_minutes, actual_minutes, service_code
  )
  values (f.org_id, f.visit_two, f.client_p, f.caregiver, '2026-08-18', 240, 205, 'personal_care')
  returning id into second_unit;

  select count(*) into visible from payable_service_units where id = second_unit;
  perform assert(visible = 0, 'a proposed unit is not payable');
  select count(*) into visible from billable_service_units where id = second_unit;
  perform assert(visible = 0, 'and not billable');
  select count(*) into visible from payable_service_units where id = unit;
  perform assert(visible = 0, 'a superseded unit is neither');

  -- =============================================================== who == --

  raise notice 'Payroll may verify; a scheduler may propose but not approve';
  perform act_as(f.auth_pay);
  select count(*) into visible from verified_service_units where id = second_unit;
  perform assert(visible = 1, 'payroll reads the unit');

  perform act_as(f.auth_sched);
  select count(*) into visible from verified_service_units where id = second_unit;
  perform assert(visible = 1, 'a scheduler reads it — whether a visit was worked is operational');

  begin
    update verified_service_units set actual_minutes = 240 where id = second_unit;
    perform assert(
      (select count(*) from verified_service_units
        where id = second_unit and actual_minutes = 240) = 0,
      'a scheduler cannot change the unit'
    );
  exception when insufficient_privilege then
    perform assert(true, 'a scheduler cannot change the unit');
  end;

  raise notice 'A caregiver reads nothing here';
  perform act_as(f.auth_cg);
  select count(*) into visible from verified_service_units;
  perform assert(visible = 0, 'a caregiver reads no service unit');
  select count(*) into visible from payable_service_units;
  perform assert(
    visible = 0,
    'and the view does not let her round the policy — security_invoker is on'
  );
  select count(*) into visible from billable_service_units;
  perform assert(visible = 0, 'nor the billing view; J-06 keeps her out of rates entirely');

  raise notice 'The owner sees all of it';
  perform act_as(f.auth_owner);
  select count(*) into visible from verified_service_units;
  perform assert(visible = 3, 'the owner reads every unit, superseded ones included');

  raise notice 'ALL VERIFIED SERVICE UNIT ASSERTIONS PASSED';
end;
$$;
