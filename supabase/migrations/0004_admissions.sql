-- Joy Health — Admissions
--
-- Sprint 1, step 1: the admissions schema. Sections 10 and 34 of the kickoff
-- brief, plus sections 2, 8, 9 and 22 of the Admissions Master Build Spec.
--
-- Admissions is the PROCESS. People is the RECORD. An admission points at a
-- person; it never carries its own copy of them, and reaching 'admitted' does
-- not create a second client record — it adds a client_profile to the person who
-- was there all along.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Six stages plus closed. The Admissions spec is explicit: do not create a
-- fifteen-column pipeline.
create type admission_stage as enum (
  'new_referral',
  'phone_intake',
  'assessment',
  'pre_onboarding',
  'ready_for_admission',
  'admitted',
  'closed'
);

create type admission_status as enum ('active', 'on_hold', 'closed');

-- Merges two lists that did not agree. The Admissions spec names the origins a
-- referral may come from; the mockup's dropdown offers a shorter, differently
-- worded set. This is the union, so neither loses a value. Section 2 of the
-- kickoff brief says to document a mismatch rather than silently pick a side.
create type referral_source as enum (
  'phone_inquiry',
  'web_form',
  'marketing_crm',
  'hospital_discharge',
  'physician_referral',
  'family_word_of_mouth',
  'client_self',
  'repeat_client',
  'office_entry',
  'other'
);

-- The five services in the mockup's dropdown, plus live_in, which appears
-- throughout the scheduling and dashboard designs as a service actually being
-- delivered but is missing from that dropdown. Added deliberately and recorded
-- here rather than assumed.
create type care_service as enum (
  'personal_care',
  'companion_care',
  'respite_care',
  'post_acute_recovery',
  'dementia_care',
  'live_in',
  'other'
);

create type contact_method as enum ('phone', 'text', 'email');

create type payment_source as enum (
  'self_pay',
  'self_pay_ltc_insurance',
  'not_sure_yet',
  'other'
);

-- ---------------------------------------------------------------------------
-- admissions
-- ---------------------------------------------------------------------------

create table admissions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  client_person_id    uuid not null references people (id) on delete restrict,
  stage               admission_stage  not null default 'new_referral',
  status              admission_status not null default 'active',

  -- Minimum referral information, per section 8 of the Admissions spec. Name,
  -- preferred name, phone and email live on people; the responsible party is a
  -- relationships row. Only what is specific to THIS enquiry lives here.
  referral_source     referral_source not null default 'other',
  referral_source_detail text,
  service_requested   care_service,
  service_area        text,          -- general location or ZIP; the full address
                                     -- is confirmed at assessment scheduling
  best_contact_method contact_method,
  referral_note       text,
  expected_payer      payment_source,
  referral_received_at timestamptz not null default now(),

  assigned_user_id    uuid references users (id) on delete set null,
  closed_at           timestamptz,
  close_reason        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A closed admission must say when and why. Section 22 of the Admissions spec
  -- requires a not-a-fit referral to keep its history rather than disappear.
  constraint admissions_closed_is_explained
    check (
      (stage = 'closed' or status = 'closed') = (closed_at is not null)
      and (closed_at is null or close_reason is not null)
    )
);

create index admissions_org_stage_idx on admissions (organization_id, stage)
  where status <> 'closed';
create index admissions_client_person_idx on admissions (client_person_id);
create index admissions_assigned_idx on admissions (assigned_user_id)
  where status = 'active';

-- One open admission per person. A second enquiry for someone already moving
-- through the pipeline is the duplicate the Admissions spec asks Joy to catch,
-- not a new record to create quietly alongside the first.
create unique index admissions_one_open_per_person
  on admissions (client_person_id)
  where status <> 'closed';

create trigger admissions_set_updated_at before update on admissions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table admissions enable row level security;

grant select on admissions to authenticated;
grant insert, update on admissions to authenticated;

create policy admissions_read_same_org on admissions
  for select using (organization_id = current_org_id());

create policy admissions_write_staff on admissions
  for all
  using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler')
  )
  with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'intake_coordinator', 'rn_clinical', 'scheduler')
  );

-- An admission must belong to a person in the same organization. RLS alone does
-- not check this: a caller could otherwise point their own admission at another
-- tenant's person id and read the name back through the join.
create or replace function admissions_person_matches_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  person_org uuid;
begin
  select organization_id into person_org from people where id = new.client_person_id;
  if person_org is null or person_org <> new.organization_id then
    raise exception 'admission and client person must belong to the same organization'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger admissions_person_org_guard
  before insert or update of client_person_id, organization_id on admissions
  for each row execute function admissions_person_matches_org();
