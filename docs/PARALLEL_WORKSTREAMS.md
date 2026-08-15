# Parallel Workstreams — Contracts

Three streams run concurrently. This document is what keeps them from colliding.

**Read this before writing any code.** If something here conflicts with a task
brief, this document wins. If it is silent on something that affects another
stream, stop and ask the integrator rather than deciding alone.

The integrator holds Phone Intake, reviews every branch, and owns everything
marked shared below.

---

## 1. Why only three

Parallelism is limited by data dependencies, not by available effort.

| Stream | Status | Reason |
| --- | --- | --- |
| **A — Foundations** | Parallel | Adds no domain tables |
| **B — Scheduling** | Parallel | Own tables, own approved spec, depends only on `people` |
| **C — Payroll** | Parallel | Own tables, own approved spec, depends on visit and time data |
| Phone Intake | Integrator | The schema every later admissions module inherits |
| Assessment → Consents → Admissions Completion | **Sequential** | Each inherits the previous one's structure. §18 has the assessment inherit Phone Intake context; starting early means building against a guess |
| Hiring | **Blocked** | `Joy_Health_Hiring_Screen_Roadmap.md` is not in the repository. Building from the kickoff brief alone reproduces the gap in finding F8 |
| Billing | Queued | No sprint exists (finding F26). Starts after Payroll, with which it shares a cycle |

---

## 2. Frozen files

These are shared. **No stream edits them.** Open a request with the integrator
instead — it takes minutes and prevents a merge that silently drops someone's
work.

```
src/domain/workQueue.ts               the Needs You / Waiting / Moving Forward pattern
src/components/work-queue/            its UI
src/components/home/HomePanel.tsx     the shared panel surface
src/components/layout/                AppShell, AppSidebar, AppHeader, RequireAuth
src/App.tsx                           routing
src/index.css                         design tokens
src/lib/featureFlags.ts               flag registry
src/hooks/use-autosave.ts             autosave primitive
src/components/ui/                    shadcn primitives
supabase/migrations/0001–0004         the existing schema
```

### The people model is frozen hardest

`people`, `client_profiles`, `employee_profiles` and `relationships` must not be
altered by any stream. They are the "one person, many roles" rule from §9, and
three streams independently adding columns is exactly how that rule dies.

Need a column? Ask. The integrator adds it in the shared range and tells
everyone.

---

## 3. Migration number ranges

Migrations apply in filename order and there is no runner, so two agents
choosing `0005_` is a real collision. Ranges are exclusive:

| Range | Owner |
| --- | --- |
| `0001–0004` | Existing. Do not modify |
| `0005–0009` | Integrator — shared schema changes only |
| `0010–0019` | Stream A — Foundations |
| `0020–0039` | Stream B — Scheduling |
| `0040–0059` | Stream C — Payroll |
| `0060–0079` | Phone Intake / Admissions (integrator) |
| `0080–0099` | Billing, later |
| `0100+` | Hiring, once its spec exists |

Every migration ships with assertions in `supabase/tests/`, following the
pattern in `rls_test.sql` — including at least one assertion that must fail.

**Every new table** gets, in the same migration: `organization_id` or a foreign
key reaching tenancy through `people`; `enable row level security`; both `using`
and `with check` policies; an explicit grant to `authenticated`; nothing to
`anon`. See `docs/SECURITY_NOTES.md`.

---

## 4. Vocabulary lock

Settled. Do not introduce synonyms — the Referral/Lead split in the mockups
(finding F12) came from exactly this going unmanaged.

| Use | Never |
| --- | --- |
| Referral | Lead, prospect, enquiry |
| Home | Dashboard |
| People → Clients / Employees | Clients and Employees as top-level |
| Operations → Hiring | Hiring as top-level |
| Needs You / Waiting / Moving Forward | Any per-module list vocabulary |
| `new_referral` … `admitted`, `closed` | Any other admission stage names |
| Joy Royal Blue `#1407A2` | Any other primary |

Enums already fixed in `0004_admissions.sql`: `referral_source`, `care_service`,
`contact_method`, `payment_source`. Reuse them. Do not define a parallel set.

---

## 5. Architecture rules

Non-negotiable, from §5, §26 and §50:

- **Domain logic outside components.** Rules live in `src/domain/<area>/` as pure
  functions with tests. A component reads state and renders; it does not decide.
