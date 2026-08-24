import { describe, expect, it } from "vitest";
import { homeHeadline, homeSignals, type HomeSignalInput } from "@/domain/home/signals";
import { openShifts, type Visit } from "@/domain/scheduling/conflicts";
import { complianceAlerts } from "@/domain/credentials/alerts";
import { payrollRun } from "@/domain/payroll/hours";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedApplicants } from "@/lib/hiringSeed";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedPayrollPeople, seedPayrollVisits, seedTimeEntries } from "@/lib/payrollSeed";
import { seedIncidents } from "@/lib/incidentsSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedStartOfCare, seedSupervisoryVisits } from "@/lib/supervisionSeed";
import { carePlanQueue } from "@/domain/carePlan/plan";
import { classifyIncident, incidentFromVisit } from "@/domain/incidents/incidents";
import { supervisionQueue } from "@/domain/supervision/supervision";

const TODAY = "2026-08-20";

function build(over: Partial<HomeSignalInput> = {}) {
  return homeSignals({
    visits: seedVisits,
    applicants: seedApplicants,
    workforce: seedEmployees,
    requirements: seedCredentialRequirements,
    billingTerms: seedBillingTerms,
    timeEntries: seedTimeEntries,
    payrollVisits: seedPayrollVisits,
    payrollPeople: seedPayrollPeople,
    moments: [],
    preferences: [],
    invitations: [],
    documentRequests: [],
    incidents: seedIncidents,
    carePlans: seedCarePlans,
    supervisoryVisits: seedSupervisoryVisits,
    servedClients: [
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
    ],
    nameFor: (id: string) => id,
    weekStart: "2026-08-17",
    payPeriod: { start: "2026-08-07", end: TODAY },
    today: TODAY,
    ...over,
  });
}

function signal(key: string) {
  return build().find((s) => s.key === key)!;
}

describe("Home agrees with the modules", () => {
  // The property that matters. Home is where somebody forms their first
  // opinion of whether Joy can be trusted, and a strip disagreeing with the
  // module it links to is Joy contradicting itself in that exact place.

  it("counts the same open shifts Scheduling does", () => {
    const mine = openShifts(seedVisits).filter((v) => v.startsAt.slice(0, 10) >= TODAY);
    expect(signal("open-shifts").value).toBe(String(mine.length));
  });

  it("counts the same blocking credentials Operations does", () => {
    const blocking = complianceAlerts(seedEmployees, seedCredentialRequirements, TODAY).filter(
      (a) => a.severity === "blocking",
    );
    expect(signal("compliance").value).toBe(String(blocking.length));
  });

  it("reports the same payroll state the Payroll screen does", () => {
    const run = payrollRun({
      period: { start: "2026-08-07", end: TODAY },
      people: seedPayrollPeople,
      entries: seedTimeEntries,
      visits: seedPayrollVisits,
    });
    expect(signal("payroll").value).toBe(run.ready ? "Ready" : String(run.blockedBy.length));
  });

  it("counts the same open incidents the Incidents screen does", () => {
    const open = seedIncidents.filter((i) => i.state !== "closed");
    expect(signal("incidents").value).toBe(String(open.length));
  });

  it("counts the same care-plan work the Care plans screen does", () => {
    const served = [
      ...new Map(
        seedVisits
          .filter((v) => v.clientPersonId)
          .map((v) => [v.clientPersonId!, { personId: v.clientPersonId!, name: v.clientName }]),
      ).values(),
    ];
    const needing = carePlanQueue({ clients: served, plans: seedCarePlans, today: TODAY }).filter(
      (r) => r.needsYou,
    );
    expect(signal("care-plans").value).toBe(String(needing.length));
  });

  it("is only urgent about care plans when somebody has none", () => {
    // A revision waiting a day is work. Somebody being cared for with nothing
    // written down is a problem, and Home has to tell them apart.
    expect(signal("care-plans").urgent).toBe(true);
    expect(signal("care-plans").detail).toMatch(/no plan at all/);
  });

  it("counts the same supervisory visits the Supervision screen does", () => {
    // This signal used to read an input the live wiring passed as an empty
    // array, so it printed 0 whatever was true and linked to a screen that
    // could not have done anything about it.
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
    ].filter((c) => c.startOfCare);

    const due = supervisionQueue({
      clients: served,
      visits: seedSupervisoryVisits,
      today: TODAY,
    }).filter((r) => r.needsYou);

    expect(signal("supervision").value).toBe(String(due.length));
    expect(due.length).toBeGreaterThan(0);
  });

  it("links every signal to the screen that computed it", () => {
    // A figure with nowhere to go is a decoration.
    for (const s of build()) {
      expect(s.to).toMatch(/^\//);
    }
  });
});

