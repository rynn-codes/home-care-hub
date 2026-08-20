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

## The portal roles, and the hole they opened

`employee` and `client_contact` have been in the `user_role` enum since `0001`.
Nothing distinguished them from staff until `0006`, and the read policies in
`0003` say only "same organization".

This was measured rather than assumed. Against the schema as it stood before
`0006`, a user with role `employee` and an active session read **every `people`
row and every `client_profile` in the organization** — every client's full name.
The portal's React guard was irrelevant: anyone holding the anon key calls
PostgREST directly, which is the whole reason `0003` exists.

`0006` narrows every broad read policy to `is_staff()` or a specific portal
predicate. `is_staff()` is written as a positive list rather than "not employee,
not client_contact", so a role added to the enum later is not staff until
somebody says so — the negative form fails by silently granting everything.

`0007` adds the rule `0006` could not express, because there was no `visits`
table to hang it on: **a caregiver reads the clients she is assigned to, and
that access lapses.** Thirty days past the last visit. Access that followed
assignment forever would mean somebody who covered one shift in March could
still read that client in September, which is not a relationship anyone
consented to. Forward-looking access is unbounded — she needs to prepare for
next week.

What portal users get back, and nothing more:

| Role | Reads |
|---|---|
| `employee` | Own person, own employment record, own credentials, own general and clinical credential documents, own visits, own time entries, clients assigned within the window |
| `client_contact` | The person named on their grant, that person's profile, admission and visits, and their own entry in the relationships list |

Two things portal users explicitly do **not** get. A caregiver cannot read the
background check run about her — that stays with the owner and HR, as `0005`
has it. And no portal user can issue a portal grant; that is a staff act,
because granting yourself a second audience is the path from a caregiver login
to a family login over somebody else's records.

`0008` adds the tables the portals write into, and puts three rules in the
database rather than only in TypeScript — because a policy survives a bug in a
component:

- **A confirmed chart cannot be edited.** A trigger refuses it. The caregiver
  attested to that record; changing it afterwards is an amendment, a different
  act with a different trail, and one nobody has designed yet.
- **A drafted or quoted chart line must cite something.** A check constraint,
  so writing an uncited clinical claim is impossible rather than merely tested
  against.
- **Only the office may share a Moment a model worded.** A caregiver publishes
  her own words freely; the `with check` clause on `moments_update` is what
  stops her publishing a model's. The consequence of getting this wrong is a
  fabricated sentence about somebody's mother arriving on her daughter's phone.

A family reads no chart at all — §13 keeps raw chart notes out of the family
portal, and making them unreadable is a stronger guarantee than every future
screen remembering not to render them.

Verified in `portal_test.sql`, `visits_test.sql` and `charting_test.sql`, all
running as `authenticated`.

## When adding a table

1. Add `organization_id`, or reach tenancy through a foreign key to `people`.
2. `alter table ... enable row level security` in the same migration. A table
   without RLS in a multi-tenant database is a leak waiting for its first bug.
3. Write both `using` and `with check`. Omitting `with check` allows a caller to
   write rows they could not read.
4. Grant to `authenticated` explicitly. RLS narrows access; it does not grant it.
5. Grant nothing to `anon`.
6. Add assertions to `rls_test.sql`, including one that must fail.
7. Ask what a **portal** user sees. `is_staff()` is not automatic — a new table
   with a plain `organization_id = current_org_id()` policy is readable by every
   caregiver and every family member with a login. That is the mistake `0006`
   had to go back and fix across five tables.

## Running the SQL suites

```
psql -f supabase/tests/local_shim.sql
psql -f supabase/migrations/0001_foundation.sql   # ... through 0007
psql -f supabase/tests/rls_test.sql               # then the rest
```

`rls_test.sql` defines `assert()` and `act_as()`; `portal_test.sql` and
`visits_test.sql` define their own so they run standalone. **Every assertion
must run under `set local role authenticated`** — RLS is bypassed for the table
owner, so a suite running as `postgres` passes while proving nothing. That
mistake was made once here already; see `DOCUMENT_PIPELINE.md`.

As of `0009`: 103 assertions across six files.
