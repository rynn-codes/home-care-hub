import { bookSupervisoryVisit, type SupervisoryVisit } from "@/domain/supervision/supervision";

/**
 * Supervisory visits for the demo.
 *
 * Three states, chosen so the queue shows the thing it was built for: one
 * client supervised recently — whose clock has therefore stopped — one booked
 * and waiting, and the rest never supervised at all, counting up from start
 * of care.
 */
const RN = "u-karynn";

/** Marilyn was supervised in June. Her clock now runs from then, not from admission. */
const marilyn: SupervisoryVisit = {
  ...bookSupervisoryVisit({
    id: "sv-lian-1",
    clientPersonId: "c-marilyn",
    clientName: "Marilyn K",
    scheduledFor: "2026-06-11",
    assignedToUserId: RN,
  }),
  completedAt: "2026-06-11T15:20:00.000Z",
  completedByUserId: RN,
  findings:
    "Watched a shower transfer and the midday meal. Chanel follows the plan and Marilyn is " +
    "comfortable with her. Plan still fits; no changes.",
  carePlanReviewed: true,
};

/** Jessie's is on the calendar. Nobody needs chasing about it. */
const jessie = bookSupervisoryVisit({
  id: "sv-edward-1",
  clientPersonId: "c-jessie",
  clientName: "Jessie C",
  scheduledFor: "2026-08-27",
  assignedToUserId: RN,
});

export const seedSupervisoryVisits: SupervisoryVisit[] = [marilyn, jessie];

/**
 * Start of care for the clients on the schedule.
 *
 * Held here rather than derived, because the scheduling seed is a week of
 * shifts and carries no admission dates.
 */
export const seedStartOfCare: Record<string, string> = {
  "c-marilyn": "2026-03-03",
  "c-jessie": "2026-01-15",
  "c-pamela": "2026-06-21",
  "c-vince": "2026-05-06",
  "c-charles": "2026-03-16",
  "c-sara": "2026-03-16",
  "c-robert": "2025-04-14",
};