describe("what counts as urgent", () => {
  it("does not treat orientation as a problem", () => {
    // Somebody progressing through onboarding is the system working.
    const calm = build({
      applicants: seedApplicants.map((a) => ({ ...a, stageSince: TODAY })),
    });
    expect(calm.find((s) => s.key === "hiring")?.urgent).toBe(false);
  });

  it("does treat a stalled applicant as one", () => {
    const stalled = build({
      applicants: seedApplicants.map((a) => ({ ...a, track: "hiring" as const, stageSince: "2026-07-01" })),
    });
    const hiring = stalled.find((s) => s.key === "hiring")!;
    expect(hiring.urgent).toBe(true);
    expect(hiring.detail).toContain("not moved in a week");
  });

  it("ignores an open shift that is already in the past", () => {
    // Last Tuesday's uncovered shift is a fact for a report, not something
    // anybody can act on this morning.
    const past: Visit[] = [
      {
        id: "old",
        clientName: "Someone",
        service: "Personal Care",
        caregiverName: null,
        startsAt: "2026-07-01T09:00:00",
        endsAt: "2026-07-01T13:00:00",
      },
    ];
    expect(build({ visits: past }).find((s) => s.key === "open-shifts")?.value).toBe("0");
  });

  it("puts an unpriced invoice ahead of an overdue one", () => {
    // Joy cannot chase a payment it has never asked for.
    const billing = signal("billing");
    expect(billing.detail).toBe("Invoice with no rate");
  });

  it("reads the portal queue from the same entries payroll did", () => {
    // The input carries time entries once. Passing them twice — as an earlier
    // version did — is two chances for Home to disagree with itself.
    //
    // An explicit clock-out exception rather than `seedTimeEntries`: the seed
    // is derived from the schedule board relative to the real clock, so before
    // Monday's first visit it holds no exception and this asserted nothing.
    // One deterministic entry keeps the test about the wiring, not the wall
    // clock.
    const withGap = build({
      timeEntries: [
        {
          id: "te-gap",
          visitId: "v-gap",
          caregiverPersonId: "p-chanelp",
          clockedInAt: `${TODAY}T09:00:00`,
          clockedOutAt: `${TODAY}T13:00:00`,
          exceptionReason: "Clocked out with the visit note outstanding",
        },
      ],
    });
    expect(withGap.find((s) => s.key === "portal")?.value).not.toBe("0");
    expect(build({ timeEntries: [] }).find((s) => s.key === "portal")?.value).toBe("0");
  });

  it("marks incidents urgent when a deadline has passed, not when one is merely open", () => {
    // Built against TODAY rather than read from the seed. `seedIncidents` is
    // relative to the real clock so the demo always looks live, and this test
    // pins TODAY — so it passed in the evening and failed the next morning when
    // the real time crossed the fixture's date. A test whose result depends on
    // when it runs is worse than no test: it teaches people to re-run the suite
    // until it goes green.
    const overdue = classifyIncident({
      incident: incidentFromVisit({
        id: "late",
        visitId: "v1",
        clientPersonId: "c-1",
        clientName: "Marcus Bell",
        reportedByPersonId: "p1",
        reportedByName: "Jamisha",
        narrative: "He stumbled in the hallway.",
        at: `${TODAY}T02:00:00Z`,
      }),
      kind: "fall",
      severity: "significant",
      byUserId: "u-karynn",
    });

    expect(build({ incidents: [overdue] }).find((s) => s.key === "incidents")!.urgent).toBe(true);

    const handled = build({
      incidents: [{ ...overdue, state: "closed" as const }],
    });
    const quiet = handled.find((s) => s.key === "incidents")!;
    expect(quiet.urgent).toBe(false);
    expect(quiet.detail).toBe("Nothing open");
  });

  it("says everything is fine when it is", () => {
    const quiet = build({
      visits: [],
      applicants: [],
      workforce: [],
      billingTerms: [],
      timeEntries: [],
      payrollVisits: [],
      payrollPeople: [],
      incidents: [],
      carePlans: [],
      supervisoryVisits: [],
      servedClients: [],
    });
    expect(quiet.every((s) => !s.urgent)).toBe(true);
  });
});

describe("homeHeadline", () => {
  const s = (label: string, urgent: boolean) => ({
    key: label,
    label,
    value: "1",
    to: "/",
    urgent,
  });

  it("names what needs doing rather than counting it", () => {
    // "Three things need you" is a number. "Open shifts and payroll need you"
    // is a morning somebody can start.
    expect(homeHeadline([s("Open shifts", true), s("Payroll", true)])).toBe(
      "open shifts and payroll need you.",
    );
  });

  it("reads properly for one and for many", () => {
    expect(homeHeadline([s("Payroll", true)])).toBe("payroll needs you.");
    expect(homeHeadline([s("A", true), s("B", true), s("C", true)])).toBe("a, b and c need you.");
  });

  it("stops naming things before the sentence stops being one", () => {
    // Home carried six signals when this was written and carries nine now.
    // Listing all nine is a list nobody reads to the end, which is the same
    // failure as the bare count this line was written to replace.
    const many = ["Incidents", "Care plans", "Open shifts", "Payroll", "Billing"].map((l) =>
      s(l, true),
    );
    expect(homeHeadline(many)).toBe(
      "incidents, care plans and open shifts need you, and 2 other things.",
    );
    expect(homeHeadline(many.slice(0, 4))).toBe(
      "incidents, care plans and open shifts need you, and 1 other thing.",
    );
  });

  it("says so plainly when nothing does", () => {
    expect(homeHeadline([s("Payroll", false)])).toBe("Nothing needs you this morning.");
  });
});
