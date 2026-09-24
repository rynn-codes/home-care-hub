import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * What a visit is doing right now, read from the schedule and the clock.
 *
 * Two layers: the clock state (has anybody clocked in or out) and the
 * visit status the board paints, which folds in assignment, conflicts and
 * how late the clock-in is against the agency's escalation setting.
 */

/** Hours after the scheduled end before a missing clock-out is a problem. */
export const CLOCK_OUT_GRACE_HOURS = 2;

export type ClockState = "complete" | "not_started" | "on_shift" | "missing_clock_out";

export function clockState(input: {
  clockedInAt: string | null;
  clockedOutAt: string | null;
  scheduledEndsAt: string;
  now: Date;
  graceHours?: number;
}): ClockState {
  if (input.clockedOutAt) return "complete";
  if (!input.clockedInAt) return "not_started";
  const end = new Date(input.scheduledEndsAt).getTime();
  if (Number.isNaN(end)) return "on_shift";
  const grace = (input.graceHours ?? CLOCK_OUT_GRACE_HOURS) * 3_600_000;
  return input.now.getTime() > end + grace ? "missing_clock_out" : "on_shift";
}

/** "(9:02 AM–1:05 PM)", "(9:02 AM – still on)", "(9:02 AM – no clock-out)". */
export function clockLine(input: { state: ClockState; inAt: string | null; outAt: string | null }): string | null {
  switch (input.state) {
    case "complete":
      return `(${input.inAt ?? "—"}–${input.outAt ?? "—"})`;
    case "on_shift":
      return `(${input.inAt ?? "—"} – still on)`;
    case "missing_clock_out":
      return `(${input.inAt ?? "—"} – no clock-out)`;
    case "not_started":
      return null;
  }
}

export type VisitStatus = "open" | "conflict" | "upcoming" | "due_in" | "missed_in" | "on_shift" | "no_clock_out" | "complete";

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  open: "Open shift",
  conflict: "Conflict",
  upcoming: "Scheduled",
  due_in: "Due to clock in",
  missed_in: "No clock-in",
  on_shift: "In progress",
  no_clock_out: "No clock-out",
  complete: "Completed",
};

export type Tone = "good" | "warn" | "bad" | "info" | "muted";

export const VISIT_STATUS_TONES: Record<VisitStatus, Tone> = {
  open: "warn",
  conflict: "bad",
  upcoming: "info",
  due_in: "info",
  missed_in: "bad",
  on_shift: "info",
  no_clock_out: "bad",
  complete: "good",
};

export const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-[#ECFDF3] text-[#027A48]",
  warn: "bg-[#FFFAEB] text-[#B54708]",
  bad: "bg-[#FDF3F3] text-[#98322C]",
  info: "bg-[#EEF0FE] text-primary",
  muted: "bg-[var(--wash)] text-[var(--ink-body)]",
};

export function visitStatus(input: {
  visit: Visit;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  hasConflict: boolean;
  missedAfterMinutes: number;
  now: Date;
  graceHours?: number;
}): VisitStatus {
  const { visit, clockedInAt, clockedOutAt, hasConflict, missedAfterMinutes, now } = input;
  if (clockedOutAt) return "complete";
  if (visit.caregiverName === null) return "open";
  if (hasConflict) return "conflict";
  if (clockedInAt) {
    return clockState({ clockedInAt, clockedOutAt, scheduledEndsAt: visit.endsAt, now, graceHours: input.graceHours ?? CLOCK_OUT_GRACE_HOURS }) === "missing_clock_out"
      ? "no_clock_out"
      : "on_shift";
  }
  const start = new Date(visit.startsAt).getTime();
  if (Number.isNaN(start)) return "upcoming";
  // Events — assessments, orientations — are not clocked, so past means done.
  if (visit.eventType !== undefined) return now.getTime() > start ? "complete" : "upcoming";
  if (now.getTime() > start + missedAfterMinutes * 60_000) return "missed_in";
  return now.getTime() >= start ? "due_in" : "upcoming";
}

export type EditStatus = "unassigned" | "upcoming" | "in_progress" | "needs_clock_out" | "missed_clock_in" | "complete";

export const EDIT_STATUS_LABELS: Record<EditStatus, string> = {
  unassigned: "Open — nobody assigned",
  upcoming: "Upcoming",
  in_progress: "In progress",
  needs_clock_out: "Needs a clock-out",
  missed_clock_in: "Nobody clocked in",
  complete: "Complete",
};

export const DEFAULT_MISSED_AFTER_MINUTES = 15;

export function editStatus(input: { visit: Visit; clockedInAt: string | null; clockedOutAt: string | null; now: Date; missedAfterMinutes?: number }): EditStatus {
  switch (
    visitStatus({
      visit: input.visit,
      clockedInAt: input.clockedInAt,
      clockedOutAt: input.clockedOutAt,
      hasConflict: false,
      missedAfterMinutes: input.missedAfterMinutes ?? DEFAULT_MISSED_AFTER_MINUTES,
      now: input.now,
    })
  ) {
    case "complete":
      return "complete";
    case "open":
      return "unassigned";
    case "no_clock_out":
      return "needs_clock_out";
    case "missed_in":
      return "missed_clock_in";
    case "on_shift":
      return "in_progress";
    default:
      return "upcoming";
  }
}

/** A visit that has been worked (clocked out, or its end has passed) cannot be edited forward. */
export function alreadyWorked(visit: Pick<Visit, "endsAt"> & { clockedOutAt?: string | null }, now: Date): boolean {
  if (visit.clockedOutAt) return true;
  const end = new Date(visit.endsAt);
  return !Number.isNaN(end.getTime()) && end <= now;
}

export type EditScope = "this" | "future" | "series";

export const SCOPE_LABELS: Record<EditScope, string> = {
  this: "This visit only",
  future: "This and future visits",
  series: "Entire series",
};

export const SCOPE_MEANINGS: Record<EditScope, string> = {
  this: "The rest of the series stays as scheduled",
  future: "Applies from this date forward",
  series: "Every upcoming visit in the recurrence",
};

/** The visits an edit at this scope touches — never one already worked. */
export function affectedByScope<V extends Visit & { seriesId?: string; clockedOutAt?: string | null }>(input: { visit: V; all: readonly V[]; scope: EditScope; now: Date }): V[] {
  const { visit, all, scope, now } = input;
  if (alreadyWorked(visit, now)) return [];
  if (scope === "this") return [visit];
  const series = visit.seriesId ?? null;
  if (!series) return [visit];
  const upcoming = all.filter((v) => v.seriesId === series && !alreadyWorked(v, now));
  return scope === "future"
    ? upcoming.filter((v) => v.startsAt >= visit.startsAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    : upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function affectedSummary(affected: readonly Visit[], fmtDay: (iso: string) => string): string {
  if (affected.length === 0) return "Nothing — this visit has already been worked.";
  if (affected.length === 1) return `1 visit · ${fmtDay(affected[0].startsAt)}`;
  return `${affected.length} visits · ${fmtDay(affected[0].startsAt)} through ${fmtDay(affected[affected.length - 1].startsAt)}`;
}

/** A stable, human-sized visit id for the sheet header (FNV-1a, nine digits). */
export function visitDisplayId(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    h >>>= 0;
  }
  return String((h >>> 0) % 900_000_000 + 100_000_000);
}
