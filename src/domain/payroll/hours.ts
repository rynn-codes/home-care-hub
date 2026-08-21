/**
 * Payroll — turning the clock into hours Gusto can pay.
 *
 * WHERE THE LINE IS
 *
 * Gusto is Joy's payroll provider, and §6's instruction about it generalises:
 * "Gusto should continue handling the HR/payroll workflows intentionally
 * assigned to Gusto rather than Joy rebuilding them." Tax, withholding, deposit
 * and the filings are Gusto's. Joy's job is narrower and nobody else can do it:
 * say how many hours each caregiver worked, split correctly, with anything
 * doubtful flagged before it becomes money.
 *
 * So this file computes hours and deliberately does not compute pay. Rates are
 * not in it. Karynn has not supplied real ones — the figures on the Employees
 * screen came from the mockup and are fiction — and a payroll module that
 * multiplied fictional rates by real hours would produce a number that looks
 * exactly like a wage.
 *
 * OVERTIME IS PER WORKWEEK, NOT PER PAY PERIOD
 *
 * This is the thing payroll code gets wrong. Under the FLSA overtime accrues in
 * a fixed, recurring seven-day workweek. If Joy pays fortnightly, somebody who
 * works 30 hours one week and 50 the next has 10 hours of overtime — not zero,
 * which is what totalling 80 across the period and comparing to 80 would say.
 *
 * `weeklyTotals` therefore splits the period into workweeks first and applies
 * the threshold to each. The pay period is only how often Joy hands numbers to
 * Gusto.
 *
 * THE WORKWEEK BOUNDARY MUST MATCH GUSTO
 *
 * An employer declares its workweek and it is supposed to stay put. Joy's is
 * `WORKWEEK_STARTS_ON`, and Gusto has its own setting. If the two disagree,
 * overtime is silently wrong for anybody working across the boundary — nothing
 * errors, the numbers are just different. This is flagged for Karynn rather
 * than guessed at; see the constant.
 */

import {
  payableHours,
  type VerifiedServiceUnit,
} from "@/domain/service/verifiedUnit";

/** Karynn confirmed 40 hours and 1.5×. */
export const OVERTIME_AFTER_HOURS = 40;
export const OVERTIME_MULTIPLIER = 1.5;

/**
 * Day the workweek begins. 0 = Sunday.
 *
 * FLAGGED FOR KARYNN. Set to Monday because the rest of Joy's scheduling
 * already works in Monday-first weeks, so the caregiver's "this week" and the
 * payroll week agree on screen. US payroll more often runs Sunday–Saturday, and
 * Gusto will have this configured somewhere. Whichever it is, the two must be
 * the same value, and a mismatch is invisible: nothing breaks, overtime is
 * simply computed against a different seven days for anybody who works a
 * weekend.
 */
export const WORKWEEK_STARTS_ON = 1;

export interface TimeEntry {
  id: string;
  visitId: string;
  caregiverPersonId: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  /** §11's clock-out with documentation outstanding. */
  exceptionReason: string | null;
}

export interface PayPeriod {
  /** Inclusive, as a date. */
  start: string;
  /** Inclusive. */
  end: string;
}

export interface WorkweekTotals {
  weekStart: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
}

export type PayrollExceptionKind =
  /** Still clocked in. The period cannot close over this. */
  | "open_entry"
  /** Clocked out with required documentation missing. */
  | "documentation_gap"
  /** A visit happened with no time entry against it. */
  | "visit_without_time"
  /** Longer than a plausible shift. Usually a forgotten clock-out. */
  | "implausible_length"
  /** Somebody opened a review of this visit and has not finished it. */
  | "awaiting_verification";

export interface PayrollException {
  kind: PayrollExceptionKind;
  entryId: string | null;
  visitId: string | null;
  detail: string;
  /** Whether this stops the period being sent to Gusto. */
  blocking: boolean;
}

export interface CaregiverHours {
  caregiverPersonId: string;
  caregiverName: string;
  weeks: WorkweekTotals[];
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  exceptions: PayrollException[];
  /** False when anything blocking is outstanding. */
  ready: boolean;
}

// ------------------------------------------------------------- helpers --

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** The start of the workweek containing this instant, as a date string. */
export function workweekStart(iso: string, startsOn = WORKWEEK_STARTS_ON): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() - startsOn + 7) % 7;
  d.setDate(d.getDate() - shift);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Hours in one entry, to two decimals.
 *
 * Rounded at the entry rather than at the total, because that is what a
 * timesheet shows and a caregiver checking Joy against her own arithmetic
 * should get the same answer. Rounding only at the end makes the line items
 * fail to add up to the total, which reads as a mistake.
 */
