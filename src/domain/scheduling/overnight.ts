import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * Overnight shifts on a day-column board.
 *
 * A shift from 8 PM Saturday to 8 AM Sunday belongs to both days. The week
 * view draws it in its own band beneath the day columns, one lane per
 * overlapping shift, with a segment in each day it touches.
 */

export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function isOvernight(visit: Pick<Visit, "startsAt" | "endsAt">): boolean {
  const s = new Date(visit.startsAt);
  const e = new Date(visit.endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return localDate(e) > localDate(s);
}

export interface NightSegment {
  visitId: string;
  /** The day this segment sits in. */
  on: string;
  startsAt: string;
  endsAt: string;
  hours: number;
  /** Carried on from the day before. */
  continues: boolean;
  /** Carries on into the next day. */
  continuesNext: boolean;
}

export function nightSegments(visit: Visit): NightSegment[] {
  const s = new Date(visit.startsAt);
  const e = new Date(visit.endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
    return [{ visitId: visit.id, on: localDate(s), startsAt: visit.startsAt, endsAt: visit.endsAt, hours: 0, continues: false, continuesNext: false }];
  }
  const out: NightSegment[] = [];
  let cursor = new Date(s);
  for (let i = 0; i < 14 && cursor < e; i += 1) {
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const end = midnight < e ? midnight : e;
    out.push({
      visitId: visit.id,
      on: localDate(cursor),
      startsAt: localStamp(cursor),
      endsAt: localStamp(end),
      hours: Math.round(((end.getTime() - cursor.getTime()) / 3_600_000) * 100) / 100,
      continues: out.length > 0,
      continuesNext: false,
    });
    cursor = end;
  }
  for (let i = 0; i < out.length - 1; i += 1) out[i] = { ...out[i], continuesNext: true };
  return out;
}

export function segmentsOn(visits: readonly Visit[], date: string): NightSegment[] {
  const out: NightSegment[] = [];
  for (const v of visits) if (isOvernight(v)) for (const seg of nightSegments(v)) if (seg.on === date) out.push(seg);
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Lane index per overnight visit so overlapping nights never share a row. */
export function nightLanes(visits: readonly Visit[]): Map<string, number> {
  const nights = visits.filter(isOvernight).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const lanes: Array<Set<string>> = [];
  const out = new Map<string, number>();
  for (const v of nights) {
    const days = nightSegments(v).map((s) => s.on);
    let lane = 0;
    while (lanes[lane] && days.some((d) => lanes[lane].has(d))) lane += 1;
    if (!lanes[lane]) lanes[lane] = new Set();
    for (const d of days) lanes[lane].add(d);
    out.set(v.id, lane);
  }
  return out;
}

export function laneCount(lanes: Map<string, number>): number {
  let max = -1;
  for (const n of lanes.values()) if (n > max) max = n;
  return max + 1;
}

export function overnightBandLabel(count: number): string {
  return `Overnight · ${count} ${count === 1 ? "shift" : "shifts"}`;
}
