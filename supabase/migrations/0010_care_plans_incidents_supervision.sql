-- Joy Health — the care plan, incidents, and the supervision that reviews both
--
-- WHY THIS EXISTS NOW
--
-- Three domains landed in TypeScript with nothing underneath them. Each is the
-- kind of record a surveyor asks for by name, and each has a rule that the
-- application enforces today and the database did not:
--
--   - a client may have exactly one active care plan
--   - an incident cannot be closed while somebody still has to be told
--   - the caregiver's words in an incident report are not the office's to edit
--
-- An invariant that lives only in a React page holds until the first script,
-- the first Edge Function, or the first developer with psql open. These are the
-- ones worth spending a constraint on.
--
-- SHAPES FOLLOW THE DOMAIN, as in 0007. Where a column and
-- src/domain/carePlan/plan.ts disagree, the TypeScript is the specification:
-- it has tests and the table does not.

-- ---------------------------------------------------------------------------
-- Care plans
-- ---------------------------------------------------------------------------

create type care_plan_state as enum ('draft', 'in_review', 'active', 'superseded');

create type care_task_category as enum ('personal', 'elimination', 'activity', 'household');

create table care_plans (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations (id) on delete cascade,
  client_person_id     uuid not null references people (id) on delete restrict,

  version              integer not null default 1,
  -- The plan this one replaces. Null only on a first version.
  supersedes_id        uuid references care_plans (id) on delete restrict,
  state                care_plan_state not null default 'draft',

  -- What the care is for. From the assessment's `goals` answer.
  goals                text[] not null default '{}',
  -- When the caregiver calls the RN. `[{key,label,value}]`, from the packet's
  -- parameters with the RN's changes applied. Empty means nobody was asked —
  -- which is deliberately different from "the RN accepted the defaults".
  vitals               jsonb not null default '[]'::jsonb,
  equipment            text[] not null default '{}',
  supplies             text[] not null default '{}',
  emergency_plan       text,
  services             text[] not null default '{}',

  authored_by_user_id  uuid not null references users (id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Set when it goes live. Nothing before this date was charted against it.
  effective_from       timestamptz,
  -- Set when it is retired, so a chart can be read against the plan of its day.
  effective_until      timestamptz,

  reviewed_by_user_id  uuid references users (id) on delete restrict,
  reviewed_at          timestamptz,

  constraint care_plans_version_positive check (version >= 1),
  -- A second version replaces something. A first version replaces nothing.
  constraint care_plans_revision_supersedes check (
    (version = 1 and supersedes_id is null) or (version > 1 and supersedes_id is not null)
  ),
  -- Reviewed by somebody, at some time, or neither. A review with no name on it
  -- answers nothing when the plan is later questioned.
  constraint care_plans_review_is_attributed check (
    (reviewed_by_user_id is null) = (reviewed_at is null)
  ),
  -- `canActivate` in the domain: a plan cannot be followed until an RN or the
  -- owner has signed it off. Stated here too because the application is not the
  -- only thing that will ever write this table.
  constraint care_plans_live_was_reviewed check (
    state not in ('active', 'superseded') or (reviewed_at is not null and effective_from is not null)
  ),
  constraint care_plans_retired_has_end check (
    (state = 'superseded') = (effective_until is not null)
  ),
  constraint care_plans_end_after_start check (
    effective_until is null or effective_from is null or effective_until >= effective_from
  )
);

-- THE CONSTRAINT THIS MIGRATION IS REALLY FOR.
--
-- One active plan per client. `replacePlan` retires the old version and
-- activates the new one in a single function precisely so this cannot break,
-- and that guarantee should not depend on everybody remembering to call it. Two
-- active plans means a caregiver's phone follows whichever one loaded first.
create unique index care_plans_one_active_per_client
  on care_plans (client_person_id)
  where state = 'active';

create index care_plans_client_idx on care_plans (client_person_id, version desc);
create index care_plans_org_state_idx on care_plans (organization_id, state);
-- The review queue: live plans, oldest review first.
create index care_plans_review_due_idx on care_plans (organization_id, reviewed_at)
  where state = 'active';

comment on table care_plans is
  'What Joy agreed to do for a client. Versioned, never edited: a visit charted last month must still read against the plan that was in effect that day.';

create table care_plan_tasks (
  id            uuid primary key default gen_random_uuid(),
  care_plan_id  uuid not null references care_plans (id) on delete cascade,

  label         text not null,
  category      care_task_category not null,
  -- §11 checks required tasks before clock-out. A property of the task on this
  -- plan, not of the category: the RN may decide a particular client's walk
  -- matters more than her laundry.
  required      boolean not null default false,
  sort_order    integer not null default 0,

  constraint care_plan_tasks_label_present check (length(btrim(label)) > 0)
);

create index care_plan_tasks_plan_idx on care_plan_tasks (care_plan_id, sort_order);
create unique index care_plan_tasks_no_duplicates on care_plan_tasks (care_plan_id, label);

-- A live plan's contents are fixed.
--
-- The same reasoning as the confirmed-chart trigger in 0008, applied one level
-- up. Visits have been charted against these tasks; editing them rewrites what
-- the caregiver was asked to do last Tuesday, and a task deleted today vanishes
-- from a record a family or a surveyor may later read. A change makes a new
-- version — that is what `revisePlan` is for.
create or replace function refuse_live_plan_task_edit()
returns trigger
language plpgsql
as $$
declare
  plan_state care_plan_state;
begin
  select state into plan_state
  from care_plans
  where id = coalesce(new.care_plan_id, old.care_plan_id);

  if plan_state in ('active', 'superseded') then
    raise exception
      'This care plan is live. Make a new version instead of editing the one visits have been charted against.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger care_plan_tasks_no_edit_when_live
  before insert or update or delete on care_plan_tasks
  for each row execute function refuse_live_plan_task_edit();

-- Who may sign a plan off.
--
-- The same rule as the consent witness: an RN or the owner, nobody else. A
-- scheduler approving a plan of care is not a paperwork shortcut, it is a
-- clinical decision taken by somebody not qualified to take it.
create or replace function care_plan_reviewer_is_clinical()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reviewer_role user_role;
begin
  if new.reviewed_by_user_id is null then
    return new;
  end if;

  select role into reviewer_role from users where id = new.reviewed_by_user_id;

  if reviewer_role not in ('rn_clinical', 'ceo_admin') then
    raise exception
      'A care plan is signed off by an RN or the owner. % may not.', reviewer_role
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger care_plans_reviewer_is_clinical
  before insert or update on care_plans
  for each row execute function care_plan_reviewer_is_clinical();

create trigger care_plans_set_updated_at before update on care_plans
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------

create type incident_kind as enum (
  'fall',
  'injury',
  'medication_error',
  'behaviour',
  'property_damage',
  'missing_client',
  'abuse_allegation',
  'death',
  'other'
);

create type incident_severity as enum ('minor', 'significant', 'serious');

create type incident_state as enum (
  -- A caregiver reported it at clock-out. Nobody has looked yet.
  'reported',
  'under_review',
  'closed'
);

create type notify_party as enum (
  'administrator',
  'rn',
  'physician',
  'responsible_party',
  'state_agency',
  'law_enforcement'
);

create table incidents (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references organizations (id) on delete cascade,

  visit_id                uuid references visits (id) on delete set null,
  client_person_id        uuid not null references people (id) on delete restrict,
  reported_by_person_id   uuid not null references people (id) on delete restrict,

  -- Her words, unchanged. See the trigger below.
  narrative               text not null,
  -- Every deadline in this table runs from here, not from classification.
  reported_at             timestamptz not null default now(),

  kind                    incident_kind,
  severity                incident_severity,
  state                   incident_state not null default 'reported',

  classified_by_user_id   uuid references users (id) on delete restrict,
  classified_at           timestamptz,

  findings                text,
  -- Optional on purpose: some incidents genuinely need nothing changed.
  action                  text,
  closed_by_user_id       uuid references users (id) on delete restrict,
  closed_at               timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint incidents_narrative_present check (length(btrim(narrative)) > 0),
  -- Classified means all of it: what kind, how serious, by whom, when.
  constraint incidents_classification_complete check (
    state = 'reported'
    or (kind is not null and severity is not null
        and classified_by_user_id is not null and classified_at is not null)
  ),
  -- A closed incident with no findings is a gap in the file that reads as
  -- though nothing happened. `closeRefusals` says the same thing in TypeScript.
  constraint incidents_closed_has_findings check (
    state <> 'closed'
    or (length(btrim(coalesce(findings, ''))) > 0
        and closed_by_user_id is not null and closed_at is not null)
  )
);

create index incidents_org_open_idx on incidents (organization_id, reported_at desc)
  where state <> 'closed';
create index incidents_client_idx on incidents (client_person_id, reported_at desc);
create index incidents_reporter_idx on incidents (reported_by_person_id, reported_at desc);

comment on table incidents is
  'Everything a caregiver reported at clock-out. Notification deadlines run from reported_at, never from classification — otherwise the office is always on time by being slow.';

-- The office classifies. It does not rewrite.
--
-- If an incident is ever questioned, "what did she actually say" has to have an
-- answer, and it has to be hers. Findings, actions and classification are the
-- office's to write; the narrative and who reported it are not.
create or replace function refuse_incident_narrative_edit()
returns trigger
language plpgsql
as $$
begin
  if new.narrative is distinct from old.narrative
     or new.reported_by_person_id is distinct from old.reported_by_person_id
     or new.reported_at is distinct from old.reported_at then
    raise exception
      'The caregiver''s report is not the office''s to edit. Record findings instead.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger incidents_narrative_is_hers
  before update on incidents
  for each row execute function refuse_incident_narrative_edit();

create trigger incidents_set_updated_at before update on incidents
  for each row execute function set_updated_at();

create table incident_notifications (
  id               uuid primary key default gen_random_uuid(),
  incident_id      uuid not null references incidents (id) on delete cascade,

  party            notify_party not null,
  -- Computed from reported_at and the policy in
  -- src/domain/incidents/incidents.ts. See the note at the end of this file:
  -- the windows are Joy's own policy and need confirming against the current
  -- Texas requirements for its licence category.
  due_by           timestamptz not null,

  done_at          timestamptz,
  done_by_user_id  uuid references users (id) on delete restrict,
  note             text,

  constraint incident_notifications_done_is_attributed check (
    (done_at is null) = (done_by_user_id is null)
  )
);

create unique index incident_notifications_one_per_party
  on incident_notifications (incident_id, party);
create index incident_notifications_pending_idx on incident_notifications (due_by)
  where done_at is null;

-- An incident cannot be closed while somebody still has to be told.
--
-- A row-level check cannot see another table, so this is a trigger. It is the
-- rule with a clock belonging to somebody outside the office, which makes it
-- the one most worth enforcing below the application.
create or replace function refuse_close_with_pending_notifications()
returns trigger
language plpgsql
as $$
declare
  pending integer;
begin
  if new.state = 'closed' and old.state is distinct from 'closed' then
    select count(*) into pending
    from incident_notifications
    where incident_id = new.id and done_at is null;

    if pending > 0 then
      raise exception
        'Somebody still has to be told about this incident (% outstanding). Record that first.', pending
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger incidents_no_close_with_pending
  before update on incidents
  for each row execute function refuse_close_with_pending_notifications();

-- ---------------------------------------------------------------------------
-- Supervisory visits
-- ---------------------------------------------------------------------------

create table supervisory_visits (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations (id) on delete cascade,
  client_person_id       uuid not null references people (id) on delete restrict,

  scheduled_for          date,
  assigned_to_user_id    uuid references users (id) on delete restrict,

  completed_at           timestamptz,
  completed_by_user_id   uuid references users (id) on delete restrict,
  -- What the RN saw. Required to complete: a supervisory visit with no findings
  -- is a date in a file and nothing else.
  findings               text,

  -- The plan reviewed on the same trip, if one was. The RN goes out, watches
  -- the care and comes back with a view on whether the plan still fits;
  -- recording those separately means doing one and forgetting the other.
  care_plan_id           uuid references care_plans (id) on delete restrict,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint supervisory_visits_completion_is_complete check (
    completed_at is null
    or (completed_by_user_id is not null and length(btrim(coalesce(findings, ''))) > 0)
  ),
  constraint supervisory_visits_findings_only_when_done check (
    completed_at is not null or findings is null
  )
);

create index supervisory_visits_client_idx
  on supervisory_visits (client_person_id, completed_at desc nulls first);
create index supervisory_visits_booked_idx on supervisory_visits (organization_id, scheduled_for)
  where completed_at is null;

comment on table supervisory_visits is
  'The annual supervision the service agreement commits to. The client record has counted this obligation down since the compliance engine was written; without this table there was nothing to measure from but start of care, so the clock never reset.';

-- A supervisory visit is recorded by an RN or the owner, same rule as a care
-- plan review and a consent signature.
create or replace function supervisory_visit_completer_is_clinical()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  completer_role user_role;
begin
  if new.completed_by_user_id is null then
    return new;
  end if;

  select role into completer_role from users where id = new.completed_by_user_id;

  if completer_role not in ('rn_clinical', 'ceo_admin') then
    raise exception
      'A supervisory visit is carried out by an RN or the owner. % may not record one.', completer_role
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger supervisory_visits_completer_is_clinical
  before insert or update on supervisory_visits
  for each row execute function supervisory_visit_completer_is_clinical();

create trigger supervisory_visits_set_updated_at before update on supervisory_visits
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table care_plans             enable row level security;
alter table care_plan_tasks        enable row level security;
alter table incidents              enable row level security;
alter table incident_notifications enable row level security;
alter table supervisory_visits     enable row level security;

grant select on care_plans, care_plan_tasks, incidents, incident_notifications,
                supervisory_visits to authenticated;
grant insert, update on care_plans, incidents, incident_notifications,
                        supervisory_visits to authenticated;
grant insert, update, delete on care_plan_tasks to authenticated;

-- --------------------------------------------------------------- plans --

-- Staff read every plan. A portal user reads the LIVE plan for a person they
-- may already read, which is exactly two people: a caregiver reading the client
-- she is assigned to, and a family member reading their own relative.
--
-- Only the active one. A superseded plan describes care that already happened
-- and a draft describes care nobody has agreed to yet; showing either to a
-- caregiver is how she follows the wrong list.
create policy care_plans_read on care_plans
  for select using (
    organization_id = current_org_id()
    and (is_staff() or (state = 'active' and portal_may_read_person(client_person_id)))
  );

create policy care_plans_write on care_plans
  for insert with check (organization_id = current_org_id() and is_staff());

create policy care_plans_update on care_plans
  for update using (organization_id = current_org_id() and is_staff())
  with check (organization_id = current_org_id() and is_staff());

create policy care_plan_tasks_read on care_plan_tasks
  for select using (
    exists (select 1 from care_plans p where p.id = care_plan_id)
  );

create policy care_plan_tasks_write on care_plan_tasks
  for insert with check (
    exists (
      select 1 from care_plans p
      where p.id = care_plan_id and p.organization_id = current_org_id()
    )
    and is_staff()
  );

create policy care_plan_tasks_update on care_plan_tasks
  for update using (
    exists (
      select 1 from care_plans p
      where p.id = care_plan_id and p.organization_id = current_org_id()
    )
    and is_staff()
  );

create policy care_plan_tasks_delete on care_plan_tasks
  for delete using (
    exists (
      select 1 from care_plans p
      where p.id = care_plan_id and p.organization_id = current_org_id()
    )
    and is_staff()
  );

-- ----------------------------------------------------------- incidents --

-- Staff read every incident. A caregiver reads the ones she reported, so she
-- can see that something was done with what she raised — a report that
-- disappears is a report people stop making.
--
-- A FAMILY READS NONE. That is not an oversight and it is not secrecy: §24
-- keeps internal records off the family portal, and a family finds out about an
-- incident because a person rings them inside the notification window, which is
-- what `incident_notifications` exists to make sure happens. A daughter reading
-- "medication error, significant" on a phone at eleven at night, with nobody to
-- ask, is a worse way to be told.
create policy incidents_read on incidents
  for select using (
    organization_id = current_org_id()
    and (is_staff() or reported_by_person_id = current_person_id())
  );

-- A caregiver reports one; the office classifies and closes it.
create policy incidents_report on incidents
  for insert with check (
    organization_id = current_org_id()
    and (is_staff() or reported_by_person_id = current_person_id())
  );

create policy incidents_office_update on incidents
  for update using (organization_id = current_org_id() and is_staff())
  with check (organization_id = current_org_id() and is_staff());

create policy incident_notifications_read on incident_notifications
  for select using (
    exists (
      select 1 from incidents i
      where i.id = incident_id and i.organization_id = current_org_id() and is_staff()
    )
  );

create policy incident_notifications_write on incident_notifications
  for insert with check (
    exists (
      select 1 from incidents i
      where i.id = incident_id and i.organization_id = current_org_id()
    )
    and is_staff()
  );

create policy incident_notifications_update on incident_notifications
  for update using (
    exists (
      select 1 from incidents i
      where i.id = incident_id and i.organization_id = current_org_id()
    )
    and is_staff()
  );

-- -------------------------------------------------------- supervision --

-- Staff only, and no portal access at all.
--
-- A supervisory visit records how a named caregiver performed in somebody's
-- home. It is a personnel record as much as a clinical one, and neither the
-- caregiver being observed nor the client's family is the audience for it.
create policy supervisory_visits_read on supervisory_visits
  for select using (organization_id = current_org_id() and is_staff());

create policy supervisory_visits_write on supervisory_visits
  for insert with check (organization_id = current_org_id() and is_staff());

create policy supervisory_visits_update on supervisory_visits
  for update using (organization_id = current_org_id() and is_staff())
  with check (organization_id = current_org_id() and is_staff());

-- ---------------------------------------------------------------------------
-- One thing this migration does not decide
-- ---------------------------------------------------------------------------

-- `incident_notifications.due_by` is written by the application from
-- NOTIFICATION_POLICY. Those windows are Joy's own policy and have not been
-- checked against the current Texas requirements for Joy's licence category.
-- They are not encoded here for exactly that reason: a check constraint
-- asserting "the RN within one hour" would make a starting point look like a
-- citation, and would then have to be migrated when the real number arrives.
-- The table records the deadline and whether it was met, which is true whatever
-- the policy turns out to be.
