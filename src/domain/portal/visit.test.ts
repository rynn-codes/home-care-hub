import { describe, expect, it } from "vitest";
import {
  canClockOut,
  clockOut,
  clockOutWithException,
  completionCheck,
  completionMessage,
  confirmClockIn,
  elapsed,
  failClockIn,
  newVisitRecord,
  requestClockIn,
  type CareTask,
  type VisitRecord,
} from "@/domain/portal/visit";

const TASKS: CareTask[] = [
  { id: "bathing", label: "Bathing assistance", required: true },
  { id: "housekeeping", label: "Light housekeeping", required: false },
];

function complete(over: Partial<VisitRecord> = {}): VisitRecord {
  return {
    ...newVisitRecord("v1"),
    clock: {
      visitId: "v1",
      state: "clocked_in",
      clockedInAt: "2026-08-20T09:01:00",
      clockedOutAt: null,
      exceptionReason: null,
    },
    tasks: { bathing: "done" },
    note: "Everything went well.",
    incidentAnswered: true,
    incidentOccurred: false,
    incidentDetail: "",
    ...over,
  };
}

describe("§10 — the server owns the clock", () => {
  it("does not consider somebody clocked in until the server says so", () => {
    // The gap between tapping and the server answering is real. A UI that
    // pretended otherwise leaves a caregiver believing she is on the clock.
    const requested = requestClockIn(newVisitRecord("v1"));
    expect(requested.clock.state).toBe("requested");
    expect(requested.clock.clockedInAt).toBeNull();
  });

  it("records the server's time, not the browser's", () => {
    const r = confirmClockIn(requestClockIn(newVisitRecord("v1")), "2026-08-20T09:01:07");
    expect(r.clock.clockedInAt).toBe("2026-08-20T09:01:07");
    expect(r.clock.state).toBe("clocked_in");
  });

  it("puts a failed request back where it started", () => {
    // Nothing should be left claiming to be running.
    const r = failClockIn(requestClockIn(newVisitRecord("v1")));
    expect(r.clock.state).toBe("not_started");
    expect(r.clock.clockedInAt).toBeNull();
  });

  it("ignores a second clock-in on a visit already under way", () => {
    const r = confirmClockIn(requestClockIn(newVisitRecord("v1")), "2026-08-20T09:01:00");
    expect(requestClockIn(r).clock.state).toBe("clocked_in");
  });

  it("computes elapsed time from the recorded stamps", () => {
    const r = complete();
    expect(elapsed(r.clock, new Date("2026-08-20T13:03:00"))).toBe("4h 02m");
  });

  it("freezes elapsed time at clock-out", () => {
    const out = clockOut(complete(), "2026-08-20T13:03:00");
    expect(elapsed(out.clock, new Date("2026-08-20T18:00:00"))).toBe("4h 02m");
  });
});

describe("§11 — the completion check", () => {
  it("will not clock out with the note unwritten", () => {
    expect(canClockOut(complete({ note: "" }), TASKS)).toBe(false);
  });

  it("will not clock out with a required task unanswered", () => {
    expect(canClockOut(complete({ tasks: {} }), TASKS)).toBe(false);
  });

  it("does not require an optional task to be answered", () => {
    expect(canClockOut(complete(), TASKS)).toBe(true);
  });

  it("counts a declined task as reviewed", () => {
    // Requiring 'done' pushes somebody towards ticking a box that is not true,
    // which is worse than the gap it was meant to close.
    expect(canClockOut(complete({ tasks: { bathing: "declined" } }), TASKS)).toBe(true);
  });

  it("insists on detail once an incident is reported", () => {
    const r = complete({ incidentOccurred: true, incidentDetail: "" });
    expect(canClockOut(r, TASKS)).toBe(false);
    expect(canClockOut({ ...r, incidentDetail: "She stumbled in the hall." }, TASKS)).toBe(true);
  });

  it("treats an unanswered incident question as outstanding", () => {
    // §11 asks explicitly rather than hoping for a mention in the note.
    expect(canClockOut(complete({ incidentAnswered: false }), TASKS)).toBe(false);
  });

  it("names the one thing left, when there is one", () => {
    const check = completionCheck(complete({ note: "" }), TASKS);
    expect(completionMessage(check)).toBe("Your visit note is required before clock-out.");
  });

  it("counts them when there is more than one", () => {
    const check = completionCheck(complete({ note: "", tasks: {} }), TASKS);
    expect(completionMessage(check)).toBe("2 things still need finishing before clock-out.");
  });

  it("says so when everything is done", () => {
    expect(completionMessage(completionCheck(complete(), TASKS))).toContain("You can clock out");
  });
});

describe("the exception", () => {
  it("lets somebody stop working, and records why", () => {
    // A caregiver forty minutes past the end of her shift with a phone on 3%
    // must be able to stop being on the clock. Refusing keeps her on paid time
    // she is not working, or pushes her to write something untrue.
    const out = clockOutWithException(complete({ note: "" }), TASKS, "2026-08-20T13:40:00");
    expect(out.clock.state).toBe("clocked_out");
    expect(out.clock.clockedOutAt).toBe("2026-08-20T13:40:00");
    expect(out.clock.exceptionReason).toContain("Visit note complete");
  });

  it("records no exception when there was nothing outstanding", () => {
    const out = clockOutWithException(complete(), TASKS, "2026-08-20T13:03:00");
    expect(out.clock.exceptionReason).toBeNull();
  });

  it("names everything that was missing, not just the first", () => {
    const out = clockOutWithException(complete({ note: "", tasks: {} }), TASKS, "2026-08-20T13:40:00");
    expect(out.clock.exceptionReason).toContain("care tasks");
    expect(out.clock.exceptionReason).toContain("Visit note");
  });
});
