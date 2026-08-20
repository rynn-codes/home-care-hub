-- ---------------------------------------------------------------------------
-- Employee documents, credentials and the audit trail over them.
--
-- Source: Joy_Health_Employee_Documents_Credentials_Audit_Spec.md.
--
-- The principle the whole schema serves, from §1 of that spec:
--
--   The original uploaded document is the evidence.
--   Structured Joy data is the operational source of truth.
--   The generated personnel-file packet is the audit/presentation layer.
--
-- Three consequences shape the tables below.
--
--  1. `documents` stores a storage_key, never a URL. §19 forbids permanent
--     public document URLs; viewing goes through a short-lived signed URL
--     issued after a permission check.
--  2. Renewals never overwrite. `employee_credential_versions` keeps the prior
--     card and its evidence, because §30 rule 7 forbids deleting credential
--     history and an auditor asks what was true in 2024, not just today.
--  3. Requirements are DATA, not code. §6 is explicit that requirements and
--     their scheduling consequences must be configurable to Joy policy and
--     jurisdiction rather than hard-coded. The application reads this table.
--
-- Local-only, as with every migration in this directory. Not applied to the
-- Supabase project.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------------ types --

-- Who or what a document belongs to. Deliberately wider than employees: §21
-- warns against building a CPR-only scanner, and the same pipeline is meant to
-- carry client medication lists and admission paperwork later.
create type document_owner_type as enum (
  'employee',
  'client',
  'candidate',
  'admission',
  'assessment',
  'organization'
);

-- §11's personnel-file taxonomy.
create type document_folder as enum (
  'employee_application',
  'credentials_licenses',
  'health_screening',
  'driving',
  'background',
  'training',
  'orientation',
  'employment',
  'other'
);

-- §19. A scheduler who needs an eligibility answer does not thereby need to
-- read the document behind it. Sensitivity is a property of the document, so
-- the check can happen without knowing which module is asking.
create type document_sensitivity as enum (
  'general_credential',
  'clinical_credential',
  'identity_sensitive',
  'background_sensitive',
  'payroll_sensitive',
  'health_sensitive'
);

-- §23. `superseded` matters: a renewed document is not deleted, it steps back.
create type document_processing_state as enum (
  'uploaded',
  'queued',
  'processing',
  'needs_review',
  'verified',
  'failed',
  'superseded'
);

create type credential_status as enum (
  'current',
  'expiring',
  'expired',
  'missing',
  'pending_review',
  'rejected',
  'not_applicable'
);

-- §10: AI drafts, humans approve. `ai_extracted` is explicitly NOT `verified`,
-- and the gap between them is the whole point of the column.
create type verification_status as enum (
  'unverified',
  'ai_extracted',
  'needs_review',
  'verified',
  'rejected'
);

-- ------------------------------------------------------------- documents --

create table documents (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,

  owner_type            document_owner_type not null,
  owner_id              uuid not null,

  document_type         text not null,
  folder_type           document_folder not null default 'other',
  sensitivity           document_sensitivity not null default 'general_credential',

  -- A key into private object storage. NEVER a URL: §30 rule 6.
  storage_key           text not null,
  original_filename     text not null,
  mime_type             text not null,
  file_size             bigint not null check (file_size > 0),
  -- Used to spot a duplicate re-upload before it becomes a second credential.
  checksum              text not null,

  processing_state      document_processing_state not null default 'uploaded',
  classification_status text,
  extraction_status     text,
  -- Why processing failed, shown to a human. §23: never fake success, and a
  -- failure must never destroy the file.
  processing_error      text,

  uploaded_by_user_id   uuid references users(id) on delete set null,
  uploaded_at           timestamptz not null default now(),
  superseded_at         timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index documents_owner_idx on documents (organization_id, owner_type, owner_id);
create index documents_state_idx on documents (organization_id, processing_state)
  where processing_state in ('uploaded', 'queued', 'processing', 'needs_review', 'failed');
-- Duplicate detection is per owner, not global: two employees may legitimately
-- upload the identical blank form.
create index documents_checksum_idx on documents (organization_id, owner_id, checksum);

-- -------------------------------------------------- credential requirements --

-- §6: Joy must know WHY a document matters, and that must be configurable.
create table credential_requirements (
  id                             uuid primary key default gen_random_uuid(),
  organization_id                uuid not null references organizations(id) on delete cascade,

  credential_type                text not null,
  display_name                   text not null,
  folder_type                    document_folder not null default 'credentials_licenses',
  sensitivity                    document_sensitivity not null default 'general_credential',

  -- Null means every role. Otherwise the roles this applies to.
  required_for_role              user_role[],
  -- True when the requirement only applies to somebody who drives clients.
  required_for_driving           boolean not null default false,

  expiration_required            boolean not null default true,
  verification_required          boolean not null default true,
  -- The rule Scheduling consumes. §12: Scheduling reads eligibility, it does
  -- not decide it.
  blocks_scheduling_when_expired boolean not null default true,

  -- §13's configurable warning points, in days before expiry.
  warning_days                   integer[] not null default '{90,60,30,14,7}',

  active                         boolean not null default true,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),

  unique (organization_id, credential_type)
);

-- ---------------------------------------------------- employee credentials --

create table employee_credentials (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  employee_id            uuid not null references people(id) on delete cascade,

  credential_type        text not null,
  status                 credential_status not null default 'missing',

  issuer                 text,
  credential_number      text,
  issued_at              date,
  expires_at             date,

  verification_status    verification_status not null default 'unverified',
  verified_at            timestamptz,
  verified_by_user_id    uuid references users(id) on delete set null,

  -- The evidence currently standing behind this credential.
  current_document_id    uuid references documents(id) on delete set null,
  -- Kept for triage, deliberately not shown to auditors (§18).
  extraction_confidence  numeric(4,3) check (extraction_confidence between 0 and 1),

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- One live credential of each type per person. History lives in versions.
  unique (organization_id, employee_id, credential_type)
);

