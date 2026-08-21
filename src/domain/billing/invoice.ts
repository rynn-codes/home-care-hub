import type { Visit } from "@/domain/scheduling/conflicts";
import { hoursOf } from "@/domain/scheduling/conflicts";
import { HOLIDAY_LABELS, holidayOn, type HolidayKey } from "@/domain/billing/holidays";
import { billableHours, type VerifiedServiceUnit } from "@/domain/service/verifiedUnit";

/**
 * Billing — what a client owes, from the terms they signed.
 *
 * Every rule here comes from the service agreement in the consents registry
 * rather than from a general idea of how invoicing works. The relevant clauses
 * are `deposit`, `holiday_overtime`, `invoicing` and `payment_method`, pages 3
 * and 4 of the packet.
 *
 *   Deposit          one week of the agreed hours, applied to the first weeks
 *                    of service, "not an extra charge"
 *   Time and a half  over 40 hours, and on the seven named holidays
 *   Invoicing        weekly, one calendar day to pay
 *   Convenience fee  2.9% on card, $5 on ACH
 *   Late fee         $100 after the third day
 *   Suspension       services may be suspended within 24 hours of non-payment
 *
 * A CONTRADICTION IN THE PACKET, FLAGGED
 *
 * The invoicing clause says both things: "will invoice every week in advance"
 * and, in the next sentence, "Due to billing in arrears, the undersigned agrees
 * to submit payment within 1 calendar day."
 *
 * Those cannot both be true, and it matters — in advance means a family pays
 * before care happens, in arrears means after. This is a signed document, so
 * the ambiguity is a real problem rather than a typo to work around, and it is
 * the sort of thing that gets read back to an agency in a dispute.
 *
 * Joy bills in ADVANCE from the scheduled week, because that is the clause's
 * operative sentence and it matches the deposit, which only makes sense if
 * money arrives first. `reconcile` then compares the invoice to what was
 * actually worked. Karynn should have the wording corrected either way; see
 * `PACKET_CONTRADICTION`.
 *
 * NOT EVERY VISIT ON THE BOARD IS CARE
 *
 * The schedule carries more than client visits. A field orientation puts a new
 * caregiver's name in the client column; an RN assessment is Joy's own nurse.
 * Billing straight off the board invoiced a caregiver for their own training —
 * caught by looking at the screen rather than by a test, because every fixture
 * I had written happened to be ordinary care.
 *
 * So a visit is billable only when it has no event type — ordinary client care
 * — or when its event type is explicitly listed as billable. A new event type
 * is therefore non-billable until somebody says otherwise, which is the right
 * direction to be wrong in: failing to charge is recoverable, and charging a
 * family for something that never happened to them is not.
 *
 * NO RATE MEANS NO RATE, NOT ZERO
 *
 * The rate on a client is confidential and per-client — the packet has Joy
 * emailing it separately "to ensure financial privacy" — and Joy has none of
 * the real ones. So a client with no rate produces a line that says so and an
 * invoice that cannot be sent. A zero would look like a settled fact and a
 * family would be told they owed nothing.
 */

/**
 * JOY BILLS IN ADVANCE. The packet's arrears sentence is a mistake.
 *
 * Karynn, 21 August: "We bill in advance. Make sure that is noted. In arrears is
 * incorrect." That is the business owner correcting her own document, not an
 * inference from it, and it settles a question that has been open since Billing
 * was built. The specification agrees independently — evidence J-05, Joy
 * invoices the upcoming care week — but her sentence is the authority.
 *
 * The note stays on the Billing screen, and it now says the packet is WRONG
 * rather than that it is ambiguous. Those are different things to tell somebody.
 * Ambiguous invites a judgement call at the desk; wrong tells them which
 * sentence to ignore and that a corrected packet is coming.
 *
 * IT STAYS UNTIL THE REPRINT because the client-facing document is still out
 * there. A family reading their signed agreement finds a sentence saying they
 * are billed in arrears, and the first time that matters is an argument about a
 * week nobody has delivered yet — with the family holding a signed page that
 * appears to support them.
 */
export const PACKET_CONTRADICTION =
  'Joy bills in advance. The agreement also carries the sentence "due to billing in arrears", ' +
  "which is incorrect and is on the list for the next printing. Where the two disagree, in " +
  "advance is right — Karynn, 21 August.";

/** From the signed agreement. */
export const OVERTIME_AFTER_HOURS = 40;
export const TIME_AND_A_HALF = 1.5;
export const CARD_CONVENIENCE_RATE = 0.029;
export const ACH_CONVENIENCE_FEE = 5;
export const LATE_FEE = 100;
export const LATE_FEE_AFTER_DAYS = 3;
export const PAYMENT_DUE_DAYS = 1;
export const SUSPENSION_AFTER_HOURS = 24;

