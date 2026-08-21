import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_EDGES,
  adjustedBalance,
  adjustmentRefusals,
  adjustmentTrail,
  approvalRefusals,
  canMove,
  lineAmount,
  linesFromInvoice,
  type ApprovalLine,
  type InvoiceAdjustment,
  type InvoiceLifecycleState,
} from "@/domain/billing/approval";
import { buildInvoice, type ClientBillingTerms } from "@/domain/billing/invoice";

const line = (over: Partial<ApprovalLine> = {}): ApprovalLine => ({
  id: "l1",
  description: "Personal care",
  serviceDate: "2026-08-24",
  quantity: 8,
  unitLabel: "hours",
  unitRate: 30,
  amount: 240,
  ...over,
});

describe("the lifecycle graph", () => {
  it("matches the database's whitelist edge for edge", () => {
    // If this list drifts from guard_invoice_lifecycle in 0016, screens will
    // offer buttons the database refuses. The database wins; this test is the
    // reminder to keep them identical.
    expect(LIFECYCLE_EDGES.draft).toEqual(["pending_approval"]);
    expect(LIFECYCLE_EDGES.approved).toEqual(["issued"]);
    expect(LIFECYCLE_EDGES.written_off).toEqual([]);
  });

  it("never skips approval", () => {
    // The property §7.2 step 7 hangs on: every path from draft to money passes
    // through pending_approval and approved, in that order.
    expect(canMove("draft", "issued")).toBe(false);
    expect(canMove("draft", "approved")).toBe(false);
    expect(canMove("pending_approval", "issued")).toBe(false);
  });

  it("only the money reopens a settled invoice", () => {
    expect(LIFECYCLE_EDGES.settled).toEqual(["issued"]);
  });

  it("a write-off is the end", () => {
    const reachable = new Set<InvoiceLifecycleState>();
    for (const [from, tos] of Object.entries(LIFECYCLE_EDGES)) {
      if (from === "written_off") continue;
      tos.forEach((t) => reachable.add(t));
    }
    expect(LIFECYCLE_EDGES.written_off).toHaveLength(0);
    // and it is reachable — a terminal state nobody can reach is decoration.
    expect(reachable.has("written_off")).toBe(true);
  });
});

describe("approving", () => {
  it("refuses an invoice with no lines", () => {
    expect(
      approvalRefusals({ state: "pending_approval", lines: [], total: 480, byUserId: "u" }),
    ).toContain("no_lines");
  });

  it("refuses lines that do not sum to the total", () => {
    expect(
      approvalRefusals({
        state: "pending_approval",
        lines: [line()],
        total: 480,
        byUserId: "u",
      }),
    ).toContain("lines_do_not_sum");
  });

  it("refuses an approval with nobody's name on it", () => {
    expect(
      approvalRefusals({
        state: "pending_approval",
        lines: [line(), line({ id: "l2" })],
        total: 480,
        byUserId: null,
      }),
    ).toContain("no_approver");
  });

  it("approves when the lines are the total and somebody signs", () => {
    expect(
      approvalRefusals({
        state: "pending_approval",
        lines: [line(), line({ id: "l2" })],
        total: 480,
        byUserId: "u-karynn",
      }),
    ).toEqual([]);
  });

  it("is not fooled by floating point", () => {
    // 3 × 33.33 is 99.99 in money and 99.99000000000001 in doubles.
    const l = line({ quantity: 3, unitRate: 33.33, amount: lineAmount(3, 33.33) });
    expect(
      approvalRefusals({ state: "pending_approval", lines: [l], total: 99.99, byUserId: "u" }),
    ).toEqual([]);
  });
});

describe("adjustments", () => {
  const adj = (over: Partial<InvoiceAdjustment> = {}): InvoiceAdjustment => ({
    id: "a1",
    invoiceId: "i1",
    kind: "credit",
    amount: 80,
    reason: "One visit ran short.",
    createdByUserId: "u-karynn",
    createdAt: "2026-08-31T09:00:00Z",
    ...over,
  });

  it("does not correct a draft — the draft is editable", () => {
    expect(
      adjustmentRefusals({ invoiceState: "draft", amount: 50, reason: "x" }),
    ).toContain("still_a_draft");
  });

  it("needs a reason a family could be shown", () => {
    expect(
      adjustmentRefusals({ invoiceState: "issued", amount: 50, reason: "  " }),
    ).toContain("no_reason");
  });

  it("moves the balance without touching the total", () => {
    expect(
      adjustedBalance({ total: 480, adjustments: [adj()], paid: 0 }),
    ).toBe(400);
    expect(
      adjustedBalance({
        total: 480,
        adjustments: [adj(), adj({ id: "a2", kind: "debit", amount: 30 })],
        paid: 400,
      }),
    ).toBe(30);
  });

  it("tells the story in order, because the total never will", () => {
    const trail = adjustmentTrail([
      adj(),
      adj({ id: "a2", kind: "debit", amount: 30, reason: "Card fee passed through." }),
    ]);
    expect(trail).toBe("−$80.00: One visit ran short. +$30.00: Card fee passed through.");
    expect(adjustmentTrail([])).toBe("As approved — nothing has changed.");
  });
});

describe("lines from a computed invoice", () => {
  const terms: ClientBillingTerms = {
    clientPersonId: "c1",
    clientName: "Evelyn Carter",
    hourlyRate: 30,
    paymentMethod: "ach",
    depositRemaining: 0,
  };

  it("carries the multiplied rate on the line, so the line is its own arithmetic", () => {
    const invoice = buildInvoice({
      terms,
      weekStart: "2026-09-07",
      visits: [
        {
          id: "v1",
          clientName: "Evelyn Carter",
          clientPersonId: "c1",
          service: "Personal Care",
          caregiverName: "J",
          // Labour Day 2026 — time and a half per the agreement.
          startsAt: "2026-09-07T09:00:00",
          endsAt: "2026-09-07T13:00:00",
        },
      ],
    });

    const lines = linesFromInvoice(invoice);
    expect(lines).toHaveLength(1);
    expect(lines[0].unitRate).toBe(45);
    expect(lines[0].amount).toBe(180);
    expect(lines[0].amount).toBe(lineAmount(lines[0].quantity, lines[0].unitRate));
  });
});
