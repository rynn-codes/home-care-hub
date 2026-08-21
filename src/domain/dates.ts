/**
 * Date arithmetic for compliance clocks.
 *
 * Extracted from `clients/roster.ts`, where it was a private helper, when a
 * second and third clock needed the same arithmetic — the care plan's annual
 * review and the supervisory visit. Three copies of "a year from now" is three
 * chances to disagree by a day, and they would have: an earlier version of the
 * care plan clock added 365 days, which lands a day early whenever the year it
 * crosses contains a leap day. Two screens in Joy would then have shown
 * different due dates for what the service agreement calls one annual
 * obligation.
 *
 * Everything here works in UTC on `YYYY-MM-DD` and never touches local time,
 * because a compliance date is a date, not a moment. A clock that shifts
 * because somebody opened the app in a different timezone is worse than no
 * clock.
 */

export function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * Add whole months, clamping rather than rolling over.
 *
 * A 31 January signature renews on 28 February, not on 3 March. Rolling forward
 * would quietly grant extra days of validity.
 *
 * Returns null for an unparseable date rather than throwing: a client record
 * must still render when one field is malformed.
 */
export function addMonths(iso: string, months: number): string | null {
  const d = new Date(`${toDateOnly(iso)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Whole days from one date to another. Negative when `to` is in the past. */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms =
    new Date(`${toDateOnly(toIso)}T00:00:00Z`).getTime() -
    new Date(`${toDateOnly(fromIso)}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}
