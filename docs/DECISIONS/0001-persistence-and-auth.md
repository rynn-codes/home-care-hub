# ADR 0001 — Persistence and authentication on Supabase

**Status:** Accepted
**Date:** 16 August 2026

## Context

Section 4 of the kickoff brief specifies Postgres, a typed query layer,
committed migrations, secure session authentication and server-enforced role
checks. It also says that baseline applies only if the repository is blank.

This repository is not blank. It already carries `@supabase/supabase-js`, a
generated client, a `supabase/config.toml` bound to a real project, two edge
functions, and a `Login` page calling `supabase.auth`. Section 3 is explicit:
do not create a second frontend, and do not replace a working framework because
another is preferred.

## Decision

Build on the Supabase installation already present.

- **Database** — Supabase Postgres. This satisfies the brief's Postgres
  requirement directly; Supabase is Postgres.
- **Migrations** — plain SQL in `supabase/migrations/`, numbered and applied in
  filename order, committed to source control.
- **Authorization** — Postgres row level security, not application middleware.
- **Authentication** — Supabase Auth. `auth.users` owns credentials; the Joy
  `users` table owns role, organization and the name shown in the product,
  joined by `auth_user_id`.

## Why row level security rather than middleware

The brief requires organization scoping on *every* query. Enforcing that in
application code means every future query must remember to scope itself, and the
one that forgets is a cross-tenant leak that no test is likely to catch.

RLS inverts the default: a new table is inaccessible until a policy grants
access, and the check happens in the database regardless of whether the caller
is our React app, an edge function, a psql session or PostgREST called directly
with the anon key. Since Supabase exposes PostgREST publicly, an application
middleware boundary would not be a boundary at all.

## Costs, accepted

- Policies are SQL, and SQL is harder to review than TypeScript. Mitigated by
  `supabase/tests/rls_test.sql`, which exercises them with assertions that must
  fail.
- Helper functions are `security definer`, which is a sharp tool. Mitigated by
  pinning `search_path` on each.
- Migration order is filename-based, with no runner and no down-migrations. That
  is adequate at this size and should be revisited before multiple people are
  writing migrations concurrently.
- We are tied to Supabase's auth schema. Moving providers would mean rewriting
  `current_app_user()` and the shim — an afternoon, not a rewrite.

## Alternatives considered

**A separate Node or Nest API with an ORM.** Closer to the brief's generic
recommendation and it would give a natural home for domain services. Rejected
for V1: it means running and deploying a second service, and Supabase's
PostgREST would still be publicly reachable, so RLS would be needed anyway. This
can be added later in front of the same database if domain logic outgrows the
client.

**Prisma or Drizzle against the Supabase database.** Attractive for typed
queries. Deferred rather than rejected — it does not conflict with anything
here, and can be introduced when the first real domain service is written. The
generated `types.ts` covers current needs.

## Consequences

- `src/integrations/supabase/types.ts` must be regenerated after migrations are
  applied to the project.
- The local verification path needs `supabase/tests/local_shim.sql`, which
  stands in for the `auth` schema, `auth.uid()` and the `authenticated` role.
- Domain logic must live in services, not in React components — the code quality
  rules require it, and RLS does not enforce business rules, only access.
