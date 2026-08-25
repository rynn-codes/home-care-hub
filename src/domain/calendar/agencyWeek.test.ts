import { describe, expect, it } from "vitest";
import { billingWeekStart, upcomingBillingWeek } from "@/domain/billing/run";
import { workweekStart } from "@/domain/payroll/hours";
import {
  PERIOD_EPOCH,
  agencyWeekEnd,
  agencyWeekLabel,
  agencyWeekStart,
  payrollPeriod,
  payrollWeekOfPeriod,
  weekBadge,
} from "./agencyWeek";

describe("the agency week", () => {
  it("starts on Saturday, whatever day you ask on", () => {
    // Sat 22 Aug 2026 through Fri 28 Aug 2026 — every day of it answers the
    // same week. This is CLAUDE.md rule 4, and the whole reason the module
    // exists: a Tuesday must not report a different week from a Friday.
    for (const day of [
      "2026-08-22",
      "2026-08-23",
      "2026-08-25",
      "2026-08-27",
      "2026-08-28",
    ]) {
      expect(agencyWeekStart(day)).toBe("2026-08-22");
      expect(agencyWeekEnd(day)).toBe("2026-08-28");
    }
  });

  it("rolls at Friday midnight, not Sunday", () => {
    expect(agencyWeekStart("2026-08-29")).toBe("2026-08-29");
    expect(agencyWeekStart("2026-08-30")).toBe("2026-08-29");
  });

  it("tolerates a full timestamp", () => {
    expect(agencyWeekStart("2026-08-25T19:40:00.000Z")).toBe("2026-08-22");
  });

  it("puts the week of 22 August in the first half of its payroll period", () => {
    // Karynn, 25 August: "It is not week 2 of 2." The epoch is the one knob
    // that decides this; if it moves, this expectation is what catches it.
    expect(payrollWeekOfPeriod("2026-08-25")).toBe(1);
    expect(payrollWeekOfPeriod("2026-08-29")).toBe(2);
    expect(payrollWeekOfPeriod("2026-09-05")).toBe(1);
  });

  it("alternates without a break across a year", () => {
    let seen = payrollWeekOfPeriod(PERIOD_EPOCH);
    expect(seen).toBe(1);
    for (let w = 1; w <= 52; w++) {
      const d = new Date(`${PERIOD_EPOCH}T12:00:00`);
      d.setDate(d.getDate() + w * 7);
      const next = payrollWeekOfPeriod(d.toISOString().slice(0, 10));
      expect(next).not.toBe(seen);
      seen = next;
    }
  });

  it("keeps counting for dates before the epoch", () => {
    // Modulo on a negative week number is the classic way this breaks.
    expect(payrollWeekOfPeriod("2026-01-03")).toBe(2);
    expect(payrollWeekOfPeriod("2025-12-27")).toBe(1);
  });

  it("gives a fortnight that contains the date and starts on a Saturday", () => {
    const first = payrollPeriod("2026-08-25");
    expect(first).toEqual({ start: "2026-08-22", end: "2026-09-04" });

    // A week-2 date resolves to the same period, not a period of its own.
    expect(payrollPeriod("2026-08-31")).toEqual(first);
  });

  it("names the month once inside a week and twice across one", () => {
    expect(agencyWeekLabel("2026-08-25")).toBe("Aug 22–28");
    expect(agencyWeekLabel("2026-08-31")).toBe("Aug 29–Sep 4");
  });

  it("prints the badge every screen shows", () => {
    expect(weekBadge("2026-08-25")).toBe("Aug 22–28 · Billing Week 1 of 2");
  });

  it("is the same Saturday billing and payroll already use", () => {
    // Three modules once carried their own copy of "the Saturday on or before".
    // They agreed until one of them didn't. This pins them together: if any
    // definition of the week moves, it moves here first and this fails.
    for (let i = 0; i < 40; i++) {
      const d = new Date("2026-01-01T12:00:00");
      d.setDate(d.getDate() + i * 9);
      const iso = d.toISOString().slice(0, 10);

      expect(billingWeekStart(iso)).toBe(agencyWeekStart(iso));
      expect(workweekStart(iso)).toBe(agencyWeekStart(iso));

      // Billing works a week ahead: it bills the week that begins next Saturday.
      const next = new Date(`${agencyWeekStart(iso)}T12:00:00`);
      next.setDate(next.getDate() + 7);
      expect(upcomingBillingWeek(iso)).toBe(next.toISOString().slice(0, 10));
    }
  });
});
