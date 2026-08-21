-- Joy Health — one approved fact about a visit, which both ledgers read
--
-- §6.3 of the billing specification, and the keystone of Phase 1.
--
-- WHAT WAS WRONG. Joy has `visits` and `time_entries`, and billing and payroll
-- each looked at that raw data and drew their own conclusion. §3.1.5 forbids
-- exactly that: the two ledgers share verified service facts and never infer one
-- another's result. Today they would drift the first time somebody corrected a
-- visit — payroll paying on one reading and an invoice going out on another, with
-- nothing recording which was right.
--
-- WHY TWO APPROVED FIGURES AND NOT ONE. Payable minutes and billable minutes are
-- usually equal. The cases where they diverge are the ones that cost money or
-- trust, and every one of them is a judgement rather than a subtraction:
--
--   a caregiver stays forty minutes because the family asked — payable, and
--     whether it is billable is what Joy agreed;
--   a caregiver clocks out with paperwork outstanding — Karynn: "let her out,
--     record the gap"; she worked, she is paid, the visit is still billable;
--   a caregiver arrives late — the client had less care than was booked, and
--     somebody decides that rather than a formula.
--
-- So neither figure is ever set without a name against it.

create type service_unit_state as enum ('proposed', 'verified', 'superseded');

create table verified_service_units (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations (id) on delete cascade,
  visit_id                  uuid not null references visits (id) on delete restrict,

  client_person_id          uuid not null references people (id) on delete restrict,
  caregiver_person_id       uuid references people (id) on delete set null,

  -- The day the care happened. Both ledgers need it and neither can derive it
  -- from anything else on this row: payroll places the hours in a workweek,
  -- which is where overtime is decided, and billing places the line in an
  -- invoice period. Denormalised from the visit on purpose — a verified unit is
  -- a settled fact, and re-reading the date through a join means a rescheduled
  -- visit silently moves money between weeks.
  served_on                 date not null,

  scheduled_minutes         integer not null,
  -- From the clock. Null when nobody clocked in, or nobody clocked out.
  actual_minutes            integer,

  -- Payroll's fact and billing's fact. Separate on purpose; see above.
  approved_payable_minutes  integer,
  approved_billable_minutes integer,

  service_code              text not null,
  -- Why the approved figures are what they are, when they differ from actual.
  note                      text,

  state                     service_unit_state not null default 'proposed',
  verified_by_user_id       uuid references users (id) on delete restrict,
  verified_at               timestamptz,
  -- Deferred on purpose. Recording a correction writes two rows in one
  -- transaction and there is no order that works without this: the corrected
  -- row cannot be inserted while the original is still live (the unique index
  -- below refuses it), and the original cannot be marked superseded until there
  -- is a row to point at. Deferring lets the transaction say "this one replaces
  -- that one" and settle both at commit. The guarantee is unchanged — a
  -- transaction that ends with a superseded row pointing nowhere still fails.
  superseded_by             uuid references verified_service_units (id) on delete restrict
                              deferrable initially deferred,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint vsu_minutes_not_negative check (
    scheduled_minutes >= 0
    and (actual_minutes is null or actual_minutes >= 0)
    and (approved_payable_minutes is null or approved_payable_minutes >= 0)
    and (approved_billable_minutes is null or approved_billable_minutes >= 0)
  ),

  -- THE CONSTRAINT THIS TABLE IS FOR. Neither approved figure exists without a
  -- person and a time against it. A number that appears with nobody's name on it
  -- is a number everybody assumes somebody checked.
  constraint vsu_approval_is_attributed check (
    (approved_payable_minutes is null and approved_billable_minutes is null)
    or (verified_by_user_id is not null and verified_at is not null)
  ),

  -- Verified means both figures are in. A half-verified unit would have payroll
  -- reading an approved figure while billing reads nothing, which is the drift
  -- this table exists to prevent.
  constraint vsu_verified_is_complete check (
    state <> 'verified'
    or (approved_payable_minutes is not null and approved_billable_minutes is not null)
  ),

  -- When the two differ, the difference is a decision, and a decision with no
  -- reason recorded is one nobody can defend later.
  constraint vsu_difference_is_explained check (
    approved_payable_minutes is null
    or approved_billable_minutes is null
    or approved_payable_minutes = approved_billable_minutes
    or length(btrim(coalesce(note, ''))) > 0
  ),

  constraint vsu_superseded_points_somewhere check (
    (state = 'superseded') = (superseded_by is not null)
  )
);

