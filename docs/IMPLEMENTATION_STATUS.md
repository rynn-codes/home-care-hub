# Implementation Status

Required by section 3 of the Codex Engineering Kickoff. Update this with every
meaningful change; it is the first thing a new engineer or agent should read.

**Last updated:** 21 August 2026 (incidents, care plans, supervisory visits, the audit
home, Reports, migrations 0010–0012)
**Branch:** `claude/joy-health-dashboard-1hx2n9`

---

## Current stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite                                 |
| UI         | Tailwind, shadcn/ui, Radix primitives                      |
| Routing    | React Router 6                                             |
| Data       | TanStack Query (client), Supabase JS                       |
| Backend    | Supabase — Postgres, Auth, Edge Functions                  |
| Tests      | Vitest, Testing Library, psql for database policy tests    |
| Package    | npm. See the README for why there is one lockfile.         |

No second frontend was created and no framework was replaced, per section 3.

## What works

- **App shell** — the section 6 navigation: Home, Operations (Hiring nested),
  Admissions, People (Clients and Employees nested), Scheduling, Billing,
  Payroll, Reports, Settings. Joy Royal Blue `#1407A2`, warm ground, no
  gradients.
- **Home** — the approved Command Center: greeting band, six-item priority
  strip, eleven panels in three columns, Joy Assistant collapsed. Reads demo
  seed from `src/lib/joySeed.ts`; must move to real domain queries.
- **Authentication guard** — every route inside the shell requires a session and
  redirects to `/login` carrying the intended destination.
- **Database foundation** — organizations, users, people, client and employee
  profiles, relationships, audit entries, domain events, communication events.
  Migrations in `supabase/migrations/`.
- **Row level security** — organization scoping and role enforcement on every
  table, with a test suite in `supabase/tests/rls_test.sql`.
- **Autosave primitive** — `useAutosave` with debounce, local draft recovery and
  stale-write protection, plus the `SaveState` indicator.
- **Feature flags** — the six flags from section 41, all defaulting to off.
- **Audit writer** — validates the actor, redacts sensitive fields, and reports
  a store failure rather than throwing into a business transaction.
- **Outbox worker** — `processOutbox` with exponential backoff, per-handler
  isolation and attempt exhaustion. Written against a store port, so its retry
  paths are tested in CI rather than by hand.
- **Messaging port and mock** — `MessagingProvider` with an in-memory
  implementation that can be told to fail, and that refuses to send when its
  flag is off rather than faking success.
- **Admissions** — the work queue, organised as Needs You / Waiting / Moving
  Forward with stage filters. Schema, stage-transition rules, work-queue
  classification and duplicate detection are implemented and tested; the screen
  still reads demo seed.
- **Referral entry** — the new-referral drawer with live duplicate checking.
  A match shows what it found and why, and offers Open Existing Record or
  Continue as New; a person with an open admission cannot get a second one.
  Validation covers the malformed-email and missing-contact failure cases.
- **Manual phone intake** — the Typeform-style flow, one question at a time,
  autosaving to localStorage. Prefills what the referral already told us,
  reports missing required items on review, and completes the admission stage.
- **Assessment scheduling** — books the visit, queues the family notification
  separately, and reports it honestly as not sent while Spruce is disconnected,
  with a retry. The booking is never undone by the message failing.
- **Demo persistence** — `DemoDataProvider` over localStorage. The whole Golden
  Demo survives a refresh. Prototype only; the Supabase repositories replace it.
- **Clients, Employees, Scheduling, Billing, Reports, Documents, SOPs** — earlier
  screens, still reading in-memory mock data. They predate this work and have not
  been rebuilt to the Joy visual system.

## Built since the Golden Demo

- **Consents** — all 25 from the 26-page packet, grouped into five chapters,
  with Agree / Decline / N/A and the consequences of each refusal stated. The
  witness rule is enforced: only an RN or the owner may take a signature.
