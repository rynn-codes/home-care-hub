import { describe, expect, it } from "vitest";
import {
  VARIANCE_MINUTES,
  billableHours,
  payableHours,
  reviseUnit,
  sortForReview,
  suggestedMinutes,
  unitForVisit,
  unitFromVisit,
  verifyRefusals,
  verifyUnit,
  type VerifiedServiceUnit,
} from "@/domain/service/verifiedUnit";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { TimeEntry } from "@/domain/payroll/hours";

const RN = "u-karynn";

/** Clients are fictional throughout this repository. */
function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Marcus Bell",
    clientPersonId: "c-1",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-17T09:00:00",
    endsAt: "2026-08-17T13:00:00",
    ...over,
  };
}

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "t1",
    visitId: "v1",
    caregiverPersonId: "p-jamisha",
    clockedInAt: "2026-08-17T09:00:00",
    clockedOutAt: "2026-08-17T13:00:00",
    exceptionReason: null,
    ...over,
  };
}

function unit(over: { visit?: Partial<Visit>; entry?: Partial<TimeEntry> | null } = {}) {
  return unitFromVisit({
    id: "vsu-1",
    organizationId: "org-1",
    visit: visit(over.visit),
    entry: over.entry === null ? null : entry(over.entry),
  });
}

describe("building the record from what happened", () => {
  it("takes scheduled from the board and actual from the clock", () => {
    const u = unit();
    expect(u.scheduledMinutes).toBe(240);
    expect(u.actualMinutes).toBe(240);
    expect(u.exceptions).toEqual([]);
  });

  it("approves nothing on its own", () => {
    // A figure that appears without anybody choosing it is a figure everybody
    // assumes somebody checked.
    const u = unit();
    expect(u.approvedPayableMinutes).toBeNull();
    expect(u.approvedBillableMinutes).toBeNull();
    expect(u.state).toBe("proposed");
  });

  it("has no actual when nobody clocked in or out", () => {
    expect(unit({ entry: null }).actualMinutes).toBeNull();
    expect(unit({ entry: null }).exceptions).toContain("no_clock_in");
    expect(unit({ entry: { clockedOutAt: null } }).exceptions).toContain("no_clock_out");
  });

  it("records outstanding paperwork as its own exception, not as unworked time", () => {
    // Karynn, on the caregiver who clocks out with documentation outstanding:
    // "Let her out, record the gap." She worked the time; the gap is separate.
    const u = unit({ entry: { exceptionReason: "Visit note not written" } });
    expect(u.exceptions).toEqual(["documentation_outstanding"]);
    expect(u.actualMinutes).toBe(240);
  });

  it("ignores a few minutes either way", () => {
    // Fifteen minutes is traffic, or staying to finish a conversation. Flagging
    // it would make the exception list meaningless.
    expect(VARIANCE_MINUTES).toBe(15);
    const short = unit({ entry: { clockedOutAt: "2026-08-17T12:50:00" } });
    expect(short.exceptions).toEqual([]);
  });

  it("flags a visit much shorter or much longer than booked", () => {
    const short = unit({ entry: { clockedOutAt: "2026-08-17T11:00:00" } });
    expect(short.exceptions).toContain("much_shorter_than_scheduled");

    const long = unit({ entry: { clockedOutAt: "2026-08-17T14:00:00" } });
    expect(long.exceptions).toContain("much_longer_than_scheduled");
  });
});

describe("suggesting, which is not approving", () => {
  it("follows the clock for both figures", () => {
    expect(suggestedMinutes(unit())).toEqual({ payable: 240, billable: 240 });
  });

  it("suggests nothing when the worked time is unknown", () => {
    // There is no honest guess between "she was there four hours" and "nobody
    // closed the clock".
    expect(suggestedMinutes(unit({ entry: { clockedOutAt: null } }))).toEqual({
      payable: null,
      billable: null,
    });
  });
});

