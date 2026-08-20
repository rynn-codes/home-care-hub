/**
 * The screen that keeps clinical content out of family-facing text.
 *
 * Shared by Moments (§13–15) and personal preferences (§17), because both are
 * warm, family-facing, and both have the same failure mode: the care record
 * leaking into the place that was meant to be the nice bit.
 *
 * Extracted rather than copied. Two lists drift, and the day they drift is the
 * day one of them stops catching "fall".
 *
 * DELIBERATELY BLUNT
 *
 * It matches substrings and will occasionally stop something harmless — "a fall
 * of leaves in the garden" trips on `fall`. That is the correct direction to
 * fail in. Rephrasing costs a caregiver four seconds; the failure it prevents
 * is a daughter learning her mother fell from a page headed "a little moment
 * from today".
 *
 * It is not a substitute for the approval step, and neither is the approval
 * step a substitute for it. §14 requires a human to approve; this stops the
 * obvious thing reaching that human already half-published.
 */

/** Words that mean this belongs in the chart or the care plan. */
export const CLINICAL_TERMS = [
  "medication",
  "med ",
  "dose",
  "diagnos",
  "incident",
  "fall",
  "fell",
  "wound",
  "catheter",
  "incontinen",
  "bowel",
  "toilet",
  "blood pressure",
  "vitals",
  "bathing assistance",
  "transfer assist",
  "hospice",
  "dementia",
  "refused care",
  "declined care",
  // Preference-shaped phrasings that are really care plan items. "Gets
  // agitated in the evening" is clinically useful and belongs where the RN
  // maintains it, not in a list a family reads as "things Dad likes".
  "agitat",
  "aggressive",
  "wander",
  "choking",
  "pureed",
  "thickened",
  "aspirat",
  "swallow",
  "seizure",
  "confus",
] as const;

/** Phrasing that is a note to the office, not to a family. */
export const STAFF_TERMS = [
  "supervisor",
  "call the office",
  "let the office know",
  "needs review",
  "care plan update",
  "family is difficult",
  "per my notes",
] as const;

export function clinicalTermIn(text: string): string | null {
  const lower = text.toLowerCase();
  return CLINICAL_TERMS.find((term) => lower.includes(term)) ?? null;
}

export function staffTermIn(text: string): string | null {
  const lower = text.toLowerCase();
  return STAFF_TERMS.find((term) => lower.includes(term)) ?? null;
}
