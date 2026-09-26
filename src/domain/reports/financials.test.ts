import { describe, expect, it } from "vitest";
import type { IssuedInvoice, Payment } from "@/domain/billing/receivables";
import type { Refund } from "@/domain/billing/invoiceActions";
import type { TimeEntry } from "@/domain/payroll/hours";
import type { VisitExpense } from "@/domain/scheduling/expenses";
import type { Visit } from "@/domain/scheduling/conflicts";
import { adjustmentsLog, investorReportText, investorShare, investorShareRows, monthlyMoney, paymentsReceived, payrollCost, reimbursements, revenueByClient, revenueSummary } from "./financials";

const range = { start: "2026-08-01", end: "2026-09-30", label: "Aug–Sep" };

const inv = (over: Partial<IssuedInvoice> & { id: string; total: number; issuedOn: string }): IssuedInvoice => ({
  invoiceNumber: `JH-${over.id}`,
  clientPersonId: "c-pamela",
  clientName: "Pamela P",
  weekStart: "2026-08-01",
  weekEnd: "2026-08-07",
  dueOn: over.issuedOn,
  writtenOffOn: null,
  writtenOffReason: null,
  ...over,
});

const invoices: IssuedInvoice[] = [
  inv({ id: "1", total: 1000, issuedOn: "2026-08-05" }),
  // Billed 1200, credited 200 in September.
  inv({ id: "2", total: 1000, issuedOn: "2026-08-20", adjustments: [{ id: "a", invoiceId: "2", kind: "credit", amount: 200, reason: "Hours removed", createdByUserId: "Karynn", createdAt: "2026-09-02T10:00:00" }] }),
  inv({ id: "3", total: 500, issuedOn: "2026-09-10", clientPersonId: "c-jessie", clientName: "Jessie C" }),
  // Written off in September with 300 still owed.
  inv({ id: "4", total: 300, issuedOn: "2026-08-25", writtenOffOn: "2026-09-15", writtenOffReason: "Family moved away", clientPersonId: "c-jessie", clientName: "Jessie C" }),
];
const payments: Payment[] = [
  { id: "p1", invoiceId: "1", amount: 1000, receivedOn: "2026-08-12", method: "ach", reference: "ACH 1" },
  { id: "p2", invoiceId: "2", amount: 600, receivedOn: "2026-09-05", method: "card", reference: null },
  { id: "p3", invoiceId: "3", amount: -100, receivedOn: "2026-09-20", method: "card", reference: "Refund" },
  { id: "p4", invoiceId: "3", amount: 500, receivedOn: "2026-09-12", method: "check", reference: "1042" },
];

describe("monthly money", () => {
  it("separates billed, net billed, collected and net collected by month", () => {
    const [aug, sep] = monthlyMoney({ invoices, payments, range });
    expect(aug).toMatchObject({ month: "2026-08", billed: 2500, credits: 0, netBilled: 2500, collected: 1000, refunded: 0, netCollected: 1000 });
    expect(sep).toMatchObject({ month: "2026-09", billed: 500, credits: 200, writtenOff: 300, netBilled: 0, collected: 1100, refunded: 100, netCollected: 1000 });
  });

  it("uses the original amount for billed, not the credited one", () => {
    const [aug] = monthlyMoney({ invoices: [invoices[1]], payments: [], range });
    expect(aug.billed).toBe(1200);
  });

  it("reports every month in the range, even a quiet one", () => {
    const rows = monthlyMoney({ invoices: [], payments: [], range });
    expect(rows.map((r) => r.month)).toEqual(["2026-08", "2026-09"]);
    expect(revenueSummary({ invoices: [], payments: [], range }).state).toBe("empty");
  });
});

describe("investor share", () => {
  it("is a percentage of collected money, less refunds by default", () => {
    const rows = investorShareRows({ payments, range, percent: 10, basis: "net_collected" });
    expect(rows[1]).toMatchObject({ month: "2026-09", collected: 1100, refunded: 100, basisAmount: 1000, due: 100 });
    const before = investorShareRows({ payments, range, percent: 10, basis: "collected" });
    expect(before[1].due).toBe(110);
  });

  it("refuses until the percentage is set", () => {
    expect(investorShare({ payments, range, percent: 0, basis: "net_collected", investorName: "" }).state).toBe("needs_input");
    expect(investorShare({ payments, range, percent: 10, basis: "net_collected", investorName: "R. Investor" }).columns.at(-1)?.label).toBe("Due to R. Investor");
  });

  it("writes a report with figures and no names", () => {
    const [, sep] = investorShareRows({ payments, range, percent: 10, basis: "net_collected" });
    const text = investorReportText({ row: sep, agencyName: "Joy Health", investorName: "R. Investor", basis: "net_collected" });
    expect(text.subject).toContain("$100.00 due");
    expect(text.body).toContain("Amount due: $100.00");
    expect(text.body).not.toContain("Pamela");
    expect(text.body).not.toContain("Jessie");
  });
});

