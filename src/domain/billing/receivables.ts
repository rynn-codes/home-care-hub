import { ageing, type PaymentMethod } from "@/domain/billing/invoice";
import { daysBetween } from "@/domain/dates";

/**
 * Money owed to Joy, and what has come in against it.
 *
 * WHY THIS NEEDED A NEW MODEL RATHER THAN A NEW QUERY. `buildInvoice` computes
 * a week's invoice from visits, on demand, every time. That is right for
 * showing what a week costs, and it cannot answer "who owes us money", because
 * a computed invoice has no identity: nothing records that it was sent, nothing
 * records that £400 arrived against it in two payments, and re-running the
 * function next month produces a fresh object with no memory of either.
 *
 * So an invoice becomes a thing when it is ISSUED, and payments attach to it.
 *
 * THE DISTINCTION THAT MATTERS MOST. An invoice Joy computed and never sent is
 * not a debt. Nobody owes money they were never asked for, and a receivables
 * report that counts unsent weeks turns every quiet Friday into an accounts
 * problem. Only issued invoices appear here.
 *
 * Joy is all private pay — Karynn, 21 August — which is exactly why this report
 * is the one that matters. There is no payer to chase and no remittance advice
 * arriving on its own: every dollar is a family, and the only thing standing
 * between a late payment and a bad debt is somebody noticing.
 */

export interface IssuedInvoice {
  id: string;
  /**
   * The human number — "JH-10428" (addendum §7). A family reads it over the
   * phone; the office types it into a search box. Assigned by the database
   * (0020); optional here only until the screens read live data.
   */
  invoiceNumber?: string;
  clientPersonId: string;
  clientName: string;
  /** The week it covers, for the conversation about what it is for. */
  weekStart: string;
  weekEnd: string;
  /** What was billed. Never null: an invoice with no total is not issuable. */
  total: number;
  issuedOn: string;
  dueOn: string;
  /** Set when Joy writes the balance off rather than chasing it further. */
  writtenOffOn: string | null;
  writtenOffReason: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  /** Dollars. Partial payments are normal and the model expects them. */
  amount: number;
  receivedOn: string;
  method: PaymentMethod;
  /** The last four, the cheque number — whatever identifies it on a statement. */
  reference: string | null;
}

export type BalanceState =
  | "paid"
  | "part_paid"
  | "outstanding"
  | "overdue"
  | "written_off"
  | "overpaid";

export const BALANCE_LABELS: Record<BalanceState, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  outstanding: "Outstanding",
  overdue: "Overdue",
  written_off: "Written off",
  overpaid: "Credit on account",
};

