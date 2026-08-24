import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * A week of visits for the demo board.
 *
 * Built relative to the current week so the board always looks live, rather
 * than pointing at a date in the past. People and services match the rest of
 * the seed, so the same clients appear across Home, Admissions and Scheduling.
 *
 * Deliberately includes two open shifts and one caregiver double-booking, so
 * the Needs You panel and the conflict service have something real to report —
 * an empty board demonstrates nothing.
 *
 * Caregivers are Joy Health's real team. Clients are fictional and must remain
 * so — see the note in joySeed.ts.
 */

/**
 * The Monday INSIDE the current Saturday–Friday agency week (README business
 * rule #4). Anchoring on the agency week rather than the calendar week keeps
 * the seeded Mon–Fri visits visible in the board's Sat-start week view on any
 * day the demo is opened — including the weekend, when a plain "Monday of this
 * week" would point at the previous agency week.
 */
function mondayOfThisWeek(): Date {
  const d = new Date();
  const sinceSaturday = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - sinceSaturday + 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = mondayOfThisWeek();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  // Local ISO without the timezone suffix, so it parses back as local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export const seedVisits: Visit[] = [
  { id: "v1", clientName: "Lian Huang", clientPersonId: "c-lian", service: "Personal Care", caregiverName: "Chanel P.", startsAt: at(0, 8), endsAt: at(0, 12) },
  { id: "v2", clientName: "Edward Pham", clientPersonId: "c-edward", service: "Personal Care", caregiverName: "Vanessa", startsAt: at(0, 16), endsAt: at(1, 0) },
  { id: "v3", clientName: "Dolores Vance", clientPersonId: "c-dolores", service: "Personal Care", caregiverName: "Thylia", startsAt: at(1, 18, 30), endsAt: at(1, 22, 30) },
  { id: "v4", clientName: "Lian Huang", clientPersonId: "c-lian", service: "Personal Care", caregiverName: "Chanel P.", startsAt: at(2, 8), endsAt: at(2, 12) },

  // Unassigned — the scheduler's most time-sensitive work.
  { id: "v5", clientName: "Ruth Alvarez", clientPersonId: "c-ruth", service: "Respite", caregiverName: null, startsAt: at(2, 12), endsAt: at(2, 18) },
  { id: "v6", clientName: "Evelyn Carter", clientPersonId: "c-evelyn", service: "Personal Care", caregiverName: null, startsAt: at(4, 9), endsAt: at(4, 13) },

  // Deliberate clash: Vanessa is with Edward and Susan at the same time on
  // Thursday, so the conflict service has something to catch on load.
  { id: "v7", clientName: "Edward Pham", clientPersonId: "c-edward", service: "Personal Care", caregiverName: "Vanessa", startsAt: at(3, 16), endsAt: at(4, 0) },
  { id: "v8", clientName: "Susan Miller", clientPersonId: "c-susan", service: "Personal Care", caregiverName: "Vanessa", startsAt: at(3, 18), endsAt: at(3, 21) },

  // Brandon is a new caregiver shadowing, not a client — hence the event type.
  { id: "v9", clientName: "Brandon (new caregiver)", service: "Field Orientation", caregiverName: "Chanel P.", startsAt: at(1, 14), endsAt: at(1, 14, 45), eventType: "field_orientation" },
];
