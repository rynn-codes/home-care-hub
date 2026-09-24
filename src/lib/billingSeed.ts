import { isBillable, servedPeople, type ClientBillingTerms } from "@/domain/billing/invoice";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Billing terms for the demo.
 *
 * THE RATES ARE PLACEHOLDERS AND SAY SO. Karynn has not supplied real ones,
 * and the packet has Joy emailing the agreed rate to each client separately
 * "to ensure financial privacy" — so a real rate would not live in a seed
 * file anyway. The S household is priced as one home at one rate, which is
 * how a shared caregiver is actually charged.
 */

// Every person a visit serves — the household visit serves two.
const served = seedVisits.filter(isBillable).flatMap((v) => servedPeople(v).map((p) => ({ name: p.name, personId: p.personId })));
const clients = [...new Set(served.map((p) => p.name))];
// The schedule's OWN person id, never re-derived from the name.
const personIdFor = new Map(served.map((p) => [p.name, p.personId]));

const HOUSEHOLD = new Set(["Charles S", "Sara S"]);
const RATES: Record<string, number> = {
  "Marilyn K": 30,
  "Jessie C": 30,
  "Pamela P": 30,
  "Vince W": 29,
  "Robert H": 30,
  "Charles S": 45,
  "Sara S": 45,
};

export const seedBillingTerms: ClientBillingTerms[] = clients.map((clientName, i) => ({
  clientPersonId: personIdFor.get(clientName) ?? `c-${clientName.toLowerCase().replace(/[^a-z]/g, "")}`,
  clientName,
  hourlyRate: RATES[clientName] ?? null,
  paymentMethod: (["ach", "card", "ach", "card"] as const)[i % 4],
  // The first client's deposit is partly spent; the household's is settled.
  depositRemaining: HOUSEHOLD.has(clientName) ? 0 : i === 0 ? 180 : i % 3 === 0 ? 960 : 0,
}));

/** Which clients have been paid up, for the ageing demo. The schedule's own id, never a slugified name. */
export const seedPaidWeeks = new Set<string>(["c-marilyn"]);
