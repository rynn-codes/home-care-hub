import type { Monitor } from "./types";

/**
 * Address Watch: has a caregiver used a place for a client that nobody has
 * approved?
 *
 * A pending location is one a caregiver clocked from and Joy wrote down.
 * Until somebody approves it, Joy cannot tell a place the agency agreed to
 * from a place a caregiver simply went.
 */
function addedLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "added today";
  if (days === 1) return "added yesterday";
  return `added ${d.toLocaleDateString([], { day: "numeric", month: "long" })}`;
}

export const addressWatch: Monitor = {
  id: "address",
  name: "Address Watch",
  question: "Has a caregiver used a place for a client that nobody has approved?",
  cadence: "daily",
  run({ approvedLocations, clientNames, now }) {
    return approvedLocations
      .filter((l) => l.status === "pending")
      .map((l) => {
        const client = clientNames[l.clientPersonId] ?? "a client";
        const by = l.addedBy || "Somebody";
        return {
          key: `address:${l.id}`,
          subject: { kind: "client" as const, id: l.clientPersonId, name: client },
          severity: "due_soon" as const,
          headline: `${l.label} has not been approved for ${client}`,
          because: `${by} used it on a visit and it went on ${client}'s list as pending — ${addedLabel(l.addedOn, now)}.${l.address ? ` ${l.address}.` : ""} Until somebody approves it, Joy cannot tell a place the agency agreed to from a place a caregiver simply went.`,
          next: { label: "Open the client's locations", to: `/clients/${l.clientPersonId}?tab=Services` },
        };
      });
  },
};
