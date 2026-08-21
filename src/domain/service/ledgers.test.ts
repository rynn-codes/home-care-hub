import { describe, expect, it } from "vitest";
import {
  unitFromVisit,
  verifyUnit,
  reviseUnit,
  type VerifiedServiceUnit,
} from "@/domain/service/verifiedUnit";
import { payrollRun, type TimeEntry } from "@/domain/payroll/hours";
import { buildInvoice, type ClientBillingTerms } from "@/domain/billing/invoice";
import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * §3.1.5: the two ledgers share verified service facts and never infer one
 * another's result.
 *
 * Everything here is one property in two directions — when somebody has
 * approved a figure, payroll pays THAT and billing bills THAT, and neither goes
 * back to the raw clock to work out its own answer. The seam is the interesting
 * part: both readers were built before the verified unit existed and both must
 * keep working unchanged when there is no unit to read, because until the review
 * screen exists there won't be one.
 */

const CLIENT = "client-1";
const CAREGIVER = "cg-1";

// Monday. Four scheduled hours; she stayed until 13:40.
const visit: Visit = {
  id: "v-1",
  clientName: "Marcus Bell",
  clientPersonId: CLIENT,
  caregiverPersonId: CAREGIVER,
  service: "Personal Care",
  caregiverName: "Jamisha Harper",
  startsAt: "2026-08-17T09:00:00",
  endsAt: "2026-08-17T13:00:00",
};

const entry: TimeEntry = {
  id: "t-1",
  visitId: "v-1",
  caregiverPersonId: CAREGIVER,
  clockedInAt: "2026-08-17T09:00:00",
  clockedOutAt: "2026-08-17T13:40:00",
  exceptionReason: null,
};

const terms: ClientBillingTerms = {
  clientPersonId: CLIENT,
  clientName: "Marcus Bell",
  hourlyRate: 30,
  paymentMethod: "ach",
  depositRemaining: 0,
};

function approved(over: Partial<VerifiedServiceUnit> = {}): VerifiedServiceUnit {
  const proposed = unitFromVisit({ id: "u-1", organizationId: "org", visit, entry });
  return {
    ...verifyUnit({
      unit: proposed,
      // She stayed forty minutes at the daughter's request. Joy pays for it and
      // does not bill for it — the case the two figures exist for.
      payableMinutes: 280,
      billableMinutes: 240,
      byUserId: "u-karynn",
      at: "2026-08-18T08:00:00Z",
      note: "Stayed 40 minutes at the daughter's request; not billed.",
    }),
    ...over,
  };
}

function run(units?: VerifiedServiceUnit[]) {
  return payrollRun({
    period: { start: "2026-08-17", end: "2026-08-23" },
    people: [{ personId: CAREGIVER, name: "Jamisha Harper" }],
    entries: [entry],
    visits: [{ id: "v-1", caregiverPersonId: CAREGIVER, startsAt: visit.startsAt, status: "completed" }],
    units,
  });
}

function invoice(units?: VerifiedServiceUnit[]) {
  return buildInvoice({ terms, visits: [visit], weekStart: "2026-08-17", units });
}

describe("with nothing approved, both ledgers behave exactly as before", () => {
  // The whole wiring is optional-input, and this is the test that keeps it
  // honest. Every screen in Joy passes no units today.

  it("payroll pays the clock", () => {
    expect(run().caregivers[0].totalHours).toBe(4.67);
  });

  it("billing bills the scheduled week", () => {
    expect(invoice().lines[0].hours).toBe(4);
  });
});

