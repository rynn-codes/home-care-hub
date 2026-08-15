/**
 * Duplicate detection for new referrals.
 *
 * Section 10 of the Admissions Master Build Spec: before creating a referral,
 * check name, phone, email, date of birth where available, and the responsible
 * party. If something matches, show it and offer "Open Existing Record" or
 * "Continue as New".
 *
 * The governing rule is the last line of that section: **do not silently merge
 * records.** This module only ever reports what it found. Nothing here decides,
 * because a false match that merges two clients is far more damaging than a
 * false match a human dismisses in one click.
 */

export interface DuplicateCandidate {
  personId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  /** Name of the primary contact or responsible party, when one is on file. */
  responsiblePartyName?: string | null;
  /** Present when this person already has an open admission. */
  openAdmissionStage?: string | null;
}

export interface DuplicateQuery {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  responsiblePartyName?: string | null;
}

export type MatchStrength = "strong" | "possible";

export interface DuplicateMatch {
  candidate: DuplicateCandidate;
  strength: MatchStrength;
  /** Plain-language reasons, shown to the user so they can judge the match. */
  reasons: string[];
  score: number;
}

/** Digits only, so (713) 555-0134 and 7135550134 compare equal. */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  // Drop a leading US country code so +1 713… matches 713….
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\s+/g, " ");
}

function namesMatch(query: DuplicateQuery, candidate: DuplicateCandidate): boolean {
  const queryLast = normalizeName(query.lastName);
  const candidateLast = normalizeName(candidate.lastName);
  if (!queryLast || queryLast !== candidateLast) return false;

  // Compare against both legal and preferred first names, in both directions.
  // "Marcus Bell" and "Marc Bell" are the same man to a family member calling in.
  const queryFirsts = [query.firstName, query.preferredName].map(normalizeName).filter(Boolean);
  const candidateFirsts = [candidate.firstName, candidate.preferredName]
    .map(normalizeName)
    .filter(Boolean);

  return queryFirsts.some((q) =>
    candidateFirsts.some((c) => q === c || (q.length >= 3 && (c.startsWith(q) || q.startsWith(c)))),
  );
}

/**
 * Scores one candidate against the referral being entered.
 *
 * A phone or email match alone is strong: families share a phone number, and
 * that is exactly the case worth interrupting for — a second enquiry about the
 * same household. Name alone is only possible, since surnames repeat.
 */
export function scoreCandidate(
  query: DuplicateQuery,
  candidate: DuplicateCandidate,
): DuplicateMatch | null {
  const reasons: string[] = [];
  let score = 0;

  const sameName = namesMatch(query, candidate);
  if (sameName) {
    score += 3;
    reasons.push("Same name");
  }

  // Identifiers that point at an individual. Counted, not just summed, because
  // the decision below turns on HOW MANY agree rather than on a total.
  let identifierMatches = 0;

  const queryPhone = normalizePhone(query.phone);
  if (queryPhone && queryPhone === normalizePhone(candidate.phone)) {
    score += 4;
    identifierMatches += 1;
    reasons.push("Same phone number");
  }

  const queryEmail = normalizeEmail(query.email);
  if (queryEmail && queryEmail === normalizeEmail(candidate.email)) {
    score += 4;
    identifierMatches += 1;
    reasons.push("Same email");
  }

  if (query.dateOfBirth && candidate.dateOfBirth && query.dateOfBirth === candidate.dateOfBirth) {
    score += 4;
    identifierMatches += 1;
    reasons.push("Same date of birth");
  }

  // Weak on its own — a responsible party looks after more than one person, and
  // an agency may serve both parents in a household.
  const queryContact = normalizeName(query.responsiblePartyName);
  if (queryContact && queryContact === normalizeName(candidate.responsiblePartyName)) {
    score += 2;
    reasons.push("Same primary contact");
  }

  if (score === 0) return null;

  // Households share a phone number, an email and often a responsible party.
  // With no name agreement, a single shared identifier describes a HOUSEHOLD,
  // not a person — Marcus Bell and Dolores Vance on one line is two clients,
  // and collapsing them would be the worst outcome this check can produce.
  // Two independent identifiers is different: that is plausibly the same person
  // under a changed surname, so it is surfaced quietly for a human to judge.
  if (!sameName && identifierMatches < 2) return null;

  // Interrupt only when the name agrees AND something identifying agrees.
  const strong = sameName && identifierMatches >= 1;

  return {
    candidate,
    strength: strong ? "strong" : "possible",
    reasons,
    score,
  };
}

export interface DuplicateCheckResult {
  matches: DuplicateMatch[];
  /** True when the user should be interrupted before the referral is created. */
  shouldWarn: boolean;
  /** The single best match, for the "Possible existing record found" panel. */
  best: DuplicateMatch | null;
}

export function findDuplicates(
  query: DuplicateQuery,
  candidates: readonly DuplicateCandidate[],
): DuplicateCheckResult {
  const matches = candidates
    .map((candidate) => scoreCandidate(query, candidate))
    .filter((m): m is DuplicateMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  const best = matches[0] ?? null;

  // Always warn when the person already has an open admission, even on a weaker
  // match — a duplicate open referral is the specific failure this prevents, and
  // the database's one-open-admission-per-person index will reject it anyway.
  const shouldWarn =
    best !== null && (best.strength === "strong" || Boolean(best.candidate.openAdmissionStage));

  return { matches, shouldWarn, best };
}
