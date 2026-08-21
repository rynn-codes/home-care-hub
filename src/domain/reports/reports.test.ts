import { describe, expect, it } from "vitest";
import {
  authBurnReport,
  caregiverUtilization,
  hoursByService,
  netMarginByClient,
  revenueByMonth,
  unbillableHours,
} from "@/domain/reports/reports";
import { csvCell, reportToCsv } from "@/domain/reports/csv";
import { monthsIn, resolvePeriod, weekStart } from "@/domain/reports/period";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { ClientBillingTerms } from "@/domain/billing/invoice";
import type { TimeEntry } from "@/domain/payroll/hours";
import type { Authorization } from "@/domain/authorizations/authorization";

const TODAY = "2026-08-21";
const RANGE = { start: "2026-08-01", end: TODAY, label: "August" };

/** Clients are fictional throughout this repository. */
function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Marcus Bell",
    clientPersonId: "c-1",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-10T09:00:00",
    endsAt: "2026-08-10T13:00:00",
    ...over,
  };
}

const PRICED: ClientBillingTerms = {
  clientPersonId: "c-1",
  clientName: "Marcus Bell",
  hourlyRate: 32,
  paymentMethod: "card",
  depositRemaining: 0,
};

const UNPRICED: ClientBillingTerms = { ...PRICED, clientPersonId: "c-2", clientName: "Evelyn Carter", hourlyRate: null };

describe("the period selector", () => {
  it("starts a week on Monday, the way payroll already does", () => {
    expect(weekStart("2026-08-21")).toBe("2026-08-17");
    expect(weekStart("2026-08-17")).toBe("2026-08-17");
  });

  it("reads a quarter as the last three months, not the calendar quarter", () => {
    // Somebody asking "how are we doing" on 23 April means the last three
    // months, not the three weeks since the quarter turned over.
    expect(resolvePeriod("quarter", "2026-04-23")).toEqual({
      start: "2026-01-23",
      end: "2026-04-23",
      label: "Last 3 months",
    });
  });

  it("gives last month its whole self, not a month back from today", () => {
    expect(resolvePeriod("last_month", "2026-08-21")).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
      label: "2026-07",
    });
  });

  it("lists every month a range touches", () => {
    expect(monthsIn({ start: "2026-01-23", end: "2026-04-23", label: "" })).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });
});

describe("revenue by month", () => {
  it("refuses to compute when nobody has a rate, and says how many hours that is", () => {
    // A missing rate treated as zero dollars makes an unpriced client look like
    // one who generated nothing, and those are opposite problems.
    const report = revenueByMonth({ visits: [visit()], terms: [UNPRICED], range: RANGE });
    expect(report.state).toBe("needs_input");
    expect(report.missing!.join(" ")).toMatch(/4 hours were delivered/);
  });

  it("excludes an unpriced client's hours from revenue rather than counting them as zero", () => {
    const report = revenueByMonth({
      visits: [visit(), visit({ id: "v2", clientPersonId: "c-2", clientName: "Evelyn Carter" })],
      terms: [PRICED, UNPRICED],
      range: RANGE,
    });
    expect(report.state).toBe("computed");
    expect(report.rows[0]).toMatchObject({ revenue: 128, hours: 8, unpricedHours: 4 });
    expect(report.note).toContain("Evelyn Carter");
  });

  it("does not count an open shift as revenue", () => {
    // Nobody worked it, so nobody can be billed for it.
    const report = revenueByMonth({
      visits: [visit({ caregiverName: null }), visit({ id: "v2" })],
      terms: [PRICED],
      range: RANGE,
    });
    expect(report.rows[0]).toMatchObject({ hours: 4, revenue: 128 });
  });

  it("calls a period with no care empty, not a missing rate", () => {
    // Telling somebody their clients have no rates when the real answer is
    // "nobody was visited" sends them to fix the wrong thing.
    const report = revenueByMonth({
      visits: [visit({ caregiverName: null })],
      terms: [PRICED],
      range: RANGE,
    });
    expect(report.state).toBe("empty");
  });

  it("refuses when the clients who were actually seen have no rate, even if others do", () => {
    // An earlier version asked whether ANY client in the roster had a rate, so
    // one priced client elsewhere made this "computed" — and it printed $0
    // against real hours. A confident zero reads as a bad month rather than as
    // missing data.
    const report = revenueByMonth({
      visits: [visit({ clientPersonId: "c-2", clientName: "Evelyn Carter" })],
      terms: [PRICED, UNPRICED],
      range: RANGE,
    });
    expect(report.state).toBe("needs_input");
  });
});

