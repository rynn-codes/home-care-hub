-- Joy Health — portal identities, and the boundary that keeps them narrow
--
-- WHY THIS MIGRATION EXISTS
--
-- Two roles have been in `user_role` since 0001 — `employee` and
-- `client_contact` — and until now nothing distinguished them from staff. The
-- read policies in 0003 say "same organization", and that is all they say. So a
-- caregiver given a portal login would pass every one of them.
--
-- That is not theoretical. Probed against this schema before writing a line of
-- this file: a user with role `employee` and an active session read all three
-- `people` rows and both `client_profiles`, returning every client's full name.
-- The portal's React guard would not have mattered; anyone holding the anon key
-- can call PostgREST directly, which is the entire reason 0003 exists.
--
-- So this migration does three things:
--
--   1. links a login to a person, which the portal needs and 0001 lacked;
--   2. records portal grants and the basis of each portal read;
--   3. narrows every broad read policy so portal roles no longer inherit staff
--      visibility, and grants them back exactly what they need.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- A caregiver should be able to read the clients she is assigned to, and that
-- predicate cannot be written yet: Joy has no `visits` table. Scheduling lives
-- in TypeScript against seed data, which is a real gap and a separate piece of
-- work. Rather than guess at a shape, this migration gives portal employees
-- access to their own record only, and the assignment predicate is left as a
-- named hole — `portal_may_read_person` has the branch commented and waiting.
--
-- The safe direction to be wrong in is the restrictive one. A caregiver who
-- cannot yet see her client through PostgREST is a feature that does not work.
-- A caregiver who can see every client is a breach.

-- ---------------------------------------------------------------------------
-- A login belongs to a person
-- ---------------------------------------------------------------------------

-- 0001 modelled users and people as separate things, which is right — most Joy
-- users are staff who are not clients. But a portal user IS a person: the whole
-- premise of §2 and §19 is that the candidate you interviewed and the caregiver
-- you schedule are one row. Without this column there is no way to ask "whose
-- record is this" about the person asking.
alter table users add column if not exists person_id uuid references people (id) on delete set null;

create unique index if not exists users_person_id_unique
  on users (person_id) where person_id is not null;

comment on column users.person_id is
  'The person this login belongs to. Required for portal roles; null for staff logins that are not themselves a person in the system.';

-- ---------------------------------------------------------------------------
-- Who is staff
-- ---------------------------------------------------------------------------

-- The distinction 0003 never needed to draw. Every role except the two portal
-- ones is somebody working at Joy; those two are somebody Joy works with.
--
-- Written as a positive list rather than "not employee, not client_contact" on
-- purpose: a role added to the enum later is not staff until somebody says so.
-- The failure mode of the negative form is that a new role silently inherits
-- everything.
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select current_user_role() in (
    'ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler',
    'payroll', 'billing', 'hr'
  );
$$;

create or replace function current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select person_id from current_app_user();
$$;

-- ---------------------------------------------------------------------------
-- Portal grants
-- ---------------------------------------------------------------------------

create type portal_audience as enum ('workforce', 'family');

create table portal_grants (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,

  audience          portal_audience not null,
  -- Whose portal this is.
  person_id         uuid not null references people (id) on delete cascade,
  -- Whose care it concerns. Null for a workforce grant; required for family.
  subject_person_id uuid references people (id) on delete cascade,

  -- Mirrors the states in src/domain/portal/identity.ts. Text rather than an
  -- enum because the workforce and family vocabularies differ and a single
  -- enum spanning both would let a family grant claim to be 'onboarding'.
  state             text not null,

  active            boolean not null default true,
  revoked_reason    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint portal_grants_family_has_subject check (
    (audience = 'family' and subject_person_id is not null)
    or (audience = 'workforce' and subject_person_id is null)
  ),

  -- One grant per person per subject. Somebody may hold a workforce grant and
  -- a family grant; they may not hold two of the same.
  constraint portal_grants_unique unique (person_id, audience, subject_person_id)
);

create index portal_grants_person_idx on portal_grants (person_id) where active;
create index portal_grants_subject_idx on portal_grants (subject_person_id) where active;

comment on table portal_grants is
  'One person''s right to one portal. See src/domain/portal/identity.ts — the shapes are deliberately the same.';

-- ---------------------------------------------------------------------------
-- The basis of a portal read
-- ---------------------------------------------------------------------------

-- src/domain/portal/mode.ts explains the reasoning at length. In short: the
-- same read is a staff access justified by assignment, or a family access
-- justified by the client's authorization, and Joy has to be able to say which.
-- 'dual' is recorded when both hold, which is the paid-family-caregiver case
-- Karynn expects to reach later.
create type portal_access_basis as enum (
  'staff_assignment', 'family_authorization', 'dual', 'none'
);

create table portal_access_log (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations (id) on delete cascade,

  person_id                uuid not null references people (id) on delete cascade,
  record_subject_person_id uuid not null references people (id) on delete cascade,

  -- Which hat they believed they were wearing.
  mode                     portal_audience not null,
  -- What Joy could actually justify. Kept separate from mode on purpose: when
  -- they disagree, the pair says more than either would alone.
  basis                    portal_access_basis not null,

  at                       timestamptz not null default now()
);

create index portal_access_log_person_idx on portal_access_log (person_id, at desc);
create index portal_access_log_subject_idx on portal_access_log (record_subject_person_id, at desc);

