import { OVERTIME_THRESHOLD_HOURS, type Visit } from "@/domain/scheduling/conflicts";
import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { assessAssignment, type AssignmentContext, type Candidate } from "@/domain/scheduling/assignment";
import { hoursOf } from "@/domain/scheduling/conflicts";

/**
 * Continuous coverage — a 24-hour respite, a week of round-the-clock care
 * after a hospital stay — planned as one event and worked as many shifts.
 *
 * The builder cuts the window into shifts, Joy proposes who takes each one,
 * and a person approves the plan. Overtime is projected per caregiver per
 * Saturday–Friday week and never silently accepted: it needs an approval
 * against a name, a week and a number of hours before the plan can be
 * finalised. Family or hospice may cover part of the window; those shifts
 * are marked not-covered rather than left looking open.
 */

export const COVERAGE_TYPES = ["24-Hour Respite", "Temporary Extended Coverage", "Other Continuous Coverage"] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

/** Continuity may carry up to this much OT for a caregiver the client knows. */
export const CONTINUITY_OT_ALLOWANCE = 4;

export type NotCoveredBy = "family" | "hospice" | "client_declined" | "other";
export const NOT_COVERED_LABELS: Record<NotCoveredBy, string> = {
  family: "Family covers it",
  hospice: "Hospice or another agency covers it",
  client_declined: "Client declined the hours",
  other: "Not covered by Joy — other",
};
export const NOT_COVERED_SHORT: Record<NotCoveredBy, string> = {
  family: "Family",
  hospice: "Hospice / agency",
  client_declined: "Declined",
  other: "Not Joy",
};

export interface CoverageShift {
  id: string;
  coverageEventId: string;
  startsAt: string;
  endsAt: string;
  caregiverName: string | null;
  /** A person chose this caregiver; auto-assign leaves it alone. */
  pinned: boolean;
  projectedWeekHours: number;
  projectedOtHours: number;
  notCovered?: { by: NotCoveredBy | "other_agency"; note: string };
  /** Legacy flag from the first builder. Read through `notCoveredOf`. */
  familyCovers?: boolean;
}

export type CoveragePriority = "continuity" | "fewest_caregivers" | "spread_hours";
export type PoolMode = "everyone" | "selected_only";
export type PreferenceState = "required" | "preferred" | "excluded";

export interface CoveragePreference {
  caregiverName: string;
  state: PreferenceState;
}

export interface OvertimeApproval {
  caregiverName: string;
  /** Saturday that starts the week. */
  weekStart: string;
  hours: number;
  approvedBy: string;
  approvedAt: string;
  reason: string;
}

export interface CoverageEvent {
  id: string;
  clientName: string;
  clientPersonId: string | null;
  coverageType: CoverageType;
  startsAt: string;
  endsAt: string;
  shiftLengthHours: number;
  dayShiftStart: string | null;
  priority: CoveragePriority;
  poolMode: PoolMode;
  preferences: CoveragePreference[];
  shifts: CoverageShift[];
  overtimeApprovals: OvertimeApproval[];
  note: string;
  createdBy: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  cancelledAt: string | null;
}

export type CoverageState = "draft" | "partially_covered" | "fully_covered" | "needs_attention" | "completed" | "cancelled";
export const COVERAGE_STATE_LABELS: Record<CoverageState, string> = {
  draft: "Draft",
  partially_covered: "Partially covered",
  fully_covered: "Fully covered",
  needs_attention: "Needs attention",
  completed: "Completed",
  cancelled: "Cancelled",
};

const HOUR = 3_600_000;

export function notCoveredOf(shift: CoverageShift): { by: NotCoveredBy; note: string } | null {
  if (shift.notCovered) {
    return { by: shift.notCovered.by === "other_agency" ? "hospice" : shift.notCovered.by, note: shift.notCovered.note };
  }
  if (shift.familyCovers) return { by: "family", note: "" };
  return null;
}

export function hoursBetween(from: string, to: string): number {
  return Math.round(((new Date(to).getTime() - new Date(from).getTime()) / HOUR) * 100) / 100;
}

