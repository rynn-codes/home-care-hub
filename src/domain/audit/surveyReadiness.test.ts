import { describe, expect, it } from "vitest";
import { surveyReadiness, UNCOVERED, type SurveyReadinessInput } from "@/domain/audit/surveyReadiness";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedIncidents } from "@/lib/incidentsSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedStartOfCare, seedSupervisoryVisits } from "@/lib/supervisionSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedClients } from "@/lib/clientsSeed";
import { complianceAlerts } from "@/domain/credentials/alerts";
import { carePlanQueue } from "@/domain/carePlan/plan";

const TODAY = "2026-08-21";

const served = [
  ...new Map(
    seedVisits
      .filter((v) => v.clientPersonId)
      .map((v) => [
        v.clientPersonId!,
        {
          personId: v.clientPersonId!,
          name: v.clientName,
          startOfCare: seedStartOfCare[v.clientPersonId!] ?? "",
        },
      ]),
  ).values(),
];

function build(over: Partial<SurveyReadinessInput> = {}) {
  return surveyReadiness({
    today: TODAY,
    workforce: seedEmployees,
    requirements: seedCredentialRequirements,
    incidents: seedIncidents,
    carePlans: seedCarePlans,
    servedClients: served,
    supervisoryVisits: seedSupervisoryVisits,
    clients: seedClients,
    ...over,
  });
}

describe("audit readiness agrees with the modules", () => {
  // The property that matters most here. A readiness screen that flatters is
  // worse than no readiness screen: somebody reads it, believes it, and stops
  // looking.

  it("counts the same blocking personnel gaps Operations does", () => {
    const blocking = complianceAlerts(seedEmployees, seedCredentialRequirements, TODAY).filter(
      (a) => a.severity === "blocking",
    );
    const line = build().lines.find((l) => l.key === "personnel")!;
    expect(line.gaps).toEqual([...new Set(blocking.map((a) => a.employeeName))]);
  });

  it("names the same unplanned clients the Care plans screen does", () => {
    const unplanned = carePlanQueue({ clients: served, plans: seedCarePlans, today: TODAY })
      .filter((r) => r.reason === "no_plan")
      .map((r) => r.clientName);
    const line = build().lines.find((l) => l.key === "care_plans")!;
    for (const name of unplanned) {
      expect(line.gaps.some((g) => g.startsWith(name))).toBe(true);
    }
  });

  it("sends every line somewhere somebody can act", () => {
    // A finding with nowhere to go is a complaint.
    for (const line of build().lines) expect(line.to).toMatch(/^\//);
  });
});

describe("what it refuses to claim", () => {
  it("does not call the audit trail ready, because nothing persists it", () => {
    // The writer and its rules exist and are tested; the store is in memory.
    // Calling that ready would be the worst line on the screen.
    const line = build().lines.find((l) => l.key === "audit_trail")!;
    expect(line.state).toBe("not_held");
    expect(line.answer).toContain("in-memory");
  });

  it("names what a surveyor asks about that Joy holds nothing on", () => {
    // The omissions are what make a green screen misleading, not the amber rows.
    expect(UNCOVERED.length).toBeGreaterThan(0);
    expect(UNCOVERED.some((u) => /disaster|emergency/i.test(u))).toBe(true);
  });

  it("says how many would not survive a question, rather than a score", () => {
    const readiness = build();
    expect(readiness.withGaps).toBeGreaterThan(0);
    expect(readiness.headline).toContain("would not survive a question");
  });

  it("does not congratulate an empty year of incidents by accident", () => {
    // No incidents reported is genuinely nothing to show, and that is "ready" —
    // but it must read as "nothing reported", not as "every obligation met".
    const line = build({ incidents: [] }).lines.find((l) => l.key === "incidents")!;
    expect(line.state).toBe("ready");
    expect(line.answer).toContain("Nothing reported");
    expect(line.answer).not.toContain("obligation");
  });
});

describe("when everything is in order", () => {
  it("says so, and still does not claim the trail is held", () => {
    const clean = build({
      workforce: [],
      incidents: [],
      servedClients: [],
      carePlans: [],
      supervisoryVisits: [],
      clients: [],
    });
    expect(clean.lines.filter((l) => l.state === "gaps")).toEqual([]);
    // One line is permanently honest until somebody writes the Postgres store.
    expect(clean.withGaps).toBe(1);
  });
});
