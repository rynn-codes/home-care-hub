import type { AuditRecord } from "@/domain/audit/audit";
import type { AdjustmentKind } from "@/domain/billing/approval";
import type { PaymentMethod } from "@/domain/billing/invoice";

/**
 * The financial audit entries — every change to what a family owes, shaped for
 * the trail.
 *
 * §13 of the billing specification: financial actions are audited with actor,
 * timestamp, before and after. The writer (`createAuditWriter`) supplies the
 * refusals and the redaction; what belongs here is the SHAPE — which figures
 * go on the record and, as importantly, which never do.
 *
 * WHAT THESE ENTRIES CARRY. Dollar amounts, states, dates, ids and reasons.
 * Money is not health information, and "who changed this invoice from $480 to
 * $400 and why" is exactly what the trail is for.
 *
 * WHAT THEY NEVER CARRY. Service descriptions, diagnoses, task detail, chart
 * text, or a wage. An invoice LINE is already sanitized by construction
 * (0016); the audit entry about the invoice carries even less — the id is the
 * pointer, and anybody entitled to the detail follows it to a table whose own
 * policies apply. An audit trail with looser reads than the tables it
 * describes is a side door.
 *
 * Every builder returns the writer's input minus organization and actor,
 * which the caller supplies — the same contract as every audited action since
 * the trail was wired.
 */

type Entry = Omit<AuditRecord, "organizationId" | "actor">;

export function invoiceSubmitted(input: { invoiceId: string; total: number }): Entry {
  return {
    action: "invoice.submitted",
    entityType: "invoice",
    entityId: input.invoiceId,
    after: { state: "pending_approval", total: input.total },
  };
}

/**
 * The entry §7.2 step 7 hangs off: collection is gated on this action having
 * happened, so this entry is the trail's record that it did.
 */
export function invoiceApproved(input: {
  invoiceId: string;
  total: number;
  lineCount: number;
  ratePlanVersionId: string | null;
}): Entry {
  return {
    action: "invoice.approved",
    entityType: "invoice",
    entityId: input.invoiceId,
    after: {
      state: "approved",
      total: input.total,
      lines: input.lineCount,
      // Which agreement priced it — the answer to "why was I charged this"
      // after the rate changes.
      ratePlanVersionId: input.ratePlanVersionId,
    },
  };
}

export function invoiceIssued(input: { invoiceId: string; total: number; dueOn: string }): Entry {
  return {
    action: "invoice.issued",
    entityType: "invoice",
    entityId: input.invoiceId,
    after: { state: "issued", total: input.total, dueOn: input.dueOn },
  };
}

/**
 * The approved total never changes, so the story of an invoice after approval
 * is its adjustments — which is why each one is its own entry rather than a
 * before/after on the invoice.
 */
export function invoiceAdjusted(input: {
  invoiceId: string;
  adjustmentId: string;
  kind: AdjustmentKind;
  amount: number;
  reason: string;
  balanceAfter: number;
}): Entry {
  return {
    action: "invoice.adjusted",
    entityType: "invoice",
    entityId: input.invoiceId,
    after: {
      adjustmentId: input.adjustmentId,
      kind: input.kind,
      amount: input.amount,
      reason: input.reason,
      balance: input.balanceAfter,
    },
  };
}

export function invoiceWrittenOff(input: {
  invoiceId: string;
  balance: number;
  reason: string;
}): Entry {
  return {
    action: "invoice.written_off",
    entityType: "invoice",
    entityId: input.invoiceId,
    before: { balance: input.balance },
    after: { state: "written_off", reason: input.reason },
  };
}

/**
 * §7.4 rung 6 — the cheque on the desk. The one rung of the fallback ladder
 * that needs no Stripe, which is why it lands first: Joy can take a payment
 * before anything is connected.
 */
export function externalPaymentRecorded(input: {
  paymentId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  receivedOn: string;
  reference: string | null;
  balanceAfter: number;
}): Entry {
  return {
    action: "payment.recorded_external",
    entityType: "payment",
    entityId: input.paymentId,
    after: {
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method,
      receivedOn: input.receivedOn,
      // The cheque number or last four — what identifies it on a statement
      // when a family rings to ask.
      reference: input.reference,
      balance: input.balanceAfter,
    },
  };
}

/**
 * Who pays for a client changing is the financial fact with the most silent
 * downstream weight — every future invoice goes to somebody else.
 */
export function payerChanged(input: {
  clientPersonId: string;
  fromAccountId: string | null;
  toAccountId: string;
  reason: string;
}): Entry {
  return {
    action: "account.payer_changed",
    entityType: "billing_account",
    entityId: input.toAccountId,
    before: { accountId: input.fromAccountId },
    after: { accountId: input.toAccountId, clientPersonId: input.clientPersonId, reason: input.reason },
  };
}

export function holdPlaced(input: { accountId: string; reason: string }): Entry {
  return {
    action: "account.hold_placed",
    entityType: "billing_account",
    entityId: input.accountId,
    after: { onHold: true, reason: input.reason },
  };
}

export function holdLifted(input: { accountId: string }): Entry {
  return {
    action: "account.hold_lifted",
    entityType: "billing_account",
    entityId: input.accountId,
    after: { onHold: false },
  };
}

export function billingRunCreated(input: {
  runId: string;
  periodStart: string;
  periodEnd: string;
  drafts: number;
  exceptions: number;
}): Entry {
  return {
    action: "billing_run.created",
    entityType: "billing_run",
    entityId: input.runId,
    after: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      drafts: input.drafts,
      exceptions: input.exceptions,
    },
  };
}