export interface InvoiceBalance {
  invoice: IssuedInvoice;
  paid: number;
  /** Positive when money is owed to Joy, negative when Joy holds a credit. */
  balance: number;
  daysOverdue: number;
  state: BalanceState;
  /** The most recent payment, for "when did we last hear from them". */
  lastPaymentOn: string | null;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What is left on one invoice.
 *
 * Overpayment is its own state rather than a negative debt. A family who paid
 * twice by accident is owed money by Joy, and showing that as "-$400 owed"
 * inside a list of debts is how it gets netted off against somebody else's
 * arrears and never returned.
 */
export function invoiceBalance(input: {
  invoice: IssuedInvoice;
  payments: readonly Payment[];
  asOf: string;
}): InvoiceBalance {
  const mine = input.payments.filter((p) => p.invoiceId === input.invoice.id);
  const paid = money(mine.reduce((sum, p) => sum + p.amount, 0));
  const balance = money(input.invoice.total - paid);

  const lastPaymentOn =
    mine.length > 0
      ? mine.map((p) => p.receivedOn).sort().at(-1)!
      : null;

  // Ageing runs from the due date, not from when it was issued. An invoice due
  // on Friday is not late on Wednesday, and the agreement's clock is the due
  // date's.
  const age = ageing({
    dueOn: input.invoice.dueOn,
    paid: balance <= 0,
    total: input.invoice.total,
    asOf: input.asOf,
  });

  const state: BalanceState = (() => {
    if (input.invoice.writtenOffOn) return "written_off";
    if (balance < 0) return "overpaid";
    if (balance === 0) return "paid";
    if (age.daysOverdue > 0) return "overdue";
    return paid > 0 ? "part_paid" : "outstanding";
  })();

  return {
    invoice: input.invoice,
    paid,
    balance,
    daysOverdue: age.daysOverdue,
    state,
    lastPaymentOn,
  };
}

/**
 * The standard ageing buckets.
 *
 * Not current/30/60/90 by accident: Joy invoices weekly, so a family who is one
 * invoice behind is a week behind and belongs in "current" alongside everybody
 * else's unpaid Friday. The bucket that means something is 31+, which is a
 * family who has missed roughly four invoices in a row and has probably stopped
 * opening the e-mail.
 */
export type AgeingBucket = "not_due" | "1_30" | "31_60" | "61_90" | "over_90";

export const BUCKET_LABELS: Record<AgeingBucket, string> = {
  not_due: "Not yet due",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  over_90: "Over 90 days",
};

export const BUCKET_ORDER: AgeingBucket[] = ["over_90", "61_90", "31_60", "1_30", "not_due"];

export function bucketOf(daysOverdue: number): AgeingBucket {
  if (daysOverdue <= 0) return "not_due";
  if (daysOverdue <= 30) return "1_30";
  if (daysOverdue <= 60) return "31_60";
  if (daysOverdue <= 90) return "61_90";
  return "over_90";
}

export interface ClientReceivable {
  clientPersonId: string;
  clientName: string;
  /** Owed to Joy. Excludes credits — see `credit`. */
  outstanding: number;
  /** Money Joy holds that belongs to this client. A positive number. */
  credit: number;
  invoiceCount: number;
  oldestDaysOverdue: number;
  worstBucket: AgeingBucket;
  lastPaymentOn: string | null;
  balances: InvoiceBalance[];
}

export interface Receivables {
  /** Owed to Joy across every client. */
  totalOutstanding: number;
  totalOverdue: number;
  totalCredit: number;
  byBucket: Array<{ bucket: AgeingBucket; label: string; amount: number; invoices: number }>;
  clients: ClientReceivable[];
  /** Invoices Joy has decided not to chase. Kept visible; a write-off is a fact. */
  writtenOff: InvoiceBalance[];
}

export function receivables(input: {
  invoices: readonly IssuedInvoice[];
  payments: readonly Payment[];
  asOf: string;
}): Receivables {
  const balances = input.invoices.map((invoice) =>
    invoiceBalance({ invoice, payments: input.payments, asOf: input.asOf }),
  );

  const open = balances.filter((b) => b.state !== "paid" && b.state !== "written_off");
  const writtenOff = balances.filter((b) => b.state === "written_off");

  const byClient = new Map<string, ClientReceivable>();
  for (const b of open) {
    const key = b.invoice.clientPersonId;
    const row =
      byClient.get(key) ??
      ({
        clientPersonId: key,
        clientName: b.invoice.clientName,
        outstanding: 0,
        credit: 0,
        invoiceCount: 0,
        oldestDaysOverdue: 0,
        worstBucket: "not_due",
        lastPaymentOn: null,
        balances: [],
      } satisfies ClientReceivable);

    if (b.balance > 0) row.outstanding = money(row.outstanding + b.balance);
    else row.credit = money(row.credit - b.balance);

    row.invoiceCount += 1;
    row.oldestDaysOverdue = Math.max(row.oldestDaysOverdue, b.daysOverdue);
    row.balances.push(b);
    if (b.lastPaymentOn && (!row.lastPaymentOn || b.lastPaymentOn > row.lastPaymentOn)) {
      row.lastPaymentOn = b.lastPaymentOn;
    }
    byClient.set(key, row);
  }

  for (const row of byClient.values()) {
    row.worstBucket = bucketOf(row.oldestDaysOverdue);
  }

  const bucketTotals = new Map<AgeingBucket, { amount: number; invoices: number }>();
  for (const b of open) {
    if (b.balance <= 0) continue;
    const bucket = bucketOf(b.daysOverdue);
    const t = bucketTotals.get(bucket) ?? { amount: 0, invoices: 0 };
    t.amount = money(t.amount + b.balance);
    t.invoices += 1;
    bucketTotals.set(bucket, t);
  }

  const clients = [...byClient.values()].sort(
    (a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue || b.outstanding - a.outstanding,
  );

  return {
    totalOutstanding: money(open.reduce((n, b) => n + Math.max(b.balance, 0), 0)),
    totalOverdue: money(
      open.filter((b) => b.daysOverdue > 0).reduce((n, b) => n + Math.max(b.balance, 0), 0),
    ),
    totalCredit: money(open.reduce((n, b) => n + Math.max(-b.balance, 0), 0)),
    byBucket: BUCKET_ORDER.filter((bucket) => bucketTotals.has(bucket)).map((bucket) => ({
      bucket,
      label: BUCKET_LABELS[bucket],
      amount: bucketTotals.get(bucket)!.amount,
      invoices: bucketTotals.get(bucket)!.invoices,
    })),
    clients,
    writtenOff,
  };
}

// ------------------------------------------------------------- recording --

export type PaymentRefusal =
  | "no_invoice"
  | "not_positive"
  | "already_settled"
  | "before_issue";

export const PAYMENT_MESSAGES: Record<PaymentRefusal, string> = {
  no_invoice: "That invoice is not on file.",
  not_positive: "A payment has to be an amount. Record a credit or a write-off instead.",
  already_settled: "This invoice is settled. Recording more against it creates a credit — if that is what happened, say so explicitly.",
  before_issue: "A payment cannot arrive before the invoice was sent. Check the date.",
};

export function paymentRefusals(input: {
  invoice: IssuedInvoice | undefined;
  payments: readonly Payment[];
  amount: number;
  receivedOn: string;
  asOf: string;
  /** The caller has confirmed an overpayment is intended. */
  allowOverpayment?: boolean;
}): PaymentRefusal[] {
  const refusals: PaymentRefusal[] = [];
  if (!input.invoice) return ["no_invoice"];

  if (!(input.amount > 0)) refusals.push("not_positive");
  if (input.receivedOn.slice(0, 10) < input.invoice.issuedOn.slice(0, 10)) {
    refusals.push("before_issue");
  }

  if (!input.allowOverpayment) {
    const current = invoiceBalance({
      invoice: input.invoice,
      payments: input.payments,
      asOf: input.asOf,
    });
    if (current.balance <= 0) refusals.push("already_settled");
  }

  return refusals;
}

/**
 * Write an invoice off.
 *
 * A reason is required and the row stays visible. A debt that disappears from
 * the report the moment somebody gives up on it is a debt nobody can later ask
 * why Joy gave up on — and the pattern of write-offs is the more useful thing
 * to be able to see.
 */
export function writeOff(input: {
  invoice: IssuedInvoice;
  reason: string;
  on: string;
}): IssuedInvoice {
  if (!input.reason.trim()) {
    throw new Error("Writing off a balance needs a reason. It stays on the record either way.");
  }
  return {
    ...input.invoice,
    writtenOffOn: input.on,
    writtenOffReason: input.reason.trim(),
  };
}

/** Plain English for the top of the report. */
export function receivablesHeadline(r: Receivables): string {
  if (r.totalOutstanding === 0 && r.totalCredit === 0) {
    return "Nothing outstanding. Every issued invoice is settled.";
  }

  const parts: string[] = [];
  if (r.totalOutstanding > 0) {
    parts.push(`$${r.totalOutstanding.toLocaleString()} outstanding`);
  }
  if (r.totalOverdue > 0) {
    const worst = r.clients[0];
    parts.push(
      `$${r.totalOverdue.toLocaleString()} of it overdue, the oldest by ${worst.oldestDaysOverdue} days`,
    );
  }
  if (r.totalCredit > 0) {
    parts.push(`$${r.totalCredit.toLocaleString()} of credit Joy is holding`);
  }
  return `${parts.join(", ")}.`;
}

/** Days since Joy last heard from a client, for the chasing conversation. */
export function silentFor(row: ClientReceivable, asOf: string): number | null {
  return row.lastPaymentOn ? daysBetween(row.lastPaymentOn, asOf) : null;
}