describe("hours by service", () => {
  it("adds up delivered hours and says the split is a billing label", () => {
    // Karynn, 21 August: Joy does not separate care.
    const report = hoursByService({
      visits: [visit(), visit({ id: "v2", service: "Companion Care" })],
      range: RANGE,
    });
    expect(report.rows).toEqual([
      { service: "Personal Care", hours: 4 },
      { service: "Companion Care", hours: 4 },
    ]);
    expect(report.note).toContain("does not separate care");
  });

  it("leaves out an RN assessment, which is not client care", () => {
    const report = hoursByService({
      visits: [visit(), visit({ id: "v9", eventType: "rn_assessment" })],
      range: RANGE,
    });
    expect(report.rows).toHaveLength(1);
  });
});

describe("caregiver utilisation", () => {
  const entries: TimeEntry[] = [
    {
      id: "t1",
      visitId: "v1",
      caregiverPersonId: "p-jamisha",
      clockedInAt: "2026-08-10T09:05:00",
      clockedOutAt: "2026-08-10T12:50:00",
      exceptionReason: null,
    },
  ];

  it("measures worked against scheduled rather than against an invented capacity", () => {
    const report = caregiverUtilization({
      visits: [visit()],
      entries,
      nameFor: () => "Jamisha",
      range: RANGE,
    });
    expect(report.rows[0]).toMatchObject({ caregiver: "Jamisha", scheduled: 4, worked: 3.8 });
    // 3h45m of a 4h shift is 93.75%, from the unrounded hours. The 3.8 above is
    // the display value; percentages computed off a rounded figure compound the
    // rounding, and this is the one column somebody reads as a performance
    // number.
    expect(report.rows[0].utilization).toBe(94);
    expect(report.note).toContain("not against a capacity target");
  });

  it("counts overtime per workweek, the same rule payroll applies", () => {
    // Summing a quarter and taking anything over 40 would invent overtime
    // nobody earned.
    const long = (day: string, id: string): TimeEntry => ({
      id,
      visitId: id,
      caregiverPersonId: "p1",
      clockedInAt: `${day}T08:00:00`,
      clockedOutAt: `${day}T21:00:00`,
      exceptionReason: null,
    });
    const week = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20"].map((d, i) =>
      long(d, `e${i}`),
    );
    const report = caregiverUtilization({
      visits: [],
      entries: week,
      nameFor: () => "Vanessa",
      range: RANGE,
    });
    // 52 hours in one workweek: 12 of overtime.
    expect(report.rows[0].overtime).toBe(12);
  });
});

describe("net margin by client", () => {
  it("refuses outright and names both missing inputs", () => {
    // Margin is the number somebody prices a contract off. A plausible one is
    // worse than none.
    const report = netMarginByClient({
      terms: [UNPRICED],
      payRates: new Map(),
      visits: [visit()],
      range: RANGE,
    });
    expect(report.state).toBe("needs_input");
    expect(report.missing!.join(" ")).toMatch(/revenue side/);
    expect(report.missing!.join(" ")).toMatch(/cost side/);
  });

  it("still refuses when only the client rate exists", () => {
    const report = netMarginByClient({
      terms: [PRICED],
      payRates: new Map(),
      visits: [visit()],
      range: RANGE,
    });
    expect(report.state).toBe("needs_input");
    expect(report.missing!.some((m) => /pay rates/.test(m))).toBe(true);
  });

  it("computes contribution when both sides are present, and says it is not net", () => {
    const report = netMarginByClient({
      terms: [PRICED],
      payRates: new Map([["Jamisha", 18]]),
      visits: [visit()],
      range: RANGE,
    });
    expect(report.state).toBe("computed");
    expect(report.rows[0]).toMatchObject({ revenue: 128, cost: 72, margin: 44 });
    expect(report.note).toContain("contribution rather than true net");
  });
});

