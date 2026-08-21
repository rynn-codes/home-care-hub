# Joy Health Admissions, Billing, Payroll, Client Portal, and Stripe Integration

**Status:** Coding specification  
**Version:** 1.0  
**Prepared:** August 21, 2026  
**Audience:** Claude Code, Codex, product design, engineering, QA, operations, and compliance reviewers

---

## 1. Purpose

Build one connected Joy Health operating workflow from referral through admission, service delivery, billing, payment collection, payroll preparation, and family self-service.

This document deliberately separates:

- **ESTABLISHED JOY DECISION** — already approved in prior Joy product materials or the referenced Joy design conversations.
- **NEW STRIPE RECOMMENDATION** — proposed here to turn the approved billing/payment experience into a concrete implementation.
- **OPEN BUSINESS DECISION** — must be confirmed by Joy before production behavior is enabled.

Do not silently convert a recommendation into an approved business rule. Do not redesign established modules merely to accommodate Stripe.

---

## 2. Authority and provenance

### 2.1 Source-backed Joy decisions

The referenced Joy conversation identifies the following existing sources and decisions. The original uploaded source files are not present in this coding workspace, so the citations below preserve the source references recorded in that conversation rather than pretending the wording is a fresh legal or operational approval.

| Evidence ID | Existing source reference | Established decision used here |
|---|---|---|
| J-01 | Product Bible, cited as `turn25file0`, lines 11–30 | Billing & Payments is Phase 1; “Tap to Pay with payment fallback ladder” is approved. |
| J-02 | Admissions Master Build Spec, cited as `turn25file7`, lines 777–795 | Payment Setup is a readiness requirement before start of care, with states including Not Started, Payment Method Needed, Ready, Complete, and Needs Attention. |
| J-03 | Responsible Party/Billing Contact source, cited as `turn25file1`, lines 217–237 | Store billing contact identity, relationship, address, phone, email, billing preference, and payment-responsibility status. |
| J-04 | Admissions/client portal source, cited as `turn25file7`, lines 799–827 | The family portal shows the family’s real Joy status while hiding internal notes, AI confidence, staff-only risk flags, admission deliberations, and internal pricing discussions not intended for the family. |
| J-05 | Payroll/Billing workflow source, cited as `turn24file4`, lines 453–485 | Joy invoices the upcoming care week; Billing and Payroll remain separate but operationally connected. |
| J-06 | Employee policy source, cited as `turn24file6`, lines 595–606 | Billing, invoice, and payment questions belong to the office. Caregivers must not negotiate rates or collect client payments. |
| J-07 | Privacy source, cited as `turn25file4`, lines 502–540 | Client health information may be used/disclosed for treatment, payment, and healthcare operations; clients retain privacy rights; portal access must be authorized. |
| J-08 | Admissions roadmap, cited as `turn21file16`, lines 1621–1655 | Lifecycle: Referral → Phone Intake → Assessment → Pre-Onboarding → Ready → Admitted; enter information once and reuse it. |
| J-09 | Phone Intake source, cited as `turn19file0`, lines 2–3 | Capture caller/client basics, care need, schedule, payment source, assessment scheduling or follow-up. |
| J-10 | Portal design decision from “Morning Brief for Families” | Mobile-first client portal begins after Joy decides to move forward following RN assessment; actual workflow state drives status; portal is persistent truth and Spruce is the notification channel. |
| J-11 | Portal design decision from “Morning Brief for Families” | Authorized family/responsible-party users have their own phone-based access and permissions; raw caregiver charting is not family-visible by default. |

### 2.2 Stripe references

The Stripe architecture in this document is a new implementation recommendation based on current official Stripe documentation:

