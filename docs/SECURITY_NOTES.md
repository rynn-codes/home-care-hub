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

`0010` adds the care plan, incidents and supervisory visits, and puts four more
rules below the application:

- **One active care plan per client.** A unique partial index. `replacePlan`
  retires the old version and activates the new one in a single function so this
  cannot break, and that guarantee should not depend on everybody remembering to
  call it. Two active plans means a caregiver's phone follows whichever loaded
  first.
- **A live plan's tasks are frozen.** A trigger, the same reasoning as the
  confirmed-chart rule one level up: visits have been charted against those
  tasks, and a task edited or deleted today rewrites what somebody was asked to
  do last Tuesday. A change makes a new version.
- **An incident cannot be closed while somebody still has to be told.** A
  trigger, because a row-level check cannot see another table. This is the rule
  whose clock belongs to somebody outside the office, which makes it the one
  most worth enforcing here.
- **The caregiver's narrative is not the office's to edit.** A trigger refuses
  changes to the narrative, who reported it, and when. Findings and
  classification are the office's to write; her account of what happened is not.

Two access decisions worth stating. A portal user reads only the **active** care
plan for a person they may already read — a superseded plan describes care that
already happened and a draft describes care nobody has agreed to, and showing
either to a caregiver is how she follows the wrong list. And **a family reads no
incidents**: §24 keeps internal records off the family portal, and a family
finds out because a person rings them inside the notification window, which is
what `incident_notifications` exists to make sure happens. A daughter reading
"medication error, significant" on a phone at eleven at night, with nobody to
ask, is a worse way to be told.

Supervisory visits are staff-only with no portal access at all. One records how
a named caregiver performed in somebody's home; it is a personnel record as much
as a clinical one, and neither the caregiver observed nor the client's family is
its audience.

Verified in `care_test.sql`.

`0011` changes a model rather than adding a rule. Karynn, 21 August:
"supervisory visits can only be done by an RN." That looks like a one-word
narrowing of the role check and is not — narrowing it to `rn_clinical` would
have locked her out of the task she personally does, because her user row says
`ceo_admin`. She is the owner AND the nurse, and `user_role` cannot say both.

So `users` now carries an RN licence — number, state and expiry, all three or
none — and every rule that asks "is this person a nurse" calls `user_is_rn()`,
which compares the expiry against today. `user_role` describes a job at Joy; an
RN licence is issued to a person by the Texas Board of Nursing and it lapses.
The case that proves the difference is a clinical manager whose licence expired
last month: same title, must stop doing supervisory visits today. A role check
cannot see that at all, and `care_test.sql` asserts it.

Three more rules land below the application:

- **A caregiver's incident report creates the office's obligation.** A trigger,
  and the one legitimate `security definer` in this migration: she may not write
  notification rows — who the office told and when is the office's record — but
  her report is exactly what must create the obligation. Running as the invoker
  made her insert fail with an RLS violation, which would have meant a caregiver
  simply could not report an incident.
- **An incident cannot close while a nurse still has to see the client.** Folded
  into the existing pending-notifications trigger rather than added beside it,
  so the two conditions cannot be checked in different orders and give different
  reasons for the same refusal.
- **An RN visit is recorded by an RN**, by licence, same as a supervisory visit.

The yearly incident register is a **view**, not a table, and
`security_invoker = on` is what makes that safe: the reader's own permissions
apply, so 0010's incidents policies govern the register exactly as they govern
the table. Without it the view would run as its owner and become a way around
row level security — a family would read every incident in the agency through
it. `care_test.sql` asserts a family reads none.

`0012` makes the audit trail worth relying on and the outbox safe to run twice.

- **A session writes in its own name.** The insert policy on `audit_entries` was
  organization-only, so an authenticated caregiver could have written an entry
  saying the owner approved an admission. It now requires
  `actor_type = 'user'` and `actor_user_id = current_app_user().id`. A session
  also cannot claim to be `system` or `ai` — attributing a human action to the
  machine is the more useful lie of the two, and this is the boundary that has
  to refuse it. Non-user actors come from the service role, where the
  attribution is the deployment's to guarantee.
- **The trail cannot be edited, and the refusal is at the grant.**
  `authenticated` has select and insert and nothing else, so an update is
  refused outright rather than silently matching zero rows. That distinction
  matters: a missing policy makes a bug look like it worked.
- **`claim_domain_events` is a function, not a query.** `for update skip locked`
  in one statement is the only thing that stops two workers claiming the same
  event and sending the same text message twice, and it cannot be expressed from
  the client. Neither it nor `finish_domain_event` is granted to
  `authenticated`: a browser tab that claims an event and is then closed has
  silently swallowed it.
- **Attempts are counted at claim time.** An event that crashes the worker hard
  enough that `finish_domain_event` never runs would otherwise keep its count at
  zero and retry forever.

Verified in `outbox_test.sql`, including a second worker in the same minute
claiming nothing.

`0013` adds issued invoices and payments, and the rules on them are about money
rather than health information.

- **A payment cannot be edited or deleted.** No update or delete grant, the same
  reasoning as the audit trail: a payment is a statement that money arrived, and
  there is no version of changing it afterwards that is not either a mistake or
  a cover-up. A payment keyed wrongly is corrected by recording the correction,
  which leaves both facts on the record.
- **A payment cannot arrive before the invoice was sent.** A trigger. Almost
  always somebody keying it against the wrong invoice, and worth catching
  because the money then sits on a week that is already settled while the week
  actually owed keeps ageing.
- **A write-off carries a name and a reason.** A balance that disappears from
  the report the moment somebody gives up on it is a balance nobody can later
  ask why Joy gave up on.
- **The balance is a function, not a column.** A cached balance and a payments
  table are two records of the same fact, and the day they disagree is the day
  somebody chases a family who has already paid.
- **Money is not everybody's business.** Read is limited to the owner, billing
  and payroll. A scheduler does not need to know what a family owes, and a
  caregiver certainly does not — arriving at somebody's house knowing they are
  three invoices behind changes the visit. A family cannot see their own balance
  either; that is a decision worth revisiting rather than a default.

Verified in `receivables_test.sql`.

`0014` adds billing accounts and rate history. Two rules are worth naming.

- **An account cannot be ready to charge automatically without recorded
  authority.** A check constraint, not just a form. Charging a saved card
  off-session on the strength of the card existing is what gets an agency in
  front of a regulator, and it is easy to do by accident because the card is
  right there. `authorization_status` records the fact separately from the
  payment method, because a saved card is not permission.
- **A rate somebody invoiced against cannot be rewritten.** A trigger, the same
  rule as confirmed charts, live care plan tasks and recorded payments: a record
  somebody acted on is not editable. Closing a version with an end date is
  allowed — that is how a change is recorded rather than a rewrite of what the
  old rate was. An exclusion constraint refuses two versions covering the same
  day, because otherwise an invoice's price depends on which row the query read
  first.

Rates are readable by the owner and billing only. Admissions needs to know
whether a rate exists to report readiness; it does not need the number.

Verified in `billing_accounts_test.sql`.

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
psql -f supabase/migrations/0001_foundation.sql   # ... through 0014
psql -f supabase/tests/rls_test.sql               # then the rest
```

`rls_test.sql` defines `assert()` and `act_as()`; `portal_test.sql`,
`visits_test.sql` and `care_test.sql` define their own so they run standalone. **Every assertion
must run under `set local role authenticated`** — RLS is bypassed for the table
owner, so a suite running as `postgres` passes while proving nothing. That
mistake was made once here already; see `DOCUMENT_PIPELINE.md`.

As of `0014`: 209 assertions across ten files.
