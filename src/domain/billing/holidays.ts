/**
 * The seven holidays Joy bills at time and a half.
 *
 * Named in the service agreement the client signs — `holiday_overtime` in the
 * consents registry, page 4 of the packet:
 *
 *   "Joy Healthcare Services, LLC. will bill at a rate of 1 1/2 times the
 *    hourly rate for overtime (Overtime is considered anything over 40 hours)
 *    and service(s) provided on the following holidays: New Year's Day,
 *    Memorial Day, Easter Sunday, Independence Day, Labor Day, Thanksgiving
 *    Day, Christmas Day."
 *
 * That list is exactly seven and this file implements exactly seven. It is not
 * the federal holiday list and must not drift towards it — Joy bills what the
 * client agreed to, and a client charged 1.5× for Veterans Day would be being
 * charged something they never signed.
 *
 * Four of the seven move each year, so they are computed rather than listed.
 * A hardcoded table would be correct until January and silently wrong after.
 */

export type HolidayKey =
  | "new_years_day"
  | "memorial_day"
  | "easter_sunday"
  | "independence_day"
  | "labor_day"
  | "thanksgiving"
  | "christmas_day";

export const HOLIDAY_LABELS: Record<HolidayKey, string> = {
  new_years_day: "New Year's Day",
  memorial_day: "Memorial Day",
  easter_sunday: "Easter Sunday",
  independence_day: "Independence Day",
  labor_day: "Labor Day",
  thanksgiving: "Thanksgiving Day",
  christmas_day: "Christmas Day",
};

function iso(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Nth occurrence of a weekday in a month. `n = -1` means the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const shift = (weekday - first.getUTCDay() + 7) % 7;
    return iso(year, month, 1 + shift + (n - 1) * 7);
  }
  const last = new Date(Date.UTC(year, month, 0));
  const shift = (last.getUTCDate() - 1) % 7;
  const back = (last.getUTCDay() - weekday + 7) % 7;
  void shift;
  return iso(year, month, last.getUTCDate() - back);
}

/**
 * Easter Sunday, by the anonymous Gregorian computus.
 *
 * Included with a slight wince: a date algorithm from an ecclesiastical
 * calculation is not something a home care CRM would normally carry. But the
 * client signed a document naming Easter Sunday, so Joy has to know when it is,
 * and the alternative — a table somebody remembers to extend — is the kind of
 * thing that is right for three years and then quietly bills a family the wrong
 * amount on a Sunday in April.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** The seven dates, for one year. */
export function holidaysFor(year: number): Record<HolidayKey, string> {
  return {
    new_years_day: iso(year, 1, 1),
    // Last Monday in May.
    memorial_day: nthWeekday(year, 5, 1, -1),
    easter_sunday: easterSunday(year),
    independence_day: iso(year, 7, 4),
    // First Monday in September.
    labor_day: nthWeekday(year, 9, 1, 1),
    // Fourth Thursday in November.
    thanksgiving: nthWeekday(year, 11, 4, 4),
    christmas_day: iso(year, 12, 25),
  };
}

/**
 * Which holiday a date is, if any.
 *
 * Takes a date string rather than a Date so a timezone cannot move a visit onto
 * or off a holiday. A shift starting at 9pm on Christmas Eve in Houston is
 * already Christmas Day in UTC, and billing it at 1.5× because of a timezone
 * would be a charge the client never agreed to.
 */
export function holidayOn(date: string): HolidayKey | null {
  const day = date.slice(0, 10);
  const year = Number(day.slice(0, 4));
  if (!Number.isFinite(year)) return null;

  const holidays = holidaysFor(year);
  const found = (Object.keys(holidays) as HolidayKey[]).find((key) => holidays[key] === day);
  return found ?? null;
}
