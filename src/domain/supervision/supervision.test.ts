import { describe, expect, it } from "vitest";
import {
  bookSupervisoryVisit,
  completeSupervisoryVisit,
  completionRefusals,
  supervisionHeadline,
  supervisionQueue,
  supervisionStatus,
  type SupervisoryVisit,
} from "@/domain/supervision/supervision";
import {
  activatePlan,
  carePlanFromAssessment,
  reviewDueOn,
  reviewPlan,
  type CarePlan,
} from "@/domain/carePlan/plan";

const RN = "u-karynn";
const TODAY = "2026-08-21";

function status(over: Partial<Parameters<typeof supervisionStatus>[0]> = {}) {
  return supervisionStatus({
    clientPersonId: "c-1",
    clientName: "Dolores Vance",
    startOfCare: "2025-06-01",
    visits: [],
    today: TODAY,
    ...over,
  });
}

function livePlan(): CarePlan {
  return activatePlan({
    plan: reviewPlan({
      plan: carePlanFromAssessment({
        id: "plan-1",
        clientPersonId: "c-1",
        clientName: "Dolores Vance",
        answers: {
          goals: ["Effective/safe care"],
          interventions_personal: ["Bathing"],
          vital_thresholds: {},
        },
        authoredByUserId: RN,
        at: "2025-06-01T10:00:00Z",
      }),
      byUserId: RN,
      at: "2025-06-01T10:00:00Z",
    }),
    at: "2025-06-01T12:00:00Z",
  });
}

describe("the clock the client record could never stop", () => {
  it("counts from start of care when nobody has been out yet", () => {
    expect(status().dueOn).toBe("2026-06-01");
    expect(status().daysRemaining).toBeLessThan(0);
    expect(status().needsYou).toBe(true);
  });

  it("restarts from the last completed visit", () => {
    // The whole fix. Before this there was nothing to measure from but start of
    // care, so a client supervised last month still read overdue and the RN who
    // did the work had no way to say so.
    const done: SupervisoryVisit = {
      ...bookSupervisoryVisit({
        id: "sv1",
        clientPersonId: "c-1",
        clientName: "Dolores Vance",
        scheduledFor: "2026-07-10",
        assignedToUserId: RN,
      }),
      completedAt: "2026-07-10T14:00:00Z",
      completedByUserId: RN,
      findings: "Care matches the plan. No concerns.",
      carePlanReviewed: true,
    };

    const now = status({ visits: [done] });
    expect(now.dueOn).toBe("2027-07-10");
    expect(now.needsYou).toBe(false);
    expect(now.last?.id).toBe("sv1");
  });

  it("does not ask for anything once one is booked", () => {
    // §5: nobody gets handed a task for a wait that is already being handled.
    const booked = bookSupervisoryVisit({
      id: "sv2",
      clientPersonId: "c-1",
      clientName: "Dolores Vance",
      scheduledFor: "2026-08-28",
      assignedToUserId: RN,
    });
    const now = status({ visits: [booked] });
    expect(now.state).toBe("booked");
    expect(now.needsYou).toBe(false);
    expect(supervisionHeadline(now)).toBe("Booked for 2026-08-28");
  });

  it("says how late it is rather than that it is late", () => {
    expect(supervisionHeadline(status())).toMatch(/^\d+ days overdue$/);
    expect(supervisionHeadline(status({ startOfCare: "2025-09-01" }))).toMatch(/^Due in \d+ days$/);
    expect(supervisionHeadline(status({ startOfCare: "2026-06-01" }))).toBe("Next due 2027-06-01");
  });

  it("puts the most overdue client first", () => {
    const rows = supervisionQueue({
      clients: [
        { personId: "c-2", name: "Lian Huang", startOfCare: "2026-03-01" },
        { personId: "c-1", name: "Dolores Vance", startOfCare: "2025-01-01" },
      ],
      visits: [],
      today: TODAY,
    });
    expect(rows.map((r) => r.clientName)).toEqual(["Dolores Vance", "Lian Huang"]);
  });
});

