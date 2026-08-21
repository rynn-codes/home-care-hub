import { describe, expect, it, vi } from "vitest";
import { SupabaseAuditStore, auditRow, type MinimalSupabase as AuditClient } from "@/infrastructure/supabase/auditStore";
import {
  SupabaseDomainEventStore,
  toDomainEvent,
  type DomainEventRow,
  type MinimalSupabase as EventClient,
} from "@/infrastructure/supabase/eventStore";
import { createAuditWriter } from "@/domain/audit/audit";

/**
 * Contract tests for the two Supabase adapters.
 *
 * They run against a fake client rather than a database, and that is the point:
 * the paths worth testing here are the failure paths — a rejected insert, a
 * duplicate idempotency key, a worker giving up — and those are the ones nobody
 * exercises by hand against a real Postgres. The SQL side of the same behaviour
 * is asserted in supabase/tests/outbox_test.sql.
 */

function auditClient(error: { message: string } | null = null) {
  const inserted: Record<string, unknown>[][] = [];
  const client: AuditClient = {
    from: () => ({
      insert: async (rows) => {
        inserted.push(rows);
        return { error };
      },
    }),
  };
  return { client, inserted };
}

describe("the audit store", () => {
  it("maps every field onto the columns in 0002", () => {
    const row = auditRow({
      organizationId: "org-1",
      actor: { type: "user", userId: "u-karynn" },
      action: "admission.approved",
      entityType: "admission",
      entityId: "adm-1",
      before: { stage: "ready_for_admission" },
      after: { stage: "admitted" },
      metadata: { note: "Start Monday" },
    });

    expect(row).toEqual({
      organization_id: "org-1",
      actor_type: "user",
      actor_user_id: "u-karynn",
      action: "admission.approved",
      entity_type: "admission",
      entity_id: "adm-1",
      before_json: { stage: "ready_for_admission" },
      after_json: { stage: "admitted" },
      metadata_json: { note: "Start Monday" },
    });
  });

  it("keeps a non-user actor's label, which is the only place it says which one", () => {
    const row = auditRow({
      organizationId: "org-1",
      actor: { type: "system", label: "outbox worker" },
      action: "integration.retried",
      entityType: "domain_event",
    });
    expect(row.actor_user_id).toBeNull();
    expect(row.metadata_json).toEqual({ actor_label: "outbox worker" });
  });

  it("redacts before it reaches the database, not after", () => {
    // §28. The entry records that a thing changed and by whom; it is not a
    // second copy of the record, and a Social Security number does not belong
    // in it. Asserted through the writer because that is where redaction lives.
    const { client, inserted } = auditClient();
    const writer = createAuditWriter(new SupabaseAuditStore(client));

    return writer
      .record({
        organizationId: "org-1",
        actor: { type: "user", userId: "u1" },
        action: "intake.corrected",
        entityType: "intake",
        after: { ssn: "123-45-6789", firstName: "Marcus" },
      })
      .then(() => {
        expect(inserted[0][0].after_json).toEqual({
          ssn: "[redacted]",
          firstName: "Marcus",
        });
      });
  });

  it("reports a failed write rather than throwing into the caller", async () => {
    // Losing an audit entry is bad. Rolling back a completed assessment because
    // the audit write failed is worse.
    const { client } = auditClient({ message: "permission denied for table audit_entries" });
    const writer = createAuditWriter(new SupabaseAuditStore(client));

    const result = await writer.record({
      organizationId: "org-1",
      actor: { type: "user", userId: "u1" },
      action: "signature.captured",
      entityType: "consent_session",
    });

    expect(result.ok).toBe(false);
    expect("error" in result && result.error).toContain("permission denied");
  });

  it("still refuses a misattributed actor loudly", async () => {
    // A store failure is operational. Putting a person's name on something they
    // did not do is a programming error and must fail in the test run.
    const { client } = auditClient();
    const writer = createAuditWriter(new SupabaseAuditStore(client));
    await expect(
      writer.record({
        organizationId: "org-1",
        actor: { type: "system", userId: "u-karynn" },
        action: "payroll.approved",
        entityType: "payroll_run",
      }),
    ).rejects.toThrow(/must not carry a user id/);
  });
});

// ---------------------------------------------------------------------------