- [Invoices and automatic versus manual collection](https://docs.stripe.com/billing/collection-method)
- [Subscription and invoice lifecycle](https://docs.stripe.com/billing/subscriptions/overview)
- [Subscription/invoice webhook events](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe customer portal capabilities](https://docs.stripe.com/connect/subscriptions)
- [Stripe event destinations](https://docs.stripe.com/event-destinations)

Before production launch, engineering must pin a Stripe API version and revalidate event names and fields against that version.

---

## 3. Product invariants

### 3.1 Established Joy decisions

1. Joy is the operational source of truth. External services execute specialized functions but do not define Joy workflow state.
2. Enter data once and reuse it across Admissions, Scheduling, Billing, Payroll, and the portals.
3. AI may draft, classify, or summarize; an authorized human approves consequential records.
4. The client portal displays a calm, authorized view of the same underlying Joy record—not a parallel database.
5. Billing and Payroll are separate ledgers. They share verified service facts but never infer one another’s financial result.
6. A caregiver’s time record may support both payroll preparation and client billing, but client price is never calculated from caregiver wage.
7. Payment readiness is required before start of care unless an authorized office user records an exception.
8. Caregivers do not collect money, negotiate rates, or see family payment credentials.
9. Internal notes and protected operational deliberations never leak into client-facing descriptions, receipts, invoices, metadata, URLs, notifications, or Stripe-hosted pages.

### 3.2 New Stripe recommendations

1. Joy owns the canonical invoice and billing ledger; Stripe is the payment processor and may host payment-method collection and invoice payment pages.
2. Use Stripe Customer objects for payers, SetupIntents for saving reusable payment methods, PaymentIntents/Stripe Invoices for collection, and verified webhooks for asynchronous truth.
3. Store Stripe identifiers and sanitized payment summaries only. Never store card or bank account numbers, CVC, or client secrets.
4. Use one Stripe Customer per legal payer/responsible party, not automatically one per client.
5. Do not use Stripe Subscriptions for variable weekly home-care charges in V1. Generate each week’s invoice from approved Joy service/billing data. Revisit subscriptions only for truly fixed recurring fees.

---

## 4. End-to-end operating model

```text
Referral
  → Phone Intake
  → RN Assessment
  → Human decision to proceed
  → Client/family portal invitation
  → Pre-Onboarding
  → Agreements + authorizations + payment setup
  → Ready for Admission
  → Start of Care
  → Schedule and deliver visits
  → Verify time/charting/exceptions
  → Build upcoming-week client invoice
  → Office review and approval
  → Stripe collection
  → Reconciliation / exceptions

Verified visit facts
  → Payroll review
  → Payroll approval/export

Important: the two downstream paths share visit facts, then diverge.
```

### 4.1 Admission stages

| Stage | Required behavior |
|---|---|
| Referral | Create prospect/client shell and contact record. |
| Phone Intake | Capture source-form fields; do not duplicate the RN assessment. |
| Assessment Scheduled | Store RN, time, location, contacts, and notification recipients. |
| Assessment | Inherit intake facts; RN confirms/updates and completes clinical assessment. |
| Decision to Proceed | Authorized staff explicitly advances or closes/follows up. |
| Pre-Onboarding | Invite authorized portal users; collect missing documents, agreements, consents, and payment setup. |
| Ready for Admission | All configured readiness gates pass or authorized overrides exist. |
| Admitted / Active | Schedule, visits, billing, and portal operational views become active. |

### 4.2 Admission readiness gates

Each gate has `not_started`, `needs_action`, `in_review`, `ready`, `complete`, or `needs_attention` as applicable:

- assessment and clinical approval;
- service agreement/required consents;
- care plan;
- requested documents;
- schedule/start-of-care plan;
- responsible party and billing contact;
- rate agreement and billing cadence;
- payment setup;
- any documented authorized exception.

`ready_for_admission` must be computed from gates, not manually selected without an override reason and audit entry.

---

## 5. Roles and permissions

| Role | Billing access |
|---|---|
| CEO/Owner | Full configuration, approval, refund/void/write-off authority per policy, reporting. |
| Billing/Office | Manage payers, rates, draft invoices, payment setup, collections, adjustments, reconciliation. |
| Admissions | View payment-readiness status; collect billing contact/authorization; no unrestricted refund or payout controls. |
| RN/Clinical | View only payment-readiness information necessary to coordinate admission; no card details or internal collections notes unless separately authorized. |
| Scheduler | View limited account holds/alerts needed to schedule safely; no payment credentials or unnecessary financial detail. |
| Payroll | Access verified time and payroll exceptions; no client payment credentials or unnecessary family billing details. |
| Caregiver | No rate negotiation, invoice collection, payment credentials, balances, or internal billing notes. |
| Client | View permitted invoices, receipts, payment method summary, and own payment status. |
| Authorized family/responsible party | Same only for the client(s), account(s), and actions explicitly granted. |

All authorization must be enforced server-side at both resource and action level. A hidden UI control is not authorization.

---

## 6. Canonical data model

Names are illustrative; preserve equivalent existing tables where they already exist.

### 6.1 Core relationships

```text
Organization
 ├─ Client
 │   ├─ Admission
 │   ├─ ServiceAgreement / RatePlan
 │   ├─ Visit / VerifiedServiceUnit
 │   └─ BillingAccountMember
 ├─ Party (person or organization)
 │   ├─ ContactMethod
 │   ├─ PortalIdentity / AuthorizationGrant
 │   └─ BillingAccount
 │       ├─ StripeCustomerMapping
 │       ├─ PaymentMethodSummary
 │       ├─ Invoice
 │       │   ├─ InvoiceLine
 │       │   ├─ Adjustment
 │       │   └─ PaymentAllocation
 │       └─ Payment / Refund
 └─ Employee
     ├─ TimeEntry
     └─ PayrollItem / PayrollRun
```

### 6.2 Required billing fields

**BillingAccount**

- `id`, `organization_id`
- `legal_payer_party_id`
- `status`: `setup_needed | ready | attention_needed | closed`
- `billing_address_id`
- `billing_email`, `billing_phone`
- `delivery_preference`: `portal | email_and_portal | paper_and_portal`
- `collection_method`: `automatic | send_invoice | external_payer`
- `terms_days` when manual invoicing is allowed
- `currency`
- `stripe_customer_id` (unique within connected Stripe account)
- `default_payment_method_summary_id`
- `authorization_status`, `authorization_captured_at`, `authorization_document_id`
- timestamps and version

**Invoice**

- `id`, immutable human-readable `invoice_number`
- `billing_account_id`, `client_id`
- `service_period_start`, `service_period_end`
- `issue_date`, `due_date`
- `status`: `draft | pending_approval | approved | open | processing | paid | partially_paid | past_due | void | uncollectible | disputed`
- subtotal, discounts, adjustments, tax if applicable, total, amount_paid, balance_due
- `collection_method`
- `stripe_invoice_id`, `stripe_payment_intent_id`
- `approved_by`, `approved_at`, `finalized_at`, `paid_at`
- `source_snapshot_hash` or version to prove what was billed

**InvoiceLine**

- client-facing service description (sanitized)
- service date or covered period
- quantity, unit label, unit rate, amount
- source type and source record ID
- rate-plan version ID
- no diagnosis, chart narrative, task detail, or caregiver wage

**PaymentMethodSummary**

- Stripe PaymentMethod ID
- type (`card`, `us_bank_account`, etc.)
- brand/bank display name, last four, expiration month/year where applicable
- verification/status and default flag
- never full account data

**StripeEventReceipt**

- Stripe event ID (unique)
- event type, livemode, API version
- received/processed timestamps
- status, attempt count, last error
- related Joy/Stripe object IDs
- payload retention policy reference; avoid copying sensitive payloads unnecessarily

### 6.3 Payroll separation

**VerifiedServiceUnit** records the operational fact: scheduled time, actual time, approved payable time, approved billable quantity, service code, exceptions, and approvers.

From that record:

- Billing applies the client’s contracted rate/version and billing rules.
- Payroll applies the employee’s compensation rule/version, overtime, mileage, and payroll rules.

Never place `client_rate` on an employee timecard or `employee_wage` on a client invoice line. Corrections create adjustments/version history; they do not overwrite approved history silently.

---

## 7. Billing workflow

### 7.1 Established workflow

Joy bills the upcoming care week. The implementation must retain a reviewable weekly billing cycle and keep Billing separate from Payroll.

### 7.2 Weekly invoice generation

1. Create a billing run for the upcoming service period.
2. Snapshot scheduled/authorized service units and the effective rate agreement.
3. Detect exceptions before invoice creation: missing rate, overlapping service, unapproved schedule change, payer not ready, authorization limit, credit/adjustment, or account hold.
4. Generate Joy invoices in `draft`.
5. Office reviews client, service period, quantity, rate, credits, delivery, and collection method.
6. Authorized user approves.
7. Only after approval, create/finalize the corresponding Stripe invoice or initiate the selected Stripe payment flow.
8. Portal displays the Joy invoice state, reconciled from Stripe events.

### 7.3 Invoice immutability

- Drafts may be edited.
- After approval/finalization, corrections use a credit, adjustment, void/reissue, or other auditable mechanism.
- Preserve the original invoice, approval, rate version, and source facts.
- Never delete a financial transaction because a UI record was removed.

### 7.4 Payment fallback ladder

The approved product concept is “Tap to Pay with payment fallback ladder.” The exact ladder below is a **NEW STRIPE RECOMMENDATION** and requires business approval:

1. Default saved payment method charged automatically.
2. If action is required, send a secure portal notification to complete authentication.
3. If the default method fails, allow the payer to choose another saved method or add a new one through Stripe-hosted/Stripe Elements collection.
4. Offer Hosted Invoice Page/manual pay when office policy permits.
5. Offer office-assisted in-person Tap to Pay through Stripe Terminal where supported.
6. Permit an authorized office user to record an external payment (for example check) with reference, date, recorder, and audit log.
7. Surface unresolved failure to Billing; never ask a caregiver to collect it.

Do not automatically try secondary saved methods without explicit authorization and a documented policy.

---

## 8. Stripe integration architecture — new recommendation

### 8.1 Boundary

```text
Joy UI
  → Joy API and authorization
    → Joy Billing Service / canonical ledger
      → Stripe Adapter
        → Stripe API

Stripe events
  → verified webhook endpoint
    → durable event receipt/queue
      → idempotent processor
        → fetch/validate Stripe object as needed
          → reconcile Joy ledger
            → portal/status/notification outbox
```

Never call privileged Stripe APIs directly from a browser or mobile client.

### 8.2 Customer creation

- Create a Stripe Customer only when payment setup begins or an approved invoice requires it.
- Map it to `BillingAccount`, not merely `Client`.
- Use metadata only for opaque Joy IDs and environment/tenant identifiers. Do not place PHI, care needs, diagnoses, family narrative, or sensitive notes in Stripe metadata or descriptions.
- Make creation idempotent with a stable server-side idempotency key.

### 8.3 Saving a payment method

1. Authorized payer signs into Joy with their own identity.
2. Joy verifies authorization for the billing account.
3. Server creates a Stripe SetupIntent for the mapped customer.
4. Browser uses Stripe-hosted UI/Elements to collect details; Joy never receives raw card/bank credentials.
5. Completion is confirmed by Stripe state/webhook, not only the browser redirect.
6. Joy stores a sanitized summary and optionally sets the method as the billing account/customer default.
7. Joy records the payer’s authorization and the applicable agreement separately from Stripe.

### 8.4 Creating and collecting an invoice

- Create Stripe invoice items from the approved Joy invoice snapshot.
- Create the Stripe Invoice with either `charge_automatically` or `send_invoice` according to the Joy billing account.
- Persist Stripe IDs immediately.
- Do not mark a Joy invoice paid because an API call returned successfully. Mark it paid only after authoritative Stripe state is reconciled, normally through `invoice.paid` and object verification.
- For automatic collection, support SCA/3DS `requires_action` flows through a secure client experience.
- For manual collection, link to Stripe’s Hosted Invoice Page or a tightly scoped Joy portal payment action.

### 8.5 Recommended event set

Subscribe only to required events for the pinned API version. Initial set:

- `setup_intent.succeeded`
- `setup_intent.setup_failed`
- `payment_method.attached` / relevant payment-method updates
- `invoice.created`
- `invoice.finalized`
- `invoice.finalization_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.voided`
- `invoice.marked_uncollectible`
- relevant refund events
- relevant dispute events
- relevant Terminal payment events if Tap to Pay is enabled

Exact names must be verified against the pinned API version and chosen Stripe products.

### 8.6 Webhook rules

- Verify the Stripe signature against the raw request body before parsing/processing.
- Return success quickly after durable receipt; process business effects asynchronously.
- Unique-index the Stripe event ID.
- Assume duplicate delivery, delayed delivery, and out-of-order delivery.
- Re-fetch the Stripe object when current state matters; do not blindly replay an old snapshot over newer state.
- Make each state transition idempotent and monotonic where possible.
- Dead-letter repeated failures and alert Billing/Engineering.
- Separate test/live secrets and reject unexpected `livemode`.
- Never log secrets, client secrets, raw payment credentials, or unnecessarily sensitive payloads.

### 8.7 Customer portal decision

**Recommendation:** use the Joy client portal as the primary experience and create short-lived Stripe-hosted portal or invoice sessions for narrowly scoped payment actions. Do not send families to a generic Stripe portal that exposes unsupported controls.

Configure allowed functions intentionally:

- view/pay invoices;
- add/update payment methods;
- download receipts/invoices if approved;
- no subscription cancellation/change controls unless Joy later sells a genuine self-service subscription product.

### 8.8 Tap to Pay / Terminal

- Treat Tap to Pay as an office-authorized collection channel, not a caregiver workflow.
- Create the PaymentIntent on the Joy server and associate it with the Joy invoice/billing account.
- Reconcile the resulting Stripe payment through the same canonical payment pipeline.
- Do not expose clinical information on the reader or in Stripe descriptions.
- Confirm supported devices, countries, payment methods, reader locations, and operational ownership before enabling production.

---

## 9. Client/family portal

### 9.1 Portal start and identity

- Portal invitation occurs only after the RN assessment and Joy’s human decision to proceed.
- Each user receives their own account; never share a family login.
- Phone OTP is the established preferred login experience. Engineering must still provide secure recovery, rate limiting, session controls, and a safe phone-number-change process.
- A portal user’s access derives from explicit authorization grants linking user, client, billing account, role, allowed actions, effective dates, and revocation state.

### 9.2 Pre-admission home

Show actual computed workflow states:

```text
Assessment             Complete
Service Agreement      Signed
Medication List        Needed
Payment Setup          Ready
Care Plan              In review
Start of Care          Monday

Next step: Upload the medication list
```

Payment Setup presentation:

- `Not started` — no payer/payment workflow initiated.
- `Payment method needed` — authorization exists or is in progress, but no usable method/collection arrangement exists.
- `Ready` — authorized collection method is present and valid for start-of-care rules.
- `Complete` — required setup/authorization steps have been completed; this does not mean every future invoice is paid.
- `Needs attention` — expired/removed method, failed verification, action required, or office exception.

### 9.3 Active-care billing area

Show only authorized, sanitized information:

- balance due and next due/charge date;
- invoice number, issue date, service period, family-safe line items, totals, status;
- receipt and payment history;
- payment method brand/type and last four only;
- add/update method;
- pay an open invoice when allowed;
- contact Joy Billing.

Do not show:

- internal billing notes or collection strategy;
- internal pricing deliberations or margins;
- caregiver wage/payroll;
- Stripe IDs, risk scores, Radar decisions, decline diagnostics beyond a safe actionable message;
- raw charting, diagnoses, AI confidence, staff-only risks, or admission deliberations;
- another family member’s or client’s records without authorization.

### 9.4 Notifications

Portal is persistent truth; Spruce is a notification channel. Notifications must be minimal and non-sensitive, for example: “A new Joy invoice is available” or “Your payment method needs attention.” The user signs into Joy to view details.

---

## 10. Privacy, security, and compliance

1. Perform a formal data-flow and vendor review before production. This specification is not legal advice and does not itself establish HIPAA/PCI compliance.
2. Minimize data sent to Stripe to what payment processing and reconciliation require.
3. Never put PHI or sensitive care narrative in Stripe metadata, invoice descriptions, statement descriptors, logs, analytics, support tickets, or notification text.
4. Tokenize payment data through Stripe-hosted components; Joy stores only Stripe references and display-safe summaries.
5. Encrypt data in transit and at rest; store secrets in a managed secrets service; rotate keys/secrets; use separate environments/accounts.
6. Require least-privilege RBAC/ABAC and object-level authorization.
7. Audit access and all consequential actions: payer changes, payment method changes, approvals, invoice finalization, adjustments, voids, refunds, write-offs, external payments, exports, and authorization changes.
8. Require step-up authentication and reason codes for refunds, voids, write-offs, manual payment marking, billing-account reassignment, and authorization overrides.
9. Use CSRF protection, secure cookies, short-lived sessions/links, rate limits, and OTP abuse controls.
10. Define retention and deletion schedules for financial, clinical, authorization, webhook, and audit records. A portal user deletion request must not erase records Joy is legally required to retain.
11. Prevent cross-tenant and cross-client access in queries and storage keys; test it explicitly.
12. Keep analytics/session-replay tools away from payment fields and sensitive client screens unless formally approved and configured for redaction.

---

## 11. API/service contracts

Illustrative endpoints; adapt to the existing stack.

```text
POST   /api/billing-accounts
PATCH  /api/billing-accounts/:id
POST   /api/billing-accounts/:id/setup-intents
POST   /api/billing-accounts/:id/portal-sessions
GET    /api/clients/:id/payment-readiness

POST   /api/billing-runs
POST   /api/billing-runs/:id/generate-drafts
POST   /api/invoices/:id/submit-for-approval
POST   /api/invoices/:id/approve
POST   /api/invoices/:id/finalize-and-collect
POST   /api/invoices/:id/void
POST   /api/invoices/:id/adjustments
POST   /api/invoices/:id/external-payments
POST   /api/payments/:id/refunds

POST   /api/integrations/stripe/webhook
```

Rules:

- Every mutation validates tenant, role, resource authorization, current state, and expected version.
- Financial mutations accept an application idempotency key.
- Approval and execution are distinct commands where segregation of duties is required.
- Return safe domain errors, not raw Stripe errors, to portal users.

---

## 12. State synchronization

Joy state is domain-specific; Stripe state is processor-specific. Maintain an explicit mapping rather than reusing Stripe strings everywhere.

| Stripe observation | Joy effect |
|---|---|
| SetupIntent succeeded and usable method attached | Payment method summary updated; readiness recomputed. |
| Invoice finalized | Joy invoice becomes `open` unless already in a later valid state. |
| Invoice paid | Payment recorded/allocated; invoice becomes `paid`; receipt available; readiness/collections exceptions cleared as appropriate. |
| Payment failed | Invoice remains/open becomes actionable; billing exception created; safe payer notification queued. |
| Payment action required | Invoice/account becomes `needs_attention`; payer gets secure completion action. |
| Invoice voided | Joy invoice becomes `void` only after mapping and authorization checks. |
| Refund succeeded | Refund recorded; allocation/balance recomputed; never delete original payment. |
| Dispute opened | Payment/invoice flagged `disputed`; office exception raised; no automatic clinical/scheduling action unless approved policy says so. |

Webhook processing must not automatically terminate care or remove portal access because payment fails. Any service hold/termination is a separate authorized Joy workflow with legal/clinical safeguards.

---

## 13. Failure and exception handling

Required exceptions:

- payer has no usable method;
- authentication/action required;
- card/bank payment fails;
- duplicate Stripe customer/invoice detected;
- invoice amount differs between Joy and Stripe;
- webhook delayed, duplicated, out of order, or permanently failing;
- rate or payer changes after draft creation;
- schedule changes after invoice approval;
- partial payment, overpayment, refund, dispute, write-off, void/reissue;
- external payer/LTC insurance path;
- multiple clients share one payer;
- one client has split payers;
- portal authorization revoked while an invoice remains open;
- Stripe service unavailable.

Normal work should complete quietly; exceptions appear in Billing “Needs You” with owner, severity, safe explanation, next action, and age.

---

## 14. Implementation sequence

### Phase 0 — Reconcile with existing code

- Inventory current Admissions, Scheduling, Billing, Payroll, portal, identity, audit, and notification models.
- Produce a mapping from existing entities/statuses to this spec.
- Preserve working modules and migrations; do not create duplicate client, payer, invoice, visit, or user models.
- Record unresolved conflicts as architecture decisions.

### Phase 1 — Canonical billing foundation

- Parties, responsible-party authorization, billing accounts, rate versions.
- Joy invoice/line/adjustment/payment ledger.
- Upcoming-week billing run and review/approval.
- Payroll separation from shared verified service facts.
- Full audit log and permission checks.

### Phase 2 — Admission payment readiness and portal shell

- Computed Payment Setup gate.
- Individual authorized portal identities.
- Pre-admission status, next action, invoice/payment privacy filtering.
- Safe Spruce notification outbox.

### Phase 3 — Stripe payment setup

- Environment/configuration and pinned API version.
- Stripe Customer mapping.
- SetupIntent flow and sanitized method summaries.
- Verified, idempotent webhook foundation.

### Phase 4 — Invoice collection and reconciliation

- Convert approved Joy invoices to Stripe invoice/payment flows.
- Automatic and send-invoice collection methods.
- `requires_action`, failure, paid, void, refund, dispute paths.
- Portal invoices, receipts, update method, and pay-now action.
- Reconciliation dashboard and dead-letter handling.

### Phase 5 — Tap to Pay and advanced exceptions

- Stripe Terminal/Tap to Pay feasibility and device/location plan.
- Office-only collection workflow.
- Split payers, external payers, credits, overpayments, and advanced reporting.

---

## 15. Acceptance criteria

### Admissions

- Phone Intake data flows into Assessment without re-entry.
- Portal invitation cannot be sent before the configured human decision point without authorized override.
- Payment readiness is computed and traceable to its component requirements.
- A user can see why a case is not Ready without seeing restricted payment details.

### Billing

- A billing run produces upcoming-week drafts from versioned service/rate facts.
- No Stripe collection occurs before authorized approval.
- Approved invoices cannot be silently edited.
- Billing corrections preserve a complete history.
- Client rate and employee wage remain separate.

### Stripe

- No raw card/bank credentials reach Joy servers or logs.
- Repeated API commands and duplicate events do not duplicate customers, invoices, payments, refunds, notifications, or ledger entries.
- A browser redirect alone cannot mark an invoice paid.
- Signature failures are rejected; test/live events cannot cross environments.
- Failed event processing is observable and recoverable.
- Stripe/Joy totals and statuses reconcile, with mismatches surfaced as exceptions.

### Client portal and privacy

- Two authorized family users can have distinct access; revoking one does not revoke the other.
- Unauthorized users cannot infer whether a client, invoice, or payment method exists.
- Portal invoice lines contain no raw charting, diagnosis, wage, internal note, AI confidence, or staff-only risk flag.
- Only display-safe payment method details are returned.
- Spruce notifications contain no unnecessary sensitive detail.
- Raw caregiver charting is not client-visible by default.

### Payroll

- Payroll uses approved payable time and compensation rules, not client invoice totals.
- A billing adjustment does not silently alter approved payroll, and a payroll correction does not silently alter a finalized client invoice.
- Shared visit corrections trigger explicit downstream review where needed.

---

## 16. Required tests

- Unit tests for readiness computation, rate version selection, invoice totals, state mapping, and permission policies.
- Contract tests against the pinned Stripe API version.
- Stripe CLI/test-clock or equivalent integration tests for success, decline, requires-action, retry, duplicate event, out-of-order event, refund, dispute, and webhook outage.
- Concurrency tests for double-click approval/collection and simultaneous webhook/API updates.
- Authorization tests across tenants, clients, billing accounts, and family grants.
- Snapshot/content tests ensuring protected fields never enter invoice descriptions, metadata, notifications, analytics, or portal payloads.
- End-to-end test: referral → intake → assessment → portal invite → payment setup → readiness → admission → visit → upcoming-week invoice → approval → Stripe payment → receipt → payroll preparation.
- Restore/replay test for webhook receipts and reconciliation jobs.

---

## 17. Observability and operations

Track at minimum:

- payment-setup completion and failure rate;
- draft-to-approved invoice time;
- collection success, failure, requires-action, retry, and aging;
- webhook receipt latency, processing latency, duplicates, dead letters, and signature failures;
- Joy/Stripe reconciliation mismatches;
- refunds, disputes, voids, write-offs, and manual external payments;
- portal authorization failures and suspicious OTP activity;
- billing versus payroll exceptions from shared visit corrections.

Alerts must not contain payment credentials or unnecessary PHI.

---

## 18. Open business decisions

Joy must approve these before production:

1. Exact weekly invoice cutoff, service period, approval time, and charge date.
2. Whether the “upcoming care week” is billed from scheduled, authorized, minimum contracted, or another quantity—and how later visit changes are credited/debited.
3. Allowed collection methods by payer type: automatic card, ACH, send invoice, check, LTC insurance, or other.
4. Required authorization language and evidence for off-session charges and any fallback method.
5. Retry/dunning cadence, grace period, late fees, service-hold workflow, and who may approve exceptions.
6. Refund, credit, void, write-off, dispute, and overpayment authorities.
7. Whether Stripe-hosted invoices/receipts or Joy-rendered versions are the customer-facing legal record.
8. Tap to Pay owner, devices, office locations, receipts, and whether it is Phase 1 or deferred.
9. Split-payer and LTC insurance behavior.
10. Tax treatment, if any, confirmed with qualified advisers.
11. Portal authorization documentation, proxy access, revocation, deceased/incapacitated client handling, and record retention.
12. Whether a payment failure may affect start of care or ongoing service; this must never be an accidental automated consequence.

---

## 19. Definition of done

This feature is done only when:

- the workflow uses existing Joy entities where available;
- established product decisions remain intact;
- new Stripe recommendations approved for the release are recorded as architecture decisions;
- migrations, rollback/forward-fix strategy, permissions, audit logging, reconciliation, alerts, runbooks, and tests exist;
- privacy/security/compliance review is complete;
- sandbox end-to-end scenarios pass;
- a limited live pilot reconciles every payment manually before broader rollout;
- Operations, Admissions, Billing, Payroll, and portal support owners sign off.

---

## 20. First coding instruction

Before writing feature code, inspect the repository and produce:

1. an existing-system map for Admissions, Scheduling, Billing, Payroll, client portal, identity, notifications, and audit logging;
2. a gap table against Sections 4–13;
3. proposed migrations that reuse existing canonical records;
4. a Stripe integration ADR covering API version, Customer ownership, invoice ownership, webhook/event design, idempotency, and PHI minimization;
5. an implementation plan aligned to Section 14.

Do not begin with Stripe UI. Begin with the canonical Joy billing ledger and authorization model, because the portal and Stripe adapter must consume that source of truth.