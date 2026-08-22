import { describe, expect, it } from "vitest";
import {
  buildInvoice,
  carryForwardFrom,
  type ClientBillingTerms,
} from "@/domain/billing/invoice";
import { billingWeekStart, planBillingRun } from "@/domain/billing/run";
import type {
  BillingAccount,
  BillingAccountClient,
  RatePlanVersion,
} from "@/domain/billing/accounts";
import { linesFromInvoice } from "@/domain/billing/approval";

/**
 * Karynn's answers of 22 August, held as tests.
 *
 * The billing week: "It would need to be Saturday AM you can draft bc our
 * billing ends of Friday." The invoice: "What is on the service agreement
 * (12 hours/week)... any OT from the previous week, any additional hours that
 * were added but not billed, any credits from the previous week." And split
 * payers: "Yes, it happens."
 */

/** Clients are fictional throughout this repository. */

const terms: ClientBillingTerms = {
  clientPersonId: "c-evelyn",
  clientName: "Evelyn Carter",
  hourlyRate: 30,
  paymentMethod: "ach",
  depositRemaining: 0,
};

describe("the billing week runs Saturday to Friday", () => {
  it("finds the Saturday on or before any date", () => {
    expect(billingWeekStart("2026-08-22")).toBe("2026-08-22"); // a Saturday
    expect(billingWeekStart("2026-08-24")).toBe("2026-08-22"); // Monday
    expect(billingWeekStart("2026-08-28")).toBe("2026-08-22"); // Friday, last day
    expect(billingWeekStart("2026-08-29")).toBe("2026-08-29"); // next Saturday
  });

  it("is the same seven days as the Gusto payroll week", async () => {
    // Payroll, billing and Gusto must all mean the same thing by "the week" —
    // this is the agreement that makes carried overtime line up with paid
    // overtime.
    const { WORKWEEK_STARTS_ON } = await import("@/domain/payroll/hours");
    expect(WORKWEEK_STARTS_ON).toBe(6);
  });
});

describe("the advance invoice bills the agreement, not the board", () => {
  it("puts the agreed hours on the base line whatever the schedule says", () => {
    const invoice = buildInvoice({
      terms,
      weekStart: "2026-08-22",
      // The board has 20 hours scheduled; the agreement says 12. The agreement
      // is what the family signed.
      visits: [
        {
          id: "v1",
          clientName: "Evelyn Carter",
          clientPersonId: "c-evelyn",
          service: "Personal Care",
          caregiverName: "J",
          startsAt: "2026-08-24T08:00:00",
          endsAt: "2026-08-24T18:00:00",
        },
        {
          id: "v2",
          clientName: "Evelyn Carter",
          clientPersonId: "c-evelyn",
          service: "Personal Care",
          caregiverName: "J",
          startsAt: "2026-08-26T08:00:00",
          endsAt: "2026-08-26T18:00:00",
        },
      ],
      advance: { agreedHours: 12 },
    });

    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0].hours).toBe(12);
    expect(invoice.lines[0].description).toContain("as agreed");
    expect(invoice.subtotal).toBe(360);
  });

  it("carries last week's differences as their own lines", () => {
    const invoice = buildInvoice({
      terms,
      weekStart: "2026-08-22",
      visits: [],
      advance: {
        agreedHours: 12,
        carryForward: [
          { kind: "carried_hours", hours: 3, description: "Additional hours from the week of 2026-08-15" },
          { kind: "carried_overtime", hours: 2, description: "Overtime from the week of 2026-08-15 — time and a half" },
        ],
      },
    });

    // 12×30 + 3×30 + 2×45 = 360 + 90 + 90
    expect(invoice.subtotal).toBe(540);
    expect(invoice.lines.map((l) => l.kind)).toEqual(["standard", "carried_hours", "carried_overtime"]);
  });

  it("prints a credit as a visible negative line, not a shrunken base", () => {
    const invoice = buildInvoice({
      terms,
      weekStart: "2026-08-22",
      visits: [],
      advance: {
        agreedHours: 12,
        carryForward: [{ kind: "credit", hours: 4, description: "Hours not used in the week of 2026-08-15" }],
      },
    });

    // The family checks 12 against their agreement and −4 against their
    // calendar. 8 hours on one line is checkable against nothing.
    expect(invoice.lines[0].hours).toBe(12);
    const credit = invoice.lines.find((l) => l.kind === "credit")!;
    expect(credit.amount).toBe(-120);
    expect(invoice.subtotal).toBe(240);
  });

  it("a credit line survives the database's own-arithmetic rule", () => {
    const invoice = buildInvoice({
      terms,
      weekStart: "2026-08-22",
      visits: [],
      advance: {
        agreedHours: 12,
        carryForward: [{ kind: "credit", hours: 4, description: "Hours not used in the week of 2026-08-15" }],
      },
    });
    const lines = linesFromInvoice(invoice);
    const credit = lines[1];
    // 0016 refuses any line where amount ≠ quantity × rate. A credit is a
    // negative RATE on positive hours, so the arithmetic still holds.
    expect(credit.quantity).toBe(4);
    expect(credit.unitRate).toBe(-30);
    expect(credit.amount).toBe(Math.round(credit.quantity * credit.unitRate * 100) / 100);
  });
});

