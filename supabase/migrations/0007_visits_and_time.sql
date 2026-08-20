-- Joy Health — the schedule, and the clock that runs against it
--
-- WHY THIS EXISTS NOW
--
-- Two things were waiting on it.
--
-- 0006 could not express the rule that matters most for a caregiver's portal:
-- she should read the clients she is assigned to, and nobody else. There was no
-- table to hang "assigned" on, so portal employees were given their own record
-- only and `portal_may_read_person` carried the branch commented out. This
-- migration writes that branch.
--
-- And scheduling has been TypeScript over seed data since it was built. The
-- domain logic is real — conflicts, overtime, assignment ranking, the
-- caregiver's schedule and the family's view all compute from one `Visit` shape
-- — but nothing persisted it. §9 says the employee portal and the admin board
-- use the same official schedule; that is only true if there is one.
--
-- SHAPES FOLLOW THE DOMAIN
--
-- The columns here mirror src/domain/scheduling/conflicts.ts and
-- src/domain/portal/visit.ts deliberately. Where the two disagree the domain is
-- the specification: the code has tests and the table does not.

-- ---------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------

create type visit_status as enum (
  'scheduled',
  'cancelled',
  'completed',
  -- Nobody clocked in and the window has passed. Set by the office or a job,
  -- never inferred at read time — see the note on time entries.
  'missed'
);

create table visits (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,

  client_person_id      uuid not null references people (id) on delete restrict,
  -- Null is an open shift: scheduled, not yet staffed. §24 keeps that fact off
  -- the family's screen; the column simply records it.
  caregiver_person_id   uuid references people (id) on delete set null,

  service               care_service not null default 'personal_care',
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  status                visit_status not null default 'scheduled',

  -- Why a visit was cancelled, for the office. Never shown to a family.
  cancellation_reason   text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint visits_end_after_start check (ends_at > starts_at),
  -- A visit longer than 24 hours is a data entry error, not a live-in shift —
  -- live-in is scheduled as consecutive days. Catching it here stops one
  -- fat-fingered year from making somebody's overtime calculation absurd.
  constraint visits_reasonable_length check (ends_at - starts_at <= interval '24 hours')
);

create index visits_caregiver_idx on visits (caregiver_person_id, starts_at desc)
  where caregiver_person_id is not null;
create index visits_client_idx on visits (client_person_id, starts_at desc);
create index visits_org_window_idx on visits (organization_id, starts_at);
-- Open shifts are a work queue. Partial index because they are the minority
-- and the query that wants them wants only them.
create index visits_open_idx on visits (organization_id, starts_at)
  where caregiver_person_id is null and status = 'scheduled';

comment on table visits is
  'The official Joy schedule. The admin board, the employee portal and the family portal all read this — §9 forbids a second one.';

-- ---------------------------------------------------------------------------
-- Time entries
-- ---------------------------------------------------------------------------

-- §10: "The server should remain authoritative for official timestamps."
--
-- So these columns are written with the server's clock and never with a value
-- the browser supplied. `clocked_in_at` defaults to now() for exactly that
-- reason: the honest way to record when somebody clocked in is to record when
-- the request arrived, and a default makes the wrong thing harder to do than
-- the right one.
create table visit_time_entries (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,

  visit_id            uuid not null references visits (id) on delete cascade,
  caregiver_person_id uuid not null references people (id) on delete restrict,

  clocked_in_at       timestamptz not null default now(),
  clocked_out_at      timestamptz,

  -- §11. Set when somebody ended a shift with documentation outstanding, with
  -- what was outstanding. Karynn ruled on 20 Aug that this must be possible:
  -- refusing either keeps a caregiver on paid time she is not working, or
  -- pushes her to write something untrue to get past the check.
  exception_reason    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint visit_time_entries_out_after_in check (
    clocked_out_at is null or clocked_out_at > clocked_in_at
  )
);

-- One live entry per visit. A second clock-in on a visit already running is a
-- bug, and the partial unique index makes it impossible rather than unlikely.
create unique index visit_time_entries_one_open
  on visit_time_entries (visit_id) where clocked_out_at is null;

create index visit_time_entries_caregiver_idx
  on visit_time_entries (caregiver_person_id, clocked_in_at desc);

comment on column visit_time_entries.exception_reason is
  'Non-null when clock-out happened with required documentation incomplete. The office chases one exception report rather than finding the gap at audit.';

