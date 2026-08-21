-- Joy Health — billing accounts, and rates that have a history
--
-- Deliverable 3 of the billing specification's Section 20, first migration of
-- Phase 1. Section 20 is explicit that the canonical ledger and authorization
-- model come before the portal and before Stripe, because both consume this.
--
-- WHAT WAS WRONG. Everything financial in this database is keyed on the client:
-- `issued_invoices.client_person_id`, and a rate held per client in TypeScript.
-- A daughter paying for both her parents has no representation at all. She gets
-- two unrelated rate records, two invoices with nothing joining them, and — once
-- Stripe is connected — two Customer objects, two saved cards and two dunning
-- sequences. She then rings the office unable to understand why she was charged
-- twice for what she thinks of as one arrangement, and nobody can tell her,
-- because Joy does not know the two are hers.
--
-- WHAT THIS REUSES. `people` and `relationships.is_responsible_party` from 0001
-- are already the right shape for §6.1's Party. No party table is created and no
-- contact is duplicated. Section 14 Phase 0 is explicit about not creating a
-- second client, payer or user model.

-- ---------------------------------------------------------------------------
-- Billing accounts
-- ---------------------------------------------------------------------------

create type billing_account_status as enum (
  'setup_needed', 'ready', 'attention_needed', 'closed'
);

-- Only the two Joy actually uses. §6.2 also lists `external_payer`; Karynn,
-- 21 August: "We are all private pay. We allow long term care insurance, but
-- only for them to reimburse the client once they have paid us." Joy never bills
-- an insurer, so there is no external payer to model. Adding the value now would
-- be adding a state nobody can reach.
create type collection_method as enum ('automatic', 'send_invoice');

create type delivery_preference as enum ('portal', 'email_and_portal', 'paper_and_portal');

-- Whether Joy may charge a saved method when nobody is present.
--
-- Recorded as a fact about an account rather than inferred from a payment method
-- existing. A saved card is not permission, and treating it as permission is the
-- specific thing §18.4 exists to prevent — made easier to do by accident because
-- the card is right there.
create type authorization_status as enum ('not_captured', 'captured', 'withdrawn');

create table billing_accounts (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations (id) on delete cascade,

  -- The person who pays. Often the client; often a daughter or a son.
  payer_person_id           uuid not null references people (id) on delete restrict,

  status                    billing_account_status not null default 'setup_needed',
  collection_method         collection_method not null default 'send_invoice',
  delivery_preference       delivery_preference not null default 'email_and_portal',
  -- Only meaningful for send_invoice. The packet says payment is due within one
  -- calendar day, so the default is 1 rather than the usual 30.
  terms_days                integer,

  billing_email             citext,
  billing_phone             text,

  authorization_status      authorization_status not null default 'not_captured',
  authorization_captured_at timestamptz,
  authorization_document_id uuid references documents (id) on delete set null,

  deposit_remaining         numeric(10, 2) not null default 0,
  payment_method            payment_method,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint billing_accounts_terms_only_when_invoiced check (
    collection_method = 'send_invoice' or terms_days is null
  ),
  constraint billing_accounts_terms_positive check (terms_days is null or terms_days > 0),
  constraint billing_accounts_deposit_not_negative check (deposit_remaining >= 0),

  -- Captured authority carries a date. Recording authority with no date is a
  -- claim nobody can check afterwards, which is the same as no authority.
  constraint billing_accounts_authorization_is_dated check (
    authorization_status = 'not_captured' or authorization_captured_at is not null
  ),

  -- THE CONSTRAINT THIS TABLE IS REALLY FOR.
  --
  -- An account cannot be `ready` to charge automatically without recorded
  -- authority and a method to charge. Off-session charging on the strength of a
  -- saved card is what gets an agency in front of a regulator, and the
  -- application check in `accountGaps` should not be the only thing standing
  -- between Joy and doing it.
  constraint billing_accounts_automatic_needs_authority check (
    status <> 'ready'
    or collection_method <> 'automatic'
    or (authorization_status = 'captured' and payment_method is not null)
  )
);

create index billing_accounts_payer_idx on billing_accounts (payer_person_id);
create index billing_accounts_org_status_idx on billing_accounts (organization_id, status);

comment on table billing_accounts is
  'Who pays, as opposed to who receives care. One account per legal payer — a daughter paying for both parents has one account, one saved method and one conversation.';

comment on column billing_accounts.authorization_status is
  'Whether Joy may charge without the payer present. A saved payment method is not authority; §18.4 of the billing specification is an open legal question and this column is where its answer lands.';

-- ---------------------------------------------------------------------------
-- Which clients an account pays for
-- ---------------------------------------------------------------------------

create table billing_account_clients (
  billing_account_id uuid not null references billing_accounts (id) on delete cascade,
  client_person_id   uuid not null references people (id) on delete restrict,
  created_at         timestamptz not null default now(),
  primary key (billing_account_id, client_person_id)
);

-- One account pays for a client at a time.
--
-- §13 lists "one client has split payers" as an exception and §18.9 lists it as
-- an OPEN BUSINESS DECISION — Karynn has not said whether it happens at Joy.
-- The table is many-to-many so a split could be supported later without a
-- migration, but this index refuses one today, and there is deliberately no
-- share or percentage column. A schema that supports a case nobody has is a
-- schema people write code for, and that code has no test data and no way to be
-- right.
create unique index billing_account_clients_one_payer_per_client
  on billing_account_clients (client_person_id);

create index billing_account_clients_account_idx
  on billing_account_clients (billing_account_id);