- **Clients, Employees, Hiring** — real screens over the domain, with the
  compliance clock and the hiring-to-onboarding transition.
- **Documents and credentials** — schema, ports, the compliance engine, human
  verification, renewals that supersede rather than overwrite, and the audit
  packet projection.
- **Employee and client portals** — phone OTP, the post-interview application
  with autosave, candidate status, document upload, onboarding state, the
  caregiver's home and schedule, clock in/out with §11's completion check,
  charting with provenance, Moments, and the family portal. All under
  `/portal`, outside the admin shell.
- **Payroll** — hours from the clock, split per workweek, with exceptions.
  Joy produces hours; Gusto produces wages. No pay rates are in the code.
- **Billing** — invoices built from the signed service agreement's own terms,
  ageing, and a refusal to invoice a client who has no rate rather than sending
  a zero. The agreement's internal contradiction — it says both "invoice every
  week in advance" and "due to billing in arrears" — is shown on the screen
  rather than silently resolved.
- **Incidents** — everything a caregiver reports at clock-out, classified,
  with the notification deadlines Joy owes running from when it was *reported*
  rather than from when the office got round to looking at it. An incident
  cannot be closed while somebody still has to be told, and cannot be closed
  with no findings. See the open decision below: the windows themselves are
  Joy's policy held as data, not a legal citation.
- **Care plans** — the module the assessment, the consents, the caregiver's
  visit screen and the family portal were all leaning on and none of them could
  point at. Built from the RN's own assessment answers rather than typed a
  second time; versioned rather than edited, so a visit charted last month still
  reads against the plan that was in effect that day; and it invents nothing —
  where an answer is missing the plan carries the gap and refuses to go live.
  `tasksForVisit` now reads it. It used to return five hardcoded task labels for
  every client, which meant a client whose care had never been planned looked
  exactly like one whose plan was current, on the caregiver's phone and on
  Home. Both now say so.
- **Supervisory visits** — booking, recording and, crucially, resetting the
  annual supervision clock the service agreement commits to. The client record
  has counted that obligation down since the compliance engine was written and
  could never stop it: with nothing to measure from but start of care, a client
  supervised last month still read overdue and the RN who did the work had no
  way to say so. Completing a visit can mark the care plan reviewed in the same
  action, because it is the same trip — recording them separately means doing
  one and forgetting the other. Home's supervision signal used to read an input
  the live wiring passed as an empty array, so it printed 0 whatever was true;
  it now reads the same queue the screen does.
- **Reports** — six: revenue by month, hours by service, caregiver utilisation,
  net margin by client, unbillable hours, and outstanding invoices.
  Each computes from the engine that owns the data, so a figure here that
  disagreed with Billing or Payroll would be a bug rather than a difference of
  emphasis. Period selector and CSV export on every one.

  **Two of the five cannot be computed and say so.** Revenue and net margin need
  client rates; net margin also needs pay rates, which do not exist in this
  repository on purpose. Each names its missing input and shows nothing else.
  The page this replaced had four charts reading `mockData.ts` — hours by
  caregiver, revenue by client, visit compliance, a hardcoded overtime trend —
  and they were indistinguishable from real ones, which is a worse failure on a
  reports page than anywhere else.

  The sixth slot held an authorisation burn rate, which Karynn retired on
  21 August — "We are all private pay... We don't need anything regarding
  authorizations" — and now holds **outstanding invoices**, which she asked for
  in its place. That is the right report for an agency with no payers: there is
  no remittance advice arriving on its own, every dollar owed is a family, and
  the only thing between a late payment and a bad debt is somebody noticing. An
  e2e test asserts the authorisation report is absent so it does not return with
  the next design that shows one.
