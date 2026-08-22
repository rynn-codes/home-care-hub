import { describe, expect, it } from "vitest";
import {
  ACH_CONVENIENCE_FEE,
  LATE_FEE,
  PACKET_CONTRADICTION,
  ageing,
  buildInvoice,
  reconcile,
  splitHours,
  type ClientBillingTerms,
} from "@/domain/billing/invoice";
import type { Visit } from "@/domain/scheduling/conflicts";

/** Clients are fictional throughout this repository. */
function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Marcus Bell",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-17T09:00:00",
    endsAt: "2026-08-17T17:00:00",
    ...over,
  };
}

/** Eight hours on a given date. */
function day(date: string, id: string, hours = 8): Visit {
  const end = String(9 + hours).padStart(2, "0");
  return visit({ id, startsAt: `${date}T09:00:00`, endsAt: `${date}T${end}:00:00` });
}

function terms(over: Partial<ClientBillingTerms> = {}): ClientBillingTerms {
  return {
    clientPersonId: "c1",
    clientName: "Marcus Bell",
    hourlyRate: 30,
    paymentMethod: "card",
    depositRemaining: 0,
    ...over,
  };
}

const WEEK = "2026-08-17";

describe("no rate on file", () => {
  it("refuses to bill rather than billing zero", () => {
    // A zero looks like a settled fact. A family would be told they owed
    // nothing, and nobody would find out until the month closed.
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: null }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.state).toBe("cannot_bill");
    expect(invoice.total).toBeNull();
    expect(invoice.blockedReason).toContain("No hourly rate on file");
  });

  it("still itemises the hours, so the gap is obviously the rate", () => {
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: null }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.lines[0].hours).toBe(8);
    expect(invoice.lines[0].amount).toBeNull();
  });
});

describe("time and a half — the signed terms", () => {
  it("charges holiday hours at one and a half", () => {
    const invoice = buildInvoice({
      terms: terms(),
      visits: [day("2026-12-25", "x")],
      weekStart: "2026-12-21",
    });
    const holiday = invoice.lines.find((l) => l.kind === "holiday");
    expect(holiday?.multiplier).toBe(1.5);
    expect(holiday?.amount).toBe(360);
    expect(holiday?.description).toContain("Christmas Day");
  });

  it("charges over forty hours at one and a half", () => {
    const week = ["a", "b", "c", "d", "e", "f"].map((id, i) => day(`2026-08-${17 + i}`, id, 8));
    const invoice = buildInvoice({ terms: terms(), visits: week, weekStart: WEEK });
    expect(invoice.lines.find((l) => l.kind === "standard")?.hours).toBe(40);
    expect(invoice.lines.find((l) => l.kind === "overtime")?.hours).toBe(8);
    expect(invoice.subtotal).toBe(40 * 30 + 8 * 30 * 1.5);
  });

  it("does not charge a holiday hour twice", () => {
    // THE BUG THIS PREVENTS. A holiday hour that also pushes the week past 40
    // must not be billed at 1.5× for the holiday and again at 1.5× for the
    // overtime. The agreement describes one rate of one and a half, not a
    // stacking one — and double-charging a family for one hour is the kind of
    // error that ends a relationship.
    // Mon 6 July to Fri 10 July, forty ordinary hours, plus the 4th.
    const week = [
      ...["a", "b", "c", "d", "e"].map((id, i) =>
        day(`2026-07-${String(6 + i).padStart(2, "0")}`, id, 8),
      ),
      day("2026-07-04", "holiday", 8),
    ];
    const split = splitHours(week);
    expect(split.holidays[0].hours).toBe(8);
    // 40 ordinary hours remain, so nothing tips into overtime.
    expect(split.standard).toBe(40);
    expect(split.overtime).toBe(0);
  });

  it("measures overtime against non-holiday hours only", () => {
    const week = [
      ...["a", "b", "c", "d", "e", "f"].map((id, i) => day(`2026-07-${String(6 + i).padStart(2, "0")}`, id, 8)),
      day("2026-07-04", "holiday", 8),
    ];
    const split = splitHours(week);
    expect(split.standard).toBe(40);
    expect(split.overtime).toBe(8);
    expect(split.holidays[0].hours).toBe(8);
  });
});

