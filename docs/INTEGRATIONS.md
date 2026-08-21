# Integrations — what to connect, and what happens until you do

For the developer taking this over.

Karynn's brief has been consistent throughout: *"I am not expecting you to
connect anything. Our developer will connect the code/prototype to stuff like
VERCEL or AWS. I just need the code to have all the right plumbing for the
developer."*

This is that plumbing, written down. Every seam, what it needs, what Joy does
without it, and the order that hurts least.

**Last updated:** 20 August 2026

---

## The rule these all follow

Every port has an implementation today. None of them pretends.

A fake that returns a plausible success is worse than no implementation at all,
because the failure surfaces later and to somebody who trusted it. So
`MemorySmsSender` reports `delivered: false`, `NullHrOnboardingService` returns
`null` rather than "in progress", and `MemoryAuditPacketService.generate()`
throws with an explanation instead of handing back an empty PDF.

That is why the prototype is honest about what it cannot do, and why swapping in
a real adapter changes behaviour rather than revealing that nothing worked.

---

## Do these first

Nothing else matters much until these three are done.

### 1. Apply the migrations

Nine files in `supabase/migrations`, verified against a local Postgres 16 and
**never applied to the Supabase project** — Karynn's standing decision, and it
still holds. Until somebody applies them, every row level security policy in
this repository is absent from the live database.

```sh
psql -f supabase/tests/local_shim.sql        # local only, never against Supabase
psql -f supabase/migrations/0001_foundation.sql   # …through 0009
psql -f supabase/tests/rls_test.sql          # then the other four suites
```

209 assertions across ten suites. **Every one runs under `set local role
authenticated`** — RLS is bypassed for the table owner, so a suite running as
`postgres` passes while proving nothing. That mistake was made once here
already.

Then regenerate `src/integrations/supabase/types.ts`.

### 2. Move the session server side

`PortalSessionProvider` holds a verified portal identity in the browser,
mirrored to `sessionStorage`. Fine for a prototype, wrong to ship: anything that
gets script onto the page can read it.

The real session is an httpOnly cookie or a server-verified token.
`OtpService` is the seam — see below.

### 3. Verification must run on the server

`OtpService.verify` decides who sees client health information. An adapter that
does that work in the browser has moved the front door inside the house.

---

## The ports

### `OtpService` — phone sign-in
`src/domain/portal/ports.ts` · today: `MemoryOtpService`

Issues and checks the six-digit codes. **Must run server side** (a Supabase edge
function, or your API). The browser only calls it.

The policy it enforces is not incidental: an unknown number gets the same words,
the same code screen and the same consumed rate-limit quota as a known one. Any
difference turns the login page into a way of asking whether Joy Health has a
client at a given number. Keep that when you replace it — `evaluateRequest` in
`otp.ts` is pure and already tested, so reuse it rather than reimplementing.

**Until connected:** the prototype shows the code it generated on screen. One
named field, `outbox`, read by one component. Delete it when you wire this.

### `SmsSender` / `SmsRouter` — outbound texts
`src/domain/portal/ports.ts` · today: `MemorySmsSender`, `MemorySmsRouter`

One sender per carrier; the router picks by message purpose. The routing table
is `SMS_ROUTING` in `messaging.ts` and every row is Karynn's decision:

| Purpose | Carrier |
|---|---|
| All login codes | GoHighLevel |
| Candidate invitation and status | GoHighLevel |
| Family portal invitation | GoHighLevel *(inferred, not instructed)* |
| Care notifications | Spruce |
| Shift notifications | Spruce |

There is **no free-text body parameter** anywhere. Messages are built from fixed
templates out of a named set of inputs, none of which is a diagnosis,
medication, visit note or Moment. That is §25 enforced rather than intended: the
text says something changed and to open Joy. Do not add a `body` parameter.

**Before go-live, two questions for GoHighLevel** — both in `CARRIER_PREFLIGHT`:
1. Will they sign a business associate agreement covering Joy's plan? Family
   login codes and portal invitations go down this number.
2. Does the number's A2P 10DLC campaign cover an **authentication** use case,
   not marketing alone? Codes on a marketing-only registration are the first
   traffic carriers filter, and a filtered code looks like a broken portal.

For Spruce: does the BAA cover automated sends, and is there an API on Joy's
plan? If not, care notifications need a different route — **not** a quiet
fallback to GHL, which would undo the separation on purpose here.

