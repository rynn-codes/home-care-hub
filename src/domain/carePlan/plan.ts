import type { AssessmentAnswers } from "@/domain/assessment/questions";
import { VITAL_DEFAULTS } from "@/domain/assessment/questions";
import { addMonths } from "@/domain/dates";

/**
 * The care plan.
 *
 * The gap that everything else was leaning on. The assessment collects plan of
 * care content at the kitchen table — goals, interventions, vital parameters,
 * equipment, what to do in an emergency. The consent packet has the client sign
 * "I have received and reviewed my plan of care". The family portal shows a
 * "Care plan" row. The caregiver's visit screen shows a task list. None of
 * those pointed at the same thing, because there was no thing: `tasksForVisit`
 * returned five hardcoded strings and said so in a comment.
 *
 * Three rules shape this file.
 *
 * NOTHING CLINICAL IS INVENTED. Every task, threshold and piece of equipment
 * traces to an answer the RN gave. Where an answer is missing the plan carries
 * the gap and refuses to activate, rather than filling it with something
 * plausible. A care plan is the document a caregiver follows in somebody's
 * house and a surveyor reads afterwards; a generated-but-reasonable line in it
 * is worse than a blank one, because a blank one gets noticed.
 *
 * A PLAN IS VERSIONED, NEVER EDITED IN PLACE. Once care has started, visits
 * have been charted against a specific set of tasks. Editing the plan
 * underneath them rewrites history: last Tuesday's chart would show tasks that
 * did not exist last Tuesday, and a task removed today would vanish from a
 * record that a family or a surveyor may later read. So a change produces a new
 * version and supersedes the old one, exactly as a renewed credential
 * supersedes rather than overwrites in `documents`.
 *
 * THE PLAN IS A SINGLE SOURCE. Everything downstream — the visit task list, the
 * family portal's care-plan row, the vitals the caregiver is asked to call
 * about — derives from here rather than keeping its own copy. That is §27's one
 * rule engine, many views, and it is the only way the daughter's phone and the
 * caregiver's phone agree about what Joy agreed to do.
 */

// ------------------------------------------------------------------ types --

export type CarePlanState = "draft" | "in_review" | "active" | "superseded";

/** Which part of the visit a task belongs to. Ordered as a shift runs. */
export type TaskCategory = "personal" | "elimination" | "activity" | "household";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  personal: "Personal care",
  elimination: "Elimination",
  activity: "Activity and mobility",
  household: "Household and social",
};

export interface PlanTask {
  id: string;
  label: string;
  category: TaskCategory;
  /**
   * §11 checks required tasks before clock-out. Personal care and medication
   * are required; a shopping trip is not. `required` is a property of the task
   * in the plan rather than of the category, because the RN may say a
   * particular client's walk matters more than her laundry.
   */
  required: boolean;
}

export interface VitalThreshold {
  key: string;
  label: string;
  value: string;
}

export interface CarePlan {
  id: string;
  clientPersonId: string;
  clientName: string;
  /** 1, 2, 3… A revision increments this; nothing else does. */
  version: number;
  /** The id of the plan this replaced, if any. */
  supersedes: string | null;
  state: CarePlanState;

  /** What the care is for. From the assessment's `goals`. */
  goals: readonly string[];
  tasks: readonly PlanTask[];
  /** When the caregiver calls the RN. From `vital_thresholds`. */
  vitals: readonly VitalThreshold[];
  /** Equipment already in the home, and supplies Joy provides. */
  equipment: readonly string[];
  supplies: readonly string[];
  /** The emergency care plan in the RN's words. Packet p26. */
  emergencyPlan: string;

  /** Which services this plan's tasks apply to. From the agreement. */
  services: readonly string[];

  authoredByUserId: string;
  createdAt: string;
  /** Set when it goes active. Nothing before this date was charted against it. */
  effectiveFrom: string | null;
  /** Set when superseded, so a chart can be read against the plan of its day. */
  effectiveUntil: string | null;
  /** Who reviewed it, and when. An RN or the owner — same rule as a signature. */
  reviewedByUserId: string | null;
  reviewedAt: string | null;
}

