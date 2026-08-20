import { hoursOf, type Visit } from "@/domain/scheduling/conflicts";
import type { ComplianceAlert } from "@/domain/credentials/alerts";

/**
 * The active caregiver's home and schedule — §8, §9, and §29's step 7.
 *
 * §8 says the screen answers one question: "What do I need to do right now?"
 * Everything here serves that and nothing else. It is deliberately much
 * thinner than the admin dashboard, which answers a different question for a
 * different person.
 *
 * §9 IS ENFORCED BY REUSE, NOT BY DISCIPLINE
 *
 * "The Employee Portal uses the same official Joy schedule as the admin
 * Scheduling module. Do not create a second employee schedule."
 *
 * So this file defines no visit type. It imports `Visit` from
 * `scheduling/conflicts.ts` — the type the admin board, the conflict checker
 * and the assignment ranker all use — and filters it. There is nowhere for a
 * second schedule to hide, because there is no second shape to put one in.
 *
 * The same goes for `hoursOf`: this week's hours are counted by the function
 * that decides overtime on the admin side. A caregiver seeing 32 hours while
 * the office sees 34 would be a bug rather than a rounding difference, and the
 * only way to guarantee that is one implementation.
 */

export type VisitState =
  | "scheduled"
  | "starts_soon"
  | "in_progress"
  | "completed"
  /** Started late enough that the office should know. */
  | "missed";

/** A visit belonging to one caregiver, with the state the portal shows. */
export interface MyVisit {
  visit: Visit;
  state: VisitState;
  /** "9:00 AM – 1:00 PM". */
  timeRange: string;
  hours: number;
}

/** Minutes before a visit at which the portal starts nudging. */
export const STARTS_SOON_MINUTES = 30;

