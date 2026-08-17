import { describe, expect, it } from "vitest";
import {
  findConflicts,
  hoursOf,
  isBlocked,
  openShifts,
  scheduleConflicts,
  type Visit,
} from "@/domain/scheduling/conflicts";

const visit = (over: Partial<Visit> & Pick<Visit, "id">): Visit => ({
  clientName: "Lian Huang",
  service: "Personal Care",
  caregiverName: "Samantha Chen",
  startsAt: "2026-08-17T08:00:00",
  endsAt: "2026-08-17T12:00:00",
  ...over,
});

describe("conflict detection", () => {
  it("finds nothing wrong with a clear slot", () => {
    const existing = [visit({ id: "a" })];
    const proposed = visit({ id: "b", clientName: "Ruth Alvarez", startsAt: "2026-08-17T13:00:00", endsAt: "2026-08-17T16:00:00" });
    expect(findConflicts(proposed, existing)).toEqual([]);
  });

  it("catches a caregiver double-booking and says who and when", () => {
    const existing = [visit({ id: "a" })];
    const proposed = visit({
      id: "b",
      clientName: "Ruth Alvarez",
      startsAt: "2026-08-17T10:00:00",
      endsAt: "2026-08-17T14:00:00",
    });

    const conflicts = findConflicts(proposed, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("caregiver_double_booked");
    expect(conflicts[0].severity).toBe("blocking");
    expect(conflicts[0].message).toContain("Samantha Chen");
    expect(conflicts[0].message).toContain("Lian Huang");
    expect(isBlocked(conflicts)).toBe(true);
  });

  it("catches a client being booked twice at once", () => {
    const existing = [visit({ id: "a" })];
    const proposed = visit({
      id: "b",
      caregiverName: "Grace Nwosu",
      startsAt: "2026-08-17T09:00:00",
      endsAt: "2026-08-17T11:00:00",
    });

    const kinds = findConflicts(proposed, existing).map((c) => c.kind);
    expect(kinds).toContain("client_double_booked");
  });

  // Schedulers deliberately book visits back to back. Treating a 12:00 finish
  // and a 12:00 start as a clash would make the board unusable.
  it("does not treat back-to-back visits as overlapping", () => {
    const existing = [visit({ id: "a" })];
    const proposed = visit({
      id: "b",
      clientName: "Ruth Alvarez",
      startsAt: "2026-08-17T12:00:00",
      endsAt: "2026-08-17T15:00:00",
    });
    expect(findConflicts(proposed, existing)).toEqual([]);
  });

  it("does not report a visit conflicting with itself when it is moved", () => {
    const existing = [visit({ id: "a" })];
    const moved = visit({ id: "a", startsAt: "2026-08-17T09:00:00", endsAt: "2026-08-17T13:00:00" });
    expect(findConflicts(moved, existing)).toEqual([]);
  });

  it("ignores open shifts when checking caregiver clashes", () => {
    const existing = [visit({ id: "a", caregiverName: null })];
    const proposed = visit({ id: "b", clientName: "Ruth Alvarez", caregiverName: null });
    const kinds = findConflicts(proposed, existing).map((c) => c.kind);
    expect(kinds).not.toContain("caregiver_double_booked");
  });

  // Overtime is a cost the scheduler may knowingly accept, not an error.
  it("warns about overtime without blocking the change", () => {
    // Mon 17 Aug 2026 through Fri 21 Aug, eight hours a day — exactly 40.
    const day = (n: number) => `2026-08-${String(17 + n).padStart(2, "0")}`;
    const existing = Array.from({ length: 5 }, (_, i) =>
      visit({
        id: `d${i}`,
        clientName: `Client ${i}`,
        startsAt: `${day(i)}T08:00:00`,
        endsAt: `${day(i)}T16:00:00`,
      }),
    );
    const proposed = visit({
      id: "extra",
      clientName: "Ruth Alvarez",
      startsAt: "2026-08-22T08:00:00",
      endsAt: "2026-08-22T14:00:00",
    });

    const conflicts = findConflicts(proposed, existing);
    const ot = conflicts.find((c) => c.kind === "overtime_risk");
    expect(ot).toBeDefined();
    expect(ot?.severity).toBe("warning");
    expect(ot?.message).toContain("over the overtime threshold");
    expect(isBlocked(conflicts)).toBe(false);
  });

  it("does not count another week's hours toward this week's overtime", () => {
    // The previous week: Mon 3 Aug through Fri 7 Aug, also a full 40 hours.
    const day = (n: number) => `2026-08-${String(3 + n).padStart(2, "0")}`;
    const lastWeek = Array.from({ length: 5 }, (_, i) =>
      visit({
        id: `p${i}`,
        clientName: `Client ${i}`,
        startsAt: `${day(i)}T08:00:00`,
        endsAt: `${day(i)}T16:00:00`,
      }),
    );
    const proposed = visit({ id: "new", clientName: "Ruth Alvarez" });
    expect(findConflicts(proposed, lastWeek).some((c) => c.kind === "overtime_risk")).toBe(false);
  });

  it("measures visit length in hours", () => {
    expect(hoursOf(visit({ id: "a" }))).toBe(4);
  });
});

describe("board-level views", () => {
  it("lists open shifts", () => {
    const visits = [visit({ id: "a" }), visit({ id: "b", caregiverName: null })];
    expect(openShifts(visits).map((v) => v.id)).toEqual(["b"]);
  });

  // Checking every visit against every other surfaces the same clash twice,
  // which would double every count in the Needs You panel.
  it("reports each clashing pair once, not once per side", () => {
    const visits = [
      visit({ id: "a" }),
      visit({ id: "b", clientName: "Ruth Alvarez", startsAt: "2026-08-17T10:00:00", endsAt: "2026-08-17T14:00:00" }),
    ];
    const conflicts = scheduleConflicts(visits);
    expect(conflicts.filter((c) => c.kind === "caregiver_double_booked")).toHaveLength(1);
  });

  it("finds nothing on a clean board", () => {
    const visits = [
      visit({ id: "a" }),
      visit({ id: "b", clientName: "Ruth Alvarez", caregiverName: "Grace Nwosu" }),
    ];
    expect(scheduleConflicts(visits)).toEqual([]);
  });
});
