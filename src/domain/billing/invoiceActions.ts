import type { IssuedInvoice, InvoiceAdjustment } from "@/domain/billing/receivables";
import type { PaymentAuthorization } from "@/domain/billing/paymentAuthorization";

export type { InvoiceAdjustment } from "@/domain/billing/receivables";

/**
 * What can be done to an invoice after it exists: adjust it, refund it,
 * void it, resend it. Every one keeps the original amount on the record —
 * a correction is a second fact beside the first, never a rewrite of it.
 */

// ----------------------------------------------------------- adjustments --

export type AdjustmentKind = "credit" | "debit" | "write_off";

export const ADJUSTMENT_LABELS: Record<AdjustmentKind, string> = {
  credit: "Credit — the family owes less",
  debit: "Debit — the family owes more",
  write_off: "Write-off — Joy absorbs it",
};

export type AdjustmentRefusal = "still_a_draft" | "no_reason" | "not_positive";

export const ADJUSTMENT_MESSAGES: Record<AdjustmentRefusal, string> = {
  still_a_draft: "This invoice is still a draft. Edit the draft — adjustments correct approved invoices.",
  no_reason: "An adjustment changes what a family owes. Say why, in words they could be shown.",
  not_positive: "The amount must be positive; the kind carries the direction.",
};

export function adjustmentRefusals(input: { amount: number; reason: string }): AdjustmentRefusal[] {
  const refusals: AdjustmentRefusal[] = [];
  if (input.amount <= 0) refusals.push("not_positive");
  if (!input.reason.trim()) refusals.push("no_reason");
  return refusals;
}

