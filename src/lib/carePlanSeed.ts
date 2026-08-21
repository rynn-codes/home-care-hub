import type { AssessmentAnswers } from "@/domain/assessment/questions";
import {
  activatePlan,
  carePlanFromAssessment,
  reviewPlan,
  revisePlan,
  submitForReview,
  type CarePlan,
} from "@/domain/carePlan/plan";

/**
 * Care plans for the demo.
 *
 * Clients are fictional, as everywhere in this repository — the fact that a
 * named person receives home care is health information about them, and a care
 * plan is the most detailed statement of that there is.
 *
 * Every plan here is built by putting assessment answers through
 * `carePlanFromAssessment` rather than by writing a plan object literal. That
 * is deliberate: it exercises the derivation the RN's own kitchen-table
 * conversation goes through, so if the assessment and the plan ever stop
 * agreeing the demo breaks rather than quietly drifting.
 *
 * Four states, because a screen where everything is fine demonstrates nothing:
 * two live, one live plan with a revision waiting on review, and one client
 * with no plan at all — which is the state the family portal has to describe
 * honestly rather than hide.
 */

const RN = "u-karynn";

/** A date n days ago, so the demo's end dates always mean something. */
function shortlyBefore(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function plan(input: {
  id: string;
  clientPersonId: string;
  clientName: string;
  answers: AssessmentAnswers;
  createdAt: string;
  liveFrom: string;
}): CarePlan {
  return activatePlan({
    plan: reviewPlan({
      plan: carePlanFromAssessment({
        id: input.id,
        clientPersonId: input.clientPersonId,
        clientName: input.clientName,
        answers: input.answers,
        authoredByUserId: RN,
        at: input.createdAt,
      }),
      byUserId: RN,
      at: input.createdAt,
    }),
    at: input.liveFrom,
  });
}

const lian = plan({
  id: "cp-lian-1",
  clientPersonId: "c-lian",
  clientName: "Lian Huang",
  createdAt: "2026-03-02T11:00:00.000Z",
  liveFrom: "2026-03-03T00:00:00.000Z",
  answers: {
    services: ["Personal Care"],
    goals: ["Patient clean, comfortable", "Effective/safe care"],
    interventions_personal: [
      "Bathing", "Assist to dress", "Comb/brush hair", "Oral hygiene/denture care",
      "Meal prep", "Medication reminder",
    ],
    interventions_activity: ["Assist in ambulation", "Assist in transfer"],
    interventions_household: ["Light housekeeping", "Change linen"],
    // The RN widened the pulse ceiling for this client and left the rest of
    // the packet's parameters alone.
    vital_thresholds: { pulse_high: "140" },
    dme: ["Walker", "Grab bars", "Tub/shower bench"],
    supplies: ["Briefs", "Exam gloves"],
  },
});

/**
 * Lian's plan was reviewed on her June supervisory visit, so her review clock
 * runs from then. Kept in step with `seedSupervisoryVisits` deliberately: the
 * two records disagreeing — a plan saying nobody has looked at it since March
 * and a supervisory visit in June saying somebody did — is precisely the state
 * `completeSupervisoryVisit` exists to prevent, and a seed that demonstrates
 * the bug is worse than no seed.
 */
const lianReviewed = reviewPlan({ plan: lian, byUserId: RN, at: "2026-06-11T15:20:00.000Z" });

const edward = plan({
  id: "cp-edward-1",
  clientPersonId: "c-edward",
  clientName: "Edward Pham",
  createdAt: "2026-01-14T09:30:00.000Z",
  liveFrom: "2026-01-15T00:00:00.000Z",
  answers: {
    services: ["Live-In"],
    goals: ["Effective/safe care"],
    interventions_personal: ["Bathing", "Assist to dress", "Shave", "Eating", "Medication reminder"],
    interventions_elimination: ["Incontinent care", "Assist w/bedside commode"],
    interventions_activity: ["Turn of position", "Assist in transfer", "Range of motion"],
    interventions_household: ["Laundry", "Make bed", "Light housekeeping"],
    vital_thresholds: {},
    dme: ["Hospital bed", "Wheelchair", "Bedside commode"],
    supplies: ["Briefs", "Chux/underpads", "Exam gloves"],
    blood_sugar: "Call the RN above 180 or below 70. He can usually tell you when he feels low.",
  },
});

const dolores = plan({
  id: "cp-dolores-1",
  clientPersonId: "c-dolores",
  clientName: "Dolores Vance",
  createdAt: "2026-06-20T16:00:00.000Z",
  liveFrom: "2026-06-21T00:00:00.000Z",
  answers: {
    services: ["Evening Care"],
    goals: ["Patient clean, comfortable"],
    interventions_personal: ["Assist to dress", "Meal prep", "Medication reminder", "Oral hygiene/denture care"],
    interventions_activity: ["Assist in ambulation"],
    interventions_household: ["Companion care", "Light housekeeping"],
    vital_thresholds: {},
    dme: ["Cane", "Elevated toilet seat"],
  },
});

/**
 * Dolores stumbled getting out of her chair — the incident on the Incidents
 * screen. The revision adds transfer assistance and a second mobility aid, and
 * it is sitting in review: a change to a live plan does not take effect because
 * somebody typed it, and the plan she is being cared for under today is still
 * version 1.
 */
const doloresRevision = submitForReview(
  revisePlan({ plan: dolores, id: "cp-dolores-2", byUserId: RN, at: "2026-08-20T22:10:00.000Z" }),
);

const doloresV2: CarePlan = {
  ...doloresRevision,
  tasks: [
    ...doloresRevision.tasks,
    { id: "assist_in_transfer", label: "Assist in transfer", category: "activity", required: true },
  ],
  equipment: [...doloresRevision.equipment, "Walker"],
};

/**
 * Dolores is post-surgical, and her care was agreed to a date that has passed.
 *
 * Karynn, 21 August: respite and post-surgical care is timed — "will be out of
 * the home in a month or after they recover". The failure worth demonstrating
 * is not the end date; it is care that quietly runs past one. The visits keep
 * being scheduled and the invoices keep going out, and nobody has asked the
 * family whether they still want it.
 */
const doloresTimed: CarePlan = {
  ...dolores,
  services: ["Post-surgical"],
  expectedEnd: { kind: "fixed", endsOn: shortlyBefore(9) },
};

const susan = plan({
  id: "cp-susan-1",
  clientPersonId: "c-susan",
  clientName: "Susan Miller",
  createdAt: "2026-05-05T13:00:00.000Z",
  liveFrom: "2026-05-06T00:00:00.000Z",
  answers: {
    services: ["Personal Care"],
    goals: ["Education/understanding care", "Patient clean, comfortable"],
    interventions_personal: ["Bathing", "Nail care", "Meal prep"],
    interventions_household: ["Shopping", "Escort outside home", "Laundry"],
    vital_thresholds: {},
    dme: ["Grab bars"],
  },
});

/**
 * Marcus is the family portal's client — the one Susan holds a grant for,
 * before start of care. His first plan is written and sitting with the RN, and
 * the family screen reads THIS rather than the hardcoded "in_review" string it
 * used to carry. That string was the same class of defect as Home's hardcoded
 * priority numbers: the daughter's phone and the office could disagree about
 * where the admission had got to, and only one of them would be right.
 */
const marcus = submitForReview(
  carePlanFromAssessment({
    id: "cp-marcus-1",
    clientPersonId: "p-marcus",
    clientName: "Marcus",
    authoredByUserId: RN,
    at: "2026-08-18T13:00:00.000Z",
    answers: {
      services: ["Personal Care"],
      goals: ["Effective/safe care", "Patient clean, comfortable"],
      interventions_personal: ["Bathing", "Assist to dress", "Meal prep", "Medication reminder"],
      interventions_activity: ["Assist in ambulation"],
      interventions_household: ["Light housekeeping"],
      vital_thresholds: {},
      dme: ["Walker"],
    },
  }),
);

/**
 * Ruth Alvarez and Evelyn Carter deliberately have no plan. Both of their
 * visits are open shifts, and a client whose care has not been planned yet is
 * a real state Joy has to be able to show — the caregiver's screen says so
 * plainly instead of listing five tasks nobody agreed to.
 */
export const seedCarePlans: CarePlan[] = [
  lianReviewed,
  edward,
  doloresTimed,
  doloresV2,
  susan,
  marcus,
];
