import { describe, expect, it } from "vitest";
import {
  annualIncidentLog,
  annualLogHeadline,
  yearsWithIncidents,
} from "@/domain/incidents/annualLog";
import {
  classifyIncident,
  closeIncident,
  incidentFromVisit,
  recordNotification,
  recordRnVisit,
  type Incident,
} from "@/domain/incidents/incidents";

const RN = "u-karynn";

function raise(at: string, id = "i1"): Incident {
  return incidentFromVisit({
    id,
    visitId: "v1",
    clientPersonId: "c1",
    clientName: "Marcus Bell",
    reportedByPersonId: "p1",
    reportedByName: "Jamisha",
    narrative: "He stumbled in the hallway and sat down hard.",
    at,
  });
}

function handled(at: string, id: string): Incident {
  let incident = classifyIncident({
    incident: raise(at, id),
    kind: "fall",
    severity: "significant",
    byUserId: RN,
  });
  for (const n of incident.notifications) {
    incident = recordNotification({
      incident,
      party: n.party,
      note: "Called",
      byUserId: RN,
      // Half an hour after the report: inside every window.
      at: new Date(Date.parse(at) + 30 * 60_000).toISOString(),
    });
  }
  incident = recordRnVisit({
    incident,
    findings: "Seen at home. No injury.",
    byUserId: RN,
    isRn: true,
    at: new Date(Date.parse(at) + 3 * 3_600_000).toISOString(),
  });
  return closeIncident({
    incident: { ...incident, findings: "Rug edge, now taped down." },
    byUserId: RN,
    at: new Date(Date.parse(at) + 2 * 86_400_000).toISOString(),
  });
}

describe("the yearly incident report", () => {
  it("is keyed on when it happened, not when the paperwork finished", () => {
    // An incident reported on 30 December and closed in January belongs to the
    // year it happened in. Filing it under the close date moves a bad December
    // into a clean January.
    const newYearsEve = handled("2025-12-30T09:00:00Z", "i-dec");
    expect(newYearsEve.closedAt!.slice(0, 4)).toBe("2026");

    expect(annualIncidentLog({ incidents: [newYearsEve], year: 2025 }).total).toBe(1);
    expect(annualIncidentLog({ incidents: [newYearsEve], year: 2026 }).total).toBe(0);
  });

  it("reads the incidents themselves rather than a register somebody keeps", () => {
    // A hand-kept log drifts from what it describes, and the copy handed to a
    // surveyor is then the one that drifted.
    const log = annualIncidentLog({
      incidents: [handled("2026-03-04T09:00:00Z", "a"), handled("2026-05-19T09:00:00Z", "b")],
      year: 2026,
    });
    expect(log.lines.map((l) => l.date)).toEqual(["2026-03-04", "2026-05-19"]);
    expect(log.lines[0].narrative).toContain("stumbled in the hallway");
  });

  it("counts what happened, by kind and by severity", () => {
    const log = annualIncidentLog({
      incidents: [handled("2026-03-04T09:00:00Z", "a"), handled("2026-05-19T09:00:00Z", "b")],
      year: 2026,
    });
    expect(log.byKind).toEqual([{ kind: "fall", label: "Fall", count: 2 }]);
    expect(log.bySeverity[0].severity).toBe("significant");
  });

  it("says when somebody was never told", () => {
    // The point of the register. One that lists what happened and not whether
    // Joy did what it said lets an agency look diligent through a bad year.
    const untouched = classifyIncident({
      incident: raise("2026-04-01T09:00:00Z", "c"),
      kind: "fall",
      severity: "significant",
      byUserId: RN,
    });
    const log = annualIncidentLog({ incidents: [untouched], year: 2026 });

    expect(log.lines[0].notifiedOnTime).toBe(false);
    expect(log.lines[0].missedNotifications).toContain("The administrator");
    expect(log.withMissedNotifications).toBe(1);
    expect(log.rnVisitsRequired).toBe(1);
    expect(log.rnVisitsOnTime).toBe(0);
  });

  it("tells a late notification apart from one never made", () => {
    let late = classifyIncident({
      incident: raise("2026-04-01T09:00:00Z", "d"),
      kind: "fall",
      severity: "significant",
      byUserId: RN,
    });
    for (const n of late.notifications) {
      late = recordNotification({
        incident: late,
        party: n.party,
        note: "Rang the next morning",
        byUserId: RN,
        at: "2026-04-02T09:00:00Z",
      });
    }
    const line = annualIncidentLog({ incidents: [late], year: 2026 }).lines[0];
    expect(line.missedNotifications).toEqual([]);
    expect(line.lateNotifications.length).toBeGreaterThan(0);
    expect(line.notifiedOnTime).toBe(false);
  });

  it("counts an incident nobody ever classified as its own problem", () => {
    const log = annualIncidentLog({ incidents: [raise("2026-06-01T09:00:00Z", "e")], year: 2026 });
    expect(log.neverClassified).toBe(1);
    expect(log.lines[0].kindLabel).toBe("Never classified");
    expect(log.openAtRun).toBe(1);
  });

  it("records how long each one took to close", () => {
    const log = annualIncidentLog({ incidents: [handled("2026-03-04T09:00:00Z", "a")], year: 2026 });
    expect(log.lines[0].daysToClose).toBe(2);
    expect(log.lines[0].closed).toBe(true);
  });
});

describe("the headline on the report", () => {
  it("says the bad number out loud", () => {
    // A summary that reads "14 incidents in 2026" and stops is a document that
    // gets signed without being read.
    const untouched = classifyIncident({
      incident: raise("2026-04-01T09:00:00Z", "c"),
      kind: "fall",
      severity: "significant",
      byUserId: RN,
    });
    const headline = annualLogHeadline(annualIncidentLog({ incidents: [untouched], year: 2026 }));
    expect(headline).toContain("somebody was never told");
    expect(headline).toContain("RN visit was late");
  });

  it("says so plainly when the year was clean", () => {
    const log = annualIncidentLog({ incidents: [handled("2026-03-04T09:00:00Z", "a")], year: 2026 });
    expect(annualLogHeadline(log)).toBe(
      "1 incident reported in 2026. Every obligation was met on time.",
    );
  });

  it("does not congratulate an empty year", () => {
    // No incidents is not the same as everything handled well, and a register
    // that says "every obligation met" over an empty year is misleading.
    expect(annualLogHeadline(annualIncidentLog({ incidents: [], year: 2026 }))).toBe(
      "No incidents were reported in 2026.",
    );
  });
});

describe("which years there are", () => {
  it("offers only years with something in them, newest first", () => {
    const years = yearsWithIncidents([
      handled("2026-03-04T09:00:00Z", "a"),
      handled("2024-11-02T09:00:00Z", "b"),
      handled("2026-05-19T09:00:00Z", "c"),
    ]);
    expect(years).toEqual([2026, 2024]);
  });
});
