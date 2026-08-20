import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Which seed caregiver the portal demo stands in for.
 *
 * The board is generated relative to the current week, so whoever is hardcoded
 * here has an empty day on four days out of seven and §8's screen demonstrates
 * nothing. This picks somebody with a visit today when there is one, and
 * otherwise whoever is busiest this week.
 *
 * It selects which seeded person to show. It does not invent a visit — an empty
 * day still renders as an empty day when the whole board is empty.
 */
export function demoCaregiverName(asOf: Date): string {
  const named = seedVisits.filter((v) => v.caregiverName);

  const isToday = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === asOf.getFullYear() &&
      d.getMonth() === asOf.getMonth() &&
      d.getDate() === asOf.getDate()
    );
  };

  const today = named.find((v) => isToday(v.startsAt));
  if (today?.caregiverName) return today.caregiverName;

  const counts = new Map<string, number>();
  for (const v of named) {
    counts.set(v.caregiverName!, (counts.get(v.caregiverName!) ?? 0) + 1);
  }
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return busiest?.[0] ?? "";
}