/** Cut the window into shifts of `shiftLengthHours`, aligned to a day-shift start when given. */
export function buildShifts(input: {
  eventId: string;
  startsAt: string;
  endsAt: string;
  shiftLengthHours: number;
  dayShiftStart?: string | null;
}): CoverageShift[] {
  const length = Math.max(1, input.shiftLengthHours);
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (!(end.getTime() > start.getTime())) return [];
  const shifts: CoverageShift[] = [];
  let cursor = new Date(start);
  let n = 1;
  let firstBoundary: Date | null = null;
  if (input.dayShiftStart) {
    const [h, m] = input.dayShiftStart.split(":").map(Number);
    const boundary = new Date(start);
    boundary.setHours(h, m ?? 0, 0, 0);
    while (boundary.getTime() <= start.getTime()) boundary.setTime(boundary.getTime() + length * HOUR);
    if (boundary.getTime() < end.getTime()) firstBoundary = boundary;
  }
  while (cursor.getTime() < end.getTime()) {
    let next = firstBoundary && shifts.length === 0 ? firstBoundary : new Date(cursor.getTime() + length * HOUR);
    if (next.getTime() > end.getTime()) next = new Date(end);
    shifts.push({
      id: `${input.eventId}-s${n}`,
      coverageEventId: input.eventId,
      startsAt: cursor.toISOString(),
      endsAt: next.toISOString(),
      caregiverName: null,
      pinned: false,
      projectedWeekHours: 0,
      projectedOtHours: 0,
    });
    cursor = next;
    n += 1;
  }
  return shifts;
}

/** Hours already on the board, keyed `name|weekStart`. */
export function existingWeeklyHours(visits: readonly Visit[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of visits) {
    if (!v.caregiverName) continue;
    const key = weekKey(v.caregiverName, v.startsAt);
    out[key] = (out[key] ?? 0) + hoursOf(v);
  }
  return out;
}

export function weekKey(caregiverName: string, at: string): string {
  return `${caregiverName}|${agencyWeekStart(at.slice(0, 10))}`;
}

/** A caregiver's week if she takes this shift, counting the board and the plan's other shifts. */
export function projectedWeekHours(input: {
  caregiverName: string;
  shift: Pick<CoverageShift, "startsAt" | "endsAt">;
  existingWeekly: Record<string, number>;
  assigned: readonly CoverageShift[];
  excludeShiftId?: string;
}): number {
  const key = weekKey(input.caregiverName, input.shift.startsAt);
  const inPlan = input.assigned
    .filter((s) => s.id !== input.excludeShiftId && s.caregiverName === input.caregiverName && weekKey(s.caregiverName, s.startsAt) === key)
    .reduce((sum, s) => sum + hoursBetween(s.startsAt, s.endsAt), 0);
  return (input.existingWeekly[key] ?? 0) + inPlan + hoursBetween(input.shift.startsAt, input.shift.endsAt);
}

export function overtimeOf(hours: number, threshold = OVERTIME_THRESHOLD_HOURS): number {
  return hours > threshold ? Math.round((hours - threshold) * 100) / 100 : 0;
}

export function overtimeApproved(approvals: readonly OvertimeApproval[], caregiverName: string, at: string, hours: number): boolean {
  const week = agencyWeekStart(at.slice(0, 10));
  return approvals.some((a) => a.caregiverName === caregiverName && a.weekStart === week && a.hours >= hours);
}

export interface CoverageCandidate {
  candidate: Candidate;
  previousShiftsWithClient: number;
}

export interface RankedForShift {
  caregiverName: string;
  blocked: boolean;
  blockedReason: string | null;
  projectedHours: number;
  overtimeHours: number;
  overtimeApproved: boolean;
  previousShiftsWithClient: number;
  preference: PreferenceState | null;
  score: number;
}

function continuityAllows(priority: CoveragePriority, r: { previousShiftsWithClient: number; overtimeHours: number }): boolean {
  return priority === "continuity" && r.previousShiftsWithClient > 0 && r.overtimeHours > 0 && r.overtimeHours <= CONTINUITY_OT_ALLOWANCE;
}

