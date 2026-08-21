# Gap table — Sections 4 to 13

**Deliverable 2 of Section 20.**

Each row: what the spec requires, what exists, and what has to change. Ordered
by section. "Conflict" means the spec and the existing code disagree about
something real, and Section 14 Phase 0 says to record those rather than pick a
side quietly.

Sizes are relative: **S** a day or less, **M** a few days, **L** a week or more.

---

## §4 Operating model

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 4.1 | Eight admission stages | Seven stages; "Decision to Proceed" is a transition, not a stage | Decide whether to add the stage or keep it as a transition. It is already computed and tested (`admissionIsMovingForward`). **Recommend keeping it as a transition** and mapping it in the ADR — a stage nobody dwells in adds a column to every board. | S |
| 4.2 | Nine readiness gates | Six | Add: requested documents, schedule/start-of-care, responsible party & billing contact, rate agreement & cadence, documented exception | M |
| 4.2 | Six gate states | Three (`ready`/`blocked`/`outstanding`) | Widen to the spec's six. `blocked` maps to `needs_attention`, `outstanding` splits into `not_started` / `needs_action` | S |
| 4.2 | Override requires a reason and an audit entry | No override exists | Add override with reason + `recordAudit`. Do not add the override without the audit entry | S |

## §5 Roles and permissions

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 5 | Billing visible to owner/billing/payroll only | Enforced in 0013 and asserted | None | — |
| 5 | Admissions sees readiness, not payment detail | Not enforced; no payment detail exists to leak yet | Add a payment-readiness read that returns state without credentials | S |
| 5 | Scheduler sees account holds only | Not enforced | Add a narrow hold flag readable by scheduler | S |
| 5 | Server-side at resource **and action** level | Resource level only — RLS is per row, not per action | Action-level checks belong in the API layer, which does not exist yet (the app talks to Supabase directly) | M |

## §6 Data model

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 6.1 | `Party` distinct from `Client` | `people` + `relationships.is_responsible_party` exist and are the right shape | Reuse them. **Do not create a new party table** | — |
| 6.1 | `BillingAccount` on the legal payer | **Conflict.** `ClientBillingTerms` and `issued_invoices` are keyed on the client | Introduce `billing_accounts` keyed on payer party; `issued_invoices.billing_account_id` alongside `client_person_id`. This is the change that unlocks split payers and one payer with several clients (§13) | L |
| 6.2 | `BillingAccount` fields incl. `collection_method`, `delivery_preference`, `authorization_*` | None | New table | M |
| 6.2 | Eleven invoice states | Six | Add `pending_approval`, `approved`, `processing`, `disputed`, `uncollectible`. `open` maps to today's `outstanding` | M |
| 6.2 | `source_snapshot_hash` proving what was billed | None | Add. Without it §7.3's immutability is a promise rather than a check | S |
| 6.2 | `approved_by` / `approved_at` / `finalized_at` | `issued_by_user_id` / `issued_on` only | Split issuing from approving | S |
| 6.2 | `PaymentMethodSummary` | None | New table, sanitized fields only | S |
| 6.2 | `StripeEventReceipt` with unique event id | None. `domain_events` is Joy's own outbox and must not be reused for this | New table | M |
| 6.3 | `VerifiedServiceUnit` | **Missing.** Visit and TimeEntry are separate | The keystone. Both ledgers must read one approved fact, or they will drift the first time somebody corrects a visit | L |
| 6.3 | Rate version on every invoice line | No rate versioning | Add `rate_plan_versions` | M |
| 6.3 | Never `employee_wage` on an invoice line | True today by construction — no pay rate exists anywhere | Keep it true when pay rates arrive. Worth a test that fails if a wage field ever appears on `invoice_lines` | S |

## §7 Billing workflow

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 7.1 | Bill the upcoming care week | `buildInvoice` already does | **Settled by Karynn directly, 21 August**: "We bill in advance... In arrears is incorrect." The packet's arrears sentence is a document error on the reprint list, not an ambiguity. The Billing screen now says the packet is wrong rather than that it contradicts itself | Done |
| 7.2 | Billing run with snapshot and exception detection | Invoices computed per week on demand, no run | Add `billing_runs`; detect the seven listed exceptions before drafting | L |
| 7.2 | No Stripe call before approval | No approval step | Gate collection on `approved` | S |
| 7.3 | Approved invoices immutable, corrections via credit/adjustment/void | Write-off only; `issued_invoices` is updatable by billing | Add adjustments and void/reissue; remove the blanket update policy | M |
| 7.4 | Fallback ladder | None | **Needs business approval first** — §7.4 is explicitly a recommendation. Step 6 (record an external payment) is the only rung that works without Stripe and should come first | M |

