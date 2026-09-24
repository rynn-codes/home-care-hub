import type { AdmissionStage } from "@/domain/admissions/stages";
import type { IntakeAnswers } from "@/domain/admissions/intake";

/**
 * What the queue says about each record beyond its stage: how long it has
 * been sitting, whether the start of care is slipping, what the button
 * should read, and how the rows order inside a section.
 *
 * Section 8 of the Admissions spec: the queue is sorted by who holds the
 * next move. Inside "Needs you", the overdue record comes first, then the
 * one whose start date is at risk, then whoever has waited longest. A
 * record that has waited two days gets a badge; the office should not have
 * to read the meta line to notice.
 */

/** Waiting this long or more earns the amber badge. */
export const LONG_WAIT_DAYS = 2;

/** A start of care this close, or past, with the admission still open. */
export const START_AT_RISK_DAYS = 7;

/** Whole days between an instant and now, never negative. */
export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const diff = now.getTime() - then;
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
}

export function daysWaiting(record: { waitingSince?: string | null }, now: Date): number | null {
  return record.waitingSince ? daysSince(record.waitingSince, now) : null;
}

export function waitingLabel(days: number | null): string | null {
  if (days === null) return null;
  return days === 0 ? "Today" : `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}

export function isLongWait(days: number | null): boolean {
  return days !== null && days >= LONG_WAIT_DAYS;
}

const OPEN_STAGES: readonly AdmissionStage[] = ["new_referral", "phone_intake", "assessment", "pre_onboarding"];

/**
 * The start date the family was told, from the intake answers.
 *
 * The rebuilt intake keeps it under `v2.start` / `v2.startDate` ("On a
 * date"); the older question set kept `anticipated_start_date`. Either is
 * read, so a record from before the change still counts.
 */
export function anticipatedStart(answers: IntakeAnswers | undefined | null): string | null {
  if (!answers) return null;
  const v2 = answers.v2 as { start?: string; startDate?: string } | undefined;
  if (v2) return v2.start === "On a date" && v2.startDate ? v2.startDate : null;
  const legacy = answers.anticipated_start_date;
  return typeof legacy === "string" && legacy ? legacy : null;
}

/** The family expects care to start within a week and the admission is still open. */
export function startOfCareAtRisk(startsOn: string | null, stage: AdmissionStage, today: string): boolean {
  if (!startsOn || !OPEN_STAGES.includes(stage)) return false;
  const daysAway = daysSince(today, new Date(`${startsOn}T00:00:00`));
  return startsOn <= today || daysAway <= START_AT_RISK_DAYS;
}

export interface QueueRow {
  name: string;
  overdue?: boolean;
  atRisk?: boolean;
  daysWaiting: number | null;
  scheduledAt?: string | null;
}

function urgency(row: QueueRow): number {
  return row.overdue ? 0 : row.atRisk ? 1 : 2;
}

/** Longest wait first; a record with no clock sorts after one with a clock. */
function byWait(a: QueueRow, b: QueueRow): number {
  const x = a.daysWaiting;
  const y = b.daysWaiting;
  if (x !== null && y !== null && x !== y) return y - x;
  if (x === null && y !== null) return 1;
  if (y === null && x !== null) return -1;
  return a.name.localeCompare(b.name);
}

function needsYouOrder(a: QueueRow, b: QueueRow): number {
  const u = urgency(a) - urgency(b);
  return u !== 0 ? u : byWait(a, b);
}

/** Soonest booking first. */
function movingForwardOrder(a: QueueRow, b: QueueRow): number {
  const x = a.scheduledAt ?? "";
  const y = b.scheduledAt ?? "";
  if (x && y && x !== y) return x < y ? -1 : 1;
  if (x !== y) return x ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export const QUEUE_ORDER = {
  needs_you: needsYouOrder,
  waiting: byWait,
  moving_forward: movingForwardOrder,
} as const;

export type AdmissionRoute = "intake" | "assessment" | "review";

export interface NextStep {
  label: string;
  route: AdmissionRoute;
}

/**
 * What the row's button says, from what has actually been done.
 *
 * "Start intake" and "Continue intake" are different promises: one opens a
 * blank form, the other picks up a half-finished call. The stage alone
 * cannot tell them apart; the saved intake can.
 */
export function nextStep(progress: {
  stage: AdmissionStage;
  intakeStarted: boolean;
  intakeComplete: boolean;
  assessmentStarted: boolean;
  assessmentComplete: boolean;
  packetSigned: boolean;
}): NextStep | null {
  const { stage } = progress;
  if (stage === "new_referral" || stage === "phone_intake") {
    if (progress.intakeComplete) return { label: "Open assessment", route: "assessment" };
    return progress.intakeStarted
      ? { label: "Continue intake", route: "intake" }
      : { label: "Start intake", route: "intake" };
  }
  if (stage === "assessment") {
    if (!progress.intakeComplete) {
      return progress.intakeStarted
        ? { label: "Continue intake", route: "intake" }
        : { label: "Start intake", route: "intake" };
    }
    if (!progress.assessmentComplete) {
      return progress.assessmentStarted
        ? { label: "Continue assessment", route: "assessment" }
        : { label: "Start assessment", route: "assessment" };
    }
    return progress.packetSigned
      ? { label: "Open assessment", route: "assessment" }
      : { label: "Review consents", route: "assessment" };
  }
  return null;
}

/** Where a record opens when nothing more specific is known. */
export function routeForStage(stage: AdmissionStage): AdmissionRoute | null {
  if (stage === "new_referral" || stage === "phone_intake") return "intake";
  if (stage === "assessment") return "assessment";
  if (stage === "pre_onboarding" || stage === "ready_for_admission" || stage === "admitted") return "review";
  return null;
}
