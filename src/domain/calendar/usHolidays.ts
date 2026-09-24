/**
 * The US holidays the calendar marks, with the day the office observes them.
 *
 * This is the civic list, not the billing list. `domain/billing/holidays`
 * carries the seven the service agreement bills at time and a half, and the
 * two must not be confused: a client is charged the holiday rate only for the
 * days they signed for. `premium` here says whether a date is one of those
 * seven, so the calendar can say "Holiday · premium rate" without the billing
 * module ever reading the calendar.
 */
export interface USHoliday {
  key: string;
  name: string;
  /** The date itself. */
  date: string;
  /** The weekday the office observes it on — a Saturday holiday moves to Friday. */
  observed: string;
  /** Billed at 1.5× under the service agreement. */
  premium: boolean;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return iso(year, month, 1 + shift + (n - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() - weekday + 7) % 7;
  return iso(year, month, last.getUTCDate() - back);
}

function observedDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function usHolidays(year: number): USHoliday[] {
  const fixed: Array<[string, string, string, boolean]> = [
    ["new-year", "New Year's Day", iso(year, 1, 1), true],
    ["juneteenth", "Juneteenth", iso(year, 6, 19), false],
    ["independence", "Independence Day", iso(year, 7, 4), true],
    ["veterans", "Veterans Day", iso(year, 11, 11), false],
    ["christmas", "Christmas Day", iso(year, 12, 25), true],
  ];
  const floating: Array<[string, string, string, boolean]> = [
    ["mlk", "Martin Luther King Jr. Day", nthWeekday(year, 1, 1, 3), false],
    ["presidents", "Presidents' Day", nthWeekday(year, 2, 1, 3), false],
    ["memorial", "Memorial Day", lastWeekday(year, 5, 1), true],
    ["labor", "Labor Day", nthWeekday(year, 9, 1, 1), true],
    ["columbus", "Columbus Day", nthWeekday(year, 10, 1, 2), false],
    ["thanksgiving", "Thanksgiving Day", nthWeekday(year, 11, 4, 4), true],
  ];
  return [...fixed, ...floating]
    .map(([key, name, date, premium]) => ({ key, name, date, observed: observedDay(date), premium }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Every holiday whose date falls inside the range, inclusive. */
export function holidaysBetween(from: string, to: string): USHoliday[] {
  const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
  return years
    .flatMap((y) => usHolidays(y))
    .filter((h) => h.date >= from && h.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The holiday on this date, if it is one. */
export function usHolidayOn(date: string): USHoliday | null {
  return usHolidays(Number(date.slice(0, 4))).find((h) => h.date === date) ?? null;
}

/** How far ahead Joy asks families about holiday coverage. */
export const HOLIDAY_ASK_DAYS = 14;

export function daysUntilHoliday(today: string, holiday: USHoliday): number {
  const from = Date.parse(`${today}T12:00:00Z`);
  const to = Date.parse(`${holiday.date}T12:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Holidays inside the asking window, soonest first. */
export function upcomingHolidays(today: string): USHoliday[] {
  const year = Number(today.slice(0, 4));
  return [...usHolidays(year), ...usHolidays(year + 1)]
    .filter((h) => {
      const away = daysUntilHoliday(today, h);
      return away >= 0 && away <= HOLIDAY_ASK_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The message Joy drafts to each family ahead of a holiday. Nothing sends until approved. */
export function holidayAskText(holiday: USHoliday, clientName: string): string {
  const when = new Date(`${holiday.date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Hi ${clientName} — ${holiday.name} falls on ${when}. Would you like your caregiver to work as usual that day, or would you prefer to skip it? Just reply either way and we'll set the schedule.`;
}

/** The brief's opening line on a holiday. */
export function holidaySentence(holiday: USHoliday): string {
  return holiday.premium
    ? `It's ${holiday.name} — every visit today is at the holiday rate, and Joy won't add anyone to the schedule.`
    : `It's ${holiday.name}.`;
}
