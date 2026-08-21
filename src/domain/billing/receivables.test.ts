import { describe, expect, it } from "vitest";
import {
  bucketOf,
  invoiceBalance,
  paymentRefusals,
  receivables,
  receivablesHeadline,
  silentFor,
  writeOff,
  type IssuedInvoice,
  type Payment,
} from "@/domain/billing/receivables";

const ASOF = "2026-08-21";

/** Clients are fictional throughout this repository. */
function issued(over: Partial<IssuedInvoice> = {}): IssuedInvoice {
  return {
    id: "inv-1",
    clientPersonId: "c-1",
    clientName: "Marcus Bell",
    weekStart: "2026-08-03",
    weekEnd: "2026-08-09",
    total: 640,
    issuedOn: "2026-08-03",
    dueOn: "2026-08-10",
    writtenOffOn: null,
    writtenOffReason: null,
    ...over,
  };
}

function payment(over: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    amount: 640,
    receivedOn: "2026-08-09",
    method: "card",
    reference: "•••• 4242",
    ...over,
  };
}

describe("one invoice's balance", () => {
  it("is outstanding until money arrives", () => {
    const b = invoiceBalance({ invoice: issued({ dueOn: "2026-08-30" }), payments: [], asOf: ASOF });
    expect(b.balance).toBe(640);
    expect(b.state).toBe("outstanding");
    expect(b.lastPaymentOn).toBeNull();
  });

  it("ages from the due date, not from when it was sent", () => {
    // An invoice due on Friday is not late on Wednesday. The agreement's clock
    // is the due date's.
    const early = invoiceBalance({
      invoice: issued({ issuedOn: "2026-07-01", dueOn: "2026-08-30" }),
      payments: [],
      asOf: ASOF,
    });
    expect(early.daysOverdue).toBe(0);
    expect(early.state).toBe("outstanding");

    const late = invoiceBalance({ invoice: issued(), payments: [], asOf: ASOF });
    expect(late.daysOverdue).toBe(11);
    expect(late.state).toBe("overdue");
  });

  it("handles a part payment, because families make them", () => {
    const b = invoiceBalance({
      invoice: issued(),
      payments: [payment({ amount: 200 })],
      asOf: ASOF,
    });
    expect(b.paid).toBe(200);
    expect(b.balance).toBe(440);
    // Still overdue: part paid is not a get-out from the clock.
    expect(b.state).toBe("overdue");
    expect(b.lastPaymentOn).toBe("2026-08-09");
  });

  it("calls a part payment part paid when it is not yet late", () => {
    const b = invoiceBalance({
      invoice: issued({ dueOn: "2026-08-30" }),
      payments: [payment({ amount: 200 })],
      asOf: ASOF,
    });
    expect(b.state).toBe("part_paid");
  });

  it("treats an overpayment as a credit rather than a negative debt", () => {
    // A family who paid twice is owed money by Joy. Showing that as "-$640
    // owed" inside a list of debts is how it gets netted off against somebody
    // else's arrears and never returned.
    const b = invoiceBalance({
      invoice: issued(),
      payments: [payment(), payment({ id: "pay-2", receivedOn: "2026-08-14" })],
      asOf: ASOF,
    });
    expect(b.state).toBe("overpaid");
    expect(b.balance).toBe(-640);
  });

  it("keeps a written-off invoice visible and out of the debt", () => {
    const b = invoiceBalance({
      invoice: writeOff({ invoice: issued(), reason: "Estate closed", on: "2026-08-20" }),
      payments: [],
      asOf: ASOF,
    });
    expect(b.state).toBe("written_off");
  });

  it("will not write off without a reason", () => {
    // A debt that disappears the moment somebody gives up on it is a debt
    // nobody can later ask why Joy gave up on.
    expect(() => writeOff({ invoice: issued(), reason: "  ", on: ASOF })).toThrow(/needs a reason/);
  });
});

describe("the ageing buckets", () => {
  it("puts a single missed weekly invoice in with everybody else's unpaid Friday", () => {
    // Joy invoices weekly. One invoice behind is a week behind. The bucket that
    // means something is 31+, which is four invoices missed in a row.
    expect(bucketOf(0)).toBe("not_due");
    expect(bucketOf(7)).toBe("1_30");
    expect(bucketOf(31)).toBe("31_60");
    expect(bucketOf(91)).toBe("over_90");
  });
});

