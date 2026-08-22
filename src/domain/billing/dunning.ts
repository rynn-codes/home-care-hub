/**
 * What happens when a family has not paid — the rhythm, as data.
 *
 * Karynn, 22 August, asked what happens when a saved card fails: "Option 1
 * [retry once the next day, then it becomes a phone call]. On Wednesday, the
 * family should receive an email and on Thursday, a text to pay their bill."
 *
 * Read against the billing calendar (BILLING_CALENDAR, run.ts): the invoice
 * goes out Saturday–Monday and is due within one calendar day, so by Wednesday
 * an unpaid invoice is genuinely late and the packet's $100 late fee is
 * approaching (after the third day). The rhythm:
 *
 *   charge fails   → one automatic retry roughly 24 hours later, same method.
 *                    Never a different saved method — §7.4: "do not
 *                    automatically try secondary saved methods without explicit
 *                    authorization and a documented policy."
 *   Wednesday      → an email asking them to pay
 *   Thursday       → a text (the §9.4-shaped nudge: says a bill exists, not
 *                    how much)
 *   after that     → a phone call from the office. §7.4 rung 7: the failure
 *                    surfaces to Billing, and never to a caregiver.
 *
 * This module is the SCHEDULE, not the machinery. The retry itself is a Stripe
 * server-layer job (§8.1) the developer wires; the email channel is not
 * modelled in Joy yet (texts go through messaging.ts); what Joy holds today is
 * the policy, in one place, so every later piece reads the same rhythm.
 */

export const DUNNING = {
  /** One retry, same saved method, about a day after the failure. */
  retryAfterHours: 24,
  maxAutomaticRetries: 1,
  /** 3 = Wednesday. The email asking them to pay. */
  reminderEmailWeekday: 3,
  /** 4 = Thursday. The text — see `payment_reminder` in messaging.ts. */
  reminderTextWeekday: 4,
  /** After the retry and both reminders, it is a phone call, not a process. */
  thenItIsAPhoneCall: true,
} as const;

/**
 * The gate, and the backstop. Karynn, 22 August, asked about writing off bad
 * debt: "We technically don't lose bc we charge a one week deposit. If they
 * don't pay by Sunday, the day before the shift, then services stop."
 *
 * Two rules in one sentence:
 *
 *   THE GATE. The invoice goes out Saturday; payment is due by SUNDAY, before
 *   the care week's shifts begin. Unpaid by Sunday night, services stop — not
 *   as an automated cancellation (§18.12: payment failure must never be an
 *   accidental automated consequence, and Joy holds to that), but as a
 *   decision the system puts in front of the office loudly enough that making
 *   it is one click and missing it is hard.
 *
 *   THE BACKSTOP. The one-week deposit (the packet's own term: "applied to
 *   the first weeks of service") means an unpaid week is covered — Joy stops
 *   the service before it is ever two weeks exposed. This is why a true
 *   write-off is rare by design: the ladder is stop, then apply the deposit,
 *   not chase, then absorb.
 */
export const PAYMENT_GATE = {
  /** 0 = Sunday. Due the day before the care week's shifts. */
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

export type DunningStep =
  | "automatic_retry"
  | "reminder_email"
  | "reminder_text"
  | "office_call";

export const DUNNING_STEP_LABELS: Record<DunningStep, string> = {
  automatic_retry: "Automatic retry, same card, next day",
  reminder_email: "Wednesday — email asking them to pay",
  reminder_text: "Thursday — text asking them to pay",
  office_call: "A phone call from the office",
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