**Until connected:** nothing is sent. `MemorySmsSender` records what it would
have sent and reports `delivered: false` with a `null` provider id — a null
here is a developer noticing nothing is wired; a plausible fake id is one not
noticing. The router refuses outright if no sender is registered for a purpose's
carrier, rather than falling back to whichever number happens to be configured.

### `DocumentStorageService` — the file store
`src/domain/documents/ports.ts` · today: `MemoryDocumentStorage`

Private object storage plus short-lived signed URLs. Nothing public, ever.
Sensitivity classes are in `0005`; background checks are owner-and-HR only and
a caregiver cannot read the check run about her.

**Until connected:** the caregiver and family upload screens validate the file
and stop, and say so on screen. Nothing is stored.

### `AuditPacketService` — the personnel-file PDF
`src/domain/documents/ports.ts` · today: `MemoryAuditPacketService`

`buildAuditPacket()` is a pure projection and produces the whole packet
structure — cover, summary, checklist, sections, per-document cover sheets — in
the order §15 fixes. Only page generation is missing.

**Until connected:** `generate()` throws with an explanation. The employee
record previews the structure instead, so somebody can see exactly what an
auditor would receive.

### `HrOnboardingService` — Gusto
`src/domain/portal/ports.ts` · today: `NullHrOnboardingService`

Deliberately narrow: ask where somebody has got to, get a link to send them. It
cannot read a tax form or a bank detail, and should not — §6 assigns that
workflow to Gusto and a wider port invites Joy to start storing what it decided
not to store.

**Until connected:** returns `null`, which the onboarding screen renders as
"Ready for you" — a prompt, not a status. It never claims a W-4 is in progress.

**Check the workweek setting.** Joy computes overtime from a Monday start. If
Gusto's differs, overtime is silently wrong for anyone working across the
boundary — nothing errors, the numbers are just different.

### `ChartDraftingService` — AI charting
`src/domain/portal/ports.ts` · today: `VerbatimChartDraftingService`

Turns a caregiver's narrative into chart lines. **Every non-recorded line must
cite a span of what she actually wrote**, and `validateDraft` checks those
citations on Joy's side before a caregiver sees anything. A port that trusted
the model to police itself would be a port with no guarantee.

That is how §12's "AI must not invent missing clinical facts" becomes checkable
rather than aspirational.

**Until connected:** charting works completely. Task outcomes and the incident
answer come from structured answers; the observation is her own words. A model
makes that line tidier; it does not make the chart possible.

### `DictationService` — speech to text
`src/domain/portal/ports.ts` · today: `NullDictationService`

Separate from drafting on purpose: its failure is a wrong word, not an invented
fact, and a caregiver can see a wrong word. Show her the transcript before it
becomes the narrative.

### `DocumentTextService`, `DocumentClassificationService`, `CredentialExtractionService`
`src/domain/documents/ports.ts` · today: `NullTextService`, `FilenameClassificationService`, `NullExtractionService`

OCR, document typing, and pulling expiry dates off a card. All optional — they
save typing, they do not gate anything.

`FilenameClassificationService` caps its confidence at 0.4 because guessing from
a filename is a guess. `NullExtractionService` returns `null` rather than a
plausible date. **Extraction confidence never appears in the audit packet** —
§18 — because a number a model produced has no place in a document an auditor
reads as fact.

### `PortalDirectory` — who a phone number belongs to
`src/domain/portal/ports.ts` · today: `MemoryPortalDirectory`

Grants are in `0006`. Note that **no portal user can issue a portal grant** —
that is a staff act, because granting yourself a second audience is the path
from a caregiver login to a family login over somebody else's records.

### `PortalSessionStore`, `DocumentProcessingService`, `CredentialVerificationService`, `ComplianceService`, `DocumentAccessService`
Straightforward once the database is applied. `ComplianceService` should call
the existing pure functions in `domain/credentials/compliance.ts` rather than
reimplement the rules — the same engine already drives Scheduling, Hiring,
Operations, the audit packet and the portals, and a second opinion about whether
somebody can work is the bug it exists to prevent.

---

### `AuditStore` — who did what
`src/domain/audit/audit.ts` · today: **`SupabaseAuditStore` is written**, in
`src/infrastructure/supabase/auditStore.ts`

Pass the client and wire the writer:

