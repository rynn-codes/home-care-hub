# Data Model

The rule everything else follows: **one person, many roles.**

A daughter who is her father's responsible party, and who later applies as a
caregiver, is one row in `people`. She gains a `relationships` row pointing at
her father and, if hired, an `employee_profiles` row. She is never copied.
Section 9 states this directly — do not create duplicate family, client or
employee records merely because a person appears in another workflow — and
section 10 extends it to admission: becoming a client must not mint a second
client record.

```
organizations
  └── users                     staff accounts, role and tenancy
  └── people                    every human Joy knows about
        ├── client_profiles     0..1   a person receiving care
        ├── employee_profiles   0..1   a person working here
        └── relationships       0..n   family, contacts, responsible parties
```

## Tenancy

Every root table carries `organization_id`. Profiles do not: they inherit
tenancy through `person_id`, which keeps the organization in exactly one place
per record and removes any chance of the two disagreeing.

Row level security scopes all reads and writes to the caller's organization.
See `docs/SECURITY_NOTES.md`.

## Tables

### `people`

Identity only — name, preferred name, date of birth, contact details, address.
No status, no role, no clinical data. Those belong to the profiles and to the
workflow tables that come with Admissions.

### `client_profiles` / `employee_profiles`

One row per person, enforced by a unique constraint on `person_id`. A person may
hold both. `client_status` and `employee_status` are enums, not free text, so a
stage transition is a decision the database can check rather than a string
someone typed.

### `relationships`

Directional: `subject_person_id` is the client, `related_person_id` is the
contact. Four booleans carry authority, because they are genuinely independent —
a daughter may be the primary contact without being the responsible party, and
an emergency contact is not automatically authorised for care coordination.

Two constraints protect this table:

- a person cannot be their own relation;
- a person can have at most one primary contact, enforced by a partial unique
  index rather than by whichever screen happens to write the row.

**Emergency contacts.** Decision 1, ruled 15 August: one emergency contact is
captured during phone intake and the pair completed at assessment. The
Admissions Master Spec asks for both at intake; the kickoff brief defers both to
Sprint 4. Neither is right — an RN should not arrive at a first home visit with
no contact on file, and demanding two on a first phone call fights the same
instinct that correctly moved the address question to assessment scheduling.

## Audit and events

### `audit_entries`

Append-only. There is no update or delete policy and no grant for either — an
audit trail the application can edit is not evidence of anything. `actor_type`
distinguishes `user`, `ai`, `system` and `integration`, and a check constraint
requires a human actor to be identified, so AI and system actions can never
borrow a person's identity.

### `domain_events`

The outbox. A business write and the message it triggers are deliberately
separated: a failed family notification must never roll back a successfully
scheduled assessment.

`idempotency_key` is unique per organization and event type. This is what makes
a double-clicked **Schedule** button enqueue one event rather than two, and it
covers the same requirement for webhooks, document finalization and signature
submission.

### `communication_events`

What Spruce was asked to send and what actually happened. A check constraint
requires any row marked `sent` to carry both a timestamp and the provider's own
message id, so nothing can be displayed as delivered on the strength of an
optimistic local update. The application may retry a failed message back to
`queued`; only the worker holding the provider's confirmation may write `sent`.

## Not yet built

Admissions, phone intakes, assessments, consents, schedule events, candidates
and documents. Their shapes are specified in sections 10 through 24 of the
kickoff brief and land with the sprints that need them — Admissions and phone
intake first, as the first full vertical slice.
