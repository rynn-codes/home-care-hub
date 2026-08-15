import { describe, expect, it, vi } from "vitest";
import { AuditError, createAuditWriter, redact, validateActor } from "@/domain/audit/audit";

function memoryAuditStore() {
  const entries: unknown[] = [];
  return {
    entries,
    append: vi.fn(async (entry: unknown) => {
      entries.push(entry);
    }),
  };
}

describe("audit actors", () => {
  it("requires a user id for a user action", () => {
    expect(() => validateActor({ type: "user" })).toThrow(AuditError);
    expect(() => validateActor({ type: "user", userId: "u1" })).not.toThrow();
  });

  // AI and background work must be attributable as themselves. Letting them
  // borrow a user id would put a person's name on something they did not do —
  // the opposite of what an audit log is for.
  it("refuses to attribute non-human actions to a person", () => {
    for (const type of ["ai", "system", "integration"] as const) {
      expect(() => validateActor({ type, userId: "u1" })).toThrow(AuditError);
      expect(() => validateActor({ type })).not.toThrow();
    }
  });
});

describe("audit redaction", () => {
  it("redacts sensitive fields", () => {
    const out = redact({
      firstName: "Marcus",
      ssn: "123-45-6789",
      signature: "data:image/png;base64,AAAA",
      password: "hunter2",
    });

    expect(out).toMatchObject({
      firstName: "Marcus",
      ssn: "[redacted]",
      signature: "[redacted]",
      password: "[redacted]",
    });
  });

  it("redacts nested fields and is case-insensitive about the key", () => {
    const out = redact({
      client: { firstName: "Marcus", socialSecurityNumber: "123-45-6789" },
      tokens: { accessToken: "abc" },
    });

    expect(out).toEqual({
      client: { firstName: "Marcus", socialSecurityNumber: "[redacted]" },
      tokens: { accessToken: "[redacted]" },
    });
  });

  it("passes through null", () => {
    expect(redact(null)).toBeNull();
  });
});

describe("audit writer", () => {
  it("records a change with before and after", async () => {
    const store = memoryAuditStore();
    const audit = createAuditWriter(store);

    const result = await audit.record({
      organizationId: "org-1",
      actor: { type: "user", userId: "u1" },
      action: "admission.stage_changed",
      entityType: "admissions",
      entityId: "adm-1",
      before: { stage: "phone_intake" },
      after: { stage: "assessment" },
    });

    expect(result.ok).toBe(true);
    expect(store.entries).toHaveLength(1);
  });

  it("redacts on the way in, so nothing sensitive reaches the store", async () => {
    const store = memoryAuditStore();
    const audit = createAuditWriter(store);

    await audit.record({
      organizationId: "org-1",
      actor: { type: "system" },
      action: "signature.captured",
      entityType: "consent_sessions",
      after: { signerName: "Susan Bell", signature: "data:image/png;base64,AAAA" },
    });

    expect(store.entries[0]).toMatchObject({
      after: { signerName: "Susan Bell", signature: "[redacted]" },
    });
  });

  // Losing an audit entry is bad. Rolling back a completed assessment because
  // the audit write failed is worse.
  it("reports a store failure instead of throwing into the caller", async () => {
    const store = memoryAuditStore();
    store.append.mockRejectedValueOnce(new Error("database unreachable"));
    const audit = createAuditWriter(store);

    const result = await audit.record({
      organizationId: "org-1",
      actor: { type: "user", userId: "u1" },
      action: "assessment.completed",
      entityType: "assessments",
    });

    expect(result).toEqual({ ok: false, error: "database unreachable" });
  });

  // A misattributed entry, by contrast, is a programming error and must be loud.
  it("still throws when the actor is invalid", async () => {
    const audit = createAuditWriter(memoryAuditStore());
    await expect(
      audit.record({
        organizationId: "org-1",
        actor: { type: "ai", userId: "u1" },
        action: "intake.corrected",
        entityType: "phone_intakes",
      }),
    ).rejects.toBeInstanceOf(AuditError);
  });
});
