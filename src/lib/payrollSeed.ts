import type { TimeEntry, VisitStub } from "@/domain/payroll/hours";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Time entries for the payroll demo, derived from the visit board.
 *
 * Derived rather than written out, so the two cannot disagree. A hand-written
 * list of hours next to a hand-written list of visits drifts the first time
 * either changes, and payroll disagreeing with the schedule is exactly the bug
 * this module exists to catch.
 *
 * Three deliberate imperfections, because a payroll screen with nothing to
 * resolve demonstrates nothing: one caregiver still clocked in, one visit with
 * no time against it at all, and one clock-out with the visit note unfinished.
 */

function hoursAfter(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Caregiver display name to a stable person id. Demo only. */
export function personIdFor(name: string): string {
  return `p-${name.toLowerCase().replace(/[^a-z]/g, "")}`;
}

const past = seedVisits.filter((v) => new Date(v.startsAt) < new Date() && v.caregiverName);

export const seedTimeEntries: TimeEntry[] = past
  // The forgotten clock-in: one past visit gets no entry at all.
  .filter((_, i) => i !== 1)
  .map((visit, i) => {
  const worked = (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / 3_600_000;

  // The first past visit is left with no clock-out — somebody still on the
  // clock, which blocks the period.
  const stillIn = i === 0;
  // The last but one has a documentation gap, which does not block.
  const gap = i === Math.max(0, past.length - 3);

  return {
    id: `time-${visit.id}`,
    visitId: visit.id,
    caregiverPersonId: personIdFor(visit.caregiverName!),
    // Clocked in a minute late, which is what actually happens.
    clockedInAt: hoursAfter(visit.startsAt, 0),
    clockedOutAt: stillIn ? null : hoursAfter(visit.startsAt, worked),
    exceptionReason: gap ? "Clocked out with outstanding: Visit note complete" : null,
  };
});

// One visit deliberately has no entry at all — the forgotten clock-in.
export const seedPayrollVisits: VisitStub[] = past.map((v) => ({
  id: v.id,
  caregiverPersonId: personIdFor(v.caregiverName!),
  startsAt: v.startsAt,
  status: "completed",
}));

export const seedPayrollPeople = [
  ...new Set(seedVisits.filter((v) => v.caregiverName).map((v) => v.caregiverName!)),
].map((name) => ({ personId: personIdFor(name), name }));
