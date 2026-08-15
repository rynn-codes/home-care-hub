-- Joy Health — admissions schema tests
--
-- Run after local_shim.sql, all migrations, and independently of rls_test.sql.
-- Each assertion raises on failure, so the script exits non-zero under
-- ON_ERROR_STOP and can gate a deploy.

\set ON_ERROR_STOP on

create or replace function assert(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', description;
  end if;
  raise notice '  ok  %', description;
end;
$$;

create or replace function act_as(auth_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', auth_id::text, true);
end;
$$;

do $$
declare
  org_a uuid; org_b uuid;
  auth_intake uuid; auth_billing uuid; auth_b uuid;
  marcus uuid; other_org_person uuid;
  adm uuid;
  blocked boolean;
  visible int;
begin
  insert into auth.users default values returning id into auth_intake;
  insert into auth.users default values returning id into auth_billing;
  insert into auth.users default values returning id into auth_b;

  insert into organizations (name) values ('Joy Healthcare Services') returning id into org_a;
  insert into organizations (name) values ('Rival Home Care') returning id into org_b;

  insert into users (organization_id, auth_user_id, first_name, last_name, role, status)
  values (org_a, auth_intake, 'Dana', 'Whitfield', 'intake_coordinator', 'active'),
         (org_a, auth_billing, 'Bill', 'Ingham', 'billing', 'active'),
         (org_b, auth_b, 'Rival', 'Admin', 'ceo_admin', 'active');

  insert into people (organization_id, first_name, last_name)
  values (org_a, 'Marcus', 'Bell') returning id into marcus;
  insert into people (organization_id, first_name, last_name)
  values (org_b, 'Someone', 'Else') returning id into other_org_person;

  raise notice 'Referral creation and stage defaults';

  set local role authenticated;
  perform act_as(auth_intake);

  insert into admissions (organization_id, client_person_id, referral_source, service_requested,
                          service_area, best_contact_method, referral_note)
  values (org_a, marcus, 'hospital_discharge', 'personal_care', '77004', 'phone',
          'Daughter Susan called; two recent falls')
  returning id into adm;

  perform assert(
    (select stage from admissions where id = adm) = 'new_referral',
    'a new referral starts at new_referral');
  perform assert(
    (select status from admissions where id = adm) = 'active',
    'a new referral starts active');

  -- The duplicate the Admissions spec asks Joy to catch. The domain layer warns
  -- the user; this index is the backstop when it is dismissed or bypassed.
  begin
    insert into admissions (organization_id, client_person_id)
    values (org_a, marcus);
    blocked := false;
  exception when unique_violation then
    blocked := true;
  end;
  perform assert(blocked, 'a person cannot have two open admissions');

  raise notice 'Closing keeps the history';

  begin
    update admissions set stage = 'closed', status = 'closed' where id = adm;
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'closing without a reason and timestamp is refused');

  update admissions
     set stage = 'closed', status = 'closed', closed_at = now(),
         close_reason = 'Family chose another agency'
   where id = adm;
  perform assert(
    (select count(*) from admissions where id = adm) = 1,
    'a closed referral is kept, not deleted');

  -- Once the first is closed, a genuine second enquiry is allowed.
  insert into admissions (organization_id, client_person_id) values (org_a, marcus);
  perform assert(
    (select count(*) from admissions where client_person_id = marcus) = 2,
    'a new enquiry is allowed once the previous one is closed');

  reset role;

  raise notice 'Tenancy and roles';

  set local role authenticated;
  perform act_as(auth_intake);

  -- RLS alone would allow this: the row carries the caller's own org id, and
  -- only the trigger notices that the person belongs to someone else.
  begin
    insert into admissions (organization_id, client_person_id)
    values (org_a, other_org_person);
    blocked := false;
  exception when check_violation then
    blocked := true;
  end;
  perform assert(blocked, 'an admission cannot point at another organization''s person');

  reset role;
  set local role authenticated;
  perform act_as(auth_b);

  select count(*) into visible from admissions;
  perform assert(visible = 0, 'another organization sees none of these admissions');

  reset role;
  set local role authenticated;
  perform act_as(auth_billing);

  select count(*) into visible from admissions;
  perform assert(visible = 2, 'billing can read admissions in its own organization');

  begin
    insert into admissions (organization_id, client_person_id) values (org_a, marcus);
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  perform assert(blocked, 'billing cannot create a referral');

  reset role;
end
$$;

\echo 'All admissions tests passed.'
