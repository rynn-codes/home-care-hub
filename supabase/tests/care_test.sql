-- Joy Health — care plans, incidents and supervisory visits
--
-- The invariants in 0010 that a React page cannot be trusted to hold on its
-- own: one active plan per client, an incident that cannot be closed while
-- somebody still has to be told, and a caregiver's report that the office may
-- not rewrite.
--
-- Every assertion runs as `authenticated`. RLS is bypassed for the table owner,
-- so a test that forgets this passes for the wrong reason.
--
-- Note on reads: an RLS `using` clause filters rows, it does not raise. So a
-- read that should be refused is asserted as a count of zero, and only writes
-- are asserted as exceptions.

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

create temporary table care_fixture as
with org as (
  insert into organizations (name) values ('Joy Health — care') returning id
),
other_org as (
  insert into organizations (name) values ('Somebody Else Home Care') returning id
),
-- Fictional clients, as everywhere in this repository.
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
other_caregiver as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Maria', 'Santos' from org returning id
),
daughter as (
  insert into people (organization_id, first_name, last_name)
  select id, 'Susan', 'Bell' from org returning id
),
auth_rn as (insert into auth.users (id, email) values (gen_random_uuid(), 'rn@x.com') returning id),
auth_sched as (insert into auth.users (id, email) values (gen_random_uuid(), 'sch@x.com') returning id),
auth_cg as (insert into auth.users (id, email) values (gen_random_uuid(), 'cg@x.com') returning id),
auth_other as (insert into auth.users (id, email) values (gen_random_uuid(), 'oth@x.com') returning id),
auth_dau as (insert into auth.users (id, email) values (gen_random_uuid(), 'dau@x.com') returning id),
-- Karynn holds a current RN licence. 0011 checks the licence rather than the
-- role, and this fixture caught the change: with the title alone she could not
-- record a supervisory visit, which is right — a clinical manager whose licence
-- lapsed still has the title.
u_rn as (
  insert into users (
    organization_id, auth_user_id, first_name, last_name, email, role, status,
    rn_licence_number, rn_licence_state, rn_licence_expires
  )
  select org.id, auth_rn.id, 'Karynn', 'V', 'rn@x.com', 'rn_clinical', 'active',
         'RN-TEST-1', 'TX', current_date + 200
  from org, auth_rn returning id
),
-- A second nurse whose licence lapsed last month. The case a role check cannot
-- see at all.
auth_lapsed as (insert into auth.users (id, email) values (gen_random_uuid(), 'lapsed@x.com') returning id),
u_lapsed as (
  insert into users (
    organization_id, auth_user_id, first_name, last_name, email, role, status,
    rn_licence_number, rn_licence_state, rn_licence_expires
  )
  select org.id, auth_lapsed.id, 'Nadia', 'P', 'lapsed@x.com', 'rn_clinical', 'active',
         'RN-TEST-2', 'TX', current_date - 30
  from org, auth_lapsed returning id
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
u_other as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_other.id, other_caregiver.id, 'Maria', 'S', 'oth@x.com', 'employee', 'active'
  from org, auth_other, other_caregiver returning id
),
u_dau as (
  insert into users (organization_id, auth_user_id, person_id, first_name, last_name, email, role, status)
  select org.id, auth_dau.id, daughter.id, 'Susan', 'B', 'dau@x.com', 'client_contact', 'active'
  from org, auth_dau, daughter returning id
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
  insert into portal_grants (organization_id, audience, person_id, subject_person_id, state, role, allowed_actions)
  select org.id, 'family', daughter.id, client_a.id, 'active', 'family_viewer', array['view_care_updates'] from org, daughter, client_a returning id
),
-- Jamisha is assigned to Marcus tomorrow, and to nobody else.
v_assigned as (
  insert into visits (organization_id, client_person_id, caregiver_person_id, starts_at, ends_at)
  select org.id, client_a.id, caregiver.id, now() + interval '1 day', now() + interval '1 day 4 hours'
  from org, client_a, caregiver returning id
),
-- Marcus's live plan, and a draft revision that has not been signed off.
-- Built as a draft and activated below, because that is the only order the
-- database allows: a live plan's tasks are frozen, so they go on while it is
-- still a draft. Getting this wrong in the fixture was the first thing the
-- trigger caught.
plan_live as (
  insert into care_plans (
    organization_id, client_person_id, version, state, goals, vitals,
    authored_by_user_id, reviewed_by_user_id, reviewed_at
  )
  select org.id, client_a.id, 1, 'draft', array['Patient clean, comfortable'],
         '[{"key":"o2_low","label":"O2 sat below","value":"89"}]'::jsonb,
         u_rn.id, u_rn.id, now() - interval '30 days'
  from org, client_a, u_rn returning id
),
plan_draft as (
  insert into care_plans (
    organization_id, client_person_id, version, supersedes_id, state, goals, authored_by_user_id
  )
  select org.id, client_a.id, 2, plan_live.id, 'draft', array['Patient clean, comfortable'], u_rn.id
  from org, client_a, u_rn, plan_live returning id
),
-- Evelyn's plan, which Jamisha has nothing to do with.
plan_other as (
  insert into care_plans (
    organization_id, client_person_id, version, state, goals, vitals,
    authored_by_user_id, reviewed_by_user_id, reviewed_at, effective_from
  )
  select org.id, client_b.id, 1, 'active', array['Effective/safe care'], '[]'::jsonb,
         u_rn.id, u_rn.id, now(), now()
  from org, client_b, u_rn returning id
),
-- Deliberately left without tasks: `plan_other` exists to be unreadable, not
-- to be worked from.
task_live as (
  insert into care_plan_tasks (care_plan_id, label, category, required)
  select plan_live.id, 'Bathing', 'personal', true from plan_live returning id
),
-- An incident Jamisha reported, classified and awaiting two notifications.
inc as (
  insert into incidents (
    organization_id, visit_id, client_person_id, reported_by_person_id, narrative,
    reported_at, kind, severity, state, classified_by_user_id, classified_at
  )
  select org.id, v_assigned.id, client_a.id, caregiver.id,
         'He stumbled getting out of the chair and sat back down hard.',
         now() - interval '5 hours', 'fall', 'significant', 'under_review',
         u_rn.id, now() - interval '1 hour'
  from org, v_assigned, client_a, caregiver, u_rn returning id
),
-- One somebody else reported, so "reads her own" means something.
inc_other as (
  insert into incidents (
    organization_id, client_person_id, reported_by_person_id, narrative, reported_at
  )
  select org.id, client_b.id, other_caregiver.id, 'A cup was broken.', now()
  from org, client_b, other_caregiver returning id
),
notif_rn as (
  insert into incident_notifications (incident_id, party, due_by)
  select inc.id, 'rn', now() - interval '4 hours' from inc returning id
),
notif_rp as (
  insert into incident_notifications (incident_id, party, due_by)
  select inc.id, 'responsible_party', now() + interval '1 hour' from inc returning id
),
sv as (
  insert into supervisory_visits (organization_id, client_person_id, scheduled_for, assigned_to_user_id)
  select org.id, client_a.id, current_date + 7, u_rn.id from org, client_a, u_rn returning id
)
select org.id as org_id, other_org.id as other_org_id,
       client_a.id as client_a, client_b.id as client_b,
       caregiver.id as caregiver, other_caregiver.id as other_caregiver, daughter.id as daughter,
       auth_rn.id as auth_rn, auth_sched.id as auth_sched, auth_cg.id as auth_cg,
       auth_lapsed.id as auth_lapsed,
       auth_other.id as auth_other, auth_dau.id as auth_dau,
       u_rn.id as u_rn, u_sched.id as u_sched, u_cg.id as u_cg, u_lapsed.id as u_lapsed,
       plan_live.id as plan_live, plan_draft.id as plan_draft, plan_other.id as plan_other,
       task_live.id as task_live, inc.id as inc, inc_other.id as inc_other,
       notif_rn.id as notif_rn, notif_rp.id as notif_rp, sv.id as sv