describe("verifying", () => {
  it("needs a name against it", () => {
    expect(
      verifyRefusals({
        unit: unit(),
        payableMinutes: 240,
        billableMinutes: 240,
        byUserId: null,
        note: "",
      }),
    ).toContain("no_approver");
  });

  it("records both figures and who approved them", () => {
    const verified = verifyUnit({
      unit: unit(),
      payableMinutes: 240,
      billableMinutes: 240,
      byUserId: RN,
      note: "",
      at: "2026-08-18T09:00:00Z",
    });
    expect(verified.state).toBe("verified");
    expect(verified.verifiedByUserId).toBe(RN);
    expect(payableHours(verified)).toBe(4);
    expect(billableHours(verified)).toBe(4);
  });

  it("will not let the two figures differ without a reason", () => {
    // The difference IS the decision, and a decision with no reason recorded is
    // one nobody can defend later — to a family, a caregiver or a surveyor.
    expect(
      verifyRefusals({
        unit: unit(),
        payableMinutes: 280,
        billableMinutes: 240,
        byUserId: RN,
        note: "  ",
      }),
    ).toContain("unexplained_difference");
  });

  it("allows them to differ when somebody says why", () => {
    // The case from the file comment: she stayed forty minutes late because the
    // family asked. Payable; billing it is a conversation.
    const verified = verifyUnit({
      unit: unit({ entry: { clockedOutAt: "2026-08-17T13:40:00" } }),
      payableMinutes: 280,
      billableMinutes: 240,
      byUserId: RN,
      note: "Stayed 40 minutes at the daughter's request. Not billed — goodwill.",
      at: "2026-08-18T09:00:00Z",
    });
    expect(payableHours(verified)).toBe(4.67);
    expect(billableHours(verified)).toBe(4);
    expect(verified.note).toContain("goodwill");
  });

  it("refuses to approve unclocked time on nobody's say-so", () => {
    expect(
      verifyRefusals({
        unit: unit({ entry: { clockedOutAt: null } }),
        payableMinutes: 240,
        billableMinutes: 240,
        byUserId: RN,
        note: "",
      }),
    ).toContain("no_worked_time");
  });

  it("but allows it when somebody says what happened", () => {
    // This used to be refused outright, which left the caregiver who worked and
    // whose clock recorded nothing with no route to payroll at all — the run
    // stayed blocked and there was nowhere to record the decision that would
    // unblock it. The figure is somebody asserting a fact the system did not
    // observe, so it needs a reason, not a prohibition.
    expect(
      verifyRefusals({
        unit: unit({ entry: { clockedOutAt: null } }),
        payableMinutes: 240,
        billableMinutes: 240,
        byUserId: RN,
        note: "She worked the full visit; the app did not record her clock-out.",
      }),
    ).not.toContain("no_worked_time");
  });

  it("refuses to verify the same visit twice", () => {
    const verified = verifyUnit({
      unit: unit(),
      payableMinutes: 240,
      billableMinutes: 240,
      byUserId: RN,
      note: "",
      at: "2026-08-18T09:00:00Z",
    });
    expect(
      verifyRefusals({
        unit: verified,
        payableMinutes: 200,
        billableMinutes: 200,
        byUserId: RN,
        note: "",
      }),
    ).toContain("already_verified");
  });
});

describe("neither ledger reads an unapproved figure", () => {
  it("gives payroll nothing until somebody has approved it", () => {
    // Payroll paying on an unapproved figure is payroll paying on a number
    // nobody checked, which is the whole thing this record exists to stop.
    expect(payableHours(unit())).toBeNull();
    expect(billableHours(unit())).toBeNull();
  });

  it("gives them nothing from a superseded record either", () => {
    const verified = verifyUnit({
      unit: unit(),
      payableMinutes: 240,
      billableMinutes: 240,
      byUserId: RN,
      note: "",
      at: "2026-08-18T09:00:00Z",
    });
    const { superseded } = reviseUnit({
      unit: verified,
      id: "vsu-2",
      reason: "Clock-out was wrong",
      byUserId: RN,
      at: "2026-08-19T09:00:00Z",
    });
    expect(payableHours(superseded)).toBeNull();
  });
});

describe("correcting a verified visit", () => {
  const verified = verifyUnit({
    unit: unit(),
    payableMinutes: 240,
    billableMinutes: 240,
    byUserId: RN,
    note: "",
    at: "2026-08-18T09:00:00Z",
  });

  it("makes a new record rather than overwriting the old one", () => {
    // Payroll may already have paid on the old figure and an invoice may
    // already have gone out from it. Overwriting leaves both ledgers pointing
    // at a record that no longer says what they acted on.
    const { superseded, revision } = reviseUnit({
      unit: verified,
      id: "vsu-2",
      reason: "She corrected her clock-out the next morning.",
      byUserId: RN,
      at: "2026-08-19T09:00:00Z",
    });

    expect(superseded.state).toBe("superseded");
    expect(superseded.supersededBy).toBe("vsu-2");
    expect(superseded.approvedPayableMinutes).toBe(240);
    expect(revision.state).toBe("proposed");
  });

  it("makes the revision earn its own approval", () => {
    // Carrying the old one forward would put somebody's name against figures
    // they never saw.
    const { revision } = reviseUnit({
      unit: verified,
      id: "vsu-2",
      reason: "Corrected clock-out",
      byUserId: RN,
      at: "2026-08-19T09:00:00Z",
    });
    expect(revision.verifiedByUserId).toBeNull();
    expect(revision.approvedPayableMinutes).toBeNull();
  });

  it("needs a reason", () => {
    expect(() =>
      reviseUnit({ unit: verified, id: "vsu-2", reason: " ", byUserId: RN, at: "x" }),
    ).toThrow(/needs a reason/);
  });

  it("leaves the current record findable and the old one not", () => {
    const { superseded, revision } = reviseUnit({
      unit: verified,
      id: "vsu-2",
      reason: "Corrected clock-out",
      byUserId: RN,
      at: "2026-08-19T09:00:00Z",
    });
    expect(unitForVisit([superseded, revision], "v1")?.id).toBe("vsu-2");
  });
});

describe("the review queue", () => {
  it("puts exceptions first", () => {
    const clean = { ...unit(), id: "a", visitId: "a" };
    const flagged: VerifiedServiceUnit = {
      ...unit({ entry: { clockedOutAt: null } }),
      id: "b",
      visitId: "b",
    };
    expect(sortForReview([clean, flagged]).map((u) => u.id)).toEqual(["b", "a"]);
  });

  it("leaves out anything already verified", () => {
    const verified = verifyUnit({
      unit: unit(),
      payableMinutes: 240,
      billableMinutes: 240,
      byUserId: RN,
      note: "",
      at: "2026-08-18T09:00:00Z",
    });
    expect(sortForReview([verified])).toEqual([]);
  });
});
