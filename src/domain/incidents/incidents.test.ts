import { describe, expect, it } from "vitest";
import {
  ALWAYS_SERIOUS,
  CLASSIFY_WITHIN_HOURS,
  NOTIFICATION_POLICY,
  classifyIncident,
  closeIncident,
  closeRefusals,
  incidentFromVisit,
  incidentUrgency,
  recordNotification,
  sortIncidents,
  type Incident,
  type IncidentKind,
} from "@/domain/incidents/incidents";

const REPORTED = "2026-08-20T09:00:00Z";

/** Clients are fictional throughout this repository. */
function reported(over: Partial<Incident> = {}): Incident {
  return {
    ...incidentFromVisit({
      id: "i1",
      visitId: "v1",
      clientPersonId: "c1",
      clientName: "Marcus Bell",
      reportedByPersonId: "p-jamisha",
      reportedByName: "Jamisha",
      narrative: "He stumbled in the hallway and sat down hard. No obvious injury.",
      at: REPORTED,
    }),
    ...over,
  };
}

function classified(kind: IncidentKind = "fall"): Incident {
  return classifyIncident({
    incident: reported(),
    kind,
    severity: "significant",
    byUserId: "u-karynn",
  });
}

describe("raising an incident", () => {
  it("keeps the caregiver's words and does not classify them", () => {
    // She said what happened. Deciding it is a fall rather than an injury is a
    // clinical judgement, and it should carry the RN's name.
    const incident = reported();
    expect(incident.narrative).toContain("stumbled in the hallway");
    expect(incident.kind).toBeNull();
    expect(incident.severity).toBeNull();
    expect(incident.state).toBe("reported");
  });

  it("refuses an incident with no account of what happened", () => {
    expect(() =>
      incidentFromVisit({
        id: "i1",
        visitId: "v1",
        clientPersonId: "c1",
        clientName: "Marcus Bell",
        reportedByPersonId: "p1",
        reportedByName: "J",
        narrative: "   ",
        at: REPORTED,
      }),
    ).toThrow(/account of what happened/);
  });
});

describe("classifying", () => {
  it("needs a name against it", () => {
    expect(() =>
      classifyIncident({ incident: reported(), kind: "fall", severity: "minor", byUserId: null }),
    ).toThrow(/needs a name against it/);
  });

  it("generates the notifications the kind requires", () => {
    const incident = classified("medication_error");
    expect(incident.notifications.map((n) => n.party)).toEqual(["rn", "physician", "family"]);
    expect(incident.state).toBe("under_review");
  });

  it("runs deadlines from when it was reported, not from when somebody looked", () => {
    // Otherwise an incident that sat unopened all weekend gets a fresh clock on
    // Monday, which is precisely backwards.
    const incident = classified("fall");
    const rn = incident.notifications.find((n) => n.party === "rn")!;
    expect(rn.dueBy).toBe("2026-08-20T10:00:00.000Z");
  });

  it("overrides severity for the kinds that are always serious", () => {
    // Nobody gets to file an allegation as minor.
    for (const kind of ALWAYS_SERIOUS) {
      const incident = classifyIncident({
        incident: reported(),
        kind,
        severity: "minor",
        byUserId: "u1",
      });
      expect(incident.severity).toBe("serious");
    }
  });

  it("puts an allegation in front of the owner within the hour", () => {
    const rules = NOTIFICATION_POLICY.allegation;
    expect(rules.find((r) => r.party === "administrator")?.withinHours).toBe(1);
    // And makes the state a separate, later obligation rather than merging them.
    expect(rules.some((r) => r.party === "state")).toBe(true);
  });
});

describe("what is overdue", () => {
  it("says nobody has looked at it, once that is true", () => {
    const later = "2026-08-20T12:00:00Z";
    const urgency = incidentUrgency(reported(), later);
    expect(urgency.unclassifiedFor).toBe(3);
    expect(urgency.headline).toContain("nobody has looked at it");
  });

  it("gives the office a moment before it starts complaining", () => {
    const soon = "2026-08-20T09:30:00Z";
    expect(incidentUrgency(reported(), soon).headline).toBe("Waiting to be classified");
    expect(CLASSIFY_WITHIN_HOURS).toBe(2);
  });

  it("names who should have been told", () => {
    const late = "2026-08-20T14:00:00Z";
    const urgency = incidentUrgency(classified("fall"), late);
    expect(urgency.overdue.length).toBeGreaterThan(0);
    expect(urgency.headline).toBe("The RN should have been told by now");
  });

  it("warns before the deadline rather than after", () => {
    const urgency = incidentUrgency(classified("fall"), "2026-08-20T09:30:00Z");
    expect(urgency.overdue).toEqual([]);
    expect(urgency.headline).toContain("within the hour");
  });

  it("says when it is ready to close", () => {
    let incident = classified("behavioural");
    incident = recordNotification({
      incident,
      party: "rn",
      note: "Called and discussed",
      byUserId: "u1",
      at: "2026-08-20T09:30:00Z",
    });
    expect(incidentUrgency(incident, "2026-08-20T10:00:00Z").headline).toContain("ready to close");
  });
});

describe("closing", () => {
  function notifiedAll(incident: Incident): Incident {
    return incident.notifications.reduce(
      (acc, n) =>
        recordNotification({
          incident: acc,
          party: n.party,
          note: "Done",
          byUserId: "u1",
          at: "2026-08-20T09:30:00Z",
        }),
      incident,
    );
  }

  it("refuses while anybody still has to be told", () => {
    const incident = classified("fall");
    expect(closeRefusals(incident)).toContain("notifications_outstanding");
    expect(() => closeIncident({ incident, byUserId: "u1", at: "x" })).toThrow(/still has to be told/);
  });

  it("refuses without findings", () => {
    // An incident nobody wrote a conclusion about was not investigated.
    const incident = notifiedAll(classified("fall"));
    expect(closeRefusals(incident)).toEqual(["no_findings"]);
  });

  it("does not require an action, because plenty of incidents need none", () => {
    // Forcing a sentence produces a file full of "no action required".
    const incident = { ...notifiedAll(classified("fall")), findings: "Rug edge, now taped down." };
    expect(closeRefusals(incident)).toEqual([]);
    expect(() => closeIncident({ incident, byUserId: "u1", at: "t" })).not.toThrow();
  });

  it("refuses an unclassified incident outright", () => {
    expect(closeRefusals(reported())).toContain("not_classified");
  });

  it("records who closed it and when", () => {
    const incident = { ...notifiedAll(classified("fall")), findings: "Rug edge." };
    const closed = closeIncident({ incident, byUserId: "u-karynn", at: "2026-08-21T09:00:00Z" });
    expect(closed.state).toBe("closed");
    expect(closed.closedByUserId).toBe("u-karynn");
  });
});

describe("the office queue", () => {
  it("puts overdue first, then unclassified, then in progress, then closed", () => {
    const now = "2026-08-20T14:00:00Z";
    const list: Incident[] = [
      { ...classified("fall"), id: "closed", state: "closed" },
      { ...reported(), id: "unclassified" },
      { ...classified("fall"), id: "overdue" },
    ];
    expect(sortIncidents(list, now).map((i) => i.id)).toEqual([
      "overdue",
      "unclassified",
      "closed",
    ]);
  });
});
