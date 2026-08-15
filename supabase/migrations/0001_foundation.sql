-- Joy Health — Sprint 0 foundation
--
-- Core identity and the one-source-of-truth person model, per section 9 of the
-- Codex Engineering Kickoff.
--
-- The rule this schema exists to enforce: one person, many roles. A daughter who
-- is her father's responsible party and later applies as a caregiver is ONE row
-- in people, with a client relationship and an employee profile hanging off it.
-- Admissions is the process; People is the record. Nothing downstream may create
-- a second person because someone appeared in another workflow.

create extension if not exists "pgcrypto";
-- Email is matched case-insensitively; citext keeps that in the column type
-- rather than relying on every query remembering to lower() both sides.
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums. Explicit state, per the code quality rules — no free-text status.
-- ---------------------------------------------------------------------------

create type user_role as enum (
  'ceo_admin',
  'intake_coordinator',
  'rn_clinical',
  'scheduler',
  'payroll',
  'billing',
  'hr',
  'employee',
  'client_contact'
);

create type user_status as enum ('invited', 'active', 'suspended');

create type client_status as enum (
  'prospect',
  'pending_admission',
  'active',
  'on_hold',
  'discharged'
);

create type employee_status as enum (
  'candidate',
  'onboarding',
  'active',
  'on_leave',
  'inactive'
);

create type relationship_type as enum (
  'spouse',
  'child',
  'parent',
  'sibling',
  'other_family',
  'friend',
  'guardian',
  'power_of_attorney',
  'case_manager',
  'other'
);

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  timezone       text        not null default 'America/Chicago',
  office_address text,
  phone          text,
  settings_json  jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Joy application users. Distinct from auth.users: Supabase owns credentials,
-- Joy owns the role, the organization and the person's name in the product.
create table users (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations (id) on delete cascade,
  auth_user_id    uuid unique,
  first_name      text        not null,
  last_name       text        not null,
  email           citext,
  role            user_role   not null,
  status          user_status not null default 'invited',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint users_email_unique_per_org unique (organization_id, email)
);

create index users_organization_id_idx on users (organization_id);

-- ---------------------------------------------------------------------------
-- People — the single record for any human Joy knows about
-- ---------------------------------------------------------------------------

create table people (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  first_name      text not null,
  preferred_name  text,
  last_name       text not null,
  date_of_birth   date,
  phone           text,
  email           citext,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index people_organization_id_idx on people (organization_id);
create index people_last_name_idx on people (organization_id, lower(last_name));

-- A person becomes a client by gaining this profile, never by being copied.
create table client_profiles (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null unique references people (id) on delete cascade,
  client_status      client_status not null default 'prospect',
  admission_date     date,
  emergency_priority text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Likewise for employees. The same person may hold both profiles.
create table employee_profiles (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null unique references people (id) on delete cascade,
  employee_status   employee_status not null default 'candidate',
  job_role          text not null,
  hire_date         date,
  ready_to_work_at  timestamptz,
  gusto_external_id text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Family, responsible parties and emergency contacts. Decision 1, ruled 15 Aug:
-- one emergency contact is captured during phone intake and the pair completed
-- at assessment, so an RN never drives to a first visit with no contact on file.
create table relationships (
  id                                 uuid primary key default gen_random_uuid(),
  subject_person_id                  uuid not null references people (id) on delete cascade,
  related_person_id                  uuid not null references people (id) on delete cascade,
  relationship_type                  relationship_type not null,
  is_primary_contact                 boolean not null default false,
  is_emergency_contact               boolean not null default false,
  is_responsible_party               boolean not null default false,
  is_authorized_for_care_coordination boolean not null default false,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now(),
  constraint relationships_distinct_people check (subject_person_id <> related_person_id),
  constraint relationships_unique_pair unique (subject_person_id, related_person_id, relationship_type)
);

create index relationships_subject_idx on relationships (subject_person_id);
create index relationships_related_idx on relationships (related_person_id);

-- At most one primary contact per person. Integrity belongs in the database,
-- not only in whichever screen happens to write the row.
create unique index relationships_one_primary_contact
  on relationships (subject_person_id)
  where is_primary_contact;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();
create trigger people_set_updated_at before update on people
  for each row execute function set_updated_at();
create trigger client_profiles_set_updated_at before update on client_profiles
  for each row execute function set_updated_at();
create trigger employee_profiles_set_updated_at before update on employee_profiles
  for each row execute function set_updated_at();
create trigger relationships_set_updated_at before update on relationships
  for each row execute function set_updated_at();