create index employee_credentials_employee_idx
  on employee_credentials (organization_id, employee_id);
-- Drives the expiration engine and the Needs You list.
create index employee_credentials_expiry_idx
  on employee_credentials (organization_id, expires_at)
  where status in ('current', 'expiring');
create index employee_credentials_review_idx
  on employee_credentials (organization_id, verification_status)
  where verification_status in ('ai_extracted', 'needs_review');

-- ------------------------------------------------------------- versions ----

-- §30 rule 7: never delete credential history because a renewal arrived. The
-- prior card and the prior evidence both stay reachable.
create table employee_credential_versions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  employee_credential_id uuid not null references employee_credentials(id) on delete cascade,
  document_id            uuid references documents(id) on delete set null,

  issuer                 text,
  credential_number      text,
  issued_at              date,
  expires_at             date,

  verification_status    verification_status not null default 'unverified',
  verified_at            timestamptz,
  verified_by_user_id    uuid references users(id) on delete set null,

  -- Null while this version is the current one.
  superseded_at          timestamptz,
  created_at             timestamptz not null default now()
);

create index credential_versions_credential_idx
  on employee_credential_versions (employee_credential_id, created_at desc);

-- ------------------------------------------------------- document access ---

-- §19 and §20: viewing a sensitive document is itself an event worth keeping.
-- Separate from audit_entries because these are high-volume and read-only, and
-- mixing them would bury the consequential changes.
create table document_access_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_id     uuid not null references documents(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  action          text not null,
  occurred_at     timestamptz not null default now(),
  -- Never the document contents. §20: do not copy sensitive contents into logs.
  metadata        jsonb not null default '{}'::jsonb
);

create index document_access_log_document_idx
  on document_access_log (document_id, occurred_at desc);

-- ------------------------------------------------------------------ RLS ----

alter table documents                     enable row level security;
alter table credential_requirements       enable row level security;
alter table employee_credentials          enable row level security;
alter table employee_credential_versions  enable row level security;
alter table document_access_log           enable row level security;

-- Who may read the document itself, as opposed to a compliance answer derived
-- from it. §19: the scheduler gets eligibility, not the background check.
create or replace function can_read_document_sensitivity(s document_sensitivity)
returns boolean
language sql
stable
as $$
  select case s
    when 'general_credential'  then has_role('ceo_admin', 'rn_clinical', 'hr', 'scheduler')
    when 'clinical_credential' then has_role('ceo_admin', 'rn_clinical', 'hr')
    when 'identity_sensitive'  then has_role('ceo_admin', 'hr')
    when 'background_sensitive' then has_role('ceo_admin', 'hr')
    when 'payroll_sensitive'   then has_role('ceo_admin', 'payroll')
    when 'health_sensitive'    then has_role('ceo_admin', 'rn_clinical')
  end;
$$;

create policy documents_read on documents
  for select using (
    organization_id = current_org_id()
    and can_read_document_sensitivity(sensitivity)
  );

create policy documents_insert on documents
  for insert with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'hr', 'rn_clinical')
  );

create policy documents_update on documents
  for update using (
    organization_id = current_org_id() and has_role('ceo_admin', 'hr')
  ) with check (organization_id = current_org_id());

-- Requirements are policy. Everyone needs to read them to know what is owed;
-- only an owner changes them.
create policy credential_requirements_read on credential_requirements
  for select using (organization_id = current_org_id());

create policy credential_requirements_write on credential_requirements
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin')
  ) with check (organization_id = current_org_id() and has_role('ceo_admin'));

-- The credential RECORD is readable by anyone who schedules or supervises,
-- because that is the eligibility answer. The document behind it is not.
create policy employee_credentials_read on employee_credentials
  for select using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'rn_clinical', 'hr', 'scheduler')
  );

-- §10: only a human with standing verifies. Extraction may propose; it must not
-- be able to sign off its own work.
create policy employee_credentials_write on employee_credentials
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'rn_clinical', 'hr')
  ) with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'rn_clinical', 'hr')
  );

create policy credential_versions_read on employee_credential_versions
  for select using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'rn_clinical', 'hr', 'scheduler')
  );

create policy credential_versions_write on employee_credential_versions
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'rn_clinical', 'hr')
  ) with check (organization_id = current_org_id());

-- An access log nobody can alter is worth more than one they can.
create policy document_access_log_read on document_access_log
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'hr')
  );

create policy document_access_log_insert on document_access_log
  for insert with check (organization_id = current_org_id());

-- ------------------------------------------------------------- grants -----
--
-- RLS narrows what a role may see; it does not grant access in the first place.
-- PostgREST connects as `authenticated`, so without these the policies above are
-- unreachable and every query fails on permission rather than on policy.
-- `anon` is granted nothing: there is no unauthenticated path to a personnel
-- document.

grant select on documents, credential_requirements, employee_credentials,
  employee_credential_versions, document_access_log to authenticated;

grant insert, update on documents, employee_credentials,
  employee_credential_versions to authenticated;

grant insert, update, delete on credential_requirements to authenticated;

-- Append-only by design: an access log a reader can edit is not evidence.
grant insert on document_access_log to authenticated;

-- ------------------------------------------------------------- triggers ----

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_touch
  before update on documents
  for each row execute function touch_updated_at();

create trigger employee_credentials_touch
  before update on employee_credentials
  for each row execute function touch_updated_at();

create trigger credential_requirements_touch
  before update on credential_requirements
  for each row execute function touch_updated_at();
