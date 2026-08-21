import {
  classifyIncident,
  closeIncident,
  incidentFromVisit,
  recordNotification,
  recordRnVisit,
  type Incident,
} from "@/domain/incidents/incidents";

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

/**
 * A fall from two days ago where the RN visit was made.
 *
 * Karynn, 21 August: "depending on what it is, an RN visit needs to be made
 * within 24 hours." Without one of these in the seed the yearly report would
 * show nothing but misses, and a screen that can only display failure
 * demonstrates as little as one that can only display success.
 */
const handledProperly = recordRnVisit({
  incident: (() => {
    let incident = classifyIncident({
      incident: incidentFromVisit({
        id: "inc-4",
        visitId: "v1",
        clientPersonId: "c-lian",
        clientName: "Lian Huang",
        reportedByPersonId: "p-chanel",
        reportedByName: "Chanel P.",
        narrative:
          "She lost her balance coming out of the bathroom and caught herself on the grab bar. " +
          "She did not go down. I stayed with her until she was settled.",
        at: hoursAgo(50),
      }),
      kind: "fall",
      severity: "minor",
      byUserId: "u-karynn",
    });
    for (const n of incident.notifications) {
      incident = recordNotification({
        incident,
        party: n.party,
        note: "Called",
        byUserId: "u-karynn",
        at: hoursAgo(49),
      });
    }
    return incident;
  })(),
  findings: "Seen at home the same afternoon. No injury, walking normally, grab bar checked.",
  byUserId: "u-karynn",
  isRn: true,
  at: hoursAgo(46),
});

export const seedIncidents: Incident[] = [
  untouched,
  overdue,
  nearlyDone,
  closeIncident({
    incident: {
      ...handledProperly,
      findings: "No injury. The bathroom mat has been replaced with a non-slip one.",
    },
    byUserId: "u-karynn",
    at: hoursAgo(44),
  }),
];
