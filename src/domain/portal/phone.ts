/**
 * Phone numbers as the portal's primary identifier.
 *
 * §3 makes the phone the login: "Avoid requiring the candidate to remember a
 * conventional username/password if phone OTP can safely handle the
 * experience." That promotes a field which, until now, was free text in
 * `people.phone` — Karynn's office has typed it as `713-231-9662`,
 * `(713) 231-9662` and `7132319662` on different days.
 *
 * A login key cannot be free text. Everything here exists to turn what a human
 * types into one canonical string, so the same person reaches the same account
 * whichever way they type their own number.
 *
 * Scope is deliberately North America. Joy operates in Houston; a general
 * libphonenumber dependency would carry a large table to solve a problem Joy
 * does not have. If Joy ever serves a caregiver with a non-NANP number this
 * file is the one place that has to change.
 */

/** The canonical form: E.164, e.g. `+17132319662`. */
export type E164 = string;

export type PhoneProblem =
  | "empty"
  | "too_short"
  | "too_long"
  | "not_north_american"
  | "invalid_area_code";

export const PHONE_PROBLEM_MESSAGES: Record<PhoneProblem, string> = {
  empty: "Enter your phone number.",
  too_short: "That number is too short. Enter all 10 digits.",
  too_long: "That number is too long. Enter your 10-digit number.",
  not_north_american: "Joy can only text US and Canadian numbers right now.",
  invalid_area_code: "That does not look like a real area code.",
};

export type PhoneResult =
  | { ok: true; e164: E164 }
  | { ok: false; problem: PhoneProblem };

/**
 * Normalize whatever the person typed into E.164, or say why it cannot be.
 *
 * Accepts the shapes a real person produces: spaces, dashes, brackets, dots, a
 * leading `1`, a leading `+1`, and the `tel:` prefix a phone keyboard sometimes
 * pastes.
 */
export function normalizePhone(input: string | null | undefined): PhoneResult {
  const digits = (input ?? "").replace(/^tel:/i, "").replace(/\D+/g, "");

  if (digits.length === 0) return { ok: false, problem: "empty" };

  // A leading 1 is the NANP country code, not part of the number.
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (national.length < 10) return { ok: false, problem: "too_short" };
  if (national.length > 10) {
    // 11+ digits that do not start with 1 is some other country's number.
    return { ok: false, problem: digits.length > 11 ? "not_north_american" : "too_long" };
  }

  // NANP: area code and exchange both start 2–9, and the area code's middle
  // digit rules out nothing useful, so only the first digit is checked. N11
  // codes (211, 911 …) are service codes, never subscriber numbers.
  const area = national.slice(0, 3);
  const exchange = national.slice(3, 6);
  if (area[0] === "0" || area[0] === "1") return { ok: false, problem: "invalid_area_code" };
  if (area[1] === "1" && area[2] === "1") return { ok: false, problem: "invalid_area_code" };
  if (exchange[0] === "0" || exchange[0] === "1") return { ok: false, problem: "invalid_area_code" };

  return { ok: true, e164: `+1${national}` };
}

/** `+17132319662` → `(713) 231-9662`, for reading back on screen. */
export function formatPhone(e164: E164): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

/**
 * `(•••) •••-9662` — enough for someone to recognize their own number without
 * printing it in full on a screen a stranger may be looking at.
 */
export function maskPhone(e164: E164): string {
  const m = /^\+1\d{6}(\d{4})$/.exec(e164);
  return m ? `(•••) •••-${m[1]}` : "•••";
}

/**
 * Do two numbers, however they were typed, refer to the same line?
 *
 * Used when matching an inbound login against `people.phone`, which predates
 * this file and holds whatever the office typed.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.ok && nb.ok && na.e164 === nb.e164;
}