-- ---------------------------------------------------------------------------
-- What a portal user may read about another person
-- ---------------------------------------------------------------------------

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
    );

  -- STILL TO COME: a workforce grant should reach the clients this caregiver is
  -- assigned to. That predicate needs a visits table, which Joy does not have —
  -- scheduling is TypeScript over seed data today. When the table lands, the
  -- branch is:
  --
  --   or exists (
  --     select 1 from visits v
  --     where v.caregiver_person_id = current_person_id()
  --       and v.client_person_id = target
  --       and v.starts_at > now() - interval '30 days'
  --   )
  --
  -- Note the window. Access should follow assignment and then lapse: a
  -- caregiver who covered one shift in March has no business reading that
  -- client's record in September.
$$;

-- ---------------------------------------------------------------------------
-- Narrowing what 0003 left open
--
-- Each policy below replaces one that said only "same organization". The staff
-- behaviour is unchanged — is_staff() is true for every role that could reach
-- these before. What changes is that the two portal roles no longer pass.
-- ---------------------------------------------------------------------------

drop policy if exists people_read_same_org on people;
create policy people_read_same_org on people
  for select using (
    organization_id = current_org_id()
    and (is_staff() or portal_may_read_person(id))
  );

drop policy if exists client_profiles_read_same_org on client_profiles;
create policy client_profiles_read_same_org on client_profiles
  for select using (
    exists (
      select 1 from people p
      where p.id = client_profiles.person_id
        and p.organization_id = current_org_id()
        and (is_staff() or portal_may_read_person(p.id))
    )
  );

drop policy if exists employee_profiles_read_same_org on employee_profiles;
create policy employee_profiles_read_same_org on employee_profiles
  for select using (
    exists (
      select 1 from people p
      where p.id = employee_profiles.person_id
        and p.organization_id = current_org_id()
        -- A caregiver reads her own employment record and no colleague's. Pay
        -- and hire dates are not workforce gossip.
        and (is_staff() or p.id = current_person_id())
    )
  );

drop policy if exists relationships_read_same_org on relationships;
create policy relationships_read_same_org on relationships
  for select using (
    exists (
      select 1 from people p
      where p.id = relationships.subject_person_id
        and p.organization_id = current_org_id()
        and (
          is_staff()
          -- A family member may see the relationships of the person they are
          -- responsible for — that is the disclosure list they are on.
          or portal_may_read_person(p.id)
          -- And their own entry, wherever it appears.
          or relationships.related_person_id = current_person_id()
        )
    )
  );

drop policy if exists admissions_read_same_org on admissions;
create policy admissions_read_same_org on admissions
  for select using (
    organization_id = current_org_id()
    and (
      is_staff()
      -- §20: the family sees where their own admission has got to.
      or (client_person_id is not null and portal_may_read_person(client_person_id))
    )
  );

-- Requirements are policy, not data about a person, and a caregiver needs to
-- know what is owed of her. Left readable to everyone in the organization —
-- restated here so the decision is visible rather than inherited.
drop policy if exists credential_requirements_read on credential_requirements;
create policy credential_requirements_read on credential_requirements
  for select using (organization_id = current_org_id());

-- ---------------------------------------------------------------------------
-- What a portal employee may read about themselves
-- ---------------------------------------------------------------------------

-- 0005 restricted credential records to staff who schedule or supervise. A
-- caregiver must be able to see her own — the whole point of the portal's
-- documents screen is that she can tell what is expiring.
drop policy if exists employee_credentials_read on employee_credentials;
create policy employee_credentials_read on employee_credentials
  for select using (
    organization_id = current_org_id()
    and (
      has_role('ceo_admin', 'rn_clinical', 'hr', 'scheduler')
      or exists (
        select 1 from employee_profiles ep
        where ep.id = employee_credentials.employee_id
          and ep.person_id = current_person_id()
      )
    )
  );

-- Her own documents, and only the classes that are hers to see. A caregiver
-- reads her own CPR card; she does not read the background check report run
-- about her, which stays with the owner and HR exactly as 0005 has it.
drop policy if exists documents_read on documents;
create policy documents_read on documents
  for select using (
    organization_id = current_org_id()
    and (
      can_read_document_sensitivity(sensitivity)
      or (
        sensitivity in ('general_credential', 'clinical_credential')
        -- documents are owned polymorphically; owner_id is an employee_profiles
        -- id when owner_type is 'employee'.
        and documents.owner_type = 'employee'
        and exists (
          select 1 from employee_profiles ep
          where ep.id = documents.owner_id
            and ep.person_id = current_person_id()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Policies on the new tables
-- ---------------------------------------------------------------------------

alter table portal_grants     enable row level security;
alter table portal_access_log enable row level security;

grant select on portal_grants, portal_access_log to authenticated;
grant insert, update on portal_grants to authenticated;
grant insert on portal_access_log to authenticated;

-- You may see your own grants. Staff who manage people may see all of them.
create policy portal_grants_read on portal_grants
  for select using (
    organization_id = current_org_id()
    and (is_staff() or person_id = current_person_id())
  );

-- Issuing a portal is a staff act. A portal user must never be able to grant
-- themselves a second audience — that is the path from a caregiver login to a
-- family login over somebody else's records.
create policy portal_grants_write on portal_grants
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'hr', 'intake_coordinator')
  ) with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'hr', 'intake_coordinator')
  );

-- Append-only, like every other log in this schema. Only the owner reads it,
-- because it is a record of who looked at whom.
create policy portal_access_log_read on portal_access_log
  for select using (organization_id = current_org_id() and has_role('ceo_admin'));

create policy portal_access_log_insert on portal_access_log
  for insert with check (organization_id = current_org_id());

create trigger portal_grants_set_updated_at before update on portal_grants
  for each row execute function set_updated_at();
