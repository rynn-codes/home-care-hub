import { accountGaps, type BillingAccount, type BillingAccountClient } from "@/domain/billing/accounts";
import type { PaymentMode } from "@/domain/billing/paymentAuthorization";

/**
 * Payment setup, as §9.2 presents it — five states, replacing a boolean.
 *
 * The boolean was the prototype's first cut and it flattened exactly the
 * distinctions the spec calls out. "Not started" and "the card on file just
 * expired" both rendered as `false`, and they are opposite situations: one is
 * a family who has not begun, the other is a family who finished and needs to
 * be told something broke. The five states and their meanings are the spec's,
 * verbatim.
 */
export type PaymentSetupState =
  | "not_started"
  | "method_needed"
  | "ready"
  | "complete"
  | "needs_attention";

/** The spec's own presentation strings (§9.2). */
export const PAYMENT_SETUP_LABELS: Record<PaymentSetupState, string> = {
  not_started: "Not started",
  method_needed: "Payment method needed",
  ready: "Ready",
  complete: "Complete",
  needs_attention: "Needs attention",
};

/** What each state means, in the spec's words — for the office, not a family. */
export const PAYMENT_SETUP_MEANINGS: Record<PaymentSetupState, string> = {
  not_started: "No payer or payment workflow has been initiated.",
  method_needed:
    "Authorization exists or is in progress, but no usable method or collection arrangement exists.",
  ready: "An authorized collection method is present and valid for start-of-care rules.",
  complete:
    "Required setup and authorization steps are done. This does not mean every future invoice is paid.",
  needs_attention:
    "Expired or removed method, failed verification, action required, or an office exception.",
};

/** The states that satisfy the admission gate. */
export function paymentSetupSatisfies(state: PaymentSetupState): boolean {
  return state === "ready" || state === "complete";
}

/**
 * Derive the state from a billing account, when one exists.
 *
 * §4.2: readiness is COMPUTED from gates, not selected by hand. During the
 * demo the office picks the state on the admission screen because no account
 * exists yet for a prospective client; the moment the developer wires
 * accounts in, this function is the answer and the picker comes out.
 */
export function paymentSetupFrom(input: {
  account: BillingAccount | null;
  clients: readonly BillingAccountClient[];
  hasRate: boolean;
}): PaymentSetupState {
  const { account } = input;
  if (!account) return "not_started";

  const gaps = accountGaps({ account, clients: input.clients, hasRate: input.hasRate });

  // Authority that used to exist and was withdrawn, or a hold, is a thing that
  // BROKE — a family who finished setup and needs to be told, not a family who
  // has not begun.
  if (account.onHold || gaps.includes("authorization_withdrawn")) return "needs_attention";
  if (gaps.includes("no_payment_method")) return "method_needed";
  if (gaps.length > 0) return "not_started";

  return account.status === "ready" ? "ready" : "complete";
}

// ---------------------------------------------- computed from setup facts --

/**
 * The §16 panel's facts — what the office actually records during payment
 * setup, before any billing account exists for a prospective client.
 */
export interface PaymentSetupFacts {
  /** The family saw YOUR CARE COST (§2 of the addendum). */
  pricingReviewedAt: string | null;
  /** Pay Invoice or AutoPay — the addendum's two modes. */
  preference: PaymentMode | null;
  /** A usable method is saved (via Stripe, when wired). AutoPay needs one;
   * Pay Invoice does not — the payer chooses a method each time. */
  methodOnFile: boolean;
  /** Joy's Electronic Payment Authorization, captured — the form is versioned
   * (joy-epay-v1) and the capture is audited. */
  authorizationCapturedAt: string | null;
}

/**
 * §4.2's instruction, finally honoured end to end: readiness is COMPUTED from
 * gates, never selected. This replaces the hand picker the admission screen
 * carried while no facts existed to compute from.
 *
 * The order of the checks is the order of the flow: pricing before anything
 * (the family's first billing interaction is never "enter your card"), then
 * the preference, then what the preference requires.
 */
export function paymentSetupFromFacts(facts: PaymentSetupFacts): {
  state: PaymentSetupState;
  /** What stands between here and ready, in the order it should happen. */
  nextSteps: string[];
} {
  const steps: string[] = [];
  if (!facts.pricingReviewedAt) steps.push("Show the family their care cost");
  if (!facts.preference) steps.push("Record the payment preference");
  if (!facts.authorizationCapturedAt) steps.push("Capture the payment authorization");
  if (facts.preference === "autopay" && !facts.methodOnFile) {
    steps.push("Save a payment method — AutoPay has nothing to charge without one");
  }

  if (!facts.pricingReviewedAt && !facts.preference && !facts.authorizationCapturedAt) {
    return { state: "not_started", nextSteps: steps };
  }
  if (steps.length === 0) return { state: "ready", nextSteps: [] };

  // Authorization exists or is in progress but no usable arrangement yet —
  // the spec's own definition of method_needed.
  if (facts.authorizationCapturedAt && facts.preference === "autopay" && !facts.methodOnFile) {
    return { state: "method_needed", nextSteps: steps };
  }
  return { state: "not_started", nextSteps: steps };
}