export function entryHours(entry: TimeEntry): number {
  if (!entry.clockedOutAt) return 0;
  const ms = new Date(entry.clockedOutAt).getTime() - new Date(entry.clockedInAt).getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/** Longer than this and somebody forgot to clock out. */
export const IMPLAUSIBLE_SHIFT_HOURS = 16;

// ------------------------------------------------- the approved fact --

/**
 * The live verified unit for each visit, by visit id.
 *
 * Superseded units are dropped. They are history — the record of what Joy
 * approved before a correction — and paying from one would pay the figure that
 * was corrected.
 */
export function liveUnitsByVisit(
  units: readonly VerifiedServiceUnit[],
): Map<string, VerifiedServiceUnit> {
  const live = new Map<string, VerifiedServiceUnit>();
  for (const unit of units) {
    if (unit.state === "superseded") continue;
    live.set(unit.visitId, unit);
  }
  return live;
}

/** Approved payable hours, or null when nothing has been approved. */
function approvedHoursFor(unit: VerifiedServiceUnit | undefined): number | null {
  return unit ? payableHours(unit) : null;
}

// -------------------------------------------------------------- totals --

/**
 * Split a caregiver's entries into workweeks and apply the threshold to each.
 *
 * An entry counts to the week it *started* in. A shift that runs past midnight
 * into a new workweek is not split — it belongs to the week it began, which is
 * the ordinary convention and, more usefully, the one a caregiver would expect
 * when she looks at her Friday night shift.
 */
export function weeklyTotals(
  entries: readonly TimeEntry[],
  startsOn = WORKWEEK_STARTS_ON,
  units: readonly VerifiedServiceUnit[] = [],
): WorkweekTotals[] {
  const byWeek = new Map<string, number>();
  const live = liveUnitsByVisit(units);

  for (const entry of entries) {
    const week = workweekStart(entry.clockedInAt, startsOn);
    const approved = approvedHoursFor(live.get(entry.visitId));
    byWeek.set(week, (byWeek.get(week) ?? 0) + (approved ?? entryHours(entry)));
  }

  // A visit nobody clocked, which somebody has since looked at and approved a
  // figure for. Karynn's "let her out, record the gap" case, and the reason
  // this loop exists: without it the approval is recorded and then not paid.
  for (const unit of live.values()) {
    const approved = approvedHoursFor(unit);
    if (approved === null) continue;
    if (entries.some((e) => e.visitId === unit.visitId)) continue;
    const week = workweekStart(`${unit.servedOn}T12:00:00`, startsOn);
    byWeek.set(week, (byWeek.get(week) ?? 0) + approved);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, total]) => {
      const rounded = Math.round(total * 100) / 100;
      const overtime = Math.max(0, Math.round((rounded - OVERTIME_AFTER_HOURS) * 100) / 100);
      return {
        weekStart,
        regularHours: Math.round((rounded - overtime) * 100) / 100,
        overtimeHours: overtime,
        totalHours: rounded,
      };
    });
}

// ---------------------------------------------------------- exceptions --

export interface VisitStub {
  id: string;
  caregiverPersonId: string | null;
  startsAt: string;
  status: string;
}

/**
 * Everything doubtful about one caregiver's period.
 *
 * `blocking` marks what must be resolved before the period goes to Gusto. The
 * split matters: an open entry is somebody still clocked in and paying that is
 * guesswork, so it blocks. A documentation gap is a real problem for the office
 * and a settled fact for payroll — she worked those hours whether or not the
 * note was finished, and withholding her pay over paperwork is a different and
 * worse mistake.
 */
export function findExceptions(input: {
  entries: readonly TimeEntry[];
  visits: readonly VisitStub[];
  period: PayPeriod;
  units?: readonly VerifiedServiceUnit[];
}): PayrollException[] {
  const { entries, visits, period } = input;
  const exceptions: PayrollException[] = [];
  const live = liveUnitsByVisit(input.units ?? []);

  for (const entry of entries) {
    if (!entry.clockedOutAt) {
      exceptions.push({
        kind: "open_entry",
        entryId: entry.id,
        visitId: entry.visitId,
        detail: `Still clocked in since ${entry.clockedInAt.slice(0, 16).replace("T", " ")}.`,
        blocking: true,
      });
      continue;
    }

    const hours = entryHours(entry);
    if (hours > IMPLAUSIBLE_SHIFT_HOURS) {
      exceptions.push({
        kind: "implausible_length",
        entryId: entry.id,
        visitId: entry.visitId,
        detail: `${hours} hours on one visit. Usually a forgotten clock-out.`,
        blocking: true,
      });
    }

    // Somebody started reviewing this visit and stopped. Paying the raw clock
    // over the top of an unfinished review is the drift the verified unit
    // exists to prevent — and unlike a missing review, this one is visible, so
    // it is a task rather than a silent fallback.
    if (live.get(entry.visitId)?.state === "proposed") {
      exceptions.push({
        kind: "awaiting_verification",
        entryId: entry.id,
        visitId: entry.visitId,
        detail: "This visit is part-way through review. Approve the hours before payroll goes out.",
        blocking: true,
      });
    }

    if (entry.exceptionReason) {
      exceptions.push({
        kind: "documentation_gap",
        entryId: entry.id,
        visitId: entry.visitId,
        detail: entry.exceptionReason,
        // She worked the hours. Holding pay over paperwork is a worse mistake
        // than the paperwork.
        blocking: false,
      });
    }
  }

  const clocked = new Set(entries.map((e) => e.visitId));
  for (const visit of visits) {
    if (visit.status === "cancelled") continue;
    if (dateOnly(visit.startsAt) < period.start || dateOnly(visit.startsAt) > period.end) continue;
    if (clocked.has(visit.id)) continue;

    const unit = live.get(visit.id);
    // Nobody clocked it, and somebody has since looked at it and approved a
    // figure. That is the whole point of the record — the gap was found, a
    // person decided, and it is no longer outstanding.
    if (unit?.state === "verified") continue;
    if (unit?.state === "proposed") {
      exceptions.push({
        kind: "awaiting_verification",
        entryId: null,
        visitId: visit.id,
        detail: `The visit on ${dateOnly(visit.startsAt)} is under review. Approve the hours before payroll goes out.`,
        blocking: true,
      });
      continue;
    }

    exceptions.push({
      kind: "visit_without_time",
      entryId: null,
      visitId: visit.id,
      detail: `A visit on ${dateOnly(visit.startsAt)} has no time recorded against it.`,
      // Somebody may have worked and forgotten to clock in. Paying nothing for
      // it silently is the failure this catches.
      blocking: true,
    });
  }

  return exceptions;
}