describe("the deposit", () => {
  it("is applied, never charged", () => {
    // The packet: "it goes toward the first weeks of service — it is not an
    // extra charge."
    const invoice = buildInvoice({
      terms: terms({ depositRemaining: 1000 }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.subtotal).toBe(240);
    expect(invoice.depositApplied).toBe(240);
    expect(invoice.total).toBe(0);
  });

  it("never applies more deposit than the week costs", () => {
    const invoice = buildInvoice({
      terms: terms({ depositRemaining: 1000 }),
      visits: [day(WEEK, "a", 4)],
      weekStart: WEEK,
    });
    expect(invoice.depositApplied).toBe(120);
  });

  it("charges no card fee on a week the deposit covers", () => {
    // The fee is on what is actually taken.
    const invoice = buildInvoice({
      terms: terms({ depositRemaining: 1000 }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.convenienceFee).toBe(0);
  });
});

describe("convenience fees", () => {
  it("charges 2.9 per cent on a card", () => {
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    expect(invoice.convenienceFee).toBe(6.96);
    expect(invoice.total).toBe(246.96);
  });

  it("charges a flat five on ACH", () => {
    const invoice = buildInvoice({
      terms: terms({ paymentMethod: "ach" }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.convenienceFee).toBe(ACH_CONVENIENCE_FEE);
  });

  it("charges nothing on a cheque", () => {
    const invoice = buildInvoice({
      terms: terms({ paymentMethod: "check" }),
      visits: [day(WEEK, "a")],
      weekStart: WEEK,
    });
    expect(invoice.convenienceFee).toBe(0);
  });
});

describe("the week", () => {
  it("bills only this client and only this week", () => {
    const invoice = buildInvoice({
      terms: terms(),
      visits: [
        day(WEEK, "mine"),
        visit({ id: "other", clientName: "Someone else", startsAt: `${WEEK}T09:00:00` }),
        day("2026-09-14", "next month"),
      ],
      weekStart: WEEK,
    });
    expect(invoice.lines[0].hours).toBe(8);
  });

  it("gives one calendar day to pay, per the agreement", () => {
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    expect(invoice.dueOn).toBe("2026-08-18");
  });
});

describe("ageing", () => {
  it("says nothing alarming before the due date", () => {
    expect(ageing({ dueOn: "2026-08-18", paid: false, asOf: "2026-08-17" }).daysOverdue).toBe(0);
  });

  it("charges the late fee only after the third day", () => {
    expect(ageing({ dueOn: "2026-08-18", paid: false, asOf: "2026-08-21" }).lateFeeDue).toBe(0);
    expect(ageing({ dueOn: "2026-08-18", paid: false, asOf: "2026-08-22" }).lateFeeDue).toBe(LATE_FEE);
  });

  it("reports that suspension is permitted without recommending it", () => {
    // Suspending care is a person deciding somebody's mother does not get her
    // caregiver tomorrow. Software reports that the option exists.
    const late = ageing({ dueOn: "2026-08-18", paid: false, asOf: "2026-08-19" });
    expect(late.suspensionPermitted).toBe(true);
    expect(late.message).toContain("a call for a person to make");
    expect(late.message).not.toMatch(/suspend now|cancel service/i);
  });

  it("says nothing at all once it is paid", () => {
    expect(ageing({ dueOn: "2026-08-18", paid: true, asOf: "2026-09-01" })).toMatchObject({
      daysOverdue: 0,
      lateFeeDue: 0,
      suspensionPermitted: false,
    });
  });
});

describe("Joy bills in advance", () => {
  // Karynn, 21 August: "We bill in advance. Make sure that is noted. In arrears
  // is incorrect."
  //
  // A comment can be edited away by somebody reading the packet's wrong
  // sentence and helpfully "correcting" the code. A failing test cannot, and
  // this is the direction the whole billing model rests on: the reconciliation
  // below only makes sense because the money arrives before the care does.

  it("dates the invoice from the start of the week being billed, not its end", () => {
    const invoice = buildInvoice({
      terms: terms(),
      visits: [day("2026-08-17", "v1")],
      weekStart: "2026-08-17",
    });

    // Due days after the week STARTS. Arrears billing would date it from the
    // week's end, which is a week later and a different business.
    expect(invoice.weekStart).toBe("2026-08-17");
    expect(invoice.dueOn < "2026-08-23").toBe(true);
  });

  it("bills a week whose care has not happened yet", () => {
    // The defining property. An arrears invoice for a future week would be
    // empty; this one is not, because it bills what is scheduled.
    const invoice = buildInvoice({
      terms: terms(),
      visits: [day("2026-09-14", "v9")],
      weekStart: "2026-09-14",
    });
    expect(invoice.lines.length).toBeGreaterThan(0);
    expect(invoice.total).toBeGreaterThan(0);
  });

  it("says the packet is wrong rather than that it is ambiguous", () => {
    // Ambiguous invites a judgement call at the desk. Wrong tells somebody
    // which sentence to ignore.
    expect(PACKET_CONTRADICTION).toContain("Joy bills in advance");
    // The agreement is corrected now; the note survives for old signed copies.
    expect(PACKET_CONTRADICTION).toContain("corrected");
    expect(PACKET_CONTRADICTION).toContain("in advance is right");
  });
});

describe("reconciling advance billing against reality", () => {
  it("notices a family was billed for a visit that did not happen", () => {
    // The half that makes advance billing honest. Nobody chases this on the
    // family's behalf unless Joy notices.
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    const result = reconcile({ invoice, actualHours: 4 });
    expect(result.owedToClient).toBe(true);
    expect(result.differenceHours).toBe(4);
    expect(result.message).toContain("Credit the difference");
  });

  it("notices extra hours that were worked and not billed", () => {
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    const result = reconcile({ invoice, actualHours: 10 });
    expect(result.owedToClient).toBe(false);
    expect(result.message).toContain("Bill the difference");
  });

  it("says so when the week matched", () => {
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    expect(reconcile({ invoice, actualHours: 8 }).message).toBe("The week matched the invoice.");
  });
});

describe("what is not billable", () => {
  it("does not invoice a caregiver for their own orientation", () => {
    // FOUND BY LOOKING AT THE SCREEN. The schedule puts a new caregiver's name
    // in the client column for a field orientation, so billing straight off
    // the board produced an invoice addressed to a member of staff. No test
    // caught it because every fixture happened to be ordinary care.
    const invoice = buildInvoice({
      terms: terms({ clientName: "Brandon (new caregiver)" }),
      visits: [
        visit({
          clientName: "Brandon (new caregiver)",
          service: "Field Orientation",
          eventType: "field_orientation",
          startsAt: `${WEEK}T14:00:00`,
          endsAt: `${WEEK}T14:45:00`,
        }),
      ],
      weekStart: WEEK,
    });
    expect(invoice.lines).toEqual([]);
    expect(invoice.subtotal).toBe(0);
  });

  it("treats a new event type as non-billable until somebody says otherwise", () => {
    // Failing to charge is recoverable. Charging a family for something that
    // never happened to them is not.
    const invoice = buildInvoice({
      terms: terms(),
      visits: [visit({ eventType: "some_new_thing" })],
      weekStart: WEEK,
    });
    expect(invoice.lines).toEqual([]);
  });

  it("does not charge for an RN admission assessment", () => {
    // Karynn, 20 Aug: "RN admission is free unless noted otherwise."
    const invoice = buildInvoice({
      terms: terms(),
      visits: [visit({ eventType: "rn_assessment", startsAt: `${WEEK}T09:00:00`, endsAt: `${WEEK}T11:00:00` })],
      weekStart: WEEK,
    });
    expect(invoice.lines).toEqual([]);
  });

  it("charges for one when the office notes otherwise", () => {
    // The note is per visit, not per type. A blanket flag would make every
    // future assessment chargeable the moment somebody wanted to charge once
    // — a second assessment after a hospital stay, say.
    const invoice = buildInvoice({
      terms: terms(),
      visits: [
        visit({
          eventType: "rn_assessment",
          billableOverride: true,
          startsAt: `${WEEK}T09:00:00`,
          endsAt: `${WEEK}T11:00:00`,
        }),
      ],
      weekStart: WEEK,
    });
    expect(invoice.lines[0].hours).toBe(2);
    expect(invoice.subtotal).toBe(60);
  });

  it("waives an ordinary visit when the office notes that too", () => {
    // The override goes both ways. Joy waiving a visit is as real an act as
    // charging for one, and it should not need a workaround.
    const invoice = buildInvoice({
      terms: terms(),
      visits: [{ ...day(WEEK, "a"), billableOverride: false }],
      weekStart: WEEK,
    });
    expect(invoice.lines).toEqual([]);
  });

  it("distinguishes 'not noted' from 'noted as free'", () => {
    // undefined means use the default; false means somebody decided.
    const ordinary = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    expect(ordinary.lines[0].hours).toBe(8);
  });

  it("still bills ordinary care, which carries no event type", () => {
    const invoice = buildInvoice({ terms: terms(), visits: [day(WEEK, "a")], weekStart: WEEK });
    expect(invoice.lines[0].hours).toBe(8);
  });
});

describe("an invoice for nothing", () => {
  it("is settled rather than overdue", () => {
    // A week the deposit covered was reporting itself days overdue, and
    // offering to suspend somebody's care over it.
    const settled = ageing({ dueOn: "2026-08-18", paid: false, total: 0, asOf: "2026-08-25" });
    expect(settled.daysOverdue).toBe(0);
    expect(settled.suspensionPermitted).toBe(false);
    expect(settled.message).toContain("Covered by the deposit");
  });

  it("leaves a real balance ageing as before", () => {
    const late = ageing({ dueOn: "2026-08-18", paid: false, total: 240, asOf: "2026-08-25" });
    expect(late.daysOverdue).toBe(7);
    expect(late.lateFeeDue).toBe(LATE_FEE);
  });
});

describe("pricing from a rate version", () => {
  // §6.2. Without the version id on the invoice, "why was I charged this" has no
  // answer once the rate changes: the invoice says an amount and nothing says
  // which agreement produced it.

  it("records which version priced it", () => {
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: 30 }),
      visits: [day(WEEK, "v1")],
      weekStart: WEEK,
      rateVersion: { id: "rate-7", hourlyRate: 34 },
    });
    expect(invoice.ratePlanVersionId).toBe("rate-7");
  });

  it("lets the version win over the rate carried on the terms", () => {
    // The version is the direction of travel; `terms.hourlyRate` is the shape
    // being migrated away from. A week priced from a stale copy of the rate is
    // the exact drift versioning exists to stop.
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: 30 }),
      visits: [day(WEEK, "v1")],
      weekStart: WEEK,
      rateVersion: { id: "rate-7", hourlyRate: 34 },
    });
    expect(invoice.lines[0].rate).toBe(34);
    expect(invoice.subtotal).toBe(8 * 34);
  });

  it("carries no version when it could not be priced", () => {
    // A `cannot_bill` invoice was priced from nothing, and saying it came from
    // a version would be a lie somebody could cite.
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: null }),
      visits: [day(WEEK, "v1")],
      weekStart: WEEK,
    });
    expect(invoice.state).toBe("cannot_bill");
    expect(invoice.ratePlanVersionId).toBeNull();
  });

  it("still works for a caller that has not migrated", () => {
    // Phase 1 lands in steps. An existing caller passing a bare rate keeps
    // working and simply records no version.
    const invoice = buildInvoice({
      terms: terms({ hourlyRate: 30 }),
      visits: [day(WEEK, "v1")],
      weekStart: WEEK,
    });
    expect(invoice.subtotal).toBe(240);
    expect(invoice.ratePlanVersionId).toBeNull();
  });
});