// ------------------------------------------------- from the assessment --

/** Read a multichoice answer without trusting its shape. */
function choices(answers: AssessmentAnswers, key: string): string[] {
  const value = answers[key];
  if (Array.isArray(value)) return value.map(String).filter((s) => s.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function text(answers: AssessmentAnswers, key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Tasks §11 will not let a caregiver clock out without answering.
 *
 * Deliberately a short list rather than "everything in personal care". A
 * required task is one where "she didn't say" is not an acceptable record: a
 * missed medication reminder is an incident, and a bath that did not happen is
 * something the office needs to know about the same day. Light housekeeping is
 * not in that category, and making it required trains people to tick boxes.
 */
const REQUIRED_TASKS = [
  "Bathing",
  "Medication reminder",
  "Meal prep",
  "Eating",
  "Pericare",
  "Incontinent care",
  "Catheter care",
  "Assist in transfer",
];

const INTERVENTION_QUESTIONS: Array<[string, TaskCategory]> = [
  ["interventions_personal", "personal"],
  ["interventions_elimination", "elimination"],
  ["interventions_activity", "activity"],
  ["interventions_household", "household"],
];

/** A stable id, so a task keeps its identity across revisions of the plan. */
export function taskId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Build the first draft from what the RN answered.
 *
 * This is "enter once, reuse everywhere" doing the work it was for: the nurse
 * already walked through interventions, goals, thresholds and equipment at the
 * kitchen table, and typing them a second time into a care plan form is how
 * they end up disagreeing with the assessment they came from.
 */
export function carePlanFromAssessment(input: {
  id: string;
  clientPersonId: string;
  clientName: string;
  answers: AssessmentAnswers;
  authoredByUserId: string;
  at: string;
}): CarePlan {
  const { answers } = input;

  const tasks: PlanTask[] = [];
  for (const [question, category] of INTERVENTION_QUESTIONS) {
    for (const label of choices(answers, question)) {
      tasks.push({
        id: taskId(label),
        label,
        category,
        required: REQUIRED_TASKS.includes(label),
      });
    }
  }

  // The thresholds are the packet's defaults unless the RN changed one. Note
  // what this does NOT do: it does not silently fall back to the defaults when
  // the question was never asked. `vital_thresholds` is a required assessment
  // question, and if it is missing the plan carries no vitals and says so.
  const answered = answers.vital_thresholds;
  const overrides =
    answered && typeof answered === "object" ? (answered as Record<string, unknown>) : null;
  const vitals: VitalThreshold[] = overrides
    ? VITAL_DEFAULTS.map((d) => ({
        ...d,
        value: overrides[d.key] === undefined ? d.value : String(overrides[d.key]),
      }))
    : [];

  return {
    id: input.id,
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    version: 1,
    supersedes: null,
    state: "draft",
    goals: choices(answers, "goals"),
    tasks,
    vitals,
    equipment: choices(answers, "dme"),
    supplies: choices(answers, "supplies"),
    emergencyPlan: text(answers, "blood_sugar"),
    services: choices(answers, "services"),
    authoredByUserId: input.authoredByUserId,
    createdAt: input.at,
    effectiveFrom: null,
    effectiveUntil: null,
    reviewedByUserId: null,
    reviewedAt: null,
  };
}

// ------------------------------------------------------------- readiness --

export type PlanGap =
  | "no_goals"
  | "no_tasks"
  | "no_vitals"
  | "no_required_task"
  | "not_reviewed";

export const PLAN_GAP_MESSAGES: Record<PlanGap, string> = {
  no_goals: "No goals. The plan has to say what the care is for.",
  no_tasks: "No tasks. A caregiver would arrive with nothing to follow.",
  no_vitals:
    "No vital-sign parameters. The caregiver would not know when to call you.",
  no_required_task:
    "Nothing on this plan is required, so §11 would let a visit close with every task unanswered.",
  not_reviewed: "An RN or the owner has to review this before it goes live.",
};

/**
 * What is missing before this plan can be followed.
 *
 * Returned as a list rather than a boolean, and in the order somebody would fix
 * them, because "cannot activate" with no reason is the kind of message that
 * gets worked around instead of fixed.
 */
export function planGaps(plan: CarePlan): PlanGap[] {
  const gaps: PlanGap[] = [];
  if (plan.goals.length === 0) gaps.push("no_goals");
  if (plan.tasks.length === 0) gaps.push("no_tasks");
  else if (!plan.tasks.some((t) => t.required)) gaps.push("no_required_task");
  if (plan.vitals.length === 0) gaps.push("no_vitals");
  if (!plan.reviewedAt) gaps.push("not_reviewed");
  return gaps;
}

export function canActivate(plan: CarePlan): boolean {
  return plan.state !== "superseded" && plan.state !== "active" && planGaps(plan).length === 0;
}

// ------------------------------------------------------------ lifecycle --

/** Send a draft for review. Nothing changes but the state and who can see it. */
export function submitForReview(plan: CarePlan): CarePlan {
  if (plan.state !== "draft") return plan;
  return { ...plan, state: "in_review" };
}

/**
 * An RN or the owner signs off.
 *
 * `byUserId` is recorded rather than assumed for the same reason the witness
 * rule exists on consents: if the plan is ever questioned, "who approved this"
 * has an answer, and it is a person rather than the system.
 *
 * This is used twice, and both uses are the same act. Before a plan goes live
 * somebody has to sign off on it; once a year somebody has to look at a live
 * plan again and say it still fits, which is what the supervisory visit is for.
 * So reviewing an active plan is allowed and resets its review clock — an
 * earlier version refused it, which meant the annual review had nowhere to be
 * recorded and the clock counted up forever.
 *
 * A superseded plan is not reviewable. It describes care that already happened.
 */
export function reviewPlan(input: { plan: CarePlan; byUserId: string; at: string }): CarePlan {
  const { plan } = input;
  if (plan.state === "superseded") return plan;
  return { ...plan, reviewedByUserId: input.byUserId, reviewedAt: input.at };
}

export function activatePlan(input: { plan: CarePlan; at: string }): CarePlan {
  const { plan } = input;
  if (!canActivate(plan)) return plan;
  return { ...plan, state: "active", effectiveFrom: input.at };
}

/**
 * Start a revision.
 *
 * Returns a NEW draft carrying the current content forward, leaving the active
 * plan alone. The old plan is not touched until the new one activates, so care
 * continues under a plan that is still current while the change is being
 * reviewed — the alternative is a window where the client has no active plan at
 * all because somebody started editing on a Friday afternoon.
 */
export function revisePlan(input: { plan: CarePlan; id: string; byUserId: string; at: string }): CarePlan {
  const { plan } = input;
  return {
    ...plan,
    id: input.id,
    version: plan.version + 1,
    supersedes: plan.id,
    state: "draft",
    authoredByUserId: input.byUserId,
    createdAt: input.at,
    effectiveFrom: null,
    effectiveUntil: null,
    // A revision is a new document and needs its own sign-off. Carrying the
    // previous review forward would mean a task could be added to a live plan
    // by somebody who is not allowed to approve one.
    reviewedByUserId: null,
    reviewedAt: null,
  };
}

/** Retire the old version at the moment its replacement takes over. */
export function supersede(input: { plan: CarePlan; at: string }): CarePlan {
  return { ...input.plan, state: "superseded", effectiveUntil: input.at };
}

/**
 * Activate a revision and retire what it replaces, in one step.
 *
 * Exposed as one function because the two halves must not drift apart: doing
 * them separately is how a client ends up with two active plans, and a
 * caregiver's phone showing whichever one loaded first.
 */
export function replacePlan(input: {
  previous: CarePlan;
  revision: CarePlan;
  at: string;
}): { previous: CarePlan; revision: CarePlan } {
  if (!canActivate(input.revision)) return { previous: input.previous, revision: input.revision };
  return {
    previous: supersede({ plan: input.previous, at: input.at }),
    revision: activatePlan({ plan: input.revision, at: input.at }),
  };
}

// ---------------------------------------------------------------- views --

/** The plan a given date's care was delivered under. */
export function planInEffect(plans: readonly CarePlan[], date: string): CarePlan | null {
  const candidates = plans.filter(
    (p) =>
      p.effectiveFrom !== null &&
      p.effectiveFrom.slice(0, 10) <= date &&
      (p.effectiveUntil === null || p.effectiveUntil.slice(0, 10) > date),
  );
  // Newest first, so a same-day replacement resolves to the one that took over.
  return candidates.sort((a, b) => b.version - a.version)[0] ?? null;
}

export function activePlan(plans: readonly CarePlan[], clientPersonId: string): CarePlan | null {
  return plans.find((p) => p.clientPersonId === clientPersonId && p.state === "active") ?? null;
}

/**
 * The state the family portal shows.
 *
 * §20's rule holds: Joy determines status. This reads the plan rather than
 * asking anybody, and a client with no plan at all reads "not_started" rather
 * than an error — from a daughter's side those are the same situation.
 */
export function carePlanStateForFamily(
  plan: CarePlan | null,
): "not_started" | "in_review" | "current" {
  if (!plan) return "not_started";
  if (plan.state === "active") return "current";
  return plan.state === "in_review" ? "in_review" : "not_started";
}

/**
 * How often the plan has to be looked at again.
 *
 * Joy's own policy, like the incident notification windows, and flagged the
 * same way: the service agreement commits to an annual supervisory visit, and
 * a plan that has not been reviewed in a year is the thing that visit exists to
 * catch. Whether Joy's licence category requires it more often than annually is
 * for Karynn to confirm; changing it is one number.
 */
export const REVIEW_EVERY_MONTHS = 12;

export function reviewDueOn(plan: CarePlan): string | null {
  const from = plan.reviewedAt ?? plan.effectiveFrom;
  // Months rather than 365 days, and the shared helper rather than a third
  // copy of the arithmetic. Adding 365 days lands a day early whenever the
  // year it crosses contains a leap day, which would have shown two different
  // due dates in Joy for what the agreement calls one annual obligation.
  return from ? addMonths(from, REVIEW_EVERY_MONTHS) : null;
}

export function reviewOverdue(plan: CarePlan, today: string): boolean {
  const due = reviewDueOn(plan);
  return due !== null && plan.state === "active" && due < today;
}

// ------------------------------------------------------- the visit view --

/**
 * Which categories of task each service line covers.
 *
 * Held as data for the same reason the incident notification windows are: this
 * is Joy's definition of its own services, not a fact about the world, and the
 * one thing it must not be is a branch buried in a function.
 *
 * The problem it solves is concrete. A companion-care visit that lists
 * "Bathing" as a required task cannot be closed honestly — §11 will not let the
 * caregiver clock out until she answers it, and the honest answer is "that is
 * not what I am here for". Two visits later she is ticking boxes, which is
 * exactly the habit that makes a task list worthless.
 *
 * FOR KARYNN TO CONFIRM: whether a Companion Care visit at Joy is strictly
 * non-hands-on. The service agreement distinguishes the lines but does not list
 * tasks per line, so this is a starting point drawn from what the names mean
 * rather than from a document. Any service not listed here gets the whole plan,
 * which is the safe direction to be wrong in — a caregiver seeing a task that
 * does not apply can record "not needed today"; a caregiver never shown a task
 * cannot do anything at all.
 */
export const SERVICE_TASK_CATEGORIES: Record<string, readonly TaskCategory[]> = {
  "Companion Care": ["activity", "household"],
};

/**
 * The tasks for one visit, from the plan that was in effect on its date.
 *
 * Reading by date rather than taking the active plan matters when somebody
 * opens last week's visit: the tasks shown have to be the ones that were on
 * the plan that day, or the record disagrees with itself.
 */
export function tasksForVisit(input: {
  plans: readonly CarePlan[];
  clientPersonId: string;
  service: string;
  /** The visit's date, `YYYY-MM-DD`. */
  date: string;
}): PlanTask[] {
  const mine = input.plans.filter((p) => p.clientPersonId === input.clientPersonId);
  const plan = planInEffect(mine, input.date);
  if (!plan) return [];

  const allowed = SERVICE_TASK_CATEGORIES[input.service];
  return allowed ? plan.tasks.filter((t) => allowed.includes(t.category)) : [...plan.tasks];
}

// ------------------------------------------------------------- the queue --

/**
 * The RN's care-plan queue, in the same Needs You / Waiting / Moving Forward
 * shape the rest of Joy uses.
 *
 * The row that matters is `no_plan`. A client with visits on the schedule and
 * no active care plan is somebody receiving care that nobody has written down,
 * and before this module existed there was no screen anywhere in Joy that could
 * tell you it was happening — the caregiver's phone showed five invented tasks
 * and looked exactly like a client whose plan was current.
 */
export type CarePlanQueueReason =
  | "no_plan"
  | "review_overdue"
  | "first_plan_waiting"
  | "revision_waiting"
  | "draft_unfinished"
  | "current";

export const QUEUE_REASON_LABELS: Record<CarePlanQueueReason, string> = {
  no_plan: "No care plan",
  review_overdue: "Overdue for review",
  // Told apart from a revision on purpose. "A change is waiting" about somebody
  // whose care has not started yet is wrong in a way that costs time: it reads
  // as an adjustment to something already running.
  first_plan_waiting: "First plan waiting for you",
  revision_waiting: "A change is waiting for you",
  draft_unfinished: "Draft not finished",
  current: "Current",
};

export interface CarePlanQueueRow {
  clientPersonId: string;
  clientName: string;
  reason: CarePlanQueueReason;
  /** The plan being followed today, if there is one. */
  active: CarePlan | null;
  /** A draft or in-review revision, if one is in flight. */
  pending: CarePlan | null;
  /** True when somebody at Joy has to do something. */
  needsYou: boolean;
}

const REASON_ORDER: CarePlanQueueReason[] = [
  "no_plan",
  "review_overdue",
  "first_plan_waiting",
  "revision_waiting",
  "draft_unfinished",
  "current",
];

export function carePlanQueue(input: {
  /** Every client Joy is actually serving — usually derived from the schedule. */
  clients: ReadonlyArray<{ personId: string; name: string }>;
  plans: readonly CarePlan[];
  today: string;
}): CarePlanQueueRow[] {
  const rows = input.clients.map((client) => {
    const mine = input.plans.filter((p) => p.clientPersonId === client.personId);
    const active = mine.find((p) => p.state === "active") ?? null;
    const pending =
      mine.find((p) => p.state === "in_review") ?? mine.find((p) => p.state === "draft") ?? null;

    const reason: CarePlanQueueReason = !active
      ? pending
        ? "first_plan_waiting"
        : "no_plan"
      : reviewOverdue(active, input.today)
        ? "review_overdue"
        : pending?.state === "in_review"
          ? "revision_waiting"
          : pending?.state === "draft"
            ? "draft_unfinished"
            : "current";

    return {
      clientPersonId: client.personId,
      clientName: client.name,
      reason,
      active,
      pending,
      // A draft nobody has submitted is Joy's own unfinished work, not a
      // waiting queue: it is on somebody's desk and it is theirs to finish.
      needsYou: reason !== "current",
    };
  });

  return rows.sort(
    (a, b) =>
      REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason) ||
      a.clientName.localeCompare(b.clientName),
  );
}
