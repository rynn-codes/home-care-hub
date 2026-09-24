import { OVERTIME_THRESHOLD_HOURS, type Visit } from "@/domain/scheduling/conflicts";
import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { hoursBetween } from "@/domain/scheduling/coverage";
import type { DayTimes } from "@/domain/scheduling/clientSchedule";

/**
 * What Joy reads off the board when somebody adds a visit: the client's
 * usual times and caregiver, the next free day on their pattern, who from
 * the office last went out, and how many people a coverage window needs.
 */

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const ymd = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function commonest<T extends string>(values: readonly T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T = values[0];
  let n = 0;
  for (const v of values) {
    const c = counts.get(v)!;
    if (c >= n) {
      best = v;
      n = c;
    }
  }
  return best;
}

const OFFICE_EVENTS = new Set(["client_visit", "supervisor_visit"]);

/** For an office visit: who works this client, when they are next seen, and when the office last went. */
export function officeVisitContext(input: { clientName: string; visits: readonly Visit[]; from: Date }) {
  const { clientName, visits, from } = input;
  if (!clientName) return null;
  const mine = visits.filter((v) => v.clientName === clientName);
  if (mine.length === 0) return { regularCaregiver: null, nextVisit: null, lastOfficeVisit: null, drawnFrom: 0 };
  const shifts = mine.filter((v) => v.eventType === undefined);
  const regular = commonest(shifts.map((v) => v.caregiverName).filter((n): n is string => !!n));
  const next = shifts.filter((v) => new Date(v.startsAt).getTime() >= from.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const office = mine
    .filter((v) => v.eventType !== undefined && OFFICE_EVENTS.has(v.eventType))
    .filter((v) => new Date(v.startsAt).getTime() < from.getTime())
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return {
    regularCaregiver: regular,
    nextVisit: next ? { caregiverName: next.caregiverName, startsAt: next.startsAt } : null,
    lastOfficeVisit: office[0] ? ymd(office[0].startsAt) : null,
    drawnFrom: shifts.length,
  };
}

export function agoLabel(date: string | null, now: Date): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

export function thatDayLine(next: { caregiverName: string | null; startsAt: string } | null, fmt: (iso: string) => string): string | null {
  return next ? `${next.caregiverName ?? "An open shift"} is already booked ${fmt(next.startsAt)}` : null;
}

const MIN_VISITS_FOR_PATTERN = 2;
const LOOKAHEAD_DAYS = 21;

export interface ShiftSuggestion {
  caregiverName: string | null;
  start: string;
  end: string;
  weekdays: number[];
  drawnFrom: number;
  agreeing: number;
}

/** The client's usual shift, read off their visits. */
export function suggestShift(input: { clientName: string; visits: readonly Visit[] }): ShiftSuggestion | null {
  const { clientName, visits } = input;
  if (!clientName) return null;
  const mine = visits
    .filter((v) => v.clientName === clientName && v.eventType === undefined)
    .filter((v) => hhmm(v.startsAt) !== "" && hhmm(v.endsAt) !== "")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (mine.length < MIN_VISITS_FOR_PATTERN) return null;
  const usual = commonest(mine.map((v) => `${hhmm(v.startsAt)}|${hhmm(v.endsAt)}`));
  if (!usual) return null;
  const [start, end] = usual.split("|");
  const agreeing = mine.filter((v) => `${hhmm(v.startsAt)}|${hhmm(v.endsAt)}` === usual);
  const caregiver =
    commonest(agreeing.map((v) => v.caregiverName).filter((n): n is string => !!n)) ?? commonest(mine.map((v) => v.caregiverName).filter((n): n is string => !!n)) ?? null;
  const weekdays = [...new Set(mine.map((v) => new Date(v.startsAt).getDay()))].sort((a, b) => a - b);
  return { caregiverName: caregiver, start, end, weekdays, drawnFrom: mine.length, agreeing: agreeing.length };
}

/** The first day on the client's pattern, from `from`, with nothing booked yet. */
export function nextFreeDay(input: { suggestion: ShiftSuggestion; clientName: string; visits: readonly Visit[]; from: Date }): string | null {
  const { suggestion, clientName, visits, from } = input;
  if (suggestion.weekdays.length === 0) return null;
  const booked = new Set(visits.filter((v) => v.clientName === clientName).map((v) => ymd(v.startsAt)));
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
    const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (suggestion.weekdays.includes(cursor.getDay()) && !booked.has(date)) return date;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

export function shiftHours(s: Pick<ShiftSuggestion, "start" | "end">): number {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

export function suggestionEvidence(s: ShiftSuggestion, clientName: string): string {
  return s.agreeing === s.drawnFrom ? `All ${s.drawnFrom} of ${clientName}'s visits run at these times.` : `${s.agreeing} of ${clientName}'s last ${s.drawnFrom} visits ran at these times.`;
}

/** The client's usual times on each weekday they are seen. */
export function usualWeek(input: { clientName: string; visits: readonly Visit[] }): Record<number, DayTimes> {
  const mine = input.visits
    .filter((v) => v.clientName === input.clientName && v.eventType === undefined)
    .filter((v) => hhmm(v.startsAt) !== "" && hhmm(v.endsAt) !== "")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const out: Record<number, DayTimes> = {};
  for (const weekday of new Set(mine.map((v) => new Date(v.startsAt).getDay()))) {
    const onDay = mine.filter((v) => new Date(v.startsAt).getDay() === weekday);
    const usual = commonest(onDay.map((v) => `${hhmm(v.startsAt)}|${hhmm(v.endsAt)}`));
    if (!usual) continue;
    const [start, end] = usual.split("|");
    out[weekday] = { start, end };
  }
  return out;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayList(days: readonly number[]): string {
  const names = days.map((d) => DAY_SHORT[d]).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function describeUsualWeek(days: Record<number, DayTimes>): string {
  const keys = Object.keys(days).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return "";
  const same = keys.every((d) => days[d].start === days[keys[0]].start && days[d].end === days[keys[0]].end);
  return same ? `${weekdayList(keys)}, all at the same times` : `${weekdayList(keys)}, each at its own times`;
}

// ---------------------------------------------------------------------------
// Staffing a coverage window

export interface StaffingNeed {
  weeks: Array<{ weekStart: string; hours: number; shifts: number; busiestDay: number; fewest: number }>;
  fewest: number;
  comfortable: number;
}

export function staffingNeed(shifts: ReadonlyArray<{ startsAt: string; endsAt: string }>, threshold = OVERTIME_THRESHOLD_HOURS): StaffingNeed {
  const byWeek = new Map<string, { hours: number; shifts: number; days: Map<string, number> }>();
  for (const s of shifts) {
    const week = agencyWeekStart(s.startsAt.slice(0, 10));
    const day = s.startsAt.slice(0, 10);
    const cur = byWeek.get(week) ?? { hours: 0, shifts: 0, days: new Map() };
    cur.hours += hoursBetween(s.startsAt, s.endsAt);
    cur.shifts += 1;
    cur.days.set(day, (cur.days.get(day) ?? 0) + 1);
    byWeek.set(week, cur);
  }
  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, w]) => {
      const busiest = Math.max(0, ...w.days.values());
      return { weekStart, hours: Math.round(w.hours * 100) / 100, shifts: w.shifts, busiestDay: busiest, fewest: Math.max(Math.ceil(w.hours / threshold), busiest) };
    });
  const fewest = Math.max(0, ...weeks.map((w) => w.fewest));
  return { weeks, fewest, comfortable: fewest === 0 ? 0 : fewest + 1 };
}

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function workweekLabel(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00`);
  end.setDate(end.getDate() + 6);
  return `Sat ${shortDate(weekStart)} – Fri ${shortDate(end.toISOString().slice(0, 10))}`;
}

export function staffingWeeksLine(need: StaffingNeed): string {
  const n = need.weeks.length;
  if (n === 0) return "No shifts yet.";
  const parts = need.weeks.map((w) => `${workweekLabel(w.weekStart)} (${w.hours} hrs)`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${n} ${n === 1 ? "workweek" : "workweeks"} — ${list}. Overtime counts separately in each.`;
}

export function staffingHeadline(need: StaffingNeed, threshold = OVERTIME_THRESHOLD_HOURS): string {
  if (need.fewest === 0) return "Nothing to staff yet.";
  const busiest = [...need.weeks].sort((a, b) => b.fewest - a.fewest)[0];
  const why =
    busiest.busiestDay >= Math.ceil(busiest.hours / threshold)
      ? `${busiest.busiestDay} shifts fall on one day and nobody works two`
      : `nobody passes ${threshold} hours in the ${need.weeks.length > 1 ? "busier " : ""}week`;
  return `At least ${need.fewest} ${need.fewest === 1 ? "caregiver" : "caregivers"}, so ${why}; ${need.comfortable} is comfortable — one to cover a call-out.`;
}
