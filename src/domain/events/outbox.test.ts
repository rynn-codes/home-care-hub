import { describe, expect, it, vi } from "vitest";
import { backoffMs, processOutbox } from "@/domain/events/outbox";
import { createMemoryEventStore } from "@/domain/events/memoryStore";
import { createMockMessagingProvider } from "@/adapters/messaging/mock";
import { MessagingDisabledError } from "@/adapters/messaging/types";

const ORG = "org-1";

function scheduledEvent(idempotencyKey?: string) {
  return {
    organizationId: ORG,
    eventType: "assessment.scheduled" as const,
    aggregateType: "admission",
    aggregateId: "adm-1",
    payload: { client: "Marcus Bell", when: "2026-08-17T10:30:00Z" },
    idempotencyKey: idempotencyKey ?? null,
  };
}

describe("domain event store", () => {
  it("appends a pending event", async () => {
    const store = createMemoryEventStore();
    const event = await store.append(scheduledEvent());
    expect(event?.status).toBe("pending");
    expect(event?.attempts).toBe(0);
  });

  // A double-clicked Schedule button must not notify the family twice.
  it("refuses a second event with the same idempotency key", async () => {
    const store = createMemoryEventStore();
    expect(await store.append(scheduledEvent("sched-1"))).not.toBeNull();
    expect(await store.append(scheduledEvent("sched-1"))).toBeNull();
    expect(store.all()).toHaveLength(1);
  });

  it("allows the same key for a different event type", async () => {
    const store = createMemoryEventStore();
    await store.append(scheduledEvent("k"));
    const other = await store.append({
      ...scheduledEvent("k"),
      eventType: "assessment.cancelled",
    });
    expect(other).not.toBeNull();
  });
});

describe("outbox worker", () => {
  it("runs handlers and marks the event processed", async () => {
    const store = createMemoryEventStore();
    const event = await store.append(scheduledEvent());
    const handler = vi.fn().mockResolvedValue(undefined);

    const result = await processOutbox({
      store,
      handlers: { "assessment.scheduled": [handler] },
    });

    expect(result).toMatchObject({ claimed: 1, processed: 1, failed: 0 });
    expect(handler).toHaveBeenCalledOnce();
    expect(store.byId(event!.id)?.status).toBe("processed");
  });

  it("treats an event with no handler as done, not as an error", async () => {
    const store = createMemoryEventStore();
    const event = await store.append(scheduledEvent());

    const result = await processOutbox({ store, handlers: {} });

    expect(result.processed).toBe(1);
    expect(store.byId(event!.id)?.status).toBe("processed");
  });

  // The central rule of section 16. This is the test the brief asks for by name
  // in section 48: "assessment saved but Spruce fails".
  it("keeps the event and the error when a notification fails", async () => {
    const store = createMemoryEventStore();
    const event = await store.append(scheduledEvent());
    const failing = vi.fn().mockRejectedValue(new Error("Spruce timed out"));

    const result = await processOutbox({
      store,
      handlers: { "assessment.scheduled": [failing] },
      now: () => new Date("2026-08-16T12:00:00Z"),
    });

    expect(result).toMatchObject({ failed: 1, processed: 0 });

    const stored = store.byId(event!.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.attempts).toBe(1);
    expect(stored?.lastError).toContain("Spruce timed out");
    // The work is not lost — it is queued for another go.
    expect(stored?.processedAt).toBeNull();
  });

  it("retries a failed event once its backoff has elapsed", async () => {
    const store = createMemoryEventStore();
    await store.append(scheduledEvent());
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);

    let clock = new Date("2026-08-16T12:00:00Z");
    const opts = {
      store,
      handlers: { "assessment.scheduled": [handler] },
      baseDelayMs: 1000,
      now: () => clock,
    };

    await processOutbox(opts);
    expect(store.all()[0].status).toBe("failed");

    // Too soon: still backing off.
    clock = new Date("2026-08-16T12:00:00.500Z");
    expect((await processOutbox(opts)).claimed).toBe(0);

    // Backoff elapsed.
    clock = new Date("2026-08-16T12:00:02Z");
    const result = await processOutbox(opts);
    expect(result.processed).toBe(1);
    expect(store.all()[0].status).toBe("processed");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("stops retrying after maxAttempts and leaves the failure visible", async () => {
    const store = createMemoryEventStore();
    await store.append(scheduledEvent());
    const handler = vi.fn().mockRejectedValue(new Error("provider down"));

    let clock = new Date("2026-08-16T12:00:00Z");
    const opts = {
      store,
      handlers: { "assessment.scheduled": [handler] },
      maxAttempts: 3,
      baseDelayMs: 1000,
      now: () => clock,
    };

    for (let i = 0; i < 3; i += 1) {
      await processOutbox(opts);
      clock = new Date(clock.getTime() + 60_000);
    }

    expect(handler).toHaveBeenCalledTimes(3);
    const stored = store.all()[0];
    expect(stored.attempts).toBe(3);
    expect(stored.status).toBe("failed");
    expect(stored.lastError).toContain("provider down");

    // Exhausted: no longer picked up, but still on record for a human.
    expect((await processOutbox(opts)).claimed).toBe(0);
  });

  // One integration having a bad minute must not stop the audit handler beside
  // it, nor the rest of the batch.
  it("runs every handler even when one throws", async () => {
    const store = createMemoryEventStore();
    await store.append(scheduledEvent());
    const failing = vi.fn().mockRejectedValue(new Error("spruce down"));
    const other = vi.fn().mockResolvedValue(undefined);

    await processOutbox({
      store,
      handlers: { "assessment.scheduled": [failing, other] },
    });

    expect(other).toHaveBeenCalledOnce();
    expect(store.all()[0].lastError).toContain("spruce down");
  });

  it("continues the batch after one event fails", async () => {
    const store = createMemoryEventStore();
    await store.append(scheduledEvent("a"));
    await store.append({ ...scheduledEvent("b"), aggregateId: "adm-2" });

    let call = 0;
    const handler = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new Error("first one failed");
    });

    const result = await processOutbox({
      store,
      handlers: { "assessment.scheduled": [handler] },
    });

    expect(result.claimed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(1);
  });

  it("backs off exponentially up to a ceiling", () => {
    expect(backoffMs(1, 1000, 60_000)).toBe(1000);
    expect(backoffMs(2, 1000, 60_000)).toBe(2000);
    expect(backoffMs(3, 1000, 60_000)).toBe(4000);
    expect(backoffMs(20, 1000, 60_000)).toBe(60_000);
  });
});

