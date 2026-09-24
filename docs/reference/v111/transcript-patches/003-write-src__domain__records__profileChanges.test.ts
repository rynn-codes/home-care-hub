import { describe, expect, it } from "vitest";
import { blankProfile } from "@/domain/employees/profile";
import {
  DEFAULT_PROFILE_UNDO_HOURS,
  changeSummary,
  changedFieldLabels,
  isLatestForRecord,
  latestUndoable,
  undoDeadline,
  undoableChanges,
  withinUndoWindow,
  type ProfileChange,
} from "./profileChanges";

const change = (over: Partial<ProfileChange>): ProfileChange => ({
  id: "chg-1",
  kind: "employee",
  entityId: "emp-1",
  name: "Bedjine C",
  what: "profile",
  summary: "Phone (mobile)",
  before: null,
  changedAt: "2026-09-21T10:00:00.000Z",
  changedBy: "Karynn V",
  ...over,
});

describe("the undo window", () => {
  it("defaults to Karynn's seventy-two hours", () => {
    expect(DEFAULT_PROFILE_UNDO_HOURS).toBe(72);
  });

  it("closes exactly the configured number of hours after the change", () => {
    const c = change({});
    expect(undoDeadline(c, 72)).toBe("2026-09-24T10:00:00.000Z");
    expect(withinUndoWindow(c, 72, "2026-09-24T09:59:59.000Z")).toBe(true);
    expect(withinUndoWindow(c, 72, "2026-09-24T10:00:00.000Z")).toBe(false);
  });

  it("honours a shorter or longer setting", () => {
    const c = change({});
    expect(withinUndoWindow(c, 1, "2026-09-21T10:30:00.000Z")).toBe(true);
    expect(withinUndoWindow(c, 1, "2026-09-21T11:30:00.000Z")).toBe(false);
    expect(withinUndoWindow(c, 240, "2026-09-30T10:00:00.000Z")).toBe(true);
  });

  it("lists what is still undoable, newest first, and drops the rest", () => {
    const old = change({ id: "a", changedAt: "2026-09-10T10:00:00.000Z" });
    const mid = change({ id: "b", changedAt: "2026-09-20T10:00:00.000Z" });
    const recent = change({ id: "c", changedAt: "2026-09-21T10:00:00.000Z" });
    expect(undoableChanges([old, mid, recent], 72, "2026-09-21T12:00:00.000Z").map((c) => c.id)).toEqual([
      "c",
      "b",
    ]);
  });
});

describe("only the newest change to a record can be undone", () => {
  const monday = change({ id: "mon", what: "status", summary: "Active → On hold", changedAt: "2026-09-21T09:00:00.000Z" });
  const tuesday = change({ id: "tue", changedAt: "2026-09-22T09:00:00.000Z" });
  const other = change({ id: "oth", entityId: "emp-2", changedAt: "2026-09-22T12:00:00.000Z" });

  it("points Undo at the latest change for that person", () => {
    expect(latestUndoable([monday, tuesday, other], "employee", "emp-1", 72, "2026-09-22T13:00:00.000Z")?.id).toBe(
      "tue",
    );
    expect(latestUndoable([monday, tuesday, other], "employee", "emp-2", 72, "2026-09-22T13:00:00.000Z")?.id).toBe(
      "oth",
    );
  });

  it("marks earlier changes superseded until the later one is undone", () => {
    expect(isLatestForRecord([monday, tuesday], monday)).toBe(false);
    expect(isLatestForRecord([monday, tuesday], tuesday)).toBe(true);
    // Undo Tuesday and Monday is undoable again.
    expect(isLatestForRecord([monday], monday)).toBe(true);
  });

  it("returns null once the window has closed", () => {
    expect(latestUndoable([monday], "employee", "emp-1", 72, "2026-09-30T00:00:00.000Z")).toBeNull();
  });

  it("does not confuse a client with an employee of the same id", () => {
    expect(latestUndoable([monday], "client", "emp-1", 72, "2026-09-21T10:00:00.000Z")).toBeNull();
  });
});

describe("what changed, in words", () => {
  it("names each changed field once, in the form's order", () => {
    const before = blankProfile();
    const after = {
      ...before,
      email: "b@example.com",
      firstName: "Bedjine",
      referralSource: "Other",
      referralSourceOther: "Church",
    };
    expect(changedFieldLabels(before, after)).toEqual(["First name", "Referral source", "Email"]);
  });

  it("sees a change inside an emergency contact or the address", () => {
    const before = blankProfile();
    const after = {
      ...before,
      address: { ...before.address, city: "Houston" },
      emergencyContacts: before.emergencyContacts.map((c, i) =>
        i === 0 ? { ...c, relationship: "Other", relationshipOther: "Neighbour" } : c,
      ),
    };
    expect(changedFieldLabels(before, after)).toEqual(["Address", "Emergency contacts"]);
  });

  it("reports nothing when nothing moved", () => {
    expect(changedFieldLabels(blankProfile(), blankProfile())).toEqual([]);
    expect(changeSummary([])).toBe("No fields changed");
  });

  it("summarises a long list without listing all of it", () => {
    expect(changeSummary(["A", "B"])).toBe("A, B");
    expect(changeSummary(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });
});