/** Minutes past the start with no clock-in before Joy calls it missed. */
export const MISSED_AFTER_MINUTES = 15;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m === 0 ? `${h}:00 ${suffix}` : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function timeRange(visit: Visit): string {
  return `${fmtTime(visit.startsAt)} – ${fmtTime(visit.endsAt)}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Where a visit stands.
 *
 * `clockedInAt` is passed rather than inferred from the clock, because §10 says
 * "the server should remain authoritative for official timestamps". A browser
 * deciding on its own that a visit is in progress would put a caregiver's phone
 * clock into a payroll record.
 */
export function visitState(
  visit: Visit,
  asOf: Date,
  clock: { clockedInAt: string | null; clockedOutAt: string | null } = {
    clockedInAt: null,
    clockedOutAt: null,
  },
): VisitState {
  if (clock.clockedOutAt) return "completed";
  if (clock.clockedInAt) return "in_progress";

  const start = new Date(visit.startsAt);
  const minutesUntil = (start.getTime() - asOf.getTime()) / 60_000;

  if (minutesUntil < -MISSED_AFTER_MINUTES) return "missed";
  if (minutesUntil <= STARTS_SOON_MINUTES) return "starts_soon";
  return "scheduled";
}

export interface ClockRecord {
  visitId: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
}

export interface EmployeeSchedule {
  today: MyVisit[];
  /** The next visit after today's, for §8's NEXT block. */
  upcoming: MyVisit[];
  /** Every visit in the current week, for the schedule screen. */
  week: MyVisit[];
  weekHours: number;
}

/**
 * One caregiver's schedule, out of Joy's schedule.
 *
 * Open shifts are excluded. §24 forbids exposing staffing gaps to families and
 * the same reasoning applies here: an unassigned visit is the office's problem
 * until somebody is put on it, and showing it to a caregiver who has not been
 * asked invites her to turn up to a visit she was not given.
 */
export function mySchedule(input: {
  visits: readonly Visit[];
  caregiverName: string;
  asOf: Date;
  clocks?: readonly ClockRecord[];
}): EmployeeSchedule {
  const { visits, caregiverName, asOf } = input;
  const clocks = input.clocks ?? [];

  const mine = visits
    .filter((v) => v.caregiverName === caregiverName)
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const toMine = (visit: Visit): MyVisit => {
    const clock = clocks.find((c) => c.visitId === visit.id);
    return {
      visit,
      state: visitState(visit, asOf, {
        clockedInAt: clock?.clockedInAt ?? null,
        clockedOutAt: clock?.clockedOutAt ?? null,
      }),
      timeRange: timeRange(visit),
      hours: hoursOf(visit),
    };
  };

  const week = mine.map(toMine);
  const today = week.filter((v) => sameDay(new Date(v.visit.startsAt), asOf));
  const upcoming = week.filter((v) => new Date(v.visit.startsAt) > asOf && !today.includes(v));

  return {
    today,
    upcoming,
    week,
    // Counted with the admin side's own function. See the file header.
    weekHours: week.reduce((sum, v) => sum + v.hours, 0),
  };
}

// ----------------------------------------------------------------- home --

export interface HomeAction {
  label: string;
  to: string;
}

export interface EmployeeHomeView {
  greeting: string;
  /** The visit in front of them, if there is one. */
  now: MyVisit | null;
  next: MyVisit | null;
  weekHours: number;
  todayCount: number;
  /** Credentials of theirs that need renewing. Never anyone else's. */
  documents: Array<{ label: string; detail: string; urgent: boolean }>;
  headline: string;
  action: HomeAction | null;
}

function greetingFor(asOf: Date, name: string): string {
  const h = asOf.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

/**
 * §8's screen.
 *
 * `alerts` is filtered to this employee by the caller and filtered again here,
 * because the compliance engine returns the whole workforce's alerts and a
 * caregiver must never see a colleague's lapsed CPR. Belt and braces on a leak
 * that would be quiet: nothing would look wrong, there would simply be somebody
 * else's name on somebody's phone.
 */
export function employeeHome(input: {
  schedule: EmployeeSchedule;
  greetingName: string;
  employeeId: string;
  alerts: readonly ComplianceAlert[];
  asOf: Date;
}): EmployeeHomeView {
  const { schedule, greetingName, employeeId, alerts, asOf } = input;

  const mineOnly = alerts.filter((a) => a.employeeId === employeeId);

  const documents = mineOnly.map((a) => ({
    // The alert's label names the person — right for the office list, wrong
    // when the person reading it is her. Rephrased around the credential.
    label: a.label.replace(new RegExp(`^${a.employeeName}['’]s\\s*`, "i"), ""),
    detail:
      a.daysRemaining === null
        ? "Not on file"
        : a.daysRemaining < 0
          ? "Expired"
          : `Expires in ${a.daysRemaining} ${a.daysRemaining === 1 ? "day" : "days"}`,
    urgent: a.severity === "blocking",
  }));

  // Order matters, and `missed` sits high on purpose. A caregiver twenty
  // minutes late is the most urgent thing on this screen — a client is waiting.
  // Leaving it out sent her a cheerful "Nothing scheduled today" instead, which
  // is how a missed visit becomes a missed visit nobody noticed.
  const now =
    schedule.today.find((v) => v.state === "in_progress") ??
    schedule.today.find((v) => v.state === "missed") ??
    schedule.today.find((v) => v.state === "starts_soon") ??
    schedule.today.find((v) => v.state === "scheduled") ??
    null;

  const next = now ? (schedule.today.find((v) => v !== now) ?? schedule.upcoming[0] ?? null) : (schedule.upcoming[0] ?? null);

  // What to say at the top. A blocking credential outranks a visit, because
  // somebody who cannot legally work should not be told to start one.
  const blocking = documents.find((d) => d.urgent);

  if (blocking) {
    return {
      greeting: greetingFor(asOf, greetingName),
      now,
      next,
      weekHours: schedule.weekHours,
      todayCount: schedule.today.length,
      documents,
      headline: `Your ${blocking.label} needs attention before your next visit`,
      action: { label: "Sort it out", to: "/portal/work/documents" },
    };
  }

  if (now) {
    const headline =
      now.state === "in_progress"
        ? `You're with ${now.visit.clientName}`
        : now.state === "missed"
          // Said without accusation. She may be stuck in traffic, and a screen
          // that opens by telling her she is late helps nobody.
          ? `${now.visit.clientName} was expecting you at ${now.timeRange.split(" – ")[0]}`
          : `${now.visit.clientName}, ${now.timeRange}`;

    return {
      greeting: greetingFor(asOf, greetingName),
      now,
      next,
      weekHours: schedule.weekHours,
      todayCount: schedule.today.length,
      documents,
      headline,
      action:
        now.state === "in_progress"
          ? { label: "Chart visit", to: `/portal/work/visit/${now.visit.id}` }
          : { label: "Start visit", to: `/portal/work/visit/${now.visit.id}` },
    };
  }

  return {
    greeting: greetingFor(asOf, greetingName),
    now: null,
    next,
    weekHours: schedule.weekHours,
    todayCount: 0,
    documents,
    headline: next ? `Nothing today — next is ${next.visit.clientName}` : "Nothing scheduled today",
    action: next ? { label: "See your schedule", to: "/portal/work/schedule" } : null,
  };
}
