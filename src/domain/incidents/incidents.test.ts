import { describe, expect, it } from "vitest";
import {
  ALWAYS_SERIOUS,
  CLASSIFY_WITHIN_HOURS,
  NOTIFICATION_POLICY,
  RN_VISIT_WITHIN_HOURS,
  classifyIncident,
  closeIncident,
  closeRefusals,
  incidentFromVisit,
  incidentUrgency,
  recordNotification,
  recordRnVisit,
  rnVisitRequired,
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
    // The administrator is first and is on every kind — Karynn's rule, and it
    // is not in NOTIFICATION_POLICY because it does not wait for a kind.
    expect(incident.notifications.map((n) => n.party)).toEqual([
      "administrator",
      "rn",
      "physician",
      "family",
    ]);
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
    // The office was due within the hour of the report and is the oldest miss.
    expect(urgency.headline).toBe("The administrator should have been told by now");
  });

  it("warns before the deadline rather than after", () => {
    const urgency = incidentUrgency(classified("fall"), "2026-08-20T09:30:00Z");
    expect(urgency.overdue).toEqual([]);
    expect(urgency.headline).toContain("within the hour");
  });

  it("says when it is ready to close", () => {
    // Behavioural needs no RN visit, so telling the two parties is the whole of
    // it. Both, now — the office is always one of them.
    let incident = classified("behavioural");
    for (const party of ["administrator", "rn"] as const) {
      incident = recordNotification({
        incident,
        party,
        note: "Called and discussed",
        byUserId: "u1",
        at: "2026-08-20T09:30:00Z",
      });
    }
    expect(incidentUrgency(incident, "2026-08-20T10:00:00Z").headline).toContain("ready to close");
  });
});

describe("closing", () => {
  /** A nurse went out. Falls need one; see RN_VISIT_KINDS. */
  function visited(incident: Incident): Incident {
    return incident.rnVisit
      ? recordRnVisit({
          incident,
          findings: "Seen at home. No injury, walking normally.",
          byUserId: "u-karynn",
          isRn: true,
          at: "2026-08-20T15:00:00Z",
        })
      : incident;
  }

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
    const incident = visited(notifiedAll(classified("fall")));
    expect(closeRefusals(incident)).toEqual(["no_findings"]);
  });

  it("does not require an action, because plenty of incidents need none", () => {
    // Forcing a sentence produces a file full of "no action required".
    const incident = {
      ...visited(notifiedAll(classified("fall"))),
      findings: "Rug edge, now taped down.",
    };
    expect(closeRefusals(incident)).toEqual([]);
    expect(() => closeIncident({ incident, byUserId: "u1", at: "t" })).not.toThrow();
  });

  it("refuses an unclassified incident outright", () => {
    expect(closeRefusals(reported())).toContain("not_classified");
  });

  it("records who closed it and when", () => {
    const incident = { ...visited(notifiedAll(classified("fall"))), findings: "Rug edge." };
    const closed = closeIncident({ incident, byUserId: "u-karynn", at: "2026-08-21T09:00:00Z" });
    expect(closed.state).toBe("closed");
    expect(closed.closedByUserId).toBe("u-karynn");
  });
});

describe("the office queue", () => {
  it("puts a client no nurse has seen ahead of a call nobody made", () => {
    // Both are overdue. One of them means somebody may be hurt and unlooked at.
    const now = "2026-08-21T14:00:00Z";
    const noVisit = classified("fall");
    const callOnly: Incident = {
      // Property damage: an office notification and no RN visit.
      ...classified("property_damage"),
      id: "call-overdue",
    };
    const list: Incident[] = [callOnly, { ...noVisit, id: "unvisited" }];
    expect(sortIncidents(list, now).map((i) => i.id)).toEqual(["unvisited", "call-overdue"]);
  });

  it("puts overdue first, then unclassified, then closed", () => {
    // The unclassified row carries the office notification now, so it is
    // overdue too — it sorts on the report time rather than behind the
    // classified one.
    const now = "2026-08-20T14:00:00Z";
    const list: Incident[] = [
      { ...classified("behavioural"), id: "closed", state: "closed" },
      { ...reported(), id: "unclassified", reportedAt: "2026-08-20T11:00:00Z" },
      { ...classified("behavioural"), id: "overdue" },
    ];
    expect(sortIncidents(list, now).map((i) => i.id)).toEqual([
      "overdue",
      "unclassified",
      "closed",
    ]);
  });
});

