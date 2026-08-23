# Developer hand-off — wiring Joy Health

You are connecting a finished prototype to real infrastructure. The design
decisions are made, recorded, and tested — **1,052 unit tests, 300 SQL
assertions, 81 browser tests**, all green on the day this was written. Your
job is wiring, and this document is the order to do it in, the seams to wire
at, and the traps that are already known.

Read `docs/IMPLEMENTATION_STATUS.md` alongside this — it is the running state
of the whole build. `docs/PARALLEL_WORKSTREAMS.md` holds the working
agreement and frozen files if more than one person works at once.

---

## The shape of the codebase

```
src/domain/           pure business logic — no I/O, no React, no Supabase.
                      Everything here is unit-tested and takes data as input.
src/infrastructure/   adapters that implement domain ports against real
                      services (Supabase stores exist; more to come — yours).
src/lib/              seeds (ALL CLIENT DATA IS FICTIONAL — see below),
                      demo state, audit wiring.
src/pages,components  the screens. They read seeds today; they will read
                      Supabase through the same domain functions.
supabase/migrations/  0001–0021, applied IN ORDER on a fresh database.
supabase/tests/       fifteen SQL suites. Run them; they are the security
                      model's proof.
docs/specs/           every spec and form the client supplied, vendored.
docs/DECISIONS/       ADRs. 0002 is the Stripe architecture.
```

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run test:e2e`,
`npm run build` (build runs the typecheck — "the build passes" means it).

---

## Non-negotiable rules you inherit

1. **Real client names never enter this repository.** Clients in seeds are
   fictional people; staff names may be real. Uploaded documents containing
   real PHI are never committed. The four business contacts in
   `peopleSeed.ts` are a recorded exception.
2. **Nothing collects money on an unapproved invoice** (§7.2 step 7 —
   enforced in the database, keep it that way).
3. **Payment state changes only from verified processor events.** A browser
   redirect is not proof of payment. `stripe_event_receipts` + `reconcileEvent`
   are the only path.
4. **No automated consequence for payment failure touches care.** The system
   surfaces; a person decides. Same for hiring decisions and suspensions.
5. **A record somebody acted on is not editable** — supersede, adjust, or
   revoke, attributably. The triggers enforce this; do not work around them.
6. **Caregivers never see rates, balances, or billing** (J-06). The views and
   policies enforce it; new features must too.

---

## Wiring order

### 1. Apply the migrations (first domino — nothing else matters until this)

```sh
# 0001 through 0021, in order, against the Supabase project.
# supabase/tests/local_shim.sql is for LOCAL verification only —
# never run it against the project.
```

Then regenerate `src/integrations/supabase/types.ts` and run the SQL suites
against a branch database if you can. Every suite runs its assertions as the
`authenticated` role — run them as `postgres` and they prove nothing (RLS is
bypassed for the table owner).

### 2. Screens onto live data

Replace seed imports with Supabase queries feeding the SAME domain functions.
The domain layer does not change — `planBillingRun`, `payrollRun`,
`admissionReadiness` etc. all take plain data. Start with Clients and
Employees (one `people` row each — do not create parallel person records),
then Scheduling, then Billing.

### 3. The outbox runner

`processDue` (domain/events) + the Postgres store + the atomic claim function
all exist and are tested. Schedule it (pg_cron or an edge function on a
timer). Without this, `domain_events` silently accumulates as `pending`.

### 4. The Stripe server layer (§8.1 — the one place Stripe API calls live)

Implement `PaymentProcessorPort` (domain/billing/processor.ts) server-side:

- Customers/methods land in `stripe_customers` and
  `payment_method_summaries` (brand + last four only; the schema refuses
  more).
- The webhook handler: verify signatures, insert into
  `stripe_event_receipts` (the unique index IS the idempotency), process to
  `processed`, then call the ledger paths `reconcileEvent` points at.
  Verify current Stripe event names against current Stripe docs — the spec
  says not to trust a static list.
- Before any AutoPay charge, ask `autopayCollectionRefusals`. A refusal is a
  needs-attention exception, never a silent skip and never a charge.
- The authorization each charge rests on is a `payment_authorizations` row;
  the wording is versioned (`joy-epay-v1` — the text is vendored in
  docs/billing/). Capture happens during payment setup, after the
  `paymentMethodRequestGate` passes (the family sees YOUR CARE COST first).
- Dunning: `DUNNING`, `dunningDatesFor`, `todaysTouch` are the policy. One
  retry, same method. Emails need a channel — none is modeled yet; texts go
  through the SmsSender port.

### 5. The messaging channels

`SmsSender` (domain/portal/ports.ts) against GHL and Spruce — the routing per
purpose is `SMS_ROUTING` and is Karynn's explicit decision (OTPs via GHL;
care and billing texts via Spruce). Every message body comes from
`composeMessage`; there is no free-text SMS anywhere and none may be added.
`OtpService` must be server-side only — the port's comment explains why.

### 6. GHL and Gusto status sync

- GHL: the webhook vocabulary is `ghlEvents.ts` — seven received, six sent.
  Received events produce suggestions for a person, never mutations.
- Gusto: implement `HrOnboardingService` (the null adapter shows the
  contract). Joy displays the six `GUSTO_TRACKED_ITEMS`; it never rebuilds
  Gusto. The workweek in Gusto is SATURDAY–FRIDAY and the code assumes it
  (`WORKWEEK_STARTS_ON = 6`) — if the Gusto setting ever differs, overtime
  silently diverges.

### 7. Documents pipeline

`domain/documents/ports.ts` defines storage, processing, OCR/extraction,
verification, compliance, access, and audit-packet services. Wire storage
first (Supabase Storage); the rest are progressive.

---

## Traps, already paid for

- **`strict: false` breaks boolean-discriminant narrowing.** Use
  `"field" in obj` narrowing. This has caused real bugs twice.
- **`vite build` does not type-check** on its own; `npm run build` runs
  `tsc` first. Never ship on `vite build` alone.
- **A missing GRANT refuses loudly; a missing POLICY matches zero rows
  silently.** When a query returns nothing, check the policy before the data.
- **Enum values cannot be dropped in Postgres.** `payment_source` (0004)
  carries dead values (Medicare etc.) that were never on Joy's intake form —
  never surface them in a UI.
- **The billing week is Saturday–Friday** and the Saturday run bills the week
  beginning the FOLLOWING Saturday. `upcomingBillingWeek` is the helper;
  don't recompute it.
- **Person ids come from one place.** The seeds once derived client ids two
  ways and every join between billing and scheduling silently found nobody.
  With live data: one `people` row, one id, everywhere.
- **`supabase/functions/mcp/index.ts` is generated** and produces surprise
  diffs; decide to gitignore-and-build or own it.

---

## Where the decisions live

Every business rule traces to a sentence Karynn said, quoted at the point of
enforcement. The index:

- `docs/billing/OPEN_DECISIONS.md` — all twelve §18 decisions and answers
- `docs/billing/ADDENDUM_AUDIT.md` — the Stripe addendum, section by section
- `docs/HIRING_ROADMAP_AUDIT.md` — the hiring roadmap against the build
- `docs/billing/ELECTRONIC_PAYMENT_AUTHORIZATION_v1.md` — the authorization
  wording, clause-mapped to code
- `docs/SECURITY_NOTES.md` — the RLS model and the rules for new tables
- `docs/DECISIONS/` — ADRs (persistence/auth, Stripe architecture)

When something looks odd, assume it is deliberate and find the comment before
changing it — the codebase explains itself at every decision point, and the
tests pin the behaviour. If a rule needs to change, it changes with Karynn's
sentence attached, like every rule before it.