describe("unbillable hours", () => {
  it("groups by reason, because the fixes differ", () => {
    const report = unbillableHours({
      visits: [
        visit(),
        visit({ id: "v2", caregiverName: null }),
        visit({ id: "v3", clientPersonId: "c-2", clientName: "Evelyn Carter" }),
        visit({ id: "v4", eventType: "field_orientation", service: "Field Orientation" }),
      ],
      terms: [PRICED],
      range: RANGE,
    });

    const reasons = report.rows.map((r) => r.reason);
    expect(reasons).toContain("Shift never staffed");
    expect(reasons).toContain("Client has no rate on file");
    expect(reasons).toContain("Not a billable event");
    // The one properly billed visit is not in it.
    expect(report.rows.reduce((n, r) => n + Number(r.hours), 0)).toBe(12);
  });

  it("says so plainly when there is nothing", () => {
    const report = unbillableHours({ visits: [visit()], terms: [PRICED], range: RANGE });
    expect(report.subtitle).toContain("Nothing unbillable");
  });
});

describe("authorisation burn", () => {
  const auth: Authorization = {
    id: "auth-1",
    clientPersonId: "c-1",
    clientName: "Marcus Bell",
    payer: "medicaid",
    authorizationNumber: "STAR-0001",
    unitsAuthorized: 400,
    minutesPerUnit: 15,
    startsOn: "2026-08-01",
    endsOn: "2026-10-31",
    service: "Personal attendant services",
  };

  it("says what is missing when no authorisations exist at all", () => {
    const report = authBurnReport({ authorizations: [], visits: [], today: TODAY });
    expect(report.state).toBe("needs_input");
    expect(report.missing!.join(" ")).toMatch(/private-pay client needs no authorisation/i);
  });

  it("compares units used against period elapsed", () => {
    // Four hours a day since the 1st: 16 units a day, well ahead of a period
    // that has barely started.
    const visits = Array.from({ length: 20 }, (_, i) =>
      visit({
        id: `v${i}`,
        startsAt: `2026-08-${String(i + 1).padStart(2, "0")}T09:00:00`,
        endsAt: `2026-08-${String(i + 1).padStart(2, "0")}T13:00:00`,
      }),
    );
    const report = authBurnReport({ authorizations: [auth], visits, today: TODAY });
    expect(report.state).toBe("computed");
    expect(report.rows[0].used).toBe("80%");
    expect(String(report.rows[0].advice)).toMatch(/run out|Ask for more/i);
  });
});

describe("the CSV export", () => {
  it("quotes a field containing a comma, which every one of these reports has", () => {
    // "Vandermeer, Augustin" unescaped shifts every column after it, and the
    // file looks fine in Excel and is wrong.
    expect(csvCell("Vandermeer, Augustin")).toBe('"Vandermeer, Augustin"');
    expect(csvCell('She said "I am fine"')).toBe('"She said ""I am fine"""');
  });

  it("defuses a cell Excel would run as a formula", () => {
    // Cells come from names and free text somebody typed.
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+15551234567")).toBe("'+15551234567");
  });

  it("exports the reason rather than an empty file when a report cannot be produced", () => {
    // A zero-byte download reads as a bug and gets reported as one.
    const report = netMarginByClient({
      terms: [UNPRICED],
      payRates: new Map(),
      visits: [],
      range: RANGE,
    });
    const csv = reportToCsv(report);
    expect(csv).toContain("cannot be produced yet");
    expect(csv).toContain("cost side");
  });

  it("writes a header and one line per row", () => {
    const report = hoursByService({ visits: [visit()], range: RANGE });
    const [header, first] = reportToCsv(report).split("\n");
    expect(header).toBe("Service,Hours");
    expect(first).toBe("Personal Care,4");
  });
});