/**
 * Event types Joy charges for by default.
 *
 * Empty, and settled rather than merely unanswered. Karynn ruled on 20 Aug:
 * "RN admission is free unless noted otherwise." So the assessment is not on
 * this list, and the exception is per-visit rather than per-type — see
 * `billableOverride`. A blanket flag would have made every future assessment
 * chargeable the moment somebody wanted to charge for one.
 */
export const BILLABLE_EVENT_TYPES: readonly string[] = [];

/**
 * Is there anything to charge for here?
 *
 * Three cases, in order. An explicit note on the visit wins — that is Karynn's
 * "unless noted otherwise", and it can go either way: charge for an assessment
 * that would normally be free, or waive a visit that would normally be billed.
 * Then ordinary client care, which carries no event type. Then anything else,
 * which is not billable until it is listed.
 *
 * The default for an unrecognised event type is deliberately "no". Failing to
 * charge is recoverable; charging a family for something that never happened
 * to them is not.
 */
export function isBillable(visit: Visit): boolean {
  if (visit.billableOverride !== undefined) return visit.billableOverride;
  if (!visit.eventType) return true;
  return BILLABLE_EVENT_TYPES.includes(visit.eventType);
}

export type PaymentMethod = "card" | "ach" | "check";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Credit or debit card",
  ach: "ACH",
  check: "Cheque",
};

export interface ClientBillingTerms {
  clientPersonId: string;
  clientName: string;
  /** Dollars per hour. Null when Joy has not been given one. */
  hourlyRate: number | null;
  paymentMethod: PaymentMethod;
  /** Dollars of deposit still available to apply. */
  depositRemaining: number;
}

export type LineKind = "standard" | "overtime" | "holiday";

export interface InvoiceLine {
  kind: LineKind;
  description: string;
  hours: number;
  /** Null when the client has no rate on file. */
  rate: number | null;
  multiplier: number;
  /** Null when the rate is. */
  amount: number | null;
}

export type InvoiceState = "cannot_bill" | "draft" | "sent" | "paid" | "overdue" | "suspended";

