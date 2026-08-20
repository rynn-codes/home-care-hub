-- Joy Health — the schedule, the clock, and the access that follows assignment
--
-- The rule 0006 could not express and 0007 does: a caregiver reads the clients
-- she is assigned to, and that access lapses when the assignment ages out.
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

create temporary table fixture as
with org as (
  insert into organizations (name) values ('Joy Health') returning id
),
-- Fictional clients, as everywhere in this repository.
current_client as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
old_client as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Evelyn', 'Carter' from org returning id
),
stranger as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Dolores', 'Vance' from org returning id
),
caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Jamisha', 'Harper' from org returning id
),
other_caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Maria', 'Santos' from org returning id
),
daughter as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
auth_cg as (insert into auth.users (id, email) values (gen_random_uuid(), 'j@x.com') returning id),
auth_other as (insert into auth.users (id, email) values (gen_random_uuid(), 'm@x.com') returning id),
auth_dau as (insert into auth.users (id, email) values (gen_random_uuid(), 's@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
u_cg as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_cg.id, caregiver.id, 'Jamisha', 'H', 'j@x.com', 'employee', 'active'
  from org, auth_cg, caregiver returning id
),
u_other as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_other.id, other_caregiver.id, 'Maria', 'S', 'm@x.com', 'employee', 'active'
  from org, auth_other, other_caregiver returning id
),
u_dau as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_dau.id, daughter.id, 'Susan', 'B', 's@x.com', 'client_contact', 'active'
  from org, auth_dau, daughter returning id
),
u_sched as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, auth_sched.id, 'Sch', 'Eduler', 'sch@x.com', 'scheduler', 'active'
  from org, auth_sched returning id
),
g_cg as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', caregiver.id, 'active' from org, caregiver returning id
),
g_other as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', other_caregiver.id, 'active' from org, other_caregiver returning id
),
g_dau as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state)
  select org.id, 'family', daughter.id, current_client.id, 'active'
  from org, daughter, current_client returning id
),
-- A visit tomorrow: she is assigned and should be able to prepare.
v_upcoming as (
  insert into visits (organization_id, client_person_id, caregiver_person_id, starts_at, ends_at)
  select org.id, current_client.id, caregiver.id, now() + interval '1 day', now() + interval '1 day 4 hours'
  from org, current_client, caregiver returning id
),
-- A visit 90 days ago: the assignment has aged out.
v_ancient as (
  insert into visits (organization_id, client_person_id, caregiver_person_id, starts_at, ends_at, status)
  select org.id, old_client.id, caregiver.id, now() - interval '90 days', now() - interval '90 days' + interval '4 hours', 'completed'
  from org, old_client, caregiver returning id
),
-- An open shift nobody holds.
v_open as (
  insert into visits (organization_id, client_person_id, starts_at, ends_at)
  select org.id, stranger.id, now() + interval '2 days', now() + interval '2 days 4 hours'
  from org, stranger returning id
)
select org.id as org_id, current_client.id as current_client, old_client.id as old_client,
       stranger.id as stranger, caregiver.id as caregiver, other_caregiver.id as other_caregiver,
       daughter.id as daughter, auth_cg.id as auth_cg, auth_other.id as auth_other,
       auth_dau.id as auth_dau, auth_sched.id as auth_sched,
       v_upcoming.id as v_upcoming, v_ancient.id as v_ancient, v_open.id as v_open
from org, current_client, old_client, stranger, caregiver, other_caregiver, daughter,
     auth_cg, auth_other, auth_dau, auth_sched,
     u_cg, u_other, u_dau, u_sched, g_cg, g_other, g_dau,
     v_upcoming, v_ancient, v_open;

do $$
declare
  f record;
  visible int;
  entry_id uuid;
