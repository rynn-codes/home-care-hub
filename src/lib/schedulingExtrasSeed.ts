import type { Household } from "@/domain/billing/households";
import type { ApprovedLocation } from "@/domain/scheduling/locations";
import type { ClientSchedule, DayTimes } from "@/domain/scheduling/clientSchedule";
import { seedClients } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * The rest of the scheduling seed: the household, approved service
 * locations, mileage already claimed and each client's standing schedule.
 *
 * Street addresses here are MOCK — 99xx house numbers that do not exist —
 * and the mileage figures are illustrative. Karynn's clients are real people
 * and nothing about where they live is recorded in a committed file. The
 * three long-term-care clients are not real (29 September) and carry the
 * richer mock data.
 */

const at = (day: string) => `2026-08-${day}T09:00:00`;

/** Charles and Sara S: one home, one caregiver, one clock. */
export const seedHouseholds: Household[] = [
  {
    id: "hh-s",
    label: "The S household",
    primaryPersonId: "c-charles",
    members: [
      { personId: "c-charles", name: "Charles S" },
      { personId: "c-sara", name: "Sara S" },
    ],
    billing: "combined",
  },
];

export const seedApprovedLocations: ApprovedLocation[] = [
  { id: "c-marilyn:home", clientPersonId: "c-marilyn", label: "Client's home", address: "9914 Belmora Trace, Houston TX 77045", status: "primary", addedBy: "Karynn Verrett", addedOn: at("04") },
  { id: "c-pamela:home", clientPersonId: "c-pamela", label: "Client's home", address: "9928 Marchwood Bend, Houston TX 77053", status: "primary", addedBy: "Karynn Verrett", addedOn: at("04") },
  { id: "mock-pamela-daughter", clientPersonId: "c-pamela", label: "Daughter's home", address: "9903 Ashvale Run, Missouri City TX 77459", status: "approved", addedBy: "Karynn Verrett", addedOn: at("11"), decidedBy: "Karynn Verrett", decidedOn: at("11") },
  { id: "mock-pamela-day", clientPersonId: "c-pamela", label: "Southmore Adult Day", address: "9950 Tandridge Loop, Houston TX 77035", status: "approved", addedBy: "Kelsey Westley, RN", addedOn: at("18"), decidedBy: "Karynn Verrett", decidedOn: at("19") },
  { id: "c-jessie:home", clientPersonId: "c-jessie", label: "Client's home", address: "9937 Calloway Reach, Houston TX 77085", status: "primary", addedBy: "Karynn Verrett", addedOn: at("04") },
  { id: "mock-jessie-dialysis", clientPersonId: "c-jessie", label: "Braeburn dialysis clinic", address: "9962 Pellworth Way, Houston TX 77096", status: "pending", addedBy: "Glory O", addedOn: at("27") },
  { id: "c-charles:home", clientPersonId: "c-charles", label: "Client's home", address: "9945 Tarnbrook Close, Houston TX 77071", status: "primary", addedBy: "Karynn Verrett", addedOn: at("04") },
  { id: "c-vince:home", clientPersonId: "c-vince", label: "Client's home", address: "9921 Oakvine Halt, Houston TX 77047", status: "primary", addedBy: "Karynn Verrett", addedOn: at("04") },
  { id: "mock-vince-clinic", clientPersonId: "c-vince", label: "VA clinic", address: "9976 Harrowfield Spur, Houston TX 77034", status: "approved", addedBy: "Karynn Verrett", addedOn: at("14"), decidedBy: "Karynn Verrett", decidedOn: at("14") },
];

export interface VisitMileage {
  visitId: string;
  plannedMiles: number;
  actualMiles: number;
  note: string;
  recordedBy: string;
  recordedOn: string;
}

export const seedMileage: VisitMileage[] = [
  { visitId: "v-vince-t-0", plannedMiles: 18, actualMiles: 18, note: "VA clinic and back", recordedBy: "Thylia B", recordedOn: at("18") },
  { visitId: "v-vince-b-1", plannedMiles: 18, actualMiles: 24, note: "VA clinic, then pharmacy on the way back", recordedBy: "Bedjine C", recordedOn: at("20") },
  { visitId: "v-pamela-2", plannedMiles: 0, actualMiles: 9, note: "Grocery run — daughter asked", recordedBy: "Chanel P", recordedOn: at("19") },
];

/** The day the standing schedules were agreed — before any week the demo shows. */
export const SCHEDULES_AGREED_ON = "2026-08-04";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function commonest<T extends string>(values: readonly T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const v of values) {
    const c = counts.get(v)!;
    if (c >= n) {
      best = v;
      n = c;
    }
  }
  return best;
}

/**
 * A client's standing schedule, read off the week of visits Karynn gave: the
 * weekdays they are seen and the usual times on each. Signed, because these
 * are the schedules the agreements on file describe.
 */
function scheduleFromVisits(clientName: string, personId: string): ClientSchedule | null {
  const mine = seedVisits
    .filter((v) => v.clientName === clientName && v.eventType === undefined)
    .filter((v) => hhmm(v.startsAt) !== "" && hhmm(v.endsAt) !== "")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (mine.length === 0) return null;
  const days: Record<number, DayTimes> = {};
  for (const weekday of new Set(mine.map((v) => new Date(v.startsAt).getDay()))) {
    const onDay = mine.filter((v) => new Date(v.startsAt).getDay() === weekday);
    const usual = commonest(onDay.map((v) => `${hhmm(v.startsAt)}|${hhmm(v.endsAt)}`));
    if (!usual) continue;
    const [start, end] = usual.split("|");
    days[weekday] = { start, end };
  }
  if (Object.keys(days).length === 0) return null;
  return {
    id: `sch-${personId}-initial`,
    clientPersonId: personId,
    clientName,
    caregiverName: commonest(mine.map((v) => v.caregiverName ?? "").filter(Boolean)) || null,
    days,
    startsOn: SCHEDULES_AGREED_ON,
    endsOn: null,
    setBy: "Karynn Verrett",
    setAt: `${SCHEDULES_AGREED_ON}T09:00:00`,
    reason: "",
    supersedesId: null,
    agreementSentAt: `${SCHEDULES_AGREED_ON}T09:30:00`,
    agreementSignedAt: `${SCHEDULES_AGREED_ON}T10:00:00`,
  };
}

export const seedClientSchedules: ClientSchedule[] = seedClients
  .filter((c) => c.status === "active")
  .map((c) => scheduleFromVisits(`${c.firstName} ${c.lastName}`, c.personId))
  .filter((s): s is ClientSchedule => s !== null);
