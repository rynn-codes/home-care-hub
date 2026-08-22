/**
 * YOUR CARE COST — addendum §2's pricing review.
 *
 * "Before requesting a payment method, show the applicable approved
 * service/pricing terms. Do not make the family's first billing interaction
 * simply 'enter your card.'"
 *
 * The block a family sees is computed from the client's APPROVED data — the
 * agreement's weekly hours and the rate version in effect — never typed into
 * a screen, because a preview somebody could edit is a quote, and Joy does
 * not quote; it shows the agreement.
 */

export interface CareCostPreview {
  /** From the service agreement — the same figure the advance invoice bills. */
  scheduledHoursPerWeek: number;
  hourlyRate: number;
  estimatedWeekly: number;
  /** The catch-all the addendum's own example carries. */
  otherChargesNote: string;
}

/**
 * Null when either input is missing — a preview with a guessed rate would be
 * the exact "unexplained amount" §21 forbids, one screen early.
 */
export function careCostPreview(input: {
  agreedWeeklyHours: number | null | undefined;
  hourlyRate: number | null | undefined;
}): CareCostPreview | null {
  if (input.agreedWeeklyHours == null || input.hourlyRate == null) return null;
  return {
    scheduledHoursPerWeek: input.agreedWeeklyHours,
    hourlyRate: input.hourlyRate,
    estimatedWeekly: Math.round(input.agreedWeeklyHours * input.hourlyRate * 100) / 100,
    otherChargesNote: "Per your Service Agreement",
  };
}

export type PricingReviewGate =
  | { ok: true }
  | { ok: false; reason: "no_pricing_to_show" | "not_reviewed"; message: string };

/**
 * May Joy ask this family for a payment method yet?
 *
 * Two ways to be blocked, and they are different tasks: no approved pricing
 * exists to show (fix the rate/agreement first), or it exists and nobody has
 * put it in front of the family (show it, record when).
 */
export function paymentMethodRequestGate(input: {
  preview: CareCostPreview | null;
  pricingReviewedAt: string | null;
}): PricingReviewGate {
  if (!input.preview) {
    return {
      ok: false,
      reason: "no_pricing_to_show",
      message:
        "No approved rate and agreed hours are on file, so there is no care cost to show. The pricing review comes before the card — record the agreement first.",
    };
  }
  if (!input.pricingReviewedAt) {
    return {
      ok: false,
      reason: "not_reviewed",
      message:
        "The family has not seen their care cost yet. Show it before asking for a payment method — the first billing interaction is never 'enter your card'.",
    };
  }
  return { ok: true };
}