```ts
const audit = createAuditWriter(new SupabaseAuditStore(supabase));
```

Three things about this one are load-bearing.

**It is append-only, at the grant.** `authenticated` has select and insert on
`audit_entries` and nothing else, so an update or delete is refused outright
rather than silently matching zero rows. Do not add those grants for a "cleanup"
job. A trail the application can edit is not evidence of anything.

**A session writes only in its own name.** `0012` replaced the org-only insert
policy: an authenticated session must set `actor_type = 'user'` and
`actor_user_id` to itself. Before that, a caregiver could have written an entry
saying the owner approved an admission. Non-user actors — the worker, AI drafting
— come from the service role, which bypasses row level security; their
attribution is your deployment's to guarantee.

**The writer never throws into the caller.** A failed audit write returns
`{ ok: false }` so it can be alerted on. Losing an entry is bad; rolling back a
completed assessment because the audit write failed is worse. Alert on it — that
result is currently dropped at every call site, because there are no call sites
yet.

**Now called.** Seven consequential actions record who did them — taking a
referral, completing intake, capturing a signature, approving an admission,
starting care, assigning a shift, hiring. They go through `recordAudit` in
`src/lib/demoAudit.ts`, which wraps the writer; swapping the in-memory store for
`SupabaseAuditStore` is one line there and no call site moves.

**Still yours:** deciding what to do when a write fails. `recordAudit` returns
the failure and the provider logs it. Losing an audit entry silently is how a
trail becomes untrustworthy without anybody noticing — alert on it.

### `DomainEventStore` — the outbox
`src/domain/events/types.ts` · today: **`SupabaseDomainEventStore` is written**,
in `src/infrastructure/supabase/eventStore.ts`

Two of its four methods call database functions rather than running queries, and
that is deliberate:

- `claimDue` → `claim_domain_events`, which selects and marks processing in one
  statement with `for update skip locked`. It cannot be done from the client.
  Two workers in the same minute would otherwise read the same pending rows and
  both send the same text message; the window between a read and an update is
  exactly where the duplicate lives.
- `markProcessed` / `markFailed` → `finish_domain_event`. Application sessions
  have insert and select on `domain_events` and nothing else: a browser tab that
  claims an event and is then closed has silently swallowed it.

Neither function is granted to `authenticated`. **The worker connects with the
service role.**

Attempts are incremented at claim time, not on failure — an event that crashes
the worker hard enough that `markFailed` never runs would otherwise keep its
count at zero and retry forever.

**Still yours: scheduling it.** `processDue` is a function and nothing calls it
on a timer. pg_cron, a scheduled Edge Function, whatever you prefer. State the
consequence when you decide, because it is not obvious from the code: unscheduled,
events accumulate as `pending` and nothing goes out. No message fails, no error
appears — the queue just grows, and the first symptom is a family who never got
an invitation nobody knows was never sent.

## Not ports, still yours

- **GoHighLevel inbound.** §2 gives GHL recruiting up to the in-person
  interview. Joy's record starts at the invite. `InviteCandidateDialog` takes
  exactly the fields a GHL webhook would carry, so the automated path replaces
  the typing without changing anything behind it.
- **Spruce inbound.** Replies to care notifications reach a human today. Keep
  that; the reply-test is why those messages go down the office number at all.
- **SPA routing.** Deep links like `/portal/work/documents` need every path
  rewritten to `index.html`. Vercel does this by default; a plain S3 bucket does
  not.
- **Self-host the fonts.** `index.html` pulls Inter and Plus Jakarta Sans from
  Google. They no longer block the first paint, but self-hosting removes a third
  party and a DNS lookup from a caregiver's phone on one bar.

---

## Verification

Four layers, each catching what the others structurally cannot:

```sh
npm run typecheck     # was not being run at all; found 28 errors the first time
npm test              # 949 unit tests
npm run test:e2e      # 77 browser tests — every screen renders, console quiet
psql -f supabase/tests/…   # 236 policy assertions, as `authenticated`
```

`npm run build` runs the type check first, so "the build passes" means what
people assume it means.

**One trap.** The project compiles with `strict: false`, and with
strictNullChecks off TypeScript will not narrow a union by a boolean
discriminant — it silently keeps the `ok: true` arm in both branches. That
caused a real bug here. Use `in` narrowing until somebody turns strict mode on,
which is worth doing and will cascade.