-- Hours worked, computed rather than stored.
--
-- A stored duration is a number that can disagree with the two timestamps it
-- came from, and the first time somebody corrects a clock-out by hand it will.
create or replace function visit_hours(entry visit_time_entries)
returns numeric
language sql
immutable
as $$
  select case
    when entry.clocked_out_at is null then 0
    else round(extract(epoch from (entry.clocked_out_at - entry.clocked_in_at)) / 3600.0, 2)
  end;
$$;

-- ---------------------------------------------------------------------------
-- The branch 0006 left waiting
-- ---------------------------------------------------------------------------

-- A caregiver reads the clients she is assigned to, and that access lapses.
--
-- The window is the part worth arguing about. Access that followed assignment
-- forever would mean a caregiver who covered one shift in March could still
-- read that client's record in September, which is not a relationship anybody
-- consented to. Thirty days past the last visit is long enough to finish
-- charting and answer a question about a visit, and short enough that it ends.
--
-- Forward-looking access is deliberately wider: she can see a client she is
-- scheduled to visit next week, because she needs to prepare.
create or replace function portal_may_read_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    -- Always yourself.
    target = current_person_id()
    -- A family grant reaches the person whose care it concerns, and nobody else.
    or exists (
      select 1 from portal_grants g
      where g.person_id = current_person_id()
        and g.active
        and g.audience = 'family'
        and g.subject_person_id = target
    )
    -- A workforce grant reaches the clients she is actually assigned to.
    or exists (
      select 1
      from visits v
      join portal_grants g
        on g.person_id = v.caregiver_person_id
       and g.active
       and g.audience = 'workforce'
      where v.caregiver_person_id = current_person_id()
        and v.client_person_id = target
        and v.status <> 'cancelled'
        and v.starts_at > now() - interval '30 days'
    );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table visits             enable row level security;
alter table visit_time_entries enable row level security;

grant select on visits, visit_time_entries to authenticated;
grant insert, update, delete on visits to authenticated;
grant insert, update on visit_time_entries to authenticated;

-- Staff who schedule see the whole board. A caregiver sees her own visits. A
-- family sees the visits of the person they are responsible for.
--
-- Note what a caregiver does NOT get: other people's visits, including the open
-- shifts. Offering open shifts to caregivers is a real feature §9 gestures at,
-- and it is a deliberate decision rather than a side effect of a loose policy.
create policy visits_read on visits
  for select using (
    organization_id = current_org_id()
    and (
      is_staff()
      or caregiver_person_id = current_person_id()
      or exists (
        select 1 from portal_grants g
        where g.person_id = current_person_id()
          and g.active
          and g.audience = 'family'
          and g.subject_person_id = visits.client_person_id
      )
    )
  );

-- The schedule is the office's to write. A caregiver cannot give herself a
-- visit, and a family cannot move one.
create policy visits_write on visits
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'scheduler', 'rn_clinical')
  ) with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'scheduler', 'rn_clinical')
  );

-- A caregiver reads her own time entries; payroll and the owner read all of
-- them. A family reads none — when somebody clocked in is employment data, not
-- care information, and §24 keeps internal detail off the family's screen.
create policy visit_time_entries_read on visit_time_entries
  for select using (
    organization_id = current_org_id()
    and (
      has_role('ceo_admin', 'payroll', 'scheduler', 'rn_clinical', 'hr')
      or caregiver_person_id = current_person_id()
    )
  );

-- A caregiver clocks herself in and out, and only on a visit that is hers.
-- The with check clause is what stops her writing an entry against somebody
-- else's visit or somebody else's name.
create policy visit_time_entries_insert on visit_time_entries
  for insert with check (
    organization_id = current_org_id()
    and caregiver_person_id = current_person_id()
    and exists (
      select 1 from visits v
      where v.id = visit_time_entries.visit_id
        and v.caregiver_person_id = current_person_id()
        and v.organization_id = current_org_id()
    )
  );

create policy visit_time_entries_update on visit_time_entries
  for update using (
    organization_id = current_org_id()
    and (
      -- Payroll and the owner correct entries; that is what a correction is.
      has_role('ceo_admin', 'payroll')
      or caregiver_person_id = current_person_id()
    )
  ) with check (
    organization_id = current_org_id()
    and (has_role('ceo_admin', 'payroll') or caregiver_person_id = current_person_id())
  );

create trigger visits_set_updated_at before update on visits
  for each row execute function set_updated_at();

create trigger visit_time_entries_set_updated_at before update on visit_time_entries
  for each row execute function set_updated_at();
