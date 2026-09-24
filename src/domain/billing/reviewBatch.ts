import type { Invoice } from "@/domain/billing/invoice";
import { RUN_EXCEPTION_LABELS, type RunException } from "@/domain/billing/run";
import type { RowStatus } from "@/domain/billing/invoiceStatus";

/**
 * Reviewing invoices one at a time, in a batch.
 *
 * Karynn approves the week's invoices Saturday to Monday. A batch is the
 * list she is walking through and where she is in it — nothing more. It
 * never approves anything itself; each step is her decision, recorded by
 * the action she takes on the item in front of her.
 */

export type BatchKind = "invoice" | "packet";
export type BatchSource = "period" | "selected" | "filtered" | "needs_review" | "individual";

export interface ReviewBatch {
  kind: BatchKind;
  source: BatchSource;
  ids: string[];
  /** Where she is. Equal to `ids.length` once every item has been looked at. */
  index: number;
}

export function startBatch(input: { kind: BatchKind; source: BatchSource; ids: readonly string[]; startAt?: string }): ReviewBatch | null {
  const ids = Array.from(new Set(input.ids));
  if (ids.length === 0) return null;
  const at = input.startAt ? ids.indexOf(input.startAt) : -1;
  return { kind: input.kind, source: input.source, ids, index: at >= 0 ? at : 0 };
}

export function currentId(batch: ReviewBatch): string | null {
  return batch.index >= 0 && batch.index < batch.ids.length ? batch.ids[batch.index] : null;
}

export function batchFinished(batch: ReviewBatch): boolean {
  return batch.index >= batch.ids.length;
}

export function hasPrevious(batch: ReviewBatch): boolean {
  return batch.index > 0;
}

export function hasNext(batch: ReviewBatch): boolean {
  return batch.index < batch.ids.length - 1;
}

export function previous(batch: ReviewBatch): ReviewBatch {
  return hasPrevious(batch) ? { ...batch, index: batch.index - 1 } : batch;
}

/** Steps forward; one past the end is the "review complete" screen. */
export function next(batch: ReviewBatch): ReviewBatch {
  return batch.index < batch.ids.length ? { ...batch, index: batch.index + 1 } : batch;
}

export function jumpTo(batch: ReviewBatch, id: string): ReviewBatch {
  const at = batch.ids.indexOf(id);
  return at >= 0 ? { ...batch, index: at } : batch;
}

export function batchTitle(batch: ReviewBatch): string {
  const noun = batch.kind === "invoice" ? "Invoice" : "Packet";
  return batchFinished(batch) ? "Review complete" : `${noun} ${batch.index + 1} of ${batch.ids.length}`;
}

export function batchSourceLabel(batch: ReviewBatch): string {
  const plural = batch.kind === "invoice" ? "invoices" : "packets";
  const n = batch.ids.length;
  const noun = n === 1 ? plural.slice(0, -1) : plural;
  switch (batch.source) {
    case "period":
      return `All ${noun} (${n})`;
    case "selected":
      return `Selected ${noun} (${n})`;
    case "filtered":
      return `Listed ${noun} (${n})`;
    case "needs_review":
      return `Needs review (${n})`;
    case "individual":
      return `This ${noun}`;
  }
}

// ------------------------------------------------------------ the item --

export type ReviewStatus = RowStatus | "Needs attention";

export type ReviewAction = "edit" | "hold" | "approve" | "move_back" | "view" | "adjust" | "refund" | "resolve";

/** What a person may do with an item in this state. Nothing else is offered. */
export function actionsFor(status: ReviewStatus): ReviewAction[] {
  switch (status) {
    case "Needs review":
      return ["edit", "hold", "approve"];
    case "Ready":
      return ["edit", "move_back"];
    case "Sent":
    case "Past due":
    case "Adjusted":
      return ["view", "adjust"];
    case "Paid":
    case "Refunded":
      return ["view", "refund"];
    case "Void":
      return ["view"];
    case "Needs attention":
      return ["resolve"];
  }
}

export interface ReviewCheck {
  key: string;
  ok: boolean;
  label: string;
  detail: string;
  /** "+$45.00" on a line that adds to the bill; null otherwise. */
  amount: string | null;
}

export interface ReviewLine {
  description: string;
  detail: string | null;
  amount: number | null;
}

export interface ReviewItem {
  key: string;
  draft: Invoice | null;
  lines: ReviewLine[];
  clientName: string;
  payerType: string;
  hours: number;
  rate: number | null;
  amount: number | null;
  status: ReviewStatus;
  invoiceNumber?: string | null;
  /** Joy's one-paragraph read of the invoice. A suggestion; the person decides. */
  recommendation: string;
  checks: ReviewCheck[];
}

/** What Joy says about a draft, from the run's exceptions and whether overtime is on it. */
export function reviewRecommendation(exceptions: readonly RunException[], hasOvertime: boolean): string {
  if (exceptions.length === 0 && !hasOvertime) {
    return "The hours match the schedule and the rate is the one on file. Nothing here needs a decision.";
  }
  const blocking = exceptions.filter((e) => e.blocksDraft);
  if (blocking.length > 0) {
    return `${RUN_EXCEPTION_LABELS[blocking[0].kind]} — ${blocking[0].detail} This has to be settled before the invoice can go.`;
  }
  if (hasOvertime) {
    return "The overtime is on the schedule as worked and is billed at time and a half. Worth a look before approving, because it is the line a family asks about.";
  }
  return `${exceptions.length === 1 ? "One thing" : `${exceptions.length} things`} changed since the schedule was set. Check the amber rows against what you agreed, then approve.`;
}