// ----------------------------------------------------------- assembly --

export function caregiverHours(input: {
  caregiverPersonId: string;
  caregiverName: string;
  entries: readonly TimeEntry[];
  visits: readonly VisitStub[];
  period: PayPeriod;
  startsOn?: number;
  /**
   * The approved facts, where they exist.
   *
   * Optional, and absent everywhere until the review screen is built — with no
   * unit for a visit this behaves exactly as it did before, paying from the
   * clock. Where a unit exists it wins: §3.1.5 says the two ledgers share
   * verified service facts and never infer one another's result, and payroll
   * re-deriving hours the office already approved is precisely that.
   */
  units?: readonly VerifiedServiceUnit[];
}): CaregiverHours {
  const { caregiverPersonId, caregiverName, entries, visits, period } = input;

  const mine = entries.filter((e) => e.caregiverPersonId === caregiverPersonId);
  const myVisits = visits.filter((v) => v.caregiverPersonId === caregiverPersonId);
  const myUnits = (input.units ?? []).filter(
    (u) => u.caregiverPersonId === caregiverPersonId,
  );

  const weeks = weeklyTotals(mine, input.startsOn, myUnits);
  const exceptions = findExceptions({
    entries: mine,
    visits: myVisits,
    period,
    units: myUnits,
  });

  const sum = (pick: (w: WorkweekTotals) => number) =>
    Math.round(weeks.reduce((total, w) => total + pick(w), 0) * 100) / 100;

  return {
    caregiverPersonId,
    caregiverName,
    weeks,
    regularHours: sum((w) => w.regularHours),
    overtimeHours: sum((w) => w.overtimeHours),
    totalHours: sum((w) => w.totalHours),
    exceptions,
    ready: !exceptions.some((e) => e.blocking),
  };
}

export interface PayrollRun {
  period: PayPeriod;
  caregivers: CaregiverHours[];
  totalHours: number;
  overtimeHours: number;
  /** Caregivers with something blocking. Named, because a count is not a task. */
  blockedBy: string[];
  ready: boolean;
}

export function payrollRun(input: {
  period: PayPeriod;
  people: ReadonlyArray<{ personId: string; name: string }>;
  entries: readonly TimeEntry[];
  visits: readonly VisitStub[];
  startsOn?: number;
  /** See `caregiverHours`. Absent means "pay from the clock", as before. */
  units?: readonly VerifiedServiceUnit[];
}): PayrollRun {
  const caregivers = input.people
    .map((p) =>
      caregiverHours({
        caregiverPersonId: p.personId,
        caregiverName: p.name,
        entries: input.entries,
        visits: input.visits,
        period: input.period,
        startsOn: input.startsOn,
        units: input.units,
      }),
    )
    // Somebody with no hours and no exceptions is not on this payroll.
    .filter((c) => c.totalHours > 0 || c.exceptions.length > 0);

  const blockedBy = caregivers.filter((c) => !c.ready).map((c) => c.caregiverName);

  return {
    period: input.period,
    caregivers,
    totalHours: Math.round(caregivers.reduce((t, c) => t + c.totalHours, 0) * 100) / 100,
    overtimeHours: Math.round(caregivers.reduce((t, c) => t + c.overtimeHours, 0) * 100) / 100,
    blockedBy,
    ready: blockedBy.length === 0,
  };
}

/** One line for the top of the screen. */
export function runSummary(run: PayrollRun): string {
  if (run.caregivers.length === 0) return "No hours recorded in this period.";

  const base = `${run.totalHours} hours across ${run.caregivers.length} ${
    run.caregivers.length === 1 ? "caregiver" : "caregivers"
  }`;
  const ot = run.overtimeHours > 0 ? `, ${run.overtimeHours} of it overtime` : "";

  if (run.ready) return `${base}${ot}. Ready to send to Gusto.`;

  return run.blockedBy.length === 1
    ? `${base}${ot}. ${run.blockedBy[0]} has something to sort out first.`
    : `${base}${ot}. ${run.blockedBy.length} caregivers have something to sort out first.`;
}
