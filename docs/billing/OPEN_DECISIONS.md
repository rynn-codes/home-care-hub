# Open business decisions — Section 18

Section 18 lists twelve decisions Joy must approve before production. Several
are already answered by things Karynn has said; those are marked and the answer
recorded, so nobody asks twice.

**Four of these block the first real invoice.** They are marked BLOCKING.

---

### 1. Weekly invoice cutoff, service period, approval time, charge date — ANSWERED

**Direction answered.** Karynn, 21 August: "We bill in advance. Make sure that is
noted. In arrears is incorrect." J-05 says the same. The packet's arrears
sentence is a known error and is on the reprint list.

What is still open is the calendar, not the direction: which day the run
generates, how long the office has to approve, and when the card is charged.

Joy's workweek already starts Monday (payroll computes overtime from it, and
Gusto's setting must match). The packet says payment is due within one calendar
day of the invoice and a $100 late fee applies after the third day, which
constrains this but does not decide it.

**Answered.** Karynn, 22 August: "It would need to be Saturday AM you can draft
bc our billing ends of Friday. If we ever do get a 24/7 case, the billing would
end on Friday 11:59 PM. Everything should be prepped to go out. I can approve
anytime from Sat–Mon and then it goes out."

So the billing week is **Saturday through Friday** — the same seven days as the
Gusto payroll week — the run drafts Saturday morning, approval runs Saturday to
Monday, and the invoice or charge goes out on approval. Held in
`BILLING_CALENDAR` (domain/billing/run.ts).

### 2. What quantity the upcoming week is billed from — ANSWERED

**Answered.** Karynn, 22 August: "What I usually have on the invoice is what is
on the service agreement (12 hours/week), the week we bill for. If there is any
OT from the previous week. Any additional hours that were added but not billed.
Any credits from the previous week."

So the base quantity is the **service agreement's weekly hours**, and last
week's differences travel as their own lines: carried hours, carried overtime
at time and a half, and credits as visible negative lines. Built:
`buildInvoice`'s advance mode and `carryForwardFrom`; the agreed hours live on
the client-account link (`agreed_weekly_hours`, 0019).

This matters more than it sounds because Joy bills in advance. `reconcile()`
already exists for the case where a family paid on Monday for a week that then
had a visit cancelled; it needs to know what the invoice was built from before
it can say who owes whom.

### 3. Allowed collection methods by payer type — ANSWERED

Karynn, 21 August: *"We are all private pay. We allow long term care insurance,
but only for them to reimburse the client once they have paid us."*

So: card, debit and ACH, per the packet. No insurer is ever billed. The
`external_payer` collection method in §6.2 is not used, and the LTC path in §13
is a documentation question — what a client needs from Joy to submit a claim —
rather than a billing one.

*Still open, smaller:* whether Joy produces a reimbursement pack for those
clients, and what is in it.

### 4. Authorisation language and evidence for off-session charges — BLOCKING

Not answered, and this is the one with legal weight. Charging a saved card
without the payer present requires recorded authority, and the packet's payment
page may or may not already be it.

*Needed:* whether the existing signed agreement covers off-session charging, or
whether a separate authorisation is required. This is a question for the same
legal review as the one-signature-reuse item already on Karynn's list.

### 5. Retry cadence, grace period, late fees, service hold — BLOCKING (partly answered)

The packet gives the fees: $100 after the third day of an outstanding invoice, a
fee on anything not paid in full within two business days.

The packet also says services *may* be suspended within 24 hours of
non-payment — *may*, not must — and Karynn has said cancelling for non-payment
is real and does happen. Joy already treats this as advisory: `ageing()` reports
that suspension is permitted and never acts.

*Needed:* the retry cadence, and who approves a hold. The retry cadence is
blocking; the hold policy is not, because Joy will not automate it either way.

### 6. Refund, credit, void, write-off, dispute, overpayment authority — PARTLY ANSWERED

§5 gives the owner refund/void/write-off authority per policy. Joy's model
already requires a reason on a write-off and keeps the row visible.

*Needed:* whether billing staff may write off, or only the owner; and any
threshold above which the owner must approve.

### 7. Whether Stripe-hosted or Joy-rendered invoices are the legal record

Not answered. Affects which one carries the invoice number and what a family is
sent.

*Recommendation:* Joy-rendered, because Joy owns the numbering and the ledger
(ADR 0002, decision 3), with Stripe's hosted page used only as a payment action.

### 8. Tap to Pay — owner, devices, locations, phase

Not answered. §8.8 and J-06 both say office-only, never a caregiver. Currently
deferred to Phase 5.

*Recommendation:* defer. Every client is private pay and invoiced weekly; a card
reader solves a problem Joy may not have.

### 9. Split payers and LTC insurance behaviour — ANSWERED

LTC is answered (see 3). Split payers: Karynn, 22 August — **"Yes, it
happens."** Built in 0019: `share_percent` on the client-account link, shares
never exceeding 100 (deferred trigger), the run refusing to draft while they
total less, and one invoice per payer per week, each for their share of the
agreement and of any carried lines.

### 10. Tax treatment

Not answered. `buildInvoice` has no tax line. *Needed:* confirmation from a
qualified adviser that none is required, or what is.

### 11. Portal authorisation documentation, proxy access, revocation, deceased or incapacitated clients

Partly built rather than decided: grants are per person, revocation is
attributable, and the packet's disclosure list already names who Joy may discuss
care with.

*Needed:* what happens to a portal grant and an outstanding balance when a
client dies. The seeded roster has a discharged client who transitioned to
hospice, so this is not hypothetical.

### 12. Whether payment failure may affect start of care — ANSWERED IN PRINCIPLE

§12 and §18.12 both say this must never be an accidental automated consequence,
and Joy is already built that way.

*Needed:* whether payment readiness blocks *start of care* specifically. §3.1.7
says it does unless an authorised user records an exception, and the readiness
gate already exists — so this is a confirmation, not a design question.

---

## Summary

| # | Decision | Status |
| --- | --- | --- |
| 1 | Weekly cutoff and charge date | Answered — Sat–Fri week, draft Sat AM, approve Sat–Mon |
| 2 | Quantity billed for the upcoming week | Answered — agreement hours + carry-forward |
| 3 | Collection methods | Answered — all private pay |
| 4 | Off-session authorisation | **Blocking**, legal |
| 5 | Retry cadence | **Blocking** (fees and hold policy answered) |
| 6 | Refund and write-off authority | Partly answered |
| 7 | Legal record of the invoice | Recommendation made |
| 8 | Tap to Pay | Recommend deferring |
| 9 | Split payers | Needs a yes or no |
| 10 | Tax | Needs an adviser |
| 11 | Deceased or incapacitated client | Needs a decision |
| 12 | Payment failure and start of care | Answered in principle |