## §8 Stripe architecture

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 8.1 | No privileged Stripe call from a browser | No server layer exists — the app calls Supabase directly from the client | **Blocking.** Needs Edge Functions or an API. Already recorded in `INTEGRATIONS.md` as "move the session server side" | L |
| 8.2 | Customer created only when setup begins | — | New | S |
| 8.2 | Metadata carries opaque IDs only, never PHI | The audit `redact()` proves the pattern works | Reuse the same idea as an outbound guard: a function that refuses to send an object containing a key on the list | S |
| 8.3 | SetupIntent, Joy never sees credentials | — | New | M |
| 8.4 | Paid only after reconciled Stripe state | — | New. The rule to hold: a browser redirect never marks an invoice paid | M |
| 8.5 | Pinned API version, verified event names | — | Pin in the ADR before any adapter code | S |
| 8.6 | Signature verified against the raw body, idempotent, out-of-order safe | The outbox has the same properties and can be the model | New endpoint; reuse `claim_domain_events`' lessons | M |
| 8.7 | Joy portal primary, short-lived Stripe sessions | — | New | M |
| 8.8 | Tap to Pay office-only | — | Deferred to Phase 5 | — |

## §9 Portal

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 9.1 | Invitation only after the human decision | Built and tested (`canInviteFamily` + `admissionIsMovingForward`) | None | — |
| 9.1 | Own account per user, phone OTP | Built | None | — |
| 9.1 | Grant carries role, allowed actions, effective dates | Grant carries audience and subject only | Widen `portal_grants` | M |
| 9.1 | Secure phone-number change | Not built | New, and it is an account-takeover path — worth its own review | M |
| 9.2 | Five payment-setup states | `paymentSetUp: boolean` | Replace the boolean | S |
| 9.3 | Family billing area | Does not exist; 0013 forbids family reads | New: a read model returning only sanitized fields, plus a policy widening — the widening is the risky half and needs its own SQL assertions | L |
| 9.4 | Minimal non-sensitive notifications | `composeMessage` templates only, no free text anywhere | Add two templates. The existing rule already forbids free-text bodies | S |

## §10 Privacy and security

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 10.4 | Joy stores references and display-safe summaries only | — | Enforced by the model above | S |
| 10.7 | Audit every consequential financial action | Trail exists and is called at seven actions; none financial yet | Add invoice approval, adjustment, void, refund, write-off, external payment, payer change | M |
| 10.8 | Step-up auth and reason codes for refunds/voids/write-offs | Write-off requires a reason; no step-up | Reason codes are cheap and already patterned. Step-up needs the server layer | M |
| 10.10 | Retention schedules | Not defined | Document before production | S |
| 10.12 | Analytics away from payment fields | No analytics in the app at all | Keep it that way, or configure redaction if one arrives | — |

## §11–13 Contracts, sync, exceptions

| § | Requirement | Today | Gap | Size |
| --- | --- | --- | --- | --- |
| 11 | Endpoints, idempotency keys, version checks | No API layer | Follows §8.1 | L |
| 12 | Explicit Stripe→Joy state mapping | — | New; keep it a table, not conditionals scattered through the adapter | M |
| 12 | Payment failure never terminates care automatically | **Already true and deliberate** | Keep. `ageing()` reports that suspension is permitted and never acts | — |
| 13 | Sixteen exception types in a "Needs You" queue | The work-queue pattern exists (`workQueue.ts`, Home signals) | Reuse it. This is a fit, not a new pattern | M |

---

## Conflicts to resolve before Phase 1

1. **Billing account ownership.** Everything financial in this repository is keyed on the client. The spec keys it on the legal payer. This is the single change with the widest blast radius and it should happen before more billing code is written, not after.
2. **No server layer.** §8.1 forbids privileged Stripe calls from a browser and the app currently talks to Supabase directly from the client. Stripe cannot start until this exists.
3. **Advance versus arrears.** Settled by J-05 in Joy's favour; the Billing screen still shows the packet's contradiction and should now show the resolution.
4. **Invoice mutability.** 0013 lets billing update an issued invoice. §7.3 forbids it after approval. The policy should narrow when the approval step lands, not before, or invoices become uncorrectable in the meantime.
