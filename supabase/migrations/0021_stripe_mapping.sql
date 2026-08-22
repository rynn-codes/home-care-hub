-- Joy Health — the Stripe mapping, and the event receipts
--
-- Addendum §9–§12, and the Phase 0 proposal's "0017" finally landing. Stripe
-- is the processor and the vault; Joy is the system of record. What Joy keeps
-- of Stripe is REFERENCES and RECEIPTS — never a credential, never a secret,
-- and never a Stripe id standing in for a Joy id (§9: "Stripe IDs are not
-- Joy's primary business IDs").
--
-- The server layer that talks to Stripe (§8.1 of the main spec) is the
-- developer's to build. These tables are its landing ground, and the rules
-- that make reconciliation safe live here rather than in that code:
-- idempotency is a UNIQUE INDEX, not a promise.

create table stripe_customers (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  billing_account_id  uuid not null references billing_accounts (id) on delete cascade,
  stripe_customer_id  text not null,
  livemode            boolean not null default false,
  created_at          timestamptz not null default now(),

  -- One Stripe Customer per billing account, one account per Customer. Two
  -- mappings for one account is two places money can land.
  constraint stripe_customers_account_unique unique (billing_account_id),
  constraint stripe_customers_stripe_unique unique (stripe_customer_id)
);

comment on table stripe_customers is
  'Addendum §9. A Customer is created only when payment setup needs one (main spec §8.2) — never at referral, so a family that never starts care never exists in Stripe.';

-- What Joy may know about a payment method: brand and last four. §9's own
-- example — "Visa •••• 4242" — is the ceiling, and there is deliberately no
-- column that could hold more.
create table payment_method_summaries (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations (id) on delete cascade,
  billing_account_id        uuid not null references billing_accounts (id) on delete cascade,
  stripe_payment_method_id  text not null,

  method_type               text not null,
  -- "Visa", "Chase checking" — display words, nothing else.
  brand_or_bank             text not null,
  last_four                 text not null,
  exp_month                 integer,
  exp_year                  integer,

  status                    text not null default 'usable',
  is_default                boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint pms_stripe_unique unique (stripe_payment_method_id),
  constraint pms_type_known check (method_type in ('card', 'us_bank_account')),
  constraint pms_status_known check (status in ('usable', 'expired', 'failed_verification', 'detached')),
  -- Four digits. A column that would take five would eventually be handed six.
  constraint pms_last_four_is_last_four check (last_four ~ '^[0-9]{4}$')
);

create unique index pms_one_default_per_account
  on payment_method_summaries (billing_account_id)
  where is_default;

create index pms_account_idx on payment_method_summaries (billing_account_id);

create trigger payment_method_summaries_set_updated_at before update on payment_method_summaries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Event receipts — §12's idempotency, held by the database
-- ---------------------------------------------------------------------------

-- Separate from domain_events deliberately (Phase 0's reasoning stands): the
-- outbox is Joy's own work queue; this is a ledger of what an EXTERNAL
-- processor said, with the processor's own delivery semantics. One retry
-- policy governing both would be wrong for at least one of them.
create table stripe_event_receipts (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid references organizations (id) on delete cascade,

  -- THE IDEMPOTENCY GUARANTEE. Stripe redelivers; a webhook handler that has
  -- seen evt_123 refuses it here, by constraint, however many times it
  -- arrives and however many handlers race.
  stripe_event_id     text not null,
  event_type          text not null,
  livemode            boolean not null default false,
  api_version         text,

  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  status              text not null default 'received',
  attempts            integer not null default 0,
  last_error          text,

  related_invoice_id  uuid references issued_invoices (id) on delete set null,
  related_billing_account_id uuid references billing_accounts (id) on delete set null,

  constraint ser_stripe_event_unique unique (stripe_event_id),
  constraint ser_status_known check (
    status in ('received', 'processed', 'failed', 'skipped')
  ),
  constraint ser_processed_has_time check (
    status <> 'processed' or processed_at is not null
  ),
  constraint ser_attempts_not_negative check (attempts >= 0)
);

create index ser_unprocessed_idx on stripe_event_receipts (received_at)
  where status in ('received', 'failed');

comment on table stripe_event_receipts is
  'Addendum §12. Joy updates payment state ONLY from rows here that reached processed — never from a browser redirect (§10), never from what a request hoped happened. The event names are verified against current Stripe docs at wiring time, not baked into this schema.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table stripe_customers         enable row level security;
alter table payment_method_summaries enable row level security;
alter table stripe_event_receipts    enable row level security;

grant select, insert, update on stripe_customers, payment_method_summaries to authenticated;
grant select on stripe_event_receipts to authenticated;
-- Receipts are written by the webhook worker (service role), never by a
-- signed-in person: a receipt says what Stripe said, and no role at Joy is
-- allowed to say it for them.

create policy stripe_customers_rw on stripe_customers
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  ) with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy pms_rw on payment_method_summaries
  for all using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  ) with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

create policy ser_read on stripe_event_receipts
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

-- The family may see their own method summary — §9.3 lists "payment method
-- brand/type and last four only" — through the same grant machinery as
-- invoices. A definer view, for the same column-control reasons as 0018.
create view family_payment_methods
with (security_invoker = off)
as
select
  m.id,
  m.billing_account_id,
  bac.client_person_id,
  m.method_type,
  m.brand_or_bank,
  m.last_four,
  m.status,
  m.is_default
from payment_method_summaries m
join billing_account_clients bac on bac.billing_account_id = m.billing_account_id
where has_family_action(bac.client_person_id, 'view_invoices');

grant select on family_payment_methods to authenticated;

comment on view family_payment_methods is
  'Addendum §9: "Visa •••• 4242" and nothing more. No Stripe id reaches a family — the columns it lacks cannot leak.';