- **Issued invoices and payments** — the model outstanding invoices needed.
  `buildInvoice` computes a week on demand and has no identity, so nothing could
  record that an invoice was sent or that $400 arrived against it in two
  payments. An invoice becomes a debt when it is ISSUED; a week Joy computed and
  never billed is not money anybody owes. Partial payments are expected,
  overpayment is a credit rather than a negative debt, and a payment cannot be
  edited after it is recorded — see `SECURITY_NOTES.md`.
- **The audit trail, called** — the writer and its rules existed and were tested
  for weeks, and nothing in Joy ever invoked them. Seven consequential actions
  now do: taking a referral, completing intake, capturing a signature, approving
  an admission, starting care, assigning a shift and hiring. Everything goes
  through `createAuditWriter` rather than appending directly, so the actor
  validation and the redaction apply — a signature or an SSN in an entry is
  refused by the same code path that writes it. The Audit screen shows the trail
  and still says the line is amber, because it lives in a browser until the
  migrations reach a project.
- **Timed care** — Karynn, 21 August: "Respite and post surgical all follow the
  same care plan. They usually are for care that is timed... Will be out of the
  home in a month or after they recover." The assessment has asked how long care
  should run since it was written and the answer went nowhere; the care plan now
  carries it. "Until they have recovered" is a third option rather than a date,
  because forcing a date at the kitchen table produces one nobody agreed to that
  everybody later treats as agreed. Care running past its end date outranks
  everything on the Care plans queue except having no plan at all.
- **The audit trail and the outbox, in Postgres** — both were ports with
  in-memory implementations only, which meant every audit entry Joy wrote was
  discarded on the next page load. `SupabaseAuditStore` and
  `SupabaseDomainEventStore` are written and tested against the contract. Three
  defects surfaced doing it: an authenticated session could write an audit entry
  in somebody else's name, `domain_events` had no column for the backoff
  `markFailed` has always taken, and there was no way to claim work atomically —
  two workers in the same minute would have sent the same text twice. See
  `SECURITY_NOTES.md`.
- **Audit** — Karynn, 21 August: "Is there a home for the audit portion?" There
  was not. Joy could build an audit packet for one employee, from inside that
  employee's record, so the thing an agency needs on the morning a surveyor
  arrives — one answer to "show me your files" — did not exist. `/operations/audit`
  is that, written as the questions somebody with a clipboard actually asks,
  each paired with what Joy can produce. It also names what it does NOT cover,
  because a screen of green lines is how somebody concludes they are ready when
  they are not.
- **The yearly incident report** — Karynn, 21 August. Computed from the
  incidents themselves rather than kept as a register, so it cannot drift from
  what it describes, and keyed on when each incident was *reported* rather than
  closed. Each line carries whether the obligations were met: a register that
  lists what happened without saying whether Joy did what it said lets an agency
  look diligent through a bad year.
- **Inviting a family mid-admission** — §19's gate is now live on the admission
  review screen, which is the one point in the process where it can do any good:
  the client record only exists after activation, and by then the family has
  missed the week they had documents to send and a start date to watch. The
  number comes from the intake rather than being asked for twice.
- **People** — business contacts, referral sources and partners, organised
  around who can send Joy work and who has gone quiet. Karynn's scope, 18 Aug:
  "our general contact list for ancillary people". Contacts can be added,
  edited, deleted with undo, and conversations logged. All of it persists in
  the browser for the demo, the same way the rest of the Golden Demo does.

## What does not exist

- AI conversation mode for intake. Manual mode is built first by design (§34);
  the AI path sits behind `AI_PHONE_INTAKE_ENABLED`, which is off.
- A create service. The referral drawer adds to the in-memory queue and says so
  in its confirmation; nothing is written to a database yet.
- Any real persistence for the existing screens. `DataProvider` is still
  `useState` over `mockData.ts`. Reports no longer reads it; Documents and SOPs
  still do.
- **A persisted audit trail.** The writer is called and the entries are real;
  they live in the browser until the migrations reach a Supabase project.
  Payroll approval and the two integration actions in `AUDITED_ACTIONS` have no
  call site yet because the flows they belong to are not built.
