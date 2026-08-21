import { useMemo } from "react";
import { homeSignals, type HomeSignal } from "@/domain/home/signals";
import { useDemo } from "@/context/DemoDataProvider";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedApplicants } from "@/lib/hiringSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedPayrollPeople, seedPayrollVisits, seedTimeEntries } from "@/lib/payrollSeed";
import { seedMoments, seedPreferences, seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { seedIncidents } from "@/lib/incidentsSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";

/**
 * One place Home assembles its inputs.
 *
 * A hook rather than a call in each component, so the priority strip, the
 * greeting band and the payroll and billing panels are all looking at the same
 * computation. Three components each building their own would be three chances
 * to pass slightly different data and print slightly different numbers on one
 * screen.
 */
export function useHomeSignals(): HomeSignal[] {
  const { newHires } = useDemo();

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 13);

    // New hires shadow the seeded workforce, the same merge Operations does.
    const hiredIds = new Set(newHires.map((e) => e.id));
    const workforce = [
      ...(newHires as unknown as typeof seedEmployees),
      ...seedEmployees.filter((e) => !hiredIds.has(e.id)),
    ];

    return homeSignals({
      visits: seedVisits,
      carePlans: seedCarePlans,
      // Who Joy is actually serving, taken from the schedule — the same
      // derivation the Care plans screen uses, so the two agree by
      // construction rather than by both being maintained.
      servedClients: [
        ...new Map(
          seedVisits
            .filter((v) => v.clientPersonId)
            .map((v) => [v.clientPersonId!, { personId: v.clientPersonId!, name: v.clientName }]),
        ).values(),
      ],
      applicants: seedApplicants,
      workforce,
      requirements: seedCredentialRequirements,
      clients: [],
      billingTerms: seedBillingTerms,
      timeEntries: seedTimeEntries,
      payrollVisits: seedPayrollVisits,
      payrollPeople: seedPayrollPeople,
      moments: seedMoments,
      preferences: seedPreferences,
      invitations: [],
      documentRequests: seedRequestedDocuments,
      incidents: seedIncidents,
      nameFor: (id) => id.replace(/^p-/, "").replace(/^\w/, (c) => c.toUpperCase()),
      weekStart: monday.toISOString().slice(0, 10),
      payPeriod: { start: periodStart.toISOString().slice(0, 10), end: today },
      today,
    });
  }, [newHires]);
}
