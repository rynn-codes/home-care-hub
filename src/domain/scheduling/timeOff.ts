import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * Time off.
 *
 * A caregiver asks for days off; the visits she was down for on those days
 * become open shifts that carry her name as `coverFor`, so the board says
 * "Needs cover · Glory O off" rather than pretending the shift was never
 * hers. Nothing is deleted: undo the request and she is back on the board.
 *
 * A family may say they do not want a replacement on one of those days. That
 * is a decision recorded against the visit (`CoverDecision`), not a deletion
 * — the shift stays on the board with the decision beside it.
 */

export interface TimeOff {
  id: string;
  caregiverName: string;
  /** Inclusive date-only bounds, YYYY-MM-DD. */
  from: string;
  to: string;
  reason: string | null;
  requestedAt: string;
  recordedBy: string;
}

export interface TimeOffDraft {
  caregiverName: string;
  from: string;
  to: string;
  reason: string;
}

export interface CoverDecision {
  visitId: string;
  confirmedWith: string;
  note: string | null;
  recordedBy: string;
  recordedAt: string;
}

/** Local date of an ISO stamp, YYYY-MM-DD. */
export function dateOnly(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function coversDate(off: Pick<TimeOff, "from" | "to">, dateOrIso: string): boolean {
  const day = dateOrIso.length === 10 ? dateOrIso : dateOnly(dateOrIso);
  return day >= off.from && day <= off.to;
}

export function timeOffFor(list: readonly TimeOff[], caregiverName: string, at: string): TimeOff | null {
  return list.find((o) => o.caregiverName === caregiverName && coversDate(o, at)) ?? null;
}

/**
 * The board with time off applied: a visit on an off day loses its caregiver
 * and remembers who it was for. Events (assessments, orientations) are the
 * RN's or the office's and are left alone.
 */
export function applyTimeOff<V extends Visit>(visits: readonly V[], timeOff: readonly TimeOff[]): Array<V & { coverFor?: string }> {
  if (timeOff.length === 0) return [...visits];
  return visits.map((v) => {
    if (!v.caregiverName || v.eventType) return v;
    return timeOffFor(timeOff, v.caregiverName, v.startsAt)
      ? { ...v, caregiverName: null, coverFor: v.caregiverName }
      : v;
  });
}

/** The visits a request would open up. */
export function visitsAffected(visits: readonly Visit[], draft: Pick<TimeOff, "caregiverName" | "from" | "to">): Visit[] {
  return visits.filter((v) => v.caregiverName === draft.caregiverName && !v.eventType && coversDate(draft, v.startsAt));
}

/** Whether the request touches the Saturday–Friday week starting `weekStart`. */
export function overlapsWeek(off: Pick<TimeOff, "from" | "to">, weekStart: Date): boolean {
  const from = dateOnly(new Date(weekStart).toISOString());
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const to = dateOnly(end.toISOString());
  return off.from <= to && off.to >= from;
}

/** "Mon" or "Mon–Wed". */
export function timeOffLabel(off: Pick<TimeOff, "from" | "to">): string {
  const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: "short" });
  return off.from === off.to ? day(off.from) : `${day(off.from)}–${day(off.to)}`;
}

export function validateTimeOff(draft: TimeOffDraft): string | null {
  if (!draft.caregiverName.trim()) return "Say who is asking for the time off.";
  if (!draft.from || !draft.to) return "A first day and a last day. One day is fine — use the same date twice.";
  if (draft.to < draft.from) return "The last day is before the first day.";
  return null;
}

export function coverDecisionFor(decisions: readonly CoverDecision[], visitId: string): CoverDecision | null {
  return decisions.find((d) => d.visitId === visitId) ?? null;
}

/** Open shifts created by time off that nobody has decided about yet. */
export function uncoveredShifts<V extends Visit & { coverFor?: string }>(visits: readonly V[], decisions: readonly CoverDecision[]): V[] {
  return visits.filter((v) => v.coverFor && !v.caregiverName && !coverDecisionFor(decisions, v.id));
}

/** Everyone off on a given day, alphabetical. */
export function offOnDate(list: readonly TimeOff[], date: string): TimeOff[] {
  return list.filter((o) => coversDate(o, date)).sort((a, b) => a.caregiverName.localeCompare(b.caregiverName));
}
