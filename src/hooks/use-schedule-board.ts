import { useCallback, useMemo } from "react";
import { useDemo } from "@/context/DemoDataProvider";
import { seedVisits } from "@/lib/schedulingSeed";
import { seededClock } from "@/lib/evvSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import { applyTimeOff } from "@/domain/scheduling/timeOff";
import { visitsFromCoverage } from "@/domain/scheduling/coverage";
import { expandAll, withoutSuperseded } from "@/domain/scheduling/clientSchedule";
import type { DemoScheduleEvent } from "@/lib/demoStore";

/**
 * THE ONE JOY SCHEDULE. Everything on the board comes through here: the
 * seeded week, shifts added by hand, events booked in Admissions and Quick
 * Add, approved coverage plans and the visits each recurring schedule
 * expands into — with assignments and time off applied last.
 */

export function eventToVisit(e: DemoScheduleEvent): Visit {
  const service =
    e.eventType === "rn_assessment"
      ? "RN Assessment"
      : e.eventType === "client_visit"
        ? `Client visit${e.address ? ` · ${e.address}` : ""}`
        : e.eventType === "orientation" || e.eventType === "field_orientation"
          ? `Orientation${e.address ? ` · ${e.address}` : ""}`
          : e.eventType === "supervisor_visit"
            ? "Supervisor visit"
            : "Office";
  return {
    id: e.id,
    clientName: e.clientName,
    service,
    caregiverName: e.assessorName,
    startsAt: e.startsAt,
    endsAt: new Date(new Date(e.startsAt).getTime() + e.durationMinutes * 60_000).toISOString(),
    eventType: e.eventType,
  };
}

export function useScheduleBoard(dayMoves: Record<string, string> = {}) {
  const { scheduleEvents, shifts, assignments, timeOff, coverageEvents, clientSchedules, clockEvents } = useDemo();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const visits = useMemo<Visit[]>(() => {
    const booked = scheduleEvents.map(eventToVisit);
    const coverage = coverageEvents.filter((c) => c.approvedAt && !c.cancelledAt).flatMap((c) => visitsFromCoverage(c));
    const recurring = expandAll(clientSchedules, today);
    const merged = withoutSuperseded([...seedVisits, ...shifts, ...booked, ...coverage, ...recurring], clientSchedules).map((v) => {
      let out = assignments[v.id] ? { ...v, caregiverName: assignments[v.id] } : v;
      if (dayMoves[out.id]) out = movedTo(out, new Date(dayMoves[out.id]));
      return out;
    });
    return applyTimeOff(merged, timeOff);
  }, [scheduleEvents, shifts, assignments, dayMoves, timeOff, coverageEvents, clientSchedules, today]);

  /** The clock on a visit: what somebody recorded in the app, else the seed. */
  const clockFor = useCallback(
    (visit: Pick<Visit, "id">) => {
      const recorded = clockEvents[visit.id];
      if (recorded?.inAt || recorded?.outAt) return { inAt: recorded.inAt ?? null, outAt: recorded.outAt ?? null };
      return seededClock(visit.id);
    },
    [clockEvents],
  );

  return { visits, clockFor, today };
}

/** Move a visit to another calendar day, keeping its time of day and length. */
export function movedTo(v: Visit, target: Date): Visit {
  const start = new Date(v.startsAt);
  const length = new Date(v.endsAt).getTime() - start.getTime();
  const s = new Date(target);
  s.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return { ...v, startsAt: s.toISOString(), endsAt: new Date(s.getTime() + length).toISOString() };
}