describe("recording one", () => {
  const booked = bookSupervisoryVisit({
    id: "sv3",
    clientPersonId: "c-1",
    clientName: "Dolores Vance",
    scheduledFor: "2026-08-21",
    assignedToUserId: RN,
  });

  it("will not be recorded with nothing written down", () => {
    expect(completionRefusals(booked, "  ")).toEqual(["no_findings"]);
    const out = completeSupervisoryVisit({
      visit: booked,
      findings: "",
      carePlanReviewed: false,
      plan: null,
      byUserId: RN,
      at: "2026-08-21T15:00:00Z",
    });
    expect(out.visit.completedAt).toBeNull();
  });

  it("marks the care plan reviewed in the same action", () => {
    // The two records disagreeing is exactly what this prevents: a plan whose
    // clock says nobody has looked at it in a year, and a supervisory visit
    // from last week saying somebody did.
    const plan = livePlan();
    expect(reviewDueOn(plan)).toBe("2026-06-01");

    const out = completeSupervisoryVisit({
      visit: booked,
      findings: "Watched a transfer. Plan still fits.",
      carePlanReviewed: true,
      plan,
      byUserId: RN,
      at: "2026-08-21T15:00:00Z",
    });

    expect(out.visit.completedAt).toBe("2026-08-21T15:00:00Z");
    expect(out.visit.carePlanReviewed).toBe(true);
    expect(out.plan?.reviewedByUserId).toBe(RN);
    expect(reviewDueOn(out.plan!)).toBe("2027-08-21");
  });

  it("does not claim a plan was reviewed when there is no plan", () => {
    const out = completeSupervisoryVisit({
      visit: booked,
      findings: "No plan on file yet — flagged to the office.",
      carePlanReviewed: true,
      plan: null,
      byUserId: RN,
      at: "2026-08-21T15:00:00Z",
    });
    expect(out.visit.carePlanReviewed).toBe(false);
  });

  it("records a visit that was never booked", () => {
    // The RN was there. Refusing the record because the paperwork order was
    // wrong is how work stops being written down.
    const unbooked: SupervisoryVisit = { ...booked, scheduledFor: null };
    const out = completeSupervisoryVisit({
      visit: unbooked,
      findings: "Dropped in while nearby.",
      carePlanReviewed: false,
      plan: null,
      byUserId: RN,
      at: "2026-08-21T15:00:00Z",
    });
    expect(out.visit.completedAt).toBe("2026-08-21T15:00:00Z");
    expect(out.visit.scheduledFor).toBe("2026-08-21");
  });

  it("will not record the same visit twice", () => {
    const done = completeSupervisoryVisit({
      visit: booked,
      findings: "First write-up.",
      carePlanReviewed: false,
      plan: null,
      byUserId: RN,
      at: "2026-08-21T15:00:00Z",
    }).visit;
    expect(completionRefusals(done, "Second write-up.")).toEqual(["already_done"]);
  });
});

describe("the demo seeds agree with each other", () => {
  it("dates a plan's last review to the supervisory visit that did it", async () => {
    // A seed that demonstrates the bug is worse than no seed. If somebody adds
    // a completed supervisory visit and forgets the plan, this fails.
    const { seedSupervisoryVisits } = await import("@/lib/supervisionSeed");
    const { seedCarePlans } = await import("@/lib/carePlanSeed");
    const { activePlan } = await import("@/domain/carePlan/plan");

    for (const visit of seedSupervisoryVisits) {
      if (!visit.completedAt || !visit.carePlanReviewed) continue;
      const plan = activePlan(seedCarePlans, visit.clientPersonId);
      expect(plan, `${visit.clientName} has no active plan to have reviewed`).not.toBeNull();
      expect(plan!.reviewedAt?.slice(0, 10)).toBe(visit.completedAt.slice(0, 10));
    }
  });
});