/** Everyone, best first, for one shift. Lower score wins. */
export function rankForShift(
  people: readonly CoverageCandidate[],
  input: {
    shift: CoverageShift;
    ctx: Omit<AssignmentContext, "visit">;
    visitTemplate: Visit;
    preferences: readonly CoveragePreference[];
    approvals: readonly OvertimeApproval[];
    existingWeekly: Record<string, number>;
    assigned: readonly CoverageShift[];
    poolMode: PoolMode;
    priority: CoveragePriority;
    threshold?: number;
  },
): RankedForShift[] {
  const threshold = input.threshold ?? OVERTIME_THRESHOLD_HOURS;
  const visit: Visit = { ...input.visitTemplate, id: input.shift.id ?? input.visitTemplate.id, startsAt: input.shift.startsAt, endsAt: input.shift.endsAt };
  return people
    .map((p) => {
      const pref = input.preferences.find((x) => x.caregiverName === p.candidate.name)?.state ?? null;
      const projected = projectedWeekHours({
        caregiverName: p.candidate.name,
        shift: input.shift,
        existingWeekly: input.existingWeekly,
        assigned: input.assigned,
        excludeShiftId: input.shift.id,
      });
      const ot = overtimeOf(projected, threshold);
      const approved = ot > 0 && overtimeApproved(input.approvals, p.candidate.name, input.shift.startsAt, ot);
      let reason =
        assessAssignment({ ...p.candidate, weeklyHours: projected - hoursBetween(input.shift.startsAt, input.shift.endsAt) }, { ...input.ctx, visit })
          .blocking[0]?.message ?? null;
      if (pref === "excluded") reason = `${p.candidate.name} is set to Do not use on this coverage`;
      if (input.poolMode === "selected_only" && !pref) reason = reason ?? `${p.candidate.name} is not one of the selected caregivers`;
      let score = 0;
      const continuity = input.priority === "continuity" && p.previousShiftsWithClient > 0 && ot > 0 && ot <= CONTINUITY_OT_ALLOWANCE;
      if (ot > 0 && !approved) score += continuity ? 400 : 10_000;
      if (pref !== "required") score += 1000;
      if (p.previousShiftsWithClient === 0) score += 500;
      if (pref !== "preferred") score += 250;
      if ((input.priority === "continuity" || input.priority === "fewest_caregivers") && !input.assigned.some((s) => s.caregiverName === p.candidate.name)) score += 120;
      score += Math.max(0, projected) / 10;
      score -= Math.min(p.previousShiftsWithClient, 20) / 10;
      return {
        caregiverName: p.candidate.name,
        blocked: !!reason,
        blockedReason: reason,
        projectedHours: Math.round(projected * 100) / 100,
        overtimeHours: ot,
        overtimeApproved: approved,
        previousShiftsWithClient: p.previousShiftsWithClient,
        preference: pref,
        score,
      };
    })
    .sort((a, b) => (a.blocked !== b.blocked ? (a.blocked ? 1 : -1) : a.score !== b.score ? a.score - b.score : a.caregiverName.localeCompare(b.caregiverName)));
}