describe("with a figure approved, each ledger reads its own", () => {
  it("payroll pays the approved payable minutes, not the clock", () => {
    // The clock says 4.67. Somebody looked at the visit and approved 4.00 —
    // she arrived on time and the app was left running. That decision is the
    // one payroll must act on, and the only way to see it is for the approved
    // figure to differ from the clock, so this fixture makes it differ.
    const corrected = approved({
      approvedPayableMinutes: 240,
      approvedBillableMinutes: 240,
      note: "Clock left running after she left; four hours is right.",
    });
    expect(run().caregivers[0].totalHours).toBe(4.67);
    expect(run([corrected]).caregivers[0].totalHours).toBe(4);
  });

  it("including when it is longer than the clock recorded", () => {
    const longer = approved({
      approvedPayableMinutes: 300,
      approvedBillableMinutes: 300,
      note: "She stayed until the daughter arrived; clocked out early by mistake.",
    });
    expect(run([longer]).caregivers[0].totalHours).toBe(5);
  });

  it("billing bills the approved billable minutes", () => {
    // Four hours billed against four hours forty paid. Neither ledger has any
    // way to reach the other's number, which is the point.
    const built = invoice([approved()]);
    expect(built.lines[0].hours).toBe(4);
    expect(built.subtotal).toBe(120);
  });

  it("so the two can legitimately disagree, and both are somebody's decision", () => {
    const unit = approved();
    expect(run([unit]).caregivers[0].totalHours).not.toBe(invoice([unit]).lines[0].hours);
    expect(unit.verifiedByUserId).toBe("u-karynn");
  });
});

describe("a review somebody has not finished blocks both", () => {
  // Paying or billing the raw clock over the top of an open review is the exact
  // drift §3.1.5 forbids — and worse, it is silent.

  const proposed = unitFromVisit({ id: "u-1", organizationId: "org", visit, entry });

  it("payroll will not go to Gusto over an open review", () => {
    const blocked = run([proposed]);
    expect(blocked.ready).toBe(false);
    expect(blocked.caregivers[0].exceptions.map((e) => e.kind)).toContain("awaiting_verification");
  });

  it("and the invoice says so rather than guessing at the hours", () => {
    const built = invoice([proposed]);
    expect(built.state).toBe("cannot_bill");
    expect(built.blockedReason).toMatch(/still under review/);
    expect(built.total).toBeNull();
  });
});

describe("a superseded unit is history, not a figure to pay from", () => {
  it("payroll ignores it and falls back to the clock", () => {
    const { superseded } = reviseUnit({
      unit: approved(),
      id: "u-2",
      reason: "The daughter agreed to pay for the extra time after all.",
      byUserId: "u-karynn",
      at: "2026-08-19T08:00:00Z",
    });
    // The corrected record is not in this list, so there is nothing approved —
    // and paying the old, corrected figure would be worse than paying the clock.
    expect(run([superseded]).caregivers[0].totalHours).toBe(4.67);
  });
});

describe("a visit nobody clocked, which somebody then approved", () => {
  // Karynn's "let her out, record the gap" case, at the far end: no clock in at
  // all. Before the verified unit this blocked payroll and stayed blocked,
  // because there was nowhere to record the decision.

  const unclocked = unitFromVisit({ id: "u-3", organizationId: "org", visit, entry: null });

  it("is the caregiver's, even though there is no time entry naming her", () => {
    expect(unclocked.caregiverPersonId).toBe(CAREGIVER);
    expect(unclocked.exceptions).toContain("no_clock_in");
  });

  it("blocks payroll until somebody decides", () => {
    const blocked = payrollRun({
      period: { start: "2026-08-17", end: "2026-08-23" },
      people: [{ personId: CAREGIVER, name: "Jamisha Harper" }],
      entries: [],
      visits: [{ id: "v-1", caregiverPersonId: CAREGIVER, startsAt: visit.startsAt, status: "completed" }],
      units: [unclocked],
    });
    expect(blocked.ready).toBe(false);
  });

  it("and once approved, is paid — in the week the care happened", () => {
    const decided = verifyUnit({
      unit: unclocked,
      payableMinutes: 240,
      billableMinutes: 240,
      byUserId: "u-karynn",
      at: "2026-09-01T08:00:00Z",
      note: "She worked it; the app did not record a clock-in.",
    });

    const paid = payrollRun({
      period: { start: "2026-08-17", end: "2026-08-23" },
      people: [{ personId: CAREGIVER, name: "Jamisha Harper" }],
      entries: [],
      visits: [{ id: "v-1", caregiverPersonId: CAREGIVER, startsAt: visit.startsAt, status: "completed" }],
      units: [decided],
    });

    expect(paid.ready).toBe(true);
    expect(paid.caregivers[0].totalHours).toBe(4);
    // Approved two weeks later. The hours belong to the week she worked, not
    // the week somebody got round to reviewing it — overtime is decided per
    // workweek, so putting them in the wrong one invents or erases overtime.
    expect(paid.caregivers[0].weeks[0].weekStart).toBe("2026-08-17");
  });
});
