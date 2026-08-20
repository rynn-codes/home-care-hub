-- Joy Health — charts, Moments and preferences
--
-- The three rules this file exists to prove are enforced in the database and
-- not only in a component:
--
--   A confirmed chart cannot be edited.
--   A caregiver may share her own words; only the office may share a model's.
--   A family never sees a chart, a draft, or another client's Moment.
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

create temporary table fx as
with org as (insert into organizations (name) values ('Joy Health') returning id),
client as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Marcus', 'Bell' from org returning id
),
other_client as (
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
a_cg as (insert into auth.users (id, email) values (gen_random_uuid(), 'j@x.com') returning id),
a_dau as (insert into auth.users (id, email) values (gen_random_uuid(), 's@x.com') returning id),
a_adm as (insert into auth.users (id, email) values (gen_random_uuid(), 'k@x.com') returning id),
u_cg as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, a_cg.id, caregiver.id, 'J', 'H', 'j@x.com', 'employee', 'active'
  from org, a_cg, caregiver returning id
),
u_dau as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, a_dau.id, daughter.id, 'S', 'B', 's@x.com', 'client_contact', 'active'
  from org, a_dau, daughter returning id
),
u_adm as (
  insert into users (organization_id, auth_user_id, first_name, last_name, email, role, status)
  select org.id, a_adm.id, 'Karynn', 'V', 'k@x.com', 'ceo_admin', 'active'
  from org, a_adm returning id
),
g_cg as (
  insert into portal_grants (organization_id, audience, person_id, state)
  select org.id, 'workforce', caregiver.id, 'active' from org, caregiver returning id
),
g_dau as (
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state)
  select org.id, 'family', daughter.id, client.id, 'active' from org, daughter, client returning id
),
v as (
  insert into visits (organization_id, client_person_id, caregiver_person_id, starts_at, ends_at)
  select org.id, client.id, caregiver.id, now() - interval '2 hours', now() - interval '1 hour'
  from org, client, caregiver returning id
)
select org.id as org, client.id as client, other_client.id as other_client,
       caregiver.id as caregiver, daughter.id as daughter,
       a_cg.id as a_cg, a_dau.id as a_dau, a_adm.id as a_adm, v.id as visit
from org, client, other_client, caregiver, daughter, a_cg, a_dau, a_adm,
     u_cg, u_dau, u_adm, g_cg, g_dau, v;

do $$
declare
  f record; n int; chart uuid; moment uuid; pref uuid;