const ROW: DomainEventRow = {
  id: "evt-1",
  organization_id: "org-1",
  event_type: "assessment.scheduled",
  aggregate_type: "admission",
  aggregate_id: "adm-1",
  payload_json: { at: "2026-08-24T10:30:00Z" },
  status: "processing",
  attempts: 1,
  idempotency_key: "adm-1:2026-08-24",
  created_at: "2026-08-21T09:00:00Z",
  processed_at: null,
  last_error: null,
  retry_at: null,
};

function eventClient(over: Partial<{ insertError: { message: string; code?: string } | null; rpcError: { message: string } | null; rows: DomainEventRow[] }> = {}) {
  // Typed on the way in rather than inferred: without the parameter types the
  // mock's calls are `[]` and reading `calls[0][1]` is a compile error.
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    data: over.rows ?? [],
    error: over.rpcError ?? null,
  }));
  const client: EventClient = {
    from: () => ({
      insert: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: over.insertError ? null : ROW,
            error: over.insertError ?? null,
          }),
        }),
      }),
    }),
    rpc,
  };
  return { client, rpc };
}

describe("the outbox store", () => {
  it("reads a duplicate idempotency key off the unique index, not off a lookup", async () => {
    // A check-then-insert has a race in it, and this is the code path that
    // exists to survive a double-clicked button.
    const { client } = eventClient({
      insertError: { message: "duplicate key value", code: "23505" },
    });
    const store = new SupabaseDomainEventStore(client);
    expect(await store.append({
      organizationId: "org-1",
      eventType: "assessment.scheduled",
      aggregateType: "admission",
      idempotencyKey: "adm-1:2026-08-24",
    })).toBeNull();
  });

  it("does not swallow a real insert failure as a duplicate", async () => {
    const { client } = eventClient({ insertError: { message: "connection reset" } });
    const store = new SupabaseDomainEventStore(client);
    await expect(
      store.append({ organizationId: "org-1", eventType: "assessment.scheduled", aggregateType: "admission" }),
    ).rejects.toThrow(/connection reset/);
  });

  it("claims through the database function rather than a select and an update", async () => {
    // The window between reading and updating is exactly where the duplicate
    // text message lives.
    const { client, rpc } = eventClient({ rows: [ROW] });
    const store = new SupabaseDomainEventStore(client);

    const claimed = await store.claimDue(5, new Date("2026-08-21T10:00:00Z"));

    expect(rpc).toHaveBeenCalledWith("claim_domain_events", {
      max_events: 5,
      as_of: "2026-08-21T10:00:00.000Z",
    });
    expect(claimed[0].id).toBe("evt-1");
    expect(claimed[0].payload).toEqual({ at: "2026-08-24T10:30:00Z" });
  });

  it("finishes through the database function, because a session may not mark work done", async () => {
    const { client, rpc } = eventClient();
    const store = new SupabaseDomainEventStore(client);

    await store.markProcessed("evt-1", new Date("2026-08-21T10:00:00Z"));
    expect(rpc).toHaveBeenCalledWith("finish_domain_event", {
      event_id: "evt-1",
      succeeded: true,
      at: "2026-08-21T10:00:00.000Z",
    });
  });

  it("records giving up as a null retry rather than as a missing value", async () => {
    // The row stays failed, the claim steps over it, and it waits for a person.
    const { client, rpc } = eventClient();
    const store = new SupabaseDomainEventStore(client);

    await store.markFailed("evt-1", "Spruce returned 500", 5, null);

    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.succeeded).toBe(false);
    expect(args.error_text).toBe("Spruce returned 500");
    expect(args.next_retry).toBeNull();
  });

  it("passes a backoff through when there is one", async () => {
    const { client, rpc } = eventClient();
    const store = new SupabaseDomainEventStore(client);
    await store.markFailed("evt-1", "timeout", 1, new Date("2026-08-21T10:05:00Z"));
    expect((rpc.mock.calls[0][1] as Record<string, unknown>).next_retry).toBe(
      "2026-08-21T10:05:00.000Z",
    );
  });

  it("maps a row onto the shape the worker was written against", () => {
    const event = toDomainEvent(ROW);
    expect(event.organizationId).toBe("org-1");
    expect(event.idempotencyKey).toBe("adm-1:2026-08-24");
    expect(event.payload).toEqual({ at: "2026-08-24T10:30:00Z" });
  });

  it("gives an event with no payload an object rather than null", () => {
    // The worker's handlers index into this. A null here is a crash in whichever
    // handler runs first, months later.
    expect(toDomainEvent({ ...ROW, payload_json: null }).payload).toEqual({});
  });
});