from org, other_org, client_a, client_b, caregiver, other_caregiver, daughter,
     auth_rn, auth_sched, auth_cg, auth_other, auth_dau, auth_lapsed,
     u_rn, u_sched, u_cg, u_other, u_dau, u_lapsed, g_cg, g_other, g_dau,
     v_assigned, plan_live, plan_draft, plan_other, task_live,
     inc, inc_other, notif_rn, notif_rp, sv;

-- Marcus's plan goes live now that its tasks are on it.
update care_plans
set state = 'active', effective_from = now() - interval '30 days'
where id = (select plan_live from care_fixture);

do $$
declare
  f record;
  visible int;
  new_id uuid;
begin
  select * into f from care_fixture;
  set local role authenticated;

  -- =========================================================== care plans --

  raise notice 'One active care plan per client';
  perform act_as(f.auth_rn);

  begin
    insert into care_plans (
      organization_id, client_person_id, version, supersedes_id, state, goals,
      authored_by_user_id, reviewed_by_user_id, reviewed_at, effective_from
    )
    values (f.org_id, f.client_a, 3, f.plan_live, 'active', array['x'],
            f.u_rn, f.u_rn, now(), now());
    perform assert(false, 'a second active plan for one client was refused');
  exception when unique_violation then
    perform assert(true, 'a second active plan for one client was refused');
  end;

  raise notice 'A plan cannot be followed before somebody signs it off';
  begin
    insert into care_plans (
      organization_id, client_person_id, version, state, goals,
      authored_by_user_id, effective_from
    )
    values (f.org_id, f.client_b, 1, 'active', array['x'], f.u_rn, now());
    perform assert(false, 'an unreviewed plan cannot be activated');
  exception when check_violation then
    perform assert(true, 'an unreviewed plan cannot be activated');
  end;

  raise notice 'Who may sign one off';
  begin
    update care_plans set reviewed_by_user_id = f.u_sched, reviewed_at = now()
    where id = f.plan_draft;
    perform assert(false, 'a scheduler cannot sign off a plan of care');
  exception when check_violation then
    perform assert(true, 'a scheduler cannot sign off a plan of care');
  end;

  update care_plans set reviewed_by_user_id = f.u_rn, reviewed_at = now()
  where id = f.plan_draft;
  perform assert(
    (select reviewed_by_user_id from care_plans where id = f.plan_draft) = f.u_rn,
    'an RN can'
  );

  raise notice 'A live plan is not edited, it is replaced';
  begin
    update care_plan_tasks set label = 'Something else' where id = f.task_live;
    perform assert(false, 'a task on a live plan cannot be edited');
  exception when check_violation then
    perform assert(true, 'a task on a live plan cannot be edited');
  end;

  begin
    delete from care_plan_tasks where id = f.task_live;
    perform assert(false, 'a task on a live plan cannot be deleted');
  exception when check_violation then
    perform assert(true, 'a task on a live plan cannot be deleted');
  end;

  -- Tasks on a draft are freely editable — that is what a draft is for.
  insert into care_plan_tasks (care_plan_id, label, category, required)
  values (f.plan_draft, 'Assist in transfer', 'activity', true);
  perform assert(
    (select count(*) from care_plan_tasks where care_plan_id = f.plan_draft) = 1,
    'a task can be added to a draft'
  );

  raise notice 'A revision replaces something; a first version does not';
  begin
    insert into care_plans (organization_id, client_person_id, version, state, goals, authored_by_user_id)
    values (f.org_id, f.client_b, 2, 'draft', array['x'], f.u_rn);
    perform assert(false, 'a version 2 with nothing to supersede was refused');
  exception when check_violation then
    perform assert(true, 'a version 2 with nothing to supersede was refused');
  end;

  -- --------------------------------------------- who reads a care plan --

  raise notice 'A caregiver reads the live plan for the client she is assigned to';
  perform act_as(f.auth_cg);

  select count(*) into visible from care_plans where id = f.plan_live;
  perform assert(visible = 1, 'she reads the plan she is working under');

  select count(*) into visible from care_plans where id = f.plan_draft;
  perform assert(visible = 0, 'she does not read a draft nobody has agreed to');

  select count(*) into visible from care_plans where id = f.plan_other;
  perform assert(visible = 0, 'she does not read the plan of a client she is not assigned to');

  select count(*) into visible from care_plan_tasks where id = f.task_live;
  perform assert(visible = 1, 'and she reads its tasks, which is her list for the visit');

  raise notice 'A caregiver with no assignment reads nothing';
  perform act_as(f.auth_other);
  select count(*) into visible from care_plans where id = f.plan_live;
  perform assert(visible = 0, 'a caregiver never assigned reads no plan');

  raise notice 'A family member reads their own relative''s live plan';
  perform act_as(f.auth_dau);
  select count(*) into visible from care_plans where id = f.plan_live;
  perform assert(visible = 1, 'the daughter reads Marcus''s live plan');
  select count(*) into visible from care_plans where id = f.plan_other;
  perform assert(visible = 0, 'and nobody else''s');

  raise notice 'A portal user cannot write a care plan';
  begin
    insert into care_plans (organization_id, client_person_id, version, state, goals, authored_by_user_id)
    values (f.org_id, f.client_a, 1, 'draft', array['x'], f.u_cg);
    perform assert(false, 'a caregiver cannot write a care plan');
  exception when insufficient_privilege then
    perform assert(true, 'a caregiver cannot write a care plan');
  end;

  -- ============================================================ incidents --

  raise notice 'The caregiver''s words are not the office''s to edit';
  perform act_as(f.auth_rn);
  begin
    update incidents set narrative = 'Tidied up for the file.' where id = f.inc;
    perform assert(false, 'the narrative cannot be rewritten');
  exception when check_violation then
    perform assert(true, 'the narrative cannot be rewritten');
  end;

  begin
    update incidents set reported_by_person_id = f.other_caregiver where id = f.inc;
    perform assert(false, 'nor can who reported it');
  exception when check_violation then
    perform assert(true, 'nor can who reported it');
  end;

  -- Findings are the office's to write, and that still works.
  update incidents set findings = 'Reviewed with the caregiver.' where id = f.inc;
  perform assert(true, 'findings can be recorded');

  raise notice 'An incident cannot be closed while somebody still has to be told';
  begin
    update incidents
    set state = 'closed', closed_by_user_id = f.u_rn, closed_at = now()
    where id = f.inc;
    perform assert(false, 'closing with two notifications outstanding was refused');
  exception when check_violation then
    perform assert(true, 'closing with two notifications outstanding was refused');
  end;

  update incident_notifications set done_at = now(), done_by_user_id = f.u_rn
  where incident_id = f.inc;

  raise notice 'And cannot be closed with nothing written down';
  begin
    update incidents
    set state = 'closed', findings = '   ', closed_by_user_id = f.u_rn, closed_at = now()
    where id = f.inc;
    perform assert(false, 'closing with empty findings was refused');
  exception when check_violation then
    perform assert(true, 'closing with empty findings was refused');
  end;

  update incidents
  set state = 'closed', findings = 'Reviewed with the caregiver. No change to the plan.',
      closed_by_user_id = f.u_rn, closed_at = now()
  where id = f.inc;
  perform assert(
    (select state from incidents where id = f.inc) = 'closed',
    'once everyone has been told and the findings are written, it closes'
  );

  raise notice 'A notification cannot be marked done anonymously';
  begin
    update incident_notifications set done_at = now(), done_by_user_id = null
    where id = f.notif_rn;
    perform assert(false, 'marking a notification done without a name was refused');
  exception when check_violation then
    perform assert(true, 'marking a notification done without a name was refused');
  end;

  raise notice 'Who reads an incident';
  perform act_as(f.auth_cg);
  select count(*) into visible from incidents where id = f.inc;
  perform assert(visible = 1, 'a caregiver reads the incident she reported');
  select count(*) into visible from incidents where id = f.inc_other;
  perform assert(visible = 0, 'and not one somebody else reported');
  select count(*) into visible from incident_notifications where incident_id = f.inc;
  perform assert(visible = 0, 'she does not read who the office had to notify');

  perform act_as(f.auth_dau);
  select count(*) into visible from incidents where id = f.inc;
  perform assert(
    visible = 0,
    'a family reads no incidents — they are told by a person, inside the notification window'
  );

  raise notice 'A caregiver may report one, and may not classify it';
  perform act_as(f.auth_cg);
  insert into incidents (organization_id, client_person_id, reported_by_person_id, narrative)
  values (f.org_id, f.client_a, f.caregiver, 'She refused her afternoon medication.')
  returning id into new_id;
  perform assert(new_id is not null, 'she can report an incident');

  begin
    update incidents set kind = 'medication_error' where id = new_id;
    -- An RLS update policy filters rather than raising, so this is asserted by
    -- the row being unchanged rather than by an exception.
    perform assert(
      (select kind from incidents where id = new_id) is null,
      'she cannot classify it — that is the office''s call'
    );
  end;

  begin
    insert into incidents (organization_id, client_person_id, reported_by_person_id, narrative)
    values (f.org_id, f.client_a, f.other_caregiver, 'Reported in somebody else''s name.');
    perform assert(false, 'she cannot file a report under another caregiver''s name');
  exception when insufficient_privilege then
    perform assert(true, 'she cannot file a report under another caregiver''s name');
  end;

  -- ================================================== supervisory visits --

  raise notice 'A supervisory visit is not recorded without findings';
  perform act_as(f.auth_rn);
  begin
    update supervisory_visits set completed_at = now(), completed_by_user_id = f.u_rn
    where id = f.sv;
    perform assert(false, 'completing with no findings was refused');
  exception when check_violation then
    perform assert(true, 'completing with no findings was refused');
  end;

  raise notice 'And not by somebody who does not carry them out';
  begin
    update supervisory_visits
    set completed_at = now(), completed_by_user_id = f.u_sched,
        findings = 'Looked fine.'
    where id = f.sv;
    perform assert(false, 'a scheduler cannot record a supervisory visit');
  exception when check_violation then
    perform assert(true, 'a scheduler cannot record a supervisory visit');
  end;

  update supervisory_visits
  set completed_at = now(), completed_by_user_id = f.u_rn,
      findings = 'Watched a transfer. Plan still fits.', care_plan_id = f.plan_live
  where id = f.sv;
  perform assert(
    (select findings from supervisory_visits where id = f.sv) is not null,
    'an RN can'
  );

  raise notice 'Nobody in a portal reads one';
  perform act_as(f.auth_cg);
  select count(*) into visible from supervisory_visits where id = f.sv;
  perform assert(visible = 0, 'the caregiver observed does not read the write-up');
  perform act_as(f.auth_dau);
  select count(*) into visible from supervisory_visits where id = f.sv;
  perform assert(visible = 0, 'nor does the family');

  -- ================================ Karynn's rules, 21 August (0011) ==== --

  raise notice 'The office is told about every incident, from the report itself';
  perform act_as(f.auth_cg);
  insert into incidents (organization_id, client_person_id, reported_by_person_id, narrative)
  values (f.org_id, f.client_a, f.caregiver, 'She would not get out of bed this morning.')
  returning id into new_id;

  perform act_as(f.auth_rn);
  select count(*) into visible
  from incident_notifications
  where incident_id = new_id and party = 'administrator';
  perform assert(
    visible = 1,
    'a caregiver reporting an incident creates the office notification she could not write herself'
  );

  raise notice 'A registered nurse, not a job title';
  begin
    -- Nadia is `rn_clinical` and her licence lapsed last month. A role check
    -- cannot see the difference; this is the whole reason 0011 exists.
    update supervisory_visits
    set completed_at = now(), completed_by_user_id = f.u_lapsed, findings = 'Looked in.'
    where id = f.sv;
    perform assert(false, 'a nurse with a lapsed licence cannot record a supervisory visit');
  exception when check_violation then
    perform assert(true, 'a nurse with a lapsed licence cannot record a supervisory visit');
  end;

  perform assert(user_is_rn(f.u_rn), 'Karynn holds a current licence');
  perform assert(not user_is_rn(f.u_lapsed), 'Nadia does not, despite the title');
  perform assert(not user_is_rn(f.u_sched), 'and a scheduler never did');

  raise notice 'A licence is a number, a state and an expiry, or it is nothing';
  -- Checked as the owner, deliberately. This is a CHECK constraint, not a
  -- policy: it applies to everybody, and running it under `authenticated` would
  -- have proved nothing — the users update policy filters the row out, the
  -- statement matches nothing, and the absence of an exception reads as a pass.
  -- That trap has already cost this repository one wrong assertion.
  execute 'set local role postgres';
  begin
    update users set rn_licence_number = 'RN-9' where id = f.u_sched;
    perform assert(false, 'a licence number with no expiry was refused');
  exception when check_violation then
    perform assert(true, 'a licence number with no expiry was refused');
  end;
  execute 'set local role authenticated';

  raise notice 'An RN visit, which is not the same as ringing an RN';
  update incidents
  set kind = 'fall', severity = 'significant', state = 'under_review',
      classified_by_user_id = f.u_rn, classified_at = now(),
      rn_visit_due_by = now() + interval '18 hours'
  where id = new_id;

  begin
    update incidents set rn_visit_done_at = now(), rn_visit_by_user_id = f.u_lapsed,
                         rn_visit_findings = 'Seen.'
    where id = new_id;
    perform assert(false, 'a lapsed nurse cannot record the visit either');
  exception when check_violation then
    perform assert(true, 'a lapsed nurse cannot record the visit either');
  end;

  begin
    update incidents set rn_visit_done_at = now(), rn_visit_by_user_id = f.u_rn,
                         rn_visit_findings = '   '
    where id = new_id;
    perform assert(false, 'a visit with no findings was refused');
  exception when check_violation then
    perform assert(true, 'a visit with no findings was refused');
  end;

  update incident_notifications set done_at = now(), done_by_user_id = f.u_rn
  where incident_id = new_id;

  begin
    update incidents
    set state = 'closed', findings = 'Reviewed.', closed_by_user_id = f.u_rn, closed_at = now()
    where id = new_id;
    perform assert(false, 'closing while a nurse still has to see the client was refused');
  exception when check_violation then
    perform assert(true, 'closing while a nurse still has to see the client was refused');
  end;

  update incidents set rn_visit_done_at = now(), rn_visit_by_user_id = f.u_rn,
                       rn_visit_findings = 'Seen at home. Walking normally.'
  where id = new_id;

  update incidents
  set state = 'closed', findings = 'Reviewed.', closed_by_user_id = f.u_rn, closed_at = now()
  where id = new_id;
  perform assert(
    (select state from incidents where id = new_id) = 'closed',
    'and it closes once she has been'
  );

  raise notice 'The yearly register is the incidents, not a copy of them';
  select count(*) into visible
  from annual_incident_log
  where id = new_id and year = extract(year from now())::int;
  perform assert(visible = 1, 'the incident appears in the register for the year it was reported');

  perform assert(
    (select rn_visit_required from annual_incident_log where id = new_id),
    'the register records that a visit was required'
  );

  raise notice 'And the register obeys the same row level security the table does';
  perform act_as(f.auth_dau);
  select count(*) into visible from annual_incident_log where id = new_id;
  perform assert(
    visible = 0,
    'a family reads no incidents through the view either — security_invoker, not a way around RLS'
  );

  raise notice 'ALL CARE PLAN, INCIDENT AND SUPERVISION ASSERTIONS PASSED';
end;
$$;
