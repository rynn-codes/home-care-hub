import type { Invoice } from "@/domain/billing/invoice";

/**
 * The invoice lifecycle — §7.2's flow, and §7.3's rule about what happens after.
 *
 * The database (0016) is the authority: it refuses illegal transitions, frozen
 * content and unattributed approvals whether or not this module is consulted.
 * This mirror exists so a screen can say "you can't do that, and here is why"
 * before the attempt, instead of translating a Postgres error afterwards.
 *
 * WHY APPROVAL IS A STEP AND NOT A FORMALITY. §7.2 step 7: nothing is collected
 * on an invoice nobody approved. For Joy today that is one person wearing two
 * hats — Karynn drafts and Karynn approves — and the step still earns its place,
 * because it is the moment the numbers stop being a computation and start being
 * what Joy told a family. Everything downstream (adjustments, disputes, the
 * frozen total) hangs off that moment having a name and a time on it.
 */

export type InvoiceLifecycleState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "issued"
  | "processing"
  | "settled"
  | "disputed"
  | "uncollectible"
  | "written_off";

/**
 * Every legal edge. Mirrors `guard_invoice_lifecycle` in 0016 exactly — if the
 * two ever disagree, the database wins and this file has a bug.
 */
export const LIFECYCLE_EDGES: Record<InvoiceLifecycleState, InvoiceLifecycleState[]> = {
  draft: ["pending_approval"],
  pending_approval: ["draft", "approved"],
  approved: ["issued"],
  issued: ["processing", "settled", "disputed", "uncollectible", "written_off"],
  processing: ["issued", "settled", "disputed"],
  // Settled reopens when the balance moves back above zero — a debit
  // adjustment, or a payment correction. It is the money's edge, not a button.
  settled: ["issued"],
  disputed: ["issued", "settled", "uncollectible", "written_off"],
  uncollectible: ["issued", "written_off"],
  written_off: [],
};

export function canMove(from: InvoiceLifecycleState, to: InvoiceLifecycleState): boolean {
  return LIFECYCLE_EDGES[from].includes(to);
}

export const LIFECYCLE_LABELS: Record<InvoiceLifecycleState, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  approved: "Approved — not yet sent",
  issued: "Sent",
  processing: "Charge in flight",
  settled: "Paid",
  disputed: "Disputed",
  uncollectible: "Unlikely to collect",
  written_off: "Written off",
};

// ------------------------------------------------------------------ lines --

export interface ApprovalLine {
  id: string;
  /** Sanitized by rule: "Personal care, 4 hours". Never a wage, a diagnosis or
   * a chart detail — §12. The database enforces it structurally by having no
   * column for any of those. */
  description: string;
  serviceDate: string | null;
  quantity: number;
  unitLabel: string;
  /** The client rate, possibly multiplied. Never a wage — §6.3. */
  unitRate: number;
  amount: number;
}

/** A line must be its own arithmetic, to the cent. */
export function lineAmount(quantity: number, unitRate: number): number {
  return Math.round(quantity * unitRate * 100) / 100;
}

/** Build the lines a draft carries from a computed invoice. */
export function linesFromInvoice(invoice: Invoice): ApprovalLine[] {
  return invoice.lines
    .filter((l) => l.rate !== null)
    .map((l, i) => ({
      id: `line-${i}`,
      description: l.description,
      serviceDate: null,
      quantity: l.hours,
      unitLabel: "hours",
      unitRate: Math.round((l.rate as number) * l.multiplier * 100) / 100,
      amount: l.amount ?? lineAmount(l.hours, (l.rate as number) * l.multiplier),
    }));
}

// --------------------------------------------------------------- approval --

export type ApprovalRefusal =
  | "not_awaiting_approval"
  | "no_lines"
  | "lines_do_not_sum"
  | "no_approver";

export const APPROVAL_MESSAGES: Record<ApprovalRefusal, string> = {
  not_awaiting_approval: "Only an invoice waiting for approval can be approved.",
  no_lines: "An invoice with no lines cannot be approved. What would the family be agreeing to?",
  lines_do_not_sum: "The lines do not add up to the invoice total. One of them is wrong.",
  no_approver: "Approving an invoice is somebody's decision and needs their name.",
};

export function approvalRefusals(input: {
  state: InvoiceLifecycleState;
  lines: readonly ApprovalLine[];
  total: number;
  byUserId: string | null;
}): ApprovalRefusal[] {
  const refusals: ApprovalRefusal[] = [];

  if (input.state !== "pending_approval") refusals.push("not_awaiting_approval");
  if (input.lines.length === 0) refusals.push("no_lines");
  else {
    const sum = Math.round(input.lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;
    if (sum !== Math.round(input.total * 100) / 100) refusals.push("lines_do_not_sum");
  }
  if (!input.byUserId) refusals.push("no_approver");

  return refusals;
}

// ------------------------------------------------------------ adjustments --

export type AdjustmentKind = "credit" | "debit" | "write_off";

export const ADJUSTMENT_LABELS: Record<AdjustmentKind, string> = {
  credit: "Credit — the family owes less",
  debit: "Debit — the family owes more",
  write_off: "Write-off — Joy absorbs it",
};

export interface InvoiceAdjustment {
  id: string;
  invoiceId: string;
  kind: AdjustmentKind;
  /** Always positive; the kind carries the direction. */
  amount: number;
  reason: string;
  createdByUserId: string;
  createdAt: string;
}

export type AdjustmentRefusal = "still_a_draft" | "no_reason" | "not_positive";

export const ADJUSTMENT_MESSAGES: Record<AdjustmentRefusal, string> = {
  still_a_draft: "This invoice is still a draft. Edit the draft — adjustments correct approved invoices.",
  no_reason:
    "An adjustment changes what a family owes. Say why, in words they could be shown.",
  not_positive: "The amount must be positive; the kind carries the direction.",
};

export function adjustmentRefusals(input: {
  invoiceState: InvoiceLifecycleState;
  amount: number;
  reason: string;
}): AdjustmentRefusal[] {
  const refusals: AdjustmentRefusal[] = [];
  if (input.invoiceState === "draft" || input.invoiceState === "pending_approval") {
    refusals.push("still_a_draft");
  }
  if (input.amount <= 0) refusals.push("not_positive");
  if (!input.reason.trim()) refusals.push("no_reason");
  return refusals;
}

/**
 * What is left to pay: the approved total, moved only by adjustments and money.
 * Mirrors `invoice_balance` in 0016.
 */
export function adjustedBalance(input: {
  total: number;
  adjustments: readonly InvoiceAdjustment[];
  paid: number;
}): number {
  const moved = input.adjustments.reduce(
    (t, a) => t + (a.kind === "debit" ? a.amount : -a.amount),
    0,
  );
  return Math.round((input.total + moved - input.paid) * 100) / 100;
}

/**
 * One sentence for the screen: what has changed since approval, and why.
 *
 * The total never changes, so the story of an invoice is its adjustments read
 * in order — which is the point of making corrections append-only.
 */
export function adjustmentTrail(adjustments: readonly InvoiceAdjustment[]): string {
  if (adjustments.length === 0) return "As approved — nothing has changed.";
  const parts = adjustments.map((a) => {
    const sign = a.kind === "debit" ? "+" : "−";
    return `${sign}$${a.amount.toFixed(2)}: ${a.reason}`;
  });
  return parts.join(" ");
}
