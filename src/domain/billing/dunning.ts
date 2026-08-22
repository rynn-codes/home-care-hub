/**
 * What happens when a family has not paid — the rhythm, as data.
 *
 * Karynn built this up across five messages on 22 August; the synthesis uses
 * all of them, with the latest word winning where they touch. Her worked
 * example first, because it anchors every date:
 *
 *   "Client is billed on Aug 10th for services that will start on Aug
 *   15–21st. If they do not pay by Sunday, services are stopped."
 *
 * Then the contact rhythm, as she refined it:
 *
 *   "Wednesday, the client should be an email reminder. Thursday AM is a text
 *   and email." … "Friday will also get a call and text if not paid." …
 *   "Friday will also get an email. An email should be sent out every day
 *   until paid."
 *
 * Laid on the calendar (Aug 15 2026 is a Saturday — the care week is the
 * Sat–Fri billing week):
 *
 *   Mon  Aug 10  invoice out, five days before the week begins
 *   Wed  Aug 12  emails begin — one EVERY DAY until paid
 *   Thu  Aug 13  morning: a text joins the daily email
 *   Fri  Aug 14  still unpaid: a call and a text, plus the daily email
 *   Sat  Aug 15  care week begins
 *   Sun  Aug 16  the gate: unpaid by tonight, services stop
 *
 * A failed CARD (automatic accounts only) still retries once, next day, same
 * method — §7.4 forbids quietly trying a different saved card.
 *
 * This module is the SCHEDULE, not the machinery. The retry is a Stripe
 * server-layer job (§8.1); the email channel is not modelled in Joy yet
 * (texts go through messaging.ts); what Joy holds is the policy, in one
 * place, so every later piece reads the same rhythm.
 */

export const DUNNING = {
  /** One retry, same saved method, about a day after the failure. */
  retryAfterHours: 24,
  maxAutomaticRetries: 1,
  /** 3 = Wednesday: the first reminder email. From then on, one every day. */
  emailsBeginWeekday: 3,
  emailEveryDayUntilPaid: true,
  /** 4 = Thursday, in the morning: a text joins the daily email. */
  firstTextWeekday: 4,
  /** 5 = Friday, still unpaid: a call and a text, plus the daily email. */
  callWeekday: 5,
} as const;

/**
 * Karynn's example, generalised: every date in one collection cycle, from the
 * Saturday the care week begins.
 */
export function dunningDatesFor(careWeekStart: string): {
  invoiceOutBy: string;
  emailsBeginOn: string;
  firstTextOn: string;
  callAndTextIfUnpaidOn: string;
  servicesStopIfUnpaidBy: string;
} {
  const day = (offset: number) => {
    const d = new Date(`${careWeekStart.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return {
    // The Monday before: drafted the Saturday prior, approved Sat–Mon.
    invoiceOutBy: day(-5),
    emailsBeginOn: day(-3),
    firstTextOn: day(-2),
    callAndTextIfUnpaidOn: day(-1),
    // "If they do not pay by Sunday, services are stopped" — the Sunday
    // inside the care week, before Monday's shifts.
    servicesStopIfUnpaidBy: day(1),
  };
}

/**
 * What the office owes an unpaid invoice today. `daysSinceEmailsBegan` and the
 * flags say what has happened; the return says what this day's touch is. The
 * daily email never stops until the money arrives — that is her rule, and it
 * is the machinery's job to be relentless so nobody at the office has to be.
 */
export function todaysTouch(input: {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  paid: boolean;
  emailsHaveBegun: boolean;
}): { email: boolean; text: boolean; call: boolean } {
  if (input.paid) return { email: false, text: false, call: false };
  const emailing = input.emailsHaveBegun || input.weekday === DUNNING.emailsBeginWeekday;
  return {
    email: emailing,
    text: input.weekday === DUNNING.firstTextWeekday || input.weekday === DUNNING.callWeekday,
    call: input.weekday === DUNNING.callWeekday,
  };
}

export type DunningStep =
  | "automatic_retry"
  | "reminder_email"
  | "reminder_text"
  | "office_call";

export const DUNNING_STEP_LABELS: Record<DunningStep, string> = {
  automatic_retry: "Automatic retry, same card, next day",
  reminder_email: "Wednesday — emails begin, one every day until paid",
  reminder_text: "Thursday morning — a text joins the daily email",
  office_call: "Friday — still unpaid: a call and a text",
};

/**
 * The steps still ahead for an unpaid invoice, given what has already
 * happened. A queue for the Billing screen, not an automaton — each step is
 * performed by the wired machinery (or by Karynn), and this only says what
 * comes next.
 */
export function dunningStepsRemaining(input: {
  chargeFailed: boolean;
  retriesUsed: number;
  emailSent: boolean;
  textSent: boolean;
}): DunningStep[] {
  const steps: DunningStep[] = [];
  if (input.chargeFailed && input.retriesUsed < DUNNING.maxAutomaticRetries) {
    steps.push("automatic_retry");
  }
  if (!input.emailSent) steps.push("reminder_email");
  if (!input.textSent) steps.push("reminder_text");
  steps.push("office_call");
  return steps;
}

/**
 * The gate, and the backstop. Karynn, 22 August, asked about writing off bad
 * debt: "We technically don't lose bc we charge a one week deposit. If they
 * don't pay by Sunday, the day before the shift, then services stop."
 *
 * Two rules in one sentence:
 *
 *   THE GATE. Unpaid by Sunday night, services stop — not as an automated
 *   cancellation (§18.12: payment failure must never be an accidental
 *   automated consequence, and Joy holds to that), but as a decision the
 *   system puts in front of the office loudly enough that making it is one
 *   click and missing it is hard.
 *
 *   THE BACKSTOP. The one-week deposit (the packet's own term: "applied to
 *   the first weeks of service") means an unpaid week is covered — Joy stops
 *   the service before it is ever two weeks exposed. This is why a true
 *   write-off is rare by design: the ladder is stop, then apply the deposit,
 *   not chase, then absorb.
 */
export const PAYMENT_GATE = {
  /** 0 = Sunday. Due the day before Monday's shifts. */
  dueByWeekday: 0,
  /** What unpaid-by-Sunday means. A recommendation to a person, never an act. */
  consequence: "services stop, and the deposit covers what was delivered",
} as const;

/**
 * The Sunday question, for the work queue: this family has not paid and the
 * shifts start tomorrow. Returns what the office should be told — it never
 * cancels anything itself.
 */
export function unpaidAtTheGate(input: {
  clientName: string;
  balance: number;
  depositRemaining: number;
}): { headline: string; detail: string; depositCovers: boolean } {
  const depositCovers = input.depositRemaining >= input.balance;
  return {
    headline: `${input.clientName} has not paid for the week starting tomorrow.`,
    detail: depositCovers
      ? `$${input.balance.toFixed(2)} outstanding; the deposit ($${input.depositRemaining.toFixed(2)}) covers it. Stopping services is your call — the packet permits it, and Joy will not make it for you.`
      : `$${input.balance.toFixed(2)} outstanding and the deposit ($${input.depositRemaining.toFixed(2)}) does not cover it. Stopping services limits the exposure; the decision is yours.`,
    depositCovers,
  };
}
