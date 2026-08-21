# 0002 — Stripe integration

**Status:** Proposed. Sections marked OPEN need Karynn's approval before the
behaviour is enabled in production.
**Date:** 21 August 2026
**Deliverable 4 of Section 20** of the Admissions / Billing / Payroll / Portal /
Stripe coding specification, v1.0.

---

## Context

Joy needs to collect money from families. Every client is private pay — Karynn,
21 August — so there is no payer to chase and no remittance advice arriving on
its own. Long-term care insurance reimburses the client after the client has
paid Joy; Joy is not a party to that claim and never bills an insurer.

The specification names Stripe. This ADR records the decisions that turn that
into an implementation, and separates what has been approved from what is being
recommended.

## Decision 1 — API version is pinned, in one place

Stripe ships breaking changes behind versioned APIs, and §2.2 requires the
version to be pinned and the event names revalidated against it.

The version lives in one constant, is sent on every request, and is asserted by
a contract test that fails if the two drift. An adapter that inherits the
account's default version silently changes behaviour on a date nobody chose.

**OPEN:** the version itself, chosen at implementation time against Stripe's
then-current documentation, not guessed here.

## Decision 2 — One Stripe Customer per billing account, not per client

§3.2.4 says one Customer per legal payer. The consequence for this repository is
larger than it looks: everything financial here is currently keyed on the
client, and a payer with two clients — a daughter paying for both parents — has
no representation at all.

So `billing_accounts` is introduced, keyed on a payer party, and the Stripe
Customer maps to it. `people` and `relationships.is_responsible_party` already
exist and are the right shape; no new party table is created.

The failure this prevents: two Stripe Customers for one person, two saved cards,
two dunning sequences, and a family who cannot understand why they were charged
twice for what they think of as one arrangement.

## Decision 3 — Joy owns the invoice; Stripe collects it

The canonical invoice, its number, its lines and its ledger live in Joy. Stripe
is given an already-approved invoice to collect.

This is the same rule the rest of Joy follows — §3.1.1, and the reason every
integration here is a port. It has one specific consequence worth stating:
**a Joy invoice is never marked paid because an API call returned successfully.**
It is marked paid when authoritative Stripe state is reconciled, normally
`invoice.paid` plus re-fetching the object. A browser redirect is not evidence
of anything; the customer's browser is not a trusted party.

## Decision 4 — No Stripe Subscriptions in V1

§3.2.5. Home care hours vary week to week. Subscriptions model a fixed recurring
charge and would need cancelling and re-creating whenever hours changed, which is
every week for some clients. Each week's invoice is generated from approved Joy
service data instead.

Revisit only if Joy ever sells something genuinely fixed.

## Decision 5 — Webhooks are the source of asynchronous truth, and are treated as hostile

Verified against the raw body before parsing. Durable receipt first, business
effects asynchronously. Unique index on the Stripe event id. Duplicate, delayed
and out-of-order delivery are all assumed. Re-fetch the object when current
state matters rather than replaying an old snapshot over newer state.

Joy already has this pattern working in `domain_events` — atomic claim with
`for update skip locked`, attempts counted at claim time, abandonment as a real
outcome. `stripe_event_receipts` is a **separate** table: the outbox is Joy's
own work queue and mixing an external processor's events into it would mean one
retry policy governing two very different failure modes.

## Decision 6 — PHI never reaches Stripe

§10.3. No diagnosis, care need, chart narrative, family circumstance or internal
note in metadata, descriptions, statement descriptors or logs. Metadata carries
opaque Joy ids and an environment marker.

This is enforced rather than documented. Joy already has `redact()` in the audit
writer with a key list; the outbound guard is the same idea inverted — a
function every Stripe payload passes through that **throws** if it finds a key
on the list. A comment saying "do not put PHI here" survives until the first
sprint where somebody needs to debug a payment.

Invoice line descriptions are the likeliest leak: "Personal care, 12 hrs" is
fine; anything derived from a care plan task list is not.

## Decision 7 — The Joy portal is the payment experience

§8.7. Families use Joy, and Joy creates short-lived Stripe sessions for narrowly
scoped actions — add a method, pay this invoice. Not a generic Stripe portal
with controls Joy does not sell.

Phone OTP stays the way in. §9.1 calls it the established preferred login and it
is already built, rate-limited, and written so an unknown number gets the same
words and the same consumed quota as a known one. A password would be a second
authentication system with its own recovery path, which is a second place to get
account takeover wrong.

**Recommendation:** treat the finance area as a permission on the existing
grant, not a separate login.

## Decision 8 — Idempotency at both ends

Every financial mutation accepts an application idempotency key and passes a
stable server-side key to Stripe. Joy already has the pattern in
`domain_events.idempotency_key` with a unique index, and the reason is the same:
this is the code path that exists to survive a double-clicked button.

## Decision 9 — Payment failure never stops care by itself

§12. The signed agreement permits suspending services within 24 hours of
non-payment — *may*, not must — and `ageing()` already reports that the option
exists and never acts on it. Webhook processing does not change scheduling,
revoke portal access or cancel visits.

Suspending care is a person deciding that somebody's mother does not get her
caregiver tomorrow. It deserves a human, a phone call, and probably a
conversation about why the payment failed.

## Consequences

- A server layer is now a prerequisite, not a nice-to-have: §8.1 forbids
  privileged Stripe calls from a browser and the app currently talks to Supabase
  directly from the client. This is the gating item for the whole Stripe phase.
- `billing_accounts` reshapes existing billing code. Better before more of it is
  written than after.
- `issued_invoices` gains an approval step and loses its blanket update policy.
- The audit trail gains seven financial actions.

## What this ADR does not decide

Section 18's twelve business decisions, all of which are Karynn's. Four of them
block the very first invoice: the weekly cutoff and charge date, what quantity
the upcoming week is billed from, the authorisation language for off-session
charges, and the retry cadence. They are listed in
`docs/billing/OPEN_DECISIONS.md`.