describe("messaging provider", () => {
  it("refuses to send when the flag is off, rather than faking success", async () => {
    const provider = createMockMessagingProvider({ enabled: false });
    await expect(
      provider.sendMessage({
        idempotencyKey: "k",
        channel: "sms",
        toExternalId: "c1",
        templateKey: "assessment_scheduled",
        variables: {},
      }),
    ).rejects.toBeInstanceOf(MessagingDisabledError);
    expect(provider.sendCount()).toBe(0);
  });

  it("returns a provider message id on success", async () => {
    const provider = createMockMessagingProvider({ enabled: true });
    const result = await provider.sendMessage({
      idempotencyKey: "k1",
      channel: "sms",
      toExternalId: "c1",
      templateKey: "assessment_scheduled",
      variables: { when: "Aug 17" },
    });

    expect(result.status).toBe("sent");
    if (result.status === "sent") expect(result.providerMessageId).toBeTruthy();
  });

  // A retried outbox attempt must not send the family a second copy.
  it("does not send twice for the same idempotency key", async () => {
    const provider = createMockMessagingProvider({ enabled: true });
    const input = {
      idempotencyKey: "same",
      channel: "sms" as const,
      toExternalId: "c1",
      templateKey: "assessment_scheduled",
      variables: {},
    };
    const first = await provider.sendMessage(input);
    const second = await provider.sendMessage(input);

    expect(second).toEqual(first);
    expect(provider.sendCount()).toBe(1);
  });

  it("reports a failure without pretending anything was sent", async () => {
    const provider = createMockMessagingProvider({
      enabled: true,
      failWith: { errorCode: "timeout", errorMessage: "Provider timed out", retryable: true },
    });

    const result = await provider.sendMessage({
      idempotencyKey: "k",
      channel: "sms",
      toExternalId: "c1",
      templateKey: "assessment_scheduled",
      variables: {},
    });

    expect(result.status).toBe("failed");
    expect(provider.sendCount()).toBe(0);
  });
});
