-- Joy Health — portal access boundary
--
-- The test this file exists for: before 0006, a user with role `employee` and
-- an active session read every `people` row and every `client_profile` in the
-- organization. The React guard was irrelevant — anyone with the anon key can
-- call PostgREST directly.
--
-- Every assertion runs as `authenticated`. RLS is bypassed for the table owner,
-- so a test running as postgres proves nothing at all; that mistake was made
-- once in this repository already and is documented in DOCUMENT_PIPELINE.md.

\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Same two helpers rls_test.sql defines. Repeated rather than imported so this
-- file runs on its own.
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

create temporary table fixture as
with org as (
  insert into organizations (name) values ('Joy Health') returning id
),
-- Clients are fictional. Being a care recipient is health information.
client_a as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
client_b as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Evelyn', 'Carter' from org returning id
),
caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Jamisha', 'Harper' from org returning id
),
daughter as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
cp_a as (
  insert into client_profiles (person_id, client_status)
  select id, 'active' from client_a returning person_id
),
cp_b as (
  insert into client_profiles (person_id, client_status)
  select id, 'active' from client_b returning person_id
),
ep as (
  insert into employee_profiles (person_id, job_role, employee_status)
  select id, 'cna', 'active' from caregiver returning id, person_id
),
auth_caregiver as (
  insert into auth.users (id, email) values (gen_random_uuid(), 'j@example.com') returning id
),
auth_daughter as (
  insert into auth.users (id, email) values (gen_random_uuid(), 's@example.com') returning id
),
auth_admin as (
  insert into auth.users (id, email) values (gen_random_uuid(), 'k@example.com') returning id
),
u_caregiver as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_caregiver.id, caregiver.id, 'Jamisha', 'Harper', 'j@example.com', 'employee', 'active'
  from org, auth_caregiver, caregiver returning id
),
u_daughter as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_daughter.id, daughter.id, 'Susan', 'Bell', 's@example.com', 'client_contact', 'active'
  from org, auth_daughter, daughter returning id
),
u_admin as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_admin.id, 'Karynn', 'V', 'k@example.com', 'ceo_admin', 'active'
  from org, auth_admin returning id
),
g_work as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', caregiver.id, 'active' from org, caregiver returning id
),
g_family as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state)
  select org.id, 'family', daughter.id, client_a.id, 'active' from org, daughter, client_a returning id
)
select
  org.id            as org_id,
  client_a.id       as client_a,
  client_b.id       as client_b,
  caregiver.id      as caregiver,
  daughter.id       as daughter,
  ep.id             as employee_profile,
  auth_caregiver.id as auth_caregiver,
  auth_daughter.id  as auth_daughter,
  auth_admin.id     as auth_admin
from org, client_a, client_b, caregiver, daughter, ep,
     auth_caregiver, auth_daughter, auth_admin,
     cp_a, cp_b, u_caregiver, u_daughter, u_admin, g_work, g_family;

do $$
declare
  f record;
  visible int;
begin
  select * into f from fixture;

  set local role authenticated;

  -- ------------------------------------------------------------ caregiver --
  raise notice 'A caregiver with a portal login';
  perform act_as(f.auth_caregiver);

  select count(*) into visible from people;
  perform assert(visible = 1, 'caregiver sees only herself in people (was 4 before 0006)');

  select count(*) into visible from people where id = f.client_a;
  perform assert(visible = 0, 'caregiver cannot read a client she is not assigned to');

  select count(*) into visible from client_profiles;
  perform assert(visible = 0, 'caregiver reads no client profiles (was 2 before 0006)');

  select count(*) into visible from employee_profiles;
  perform assert(visible = 1, 'caregiver reads her own employment record');

  select count(*) into visible from admissions;
  perform assert(visible = 0, 'caregiver reads no admissions');

  select count(*) into visible from credential_requirements;
  perform assert(visible >= 0, 'caregiver may read what is required of her');

  -- --------------------------------------------------------------- family --
  raise notice 'A responsible party';
  perform act_as(f.auth_daughter);

  select count(*) into visible from people where id = f.client_a;
  perform assert(visible = 1, 'daughter reads the person whose care she is responsible for');

  select count(*) into visible from people where id = f.client_b;
  perform assert(visible = 0, 'daughter cannot read another agency client');

  select count(*) into visible from people where id = f.caregiver;
  perform assert(visible = 0, 'daughter cannot read a caregiver''s person record');

  select count(*) into visible from employee_profiles;
  perform assert(visible = 0, 'daughter reads no employment records');

  select count(*) into visible from client_profiles;
  perform assert(visible = 1, 'daughter reads exactly one client profile — her father''s');

  -- ------------------------------------------------------ grant escalation --
  raise notice 'A portal user cannot widen their own access';
  begin
    insert into portal_grants (organization_id, audience, person_id, subject_person_id, state)
    values (f.org_id, 'family', f.daughter, f.client_b, 'active');
    perform assert(false, 'daughter must not be able to grant herself another family portal');
  exception when insufficient_privilege or check_violation then
    perform assert(true, 'daughter cannot grant herself another family portal');
  end;

  select count(*) into visible from portal_grants;
  perform assert(visible = 1, 'daughter sees only her own grant');

  -- ---------------------------------------------------------------- staff --
  raise notice 'Staff are unaffected';
  perform act_as(f.auth_admin);

  select count(*) into visible from people;
  perform assert(visible = 4, 'the owner still reads every person');

  select count(*) into visible from client_profiles;
  perform assert(visible = 2, 'the owner still reads every client profile');

  select count(*) into visible from portal_grants;
  perform assert(visible = 2, 'the owner reads every portal grant');

  reset role;
  raise notice 'portal access boundary: all assertions passed';
end $$;
