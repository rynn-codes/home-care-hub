import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * What changed on a visit, by whom and why — the sheet's history.
 */

export type VisitChangeKind =
  | "scheduled"
  | "time_moved"
  | "day_moved"
  | "reassigned"
  | "unassigned"
  | "services_changed"
  | "rate_changed"
  | "clock_corrected"
  | "cancelled";

export interface VisitChange {
  visitId: string;
  kind: VisitChangeKind;
  at: string;
  by: string;
  why?: string | null;
  from?: string | null;
  to?: string | null;
}

function shiftLabel(from: string, to: string): string {
  const minutes = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  if (minutes === 0) return "no change";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`} ${minutes < 0 ? "earlier" : "later"}`;
}

export function changeText(c: VisitChange, fmtTime: (iso: string) => string): string {
  const who = [c.by, c.why].filter(Boolean).join(", ");
  const tail = who ? ` · ${who}` : "";
  switch (c.kind) {
    case "scheduled":
      return c.why ?? "Visit scheduled";
    case "time_moved":
      return c.from && c.to ? `Start moved ${shiftLabel(c.from, c.to)} — ${fmtTime(c.from)} to ${fmtTime(c.to)}${tail}` : `Time changed${tail}`;
    case "day_moved":
      return c.from && c.to ? `Moved from ${c.from} to ${c.to}${tail}` : `Day changed${tail}`;
    case "reassigned":
      return c.from ? `Reassigned from ${c.from} to ${c.to}${tail}` : `Assigned to ${c.to}${tail}`;
    case "unassigned":
      return `${c.from} taken off this visit${tail}`;
    case "services_changed":
      return `Plan of care changed for this visit${tail}`;
    case "rate_changed":
      return `Rate changed from ${c.from} to ${c.to}${tail}`;
    case "clock_corrected":
      return `Clock corrected${tail}`;
    case "cancelled":
      return `Visit cancelled${tail}`;
  }
}

/** The implicit first line for a visit that came from a recurring schedule. */
export function seriesOrigin(visit: Visit & { seriesId?: string }): VisitChange | null {
  return visit.seriesId ? { visitId: visit.id, kind: "scheduled", at: visit.startsAt, by: "", why: "Visit scheduled from the weekly series" } : null;
}

export function newestFirst(changes: readonly VisitChange[]): VisitChange[] {
  return [...changes].sort((a, b) => b.at.localeCompare(a.at));
}
