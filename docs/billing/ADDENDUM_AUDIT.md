# Addendum audit — Billing, Invoicing & Stripe

Karynn asked, 22 August: "Review this MD file and ensure that everything in
here was built out." The addendum is vendored at
`docs/specs/Joy_Health_Billing_Invoicing_Stripe_Addendum.md`. This is the
section-by-section answer. **Built** means code, schema and tests exist;
**Server-layer** means Joy's side is ready and the remaining work is the §8.1
Stripe server the developer wires; **Partial** says exactly what is missing.

| § | Requirement | Status | Where |
| --- | --- | --- | --- |
| 1 | Joy is the system of record; Stripe processes; no raw credentials; FreshBooks removed | **Built** | ADR 0002; no FreshBooks dependency exists anywhere in the code (the only mentions are historical notes); no column anywhere can hold a card number — `payment_method_summaries.last_four` refuses a fifth digit by constraint |
| 2 | Five payment-setup states; readiness stays in Admissions; pricing shown before the card | **Built** | `paymentSetup.ts` (the five states, spec strings); `careCost.ts` — `careCostPreview` computes YOUR CARE COST from approved data only, `paymentMethodRequestGate` refuses the card request until pricing is reviewed; `pricing_reviewed_at` on the client-account link (0020) |
| 3 | Payment authorization as a record with history | **Built** | `payment_authorizations` (0020): who, mode, wording version, Stripe refs, attributed revocation, one active per account, settled rows immutable by trigger; domain mirror in `paymentAuthorization.ts`. Karynn's own form is the wording (22 Aug) |
| 4 | Both modes; AutoPay never charges without a reviewable finalized invoice | **Built** | `PaymentMode` maps onto 0014's `collection_method` (one pair, two vocabularies — documented); `autopayCollectionRefusals` refuses an unfinalized or unshown invoice, a revoked authorization, a wrong-mode authorization, an unusable method |
| 5 | Explicit, auditable preference | **Built** | Preference = `collection_method` (existing); `payment_preference.changed` audit entry + builder; the addendum's client-facing copy is `PAYMENT_MODE_BLURBS`, verbatim |
| 6 | Joy creates the invoice; payroll/billing separate; pay rate ≠ bill rate | **Built** (pre-existing) | Verified units (0015) with two approved figures and two views that cannot reach each other's columns; invoices built from verified data (0016) |
| 7 | Itemized invoice with a human number | **Built** | `invoice_number` "JH-…" (0020), unique per org, sequence-assigned; lines already carry description/qty/rate/amount and support mileage via `unit_label`; no payroll column exists to leak |
| 8 | Portal billing area | **Built** (prototype fidelity) | `FamilyBillingCard` on the family portal: balance, open invoices by number, preference in the addendum's copy, method summary, history; renders only under a grant with `view_invoices`; the Pay button initiates and says so — it never fakes success |
| 9 | Adapter boundary; refs not identity; display-safe metadata | **Built** | `processor.ts` — `PaymentProcessorPort` + `MemoryPaymentProcessor` (answers "processing", never "succeeded"); `stripe_customers` / `payment_method_summaries` (0021); Joy ids stay uuids; family view carries no Stripe column at all |
| 10 | Pay Invoice flow; redirect is not proof | **Server-layer** | Joy's side built: the port, the receipts table, `reconcileEvent` (state changes only from verified events), audit entries citing the processor event id. The Stripe calls themselves are the §8.1 server |
| 11 | AutoPay flow; no silent unauthorized collection | **Built** (gate) / **Server-layer** (charge) | `autopayCollectionRefusals` is the gate the server must ask; a refusal surfaces as needs-attention, never a silent skip or charge |
| 12 | Webhooks: signatures, idempotency, receipts, retries, audit | **Built** (schema+rules) / **Server-layer** (handler) | `stripe_event_receipts` (0021): idempotency is a unique index; statuses, attempts, last_error; receipts written only by the service role — no person can say what Stripe said. Signature verification lives in the webhook handler the developer writes. Event names verified against current Stripe docs at wiring time, per the addendum's own instruction |
| 13 | Failure surfaces, sanitized | **Built** | `paymentFailureCards`: client card with the two actions and no diagnostics; admin line into Needs You |
| 14 | Relationship-based billing permissions | **Built** | Grant vocabulary widened (0020) with `manage_autopay`, `view_payment_history`; family reads are definer views with the excluded columns absent; enforcement is server-side (RLS + views), tested in `widened_grants_test.sql` and `stripe_addendum_test.sql` |
| 15 | Audit vocabulary | **Built** | All thirteen §15 actions exist in `AUDITED_ACTIONS` with phrases and typed builders; mapping documented where the addendum renames an existing act (finalized≈approved, sent≈issued) |
| 16 | Admissions shows readiness only | **Built** (gates) / **Partial** (panel) | The nine gates and the five payment states are the readiness display; the fuller §16 panel (contact/pricing/preference/method/authorization rows) lands when accounts are live data rather than seeds — showing seed data for a prospective client would fabricate a record |
| 17 | Changed verified visit triggers review, not rewrite | **Built** (pre-existing) | Supersede-only verified units; `carryForwardFrom` turns the difference into next week's lines; payroll re-reads the live unit |
| 18 | Spruce notifies, portal is truth | **Built** | `payment_received` joins the templates; all three addendum examples exist, none carries an amount or a reason |
| 19 | V1 screens | **Mostly built** | Admin: the Saturday run card on the Billing page walks §7.2 on screen — exceptions first, drafts second, approval with a name that lands on the trail and survives a reload; plus invoice list, outstanding, record-payment. Client: billing summary/open invoices/preference/history built; method setup and live payment need Stripe Elements (server-layer) |
| 20 | Acceptance criteria | 11 of 14 **met** | 1–3, 5, 6, 10–14 met; 4 met to the initiation boundary; 7–8 are the Stripe server; 9 met |
| 21 | The locked rule | **Built** | Joy creates (0016), the client sees (`family_invoices`, the portal card, `invoice.viewed`), Stripe processes (the port). Neither mode can charge an unexplained amount: every line is its own arithmetic, by constraint |

## What remains, named

1. **The §8.1 server layer** — the only place Stripe API calls, webhook
   signature verification, and Elements mount. Everything it needs on Joy's
   side exists: the port to implement, the tables to land in, the gate to ask,
   the reconciler to call, the audit builders to invoke.
2. **The §16 payment-setup panel** — waits on billing accounts becoming live
   data for prospective clients; building it on seeds would fabricate records.
