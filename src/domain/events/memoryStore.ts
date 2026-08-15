import type {
  DomainEvent,
  DomainEventStore,
  NewDomainEvent,
} from "@/domain/events/types";

/**
 * In-memory domain event store.
 *
 * Mirrors the behaviour of supabase/migrations/0002_audit_and_events.sql —
 * notably the unique idempotency key per organization and event type — so the
 * outbox worker can be developed and tested before the migrations reach a real
 * database, and so its retry paths are exercised in CI rather than by hand.
 *
 * Not for production. The real store is the Postgres one.
 */
export function createMemoryEventStore(): DomainEventStore & {
  all: () => DomainEvent[];
  byId: (id: string) => DomainEvent | undefined;
} {
  const events: DomainEvent[] = [];
  const retryAt = new Map<string, Date>();
  let counter = 0;

  const idempotencyKeyOf = (e: { organizationId: string; eventType: string; idempotencyKey?: string | null }) =>
    e.idempotencyKey ? `${e.organizationId}:${e.eventType}:${e.idempotencyKey}` : null;

  return {
    all: () => events,
    byId: (id) => events.find((e) => e.id === id),

    async append(input: NewDomainEvent): Promise<DomainEvent | null> {
      const key = idempotencyKeyOf(input);
      if (key && events.some((e) => idempotencyKeyOf(e) === key)) {
        return null;
      }

      counter += 1;
      const event: DomainEvent = {
        id: `evt-${counter}`,
        organizationId: input.organizationId,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId ?? null,
        payload: input.payload ?? {},
        status: "pending",
        attempts: 0,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
        processedAt: null,
        lastError: null,
      };
      events.push(event);
      return event;
    },

    async claimDue(limit: number, now: Date): Promise<DomainEvent[]> {
      const due = events
        .filter((e) => {
          if (e.status !== "pending" && e.status !== "failed") return false;
          const next = retryAt.get(e.id);
          // A failed event with no retry time has exhausted its attempts and
          // must not be picked up again by the worker.
          if (e.status === "failed" && !next) return false;
          return !next || next <= now;
        })
        .slice(0, limit);

      for (const e of due) e.status = "processing";
      return due.map((e) => ({ ...e }));
    },

    async markProcessed(id: string, at: Date): Promise<void> {
      const event = events.find((e) => e.id === id);
      if (!event) return;
      event.status = "processed";
      event.processedAt = at.toISOString();
      event.lastError = null;
      retryAt.delete(id);
    },

    async markFailed(id, error, attempts, next): Promise<void> {
      const event = events.find((e) => e.id === id);
      if (!event) return;
      event.status = "failed";
      event.attempts = attempts;
      event.lastError = error;
      if (next) retryAt.set(id, next);
      else retryAt.delete(id);
    },
  };
}
