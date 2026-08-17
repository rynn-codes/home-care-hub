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
 */

function mondayOfThisWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
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
  { id: "v1", clientName: "Lian Huang", service: "Personal Care", caregiverName: "Samantha Chen", startsAt: at(0, 8), endsAt: at(0, 12) },
  { id: "v2", clientName: "Edward Pham", service: "Live-In", caregiverName: "Grace Nwosu", startsAt: at(0, 16), endsAt: at(1, 0) },
  { id: "v3", clientName: "Dolores Vance", service: "Evening Care", caregiverName: "Anita Rivera", startsAt: at(1, 18, 30), endsAt: at(1, 22, 30) },
  { id: "v4", clientName: "Lian Huang", service: "Personal Care", caregiverName: "Samantha Chen", startsAt: at(2, 8), endsAt: at(2, 12) },

  // Unassigned — the scheduler's most time-sensitive work.
  { id: "v5", clientName: "Ruth Alvarez", service: "Companion Care", caregiverName: null, startsAt: at(2, 12), endsAt: at(2, 18) },
  { id: "v6", clientName: "Evelyn Carter", service: "Dementia Care", caregiverName: null, startsAt: at(4, 9), endsAt: at(4, 13) },

  // Deliberate clash: Grace is with Edward and Susan at the same time on
  // Thursday, so the conflict service has something to catch on load.
  { id: "v7", clientName: "Edward Pham", service: "Live-In", caregiverName: "Grace Nwosu", startsAt: at(3, 16), endsAt: at(4, 0) },
  { id: "v8", clientName: "Susan Miller", service: "Personal Care", caregiverName: "Grace Nwosu", startsAt: at(3, 18), endsAt: at(3, 21) },

  { id: "v9", clientName: "David Okoro", service: "Field Orientation", caregiverName: "Samantha Chen", startsAt: at(1, 14), endsAt: at(1, 14, 45), eventType: "field_orientation" },
];
