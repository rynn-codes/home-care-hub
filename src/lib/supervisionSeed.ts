import { bookSupervisoryVisit, type SupervisoryVisit } from "@/domain/supervision/supervision";

/**
 * Supervisory visits for the demo.
 *
 * Clients are fictional, as everywhere in this repository.
 *
 * Three states, chosen so the queue shows the thing it was built for: one
 * client supervised recently — whose clock has therefore stopped, which is the
 * behaviour that did not exist before — one booked and waiting, and the rest
 * never supervised at all, counting up from start of care.
 */

const RN = "u-karynn";

/** Lian was supervised in June. Her clock now runs from then, not from admission. */
const lian: SupervisoryVisit = {
  ...bookSupervisoryVisit({
    id: "sv-lian-1",
    clientPersonId: "c-lian",
    clientName: "Lian Huang",
    scheduledFor: "2026-06-11",
    assignedToUserId: RN,
  }),
  completedAt: "2026-06-11T15:20:00.000Z",
  completedByUserId: RN,
  findings:
    "Watched a shower transfer and the midday meal. Chanel follows the plan and Lian is " +
    "comfortable with her. Plan still fits; no changes.",
  carePlanReviewed: true,
};

/** Edward's is on the calendar for next week. Nobody needs chasing about it. */
const edward = bookSupervisoryVisit({
  id: "sv-edward-1",
  clientPersonId: "c-edward",
  clientName: "Edward Pham",
  scheduledFor: "2026-08-27",
  assignedToUserId: RN,
});

export const seedSupervisoryVisits: SupervisoryVisit[] = [lian, edward];

/**
 * Start of care for the clients on the schedule.
 *
 * Held here rather than derived, because the scheduling seed is a week of
 * shifts and carries no admission dates. When the screens move off mock data
 * this comes from the client profile, which is where it already lives for the
 * Clients directory.
 */
export const seedStartOfCare: Record<string, string> = {
  "c-lian": "2026-03-03",
  "c-edward": "2026-01-15",
  "c-dolores": "2026-06-21",
  "c-susan": "2026-05-06",
  "c-ruth": "2025-04-14",
  "c-evelyn": "2025-08-02",
};
