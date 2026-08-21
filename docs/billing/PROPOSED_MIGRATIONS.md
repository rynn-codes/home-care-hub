# Proposed migrations

**Deliverable 3 of Section 20.** Nothing here is applied. Section 20 says to
propose migrations that reuse existing canonical records, so each one below says
what it reuses and what it deliberately does not create.

Numbering continues from `0013_invoices_and_payments.sql`.

---

## 0014 — Billing accounts and rate versions

**Reuses:** `people`, `relationships.is_responsible_party`, `organizations`.
**Does not create:** a party table, a contact table, a second client record.

```
billing_accounts
  id, organization_id
  legal_payer_person_id  → people(id)          -- the payer, not the client
  status                 setup_needed | ready | attention_needed | closed
  billing_email, billing_phone, billing_address
  delivery_preference    portal | email_and_portal | paper_and_portal
  collection_method      automatic | send_invoice | external_payer
  terms_days             -- only meaningful for send_invoice
  currency               default 'usd'
  authorization_status, authorization_captured_at, authorization_document_id
  version, timestamps

billing_account_clients          -- the join that makes split payers possible
  billing_account_id, client_person_id, share_percent | null
  unique (billing_account_id, client_person_id)

rate_plans / rate_plan_versions
  client_person_id or billing_account_id
  hourly_rate, holiday_multiplier, overtime_multiplier
  effective_from, effective_to, created_by_user_id
```

Constraints worth having:

- A billing account with `collection_method = 'automatic'` and no authorization
  captured cannot be `ready`. Off-session charging without recorded authority is
  the thing §18.4 exists to prevent.
- `rate_plan_versions` never updated in place. An invoice cites a version id, so
  editing a rate would rewrite what a family was told they agreed to.
- One `ready` billing account per client at a time, enforced by a partial unique
  index on the join — the same shape as `care_plans_one_active_per_client`.

**Migration of existing data:** `ClientBillingTerms` currently holds a rate per
client. Each becomes a billing account whose payer is the client themself, which
is correct for a client who pays their own bills and is the common case. Where a
responsible party is recorded, the account moves to them.

## 0015 — Verified service units

**Reuses:** `visits`, `time_entries`, `visit_charts`.
**Does not create:** a second visit or a second clock.

```
verified_service_units
  id, organization_id, visit_id → visits(id)
  scheduled_minutes
  actual_minutes                -- from time_entries
  approved_payable_minutes      -- payroll's fact
  approved_billable_minutes     -- billing's fact
  service_code
  exception_reason
  verified_by_user_id, verified_at
  unique (visit_id)
```

This is §6.3 and it is the keystone. Both ledgers read one approved record;
neither infers the other's result. The two approved figures are separate columns
on purpose — they are usually equal and the cases where they differ are exactly
the ones that matter: a caregiver who stayed forty minutes late at the family's
request may be payable and not billable, or billable and not payable, and which
one it is is a decision somebody makes rather than arithmetic.

A check constraint that neither approved figure may be set without
`verified_by_user_id`.

## 0016 — Invoice approval and immutability

**Reuses:** `issued_invoices`, `payments` from 0013.

```
alter type invoice_status add value 'draft', 'pending_approval', 'approved',
                                    'processing', 'disputed', 'uncollectible'

alter table issued_invoices
  add billing_account_id      → billing_accounts(id)
  add rate_plan_version_id    → rate_plan_versions(id)
  add source_snapshot_hash    text
  add submitted_by_user_id, submitted_at
  add approved_by_user_id, approved_at
  add finalized_at

invoice_lines
  invoice_id, description (sanitized), service_date | period,
  quantity, unit_label, unit_rate, amount,
  source_type, source_record_id, rate_plan_version_id
  -- deliberately no wage, diagnosis, task detail or chart narrative column

invoice_adjustments
  invoice_id, kind (credit | debit | write_off), amount, reason,
  created_by_user_id, created_at
```

Then the policy change §7.3 requires: replace the blanket update policy on
`issued_invoices` with one that permits updates only while `draft` or
`pending_approval`. After approval, corrections go through `invoice_adjustments`
or a void-and-reissue. **This narrowing lands with the approval step and not
before**, or invoices become uncorrectable in the meantime.

A trigger refusing any change to `total`, `service_period_*` or lines once
`approved_at` is set — the same shape as the confirmed-chart trigger in 0008 and
the live-care-plan trigger in 0010.

> **Numbering update (as built):** billing runs landed as `0017`, so Stripe
> mapping below becomes `0018` and widened grants `0019`.

## 0017 — Stripe mapping and event receipts

```
stripe_customers
  billing_account_id unique, stripe_customer_id unique, livemode, created_at

payment_method_summaries
  billing_account_id, stripe_payment_method_id unique
  type, brand_or_bank, last_four, exp_month, exp_year
  status, is_default
  -- no full number, no CVC, no client secret, ever

stripe_event_receipts
  stripe_event_id unique          -- the idempotency guarantee
  event_type, livemode, api_version
  received_at, processed_at, status, attempts, last_error
  related_invoice_id, related_billing_account_id
```

`stripe_event_receipts` is separate from `domain_events` deliberately: the outbox
is Joy's own work queue, and one retry policy governing both an internal job and
an external processor's redeliveries would be wrong for at least one of them.

A check constraint on `livemode` matching the deployment's expectation, so a test
event can never be processed against live data.

## 0018 — Portal grants, payment readiness, family finance access

```
alter table portal_grants
  add role                text        -- responsible_party | family_viewer | client
  add allowed_actions     text[]      -- 'view_invoices', 'pay_invoice', ...
  add effective_from, effective_to

alter table client_profiles
  add payment_setup_state -- not_started | payment_method_needed | ready
                          -- | complete | needs_attention
```

Then the policy that needs the most care in this whole plan: a family read on
`issued_invoices` and `payment_method_summaries`, scoped to a grant that holds
`view_invoices` for that client's billing account.

0013 currently gives families nothing, which is safe. Widening it is the risky
direction, so it lands with its own SQL assertions before anything renders:
a family reads their own account and no other; a revoked grant reads nothing; a
grant without `view_invoices` reads nothing; and no query returns a Stripe id, a
risk score or a decline diagnostic.

---

## Order and why

`0014 → 0015 → 0016 → 0017 → 0018`.

Billing accounts first because everything financial is keyed on the client today
and the longer that continues the more there is to move. Verified service units
second because both ledgers depend on them. Approval before Stripe, because
§7.2 step 7 forbids collecting on anything unapproved. Stripe mapping before the
family finance area, because there is nothing to show a family until an invoice
can be collected.