describe("bookkeeper lists", () => {
  it("lists payments newest first with refunds negative", () => {
    const r = paymentsReceived({ invoices, payments, range });
    expect(r.rows[0]).toMatchObject({ date: "2026-09-20", method: "Refund", amount: -100, client: "Jessie C" });
    expect(r.subtitle).toContain("$2,100 received, $100 refunded");
  });

  it("logs credits, write-offs and refunds with their reasons", () => {
    const refunds: Refund[] = [{ id: "r1", invoiceId: "3", amount: 100, reason: "Charged twice", kind: "charged_in_error", on: "2026-09-20", issuedByUserId: "Karynn" }];
    const r = adjustmentsLog({ invoices, refunds, range });
    expect(r.rows.map((x) => x.kind)).toEqual(["Refund · Charged by mistake", "Written off", "Credit"]);
    expect(r.rows[2]).toMatchObject({ amount: -200, reason: "Hours removed" });
  });

  it("totals billed and collected per client", () => {
    const r = revenueByClient({ invoices, payments, range });
    expect(r.rows[0]).toMatchObject({ client: "Pamela P", invoices: 2, billed: 2200, credits: 200, collected: 1600, outstanding: 400 });
    // Written-off invoice owes nothing; the refunded one still has $100 open.
    expect(r.rows[1]).toMatchObject({ client: "Jessie C", invoices: 2, billed: 800, collected: 400, outstanding: 100 });
  });
});

describe("payroll cost", () => {
  const entries: TimeEntry[] = [
    { id: "t1", visitId: "v1", caregiverPersonId: "p1", clockedInAt: "2026-09-07T08:00:00", clockedOutAt: "2026-09-07T20:00:00", exceptionReason: null },
    { id: "t2", visitId: "v2", caregiverPersonId: "p1", clockedInAt: "2026-09-08T08:00:00", clockedOutAt: "2026-09-08T20:00:00", exceptionReason: null },
    { id: "t3", visitId: "v3", caregiverPersonId: "p1", clockedInAt: "2026-09-09T08:00:00", clockedOutAt: "2026-09-09T20:00:00", exceptionReason: null },
    { id: "t4", visitId: "v4", caregiverPersonId: "p1", clockedInAt: "2026-09-10T08:00:00", clockedOutAt: "2026-09-10T20:00:00", exceptionReason: null },
    { id: "t5", visitId: "v5", caregiverPersonId: "p2", clockedInAt: "2026-09-10T08:00:00", clockedOutAt: "2026-09-10T12:00:00", exceptionReason: null },
  ];
  it("prices regular and overtime hours at the base rate", () => {
    const r = payrollCost({ entries, nameFor: (id) => (id === "p1" ? "Thylia B" : "Vanessa J"), rateFor: (n) => (n === "Thylia B" ? 15 : null), range });
    expect(r.rows[0]).toMatchObject({ caregiver: "Thylia B", regular: 40, overtime: 8, gross: 40 * 15 + 8 * 22.5 });
    expect(r.rows[1]).toMatchObject({ caregiver: "Vanessa J", gross: 0 });
    expect(r.note).toContain("Vanessa J");
  });
});

describe("reimbursements", () => {
  it("prices mileage at the agency rate and leaves client-settled items out", () => {
    const visits = [{ id: "v1", caregiverName: "Thylia B" }] as unknown as Visit[];
    const base = { visitId: "v1", description: "", recordedBy: "Thylia B", recordedOn: "2026-09-10", receipt: null } as unknown as VisitExpense;
    const visitExpenses: Record<string, VisitExpense[]> = {
      v1: [
        { ...base, id: "e1", category: "mileage", date: "2026-09-10", amount: 0, miles: 20, reviewedAt: "2026-09-11T09:00:00" },
        { ...base, id: "e2", category: "meals", date: "2026-09-10", amount: 12, miles: 0 },
        { ...base, id: "e3", category: "supplies", date: "2026-09-10", amount: 40, miles: 0 },
        { ...base, id: "e4", category: "gas", date: "2026-07-01", amount: 30, miles: 0 },
      ],
    };
    const r = reimbursements({ visitExpenses, visits, mileageRatePerMile: 0.7, range });
    expect(r.rows[0]).toMatchObject({ caregiver: "Thylia B", miles: 20, mileage: 14, other: 12, total: 26, awaitingReview: 1 });
  });
});
