import { addMonths, daysBetween } from "@/domain/dates";

/**
 * The period selector: Week, Month, Last month, Quarter.
 *
 * `today` is a parameter everywhere rather than a call to `new Date()`, so a
 * report can be run as of any date and so the tests are not a lottery.
 */

export type ReportPeriod = "week" | "month" | "last_month" | "quarter";

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  week: "Week",
  month: "Month",
  last_month: "Last month",
  quarter: "Quarter",
};

export interface DateRange {
  start: string;
  /** Inclusive. */
  end: string;
  label: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday. Joy's workweek starts on Monday and payroll already assumes it. */
export function weekStart(today: string): string {
  const d = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

export function resolvePeriod(period: ReportPeriod, today: string): DateRange {
  const day = today.slice(0, 10);

  switch (period) {
    case "week": {
      const start = weekStart(day);
      return { start, end: day, label: `Week of ${start}` };
    }
    case "month": {
      const start = `${day.slice(0, 7)}-01`;
      return { start, end: day, label: `${day.slice(0, 7)} to date` };
    }
    case "last_month": {
      const firstOfThis = `${day.slice(0, 7)}-01`;
      const start = addMonths(firstOfThis, -1)!;
      // The last day of last month is the day before the first of this one.
      const endDate = new Date(`${firstOfThis}T00:00:00Z`);
      endDate.setUTCDate(endDate.getUTCDate() - 1);
      return { start, end: iso(endDate), label: start.slice(0, 7) };
    }
    case "quarter": {
      // Rolling three months rather than a calendar quarter. An agency asking
      // "how are we doing" on 23 April means the last three months, not the
      // three weeks since the calendar quarter turned over.
      const start = addMonths(day, -3)!;
      return { start, end: day, label: "Last 3 months" };
    }
  }
}

/** The months a range covers, oldest first, as `YYYY-MM`. */
export function monthsIn(range: DateRange): string[] {
  const months: string[] = [];
  let cursor = `${range.start.slice(0, 7)}-01`;
  while (cursor.slice(0, 7) <= range.end.slice(0, 7)) {
    months.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1)!;
  }
  return months;
}

export function daysInRange(range: DateRange): number {
  return daysBetween(range.start, range.end) + 1;
}

export function inRange(isoDate: string, range: DateRange): boolean {
  const day = isoDate.slice(0, 10);
  return day >= range.start && day <= range.end;
}
