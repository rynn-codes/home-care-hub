# Existing system map

**Deliverable 1 of Section 20** of the Admissions / Billing / Payroll / Portal /
Stripe coding specification, v1.0.

Written before any feature code, as Section 20 requires. It records what is
already in this repository so the Stripe work reuses canonical records instead
of creating a second client, payer, invoice, visit or user model.

Everything below was read out of the code, not remembered. Where a module is
partially built the entry says which half exists.

---

## Admissions

| Concern | Where | State |
| --- | --- | --- |
| Lifecycle stages | `src/domain/admissions/stages.ts` | Built. `new_referral → phone_intake → assessment → pre_onboarding → ready_for_admission → admitted`, plus `closed`. Matches §4.1 with one naming difference: the spec's "Decision to Proceed" is not a stage here; it is the transition into `pre_onboarding`, tested as `admissionIsMovingForward` in `classify.ts`. |
| Readiness gates | `src/domain/admissions/readiness.ts` | Built, six gates: `intake`, `assessment`, `consents`, `signature`, `care_plan`, `payment`. §4.2 asks for nine. Missing: requested documents, schedule/start-of-care plan, responsible party & billing contact, rate agreement & cadence, documented exception. |
| Gate states | same | `ready` / `blocked` / `outstanding`. §4.2 asks for six (`not_started`, `needs_action`, `in_review`, `ready`, `complete`, `needs_attention`). |
| Computed vs selected | same | `ready_for_admission` is computed from gates. Matches §4.2. No override path exists at all — neither a good one nor a bad one. |
| Phone intake | `src/domain/admissions/intake.ts` | Built and reconciled against Joy's paper form, 18 Aug. Payment source is captured (`PAYMENT_SOURCES`). |
| Enter once, reuse | `questions.ts` `fromIntake`, `admissionProgressSeed.ts` | Built. Assessment inherits intake answers. Matches J-08. |

## Scheduling and visits

| Concern | Where | State |
| --- | --- | --- |
| Visit | `src/domain/scheduling/conflicts.ts`, table `visits` (0007) | Built. Carries client, caregiver (nullable = open shift), service, window, `eventType`, `billableOverride`. |
| Clock | `src/domain/portal/visit.ts`, table `time_entries` (0007) | Built. Clock in/out, §11 completion check, exception reason. |
| Charting | `src/domain/portal/charting.ts`, tables in 0008 | Built. Confirmed charts immutable by trigger. |
| **Verified service unit** | — | **Missing.** §6.3's central record does not exist. Visit and TimeEntry are separate, and neither carries "approved payable time" or "approved billable quantity" as distinct approved facts. This is the most load-bearing gap in the spec. |

## Billing

| Concern | Where | State |
| --- | --- | --- |
| Rate | `src/domain/billing/accounts.ts`, `rate_plan_versions` (0014) | **Built.** Versioned, no-overlap enforced, rewrites refused. `ClientBillingTerms` still exists and still works; the migration off it is incremental rather than a flag day. |
| Billing account | `src/domain/billing/accounts.ts`, `billing_accounts` (0014) | **Built.** Keyed on the payer, one payer able to pay for several clients, authority to charge recorded separately from the payment method. |
| Invoice calculation | `buildInvoice` | Built and good: splits standard/holiday/overtime, applies deposit and convenience fee, refuses to bill a client with no rate rather than sending a zero. |
| Weekly, in advance | `buildInvoice` | Built. **Resolves a contradiction previously flagged**: the signed packet says both "invoice every week in advance" and "due to billing in arrears". J-05 settles it — Joy invoices the upcoming care week. |
| Ageing / late fee / suspension | `ageing()` | Built. `suspensionPermitted` reports that the agreement allows suspension and never acts. Matches §12's rule that payment failure must not automatically terminate care. |
| Reconciliation | `reconcile()` | Built for the advance-billing case: compares invoiced hours against worked hours and says who owes whom. |
| Issued invoice + payments | `src/domain/billing/receivables.ts`, tables `issued_invoices`, `payments` (0013) | Built two days ago. Issue, part payment, overpayment as credit, write-off with a reason, ageing buckets, balance as a function not a column. |
| Invoice states | `receivables.ts` | Six: `paid`, `part_paid`, `outstanding`, `overdue`, `written_off`, `overpaid`. §6.2 wants eleven, including `pending_approval`, `approved`, `processing`, `disputed`, `uncollectible`. |
| Approval step | — | **Missing.** 0013 has `issued_on` and `issued_by_user_id` but no draft → pending_approval → approved transition, and no `source_snapshot_hash`. §7.2 step 6 and §7.3 both need it. |
| Adjustments / credit notes | — | **Missing.** Write-off exists; adjustment and void/reissue do not. |

