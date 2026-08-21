-- Joy Health — the weekly billing run, recorded
--
-- §7.2 steps 1 and 2. The engine that detects exceptions and drafts invoices
-- lives in the domain (src/domain/billing/run.ts); what belongs to the
-- database is the RECORD of a run — that it happened, who started it, what
-- period it covered, what it snapshotted, and which exceptions it found. A run
-- that leaves no record cannot answer the only question that matters later:
-- "why did this family not get an invoice that week?"
--
-- NUMBERING NOTE. The Phase 0 proposal used 0017 for Stripe mapping and 0018
-- for widened grants; billing runs were sized into the gap table but not given
-- a number. They land here, so Stripe mapping becomes 0018 and grants 0019.

create table billing_runs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,

  period_start        date not null,
  period_end          date not null,

  -- What the drafts were priced from. If the schedule or a rate changes after
  -- this, the comparison fails and §7.2's "unapproved schedule change" fires
  -- at review rather than after the family has the invoice.
  snapshot_hash       text not null,

  drafts_created      integer not null default 0,
  exceptions_found    integer not null default 0,

  created_by_user_id  uuid not null references users (id) on delete restrict,
  created_at          timestamptz not null default now(),

  constraint billing_runs_period_ordered check (period_end >= period_start),
  constraint billing_runs_counts_not_negative check (
    drafts_created >= 0 and exceptions_found >= 0
  )
);

create index billing_runs_org_period_idx on billing_runs (organization_id, period_start desc);

comment on table billing_runs is
  'One row per §7.2 weekly run. Append-only: a run is a fact about what Joy did on a date, and rewriting it would orphan the drafts that cite it.';

-- The exceptions a run found, kept as rows rather than a JSON blob so the
-- yearly question — "how often is a rate missing?" — is a GROUP BY and not a
-- parsing project.
create type billing_run_exception_kind as enum (
  'missing_rate',
  'overlapping_service',
  'unapproved_schedule_change',
  'payer_not_ready',
  -- Never fires for Joy: all private pay, so no payer authorisation caps an
  -- invoice (Karynn, 21 August). In the enum because §7.2 lists it — the
  -- contract stays complete for the developer, and a kind that is missing is
  -- a kind nobody can ever log.
  'authorization_limit',
  'credit_on_account',
  'account_hold'
);

create table billing_run_exceptions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  billing_run_id   uuid not null references billing_runs (id) on delete cascade,

  kind             billing_run_exception_kind not null,
  client_person_id uuid references people (id) on delete restrict,
  detail           text not null,
  blocks_draft     boolean not null,

  created_at       timestamptz not null default now(),

  constraint billing_run_exceptions_detail_given check (length(btrim(detail)) > 0)
);

create index billing_run_exceptions_run_idx on billing_run_exceptions (billing_run_id);
create index billing_run_exceptions_kind_idx on billing_run_exceptions (organization_id, kind);

-- ---------------------------------------------------------------------------
-- The account hold
-- ---------------------------------------------------------------------------

-- §7.2's "account hold": billing deliberately paused — a bereavement, a
-- dispute being worked out. Distinct from status, which says whether Joy
-- COULD bill; a hold says Joy is choosing not to.
alter table billing_accounts
  add column on_hold     boolean not null default false,
  add column hold_reason text;

-- A pause with no reason is indistinguishable, three weeks later, from a bug.
alter table billing_accounts
  add constraint billing_accounts_hold_has_reason check (
    not on_hold or length(btrim(coalesce(hold_reason, ''))) > 0
  ),
  add constraint billing_accounts_no_stale_hold_reason check (
    on_hold or hold_reason is null
  );

-- ---------------------------------------------------------------------------
-- Drafts cite their run
-- ---------------------------------------------------------------------------

-- Nullable: invoices existed before runs did, and a manually issued invoice
-- (0013's path) has no run to cite.
alter table issued_invoices
  add column billing_run_id uuid references billing_runs (id) on delete restrict;

create index issued_invoices_run_idx on issued_invoices (billing_run_id)
  where billing_run_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table billing_runs           enable row level security;
alter table billing_run_exceptions enable row level security;

-- Append-only, both of them: SELECT and INSERT, no UPDATE or DELETE. A run is
-- a fact about what Joy did on a date. The counts are written once by the code
-- that performed the run, not maintained afterwards.
grant select, insert on billing_runs, billing_run_exceptions to authenticated;

create policy billing_runs_read on billing_runs
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy billing_runs_write on billing_runs
  for insert with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'billing')
    and created_by_user_id = (select id from current_app_user())
  );

create policy billing_run_exceptions_read on billing_run_exceptions
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy billing_run_exceptions_write on billing_run_exceptions
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

-- A run names who was not billed and why — payer gaps, holds, credit balances.
-- That is billing's business and nobody else's; a scheduler plans visits
-- without knowing a family's account is on hold, and a caregiver reads none
-- of this at all.
