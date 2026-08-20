import { describe, expect, it } from "vitest";
import {
  buildPortalQueue,
  portalQueueSummary,
  queueCounts,
  type OfficeQueueInput,
} from "@/domain/portal/officeQueue";
import { draftMoment, type Moment } from "@/domain/portal/moments";
import { issueInvitation, type Invitation } from "@/domain/hiring/invitation";
import { proposePreference } from "@/domain/portal/preferences";
import type { TimeEntry } from "@/domain/payroll/hours";

const ASOF = "2026-08-20";

const NAMES: Record<string, string> = {
  "p-jamisha": "Jamisha",
  "p-susan": "Susan",
};

function moment(over: Partial<Moment> = {}): Moment {
  return {
    ...draftMoment({
      id: "m1",
      visitId: "v1",
      clientPersonId: "c1",
      narrative: "He beat me at chess.",
      byPersonId: "p-jamisha",
      at: "2026-08-19T13:00:00Z",
    }),
    ...over,
  };
}

function invitation(over: Partial<Invitation> = {}): Invitation {
  return {
    ...issueInvitation({
      id: "i1",
      applicantId: "a1",
      phone: "+17135550100",
      token: "tok",
      byUserId: "u1",
      asOf: "2026-08-19",
    }),
    ...over,
  };
}

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "t1",
    visitId: "v1",
    caregiverPersonId: "p-jamisha",
    clockedInAt: "2026-08-19T09:00:00",
    clockedOutAt: "2026-08-19T13:00:00",
    exceptionReason: null,
    ...over,
  };
}

function build(over: Partial<OfficeQueueInput> = {}) {
  return buildPortalQueue({
    moments: [],
    preferences: [],
    timeEntries: [],
    invitations: [],
    documentRequests: [],
    nameFor: (id) => NAMES[id] ?? id,
    asOf: ASOF,
    ...over,
  });
}

describe("what needs the office", () => {
  it("queues a drafted moment for review", () => {
    // Karynn's rule: only wording a model produced needs a second pair of eyes.
    const items = build({ moments: [moment({ origin: "ai_drafted" })] });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("moment_review");
    expect(items[0].group).toBe("needs_you");
  });

  it("does not queue a caregiver's own words", () => {
    // Her own sentence goes straight out. Queueing it would recreate the
    // review step she chose against.
    expect(build({ moments: [moment({ origin: "caregiver" })] })).toEqual([]);
  });

  it("surfaces a clock-out that left paperwork outstanding", () => {
    // Payroll pays these — she worked the hours. What is left is the office
    // chasing the note, which is this item and nowhere else.
    const items = build({
      timeEntries: [entry({ exceptionReason: "Clocked out with outstanding: Visit note complete" })],
    });
    expect(items[0].kind).toBe("clock_exception");
    expect(items[0].subject).toBe("Jamisha");
  });

  it("ignores a clean time entry", () => {
    expect(build({ timeEntries: [entry()] })).toEqual([]);
  });

  it("queues a suggested preference and says who suggested it", () => {
    const preference = proposePreference({
      id: "pr1",
      clientPersonId: "c1",
      text: "Likes gospel music in the morning",
      byPersonId: "p-susan",
      source: "family",
      at: "2026-08-18T10:00:00Z",
    });
    const items = build({ preferences: [preference] });
    expect(items[0].kind).toBe("preference_review");
    expect(items[0].detail).toContain("Suggested by the family");
    expect(items[0].subject).toBe("Susan");
  });

  it("does not queue a preference somebody already approved", () => {
    const office = proposePreference({
      id: "pr2",
      clientPersonId: "c1",
      text: "Coffee with one cream",
      byPersonId: "p-karynn",
      source: "office",
      at: "2026-08-18T10:00:00Z",
    });
    expect(build({ preferences: [office] })).toEqual([]);
  });

  it("puts an expired invitation in front of somebody", () => {
    // Nobody else is going to notice. The candidate cannot use the link and
    // has no way to tell Joy.
    const items = build({ invitations: [invitation({ expiresAt: "2026-08-10" })] });
    expect(items[0].kind).toBe("invitation_expired");
    expect(items[0].group).toBe("needs_you");
  });
});

describe("what is with somebody else", () => {
  it("waits on an unopened invitation rather than nagging the office", () => {
    const items = build({ invitations: [invitation()] });
    expect(items[0].group).toBe("waiting");
    expect(items[0].detail).toContain("Give it a day");
  });

  it("changes its advice once it has been resent", () => {
    const resent = invitation({
      sends: [
        { at: "2026-08-19", byUserId: "u1" },
        { at: "2026-08-20", byUserId: "u1" },
      ],
    });
    expect(build({ invitations: [resent] })[0].detail).toContain("Worth a phone call");
  });

  it("waits on a document the family has not sent", () => {
    const items = build({
      documentRequests: [
        { id: "d1", label: "Medication list", state: "needed", reason: "The nurse needs it." },
      ],
    });
    expect(items[0].group).toBe("waiting");
    expect(items[0].headline).toBe("Waiting on medication list");
  });

  it("says nothing about a document already received", () => {
    expect(
      build({
        documentRequests: [{ id: "d1", label: "Advance directive", state: "accepted", reason: null }],
      }),
    ).toEqual([]);
  });
});

describe("what is going well", () => {
  it("shows moments that reached the family", () => {
    // A queue that only lists problems trains people to read it as a complaint.
    const shared = moment({ state: "shared", sharedAt: "2026-08-20T09:00:00Z" });
    const items = build({ moments: [shared] });
    expect(items[0].group).toBe("moving_forward");
    expect(items[0].kind).toBe("moment_shared");
  });
});

describe("ordering and counts", () => {
  it("puts what has waited longest first", () => {
    const items = build({
      moments: [
        moment({ id: "new", origin: "ai_drafted", createdAt: "2026-08-20T09:00:00Z" }),
        moment({ id: "old", origin: "ai_drafted", createdAt: "2026-08-14T09:00:00Z" }),
      ],
    });
    expect(items.map((i) => i.id)).toEqual(["moment-old", "moment-new"]);
  });

  it("counts each group", () => {
    const items = build({
      moments: [
        moment({ id: "a", origin: "ai_drafted" }),
        moment({ id: "b", state: "shared", sharedAt: "2026-08-20T09:00:00Z" }),
      ],
      invitations: [invitation()],
    });
    expect(queueCounts(items)).toEqual({ needsYou: 1, waiting: 1, movingForward: 1 });
  });

  it("leads with what needs somebody", () => {
    const items = build({ moments: [moment({ origin: "ai_drafted" })], invitations: [invitation()] });
    expect(portalQueueSummary(items)).toBe("One thing from the portals needs you.");
  });

  it("says where things stand when nothing needs the office", () => {
    expect(portalQueueSummary(build({ invitations: [invitation()] }))).toContain(
      "1 thing is with a caregiver or family",
    );
    expect(portalQueueSummary(build())).toBe("Nothing from the portals needs you.");
  });
});
