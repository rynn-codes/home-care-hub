import { describe, expect, it } from "vitest";
import {
  IMPLAUSIBLE_SHIFT_HOURS,
  OVERTIME_AFTER_HOURS,
  caregiverHours,
  entryHours,
  findExceptions,
  payrollRun,
  runSummary,
  weeklyTotals,
  workweekStart,
  type TimeEntry,
  type VisitStub,
} from "@/domain/payroll/hours";

/** Caregiver names here are fictional, as are clients throughout. */
function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "t1",
    visitId: "v1",
    caregiverPersonId: "p1",
    clockedInAt: "2026-08-17T09:00:00",
    clockedOutAt: "2026-08-17T17:00:00",
    exceptionReason: null,
    ...over,
  };
}

/** Eight hours on the given day. 2026-08-17 is a Monday. */
function day(date: string, id: string, hours = 8): TimeEntry {
  const end = String(9 + hours).padStart(2, "0");
  return entry({ id, visitId: `v-${id}`, clockedInAt: `${date}T09:00:00`, clockedOutAt: `${date}T${end}:00:00` });
}

const PERIOD = { start: "2026-08-17", end: "2026-08-30" };

describe("entryHours", () => {
  it("rounds at the entry, so line items add up to the total", () => {
    // Rounding only at the end makes a timesheet fail to sum, which reads as
    // a mistake to the person checking it against her own arithmetic.
    expect(entryHours(entry())).toBe(8);
    expect(
      entryHours(entry({ clockedInAt: "2026-08-17T09:01:00", clockedOutAt: "2026-08-17T13:04:00" })),
    ).toBe(4.05);
  });

  it("counts nothing for somebody still clocked in", () => {
    expect(entryHours(entry({ clockedOutAt: null }))).toBe(0);
  });

  it("counts nothing for a clock-out before the clock-in", () => {
    expect(entryHours(entry({ clockedOutAt: "2026-08-17T08:00:00" }))).toBe(0);
  });
});

describe("workweeks", () => {
  it("puts Monday-start weeks where Joy's schedule already puts them", () => {
    // 2026-08-17 is a Monday, 2026-08-23 the Sunday that ends that week.
    expect(workweekStart("2026-08-17T09:00:00")).toBe("2026-08-17");
    expect(workweekStart("2026-08-23T09:00:00")).toBe("2026-08-17");
    expect(workweekStart("2026-08-24T09:00:00")).toBe("2026-08-24");
  });

  it("moves the boundary when the workweek is configured differently", () => {
    // Gusto has its own setting, and the two must match. A mismatch is
    // invisible — nothing errors, overtime is just computed against different
    // seven days for anybody who works a weekend.
    expect(workweekStart("2026-08-23T09:00:00", 0)).toBe("2026-08-23");
  });
});

describe("overtime is per workweek, not per pay period", () => {
  it("finds overtime in a fortnight that averages under forty", () => {
    // THE BUG THIS EXISTS TO PREVENT. 30 hours one week, 50 the next, totals
    // 80 across a fortnightly period — which compared against 80 says no
    // overtime. The right answer is ten hours.
    const light = [day("2026-08-17", "a", 10), day("2026-08-18", "b", 10), day("2026-08-19", "c", 10)];
    const heavy = [
      day("2026-08-24", "d", 10),
      day("2026-08-25", "e", 10),
      day("2026-08-26", "f", 10),
      day("2026-08-27", "g", 10),
      day("2026-08-28", "h", 10),
    ];

    const result = caregiverHours({
      caregiverPersonId: "p1",
      caregiverName: "Jamisha",
      entries: [...light, ...heavy],
      visits: [],
      period: PERIOD,
    });

    expect(result.totalHours).toBe(80);
    expect(result.overtimeHours).toBe(10);
    expect(result.regularHours).toBe(70);
  });

  it("splits one week at the threshold", () => {
    const week = [
      day("2026-08-17", "a", 10),
      day("2026-08-18", "b", 10),
      day("2026-08-19", "c", 10),
      day("2026-08-20", "d", 10),
      day("2026-08-21", "e", 8),
    ];
    const [totals] = weeklyTotals(week);
    expect(totals.totalHours).toBe(48);
    expect(totals.regularHours).toBe(OVERTIME_AFTER_HOURS);
    expect(totals.overtimeHours).toBe(8);
  });

  it("reports no overtime at exactly forty", () => {
    const week = [
      day("2026-08-17", "a", 8),
      day("2026-08-18", "b", 8),
      day("2026-08-19", "c", 8),
      day("2026-08-20", "d", 8),
      day("2026-08-21", "e", 8),
    ];
    expect(weeklyTotals(week)[0].overtimeHours).toBe(0);
  });

  it("keeps a shift in the week it started", () => {
    // A Sunday-night shift running past midnight belongs to the week it began
    // — the ordinary convention, and what a caregiver expects looking at it.
    const overnight = entry({
      id: "x",
      clockedInAt: "2026-08-23T22:00:00",
      clockedOutAt: "2026-08-24T06:00:00",
    });
    expect(weeklyTotals([overnight])[0].weekStart).toBe("2026-08-17");
  });
});