- A scheduled runner for the outbox. `processDue` is a pure function and nothing
  calls it on a timer, so events would accumulate as `pending` — no message
  fails and no error appears, the queue just grows.
- The live Spruce, OpenAI, GHL and Gusto adapters.
- Offline draft and resume for field assessment.
- `docs/ARCHITECTURE.md`. (`INTEGRATIONS.md` now exists — every port, what it
  needs, and what Joy does until it is wired.)

## Migrations

Applied in filename order. There is no hosted-database migration runner wired up
yet, so these have been verified against a local Postgres 16 rather than against
the Supabase project.

```
supabase/migrations/0001_foundation.sql        identity, people, profiles, relationships
supabase/migrations/0002_audit_and_events.sql  audit, outbox, communications
supabase/migrations/0003_rls.sql               grants, helper functions, policies
supabase/migrations/0004_admissions.sql        admissions, referral fields, stage enums
supabase/migrations/0005_documents_and_credentials.sql  documents, credentials, sensitivity
supabase/migrations/0006_portal_access.sql     portal grants, is_staff(), portal read policies
supabase/migrations/0007_visits_and_time.sql   the schedule, the clock, assignment-based access
supabase/migrations/0008_charting_and_moments.sql  charts, Moments, preferences, document requests
supabase/migrations/0009_grant_revocation.sql      withdrawing portal access, attributably
supabase/migrations/0010_care_plans_incidents_supervision.sql  care plans, incidents, supervisory visits
supabase/migrations/0011_rn_licence_and_rn_visits.sql          RN licences, the 24-hour RN visit, the yearly register
supabase/migrations/0012_audit_trail_and_outbox_worker.sql     audit attribution, the retry column, atomic claim
supabase/migrations/0013_invoices_and_payments.sql             issued invoices, payments, balances
```

To verify locally:

```sh
psql -f supabase/tests/local_shim.sql       # stands in for Supabase's auth schema
psql -f supabase/migrations/0001_foundation.sql
psql -f supabase/migrations/0002_audit_and_events.sql
psql -f supabase/migrations/0003_rls.sql
psql -f supabase/migrations/0004_admissions.sql
psql -f supabase/migrations/0005_documents_and_credentials.sql
psql -f supabase/migrations/0006_portal_access.sql
psql -f supabase/migrations/0007_visits_and_time.sql
psql -f supabase/migrations/0008_charting_and_moments.sql
psql -f supabase/migrations/0009_grant_revocation.sql
psql -f supabase/migrations/0010_care_plans_incidents_supervision.sql
psql -f supabase/migrations/0011_rn_licence_and_rn_visits.sql
psql -f supabase/migrations/0012_audit_trail_and_outbox_worker.sql
psql -f supabase/migrations/0013_invoices_and_payments.sql

psql -f supabase/tests/rls_test.sql          # 19 assertions
psql -f supabase/tests/admissions_test.sql   # 10
psql -f supabase/tests/credentials_test.sql  # 17
psql -f supabase/tests/portal_test.sql       # 20
psql -f supabase/tests/visits_test.sql       # 18
psql -f supabase/tests/charting_test.sql     # 19
psql -f supabase/tests/care_test.sql         # 48
psql -f supabase/tests/outbox_test.sql       # 24
psql -f supabase/tests/receivables_test.sql  # 18
```

Every assertion runs under `set local role authenticated`. RLS is bypassed for
the table owner, so a suite running as `postgres` passes while proving nothing.
That mistake was made once here already — see `DOCUMENT_PIPELINE.md`.

`local_shim.sql` is for local verification only and must never run against a
Supabase project.

## Known blockers

1. **Migrations have not been applied to the Supabase project.** They are
   verified locally only. Someone with project credentials needs to apply them
   and confirm `auth.users` references resolve.
2. **Existing screens still read mock data.** Clients, Employees, Scheduling and
   Billing must move onto the real schema, which means mapping the old separate
   `Client` and `Employee` records onto one `people` row each.
