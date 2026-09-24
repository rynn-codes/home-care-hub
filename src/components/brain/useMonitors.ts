import { useEffect, useMemo, useRef } from "react";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { buildClientRoster } from "@/lib/clientRoster";
import { seedClients } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedEvvRecords, seedEvvVisits } from "@/lib/evvSeed";
import { loadMemory, MONITORS, runMonitors, saveMemory, type Finding } from "@/domain/monitors";

/**
 * One run of every monitor over the records the screens already show.
 *
 * Memoised on the state the monitors read, so a finding is computed once per
 * change and Home, The Brain and the header all see the same list. The
 * memory of first-seen dates is written back after each run.
 */
export function useMonitors(): { findings: Finding[]; ranAt: string } {
  const { people, admissions, consentSessions, intakes, assignments, clockAttempts, approvedLocations, clientSchedules, visitExpenses } = useDemo();
  const agency = useAgencySettings();
  const today = new Date().toISOString().slice(0, 10);
  const memory = useRef(loadMemory());

  const run = useMemo(() => {
    const visits = seedVisits.map((v) => (assignments[v.id] ? { ...v, caregiverName: assignments[v.id] } : v));
    const inputs = {
      clients: buildClientRoster({ people, admissions, consentSessions }),
      admissions: admissions.map((a) => ({
        id: a.id,
        name: a.name,
        stage: a.stage,
        status: a.status,
        overdue: a.overdue,
        waitingSince: a.waitingSince,
        answers: intakes[a.id]?.answers,
      })),
      visits,
      evvRecords: seedEvvRecords,
      evvVisits: seedEvvVisits,
      clockAttempts,
      approvedLocations,
      clientSchedules,
      visitExpenses,
      mileageRatePerMile: agency.mileageRatePerMile,
      clientNames: Object.fromEntries(seedClients.map((c) => [c.personId, `${c.firstName} ${c.lastName}`])),
      today,
      now: new Date(`${today}T12:00:00`),
    };
    return runMonitors(MONITORS, inputs, memory.current, `${today}T00:00:00.000Z`);
  }, [people, admissions, consentSessions, intakes, assignments, clockAttempts, approvedLocations, clientSchedules, visitExpenses, agency.mileageRatePerMile, today]);

  useEffect(() => {
    memory.current = run.memory;
    saveMemory(run.memory);
  }, [run.memory]);

  return { findings: run.findings, ranAt: run.ranAt };
}
