import type { TimeEntry, VisitStub } from "@/domain/payroll/hours";
import type { Visit } from "@/domain/scheduling/conflicts";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Time entries for the payroll demo, derived from the visit board.
 *
 * Derived rather than written out, so the two cannot disagree. A hand-written
 * list of hours next to a hand-written list of visits drifts the first time
 * either changes, and payroll disagreeing with the schedule is exactly the bug
 * this module exists to catch.
 *
 * Payroll pays the week that just finished, so the standing week is moved
 * back seven days: every shift on the board becomes a clocked shift last
 * week. Four deliberate imperfections, because a payroll screen with nothing
 * to resolve demonstrates nothing: one caregiver still clocked in, one visit
 * with no time against it at all, one clock-out with the visit note
 * unfinished, and one shift that ran three hours long and tipped its
 * caregiver into overtime nobody approved.
 */

function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function weekEarlier(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 7);
  return stamp(d);
}

function hoursAfter(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return stamp(d);
}

/** Caregiver display name to a stable person id. Demo only. */
export function personIdFor(name: string): string {
  return `p-${name.toLowerCase().replace(/[^a-z]/g, "")}`;
}

const staffed = seedVisits.filter((v) => v.caregiverName);

/** The standing week as it was worked last week. */
export const seedPayrollShifts: Visit[] = staffed.map((v) => ({ ...v, startsAt: weekEarlier(v.startsAt), endsAt: weekEarlier(v.endsAt) }));

/** How long the long shift ran over. Enough to tip a full week into overtime. */
const OVERRUN_HOURS = 3;

const lastId = seedPayrollShifts[seedPayrollShifts.length - 1]?.id ?? null;
const overrunId = [...seedPayrollShifts].reverse().find((v) => v.caregiverName === "Vanessa J" && v.id !== lastId)?.id ?? null;

export const seedTimeEntries: TimeEntry[] = seedPayrollShifts
  // The forgotten clock-in: one visit gets no entry at all.
  .filter((_, i) => i !== 1)
  .map((visit, i) => {
    const worked = (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / 3_600_000;
    // The last but one is left with no clock-out — somebody still on the
    // clock, which blocks the period.
    const stillIn = i === seedPayrollShifts.length - 2;
    // The one before has a documentation gap, which does not block.
    const gap = i === Math.max(0, seedPayrollShifts.length - 3);
    const overrun = !stillIn && !gap && visit.id === overrunId ? OVERRUN_HOURS : 0;
    return {
      id: `time-${visit.id}`,
      visitId: visit.id,
      caregiverPersonId: personIdFor(visit.caregiverName!),
      clockedInAt: hoursAfter(visit.startsAt, 0),
      clockedOutAt: stillIn ? null : hoursAfter(visit.startsAt, worked + overrun),
      exceptionReason: gap ? "Clocked out with outstanding: Visit note complete" : null,
    };
  });

export const seedPayrollVisits: VisitStub[] = seedPayrollShifts.map((v) => ({
  id: v.id,
  caregiverPersonId: personIdFor(v.caregiverName!),
  startsAt: v.startsAt,
  status: "completed",
}));

export const seedPayrollPeople = [...new Set(seedVisits.filter((v) => v.caregiverName).map((v) => v.caregiverName!))].map((name) => ({ personId: personIdFor(name), name }));
