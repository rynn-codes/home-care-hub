import { describe, expect, it } from "vitest";
import {
  activatePlan,
  activePlan,
  canActivate,
  carePlanQueue,
  carePlanFromAssessment,
  carePlanStateForFamily,
  planGaps,
  planInEffect,
  replacePlan,
  reviewOverdue,
  reviewPlan,
  reviewDueOn,
  revisePlan,
  submitForReview,
  tasksForVisit,
  type CarePlan,
} from "@/domain/carePlan/plan";
import type { AssessmentAnswers } from "@/domain/assessment/questions";

const RN = "u-karynn";

const ANSWERS: AssessmentAnswers = {
  services: ["Personal Care"],
  goals: ["Patient clean, comfortable"],
  interventions_personal: ["Bathing", "Assist to dress", "Medication reminder"],
  interventions_household: ["Light housekeeping", "Laundry"],
  interventions_activity: ["Assist in ambulation"],
  vital_thresholds: { bp_high: "160" },
  dme: ["Walker", "Grab bars"],
  supplies: ["Briefs"],
};

function draft(answers: AssessmentAnswers = ANSWERS): CarePlan {
  return carePlanFromAssessment({
    id: "plan-1",
    clientPersonId: "c-1",
    clientName: "Dolores Vance",
    answers,
    authoredByUserId: RN,
    at: "2026-08-01T10:00:00Z",
  });
}

function live(): CarePlan {
  return activatePlan({
    plan: reviewPlan({ plan: draft(), byUserId: RN, at: "2026-08-01T12:00:00Z" }),
    at: "2026-08-02T00:00:00Z",
  });
}

describe("a plan is built from what the nurse actually answered", () => {
  it("carries every intervention across, keeping its category", () => {
    const plan = draft();
    expect(plan.tasks.map((t) => t.label)).toEqual([
      "Bathing",
      "Assist to dress",
      "Medication reminder",
      "Assist in ambulation",
      "Light housekeeping",
      "Laundry",
    ]);
    expect(plan.tasks.find((t) => t.label === "Laundry")?.category).toBe("household");
  });

  it("invents nothing when a question was not answered", () => {
    // The property this whole module exists for. A plausible default in a care
    // plan is worse than a blank, because a blank gets noticed.
    const bare = draft({ goals: ["Effective/safe care"] });
    expect(bare.tasks).toEqual([]);
    expect(bare.vitals).toEqual([]);
    expect(bare.equipment).toEqual([]);
    expect(bare.emergencyPlan).toBe("");
  });

  it("keeps the packet's thresholds and the nurse's change to one of them", () => {
    const plan = draft();
    expect(plan.vitals.find((v) => v.key === "bp_high")?.value).toBe("160");
    // Untouched parameters keep the packet default rather than disappearing.
    expect(plan.vitals.find((v) => v.key === "o2_low")?.value).toBe("89");
  });

  it("does not fall back to the packet defaults when nobody was asked", () => {
    // The difference between "the RN accepted the standard parameters" and
    // "nobody asked" is the difference between a plan and a guess.
    expect(draft({ goals: ["Effective/safe care"] }).vitals).toEqual([]);
  });

  it("marks the tasks §11 will not let a visit close without", () => {
    const plan = draft();
    expect(plan.tasks.find((t) => t.label === "Bathing")?.required).toBe(true);
    expect(plan.tasks.find((t) => t.label === "Light housekeeping")?.required).toBe(false);
  });
});

describe("what stops a plan going live", () => {
  it("names every gap rather than refusing without a reason", () => {
    expect(planGaps(draft({}))).toEqual(["no_goals", "no_tasks", "no_vitals", "not_reviewed"]);
  });

  it("will not activate a plan nobody has reviewed", () => {
    const ready = draft();
    expect(planGaps(ready)).toEqual(["not_reviewed"]);
    expect(canActivate(ready)).toBe(false);
    expect(activatePlan({ plan: ready, at: "2026-08-02T00:00:00Z" }).state).toBe("draft");
  });

  it("records who reviewed it, not that it was reviewed", () => {
    const reviewed = reviewPlan({ plan: draft(), byUserId: RN, at: "2026-08-01T12:00:00Z" });
    expect(reviewed.reviewedByUserId).toBe(RN);
    expect(canActivate(reviewed)).toBe(true);
  });

  it("refuses a plan where nothing is required", () => {
    // §11 checks required tasks. A plan of only optional ones lets a visit
    // close with every line unanswered, which looks like compliance and is not.
    const optional = draft({ ...ANSWERS, interventions_personal: ["Comb/brush hair"] });
    expect(planGaps(optional)).toContain("no_required_task");
  });

  it("moves through draft, review and active", () => {
    expect(submitForReview(draft()).state).toBe("in_review");
    expect(live().state).toBe("active");
    expect(live().effectiveFrom).toBe("2026-08-02T00:00:00Z");
  });
});

