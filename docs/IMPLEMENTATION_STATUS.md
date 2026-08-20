# Implementation Status

Required by section 3 of the Codex Engineering Kickoff. Update this with every
meaningful change; it is the first thing a new engineer or agent should read.

**Last updated:** 20 August 2026 (employee and client portals, payroll)
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

## What does not exist

- **Billing.** No sprint was ever written for it. It is the largest piece of
  genuinely new ground left.
- **Inviting a family mid-admission.** `canInviteFamily` implements §19's gate —
  assessment complete, Joy moving forward — and the client record satisfies both
  by construction. The admission review screen is where that gate is live and
  where the button should also appear.
- AI conversation mode for intake. Manual mode is built first by design (§34);
  the AI path sits behind `AI_PHONE_INTAKE_ENABLED`, which is off.
- A create service. The referral drawer adds to the in-memory queue and says so
  in its confirmation; nothing is written to a database yet.
- Any real persistence for the existing screens. `DataProvider` is still
  `useState` over `mockData.ts`.
- A Postgres implementation of `DomainEventStore` and `AuditStore`. Both are
  ports today with in-memory implementations only.
- A scheduled runner for the outbox. `processOutbox` is a pure function and
  nothing calls it on a timer, so events would accumulate unprocessed.
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

psql -f supabase/tests/rls_test.sql          # 19 assertions
psql -f supabase/tests/admissions_test.sql   # 10
psql -f supabase/tests/credentials_test.sql  # 17
psql -f supabase/tests/portal_test.sql       # 20
psql -f supabase/tests/visits_test.sql       # 18
psql -f supabase/tests/charting_test.sql     # 19
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
3. **The outbox has no runner and no Postgres store.** The worker logic exists
   and is tested, but nothing invokes it on a schedule and it has no database
   implementation, so `domain_events` would still accumulate unprocessed.
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

- **Open shifts in the employee portal.** `0007`'s read policy deliberately
  hides unstaffed visits from caregivers. Offering them is a real feature and
  should be a decision, not a side effect.
- **The workweek boundary.** Joy computes overtime from a Monday start.
  Gusto has its own setting and the two must match — a mismatch changes
  overtime silently for anybody working a weekend.
- **Family portal invitation.** Sent from GHL, which is inferred rather than
  instructed. Every other SMS route is her explicit decision.
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

## Browser tests

```sh
npm run test:e2e          # 36 tests, about a minute
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

Automated checks catch perhaps a third of what matters — they do not know
whether a label makes sense. This is a floor, not a pass mark.

- It **blocks external requests**. `index.html` pulls a render-blocking
  stylesheet from Google Fonts; where there is no egress that request hangs
  until it resets, `load` never fires, and navigations time out on pages that
  are perfectly fine. Blocking took the suite from 6.2 minutes to 48 seconds
  and removed three failures that were never application bugs.

## Test and build state

As of the latest commit: `npm run build` passes — and now type-checks first,
which it did not before — `npm test` passes with 648 tests, `npm run test:e2e`
passes 36, and the database suites pass 103 assertions across six files.

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