## Payroll

| Concern | Where | State |
| --- | --- | --- |
| Hours | `src/domain/payroll/hours.ts` | Built. Overtime per workweek from a Monday start, exceptions, `payrollRun`. |
| Separation from billing | same | **Already correct and deliberate.** Joy produces hours; Gusto produces wages. No pay rate exists anywhere in this repository, so §3.1.6 and §6.3's "never place `employee_wage` on a client invoice line" hold by construction today. |
| Approval | — | **Missing.** `payrollRun` reports `ready` / `blockedBy`; nothing records an approval or exports. |

## Client and family portal

| Concern | Where | State |
| --- | --- | --- |
| Identity | `portal_grants` (0006), `src/domain/portal/identity.ts` | Built. Per-person grants, `audience` (workforce/family), `subject_person_id`, `state`, `active`. Matches J-11 and §9.1's "never share a family login". |
| Phone OTP | `src/domain/portal/otp.ts`, `OtpService` port | Built, with the rule that an unknown number gets the same words, screen and rate-limit quota as a known one. |
| Revocation | 0009 | Built, attributable: who revoked, when, why. |
| **Per-action permissions** | — | **Partial.** A grant carries an audience, not a role, an allowed-action list, or effective dates. §9.1 wants all four. |
| Family view filtering | `src/domain/portal/familyPortal.ts` | Built. A projection carrying exactly six fields, with a test asserting the list, because passing the office's visit through is how an internal field reaches a family's phone. Matches J-04. |
| Charting hidden from family | 0008 policies | Built. A family reads no chart at all. Matches J-11. |
| **Billing area** | — | **Missing entirely.** §9.3 does not exist. 0013 deliberately restricts invoices and payments to owner/billing/payroll, so a family currently cannot see a balance. |
| **Payment setup gate** | — | **Missing.** `checkAdmission` takes `paymentSetUp: boolean`. §9.2's five states do not exist. |

## Identity, notifications, audit

| Concern | Where | State |
| --- | --- | --- |
| Users and roles | `users` (0001), `user_role` enum | Built: nine roles matching §5's list. |
| RN licence | `users.rn_licence_*` (0011) | Built. A licence, not a job title — the owner is also the nurse. |
| Row level security | 0003 and every migration since | Built and tested: 209 assertions across ten suites, all under `set local role authenticated`. |
| Outbox | `domain_events` (0002, 0012), `src/domain/events/` | Built including atomic claim, backoff and abandonment. **No scheduled runner.** |
| Communications | `communication_events` (0002), `SmsRouter` | Built. Spruce/GHL routing by purpose, every row Karynn's decision. Matches J-10's "Spruce is the notification channel". |
| Audit trail | `audit_entries` (0002, 0012), `src/domain/audit/audit.ts`, `src/lib/demoAudit.ts` | Built and **now called** at seven consequential actions. Append-only at the grant; a session can only write in its own name. Entries live in the browser until migrations are applied. |
| Audit readiness | `src/domain/audit/surveyReadiness.ts`, `/operations/audit` | Built. Answers "show me your files" and names what it does not cover. |

## What is already true that the spec asks for

Worth stating so nobody rebuilds it:

- Joy is the source of truth and no external service defines workflow state (§3.1.1) — the ports pattern throughout, documented in `INTEGRATIONS.md`.
- AI drafts, a human approves (§3.1.3) — `requiresOfficeReview` on Moments, chart citation checks.
- Caregivers cannot see balances (§3.1.8) — enforced in 0013's policies and asserted in `receivables_test.sql`.
- Internal notes never reach the family (§3.1.9) — `familyPortal.ts` is a projection with an asserted field list.
- Payment failure never automatically stops care (§12) — `suspensionPermitted` reports and does not act.
- Redaction before storage (§10.3) — `redact()` in the audit writer, with a key list including `signature` and `ssn`.

---

## Companion documents

- `GAP_TABLE.md` — Sections 4–13, what is missing and how big
- `PROPOSED_MIGRATIONS.md` — 0014 to 0018, what each reuses
- `OPEN_DECISIONS.md` — Section 18, with the four that block the first invoice
- `IMPLEMENTATION_PLAN.md` — Section 14 phases and what blocks what
- `../DECISIONS/0002-stripe-integration.md` — the Stripe ADR
