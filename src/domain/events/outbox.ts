import type {
  DomainEvent,
  DomainEventHandler,
  DomainEventStore,
  DomainEventType,
} from "@/domain/events/types";

export interface OutboxOptions {
  store: DomainEventStore;
  handlers: Partial<Record<DomainEventType, DomainEventHandler[]>>;
  /** How many events to take per pass. */
  batchSize?: number;
  /** Attempts before an event stops being retried and waits for a human. */
  maxAttempts?: number;
  /** Base delay for exponential backoff, in ms. */
  baseDelayMs?: number;
  /** Ceiling on the backoff, so a stuck event still retries occasionally. */
  maxDelayMs?: number;
  now?: () => Date;
}

export interface OutboxResult {
  claimed: number;
  processed: number;
  failed: number;
  exhausted: number;
}

/**
 * Backoff for a failed attempt: 1s, 2s, 4s, 8s… capped.
 *
 * Exponential rather than fixed because the common failure is a provider having
 * a bad minute, and hammering it every second helps nobody.
 */
export function backoffMs(attempts: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * 2 ** Math.max(0, attempts - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * The outbox worker.
 *
 * This is the piece that makes section 16's rule true: a failed family
 * notification must never roll back a successfully scheduled assessment. The
 * business write commits on its own, leaving an event behind; everything that
 * reaches the outside world happens here, afterwards, where failing is safe.
 *
 * Three properties this guarantees, all of them tested:
 *
 *   - A handler that throws does not lose the event. It is marked failed with
 *     the reason and scheduled for another attempt.
 *   - One handler failing does not prevent the others on the same event, and
 *     does not stop the rest of the batch.
 *   - After maxAttempts the event stops retrying rather than looping forever.
 *     It stays visible, with its last error, for a person to deal with.
 */
export async function processOutbox({
  store,
  handlers,
  batchSize = 20,
  maxAttempts = 5,
  baseDelayMs = 1000,
  maxDelayMs = 5 * 60 * 1000,
  now = () => new Date(),
}: OutboxOptions): Promise<OutboxResult> {
  const at = now();
  const events = await store.claimDue(batchSize, at);

  const result: OutboxResult = {
    claimed: events.length,
    processed: 0,
    failed: 0,
    exhausted: 0,
  };

  for (const event of events) {
    const eventHandlers = handlers[event.eventType] ?? [];

    // An event nobody handles is not a failure. Producers are allowed to emit
    // events before consumers exist, which is much of the point of an outbox.
    if (eventHandlers.length === 0) {
      await store.markProcessed(event.id, now());
      result.processed += 1;
      continue;
    }

    const errors = await runHandlers(eventHandlers, event);

    if (errors.length === 0) {
      await store.markProcessed(event.id, now());
      result.processed += 1;
      continue;
    }

    const attempts = event.attempts + 1;
    const message = errors.join("; ");

    if (attempts >= maxAttempts) {
      // Stop retrying, but keep the row and its error. Silently discarding a
      // notification nobody received would be worse than leaving it visible.
      await store.markFailed(event.id, message, attempts, null);
      result.exhausted += 1;
    } else {
      const retryAt = new Date(now().getTime() + backoffMs(attempts, baseDelayMs, maxDelayMs));
      await store.markFailed(event.id, message, attempts, retryAt);
      result.failed += 1;
    }
  }

  return result;
}

/**
 * Runs every handler for an event and collects failures.
 *
 * Deliberately does not short-circuit: if the Spruce notification fails, the
 * audit handler on the same event should still run.
 */
async function runHandlers(
  handlers: DomainEventHandler[],
  event: DomainEvent,
): Promise<string[]> {
  const settled = await Promise.allSettled(handlers.map((handler) => handler(event)));

  return settled
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) =>
      r.reason instanceof Error ? r.reason.message : String(r.reason ?? "Unknown handler error"),
    );
}