describe("a change makes a new version instead of editing the old one", () => {
  it("leaves the active plan alone while the revision is being written", () => {
    const current = live();
    const next = revisePlan({ plan: current, id: "plan-2", byUserId: RN, at: "2026-09-01T09:00:00Z" });

    expect(current.state).toBe("active");
    expect(next.version).toBe(2);
    expect(next.supersedes).toBe("plan-1");
    expect(next.state).toBe("draft");
  });

  it("makes a revision earn its own sign-off", () => {
    // Otherwise a task could be added to a live plan by somebody who is not
    // allowed to approve one, on the strength of a review of different content.
    const next = revisePlan({ plan: live(), id: "plan-2", byUserId: RN, at: "2026-09-01T09:00:00Z" });
    expect(next.reviewedAt).toBeNull();
    expect(canActivate(next)).toBe(false);
  });

  it("retires the old version at the moment the new one takes over", () => {
    const current = live();
    const revision = reviewPlan({
      plan: revisePlan({ plan: current, id: "plan-2", byUserId: RN, at: "2026-09-01T09:00:00Z" }),
      byUserId: RN,
      at: "2026-09-01T10:00:00Z",
    });
    const { previous, revision: now } = replacePlan({
      previous: current,
      revision,
      at: "2026-09-02T00:00:00Z",
    });

    expect(previous.state).toBe("superseded");
    expect(previous.effectiveUntil).toBe("2026-09-02T00:00:00Z");
    expect(now.state).toBe("active");
    expect(activePlan([previous, now], "c-1")?.id).toBe("plan-2");
  });

  it("does not retire anything if the revision could not activate", () => {
    // The failure this prevents is a client with no active plan at all.
    const current = live();
    const unreviewed = revisePlan({ plan: current, id: "plan-2", byUserId: RN, at: "2026-09-01T09:00:00Z" });
    const out = replacePlan({ previous: current, revision: unreviewed, at: "2026-09-02T00:00:00Z" });
    expect(out.previous.state).toBe("active");
    expect(out.revision.state).toBe("draft");
  });

  it("reads a past visit against the plan that was in effect that day", () => {
    const current = live();
    const revision = reviewPlan({
      plan: revisePlan({ plan: current, id: "plan-2", byUserId: RN, at: "2026-09-01T09:00:00Z" }),
      byUserId: RN,
      at: "2026-09-01T10:00:00Z",
    });
    const { previous, revision: now } = replacePlan({
      previous: current,
      revision,
      at: "2026-09-02T00:00:00Z",
    });
    const plans = [previous, now];

    expect(planInEffect(plans, "2026-08-15")?.version).toBe(1);
    expect(planInEffect(plans, "2026-09-10")?.version).toBe(2);
    // Before anything was active at all.
    expect(planInEffect(plans, "2026-07-01")).toBeNull();
  });
});

describe("the visit task list", () => {
  it("comes from the plan rather than from a hardcoded list", () => {
    const tasks = tasksForVisit({
      plans: [live()],
      clientPersonId: "c-1",
      service: "Personal Care",
      date: "2026-08-15",
    });
    expect(tasks.map((t) => t.label)).toContain("Bathing");
  });

  it("does not filter by the service label on the visit", () => {
    // Karynn, 21 August: "We don't separate care. All of our clients get
    // personal care services, companion care, light housekeeping." The label is
    // a billing and scheduling distinction, not a description of what the
    // caregiver does when she gets there — and an earlier version of this file
    // used it to hide a client's bathing task from the person who came to do
    // it.
    for (const service of ["Personal Care", "Companion Care", "Live-In", "Respite"]) {
      const tasks = tasksForVisit({
        plans: [live()],
        clientPersonId: "c-1",
        service,
        date: "2026-08-15",
      });
      expect(tasks.map((t) => t.label), service).toContain("Bathing");
      expect(tasks, service).toHaveLength(6);
    }
  });

  it("is empty when no plan is in effect, rather than improvised", () => {
    expect(
      tasksForVisit({ plans: [draft()], clientPersonId: "c-1", service: "Personal Care", date: "2026-08-15" }),
    ).toEqual([]);
    expect(
      tasksForVisit({ plans: [live()], clientPersonId: "c-2", service: "Personal Care", date: "2026-08-15" }),
    ).toEqual([]);
  });
});

