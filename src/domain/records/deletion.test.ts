import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECOVERY_DAYS,
  admissionConsequences,
  binned,
  confirmsDeletion,
  daysLeft,
  daysLeftLabel,
  partitionExpired,
  purgeDate,
  recoveryDaysFor,
  whyNotDeletable,
} from "./deletion";

describe("the recovery window", () => {
  it("is thirty days for most things and sixty for a person's file", () => {
    expect(DEFAULT_RECOVERY_DAYS).toBe(30);
    expect(recoveryDaysFor("document")).toBe(30);
    expect(recoveryDaysFor("employee")).toBe(60);
    expect(recoveryDaysFor("client")).toBe(60);
  });

  it("counts down from the day of deletion", () => {
    const r = { kind: "client" as const, deletedAt: "2026-09-01T10:00:00Z" };
    expect(purgeDate(r)).toBe("2026-10-31");
    expect(daysLeft(r, "2026-09-11")).toBe(50);
    expect(daysLeftLabel(r, "2026-10-30")).toBe("1 day left");
    expect(daysLeftLabel(r, "2026-11-05")).toBe("Being deleted permanently");
  });

  it("separates what stays from what the purge takes", () => {
    const fresh = { kind: "contact" as const, deletedAt: "2026-09-20T00:00:00Z" };
    const stale = { kind: "contact" as const, deletedAt: "2026-08-01T00:00:00Z" };
    const { keep, purge } = partitionExpired([fresh, stale], "2026-09-24");
    expect(keep).toEqual([fresh]);
    expect(purge).toEqual([stale]);
  });
});

describe("confirming and refusing", () => {
  it("needs the word in capitals", () => {
    expect(confirmsDeletion(" DELETE ")).toBe(true);
    expect(confirmsDeletion("delete")).toBe(false);
  });

  it("refuses to delete an admitted client", () => {
    expect(whyNotDeletable({ stage: "admitted" })).toMatch(/discharge/);
    expect(whyNotDeletable({ stage: "assessment", activated: true })).toMatch(/discharge/);
    expect(whyNotDeletable({ stage: "assessment" })).toBeNull();
  });

  it("lists what goes with an admission", () => {
    expect(admissionConsequences({ hasIntake: true, hasAssessment: false, hasConsents: true })).toEqual([
      "The lead and everything typed against it",
      "The phone intake and its answers",
      "Any consent decisions and signatures taken",
    ]);
  });

  it("stamps a binned record with who and when", () => {
    const r = binned({ id: "x", kind: "sop", label: "Fall Prevention", sublabel: "Procedure", by: "Karynn", payload: { v: 1 }, at: "2026-09-24T00:00:00Z" });
    expect(r.deletedBy).toBe("Karynn");
    expect(r.reason).toBeNull();
    expect(r.payload).toEqual({ v: 1 });
  });
});