3. **The outbox has no runner.** The worker logic, the Postgres store and the
   claim function all exist and are tested; nothing invokes `processDue` on a
   schedule, so `domain_events` would accumulate as `pending`. The failure is
   silent, which is what makes it a blocker rather than a nuisance.
4. **Four approved specs are missing from the repository** — the Hiring Screen
   Roadmap, the Product Bible, the two-page Client Intake Form and the Joy
   nursing assessment. Hiring and Phone Intake should not be considered fully
   specified until those are read.
5. **The legal review of one-signature reuse has not been booked.** Karynn's to
   arrange. Consents themselves now record Agree / Decline / N/A.
6. **`supabase/functions/mcp/index.ts` is a generated file tracked in git.** It
   regenerates on install and produces surprise diffs. Either gitignore it and
   build on deploy, or own it deliberately.

## Next

Finish Sprint 0, then Sprint 1 in the order section 34 sets out.

- [ ] Apply migrations to Supabase and regenerate `src/integrations/supabase/types.ts`
- [x] Audit and domain-event write services, with the outbox worker
- [ ] Postgres implementations of the store ports, plus a scheduled runner
- [ ] Private document storage abstraction
- [ ] Move existing screens off mock data onto `people`
- [x] Sprint 1 step 1–3: Admissions schema, domain services, work-queue UI shell
- [x] Referral create form, wired to the duplicate check
- [x] Manual Phone Intake and assessment scheduling — the Golden Demo path
- [ ] Reconcile the intake field list against the two-page Client Intake Form.
      The list is PROVISIONAL: every field traces to the kickoff brief or the
      Phone Intake spec, so reconciliation should be additive, not a reshape

## Open decisions for Karynn

Recorded here so they are not only in a chat log.

- **The workweek boundary.** Joy computes overtime from a Monday start.
  Gusto has its own setting and the two must match — a mismatch changes
  overtime silently for anybody working a weekend.
- **Real client rates.** Billing refuses to invoice a client with no rate
  rather than sending a zero, so every client needs one before go-live. The
  packet has these emailed separately for privacy, so they do not belong in the
  repository — they belong in the database.
- **Real pay rates.** The figures on the Employees screen came from the mockup
  and are fiction. Payroll deliberately computes no wages because of this.
- **Packet page 15** still prints her mobile number; she has ruled that only the
  office number is used. Needs a reprint.
- **Whether GoHighLevel will sign a BAA**, and whether its A2P 10DLC
  registration covers authentication traffic. Both gate go-live.
- **The incident notification windows.** `NOTIFICATION_POLICY` in
  `src/domain/incidents/incidents.ts` says who has to be told about what and
  how quickly. The workflow around it is right; the windows are a starting
  point and need checking against the current Texas requirements for Joy's
  licence category. The screen says so in as many words, deliberately — a
  countdown with no provenance reads as though somebody checked.
- **How often a care plan must be reviewed.** `REVIEW_EVERY_MONTHS` is 12,
  matching the annual supervisory visit the service agreement commits to. If
  Joy's licence category requires it sooner, it is one number.
- **The assessment's payer question.** `payer_source` still offers Medicare,
  Medicaid, third-party payor and grant programme. Joy is all private pay, so
  those options are either dead or transcribed from a paper form that predates
  the decision. Left alone rather than edited, because rewriting a transcribed
  document on inference is how a packet stops matching what a client signed —
  worth checking against the paper form.