export interface Invoice {
  clientPersonId: string;
  clientName: string;
  /**
   * Which rate this was priced from — §6.2's `rate_plan_version_id`.
   *
   * Null when the invoice could not be priced, and null for a caller still
   * passing a bare rate rather than a version. Without it, "why was I charged
   * this" has no answer once the rate changes: the invoice says an amount and
   * nothing says which agreement produced it.
   */
  ratePlanVersionId: string | null;
  weekStart: string;
  weekEnd: string;
  lines: InvoiceLine[];
  /** Before deposit and fees. Null when any line lacks a rate. */
  subtotal: number | null;
  depositApplied: number;
  convenienceFee: number;
  lateFee: number;
  total: number | null;
  dueOn: string;
  state: InvoiceState;
  /** Why it cannot be billed, when it cannot. */
  blockedReason: string | null;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Split a week's visits into standard, holiday and overtime hours.
 *
 * Order matters and is not obvious. Holiday hours are taken out first, then
 * overtime is measured against what remains. Billing a holiday hour twice —
 * once at 1.5× for the holiday and again at 1.5× for pushing the week over 40 —
 * would be double-charging a family for the same hour, and the agreement
 * describes one rate of one and a half, not a stacking one.
 */
export function splitHours(
  visits: readonly Visit[],
  /**
   * How long each visit was, for billing.
   *
   * Defaults to the scheduled length, which is what Joy invoiced from before
   * there was an approved fact to read. Pass a resolver and the approved
   * billable figure prices the invoice instead — see `buildInvoice`.
   */
  hoursFor: (visit: Visit) => number = hoursOf,
): {
  standard: number;
  overtime: number;
  holidays: Array<{ key: HolidayKey; hours: number }>;
} {
  const byHoliday = new Map<HolidayKey, number>();
  let ordinary = 0;

  for (const visit of visits) {
    const hours = hoursFor(visit);
    const holiday = holidayOn(visit.startsAt);
    if (holiday) {
      byHoliday.set(holiday, money((byHoliday.get(holiday) ?? 0) + hours));
    } else {
      ordinary += hours;
    }
  }

  ordinary = money(ordinary);
  const overtime = money(Math.max(0, ordinary - OVERTIME_AFTER_HOURS));

  return {
    standard: money(ordinary - overtime),
    overtime,
    holidays: [...byHoliday.entries()].map(([key, hours]) => ({ key, hours })),
  };
}

export function buildInvoice(input: {
  terms: ClientBillingTerms;
  visits: readonly Visit[];
  weekStart: string;
  applyDeposit?: boolean;
  /**
   * The rate in effect for this week, when the caller has one.
   *
   * Optional so existing callers keep working while Phase 1 lands. When it is
   * given it WINS over `terms.hourlyRate` and the invoice records which version
   * priced it. The version is the direction of travel; `terms.hourlyRate` is the
   * shape being migrated away from.
   */
  rateVersion?: { id: string; hourlyRate: number } | null;
  /**
   * The approved facts for this week's visits, where they exist.
   *
   * Optional for the same reason `rateVersion` is: absent, this prices from the
   * scheduled hours exactly as before. Where a unit exists it wins — §3.1.5
   * forbids billing inferring its own answer from raw visit data when the
   * office has already approved one. A visit still under review blocks the
   * invoice rather than being billed at the scheduled length.
   */
  units?: readonly VerifiedServiceUnit[];
}): Invoice {
  const { terms, weekStart } = input;
  const weekEnd = addDays(weekStart, 6);
  const rate = input.rateVersion ? input.rateVersion.hourlyRate : terms.hourlyRate;
  const ratePlanVersionId = input.rateVersion?.id ?? null;

  const mine = input.visits.filter(
    (v) =>
      isBillable(v) &&
      v.clientName === terms.clientName &&
      v.startsAt.slice(0, 10) >= weekStart &&
      v.startsAt.slice(0, 10) <= weekEnd,
  );

  const live = new Map<string, VerifiedServiceUnit>();
  for (const unit of input.units ?? []) {
    if (unit.state === "superseded") continue;
    live.set(unit.visitId, unit);
  }

  // A visit somebody started reviewing and has not finished. Billing it at the
  // scheduled length would send a family an invoice for hours Joy itself has
  // not agreed — and the review exists precisely because something about the
  // visit was not straightforward.
  const underReview = mine.filter((v) => live.get(v.id)?.state === "proposed");
  if (underReview.length > 0) {
    return {
      clientPersonId: terms.clientPersonId,
      clientName: terms.clientName,
      ratePlanVersionId,
      weekStart,
      weekEnd,
      lines: [],
      subtotal: null,
      depositApplied: 0,
      convenienceFee: 0,
      lateFee: 0,
      total: null,
      dueOn: addDays(weekStart, PAYMENT_DUE_DAYS),
      state: "cannot_bill",
      blockedReason:
        underReview.length === 1
          ? "One visit this week is still under review. Approve its hours before invoicing."
          : `${underReview.length} visits this week are still under review. Approve their hours before invoicing.`,
    };
  }

  const split = splitHours(mine, (visit) => {
    const unit = live.get(visit.id);
    const approved = unit ? billableHours(unit) : null;
    return approved ?? hoursOf(visit);
  });
  const lines: InvoiceLine[] = [];

  const line = (kind: LineKind, description: string, hours: number, multiplier: number) => {
    if (hours <= 0) return;
    lines.push({
      kind,
      description,
      hours,
      rate,
      multiplier,
      amount: rate === null ? null : money(hours * rate * multiplier),
    });
  };

  line("standard", "Care hours", split.standard, 1);
  for (const holiday of split.holidays) {
    line("holiday", `${HOLIDAY_LABELS[holiday.key]} — time and a half`, holiday.hours, TIME_AND_A_HALF);
  }
  line("overtime", `Hours over ${OVERTIME_AFTER_HOURS} — time and a half`, split.overtime, TIME_AND_A_HALF);

  // ------------------------------------------------------------- totals --
  if (rate === null) {
    return {
      clientPersonId: terms.clientPersonId,
      clientName: terms.clientName,
      ratePlanVersionId: null,
      weekStart,
      weekEnd,
      lines,
      subtotal: null,
      depositApplied: 0,
      convenienceFee: 0,
      lateFee: 0,
      total: null,
      dueOn: addDays(weekStart, PAYMENT_DUE_DAYS),
      state: "cannot_bill",
      blockedReason:
        "No hourly rate on file for this client. The agreed rate is emailed separately at " +
        "admission — add it before invoicing.",
    };
  }

  const subtotal = money(lines.reduce((sum, l) => sum + (l.amount ?? 0), 0));

  // The deposit is applied, not charged. The packet is explicit: "it goes
  // toward the first weeks of service — it is not an extra charge."
  const depositApplied =
    input.applyDeposit === false ? 0 : money(Math.min(terms.depositRemaining, subtotal));

  const afterDeposit = money(subtotal - depositApplied);

  // Convenience fees are charged on what is actually taken, so a week fully
  // covered by the deposit carries no card fee.
  const convenienceFee =
    afterDeposit <= 0
      ? 0
      : terms.paymentMethod === "card"
        ? money(afterDeposit * CARD_CONVENIENCE_RATE)
        : terms.paymentMethod === "ach"
          ? ACH_CONVENIENCE_FEE
          : 0;

  return {
    clientPersonId: terms.clientPersonId,
    clientName: terms.clientName,
    ratePlanVersionId,
    weekStart,
    weekEnd,
    lines,
    subtotal,
    depositApplied,
    convenienceFee,
    lateFee: 0,
    total: money(afterDeposit + convenienceFee),
    dueOn: addDays(weekStart, PAYMENT_DUE_DAYS),
    state: subtotal === 0 ? "draft" : "draft",
    blockedReason: null,
  };
}

// -------------------------------------------------------------- ageing --

export interface Ageing {
  daysOverdue: number;
  lateFeeDue: number;
  /** True once the agreement permits suspending service. */
  suspensionPermitted: boolean;
  /** What the office should be told, in a sentence. */
  message: string;
}

/**
 * How overdue an invoice is, and what the agreement allows.
 *
 * `suspensionPermitted` is named carefully. The clause says services "may be
 * suspended within 24 hours of non-payment" — may, not must, and Karynn was
 * clear that cancelling for non-payment is real and does happen. But a piece of
 * software must not make that decision: suspending care is a person deciding
 * that somebody's mother does not get her caregiver tomorrow, and it deserves a
 * human, a phone call, and probably a conversation about why the payment
 * failed. So this reports that the option exists and never acts on it.
 */
export function ageing(input: {
  dueOn: string;
  paid: boolean;
  asOf: string;
  /** Nothing to pay. A deposit-covered week is settled, not late. */
  total?: number | null;
}): Ageing {
  if (input.paid) {
    return { daysOverdue: 0, lateFeeDue: 0, suspensionPermitted: false, message: "Paid." };
  }

  // An invoice for nothing cannot be overdue, and must never report that the
  // agreement permits suspending somebody's care. That was showing against a
  // week the deposit had already covered.
  if (input.total !== undefined && input.total !== null && input.total <= 0) {
    return {
      daysOverdue: 0,
      lateFeeDue: 0,
      suspensionPermitted: false,
      message: "Covered by the deposit — nothing to pay.",
    };
  }

  const due = Date.parse(`${input.dueOn}T00:00:00Z`);
  const now = Date.parse(`${input.asOf.slice(0, 10)}T00:00:00Z`);
  const days = Math.floor((now - due) / 86_400_000);

  if (days <= 0) {
    return {
      daysOverdue: 0,
      lateFeeDue: 0,
      suspensionPermitted: false,
      message: days === 0 ? "Due today." : `Due ${input.dueOn}.`,
    };
  }

  const lateFeeDue = days > LATE_FEE_AFTER_DAYS ? LATE_FEE : 0;
  const suspensionPermitted = days * 24 >= SUSPENSION_AFTER_HOURS;

  const parts = [`${days} ${days === 1 ? "day" : "days"} overdue.`];
  if (lateFeeDue) parts.push(`$${LATE_FEE} late fee applies.`);
  if (suspensionPermitted) {
    // Said as a fact about the agreement, not as a recommendation.
    parts.push("The agreement permits suspending service — that is a call for a person to make.");
  }

  return { daysOverdue: days, lateFeeDue, suspensionPermitted, message: parts.join(" ") };
}

// --------------------------------------------------------- reconciling --

export interface Reconciliation {
  invoicedHours: number;
  workedHours: number;
  differenceHours: number;
  /** Positive means the client was billed for more than happened. */
  owedToClient: boolean;
  message: string;
}

/**
 * Compare an invoice billed in advance against what actually happened.
 *
 * This is the half that makes advance billing honest. A family paid on Monday
 * for a week that then had a visit cancelled is owed that money back, and
 * nobody will chase it on their behalf unless Joy notices.
 */
export function reconcile(input: {
  invoice: Invoice;
  actualHours: number;
}): Reconciliation {
  const invoicedHours = money(input.invoice.lines.reduce((sum, l) => sum + l.hours, 0));
  const workedHours = money(input.actualHours);
  const difference = money(invoicedHours - workedHours);

  if (difference === 0) {
    return {
      invoicedHours,
      workedHours,
      differenceHours: 0,
      owedToClient: false,
      message: "The week matched the invoice.",
    };
  }

  return {
    invoicedHours,
    workedHours,
    differenceHours: Math.abs(difference),
    owedToClient: difference > 0,
    message:
      difference > 0
        ? `Billed ${Math.abs(difference)} hours more than were worked. Credit the difference.`
        : `${Math.abs(difference)} hours were worked beyond the invoice. Bill the difference.`,
  };
}