describe("exceptions", () => {
  const visits: VisitStub[] = [
    { id: "v1", caregiverPersonId: "p1", startsAt: "2026-08-17T09:00:00", status: "completed" },
  ];

  it("blocks the period on somebody still clocked in", () => {
    // Paying that is guesswork.
    const found = findExceptions({
      entries: [entry({ clockedOutAt: null })],
      visits: [],
      period: PERIOD,
    });
    expect(found[0].kind).toBe("open_entry");
    expect(found[0].blocking).toBe(true);
  });

  it("blocks on a visit with no time recorded against it", () => {
    // Somebody may have worked and forgotten to clock in. Paying nothing for
    // it silently is the failure this catches.
    const found = findExceptions({ entries: [], visits, period: PERIOD });
    expect(found[0].kind).toBe("visit_without_time");
    expect(found[0].blocking).toBe(true);
  });

  it("ignores a cancelled visit", () => {
    const cancelled = [{ ...visits[0], status: "cancelled" }];
    expect(findExceptions({ entries: [], visits: cancelled, period: PERIOD })).toEqual([]);
  });

  it("ignores a visit outside the period", () => {
    const later = [{ ...visits[0], startsAt: "2026-09-15T09:00:00" }];
    expect(findExceptions({ entries: [], visits: later, period: PERIOD })).toEqual([]);
  });

  it("catches a forgotten clock-out", () => {
    const long = entry({
      clockedOutAt: `2026-08-18T0${IMPLAUSIBLE_SHIFT_HOURS > 15 ? 3 : 1}:00:00`,
    });
    const found = findExceptions({ entries: [long], visits: [], period: PERIOD });
    expect(found.some((e) => e.kind === "implausible_length")).toBe(true);
  });

  it("does not hold pay over unfinished paperwork", () => {
    // She worked the hours. Withholding her pay over a note is a different and
    // worse mistake than the missing note.
    const found = findExceptions({
      entries: [entry({ exceptionReason: "Clocked out with outstanding: Visit note complete" })],
      visits,
      period: PERIOD,
    });
    const gap = found.find((e) => e.kind === "documentation_gap");
    expect(gap?.blocking).toBe(false);
    expect(gap?.detail).toContain("Visit note");
  });
});

describe("payrollRun", () => {
  const people = [
    { personId: "p1", name: "Jamisha" },
    { personId: "p2", name: "Maria" },
    { personId: "p3", name: "Renee" },
  ];

  it("leaves out somebody with nothing to pay", () => {
    const run = payrollRun({
      period: PERIOD,
      people,
      entries: [day("2026-08-17", "a")],
      visits: [],
    });
    expect(run.caregivers.map((c) => c.caregiverName)).toEqual(["Jamisha"]);
  });

  it("names who is holding it up rather than counting them", () => {
    // A count is not a task.
    const run = payrollRun({
      period: PERIOD,
      people,
      entries: [entry({ caregiverPersonId: "p2", clockedOutAt: null })],
      visits: [],
    });
    expect(run.blockedBy).toEqual(["Maria"]);
    expect(run.ready).toBe(false);
    expect(runSummary(run)).toContain("Maria has something to sort out");
  });

  it("says it is ready when nothing is outstanding", () => {
    const run = payrollRun({
      period: PERIOD,
      people,
      entries: [day("2026-08-17", "a")],
      visits: [],
    });
    expect(run.ready).toBe(true);
    expect(runSummary(run)).toContain("Ready to send to Gusto");
  });

  it("totals overtime across everybody", () => {
    const heavy = ["a", "b", "c", "d", "e", "f"].map((id, i) =>
      day(`2026-08-${17 + i}`, id, 8),
    );
    const run = payrollRun({ period: PERIOD, people, entries: heavy, visits: [] });
    expect(run.totalHours).toBe(48);
    expect(run.overtimeHours).toBe(8);
  });

  it("says so plainly when nobody worked", () => {
    const run = payrollRun({ period: PERIOD, people, entries: [], visits: [] });
    expect(runSummary(run)).toBe("No hours recorded in this period.");
  });
});

describe("what payroll deliberately does not do", () => {
  it("produces hours and never a wage", () => {
    // Rates are not in this module. Karynn has not supplied real ones, and
    // multiplying fiction by real hours yields something that looks exactly
    // like a wage. Gusto owns money.
    const result = caregiverHours({
      caregiverPersonId: "p1",
      caregiverName: "Jamisha",
      entries: [day("2026-08-17", "a")],
      visits: [],
      period: PERIOD,
    });
    const keys = Object.keys(result).join(" ").toLowerCase();
    expect(keys).not.toMatch(/rate|pay|wage|gross|amount|dollar/);
  });
});