/** Original, the net of every adjustment, and where it stands now. */
export function financialHistory(invoice: IssuedInvoice): { original: number; adjustment: number; revised: number; adjusted: boolean } {
  const adjustments = invoice.adjustments ?? [];
  const net = adjustments.reduce((t, a) => t + (a.kind === "debit" ? a.amount : -a.amount), 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { original: round(invoice.total - net), adjustment: round(net), revised: invoice.total, adjusted: adjustments.length > 0 };
}

// --------------------------------------------------------------- refunds --

export type RefundKind = "not_delivered" | "charged_in_error";

export const REFUND_KIND_LABELS: Record<RefundKind, string> = {
  not_delivered: "Care wasn't delivered",
  charged_in_error: "Charged by mistake",
};

export const REFUND_KIND_MEANINGS: Record<RefundKind, string> = {
  not_delivered: "The invoice comes down by the same amount. The family owes less.",
  charged_in_error: "The invoice stands. The week goes back to being unpaid.",
};

/** A refund for care not delivered also reduces the invoice; a mistaken charge does not. */
export function reducesInvoice(kind: RefundKind): boolean {
  return kind === "not_delivered";
}

export type RefundRefusal = "nothing_collected" | "not_positive" | "over_collected" | "no_reason";

export const REFUND_MESSAGES: Record<RefundRefusal, string> = {
  nothing_collected: "Nothing has been collected on this invoice, so there is nothing to send back. Void it or adjust it instead.",
  not_positive: "Enter the amount to send back.",
  over_collected: "A refund cannot be larger than what was collected.",
  no_reason: "A refund sends money back to a family. Say why, in words they could be shown.",
};

export function refundRefusals(input: { paid: number; amount: number; reason: string }): RefundRefusal[] {
  const refusals: RefundRefusal[] = [];
  if (input.paid <= 0) refusals.push("nothing_collected");
  if (input.amount <= 0) refusals.push("not_positive");
  if (input.paid > 0 && input.amount > input.paid) refusals.push("over_collected");
  if (!input.reason.trim()) refusals.push("no_reason");
  return refusals;
}

export function lessMoney(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

export const REFUND_FEE_NOTE = "Stripe keeps its processing fee on a refund.";

export interface Refund {
  id: string;
  invoiceId: string;
  amount: number;
  reason: string;
  kind: RefundKind;
  on: string;
  issuedByUserId: string;
}

// -------------------------------------------------------- payment status --

export type PaymentStage = "sent" | "viewed" | "payment_sent" | "paid";
export const PAYMENT_STAGES: readonly PaymentStage[] = ["sent", "viewed", "payment_sent", "paid"];
export const PAYMENT_STAGE_LABELS: Record<PaymentStage, string> = {
  sent: "Sent",
  viewed: "Viewed",
  payment_sent: "Payment sent",
  paid: "Paid",
};

export type StageState = "done" | "failed" | "waiting" | "untracked";

export interface PaymentStatusInput {
  issuedOn: string | null;
  paidOn: string | null;
  settled: boolean;
  failedOn: string | null;
}

/**
 * The four stages of an invoice's life after sending. "Viewed" is untracked
 * on purpose: Joy does not know when a family opened it, and a bar that
 * claimed to would be guessing.
 */
export function paymentStages(input: PaymentStatusInput): Array<{ stage: PaymentStage; state: StageState; on: string | null }> {
  const sent = input.issuedOn !== null;
  return [
    { stage: "sent", state: sent ? "done" : "waiting", on: input.issuedOn },
    { stage: "viewed", state: "untracked", on: null },
    {
      stage: "payment_sent",
      state: input.failedOn ? "failed" : input.settled || input.paidOn ? "done" : sent ? "untracked" : "waiting",
      on: input.failedOn ?? input.paidOn,
    },
    { stage: "paid", state: input.settled ? "done" : "waiting", on: input.settled ? input.paidOn : null },
  ];
}

export type PaymentStatusLabel = "Paid" | "Payment failed" | "Payment sent" | "Sent" | "Not sent";

export function paymentStatusLabel(input: PaymentStatusInput): PaymentStatusLabel {
  if (input.settled) return "Paid";
  if (input.failedOn) return "Payment failed";
  if (input.paidOn) return "Payment sent";
  if (input.issuedOn) return "Sent";
  return "Not sent";
}

/** "today", "3d ago", "in 2d". */
export function relativeDay(iso: string | null, asOf: string): string | null {
  if (!iso) return null;
  const then = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  const now = new Date(`${asOf.slice(0, 10)}T12:00:00`).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  const days = Math.round((now - then) / 864e5);
  return days === 0 ? "today" : days > 0 ? `${days}d ago` : `in ${Math.abs(days)}d`;
}

export const PAYMENT_STATUS_PILL: Record<PaymentStatusLabel, string> = {
  "Not sent": "bg-[var(--wash-strong)] text-muted-foreground",
  Sent: "bg-[#EEF0FE] text-primary",
  "Payment failed": "bg-[#FEF3F2] text-[#B42318]",
  "Payment sent": "bg-[#EEF0FE] text-primary",
  Paid: "bg-[#ECFDF3] text-[#027A48]",
};

export const PAYMENT_STATUS_DOT: Record<PaymentStatusLabel, string> = {
  "Not sent": "bg-[#98A2B3]",
  Sent: "bg-primary",
  "Payment failed": "bg-[#D92D20]",
  "Payment sent": "bg-primary",
  Paid: "bg-[#12B76A]",
};

export const STAGE_BAR: Record<StageState, string> = {
  done: "bg-[#12B76A]",
  failed: "bg-[#D92D20]",
  waiting: "bg-[var(--wash-strong)]",
  untracked: "bg-[var(--wash-strong)]",
};

// ------------------------------------------------------------- actions --

export type InvoiceAction =
  | "Edit invoice"
  | "Preview invoice"
  | "Add adjustment"
  | "Resend invoice"
  | "Issue refund"
  | "Void invoice"
  | "Edit payer setup";

/** The menu on an invoice, from what has happened to it. */
export function invoiceActions(input: { issued: boolean; voided: boolean; settled: boolean; collected: number }): InvoiceAction[] {
  if (input.voided) return ["Preview invoice", "Edit payer setup"];
  if (input.issued) {
    return [
      "Preview invoice",
      ...(input.settled ? [] : (["Add adjustment"] as InvoiceAction[])),
      "Resend invoice",
      ...(input.collected > 0 ? (["Issue refund"] as InvoiceAction[]) : []),
      ...(input.settled ? [] : (["Void invoice"] as InvoiceAction[])),
      "Edit payer setup",
    ];
  }
  return ["Edit invoice", "Preview invoice", "Edit payer setup"];
}

// -------------------------------------------------------- failed charges --

export interface PaymentFailure {
  invoiceId: string;
  clientPersonId: string;
  clientName: string;
  amount: number;
  failedOn: string;
  reason: string;
  attempts: number;
  lastAttemptAt: string;
}

export const RETRY = { retryAfterHours: 24 } as const;

export type RetryRefusal = "no_authorization" | "authorization_revoked" | "client_initiates" | "too_soon" | "method_unusable";

export const RETRY_MESSAGES: Record<RetryRefusal, string> = {
  no_authorization: "No payment authorization is on file for this account. A saved card is not permission — capture Joy's form first.",
  authorization_revoked: "The authorization was revoked. Charging again would be a charge they withdrew permission for; this is a conversation, then a new form.",
  client_initiates: "This account pays by invoice rather than autopay, so the client initiates payment. Resend the invoice instead.",
  too_soon: `Already retried within ${RETRY.retryAfterHours} hours. A second decline in the same day is the same decline, and repeated attempts can trip the bank's fraud controls against the client.`,
  method_unusable: "The saved payment method is expired or failed verification. There is nothing to charge until the family provides another.",
};

function hoursBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isNaN(ms) ? Infinity : ms / 36e5;
}

/** §7.4: one retry, same method, about a day later — and only with authority to charge. */
export function retryRefusals(input: { failure: PaymentFailure; authorization: PaymentAuthorization | null; asOf: string }): RetryRefusal[] {
  const refusals: RetryRefusal[] = [];
  if (!input.authorization) refusals.push("no_authorization");
  else if (input.authorization.status !== "active") refusals.push("authorization_revoked");
  else if (input.authorization.paymentMode !== "autopay") refusals.push("client_initiates");
  if (hoursBetween(input.failure.lastAttemptAt, input.asOf) < RETRY.retryAfterHours) refusals.push("too_soon");
  return refusals;
}
