import { reviewPlan, type CarePlan } from "@/domain/carePlan/plan";
import { addMonths, daysBetween } from "@/domain/dates";

/**
 * Supervisory visits.
 *
 * The service agreement commits Joy to supervising services annually, and the
 * client record has tracked that from the start — a row that goes amber sixty
 * days out and red when it passes. What it could not do was anything about it.
 * Nothing booked a supervisory visit, nothing recorded one, and nothing reset
 * the clock afterwards, so the row counted up from start of care forever: a
 * client supervised last month still read overdue, and an RN who did the work
 * had no way to say so. A compliance clock nobody can stop is a clock people
 * learn to ignore, which is worse than not having one.
 *
 * The connection worth noticing is that this and the care plan review are the
 * same trip. The RN goes out, watches the care being given, talks to the client
 * and comes back with a view on whether the plan still fits. Recording those as
 * two unrelated tasks means doing one and forgetting the other, so completing a
 * supervisory visit can mark the plan reviewed in the same action — and says on
 * screen that it did.
 */

export type SupervisionState = "due" | "booked" | "done";

export interface SupervisoryVisit {
  id: string;
  clientPersonId: string;
  clientName: string;
  /** ISO date the visit is booked for. Null while it is only due. */
  scheduledFor: string | null;
  /** Who is going. An RN or the owner — the same rule as a signature. */
  assignedToUserId: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  /** What the RN saw. Required to complete, for the same reason findings are. */
  findings: string | null;
  /** Whether the care plan was reviewed on the same visit. */
  carePlanReviewed: boolean;
}

/**
 * The agreement's commitment: annually — the same twelve months the client
 * record's `annual_supervision` row has always counted, through the same
 * shared helper, so the two cannot drift apart.
 */
export const SUPERVISE_EVERY_MONTHS = 12;

/** How far ahead the queue starts asking. Matches the client record's window. */
export const DUE_SOON_DAYS = 60;

// ------------------------------------------------------------ the clock --

export interface SupervisionStatus {
  clientPersonId: string;
  clientName: string;
  /** The date the next supervisory visit falls due. */
  dueOn: string;
  /** Negative once it has passed. */
  daysRemaining: number;
  state: SupervisionState;
  /** Set when one is booked and not yet done. */
  booked: SupervisoryVisit | null;
  /** The most recent completed visit, if there has been one. */
  last: SupervisoryVisit | null;
  needsYou: boolean;
}

/**
 * When the next supervisory visit is due for one client.
 *
 * Measured from the last completed visit, falling back to start of care. That
 * fallback is the whole fix: before it, there was nothing to measure from but
 * start of care, so the clock never reset.
 */
export function supervisionStatus(input: {
  clientPersonId: string;
  clientName: string;
  /** ISO date care began. */
  startOfCare: string;
  visits: readonly SupervisoryVisit[];
  today: string;
}): SupervisionStatus {
  const mine = input.visits.filter((v) => v.clientPersonId === input.clientPersonId);

  const completed = mine
    .filter((v) => v.completedAt)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
  const last = completed[0] ?? null;

  const booked =
    mine.find((v) => !v.completedAt && v.scheduledFor) ?? null;

  const from = last?.completedAt?.slice(0, 10) ?? input.startOfCare.slice(0, 10);
  const dueOn = addMonths(from, SUPERVISE_EVERY_MONTHS) ?? from;
  const daysRemaining = daysBetween(input.today, dueOn);

  const state: SupervisionState = booked ? "booked" : daysRemaining <= DUE_SOON_DAYS ? "due" : "done";

  return {
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    dueOn,
    daysRemaining,
    state,
    booked,
    last,
    // A booked visit is not somebody's problem this morning — it is on the
    // calendar. §5's rule: do not hand somebody a task for a wait that is
    // already being handled.
    needsYou: state === "due",
  };
}

export function supervisionQueue(input: {
  clients: ReadonlyArray<{ personId: string; name: string; startOfCare: string }>;
  visits: readonly SupervisoryVisit[];
  today: string;
}): SupervisionStatus[] {
  return input.clients
    .map((client) =>
      supervisionStatus({
        clientPersonId: client.personId,
        clientName: client.name,
        startOfCare: client.startOfCare,
        visits: input.visits,
        today: input.today,
      }),
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// --------------------------------------------------------------- actions --

export function bookSupervisoryVisit(input: {
  id: string;
  clientPersonId: string;
  clientName: string;
  scheduledFor: string;
  assignedToUserId: string;
}): SupervisoryVisit {
  return {
    id: input.id,
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    scheduledFor: input.scheduledFor,
    assignedToUserId: input.assignedToUserId,
    completedAt: null,
    completedByUserId: null,
    findings: null,
    carePlanReviewed: false,
  };
}

export type CompletionRefusal = "no_findings" | "already_done";

export const COMPLETION_MESSAGES: Record<CompletionRefusal, string> = {
  no_findings:
    "Write down what you saw. A supervisory visit with no findings is a date in a file and nothing else.",
  already_done: "This visit has already been recorded.",
};

export function completionRefusals(
  visit: SupervisoryVisit,
  findings: string,
): CompletionRefusal[] {
  const refusals: CompletionRefusal[] = [];
  if (visit.completedAt) refusals.push("already_done");
  if (!findings.trim()) refusals.push("no_findings");
  return refusals;
}

/**
 * Record a supervisory visit, and — when the RN reviewed the plan on the same
 * trip — mark the plan reviewed with the same person's name and the same
 * timestamp.
 *
 * Returned together rather than left to the caller to remember, because the
 * two records disagreeing is exactly the state this is meant to prevent: a
 * plan whose review clock says nobody has looked at it in a year, and a
 * supervisory visit from last week saying somebody did.
 */
export function completeSupervisoryVisit(input: {
  visit: SupervisoryVisit;
  findings: string;
  carePlanReviewed: boolean;
  plan: CarePlan | null;
  byUserId: string;
  at: string;
}): { visit: SupervisoryVisit; plan: CarePlan | null } {
  if (completionRefusals(input.visit, input.findings).length > 0) {
    return { visit: input.visit, plan: input.plan };
  }

  const visit: SupervisoryVisit = {
    ...input.visit,
    completedAt: input.at,
    completedByUserId: input.byUserId,
    findings: input.findings.trim(),
    carePlanReviewed: input.carePlanReviewed && input.plan !== null,
    // A visit recorded without having been booked is still a visit. The RN was
    // there; refusing the record because the paperwork order was wrong is how
    // work stops being written down.
    scheduledFor: input.visit.scheduledFor ?? input.at.slice(0, 10),
  };

  const plan =
    input.carePlanReviewed && input.plan
      ? reviewPlan({ plan: input.plan, byUserId: input.byUserId, at: input.at })
      : input.plan;

  return { visit, plan };
}

/** Plain English for the queue. */
export function supervisionHeadline(status: SupervisionStatus): string {
  if (status.booked?.scheduledFor) return `Booked for ${status.booked.scheduledFor}`;
  if (status.daysRemaining < 0) return `${Math.abs(status.daysRemaining)} days overdue`;
  if (status.daysRemaining === 0) return "Due today";
  if (status.daysRemaining <= DUE_SOON_DAYS) return `Due in ${status.daysRemaining} days`;
  return `Next due ${status.dueOn}`;
}