begin
  select * into f from fx;
  set local role authenticated;

  -- ------------------------------------------------------------ charts --
  raise notice 'A chart is the caregiver''s attestation';
  perform act_as(f.a_cg);

  insert into visit_charts (organization_id, visit_id, caregiver_person_id, narrative)
  values (f.org, f.visit, f.caregiver, 'She showered with standby assistance. No falls.')
  returning id into chart;
  perform assert(chart is not null, 'a caregiver can start a chart on her own visit');

  insert into visit_chart_lines (chart_id, position, heading, body, source_kind, source_reference)
  values (chart, 1, 'Bathing', 'Completed', 'recorded', 'bathing');
  perform assert(true, 'a recorded line needs no citation');

  begin
    insert into visit_chart_lines (chart_id, position, heading, body, source_kind, source_reference)
    values (chart, 2, 'Observation', 'Client reported hip pain.', 'drafted', '');
    perform assert(false, 'an uncited drafted line must be refused');
  exception when check_violation then
    perform assert(true, 'a drafted line with nothing to cite is refused by the schema');
  end;

  update visit_charts
     set confirmed_by_person_id = f.caregiver, confirmed_at = now()
   where id = chart;
  perform assert(true, 'she can confirm it');

  begin
    update visit_charts set narrative = 'Something else' where id = chart;
    perform assert(false, 'a confirmed chart must not be editable');
  exception when check_violation then
    perform assert(true, 'a confirmed chart cannot be edited — an amendment is a different act');
  end;

  raise notice 'A family never sees a chart';
  perform act_as(f.a_dau);
  select count(*) into n from visit_charts;
  perform assert(n = 0, 'the daughter cannot read her father''s visit chart');
  select count(*) into n from visit_chart_lines;
  perform assert(n = 0, 'nor any of its lines');

  -- ----------------------------------------------------------- moments --
  raise notice 'Moments';
  perform act_as(f.a_cg);

  insert into moments (organization_id, visit_id, client_person_id, narrative, body,
                       created_by_person_id, origin)
  values (f.org, f.visit, f.client, 'He beat me at chess.', 'He beat me at chess.',
          f.caregiver, 'caregiver')
  returning id into moment;

  update moments
     set state = 'shared', approved_by_person_id = f.caregiver, approved_at = now(), shared_at = now()
   where id = moment;
  perform assert(true, 'a caregiver may share her own words');

  -- The rule that needed enforcing.
  insert into moments (organization_id, visit_id, client_person_id, narrative, body,
                       created_by_person_id, origin)
  values (f.org, f.visit, f.client, 'good day', 'Marcus had a lovely afternoon.',
          f.caregiver, 'ai_drafted')
  returning id into moment;

  begin
    update moments
       set state = 'shared', approved_by_person_id = f.caregiver, approved_at = now(), shared_at = now()
     where id = moment;
    perform assert(false, 'a caregiver must not publish a drafted Moment');
  exception when insufficient_privilege then
    perform assert(true, 'a caregiver cannot publish wording a model produced');
  end;

  raise notice 'The office can';
  perform act_as(f.a_adm);
  update moments
     set state = 'shared', approved_by_person_id = f.daughter, approved_at = now(), shared_at = now()
   where id = moment;
  perform assert(true, 'the office may publish a drafted Moment');

  raise notice 'What the family sees';
  perform act_as(f.a_dau);
  select count(*) into n from moments;
  perform assert(n = 2, 'the daughter sees both shared Moments about her father');

  perform act_as(f.a_cg);
  insert into moments (organization_id, visit_id, client_person_id, narrative, body,
                       created_by_person_id)
  values (f.org, f.visit, f.client, 'draft', 'Still being written.', f.caregiver);

  perform act_as(f.a_dau);
  select count(*) into n from moments;
  perform assert(n = 2, 'and never an unshared draft');

  -- ------------------------------------------------------- preferences --
  raise notice 'Preferences are maintained, not inferred';
  perform act_as(f.a_dau);

  insert into client_preferences (organization_id, client_person_id, text, source, added_by_person_id)
  values (f.org, f.client, 'Coffee with one cream', 'family', f.daughter)
  returning id into pref;
  perform assert(pref is not null, 'a family may suggest one');

  -- Worth being precise about the mechanism. The update policy restricts to
  -- staff via `using`, so a family's UPDATE matches no rows and Postgres
  -- reports that by changing nothing rather than by raising. The guarantee
  -- holds either way; asserting an exception would have been asserting the
  -- wrong thing, and would pass for the wrong reason if the policy were later
  -- loosened to `using (true)` with a weak `with check`.
  update client_preferences set state = 'approved', approved_by_person_id = f.daughter where id = pref;
  select count(*) into n from client_preferences where id = pref and state = 'proposed';
  perform assert(n = 1, 'a family cannot approve its own suggestion — the row is untouched');

  perform act_as(f.a_cg);
  select count(*) into n from client_preferences where id = pref;
  perform assert(n = 0, 'an unreviewed suggestion does not reach a caregiver at a front door');

  perform act_as(f.a_adm);
  update client_preferences set state = 'approved', approved_by_person_id = f.daughter where id = pref;

  perform act_as(f.a_cg);
  select count(*) into n from client_preferences where id = pref;
  perform assert(n = 1, 'once approved, the caregiver assigned to this client sees it');

  begin
    insert into client_preferences (organization_id, client_person_id, text, source, added_by_person_id)
    values (f.org, f.client, repeat('a', 200), 'caregiver', f.caregiver);
    perform assert(false, 'a paragraph must be refused');
  exception when check_violation then
    perform assert(true, 'a paragraph about somebody''s care is a care plan, and is refused');
  end;

  -- -------------------------------------------------- document requests --
  raise notice 'Document requests';
  perform act_as(f.a_cg);
  begin
    insert into client_document_requests (organization_id, client_person_id, label, requested_by_user_id)
    select f.org, f.client, 'Medication list', id from users where auth_user_id = f.a_cg;
    perform assert(false, 'a caregiver must not ask a family for documents');
  exception when insufficient_privilege then
    perform assert(true, 'only the office asks a family for a document');
  end;

  perform act_as(f.a_adm);
  insert into client_document_requests (organization_id, client_person_id, label, reason, requested_by_user_id)
  select f.org, f.client, 'Medication list', 'The nurse needs it.', id
  from users where auth_user_id = f.a_adm;

  perform act_as(f.a_dau);
  select count(*) into n from client_document_requests;
  perform assert(n = 1, 'the family sees what Joy has asked them for');

  reset role;
  raise notice 'charting and moments: all assertions passed';
end $$;
