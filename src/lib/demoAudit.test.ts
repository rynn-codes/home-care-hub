import { describe, expect, it } from "vitest";
import { auditPhrase, recordAudit } from "@/lib/demoAudit";

const AT = "2026-08-21T10:00:00.000Z";

describe("recording who did what", () => {
  it("puts the entry on the trail with the actor on it", async () => {
    const result = await recordAudit(
      {
        organizationId: "org-1",
        actor: { type: "user", userId: "Karynn Verrett" },
        action: "admission.approved",
        entityType: "admission",
        entityId: "adm-1",
        after: { approvedBy: "Karynn Verrett" },
      },
      AT,
    );

    expect("entry" in result).toBe(true);
    if (!("entry" in result)) return;
    expect(result.entry.actorUserId).toBe("Karynn Verrett");
    expect(result.entry.action).toBe("admission.approved");
    expect(result.entry.at).toBe(AT);
  });

  it("redacts before anything is stored, not after", async () => {
    // §28. The entry records that a thing changed and by whom; it is not a
    // second copy of the record. Asserted on what the STORE received rather
    // than on what the caller passed, so a redaction that stopped working would
    // fail here rather than being echoed back looking clean.
    const result = await recordAudit(
      {
        organizationId: "org-1",
        actor: { type: "user", userId: "u1" },
        action: "intake.corrected",
        entityType: "intake",
        after: { ssn: "123-45-6789", signature: "data:image/png;base64,AAA", firstName: "Marcus" },
      },
      AT,
    );

    if (!("entry" in result)) throw new Error("expected an entry");
    expect(result.entry.after).toEqual({
      ssn: "[redacted]",
      signature: "[redacted]",
      firstName: "Marcus",
    });
  });

  it("refuses to put a person's name on something the system did", async () => {
    // A store failure is operational and is returned. A misattributed actor is
    // a programming error and must fail in the test run — it would otherwise be
    // written, and be indistinguishable afterwards from a thing she did.
    await expect(
      recordAudit(
        {
          organizationId: "org-1",
          actor: { type: "system", userId: "Karynn Verrett" },
          action: "payroll.approved",
          entityType: "payroll_run",
        },
        AT,
      ),
    ).rejects.toThrow(/must not carry a user id/);
  });

  it("refuses a user action with nobody named", async () => {
    await expect(
      recordAudit(
        {
          organizationId: "org-1",
          actor: { type: "user", userId: null },
          action: "signature.captured",
          entityType: "consent_session",
        },
        AT,
      ),
    ).rejects.toThrow(/must record which user/);
  });

  it("keeps a non-user actor's label, which is the only place it says which one", async () => {
    const result = await recordAudit(
      {
        organizationId: "org-1",
        actor: { type: "system", label: "outbox worker" },
        action: "integration.retried",
        entityType: "domain_event",
      },
      AT,
    );
    if (!("entry" in result)) throw new Error("expected an entry");
    expect(result.entry.actorType).toBe("system");
    expect(result.entry.actorUserId).toBeNull();
    expect(result.entry.actorLabel).toBe("outbox worker");
  });

  it("gives every entry its own id, so two identical acts are two entries", async () => {
    const one = await recordAudit(
      { organizationId: "o", actor: { type: "user", userId: "u" }, action: "schedule.changed", entityType: "visit" },
      AT,
    );
    const two = await recordAudit(
      { organizationId: "o", actor: { type: "user", userId: "u" }, action: "schedule.changed", entityType: "visit" },
      AT,
    );
    if (!("entry" in one) || !("entry" in two)) throw new Error("expected entries");
    expect(one.entry.id).not.toBe(two.entry.id);
  });
});

describe("reading the trail", () => {
  it("says what happened in words somebody would use out loud", () => {
    // "admission.approved" is a key. "approved the admission" is a sentence.
    const entry = {
      id: "a", at: AT, actorType: "user" as const, actorUserId: "Karynn", actorLabel: null,
      action: "admission.approved", entityType: "admission", entityId: null,
      before: null, after: null, metadata: null,
    };
    expect(auditPhrase(entry)).toBe("approved the admission");
    expect(auditPhrase({ ...entry, action: "something.unmapped" })).toBe("something unmapped");
  });
});
