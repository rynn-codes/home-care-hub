import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * The week's visits on the demo board — Karynn's standing schedule as she
 * gave it on 9 September, built relative to the current week so the board
 * always looks live.
 *
 * Caregivers are Joy Health's real team and the clients are Karynn's; the
 * pairings and hours are hers. The S household is one home, one caregiver,
 * one visit that serves two clients (`alsoServes`), so the shift is
 * scheduled and clocked once — see domain/billing/households.
 */

/**
 * The Monday INSIDE the current Saturday–Friday agency week (README business
 * rule #4). Anchoring on the agency week rather than the calendar week keeps
 * the seeded Mon–Fri visits visible in the board's Sat-start week view on any
 * day the demo is opened.
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

const WEEKDAYS = [0, 1, 2, 3, 4];
const HOUSEHOLD = [{ personId: "c-sara", name: "Sara S" }];

export const seedVisits: Visit[] = [
  ...WEEKDAYS.map((d) => ({ id: `v-pamela-${d}`, clientName: "Pamela P", clientPersonId: "c-pamela", service: "Personal Care", caregiverName: "Chanel P", startsAt: at(d, 10, 30), endsAt: at(d, 18) })),
  ...WEEKDAYS.map((d) => ({ id: `v-marilyn-${d}`, clientName: "Marilyn K", clientPersonId: "c-marilyn", service: "Personal Care", caregiverName: "Vanessa J", startsAt: at(d, 11), endsAt: at(d, 19) })),
  ...[0, 2, 4].map((d) => ({ id: `v-vince-t-${d}`, clientName: "Vince W", clientPersonId: "c-vince", service: "Personal Care", caregiverName: "Thylia B", startsAt: at(d, 11), endsAt: at(d, 19) })),
  ...[1, 3, -2].map((d) => ({ id: `v-vince-b-${d}`, clientName: "Vince W", clientPersonId: "c-vince", service: "Personal Care", caregiverName: "Bedjine C", startsAt: at(d, 11), endsAt: at(d, 19) })),
  ...[0, 2, 4].map((d) => ({ id: `v-robert-${d}`, clientName: "Robert H", clientPersonId: "c-robert", service: "Personal Care", caregiverName: "Glory O", startsAt: at(d, 7, 30), endsAt: at(d, 11, 30) })),
  ...WEEKDAYS.map((d) => ({ id: `v-jessie-${d}`, clientName: "Jessie C", clientPersonId: "c-jessie", service: "Personal Care", caregiverName: "Glory O", startsAt: at(d, 13), endsAt: at(d, 17) })),
  ...WEEKDAYS.map((d) => ({
    id: `v-household-day-${d}`,
    clientName: "Charles S",
    clientPersonId: "c-charles",
    alsoServes: HOUSEHOLD,
    service: "Personal Care",
    caregiverName: "Brandon H",
    startsAt: at(d, 9),
    endsAt: at(d, 13),
  })),
  ...[
    { key: "sat", from: -2, to: -1 },
    { key: "sun", from: -1, to: 0 },
    { key: "fri", from: 4, to: 5 },
  ].map(({ key, from, to }) => ({
    id: `v-household-night-${key}`,
    clientName: "Charles S",
    clientPersonId: "c-charles",
    alsoServes: HOUSEHOLD,
    service: "Personal Care",
    caregiverName: "Daizha S",
    startsAt: at(from, 20),
    endsAt: at(to, 8),
  })),
  // Brandon is a new caregiver shadowing, not a client — hence the event type.
  { id: "v-orientation", clientName: "Brandon H", service: "Field Orientation", caregiverName: "Chanel P", startsAt: at(1, 19, 15), endsAt: at(1, 20), eventType: "field_orientation" },
];
