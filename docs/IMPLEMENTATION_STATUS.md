# Implementation Status

Required by section 3 of the Codex Engineering Kickoff. Update this with every
meaningful change; it is the first thing a new engineer or agent should read.

**Last updated:** 16 August 2026
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
- **Clients, Employees, Scheduling, Billing, Reports, Documents, SOPs** — earlier
  screens, still reading in-memory mock data. They predate this work and have not
  been rebuilt to the Joy visual system.

## What does not exist

- Admissions, Phone Intake, RN Assessment, Consents, Payroll, Hiring. Their
  routes render a screen stating the module is unbuilt and what it will contain.
- Any real persistence for the existing screens. `DataProvider` is still
  `useState` over `mockData.ts`.
- Domain services, the outbox worker, and the Spruce, OpenAI, GHL and Gusto
  adapters. Only the tables and flags exist.
- Offline draft and resume for field assessment.
- `docs/ARCHITECTURE.md`, `INTEGRATIONS.md`, `DOMAIN_EVENTS.md`.

## Migrations

Applied in filename order. There is no hosted-database migration runner wired up
yet, so these have been verified against a local Postgres 16 rather than against
the Supabase project.

```
supabase/migrations/0001_foundation.sql        identity, people, profiles, relationships
supabase/migrations/0002_audit_and_events.sql  audit, outbox, communications
supabase/migrations/0003_rls.sql               grants, helper functions, policies
```

To verify locally:

```sh
psql -f supabase/tests/local_shim.sql       # stands in for Supabase's auth schema
psql -f supabase/migrations/0001_foundation.sql
psql -f supabase/migrations/0002_audit_and_events.sql
psql -f supabase/migrations/0003_rls.sql
psql -f supabase/tests/rls_test.sql         # 17 assertions, exits non-zero on failure
```

`local_shim.sql` is for local verification only and must never run against a
Supabase project.

## Known blockers

1. **Migrations have not been applied to the Supabase project.** They are
   verified locally only. Someone with project credentials needs to apply them
   and confirm `auth.users` references resolve.
2. **Existing screens still read mock data.** Clients, Employees, Scheduling and
   Billing must move onto the real schema, which means mapping the old separate
   `Client` and `Employee` records onto one `people` row each.
3. **No outbox worker.** `domain_events` accumulates rows with nothing draining
   them. Needed before assessment scheduling can notify anyone.
4. **Four approved specs are missing from the repository** — the Hiring Screen
   Roadmap, the Product Bible, the two-page Client Intake Form and the Joy
   nursing assessment. Hiring and Phone Intake should not be considered fully
   specified until those are read.
5. **Consents cannot record a refusal.** The approved design captures only
   "reviewed" per consent, with no Agree / Decline / N/A. Must be resolved
   before Sprint 3, and the legal review of signature reuse booked.
6. **`supabase/functions/mcp/index.ts` is a generated file tracked in git.** It
   regenerates on install and produces surprise diffs. Either gitignore it and
   build on deploy, or own it deliberately.

## Next

Finish Sprint 0, then Sprint 1 in the order section 34 sets out.

- [ ] Apply migrations to Supabase and regenerate `src/integrations/supabase/types.ts`
- [ ] Audit and domain-event write services, used by the first business operation
- [ ] Private document storage abstraction
- [ ] Move existing screens off mock data onto `people`
- [ ] Then Sprint 1: Admissions schema and services, referral create and
      duplicate check, and the complete manual Phone Intake vertical slice

## Test and build state

As of the latest commit: `npm run build` passes, `npm test` passes with 11
tests, and the database policy suite passes 17 assertions. `npm run lint`
reports 22 errors and 8 warnings, all pre-existing in shadcn UI components, the
generated edge function and `tailwind.config.ts`, none in code written here.
