/**
 * What week is it?
 *
 * Karynn, 25 August: "Correct the Week 2 of 2… Ensure AI is aware and tracking
 * what week we are on on all pages." The label was transcribed from a mockup
 * and never moved, and the payroll period underneath it was "a fortnight
 * ending today" — a window that slid with the clock, so no week could have a
 * stable number. This module is the one place the answer is computed, and
 * every screen that names a week reads it.
 *
 * Two rules, both from CLAUDE.md:
 *   - the agency week runs SATURDAY → FRIDAY, everywhere, always;
 *   - payroll runs fortnightly, so each period holds two of those weeks.
 *
 * The period's parity has to be anchored to something real, because "week 1 or
 * week 2" is not derivable from a date alone. PERIOD_EPOCH is that anchor: a
 * Saturday that began a payroll period. Shift it by seven days and every week
 * number in the product flips — it is the single knob, deliberately.
 */

/** A Saturday that began a payroll period. Karynn, 25 Aug: the week of
 *  Aug 22–28 2026 is week ONE, so the epoch shares its parity. */
export const PERIOD_EPOCH = "2026-01-10";

const DAY = 86_400_000;
const noon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** The Saturday on or before this date. */
export function agencyWeekStart(iso: string): string {
  const d = noon(iso);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d.toISOString().slice(0, 10);
}

/** The Friday that closes this date's week. */
export function agencyWeekEnd(iso: string): string {
  const d = noon(agencyWeekStart(iso));
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Whole weeks between the epoch and this date's week. Negative before it. */
function weeksSinceEpoch(iso: string): number {
  const start = noon(agencyWeekStart(iso)).getTime();
  const epoch = noon(PERIOD_EPOCH).getTime();
  return Math.round((start - epoch) / (7 * DAY));
}

/** 1 or 2 — which half of the fortnightly payroll period this week is. */
export function payrollWeekOfPeriod(iso: string): 1 | 2 {
  // Modulo that stays positive for dates before the epoch.
  return ((weeksSinceEpoch(iso) % 2) + 2) % 2 === 0 ? 1 : 2;
}

/** The fortnight this date sits in: two agency weeks, Saturday to Friday. */
export function payrollPeriod(iso: string): { start: string; end: string } {
  const start = noon(agencyWeekStart(iso));
  if (payrollWeekOfPeriod(iso) === 2) start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** "Aug 22–28" — the month named once when the week does not cross into the next. */
export function agencyWeekLabel(iso: string): string {
  const s = noon(agencyWeekStart(iso));
  const e = noon(agencyWeekEnd(iso));
  const m: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return s.getMonth() === e.getMonth()
    ? `${s.toLocaleDateString([], m)}–${e.getDate()}`
    : `${s.toLocaleDateString([], m)}–${e.toLocaleDateString([], m)}`;
}

/**
 * The line screens print under a title: "Week of Aug 22–28".
 *
 * Karynn, 25 August: "I think we can completely take off the 1 of 2 on ALL
 * pages. I have no clue what that means." — and then: "Instead of saying
 * billing week, can we say Week of?" Both are the same instinct and both are
 * right. Which half of a payroll fortnight you are in is a fact the software
 * needs and a person does not; "Billing Week" was internal vocabulary wearing
 * a badge. "Week of" is what anybody would say out loud.
 *
 * `payrollWeekOfPeriod` is still here and still used — `payrollPeriod` cannot
 * work out which fortnight you are in without it. It is simply no longer
 * something the screens say.
 */
export function weekBadge(iso: string): string {
  return `Week of ${agencyWeekLabel(iso)}`;
}
