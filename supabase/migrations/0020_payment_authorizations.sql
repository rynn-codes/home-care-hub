-- Joy Health — payment authorizations, invoice numbers, and the pricing review
--
-- The Billing/Invoicing/Stripe ADDENDUM (vendored in docs/specs) locked what
-- was still soft. Three of its requirements are schema:
--
-- §3  a payment authorization is a RECORD with history — who authorized, when,
--     which mode, which wording version, and every revocation — not a status
--     flag on the account;
-- §7  an invoice has a human number ("Invoice #JH-10428") a family can read
--     over the phone;
-- §2  pricing is reviewed BEFORE a payment method is requested — the family's
--     first billing interaction must never be "enter your card".

-- ---------------------------------------------------------------------------
-- §3: the authorization, with history
-- ---------------------------------------------------------------------------

-- The addendum's two modes, by their product names. 0014's collection_method
-- ('automatic' | 'send_invoice') is the same pair — autopay = automatic,
-- pay_invoice = send_invoice — and the domain maps between them; renaming a
-- column three migrations of constraints hang off would be churn, not clarity.
create type payment_mode as enum ('pay_invoice', 'autopay');

create table payment_authorizations (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  billing_account_id    uuid not null references billing_accounts (id) on delete cascade,

  -- Who put their name to it: the payer, or the responsible party.
  authorized_by_person_id uuid not null references people (id) on delete restrict,
  payment_mode          payment_mode not null,

  -- WHICH WORDING they agreed to. Joy's approved legal language will be
  -- versioned; an authorization that cannot say which version it was is an
  -- authorization nobody can defend when the wording changes.
  authorization_text_version text not null,
  authorized_at         timestamptz not null default now(),

  -- Stripe references only — never credentials. Nullable until Stripe exists.
  stripe_customer_ref   text,
  stripe_payment_method_ref text,

  status                text not null default 'active',
  revoked_at            timestamptz,
  revoked_by_person_id  uuid references people (id) on delete restrict,
  revoked_reason        text,

  created_at            timestamptz not null default now(),

  constraint payment_authorizations_status_known check (
    status in ('active', 'revoked', 'superseded')
  ),
  -- A revocation carries a name, a time and a reason — the same rule as
  -- portal grants (0009). "It stopped working" is not a history.
  constraint payment_authorizations_revocation_attributed check (
    status = 'active'
    or (revoked_at is not null
        and revoked_by_person_id is not null
        and length(btrim(coalesce(revoked_reason, ''))) > 0)
  ),
  constraint payment_authorizations_active_is_clean check (
    status <> 'active'
    or (revoked_at is null and revoked_by_person_id is null and revoked_reason is null)
  ),
  constraint payment_authorizations_version_given check (
    length(btrim(authorization_text_version)) > 0
  )
);

-- One live authorization per account. A second would be two answers to "may
-- Joy charge this", and §11 is exact about what happens when they disagree:
-- Joy must not silently continue unauthorized collection.
create unique index payment_authorizations_one_active
  on payment_authorizations (billing_account_id)
  where status = 'active';

create index payment_authorizations_account_idx
  on payment_authorizations (billing_account_id, created_at desc);

comment on table payment_authorizations is
  'Addendum §3. The full history of who authorized Joy to collect, under which wording, in which mode. Append-only in substance: rows change only to be revoked or superseded, attributably.';

-- The only edits a row accepts are its own ending.
create or replace function guard_authorization_history()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'active' then
    raise exception 'This authorization is %. Its history is settled — a new authorization is a new row.', old.status
      using errcode = 'check_violation';
  end if;
  if new.authorized_by_person_id is distinct from old.authorized_by_person_id
     or new.payment_mode is distinct from old.payment_mode
     or new.authorization_text_version is distinct from old.authorization_text_version
     or new.authorized_at is distinct from old.authorized_at
     or new.billing_account_id is distinct from old.billing_account_id then
    raise exception 'What was authorized, by whom and when, is not editable. Revoke it and capture a new authorization.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payment_authorizations_history
  before update on payment_authorizations
  for each row execute function guard_authorization_history();

alter table payment_authorizations enable row level security;
grant select, insert, update on payment_authorizations to authenticated;

create policy payment_authorizations_read on payment_authorizations
  for select using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );
create policy payment_authorizations_write on payment_authorizations
  for insert with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );
create policy payment_authorizations_update on payment_authorizations
  for update using (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  )
  with check (
    organization_id = current_org_id() and has_role('ceo_admin', 'billing')
  );

-- ---------------------------------------------------------------------------
-- §7: the invoice number
-- ---------------------------------------------------------------------------

-- "Invoice #JH-10428" — a number a family reads over the phone and the office
-- types into a search box. Sequential and boring on purpose: an id a human
-- relays must survive being said aloud.
create sequence invoice_number_seq start 10001;
-- The default fires as the inserting role; without this an authenticated
-- insert fails on the sequence, not the table.
grant usage on sequence invoice_number_seq to authenticated;

alter table issued_invoices
  add column invoice_number text not null
    default ('JH-' || nextval('invoice_number_seq'));

create unique index issued_invoices_number_unique
  on issued_invoices (organization_id, invoice_number);

comment on column issued_invoices.invoice_number is
  'Addendum §7. The human number. Joy''s primary ids stay uuids; Stripe''s ids are references, not identity (§9).';

-- ---------------------------------------------------------------------------
-- §2: pricing reviewed before a payment method is requested
-- ---------------------------------------------------------------------------

alter table billing_account_clients
  add column pricing_reviewed_at timestamptz;

comment on column billing_account_clients.pricing_reviewed_at is
  'Addendum §2: the family saw YOUR CARE COST — agreed hours × rate — before anybody asked for a card. Null means the payment-method request must wait.';

-- ---------------------------------------------------------------------------
-- §14: two more things a grant can say
-- ---------------------------------------------------------------------------

alter table portal_grants drop constraint portal_grants_actions_known;
alter table portal_grants add constraint portal_grants_actions_known check (
  allowed_actions <@ array[
    'view_invoices',
    'pay_invoice',
    'manage_payment_methods',
    'manage_autopay',
    'view_payment_history',
    'download_documents',
    'view_care_updates'
  ]::text[]
);
