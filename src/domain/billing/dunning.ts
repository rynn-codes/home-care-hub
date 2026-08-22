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