describe("carryForwardFrom — what last week owes this one", () => {
  it("says nothing when the week went as agreed, which is the usual case", () => {
    expect(carryForwardFrom({ weekStart: "2026-08-15", billedHours: 12, workedHours: 12 })).toEqual([]);
  });

  it("carries extra hours forward as a charge", () => {
    const lines = carryForwardFrom({ weekStart: "2026-08-15", billedHours: 12, workedHours: 15 });
    expect(lines).toEqual([
      { kind: "carried_hours", hours: 3, description: "Additional hours from the week of 2026-08-15" },
    ]);
  });

  it("carries a shortfall back as a credit", () => {
    const lines = carryForwardFrom({ weekStart: "2026-08-15", billedHours: 12, workedHours: 8 });
    expect(lines[0]).toMatchObject({ kind: "credit", hours: 4 });
  });

  it("keeps overtime on its own line, at its own rate, out of the plain difference", () => {
    // 44 worked, 4 of them overtime: the ordinary difference is 40 − 38 = 2,
    // and the 4 OT hours bill at time and a half separately. Folding them
    // together would bill overtime at the plain rate.
    const lines = carryForwardFrom({
      weekStart: "2026-08-15",
      billedHours: 38,
      workedHours: 44,
      overtimeHours: 4,
    });
    expect(lines).toEqual([
      { kind: "carried_hours", hours: 2, description: "Additional hours from the week of 2026-08-15" },
      { kind: "carried_overtime", hours: 4, description: "Overtime from the week of 2026-08-15 — time and a half" },
    ]);
  });
});

describe("split payers — Karynn: yes, it happens", () => {
  function account(id: string, payerName: string): BillingAccount {
    return {
      id,
      organizationId: "org-1",
      payerPersonId: `p-${id}`,
      payerName,
      status: "ready",
      collectionMethod: "send_invoice",
      deliveryPreference: "email_and_portal",
      termsDays: 1,
      billingEmail: `${id}@example.com`,
      billingPhone: null,
      authorizationStatus: "not_captured",
      authorizationCapturedAt: null,
      authorizationDocumentId: null,
      depositRemaining: 0,
      paymentMethod: "ach",
      onHold: false,
      holdReason: null,
    };
  }

  const rate = (accountId: string): RatePlanVersion => ({
    id: `rate-${accountId}`,
    billingAccountId: accountId,
    clientPersonId: null,
    hourlyRate: 30,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdByUserId: "u-karynn",
    createdAt: "2026-01-01T09:00:00Z",
  });

  const siblings: BillingAccountClient[] = [
    { billingAccountId: "acct-sister", clientPersonId: "c-odessa", clientName: "Odessa Arceneaux", sharePercent: 50, agreedWeeklyHours: 12 },
    { billingAccountId: "acct-brother", clientPersonId: "c-odessa", clientName: "Odessa Arceneaux", sharePercent: 50, agreedWeeklyHours: 12 },
  ];

  const inputs = {
    periodStart: "2026-08-22",
    periodEnd: "2026-08-28",
    visits: [
      {
        id: "v1",
        clientName: "Odessa Arceneaux",
        clientPersonId: "c-odessa",
        service: "Personal Care",
        caregiverName: "J",
        startsAt: "2026-08-24T09:00:00",
        endsAt: "2026-08-24T13:00:00",
      },
    ],
    accounts: [account("acct-sister", "Diane Miller"), account("acct-brother", "Wendell Hollis")],
    accountClients: siblings,
    rateVersions: [rate("acct-sister"), rate("acct-brother")],
  };

  it("drafts one invoice per payer, each for their share of the agreement", () => {
    const run = planBillingRun(inputs);
    expect(run.exceptions).toEqual([]);
    expect(run.drafts).toHaveLength(2);
    for (const draft of run.drafts) {
      expect(draft.lines[0].hours).toBe(6);
      expect(draft.subtotal).toBe(180);
    }
  });

  it("splits the carry-forward exactly as it splits the week", () => {
    const run = planBillingRun({
      ...inputs,
      carryForward: {
        "c-odessa": [{ kind: "credit" as const, hours: 4, description: "Hours not used in the week of 2026-08-15" }],
      },
    });
    for (const draft of run.drafts) {
      const credit = draft.lines.find((l) => l.kind === "credit")!;
      expect(credit.hours).toBe(2);
      expect(draft.subtotal).toBe(120);
    }
  });

  it("refuses to draft while the shares do not reach the whole bill", () => {
    // The database allows the gap (adding the second sibling is a real editing
    // state); the run is where it stops, because a silently unbilled 40% is
    // revenue nobody notices losing.
    const partial = planBillingRun({
      ...inputs,
      accountClients: [{ ...siblings[0], sharePercent: 60 }],
    });
    const gap = partial.exceptions.find((e) => e.kind === "payer_not_ready")!;
    expect(gap.detail).toContain("60%");
    expect(partial.drafts).toEqual([]);
    expect(partial.skipped[0].clientPersonId).toBe("c-odessa");
  });
});