/** Joy's proposal: fill every unpinned, covered shift with the best unblocked candidate. */
export function autoAssign(input: {
  shifts: readonly CoverageShift[];
  people: readonly CoverageCandidate[];
  ctx: Omit<AssignmentContext, "visit">;
  visitTemplate: Visit;
  preferences: readonly CoveragePreference[];
  approvals: readonly OvertimeApproval[];
  existingWeekly: Record<string, number>;
  poolMode: PoolMode;
  priority: CoveragePriority;
  threshold?: number;
}): { shifts: CoverageShift[]; considered: Record<string, RankedForShift[]> } {
  const threshold = input.threshold ?? OVERTIME_THRESHOLD_HOURS;
  const ordered = [...input.shifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const considered: Record<string, RankedForShift[]> = {};
  const shifts = ordered.map((s) =>
    (s.pinned && s.caregiverName) || notCoveredOf(s) ? { ...s } : { ...s, caregiverName: null, projectedWeekHours: 0, projectedOtHours: 0 },
  );
  const assigned = () => shifts.filter((s) => s.caregiverName);
  for (const shift of shifts) {
    if (notCoveredOf(shift)) continue;
    if (shift.pinned && shift.caregiverName) {
      const hrs = projectedWeekHours({ caregiverName: shift.caregiverName, shift, existingWeekly: input.existingWeekly, assigned: assigned(), excludeShiftId: shift.id });
      shift.projectedWeekHours = Math.round(hrs * 100) / 100;
      shift.projectedOtHours = overtimeOf(hrs, threshold);
      continue;
    }
    const ranked = rankForShift(input.people, {
      shift,
      ctx: input.ctx,
      visitTemplate: input.visitTemplate,
      preferences: input.preferences,
      approvals: input.approvals,
      existingWeekly: input.existingWeekly,
      assigned: assigned(),
      poolMode: input.poolMode,
      priority: input.priority,
      threshold,
    });
    considered[shift.id] = ranked;
    const pick = ranked.find((r) => !r.blocked && (r.overtimeHours === 0 || r.overtimeApproved || continuityAllows(input.priority, r)));
    if (pick) {
      shift.caregiverName = pick.caregiverName;
      shift.projectedWeekHours = pick.projectedHours;
      shift.projectedOtHours = pick.overtimeApproved || continuityAllows(input.priority, pick) ? pick.overtimeHours : 0;
    }
  }
  return { shifts, considered };
}

export interface CoverageSummary {
  requiredHours: number;
  coveredHours: number;
  openHours: number;
  openShifts: number;
  projectedOtHours: number;
  caregiverCount: number;
  percentComplete: number;
  notCoveredShifts: number;
  notCoveredHours: number;
  notCoveredBy: Partial<Record<NotCoveredBy, number>>;
}

export function coverageSummary(shifts: readonly CoverageShift[]): CoverageSummary {
  const notCovered = shifts.filter((s) => notCoveredOf(s));
  const joys = shifts.filter((s) => !notCoveredOf(s));
  const required = joys.reduce((sum, s) => sum + hoursBetween(s.startsAt, s.endsAt), 0);
  const covered = joys.filter((s) => s.caregiverName).reduce((sum, s) => sum + hoursBetween(s.startsAt, s.endsAt), 0);
  const open = joys.filter((s) => !s.caregiverName);
  const names = new Set(joys.map((s) => s.caregiverName).filter(Boolean));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    requiredHours: r2(required),
    coveredHours: r2(covered),
    openHours: r2(required - covered),
    openShifts: open.length,
    projectedOtHours: r2(joys.reduce((sum, s) => sum + s.projectedOtHours, 0)),
    caregiverCount: names.size,
    percentComplete: required > 0 ? Math.round((covered / required) * 100) : 0,
    notCoveredShifts: notCovered.length,
    notCoveredHours: r2(notCovered.reduce((sum, s) => sum + hoursBetween(s.startsAt, s.endsAt), 0)),
    notCoveredBy: notCovered.reduce<Partial<Record<NotCoveredBy, number>>>((acc, s) => {
      const by = notCoveredOf(s)!.by;
      acc[by] = (acc[by] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function markNotCovered(shift: CoverageShift, by: NotCoveredBy | null, note = ""): CoverageShift {
  const { familyCovers: _legacy, ...rest } = shift;
  void _legacy;
  return by
    ? { ...rest, notCovered: { by, note }, caregiverName: null, pinned: false, projectedWeekHours: 0, projectedOtHours: 0 }
    : { ...rest, notCovered: undefined };
}

/** Split one shift at a moment strictly inside it. */
export function splitShift(shift: CoverageShift, at: string): [CoverageShift, CoverageShift] | null {
  const t = new Date(at).getTime();
  if (!(t > new Date(shift.startsAt).getTime() && t < new Date(shift.endsAt).getTime())) return null;
  const base = { ...shift, pinned: !!shift.caregiverName, projectedWeekHours: 0, projectedOtHours: 0 };
  return [
    { ...base, id: `${shift.id}-a`, endsAt: at },
    { ...base, id: `${shift.id}-b`, startsAt: at },
  ];
}

export function addCustomShift(event: CoverageEvent, times: { startsAt: string; endsAt: string }): { shift: CoverageShift } | { problem: string } {
  const s = new Date(times.startsAt).getTime();
  const e = new Date(times.endsAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return { problem: "Pick a start and an end." };
  if (e <= s) return { problem: "The end has to be after the start." };
  if (s < new Date(event.startsAt).getTime() || e > new Date(event.endsAt).getTime()) {
    return { problem: "That is outside the coverage window. Change the window in step 1 first." };
  }
  const n = event.shifts.filter((x) => x.id.includes("-custom-")).length + 1;
  return {
    shift: {
      id: `${event.id}-custom-${n}`,
      coverageEventId: event.id,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      caregiverName: null,
      pinned: false,
      projectedWeekHours: 0,
      projectedOtHours: 0,
    },
  };
}

export function retimeShift(event: CoverageEvent, shift: CoverageShift, times: { startsAt: string; endsAt: string }): { shift: CoverageShift } | { problem: string } {
  const s = new Date(times.startsAt).getTime();
  const e = new Date(times.endsAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return { problem: "Pick a start and an end." };
  if (e <= s) return { problem: "The end has to be after the start." };
  if (s < new Date(event.startsAt).getTime() || e > new Date(event.endsAt).getTime()) {
    return { problem: "That is outside the coverage window. Change the window in step 1 first." };
  }
  return { shift: { ...shift, startsAt: times.startsAt, endsAt: times.endsAt } };
}

/** Hours of the window no shift touches. */
export function uncoveredHours(event: Pick<CoverageEvent, "startsAt" | "endsAt">, shifts: readonly CoverageShift[]): number {
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  const spans = shifts
    .map((s) => [Math.max(start, new Date(s.startsAt).getTime()), Math.min(end, new Date(s.endsAt).getTime())] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = start;
  for (const [a, b] of spans) {
    if (b <= cursor) continue;
    covered += b - Math.max(a, cursor);
    cursor = b;
  }
  return Math.round(((end - start - covered) / HOUR) * 100) / 100;
}

export function recomputeProjections(shifts: readonly CoverageShift[], existingWeekly: Record<string, number>, threshold = OVERTIME_THRESHOLD_HOURS): CoverageShift[] {
  return shifts.map((s) => {
    if (!s.caregiverName) return { ...s, projectedWeekHours: 0, projectedOtHours: 0 };
    const hrs = projectedWeekHours({
      caregiverName: s.caregiverName,
      shift: s,
      existingWeekly,
      assigned: shifts.filter((x) => x.id !== s.id && x.caregiverName),
      excludeShiftId: s.id,
    });
    return { ...s, projectedWeekHours: Math.round(hrs * 100) / 100, projectedOtHours: overtimeOf(hrs, threshold) };
  });
}

export function coverageState(event: CoverageEvent, nowIso: string): CoverageState {
  if (event.cancelledAt) return "cancelled";
  if (!event.approvedAt) return "draft";
  if (new Date(event.endsAt).getTime() <= new Date(nowIso).getTime()) return "completed";
  if (coverageSummary(event.shifts).openShifts === 0) return "fully_covered";
  const soon = new Date(nowIso).getTime() + 48 * HOUR;
  return event.shifts.some((s) => !s.caregiverName && !notCoveredOf(s) && new Date(s.startsAt).getTime() <= soon) ? "needs_attention" : "partially_covered";
}

/** The plan's shifts as visits on the board. */
export function visitsFromCoverage(event: CoverageEvent): Array<Visit & { coverageEventId: string }> {
  return event.shifts
    .filter((s) => !notCoveredOf(s))
    .map((s) => ({
      id: s.id,
      clientName: event.clientName,
      clientPersonId: event.clientPersonId ?? undefined,
      service: event.coverageType,
      caregiverName: s.caregiverName,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      coverageEventId: event.id,
    }));
}

export function whyNotApprovable(event: CoverageEvent): string | null {
  if (event.shifts.length === 0) return "Build the coverage plan first.";
  if (event.approvedAt) return "This plan is already approved.";
  const unapproved = event.shifts.filter(
    (s) => s.caregiverName && s.projectedOtHours > 0 && !overtimeApproved(event.overtimeApprovals, s.caregiverName, s.startsAt, s.projectedOtHours),
  );
  return unapproved.length > 0 ? `${unapproved[0].caregiverName}'s overtime needs approving before this plan can be finalised.` : null;
}

export function validateCoverageDraft(draft: Pick<CoverageEvent, "clientName" | "startsAt" | "endsAt" | "shiftLengthHours">): string | null {
  if (!draft.clientName.trim()) return "Choose the client.";
  if (!draft.startsAt || !draft.endsAt) return "Set when the coverage begins and ends.";
  if (new Date(draft.endsAt).getTime() <= new Date(draft.startsAt).getTime()) return "The coverage has to end after it begins.";
  if (draft.shiftLengthHours < 1 || draft.shiftLengthHours > 24) return "A shift is between 1 and 24 hours.";
  if (hoursBetween(draft.startsAt, draft.endsAt) > 24 * 31) return "That window is longer than a month. Build it in pieces.";
  return null;
}

export function unassignShift(event: CoverageEvent, shiftId: string): CoverageEvent {
  return {
    ...event,
    shifts: event.shifts.map((s) => (s.id === shiftId ? { ...s, caregiverName: null, pinned: false, projectedWeekHours: 0, projectedOtHours: 0 } : s)),
  };
}

export function shiftsByWeek(shifts: readonly CoverageShift[]): Array<{ weekStart: string; shifts: CoverageShift[] }> {
  const map = new Map<string, CoverageShift[]>();
  for (const s of [...shifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const week = agencyWeekStart(s.startsAt.slice(0, 10));
    map.set(week, [...(map.get(week) ?? []), s]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([weekStart, list]) => ({ weekStart, shifts: list }));
}
