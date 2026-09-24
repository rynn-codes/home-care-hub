import type { Monitor } from "./types";

/**
 * Location Watch: is anybody clocking in from somewhere other than the
 * client's home?
 *
 * Only the last few days: an out-of-range clock from a fortnight ago has
 * either been sorted or has become a payroll question, and either way it is
 * not this morning's news.
 */
export const LOCATION_LOOKBACK_DAYS = 3;

/** "250 feet" under a quarter mile, "1.3 miles" beyond it. */
export function distanceLabel(meters: number): string {
  const feet = meters * 3.28084;
  if (feet < 1320) return `${Math.round(feet / 10) * 10} feet`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles`;
}

function whenLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString()
    ? `at ${time} today`
    : `at ${time} on ${d.toLocaleDateString([], { day: "numeric", month: "long" })}`;
}

export const locationWatch: Monitor = {
  id: "location",
  name: "Location Watch",
  question: "Is anybody clocking in from somewhere other than the client's home?",
  cadence: "daily",
  run({ clockAttempts, now }) {
    const since = now.getTime() - LOCATION_LOOKBACK_DAYS * 86_400_000;
    return clockAttempts
      .filter((a) => new Date(a.at).getTime() >= since)
      .filter((a) => a.distanceMeters !== null)
      .map((a) => {
        const distance = a.distanceMeters as number;
        const uncertain = a.accuracyMeters !== null && distance - a.accuracyMeters <= 0;
        const verb = a.action === "out" ? "clocked out" : "clocked in";
        const away = distanceLabel(distance);
        const client = a.clientName ?? "a client";
        return {
          key: `location:${a.id}`,
          subject: { kind: "employee" as const, id: a.caregiverName, name: a.caregiverName },
          severity: uncertain ? ("note" as const) : ("blocking" as const),
          headline: a.refused
            ? `${a.caregiverName} was stopped from clocking ${a.action} for ${client} — ${away} away`
            : `${a.caregiverName} ${verb} for ${client} from ${away} away`,
          because: uncertain
            ? `The phone's own location was only accurate to ${distanceLabel(a.accuracyMeters as number)}, so this may simply be a weak signal indoors. Recorded ${whenLabel(a.at, now)}.`
            : `Recorded ${whenLabel(a.at, now)}. The visit record says the care happened at the client's home; the clock says it did not.`,
          next: { label: "Open the EVV log", to: "/reports/audit/evv" },
        };
      })
      .reverse();
  },
};
