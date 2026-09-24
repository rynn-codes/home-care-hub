import { rateInEffect } from "@/domain/billing/accounts";
import { householdRate, type Household } from "@/domain/billing/households";
import { seedBillingAccountClients, seedRatePlanVersions } from "@/lib/billingAccountsSeed";
import { seedClients } from "@/lib/clientsSeed";

/**
 * The hourly rate a client is billed on a date: the household rate when one
 * is set, otherwise the rate plan in effect on their billing account.
 */
export function clientRateFor(input: { clientPersonId: string | null; households: readonly Household[]; on: string }): number | null {
  if (!input.clientPersonId) return null;
  const shared = householdRate(input.households, input.clientPersonId);
  if (shared !== null) return shared;
  const link = seedBillingAccountClients.find((l) => l.clientPersonId === input.clientPersonId);
  if (!link) return null;
  return rateInEffect({ versions: seedRatePlanVersions, billingAccountId: link.billingAccountId, clientPersonId: input.clientPersonId, on: input.on })?.hourlyRate ?? null;
}

/** The schedule's own person id for a client name, when the visit carries none. */
export function clientPersonIdFor(name: string): string | null {
  return seedClients.find((c) => `${c.firstName} ${c.lastName}` === name)?.personId ?? null;
}

export function payerFor(personId: string): string | null {
  return seedClients.find((c) => c.personId === personId)?.payer ?? null;
}