describe("what the family is told", () => {
  it("reads the plan rather than asking anybody", () => {
    expect(carePlanStateForFamily(null)).toBe("not_started");
    expect(carePlanStateForFamily(draft())).toBe("not_started");
    expect(carePlanStateForFamily(submitForReview(draft()))).toBe("in_review");
    expect(carePlanStateForFamily(live())).toBe("current");
  });
});

describe("the review clock", () => {
  it("runs from the last review, and only for a live plan", () => {
    expect(reviewDueOn(live())).toBe("2027-08-01");
    expect(reviewOverdue(live(), "2027-07-31")).toBe(false);
    expect(reviewOverdue(live(), "2027-08-02")).toBe(true);
    // A draft has no clock — nobody is following it.
    expect(reviewOverdue(reviewPlan({ plan: draft(), byUserId: RN, at: "2020-01-01T00:00:00Z" }), "2026-08-20")).toBe(false);
  });
});

describe("the care plan queue", () => {
  const clients = [
    { personId: "c-1", name: "Dolores Vance" },
    { personId: "c-2", name: "Ruth Alvarez" },
  ];

  it("puts a client with visits and no plan at the top", () => {
    // The failure this whole module was built to make visible.
    const rows = carePlanQueue({ clients, plans: [live()], today: "2026-08-20" });
    expect(rows[0].clientPersonId).toBe("c-2");
    expect(rows[0].reason).toBe("no_plan");
    expect(rows[0].needsYou).toBe(true);
  });

  it("does not ask for anything when a plan is current", () => {
    const rows = carePlanQueue({ clients: [clients[0]], plans: [live()], today: "2026-08-20" });
    expect(rows[0].reason).toBe("current");
    expect(rows[0].needsYou).toBe(false);
  });

  it("surfaces a revision that is waiting on a review", () => {
    const current = live();
    const pending = submitForReview(
      revisePlan({ plan: current, id: "plan-2", byUserId: RN, at: "2026-08-19T09:00:00Z" }),
    );
    const rows = carePlanQueue({
      clients: [clients[0]],
      plans: [current, pending],
      today: "2026-08-20",
    });
    expect(rows[0].reason).toBe("revision_waiting");
    expect(rows[0].active?.version).toBe(1);
    expect(rows[0].pending?.version).toBe(2);
  });

  it("ranks an overdue review above a waiting revision", () => {
    // A plan nobody has looked at in over a year is a worse state than a
    // change sitting in somebody's queue for a day.
    const stale = live();
    const rows = carePlanQueue({ clients: [clients[0]], plans: [stale], today: "2027-09-01" });
    expect(rows[0].reason).toBe("review_overdue");
  });
});

describe("reviewing a plan that is already live", () => {
  it("resets the review clock", () => {
    // The annual review. An earlier version refused to review an active plan,
    // so the clock counted up from activation forever and there was nowhere to
    // record the supervisory visit that had actually happened.
    const reviewed = reviewPlan({ plan: live(), byUserId: RN, at: "2027-07-01T10:00:00Z" });
    expect(reviewed.state).toBe("active");
    // Twelve months, not 365 days — 2028 has a leap day, and adding days would
    // have put this on 30 June while the client record said 1 July.
    expect(reviewDueOn(reviewed)).toBe("2028-07-01");
    expect(reviewOverdue(reviewed, "2027-09-01")).toBe(false);
  });

  it("refuses a superseded plan, which describes care that already happened", () => {
    const retired = { ...live(), state: "superseded" as const };
    expect(reviewPlan({ plan: retired, byUserId: RN, at: "2027-07-01T10:00:00Z" }).reviewedAt).toBe(
      retired.reviewedAt,
    );
  });
});
