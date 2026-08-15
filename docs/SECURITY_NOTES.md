# Security Notes

Section 28 sets the baseline. This records what is actually enforced today and
what is not, because the difference matters more than the intention.

**Nothing here is a compliance claim.** Section 28 is explicit: do not claim
compliance merely because controls exist. HIPAA validation is a separate
workstream that has not started.

## What is enforced

### Organization scoping

Row level security is enabled on every table, and every policy is scoped by
`current_org_id()`, which resolves the caller's organization from their Supabase
session. A caller cannot read another organization's data, insert into it, or
move one of their own rows across the boundary — the last of these is what the
`with check` clauses exist for, and it is easy to omit by accident.

### Role enforcement

Roles are a Postgres enum, and write policies name the roles allowed to perform
each kind of write. Billing staff can read people and cannot create them. Only
admins and HR can create staff accounts. Only admins can read the audit log.

The helper functions are `security definer` with a pinned `search_path`. A
definer function that resolves names through a caller-controlled search path is
a privilege escalation, so this is not optional styling.

### Append-only audit

`audit_entries` has an insert policy, a select policy for admins, and no update
or delete policy or grant.

### No fake sends

A `communication_events` row cannot be `sent` without a provider message id and
a timestamp, and application sessions cannot make that transition at all.

### Session guard

Every route inside the app shell requires a session and redirects to `/login`
with the intended destination preserved. An unreachable auth service is treated
as signed out — failing open would hand the shell to anyone with a broken
network.

**This guard is not a security boundary.** It keeps people out of screens, not
out of data; anyone with the anon key can call PostgREST directly. Row level
security is the real boundary, which is why the tests target the database.

### Tests

`supabase/tests/rls_test.sql` — 17 assertions covering cross-organization
isolation, role enforcement, append-only audit, send confirmation and
idempotency. It exits non-zero on failure and should gate deploys once a
migration runner exists. Two of the brief's named Sprint 1 failure tests,
"unauthorized role" and "cross-organization access attempt", live here.

### Secrets

`.env` is gitignored and untracked. `.env.example` carries names only.

## What is NOT enforced yet

- **Private document storage.** No object storage, no signed URLs. Section 28
  requires both, plus stricter access for Social Security and identity
  documents. Nothing stores documents yet, so nothing is exposed — but this must
  land before Hiring or Consents.
- **PHI redaction in logs.** No logging policy exists.
- **Rate limiting** on authentication or API surfaces.
- **Session revocation** beyond Supabase defaults.
- **Migrations have not been applied to the hosted project.** The policies in
  this document are verified against a local Postgres. Until someone applies them
  to Supabase, the live database has none of them.

That last point is the important one. Everything described here is correct in
source control and absent in production.

## When adding a table

1. Add `organization_id`, or reach tenancy through a foreign key to `people`.
2. `alter table ... enable row level security` in the same migration. A table
   without RLS in a multi-tenant database is a leak waiting for its first bug.
3. Write both `using` and `with check`. Omitting `with check` allows a caller to
   write rows they could not read.
4. Grant to `authenticated` explicitly. RLS narrows access; it does not grant it.
5. Grant nothing to `anon`.
6. Add assertions to `rls_test.sql`, including one that must fail.