describe("Karynn's rules, 21 August", () => {
  // "Incidents are important and myself/admin/operational staff needs to know
  // about an incident report. It needs to be logged on the yearly incident
  // report and depending on what it is, an RN visit needs to be made within 24
  // hours."

  it("puts the office on the hook the moment an incident is reported", () => {
    // Before this, an unclassified incident carried no notifications at all —
    // so one reported at ten at night and unclassified until morning was
    // nobody's, which is the exact situation her sentence is about.
    const incident = reported();
    expect(incident.notifications.map((n) => n.party)).toEqual(["administrator"]);
    expect(incident.notifications[0].dueBy).toBe("2026-08-20T10:00:00.000Z");
  });

  it("tells the office about every kind, not just the ones the policy lists", () => {
    for (const kind of Object.keys(NOTIFICATION_POLICY) as IncidentKind[]) {
      const incident = classifyIncident({
        incident: reported(),
        kind,
        severity: "minor",
        byUserId: "u1",
      });
      expect(incident.notifications.some((n) => n.party === "administrator"), kind).toBe(true);
    }
  });

  it("does not un-tell the office when somebody classifies it later", () => {
    // Classification used to rebuild the list from the policy, which would
    // have wiped a notification already made — and the record would then say
    // nobody rang Karynn about a fall somebody rang her about.
    const told = recordNotification({
      incident: reported(),
      party: "administrator",
      note: "Rang Karynn at 9:10.",
      byUserId: "u-oncall",
      at: "2026-08-20T09:10:00Z",
    });
    const classifiedLater = classifyIncident({
      incident: told,
      kind: "fall",
      severity: "significant",
      byUserId: "u-karynn",
    });
    const office = classifiedLater.notifications.find((n) => n.party === "administrator")!;
    expect(office.doneAt).toBe("2026-08-20T09:10:00Z");
    expect(office.note).toBe("Rang Karynn at 9:10.");
  });

  it("never buys anybody more time by classifying", () => {
    // property_damage's policy gives the administrator 24 hours; the report
    // itself gave one. The sooner deadline wins.
    const incident = classified("property_damage");
    const office = incident.notifications.find((n) => n.party === "administrator")!;
    expect(office.dueBy).toBe("2026-08-20T10:00:00.000Z");
  });

  it("requires an RN visit within 24 hours for the kinds that need one", () => {
    const fall = classified("fall");
    expect(fall.rnVisit).not.toBeNull();
    expect(fall.rnVisit!.dueBy).toBe("2026-08-21T09:00:00.000Z");
    expect(RN_VISIT_WITHIN_HOURS).toBe(24);
  });

  it("does not send a nurse out over a broken lamp", () => {
    expect(classified("property_damage").rnVisit).toBeNull();
    expect(classified("behavioural").rnVisit).toBeNull();
  });

  it("sends one for anything serious, whatever kind it is", () => {
    const serious = classifyIncident({
      incident: reported(),
      kind: "other",
      severity: "serious",
      byUserId: "u1",
    });
    expect(rnVisitRequired("other", "serious")).toBe(true);
    expect(serious.rnVisit).not.toBeNull();
  });

  it("runs the 24 hours from the report, like every other clock here", () => {
    // An incident nobody classified until Monday does not get a fresh 24 hours
    // on Monday.
    const late = classifyIncident({
      incident: reported(),
      kind: "fall",
      severity: "significant",
      byUserId: "u1",
    });
    expect(late.rnVisit!.dueBy < "2026-08-21T10:00:00Z").toBe(true);
  });

  it("will not let a phone call to the RN stand in for the visit", () => {
    // This is the distinction. Telling the RN at eleven at night is not
    // somebody going out to look at the client.
    let incident = classified("fall");
    for (const n of incident.notifications) {
      incident = recordNotification({
        incident,
        party: n.party,
        note: "Called",
        byUserId: "u1",
        at: "2026-08-20T09:30:00Z",
      });
    }
    incident = { ...incident, findings: "Rug edge." };
    expect(closeRefusals(incident)).toEqual(["rn_visit_outstanding"]);
    expect(() => closeIncident({ incident, byUserId: "u1", at: "t" })).toThrow(
      /RN still has to see the client/,
    );
  });

  it("says an unseen client is the headline, ahead of an unmade call", () => {
    const overdue = incidentUrgency(classified("fall"), "2026-08-22T09:00:00Z");
    expect(overdue.rnVisitOverdue).toBe(true);
    expect(overdue.headline).toBe("An RN should have seen the client by now");
  });

  it("only lets a registered nurse record the visit", () => {
    // Karynn: "Supervisory visits can only be done by an RN." The same rule
    // applies here, and it is a licence rather than a job title — see
    // domain/clinical/registeredNurse.ts.
    const incident = classified("fall");
    expect(() =>
      recordRnVisit({
        incident,
        findings: "Looked fine to me.",
        byUserId: "u-scheduler",
        isRn: false,
        at: "2026-08-20T15:00:00Z",
      }),
    ).toThrow(/registered nurse/);
  });

  it("will not record a visit with nothing written down", () => {
    expect(() =>
      recordRnVisit({
        incident: classified("fall"),
        findings: "   ",
        byUserId: "u-karynn",
        isRn: true,
        at: "2026-08-20T15:00:00Z",
      }),
    ).toThrow(/what you found/);
  });

  it("refuses a visit on an incident that does not need one", () => {
    expect(() =>
      recordRnVisit({
        incident: classified("property_damage"),
        findings: "Went anyway.",
        byUserId: "u-karynn",
        isRn: true,
        at: "2026-08-20T15:00:00Z",
      }),
    ).toThrow(/does not require an RN visit/);
  });
});
