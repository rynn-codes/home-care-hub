import type { Visit } from "@/domain/scheduling/conflicts";
import { servedNames } from "@/domain/billing/households";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedApprovedLocations } from "@/lib/schedulingExtrasSeed";

/**
 * Fourteen weeks of worked visits and the EVV records clocked against them.
 *
 * The schedule seed is one week, built relative to today. Reports and the
 * EVV log need history, so the same standing week is projected back
 * fourteen weeks. A handful of records are deliberately imperfect — a
 * manual entry with no reason, an open clock, a missing location — so the
 * EVV Watch has something true to say.
 */

export interface EvvRecord {
  id: string;
  visitId: string;
  date: string;
  service: string;
  clientName: string;
  clientPersonId: string | null;
  caregiverName: string | null;
  caregiverPersonId: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  location: string | null;
  method: "mobile" | "telephony" | "manual";
  reasonCode: string | null;
  editedBy: string | null;
}

export const EVV_WEEKS_BACK = 13;

export function caregiverPersonId(name: string): string {
  return `p-${name.toLowerCase().replace(/[^a-z]/g, "")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const daysBefore = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return local(d);
};
const minutesAfter = (iso: string, minutes: number) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return local(d);
};

const standing = seedVisits.filter((v) => v.caregiverName && !v.eventType);
const addressOf = Object.fromEntries(seedClients.map((c) => [c.personId, seedApprovedLocations.find((l) => l.id === `${c.personId}:home`)?.address ?? ""]));

/** Every standing visit, this week and thirteen back, that has already ended. */
export const seedEvvVisits: Visit[] = (() => {
  const now = Date.now();
  const out: Visit[] = [];
  for (let w = EVV_WEEKS_BACK; w >= 0; w -= 1) {
    for (const v of standing) {
      const startsAt = daysBefore(v.startsAt, w * 7);
      const endsAt = daysBefore(v.endsAt, w * 7);
      if (new Date(endsAt).getTime() >= now) continue;
      out.push({ ...v, id: w === 0 ? v.id : `${v.id}-w${w}`, startsAt, endsAt });
    }
  }
  return out;
})();

const MANUAL_REASONS = [
  "Caregiver's phone had no battery; times confirmed with the client by phone.",
  "No mobile signal at the address; clocked in on the client's landline and lost the record.",
  "Caregiver forgot to clock out; end time confirmed against the visit note.",
];
const OFFICE = "Karynn Verrett";

export const seedEvvRecords: EvvRecord[] = seedEvvVisits
  // One visit in every forty-one has nothing clocked against it at all.
  .filter((_, i) => i % 41 !== 7)
  .map((v, i) => {
    const manualWithReason = i % 19 === 3;
    const manualNoReason = i % 43 === 11;
    const openClock = i % 37 === 5;
    const noLocation = i % 29 === 9;
    const method: EvvRecord["method"] = manualWithReason || manualNoReason ? "manual" : i % 11 === 4 ? "telephony" : "mobile";
    const clockInAt = minutesAfter(v.startsAt, (i % 4) - 1);
    const minutes = (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()) / 60_000;
    return {
      id: `evv-${v.id}`,
      visitId: v.id,
      date: v.startsAt.slice(0, 10),
      service: v.service,
      clientName: servedNames(v),
      clientPersonId: v.clientPersonId ?? null,
      caregiverName: v.caregiverName,
      caregiverPersonId: v.caregiverName ? caregiverPersonId(v.caregiverName) : null,
      clockInAt,
      clockOutAt: openClock ? null : minutesAfter(clockInAt, minutes + (i % 7)),
      location: noLocation ? null : addressOf[v.clientPersonId ?? ""] || null,
      method,
      reasonCode: manualWithReason && !manualNoReason ? MANUAL_REASONS[i % MANUAL_REASONS.length] : null,
      editedBy: method === "manual" ? OFFICE : null,
    };
  });

/** The seeded clock for a visit, when one was recorded. */
export function seededClock(visitId: string): { inAt: string | null; outAt: string | null } {
  const r = seedEvvRecords.find((x) => x.visitId === visitId);
  return { inAt: r?.clockInAt ?? null, outAt: r?.clockOutAt ?? null };
}