begin
  select * into f from fixture;
  set local role authenticated;

  -- ------------------------------------------- access follows assignment --
  raise notice 'A caregiver reads the clients she is assigned to';
  perform act_as(f.auth_cg);

  select count(*) into visible from people where id = f.current_client;
  perform assert(visible = 1, 'she reads a client she is scheduled to visit tomorrow');

  select count(*) into visible from people where id = f.old_client;
  perform assert(visible = 0, 'access lapses — a visit 90 days ago no longer opens the record');

  select count(*) into visible from people where id = f.stranger;
  perform assert(visible = 0, 'she cannot read a client she has never been assigned');

  select count(*) into visible from people where id = f.other_caregiver;
  perform assert(visible = 0, 'she cannot read a colleague''s person record');

  -- ------------------------------------------------------------- visits --
  select count(*) into visible from visits;
  perform assert(visible = 2, 'she sees only her own visits');

  select count(*) into visible from visits where id = f.v_open;
  perform assert(visible = 0, 'an open shift is not offered to her by accident');

  raise notice 'Another caregiver is not affected by her assignments';
  perform act_as(f.auth_other);
  select count(*) into visible from visits;
  perform assert(visible = 0, 'a caregiver with no visits sees none');
  select count(*) into visible from people where id = f.current_client;
  perform assert(visible = 0, 'and cannot read the other caregiver''s client');

  -- ------------------------------------------------------------- family --
  raise notice 'A family reads their own person''s visits';
  perform act_as(f.auth_dau);

  select count(*) into visible from visits;
  perform assert(visible = 1, 'the daughter sees her father''s visit and nothing else');

  select count(*) into visible from visit_time_entries;
  perform assert(visible = 0, 'a family reads no time entries — when somebody clocked in is employment data');

  -- -------------------------------------------------------------- clock --
  raise notice 'The clock';
  perform act_as(f.auth_cg);

  insert into visit_time_entries (organization_id, visit_id, caregiver_person_id)
  values (f.org_id, f.v_upcoming, f.caregiver) returning id into entry_id;
  perform assert(entry_id is not null, 'she can clock in on her own visit');

  select count(*) into visible from visit_time_entries where id = entry_id and clocked_in_at is not null;
  perform assert(visible = 1, 'the server stamped the time, not the caller');

  begin
    insert into visit_time_entries (organization_id, visit_id, caregiver_person_id)
    values (f.org_id, f.v_upcoming, f.caregiver);
    perform assert(false, 'a second open entry on one visit must be refused');
  exception when unique_violation then
    perform assert(true, 'a second clock-in on a running visit is refused');
  end;

  begin
    insert into visit_time_entries (organization_id, visit_id, caregiver_person_id)
    values (f.org_id, f.v_open, f.caregiver);
    perform assert(false, 'she must not clock in on a visit that is not hers');
  exception when insufficient_privilege then
    perform assert(true, 'she cannot clock in on a visit that is not hers');
  end;

  perform act_as(f.auth_other);
  begin
    insert into visit_time_entries (organization_id, visit_id, caregiver_person_id)
    values (f.org_id, f.v_upcoming, f.caregiver);
    perform assert(false, 'nobody may write a time entry under another person''s name');
  exception when insufficient_privilege then
    perform assert(true, 'nobody may write a time entry under another person''s name');
  end;

  -- --------------------------------------------------------------- staff --
  raise notice 'The office';
  perform act_as(f.auth_sched);

  select count(*) into visible from visits;
  perform assert(visible = 3, 'a scheduler sees the whole board including open shifts');

  select count(*) into visible from visit_time_entries;
  perform assert(visible = 1, 'and the time entries');

  -- The schedule is the office's to write.
  perform act_as(f.auth_cg);
  begin
    insert into visits (organization_id, client_person_id, caregiver_person_id, starts_at, ends_at)
    values (f.org_id, f.stranger, f.caregiver, now() + interval '3 days', now() + interval '3 days 2 hours');
    perform assert(false, 'a caregiver must not be able to give herself a visit');
  exception when insufficient_privilege then
    perform assert(true, 'a caregiver cannot give herself a visit');
  end;

  reset role;
  raise notice 'visits and time: all assertions passed';
end $$;
