# Domain Events

The outbox exists to make one rule true, from section 16:

> A failed message must **not** roll back a successfully scheduled assessment.

If scheduling an assessment and notifying the family were one transaction, a
Spruce outage would silently undo a booking the RN and the client have already
agreed. So the business write commits alone and leaves an event behind.
Everything that reaches the outside world happens afterwards, where failing is
safe and retryable.

```
Business action succeeds   (transaction: schedule event, stage change,
      ↓                     domain event, audit entry — all or nothing)
Domain event / outbox
      ↓
Outbox worker
      ↓
Spruce / other adapter
      ↓
Sent · Failed · Retrying
```

## The transaction boundary

Section 42 gives the example. Assessment scheduling is one transaction:

1. validate the intake and admission
2. create the schedule event
3. update the admission stage
4. create the domain event
5. create the audit entry

The Spruce call is **not** in that list. It happens later, driven by step 4.

## Event types

The twenty-two types in section 17 are a typed union in
`src/domain/events/types.ts`, so a typo in a producer is a compile error rather
than an event no handler ever receives.

Naming is `aggregate.past_tense` — `assessment.scheduled`, `client.activated`.
An event records something that *happened*; it is not a command.

## Idempotency

`idempotency_key` is unique per organization and event type, enforced by a
partial index in `0002_audit_and_events.sql` and mirrored in the in-memory
store.

Producers must set it wherever a repeat is possible. Section 42 names the cases:
GHL webhooks, Spruce retries, Gusto callbacks, double-clicked Schedule buttons,
document finalization, signature submission, and AI retries with side effects.

The messaging provider is separately idempotent on its own key, so even if an
event were processed twice, the family would not receive two messages.

## Worker behaviour

`processOutbox` in `src/domain/events/outbox.ts`:

| Situation | What happens |
| --- | --- |
| Handler succeeds | Event marked `processed` |
| No handler registered | Marked `processed` — producers may emit before consumers exist |
| Handler throws | Marked `failed` with the error, attempts incremented, retry scheduled |
| Several handlers, one throws | All still run; the event retries |
| Attempts reach `maxAttempts` | Stops retrying, stays `failed` with its last error, visible to a human |

Backoff is exponential from 1s, capped at 5 minutes.

An exhausted event is never deleted. Silently discarding a notification nobody
received would be worse than leaving a visible failure.

## Ports

The worker is written against `DomainEventStore`, not against Supabase. Two
implementations exist:

- `createMemoryEventStore()` — used by tests, so retry and exhaustion paths run
  in CI rather than being exercised by hand.
- A Postgres implementation, still to be written, once migrations are applied.

Messaging sits behind `MessagingProvider` (`src/adapters/messaging/`). The mock
can be told to fail, which is what section 48's "assessment saved but Spruce
fails" test needs. The live Spruce adapter comes when credentials exist, per
section 34 step 10.

## Never fake a send

`MessageSendResult` only carries a `sent` status alongside the provider's own
message id, and `communication_events` has a check constraint refusing any row
marked `sent` without both an id and a timestamp.

When `SPRUCE_ENABLED` is off, the provider throws rather than pretending. The
notification stays queued and visible. Section 41: never show fake success.

## Still to build

- The Postgres `DomainEventStore`.
- A scheduled runner. `processOutbox` is a pure function today and nothing calls
  it on a timer, so events would accumulate unprocessed.
- `communication_events` rows written by the notification handler.
- The live Spruce adapter.