-- One live unit per visit. A second would mean two answers to "how long was
-- this visit", and whichever the query read first would win.
create unique index vsu_one_live_per_visit
  on verified_service_units (visit_id)
  where state <> 'superseded';

create index vsu_served_on_idx on verified_service_units (organization_id, served_on);
create index vsu_review_queue_idx on verified_service_units (organization_id, created_at)
  where state = 'proposed';
create index vsu_client_idx on verified_service_units (client_person_id, created_at desc);
create index vsu_caregiver_idx on verified_service_units (caregiver_person_id, created_at desc)
  where caregiver_person_id is not null;

comment on table verified_service_units is
  'The one approved fact about a visit. Billing reads approved_billable_minutes and payroll reads approved_payable_minutes; neither infers the other, per §3.1.5 of the billing specification.';

comment on column verified_service_units.approved_payable_minutes is
  'Payroll''s figure. Never equal to approved_billable_minutes by construction — they are the same number most of the time and the cases where they differ are the ones that matter.';

-- A verified unit is not editable.
--
-- The same rule as confirmed charts (0008), live care plan tasks (0010),
-- recorded payments (0013) and rate versions (0014): a record somebody acted on
-- is not editable. Payroll may already have paid on the figure and an invoice
-- may already have gone out from it — overwriting leaves both ledgers pointing
-- at a record that no longer says what they acted on.
--
-- Superseding is allowed, because that is how a correction is recorded.
create or replace function refuse_verified_unit_edit()
returns trigger
language plpgsql
as $$
begin
  if old.state = 'verified' then
    if new.state = 'superseded' and new.superseded_by is not null
       and new.approved_payable_minutes is not distinct from old.approved_payable_minutes
       and new.approved_billable_minutes is not distinct from old.approved_billable_minutes then
      return new;
    end if;

    raise exception
      'This visit is verified. Supersede it with a corrected record instead — payroll may have paid on this figure and an invoice may have gone out from it.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger verified_service_units_no_edit_after_verify
  before update on verified_service_units
  for each row execute function refuse_verified_unit_edit();

create trigger verified_service_units_set_updated_at before update on verified_service_units
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- What each ledger reads
-- ---------------------------------------------------------------------------

-- Two views rather than one, so a query cannot reach for the wrong column by
-- accident. §6.3: never place `client_rate` on an employee timecard or
-- `employee_wage` on a client invoice line — and the surest way to keep that
-- true is that the payroll view has never heard of billing.

create view payable_service_units as
select
  u.id, u.organization_id, u.visit_id, u.served_on,
  u.caregiver_person_id,
  u.service_code,
  u.approved_payable_minutes as minutes,
  u.verified_by_user_id, u.verified_at
from verified_service_units u
where u.state = 'verified';

create view billable_service_units as
select
  u.id, u.organization_id, u.visit_id, u.served_on,
  u.client_person_id,
  u.service_code,
  u.approved_billable_minutes as minutes,
  u.verified_by_user_id, u.verified_at
from verified_service_units u
where u.state = 'verified';

-- The reader's own permissions apply, so the policies below govern both views
-- exactly as they govern the table. Without this a view runs as its owner and
-- becomes a way around row level security.
alter view payable_service_units set (security_invoker = on);
alter view billable_service_units set (security_invoker = on);

comment on view payable_service_units is
  'Payroll''s read. Carries no client and no billable figure, so a payroll query cannot reach a billing fact by accident.';
comment on view billable_service_units is
  'Billing''s read. Carries no caregiver and no payable figure, for the same reason in reverse.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table verified_service_units enable row level security;

grant select on verified_service_units, payable_service_units, billable_service_units
  to authenticated;
grant insert, update on verified_service_units to authenticated;

-- Both ledgers read it, and so does anybody who schedules — a supervisor
-- checking whether a visit was worked is ordinary operational work. Verifying
-- is narrower: it is an approval with money on both sides of it.
create policy vsu_read on verified_service_units
  for select using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing', 'payroll', 'scheduler', 'rn_clinical')
  );

create policy vsu_write on verified_service_units
  for insert with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing', 'payroll', 'scheduler')
  );

create policy vsu_update on verified_service_units
  for update using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing', 'payroll')
  )
  with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing', 'payroll')
  );

-- A caregiver reads nothing here. She sees her own visit and her own clock in
-- the portal; what Joy approved to pay her is a payroll conversation, and what
-- Joy approved to bill for her visit is none of her business — J-06 keeps
-- caregivers out of rate discussions entirely.
