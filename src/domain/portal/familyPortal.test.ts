import { describe, expect, it } from "vitest";
import {
  admissionLines,
  careTeam,
  familyNext,
  familySchedule,
  type AdmissionProgress,
} from "@/domain/portal/familyPortal";
import type { Visit } from "@/domain/scheduling/conflicts";

/** Clients are fictional throughout this repository. */
function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Marcus Bell",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-24T09:00:00",
    endsAt: "2026-08-24T13:00:00",
    ...over,
  };
}

function progress(over: Partial<AdmissionProgress> = {}): AdmissionProgress {
  return {
    assessmentComplete: true,
    serviceAgreementSigned: true,
    paymentSetUp: true,
    carePlanState: "in_review",
    startOfCare: "Monday",
    requestedDocuments: [],
    awaitingSignature: [],
    ...over,
  };
}

const BEFORE = new Date("2026-08-20T12:00:00");

function line(lines: ReturnType<typeof admissionLines>, label: string) {
  return lines.find((l) => l.label === label);
}

describe("§20 — Joy determines status", () => {
  it("never invents a start date to fill the row", () => {
    // The one line on this screen a family will plan around.
    expect(line(admissionLines(progress({ startOfCare: null })), "Start of care")?.value).toBe(
      "To be confirmed",
    );
  });

  it("counts only the documents still outstanding", () => {
    const p = progress({
      requestedDocuments: [
        { id: "1", label: "Medication list", state: "needed", reason: null },
        { id: "2", label: "Advance directive", state: "accepted", reason: null },
      ],
    });
    expect(line(admissionLines(p), "Documents")?.value).toBe("1 still needed");
  });

  it("says nothing is needed when nothing was asked for", () => {
    expect(line(admissionLines(progress()), "Documents")?.value).toBe("Nothing needed");
  });
});

describe("§30 — the one thing next", () => {
  it("puts a signature ahead of a document request", () => {
    const next = familyNext(
      progress({
        awaitingSignature: ["Service agreement"],
        requestedDocuments: [{ id: "1", label: "Medication list", state: "needed", reason: null }],
      }),
      "Marcus",
    );
    expect(next.headline).toContain("Service agreement");
    expect(next.action?.label).toBe("Review & sign");
  });

  it("names the document and the person it is for", () => {
    const next = familyNext(
      progress({
        requestedDocuments: [{ id: "1", label: "Medication list", state: "needed", reason: null }],
      }),
      "Marcus",
    );
    expect(next.headline).toBe("Please upload Marcus's medication list");
  });

  it("gives the reason the office supplied, when there is one", () => {
    // A family asked to go and find paperwork deserves to know why.
    const next = familyNext(
      progress({
        requestedDocuments: [
          {
            id: "1",
            label: "Medication list",
            state: "needed",
            reason: "The nurse needs it before the care plan is finished.",
          },
        ],
      }),
      "Marcus",
    );
    expect(next.detail).toContain("before the care plan is finished");
  });

  it("hands a family no button for something Joy is doing", () => {
    // §5's rule applies on this side too: a button implies the wait is yours.
    const next = familyNext(progress({ carePlanState: "in_review" }), "Marcus");
    expect(next.action).toBeNull();
    expect(next.detail).toContain("Nothing is needed from you");
  });
});

describe("§24 — what a family must not see", () => {
  it("shows an unstaffed visit as scheduled, with no explanation", () => {
    // Not "unassigned", not "seeking cover", not a warning. A family reading
    // that Joy has nobody is reading an internal staffing note, and will ring
    // the on-call phone about a gap that closes on Monday morning.
    const [v] = familySchedule({
      visits: [visit({ caregiverName: null })],
      clientName: "Marcus Bell",
      asOf: BEFORE,
    });
    expect(v.state).toBe("scheduled");
    expect(v.caregiverName).toBeNull();
  });

  it("names the caregiver once there is one", () => {
    const [v] = familySchedule({ visits: [visit()], clientName: "Marcus Bell", asOf: BEFORE });
    expect(v.state).toBe("caregiver_assigned");
    expect(v.caregiverName).toBe("Jamisha");
  });

  it("shows nobody else's visits", () => {
    const schedule = familySchedule({
      visits: [visit(), visit({ id: "other", clientName: "Someone else" })],
      clientName: "Marcus Bell",
      asOf: BEFORE,
    });
    expect(schedule.map((v) => v.id)).toEqual(["v1"]);
  });

  it("keeps a live visit off the family screen unless Joy opts in", () => {
    // §24: "only if Joy chooses to expose it."
    const hidden = familySchedule({
      visits: [visit()],
      clientName: "Marcus Bell",
      asOf: BEFORE,
      inProgressVisitIds: ["v1"],
    });
    expect(hidden[0].state).toBe("caregiver_assigned");

    const shown = familySchedule({
      visits: [visit()],
      clientName: "Marcus Bell",
      asOf: BEFORE,
      inProgressVisitIds: ["v1"],
      options: { showInProgress: true },
    });
    expect(shown[0].state).toBe("in_progress");
  });

  it("marks a past visit completed without being told", () => {
    const after = new Date("2026-08-24T18:00:00");
    const [v] = familySchedule({ visits: [visit()], clientName: "Marcus Bell", asOf: after });
    expect(v.state).toBe("completed");
  });

  it("exposes only the fields a family needs", () => {
    // The office's Visit carries more than this. Passing it through is how an
    // internal field ends up on a family's phone.
    const [v] = familySchedule({ visits: [visit()], clientName: "Marcus Bell", asOf: BEFORE });
    expect(Object.keys(v).sort()).toEqual([
      "caregiverName",
      "id",
      "service",
      "state",
      "timeRange",
      "when",
    ]);
  });
});

describe("§23 — care team", () => {
  it("is built from who is actually coming", () => {
    // A separately maintained list drifts, and the first a family knows is a
    // stranger at the door.
    const team = careTeam(
      [
        visit({ id: "a", caregiverName: "Jamisha" }),
        visit({ id: "b", caregiverName: "Jamisha" }),
        visit({ id: "c", caregiverName: "Maria" }),
      ],
      "Marcus Bell",
    );
    expect(team.map((m) => [m.name, m.role])).toEqual([
      ["Jamisha", "Primary caregiver"],
      ["Maria", "Caregiver"],
    ]);
  });

  it("leaves an unstaffed visit out of the team entirely", () => {
    expect(careTeam([visit({ caregiverName: null })], "Marcus Bell")).toEqual([]);
  });

  it("does not list a caregiver from somebody else's visits", () => {
    expect(
      careTeam([visit({ clientName: "Someone else", caregiverName: "Nobody" })], "Marcus Bell"),
    ).toEqual([]);
  });
});