-- ---------------------------------------------------------------------------
-- Rates, with a history
-- ---------------------------------------------------------------------------

create table rate_plan_versions (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations (id) on delete cascade,
  billing_account_id uuid not null references billing_accounts (id) on delete cascade,
  -- Null applies to every client on the account. A value overrides it for one.
  client_person_id   uuid references people (id) on delete cascade,

  hourly_rate        numeric(10, 2) not null,
  effective_from     date not null,
  -- Inclusive. Null means still in effect.
  effective_to       date,

  created_by_user_id uuid not null references users (id) on delete restrict,
  created_at         timestamptz not null default now(),

  constraint rate_plan_versions_rate_positive check (hourly_rate > 0),
  constraint rate_plan_versions_ordered check (effective_to is null or effective_to >= effective_from)
);

-- No two versions may cover the same day for the same scope.
--
-- Without this, `rateInEffect` has to pick between overlapping rows and whatever
-- it picks is arbitrary — which means an invoice's price depends on row order.
-- `daterange` with an exclusion constraint is the only honest way to say it.
create extension if not exists btree_gist;

alter table rate_plan_versions
  add constraint rate_plan_versions_no_overlap
  exclude using gist (
    billing_account_id with =,
    coalesce(client_person_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  );

create index rate_plan_versions_lookup_idx
  on rate_plan_versions (billing_account_id, client_person_id, effective_from desc);

comment on table rate_plan_versions is
  'A rate as of a date, never updated in place. An invoice cites the version it was built from, so editing a rate would rewrite what a family was told they agreed to — and an invoice sent last March would silently start saying something else.';

-- A version somebody has invoiced against cannot be edited.
--
-- The same rule as confirmed charts (0008), live care plan tasks (0010) and
-- recorded payments (0013): a record somebody acted on is not editable. Closing
-- a version by setting `effective_to` is allowed, because that is how a rate
-- change is recorded rather than a rewrite of what the old rate was.
create or replace function refuse_rate_rewrite()
returns trigger
language plpgsql
as $$
begin
  if new.hourly_rate is distinct from old.hourly_rate
     or new.effective_from is distinct from old.effective_from
     or new.billing_account_id is distinct from old.billing_account_id
     or new.client_person_id is distinct from old.client_person_id then
    raise exception
      'A rate version cannot be edited. Close it with an end date and open a new one, so the invoices built from it still say what they said.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger rate_plan_versions_no_rewrite
  before update on rate_plan_versions
  for each row execute function refuse_rate_rewrite();

create trigger billing_accounts_set_updated_at before update on billing_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices belong to an account as well as a client
-- ---------------------------------------------------------------------------

-- Nullable for now, and deliberately so. 0013's invoices exist and are keyed on
-- the client; backfilling them needs accounts to exist first. The column is
-- added here and made `not null` in the migration that backfills, rather than
-- breaking a table that currently works.
alter table issued_invoices
  add column billing_account_id  uuid references billing_accounts (id) on delete restrict,
  add column rate_plan_version_id uuid references rate_plan_versions (id) on delete restrict;

create index issued_invoices_account_idx
  on issued_invoices (billing_account_id, due_on)
  where status = 'issued';

comment on column issued_invoices.rate_plan_version_id is
  'Which rate this invoice was priced from. Without it, "why was I charged this" has no answer once the rate changes.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table billing_accounts        enable row level security;
alter table billing_account_clients enable row level security;
alter table rate_plan_versions      enable row level security;

grant select on billing_accounts, billing_account_clients, rate_plan_versions to authenticated;
grant insert, update on billing_accounts to authenticated;
grant insert, delete on billing_account_clients to authenticated;
grant insert, update on rate_plan_versions to authenticated;

-- Deliberately no delete on rate_plan_versions: see the trigger above.

-- Money is not everybody's business, per §5 and 0013's precedent. A scheduler
-- does not need to know what a family pays, and a caregiver certainly does not —
-- knowing a client's rate is the beginning of a conversation J-06 forbids
-- caregivers from having.
create policy billing_accounts_read on billing_accounts
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing', 'payroll')
  );

create policy billing_accounts_write on billing_accounts
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy billing_accounts_update on billing_accounts
  for update using (organization_id = current_org_id() and has_role('ceo_admin', 'billing'))
  with check (organization_id = current_org_id() and has_role('ceo_admin', 'billing'));

create policy billing_account_clients_read on billing_account_clients
  for select using (
    exists (
      select 1 from billing_accounts a
      where a.id = billing_account_id
        and a.organization_id = current_org_id()
        and has_role('ceo_admin', 'billing', 'payroll')
    )
  );

create policy billing_account_clients_write on billing_account_clients
  for insert with check (
    exists (
      select 1 from billing_accounts a
      where a.id = billing_account_id and a.organization_id = current_org_id()
    )
    and has_role('ceo_admin', 'billing')
  );

create policy billing_account_clients_delete on billing_account_clients
  for delete using (
    exists (
      select 1 from billing_accounts a
      where a.id = billing_account_id and a.organization_id = current_org_id()
    )
    and has_role('ceo_admin', 'billing')
  );

-- Rates are narrower still. Admissions needs to know whether a rate EXISTS to
-- report readiness; it does not need the number, and §5 gives it no rate access.
create policy rate_plan_versions_read on rate_plan_versions
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy rate_plan_versions_write on rate_plan_versions
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy rate_plan_versions_update on rate_plan_versions
  for update using (organization_id = current_org_id() and has_role('ceo_admin', 'billing'))
  with check (organization_id = current_org_id() and has_role('ceo_admin', 'billing'));