- **Vendor calls behind adapters** in `src/adapters/`. No Supabase or vendor SDK
  call inside a React component.
- **Ports before implementations.** Write against an interface, supply an
  in-memory implementation for tests. `DomainEventStore`, `AuditStore` and
  `MessagingProvider` already follow this; match it.
- **Never fake success.** A flag that is off means the feature is absent and says
  so. An integration result is only success when the provider confirms it.
- **AI proposes, humans decide.** No unattended write of a consequential change.
- **Audit consequential changes** through the audit writer, with the correct
  actor type. A background job must not borrow a user id.

---

## 6. Working agreement

- One branch per stream, off `claude/joy-health-dashboard-1hx2n9`.
- Rebase on the base branch before requesting integration. Do not merge between
  streams directly.
- **Never edit another stream's files.** If you need their behaviour, ask for an
  interface.
- `npm run build` and `npm test` pass before requesting integration. Lint adds no
  new errors in files you wrote — the pre-existing count is documented in
  `IMPLEMENTATION_STATUS.md`.
- Each stream writes `docs/status/<stream>.md`. **Do not edit
  `IMPLEMENTATION_STATUS.md`** — the integrator merges from your status file.
  Three agents editing one status document is a guaranteed conflict.
- Report blockers early. A stream blocked for a day is cheaper than a stream that
  guessed.

---

## 7. Definition of done

§49. A screen is not done because it resembles a mockup:

approved visual system · real persisted data · loading state · empty state ·
permissions enforced server-side · validation · error state that names what
failed · autosave where required · audit where consequential · keyboard
operable with visible focus · responsive · tests · no fake integration success ·
no dead buttons **or dead counts**

---

## 8. Stream briefs

### Stream A — Foundations

Migrations `0010–0019`.

1. Postgres implementations of `DomainEventStore` and `AuditStore`, matching the
   in-memory versions' behaviour exactly — including that `claimDue` skips a
   failed event with no retry time, and that idempotency keys are unique per
   organization and event type.
2. A scheduled runner invoking `processOutbox`. A Supabase scheduled function is
   the obvious fit. Nothing drains the outbox today.
3. The private document storage abstraction from §28: object storage behind a
   port, signed URLs, and tighter access for Social Security and identity
   documents.
4. Move `Clients`, `Employees`, `Scheduling` and `Billing` off `mockData.ts` onto
   `people`. Each old separate `Client` and `Employee` becomes one `people` row
   with the matching profile. This is the change that makes the people model
   load-bearing rather than merely correct.

Do not add domain tables. Do not touch the people schema — you are reading it,
not reshaping it.

### Stream B — Scheduling

Migrations `0020–0039`. Source of truth:
`Joy_Health_Scheduling_Build_Spec.md` and §20.

`schedule_events` is specified in §15 — use those columns and event types.

The architectural rule is one line and it governs everything: **there is one
official Joy schedule. UI, AI and Spruce act on it; they do not each keep their
own state.**

Week view first, then day and month. Conflict detection belongs in a domain
service, not in a calendar component. Every consequential change is confirmed by
a human before it commits, then emits a domain event — the notification is never
inside the schedule transaction.

Assessment scheduling is a `rn_assessment` event on this same schedule. Do not
build an Admissions calendar; §15 forbids it.

### Stream C — Payroll

Migrations `0040–0059`. Source of truth:
`Joy_Health_Payroll_Mockup_Build_Spec.md` and §24.

Payroll is exception management, not a spreadsheet. Only items needing action
appear in Needs Review.

Billing and payroll periods are different and must not be conflated. Joy
*prepares* for Gusto and never reports a Gusto action as successful unless the
integration confirms it — §23. With `GUSTO_ENABLED` off, the boundary says so.

Reuse the shared work-queue pattern. Payroll's "Needs Review" is that pattern
wearing a different label, and §8 asks for one implementation, not four.

---

## 9. What no stream may do

- Apply migrations to the Supabase project. They are local-only by decision;
  the integrator coordinates that when it happens.
- Add a dependency without asking. `npm install` regenerates
  `supabase/functions/mcp/index.ts`, a tracked build artifact — leave that file
  out of your commits.
- Invent a business rule. §50: never silently invent a missing rule. Document
  the mismatch and ask.
- Start Assessment, Consents, Admissions Completion or Hiring. They are
  sequential or blocked, and starting them early produces rework, not progress.
