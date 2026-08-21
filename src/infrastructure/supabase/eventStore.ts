import type {
  DomainEvent,
  DomainEventStore,
  DomainEventStatus,
  DomainEventType,
  NewDomainEvent,
} from "@/domain/events/types";

/**
 * The Postgres domain event store — the outbox.
 *
 * TWO OPERATIONS ARE DATABASE FUNCTIONS, NOT QUERIES, and that is the point of
 * this file rather than an implementation detail.
 *
 * `claimDue` calls `claim_domain_events`, which selects and marks processing in
 * one statement using `for update skip locked`. It cannot be done from here.
 * Two workers running in the same minute — the normal state of affairs the
 * moment anything is deployed more than once — would otherwise both read the
 * same pending rows and both send the same text message. Reading then updating
 * from the client leaves a window between the two, and the window is exactly
 * where the duplicate lives.
 *
 * `markProcessed` and `markFailed` call `finish_domain_event` for the same
 * reason in reverse: 0003 grants application sessions insert and select on
 * `domain_events` and nothing else, on purpose. A browser tab must not be able
 * to mark work done.
 *
 * Neither function is granted to `authenticated`. The worker connects with the
 * service role.
 */

export interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface MinimalSupabase {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): {
      select(): { maybeSingle(): Promise<QueryResult<DomainEventRow>> };
    };
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<QueryResult<DomainEventRow[]>>;
}

export interface DomainEventRow {
  id: string;
  organization_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string | null;
  payload_json: Record<string, unknown> | null;
  status: string;
  attempts: number;
  idempotency_key: string | null;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
  retry_at?: string | null;
}

export function toDomainEvent(row: DomainEventRow): DomainEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventType: row.event_type as DomainEventType,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload_json ?? {},
    status: row.status as DomainEventStatus,
    attempts: row.attempts,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    lastError: row.last_error,
  };
}

/** Postgres's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export class SupabaseDomainEventStore implements DomainEventStore {
  constructor(private readonly client: MinimalSupabase) {}

  /**
   * Returns null when the idempotency key already exists.
   *
   * The duplicate is detected by the unique index rather than by looking first.
   * A check-then-insert has a race in it, and this is precisely the code path
   * that exists to survive a double-clicked button — so the check has to be the
   * one the database makes atomically, not one this method makes hopefully.
   */
  async append(input: NewDomainEvent): Promise<DomainEvent | null> {
    const { data, error } = await this.client
      .from("domain_events")
      .insert([
        {
          organization_id: input.organizationId,
          event_type: input.eventType,
          aggregate_type: input.aggregateType,
          aggregate_id: input.aggregateId ?? null,
          payload_json: input.payload ?? {},
          idempotency_key: input.idempotencyKey ?? null,
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) return null;
      throw new Error(`Domain event could not be appended: ${error.message}`);
    }
    return data ? toDomainEvent(data) : null;
  }

  async claimDue(limit: number, now: Date): Promise<DomainEvent[]> {
    const { data, error } = await this.client.rpc("claim_domain_events", {
      max_events: limit,
      as_of: now.toISOString(),
    });
    if (error) throw new Error(`Could not claim domain events: ${error.message}`);
    return (data ?? []).map(toDomainEvent);
  }

  async markProcessed(id: string, at: Date): Promise<void> {
    const { error } = await this.client.rpc("finish_domain_event", {
      event_id: id,
      succeeded: true,
      at: at.toISOString(),
    });
    if (error) throw new Error(`Could not mark event processed: ${error.message}`);
  }

  /**
   * `retryAt` of null means the worker has given up.
   *
   * That is a real outcome and not a missing value: the row stays `failed`, the
   * claim query steps over it, and it sits in the abandoned index waiting for a
   * person. An event that retries forever is the same as an event nobody looks
   * at, except it also costs money.
   *
   * `attempts` is not passed. The database increments it at claim time, because
   * an event that crashes the worker hard enough that this method never runs
   * would otherwise keep its count at zero and be retried forever.
   */
  async markFailed(
    id: string,
    error: string,
    _attempts: number,
    retryAt: Date | null,
  ): Promise<void> {
    const { error: rpcError } = await this.client.rpc("finish_domain_event", {
      event_id: id,
      succeeded: false,
      at: new Date().toISOString(),
      error_text: error,
      next_retry: retryAt ? retryAt.toISOString() : null,
    });
    if (rpcError) throw new Error(`Could not mark event failed: ${rpcError.message}`);
  }
}
