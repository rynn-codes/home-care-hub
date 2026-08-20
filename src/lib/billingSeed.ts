import { isBillable, type ClientBillingTerms } from "@/domain/billing/invoice";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Billing terms for the demo.
 *
 * THE RATES ARE FICTION AND SAY SO. Karynn has not supplied real ones, and the
 * packet has Joy emailing the agreed rate to each client separately "to ensure
 * financial privacy" — so a real rate would not live in a seed file anyway.
 *
 * One client deliberately has no rate at all, because the interesting behaviour
 * is what Joy does when it cannot bill: it refuses rather than producing a zero.
 * A demo where every invoice works would hide the only safeguard that matters
 * here.
 *
 * Clients are fictional throughout this repository.
 */

// Only real client care. The board also carries field orientations, which put
// a caregiver's name in the client column — see `isBillable`.
const clients = [...new Set(seedVisits.filter(isBillable).map((v) => v.clientName))];

export const seedBillingTerms: ClientBillingTerms[] = clients.map((clientName, i) => ({
  clientPersonId: `c-${clientName.toLowerCase().replace(/[^a-z]/g, "")}`,
  clientName,
  // Placeholder rates. Not Joy's real pricing.
  hourlyRate: i === 1 ? null : [32, null, 28, 35, 30][i % 5] ?? 30,
  paymentMethod: (["card", "ach", "card", "check"] as const)[i % 4],
  // The first client's deposit is partly spent, the rest are fresh.
  depositRemaining: i === 0 ? 180 : i % 3 === 0 ? 960 : 0,
}));

/** Which clients have been paid up, for the ageing demo. */
export const seedPaidWeeks = new Set<string>(["c-lianhuang"]);