describe("the late fee can be forgiven, by name", () => {
  // Karynn, 22 August: "Late fee is $100. We should be allowed the option to
  // waive the late fee."
  it("applies after the third day, as the agreement says", () => {
    const late = ageing({ dueOn: "2026-08-10", paid: false, asOf: "2026-08-15", total: 480 });
    expect(late.lateFeeDue).toBe(100);
  });

  it("waives it when somebody chooses to, and says who", () => {
    const forgiven = ageing({
      dueOn: "2026-08-10",
      paid: false,
      asOf: "2026-08-15",
      total: 480,
      lateFeeWaivedBy: "Karynn Verrett",
    });
    expect(forgiven.lateFeeDue).toBe(0);
    // The forgiveness stays visible — a waived fee that vanishes reads later
    // like a fee that never accrued.
    expect(forgiven.message).toContain("waived by Karynn Verrett");
    // The overdue days still count; forgiving the fee is not forgiving the debt.
    expect(forgiven.daysOverdue).toBeGreaterThan(0);
  });

  it("a waiver on an invoice that is not yet late changes nothing", () => {
    const early = ageing({
      dueOn: "2026-08-14",
      paid: false,
      asOf: "2026-08-15",
      total: 480,
      lateFeeWaivedBy: "Karynn Verrett",
    });
    expect(early.message).not.toContain("waived");
  });
});