describe("who owes Joy money", () => {
  const invoices = [
    issued({ id: "a", dueOn: "2026-08-18" }),
    issued({ id: "b", dueOn: "2026-05-01", total: 320 }),
    issued({
      id: "c",
      clientPersonId: "c-2",
      clientName: "Evelyn Carter",
      dueOn: "2026-08-30",
      total: 500,
    }),
    issued({ id: "d", clientPersonId: "c-3", clientName: "Ruth Alvarez", total: 200 }),
  ];
  const payments = [payment({ id: "p1", invoiceId: "d", amount: 200, receivedOn: "2026-08-05" })];

  it("totals only what has actually been invoiced", () => {
    // An invoice Joy computed and never sent is not a debt. Nobody owes money
    // they were never asked for.
    const r = receivables({ invoices, payments, asOf: ASOF });
    expect(r.totalOutstanding).toBe(640 + 320 + 500);
    expect(r.totalOverdue).toBe(640 + 320);
  });

  it("puts the oldest debt first, because that is the one that goes bad", () => {
    const r = receivables({ invoices, payments, asOf: ASOF });
    expect(r.clients[0].clientName).toBe("Marcus Bell");
    expect(r.clients[0].oldestDaysOverdue).toBe(112);
    expect(r.clients[0].worstBucket).toBe("over_90");
  });

  it("drops a settled invoice out of the list entirely", () => {
    const r = receivables({ invoices, payments, asOf: ASOF });
    expect(r.clients.map((c) => c.clientName)).not.toContain("Ruth Alvarez");
  });

  it("buckets the money, worst first", () => {
    const r = receivables({ invoices, payments, asOf: ASOF });
    expect(r.byBucket[0].bucket).toBe("over_90");
    expect(r.byBucket.at(-1)!.bucket).toBe("not_due");
  });

  it("keeps a credit separate from the money owed", () => {
    const r = receivables({
      invoices: [issued({ id: "x", total: 100 })],
      payments: [payment({ id: "p", invoiceId: "x", amount: 250 })],
      asOf: ASOF,
    });
    expect(r.totalOutstanding).toBe(0);
    expect(r.totalCredit).toBe(150);
    expect(r.clients[0].credit).toBe(150);
  });

  it("says how long since Joy last heard from somebody", () => {
    const r = receivables({
      invoices: [issued({ id: "y", total: 900 })],
      payments: [payment({ id: "p", invoiceId: "y", amount: 100, receivedOn: "2026-07-22" })],
      asOf: ASOF,
    });
    expect(silentFor(r.clients[0], ASOF)).toBe(30);
    expect(silentFor({ ...r.clients[0], lastPaymentOn: null }, ASOF)).toBeNull();
  });
});

describe("recording a payment", () => {
  it("refuses one that arrived before the invoice was sent", () => {
    expect(
      paymentRefusals({
        invoice: issued(),
        payments: [],
        amount: 100,
        receivedOn: "2026-07-01",
        asOf: ASOF,
      }),
    ).toContain("before_issue");
  });

  it("refuses a zero or a negative", () => {
    expect(
      paymentRefusals({ invoice: issued(), payments: [], amount: 0, receivedOn: ASOF, asOf: ASOF }),
    ).toContain("not_positive");
  });

  it("asks before creating a credit on a settled invoice", () => {
    // Usually this is somebody keying a payment against the wrong invoice.
    const args = {
      invoice: issued(),
      payments: [payment()],
      amount: 50,
      receivedOn: ASOF,
      asOf: ASOF,
    };
    expect(paymentRefusals(args)).toContain("already_settled");
    expect(paymentRefusals({ ...args, allowOverpayment: true })).toEqual([]);
  });

  it("refuses a payment against an invoice that is not on file", () => {
    expect(
      paymentRefusals({
        invoice: undefined,
        payments: [],
        amount: 100,
        receivedOn: ASOF,
        asOf: ASOF,
      }),
    ).toEqual(["no_invoice"]);
  });
});

describe("the headline", () => {
  it("names the oldest debt rather than only the total", () => {
    const r = receivables({ invoices: [issued()], payments: [], asOf: ASOF });
    expect(receivablesHeadline(r)).toContain("$640 outstanding");
    expect(receivablesHeadline(r)).toContain("oldest by 11 days");
  });

  it("says so plainly when everything is settled", () => {
    const r = receivables({ invoices: [issued()], payments: [payment()], asOf: ASOF });
    expect(receivablesHeadline(r)).toBe("Nothing outstanding. Every issued invoice is settled.");
  });
});