- **The billing and Stripe specification has arrived** (v1.0, 21 August) and
  Section 20's five Phase 0 deliverables are complete: `docs/billing/` holds the
  existing-system map, the gap table against §4–13, proposed migrations 0014–
  0018, the implementation plan, and Section 18's open decisions; the Stripe ADR
  is `docs/DECISIONS/0002-stripe-integration.md`.

  **Four decisions block the first real invoice** — the weekly cutoff and charge
  date, the quantity the upcoming week is billed from, the authorisation
  language for off-session charges, and the retry cadence. All four are Karynn's,
  and all four are in `docs/billing/OPEN_DECISIONS.md` with what is already
  answered marked as answered.

  **Everything Stripe blocks on a server layer.** §8.1 forbids privileged Stripe
  calls from a browser and the app currently talks to Supabase directly from the
  client.

## Browser tests

```sh
npm run test:e2e          # 77 tests, about two minutes
npm run test:e2e:ui       # the Playwright inspector
```

These exist because of a specific failure. A missing import turned Home into a
blank white page, and nothing caught it: `vite build` transpiled without type
checking, and every unit test passed because none of them mount a route. The
only thing that found it was opening the app.

So the suite is deliberately shallow — every screen comes up, the console stays
quiet, something rendered — plus the portal flows and the two boundaries that
matter: the login screen must answer an unknown number exactly as it answers a
known one, and a workforce grant must not open the family portal.

Two things about how it runs, both learned the hard way:

- It serves the **built bundle**, not the dev server, and never reuses a server
  already on the port. A stray dev server meant 20 tests passed against Vite's
  on-demand compilation rather than the artifact that ships.
The accessibility suite checks WCAG 2.1 AA with axe across the admin screens
and both portals, plus tap-target size on a phone viewport. It found four real
failures the first time it ran, all fixed:

- **Amber and green were unreadable as text** — 2.05:1 and 3.08:1 against the
  warm background, where AA wants 4.5:1. Those tokens carry "needs you" on Home
  and "expires in 28 days" in the portal, read by caregivers outdoors and by
  families who are often elderly. Both darkened, and measured.
- **Muted foreground sat at 4.44:1** — just under, which is the failure nobody
  notices because it looks fine on a desk. It is most of the words on any
  screen.
- **A payer pill used a hardcoded hex pair** at 3.61:1, bypassing the tokens
  entirely.
- **`dt`/`dd` outside a `dl`** in two Home panels, mine, from the commit that
  rewired them to the real engines. A screen reader announces the value with no
  idea what it labels.

One correction to how this suite runs. `AppShell` fades every admin screen in,
and axe computes contrast from the colours actually on screen — so a scan that
started during the fade measured the blend and reported muted-foreground at
4.2:1 when the settled value is 5.38:1. Seven screens failed at once with no
defect behind any of them. It cut both ways: a page that faded a little faster
passed the same scan, so the suite was never measuring what it claimed to. It
now waits for every animation to finish first.

Automated checks catch perhaps a third of what matters — they do not know
whether a label makes sense. This is a floor, not a pass mark.

- It **blocks external requests**. `index.html` pulls a render-blocking
  stylesheet from Google Fonts; where there is no egress that request hangs
  until it resets, `load` never fires, and navigations time out on pages that
  are perfectly fine. Blocking took the suite from 6.2 minutes to 48 seconds
  and removed three failures that were never application bugs.

## Test and build state

As of the latest commit: `npm run build` passes — and now type-checks first,
which it did not before — `npm test` passes with 885 tests, `npm run test:e2e`
passes 77, and the database suites pass 193 assertions across nine files.

`npm run typecheck` is a script in its own right. It was not being run at all
before, and turned up 28 accumulated errors the first time it was, four of them
real bugs in shipped code.

Note for whoever picks this up: the project compiles with `strict: false`, and
with strictNullChecks off TypeScript will not narrow a union by a boolean
discriminant — it keeps the `ok: true` arm in both branches, silently. Use `in`
narrowing until somebody turns strict mode on, which is worth doing and will
cascade. `npm run lint`
is unchanged from its long-standing baseline — every remaining problem is
pre-existing, in shadcn UI components, `tailwind.config.ts`, or the generated
`supabase/functions/mcp/index.ts` bundle. None are in hand-written code.
