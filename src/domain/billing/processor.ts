import type { PaymentMethod } from "@/domain/billing/invoice";

/**
 * The processor boundary — addendum §9, §10, §12.
 *
 * "Use a payment service/adapter rather than putting Stripe calls throughout
 * UI code." This file is that boundary on Joy's side: a port the server layer
 * implements against Stripe, an honest in-memory fake for the prototype, and
 * the reconciliation rule as a pure function.
 *
 * THE RULE THAT SHAPES EVERYTHING HERE (§10): "Do not treat a browser
 * redirect as proof of successful payment." Joy's payment state changes only
 * from a verified processor event — a row in stripe_event_receipts (0021)
 * that reached `processed`. Nothing in this file, and nothing that calls it,
 * marks money received because a request returned or a page came back.
 */

// ------------------------------------------------------------- the port --

export interface InitiatedPayment {
  /** Joy's reference for the attempt, to correlate the eventual event. */
  attemptId: string;
  /** What the processor answered AT INITIATION: in flight, or refused. */
  state: "processing" | "refused";
  refusalReason?: string;
}

/**
 * What the §8.1 server layer implements against Stripe. Every call is
 * server-side; nothing here reaches a browser. Note what the port cannot
 * express: a synchronous "succeeded" — success only ever arrives later, as an
 * event.
 */
export interface PaymentProcessorPort {
  /** Create (or fetch) the processor's customer for a billing account. */
  ensureCustomerRef(billingAccountId: string): Promise<string>;
  /** Begin collecting an invoice. The answer is "in flight", never "done". */
  initiatePayment(input: {
    billingAccountId: string;
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    /** pay_invoice: the client tapped Pay. autopay: the schedule fired. */
    initiatedBy: "client" | "autopay_schedule";
  }): Promise<InitiatedPayment>;
}

/**
 * The prototype's processor. Honest in the way Joy's fakes are honest: it
 * records what was asked and answers "processing" — it never invents a
 * success, because in the real system success only ever arrives as a
 * verified event, and a fake that resolved payments instantly would train
 * every screen built against it to expect the wrong shape.
 */
export class MemoryPaymentProcessor implements PaymentProcessorPort {
  readonly initiated: Array<{
    attemptId: string;
    billingAccountId: string;
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    initiatedBy: "client" | "autopay_schedule";
  }> = [];

  private customers = new Map<string, string>();

  async ensureCustomerRef(billingAccountId: string): Promise<string> {
    const existing = this.customers.get(billingAccountId);
    if (existing) return existing;
    const ref = `cus_memory_${this.customers.size + 1}`;
    this.customers.set(billingAccountId, ref);
    return ref;
  }

  async initiatePayment(
    input: Parameters<PaymentProcessorPort["initiatePayment"]>[0],
  ): Promise<InitiatedPayment> {
    const attemptId = `attempt-${this.initiated.length + 1}`;
    this.initiated.push({ attemptId, ...input });
    return { attemptId, state: "processing" };
  }
}

// ----------------------------------------------------- reconciliation --

/** A verified event receipt, as 0021 stores it. */
export interface ProcessorEventReceipt {
  stripeEventId: string;
  eventType: string;
  relatedInvoiceId: string | null;
  status: "received" | "processed" | "failed" | "skipped";
}

export type ReconcileOutcome =
  | { kind: "record_payment"; invoiceId: string }
  | { kind: "payment_failed"; invoiceId: string }
  | { kind: "nothing"; why: string };

/**
 * What one verified event means for Joy's ledger — §12's list as a function.
 *
 * Idempotency is the caller's contract with 0021: an event id already
 * `processed` must not be offered again, and the unique index refuses the
 * duplicate receipt anyway. This function is deliberately pure — it says what
 * the ledger should do, and the doing (a payments row, a dunning entry, an
 * audit record) goes through the same paths a person's actions do.
 *
 * Event TYPE STRINGS are verified against current Stripe documentation at
 * wiring time — the addendum's own instruction — which is why the match below
 * is on suffixes Joy controls the meaning of, not a hardcoded catalogue
 * presented as complete.
 */
export function reconcileEvent(receipt: ProcessorEventReceipt): ReconcileOutcome {
  if (receipt.status === "processed") {
    return { kind: "nothing", why: "Already processed — reprocessing would double-post." };
  }
  if (!receipt.relatedInvoiceId) {
    return { kind: "nothing", why: "No Joy invoice is related; a person looks at it." };
  }
  if (receipt.eventType.endsWith(".succeeded") || receipt.eventType.endsWith(".paid")) {
    return { kind: "record_payment", invoiceId: receipt.relatedInvoiceId };
  }
  if (receipt.eventType.endsWith(".payment_failed") || receipt.eventType.endsWith(".failed")) {
    return { kind: "payment_failed", invoiceId: receipt.relatedInvoiceId };
  }
  return { kind: "nothing", why: `No ledger meaning assigned to ${receipt.eventType}.` };
}

// ------------------------------------------------------ failure surfaces --

/**
 * §13's two cards, from one failure. The client's says what to do and never
 * why it failed in processor terms; the admin's names the person and lands in
 * Needs You.
 */
export function paymentFailureCards(input: {
  clientName: string;
  invoiceNumber: string;
  amount: number;
  methodSummary: string | null;
}): {
  client: { headline: string; body: string; actions: string[] };
  admin: { queue: "needs_you"; line: string };
} {
  return {
    client: {
      headline: "Payment needs attention",
      body: input.methodSummary
        ? `We couldn't complete the payment for invoice ${input.invoiceNumber} using ${input.methodSummary}.`
        : `We couldn't complete the payment for invoice ${input.invoiceNumber}.`,
      // The two §13 offers, and nothing diagnostic — raw processor errors
      // never reach a family.
      actions: ["Update payment method", "Try again"],
    },
    admin: {
      queue: "needs_you",
      line: `${input.clientName} — invoice ${input.invoiceNumber}, $${input.amount.toFixed(2)}: payment failed.`,
    },
  };
}
