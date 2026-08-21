
/**
 * A visit in progress — §10, §11, and §29's step 8.
 *
 * THE SERVER OWNS THE CLOCK
 *
 * §10: "The server should remain authoritative for official timestamps." Every
 * function here takes the time as an argument and none of them calls `new
 * Date()`. A caregiver's phone can be wrong by minutes, can be set deliberately,
 * and is the last thing that should decide what a timesheet says. The browser
 * asks to clock in; the server records when.
 *
 * That is also why `ClockState` distinguishes `requested` from `clocked_in`.
 * The moment between tapping and the server answering is real — on a phone in
 * somebody's driveway it can be several seconds, or fail — and a UI that
 * pretended otherwise would leave a caregiver believing she was on the clock
 * when she was not.
 *
 * §11'S COMPLETION CHECK
 *
 * "Before allowing normal clock-out, Joy should verify required visit
 * documentation." The goal is stated plainly: "prevent the office from chasing
 * missing documentation later."
 *
 * `blockedClockOut` is deliberately not the same as "make it impossible". A
 * caregiver whose shift has ended must always be able to stop working — holding
 * somebody on the clock because a form is unfinished is a wage problem, not a
 * compliance solution. So there is an override that records itself. See
 * `clockOutWithException`.
 */

export type ClockState = "not_started" | "requested" | "clocked_in" | "clocked_out";

export interface VisitClock {
  visitId: string;
  state: ClockState;
  /** Server time. Never the browser's. */
  clockedInAt: string | null;
  clockedOutAt: string | null;
  /** Set when clock-out happened with something outstanding. §11. */
  exceptionReason: string | null;
}

export function newClock(visitId: string): VisitClock {
  return {
    visitId,
    state: "not_started",
    clockedInAt: null,
    clockedOutAt: null,
    exceptionReason: null,
  };
}

// -------------------------------------------------------------- tasks --

/**
 * The care tasks on this visit, from the care plan.
 *
 * `required` marks the ones §11 checks before clock-out. Not everything is:
 * a client may decline a shower, and a caregiver must be able to record that
 * honestly rather than tick a box that says she did it.
 */
export interface CareTask {
  id: string;
  label: string;
  required: boolean;
}

export type TaskOutcome = "done" | "declined" | "not_needed";

export const TASK_OUTCOME_LABELS: Record<TaskOutcome, string> = {
  done: "Done",
  declined: "Client declined",
  not_needed: "Not needed today",
};

export interface VisitRecord {
  clock: VisitClock;
  /** Task id to what happened. Absent means not yet answered. */
  tasks: Record<string, TaskOutcome>;
  /** §12's free-text note, before AI drafting. */
  note: string;
  /** §11 asks about incidents explicitly rather than hoping for a mention. */
  incidentAnswered: boolean;
  incidentOccurred: boolean;
  incidentDetail: string;
}

export function newVisitRecord(visitId: string): VisitRecord {
  return {
    clock: newClock(visitId),
    tasks: {},
    note: "",
    incidentAnswered: false,
    incidentOccurred: false,
    incidentDetail: "",
  };
}

// -------------------------------------------------------------- clock --

export function requestClockIn(record: VisitRecord): VisitRecord {
  if (record.clock.state !== "not_started") return record;
  return { ...record, clock: { ...record.clock, state: "requested" } };
}

/** Called with the time the *server* recorded. */
export function confirmClockIn(record: VisitRecord, serverTime: string): VisitRecord {
  return {
    ...record,
    clock: { ...record.clock, state: "clocked_in", clockedInAt: serverTime },
  };
}

/** The request failed. Back to where we were, so nothing claims to be running. */
export function failClockIn(record: VisitRecord): VisitRecord {
  return { ...record, clock: { ...record.clock, state: "not_started" } };
}

// --------------------------------------------------- completion check --

export interface CompletionItem {
  label: string;
  complete: boolean;
}

export interface CompletionCheck {
  items: CompletionItem[];
  ready: boolean;
  /** The single thing to fix, when there is exactly one. §11's "ONE THING LEFT". */
  outstanding: string[];
}

/**
 * §11's checklist.
 *
 * The wording matters: these are stated as things reviewed, not things done, so
 * a declined shower still completes the item. Requiring "done" would push
 * somebody towards ticking a box that is not true, which is worse than the gap
 * it was meant to close.
 */
export function completionCheck(record: VisitRecord, tasks: readonly CareTask[]): CompletionCheck {
  const requiredTasks = tasks.filter((t) => t.required);
  const answered = requiredTasks.every((t) => record.tasks[t.id] !== undefined);

  const items: CompletionItem[] = [
    { label: "Required care tasks reviewed", complete: answered },
    { label: "Visit note complete", complete: record.note.trim().length > 0 },
    {
      label: "Incident question answered",
      complete: record.incidentAnswered && (!record.incidentOccurred || record.incidentDetail.trim().length > 0),
    },
  ];

  const outstanding = items.filter((i) => !i.complete).map((i) => i.label);
  return { items, ready: outstanding.length === 0, outstanding };
}

/** §11's message. One thing left reads differently from four. */
export function completionMessage(check: CompletionCheck): string {
  if (check.ready) return "Everything's done. You can clock out.";
  if (check.outstanding.length === 1) {
    const one = check.outstanding[0];
    if (one.startsWith("Visit note")) return "Your visit note is required before clock-out.";
    if (one.startsWith("Incident")) return "Please answer the incident question before clock-out.";
    return "Please review the care tasks before clock-out.";
  }
  return `${check.outstanding.length} things still need finishing before clock-out.`;
}

export function canClockOut(record: VisitRecord, tasks: readonly CareTask[]): boolean {
  return record.clock.state === "clocked_in" && completionCheck(record, tasks).ready;
}

export function clockOut(record: VisitRecord, serverTime: string): VisitRecord {
  return {
    ...record,
    clock: { ...record.clock, state: "clocked_out", clockedOutAt: serverTime },
  };
}

/**
 * Clock out with documentation outstanding.
 *
 * This exists because the alternative is worse. A caregiver whose shift ended
 * forty minutes ago, standing in a car park with a phone on 3%, must be able to
 * stop being on the clock. Refusing would either keep her on paid time she is
 * not working or push her to write something untrue to get past the check.
 *
 * So the exception is allowed and recorded, with what was missing. The office
 * chases one exception report rather than discovering the gap at audit — which
 * is the outcome §11 actually asks for.
 */
export function clockOutWithException(
  record: VisitRecord,
  tasks: readonly CareTask[],
  serverTime: string,
): VisitRecord {
  const check = completionCheck(record, tasks);
  return {
    ...record,
    clock: {
      ...record.clock,
      state: "clocked_out",
      clockedOutAt: serverTime,
      exceptionReason: check.ready ? null : `Clocked out with outstanding: ${check.outstanding.join("; ")}`,
    },
  };
}

// ------------------------------------------------------------ elapsed --

/** "4h 02m", for the clock on screen. Takes the time; does not read it. */
export function elapsed(clock: VisitClock, asOf: Date): string | null {
  if (!clock.clockedInAt) return null;
  const end = clock.clockedOutAt ? new Date(clock.clockedOutAt) : asOf;
  const ms = end.getTime() - new Date(clock.clockedInAt).getTime();
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/**
 * `tasksForVisit` used to live here and returned five hardcoded task labels.
 * It now lives in `@/domain/carePlan/plan` and reads the plan that was in
 * effect on the visit's date, so the caregiver's list, the family's care-plan
 * row and the RN's document are the same thing rather than three copies.
 */
