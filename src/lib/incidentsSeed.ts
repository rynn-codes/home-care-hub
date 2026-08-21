import { classifyIncident, incidentFromVisit, recordNotification, type Incident } from "@/domain/incidents/incidents";

/**
 * Incidents for the demo.
 *
 * Clients are fictional, as everywhere in this repository. Three deliberate
 * states, because an incident screen with nothing outstanding demonstrates
 * nothing: one reported hours ago that nobody has classified, one classified
 * with a notification already overdue, and one worked through and ready to
 * close.
 */

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

const untouched = incidentFromVisit({
  id: "inc-1",
  visitId: "v3",
  clientPersonId: "c-dolores",
  clientName: "Dolores Vance",
  reportedByPersonId: "p-thylia",
  reportedByName: "Thylia",
  narrative:
    "She stumbled getting up from her chair and sat back down hard. She said she was fine and " +
    "did not want me to call anyone. No mark on her that I could see.",
  at: hoursAgo(5),
});

const overdue = classifyIncident({
  incident: incidentFromVisit({
    id: "inc-2",
    visitId: "v5",
    clientPersonId: "c-edward",
    clientName: "Edward Pham",
    reportedByPersonId: "p-vanessa",
    reportedByName: "Vanessa",
    narrative:
      "I found his evening tablets still in the box when I arrived, so he had not taken the " +
      "lunchtime dose. I did not give it as it was too late in the day.",
    at: hoursAgo(9),
  }),
  kind: "medication_error",
  severity: "significant",
  byUserId: "u-karynn",
});

const nearlyDone = recordNotification({
  incident: classifyIncident({
    incident: incidentFromVisit({
      id: "inc-3",
      visitId: "v7",
      clientPersonId: "c-lian",
      clientName: "Lian Huang",
      reportedByPersonId: "p-chanel",
      reportedByName: "Chanel P.",
      narrative: "I knocked a lamp off the side table while moving the walker. The shade is bent.",
      at: hoursAgo(30),
    }),
    kind: "property_damage",
    severity: "minor",
    byUserId: "u-karynn",
  }),
  party: "administrator",
  note: "Told Karynn — replacing the shade.",
  byUserId: "u-karynn",
  at: hoursAgo(28),
});

export const seedIncidents: Incident[] = [untouched, overdue, nearlyDone];
