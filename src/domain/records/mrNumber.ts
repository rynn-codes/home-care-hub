/**
 * The medical record number, built the way Karynn's office builds it.
 *
 * Two initials, the last four of the social security number, and a trailing
 * zero: Jane Smith with …6789 is JS67890. The number is stored; the digits it
 * was made from are not. This module is the only place in the application
 * that touches a social security number — it takes the string, returns the
 * MR number, and the caller keeps only the result. Never derive it on read,
 * because there is nothing to derive it from.
 *
 * A collision is reported and refused, never resolved with a suffix: the
 * format is Karynn's, and a number nobody else's rule would produce is worse
 * than a clash somebody knows about.
 */

/** The last four digits, from a full number or the last four alone; null otherwise. */
export function lastFour(ssn: string | null | undefined): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D+/g, "");
  if (digits.length !== 9 && digits.length !== 4) return null;
  return digits.slice(-4);
}

export function mrNumber(input: { firstName: string; lastName: string; ssn: string }): string | null {
  const first = input.firstName.trim().charAt(0).toUpperCase();
  const last = input.lastName.trim().charAt(0).toUpperCase();
  const four = lastFour(input.ssn);
  if (!/[A-Z]/.test(first) || !/[A-Z]/.test(last) || !four) return null;
  return `${first}${last}${four}0`;
}

export function mrNumberTaken(candidate: string, existing: ReadonlyArray<string | null | undefined>): boolean {
  return existing.some((n) => n && n.toUpperCase() === candidate.toUpperCase());
}

/** Why no number can be issued from this input, or null when one can. */
export function whyNoMrNumber(input: { firstName: string; lastName: string; ssn: string }): string | null {
  if (mrNumber(input)) return null;
  if (!input.firstName.trim() || !input.lastName.trim()) return "An MR number needs both a first and a last name.";
  return "An MR number needs the last four digits of their social security number.";
}
