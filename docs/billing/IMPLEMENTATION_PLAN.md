# Implementation plan

**Deliverable 5 of Section 20**, aligned to Section 14.

Section 20's closing instruction: *do not begin with Stripe UI; begin with the
canonical Joy billing ledger and authorization model, because the portal and
Stripe adapter must consume that source of truth.* The order below follows it.

---

## Phase 0 — Reconcile (this document set)

**Done.** `EXISTING_SYSTEM_MAP.md`, `GAP_TABLE.md`, `PROPOSED_MIGRATIONS.md`,
`docs/DECISIONS/0002-stripe-integration.md`, and this plan.

Four conflicts recorded rather than quietly resolved: billing keyed on client
versus payer; no server layer; advance-versus-arrears (settled by J-05 in Joy's
favour); and invoice mutability.

## Phase 1 — Canonical billing foundation

No Stripe. No portal. The ledger and the authorisation model.

1. ~~`0014` billing accounts, the client join, rate plan versions.~~ **Done.**
   Accounts keyed on the payer, one payer able to pay for several clients, rates
   versioned with a no-overlap exclusion constraint and a trigger refusing
   rewrites. `buildInvoice` accepts a rate version and records which one priced
   the invoice. `ClientBillingTerms` still exists and still works — the migration
   off it is incremental rather than a flag day, because every screen reading it
   would otherwise have to move at once.
2. ~~`0015` verified service units. Wire `payrollRun` and `buildInvoice` to read
   one approved fact each.~~ **Done.** One record per visit carrying two approved
   figures — payable and billable — neither set without a name and a time
   against it, and the record not editable once verified. Two views, each
   carrying only its own ledger's column, so a payroll query cannot reach a
   billing fact by accident. `payrollRun` and `buildInvoice` both take the units
   as optional input: absent, they behave exactly as before; present, the
   approved figure wins and a visit still under review blocks rather than being
   guessed at.

   Three things changed under this that were not in the plan, each because
   writing it made them visible:

   - `superseded_by` is a **deferred** foreign key. A correction writes two rows
     and there is no order that works without it — the correction cannot be
     inserted while the original is live, and the original cannot be marked
     superseded before the correction exists. Recording a correction was
     impossible as first written.
   - The unit carries `served_on`. Payroll places hours in a workweek, which is
     where overtime is decided; without a date, a visit nobody clocked landed in
     whichever week somebody reviewed it.
   - `verifyRefusals` no longer refuses an unclocked visit outright, it requires
     a reason. The flat refusal left Karynn's own case — the caregiver worked and
     the app recorded nothing — permanently blocking payroll with nowhere to
     record the decision that would unblock it.
3. `0016` invoice approval, lines, adjustments, immutability trigger.
4. Billing runs: generate the upcoming week's drafts from a snapshot, detect the
   seven §7.2 exceptions before drafting.
5. Audit the financial actions — approval, adjustment, void, write-off, external
   payment, payer change. The writer is already called at seven non-financial
   actions; this extends the same path.
6. Record an external payment (§7.4 rung 6). It is the only rung that works
   without Stripe, and it means Joy can take a cheque before any of this is
   connected.

**Done when:** a week's invoices can be drafted, reviewed, approved, and
corrected only by adjustment; payroll and billing read the same verified unit
and neither infers the other; every financial act is on the trail.

## Phase 2 — Payment readiness and the portal shell

7. Replace `paymentSetUp: boolean` with §9.2's five states; add the four missing
   readiness gates and the six gate states; add the authorised override with a
   reason and an audit entry.
8. `0018` widened grants — role, allowed actions, effective dates.
9. The family finance read model: sanitized fields only, with the SQL assertions
   written **before** the policy is widened.
10. Two notification templates. No free-text SMS body exists anywhere in Joy and
    none is added.

**Done when:** two authorised family members have distinct access, revoking one
does not revoke the other, and an unauthorised user cannot infer whether a
client or an invoice exists.

## Phase 3 — Stripe foundation

**Blocked on the server layer.** §8.1 forbids privileged Stripe calls from a
browser and the app currently talks to Supabase directly from the client. This
is the gating item; it is already in `INTEGRATIONS.md` as "move the session
server side".

11. Pin the API version; contract test asserting the pin.
12. `0017` customers, payment method summaries, event receipts.
13. SetupIntent flow. Joy never receives credentials.
14. Webhook endpoint: signature against the raw body, durable receipt, async
    processing, unique event id, dead letters.
15. The PHI outbound guard — a function every Stripe payload passes through that
    throws on a forbidden key, not a comment asking people to be careful.

## Phase 4 — Collection and reconciliation

16. Approved Joy invoice → Stripe invoice, both collection methods.
17. `requires_action`, failure, paid, void, refund, dispute — each mapped
    through §12's table, kept as a table rather than conditionals in the adapter.
18. Portal: invoices, receipts, update method, pay now.
19. Reconciliation view and dead-letter handling.

**Done when:** duplicate events do not duplicate anything; a browser redirect
alone cannot mark an invoice paid; Joy and Stripe totals reconcile and
mismatches surface as exceptions.

## Phase 5 — Tap to Pay and advanced exceptions

Deferred. Office-only, never a caregiver workflow (J-06). Split payers, external
payers, credits, overpayments.

---

## What blocks what

- **Everything Stripe** blocks on the server layer.
- **Phase 2's family finance area** blocks on Phase 1's invoices existing.
- **The first real invoice** blocks on four of Karynn's twelve open decisions —
  the weekly cutoff and charge date, the quantity the upcoming week is billed
  from, the authorisation language for off-session charges, and the retry
  cadence. See `OPEN_DECISIONS.md`.
- **Nothing** blocks Phase 1 step 6, recording an external payment. Joy can take
  a cheque and have it on the ledger before any of this is connected.

## What I would not do

Build the Stripe adapter first because it is the interesting part. The spec says
so in Section 20 and it is right: the portal and the adapter both consume the
ledger, and a ledger shaped around what Stripe returns is a ledger that cannot
answer a question Stripe does not.
