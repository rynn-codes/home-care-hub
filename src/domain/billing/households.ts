import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * Households — two clients in one home with one caregiver.
 *
 * The S household is Karynn's real case: Charles and Sara, one shift, one
 * clock. Scheduling runs the visit once; billing decides whether the family
 * gets one invoice or each person is invoiced separately at their own rate
 * (a long-term-care policy needs a claim in its holder's own name).
 */

export type HouseholdBilling = "combined" | "separate";

export const HOUSEHOLD_BILLING_LABELS: Record<HouseholdBilling, string> = {
  combined: "Bill together",
  separate: "Invoice separately",
};

export const HOUSEHOLD_BILLING_MEANINGS: Record<HouseholdBilling, string> = {
  combined: "One invoice for the visit. They are not charged twice for one caregiver.",
  separate: "Each person is invoiced for the visit at their own rate, so each policy has its own claim.",
};

export interface HouseholdMember {
  personId: string;
  name: string;
}

export interface Household {
  id: string;
  label: string;
  primaryPersonId: string;
  members: HouseholdMember[];
  billing: HouseholdBilling;
  /** One rate for the whole visit, when the family is billed together. */
  householdRate?: number | null;
  /** How a combined rate is split between members, by weight. */
  split?: Record<string, number> | null;
  note?: string | null;
}

/** What the payer text suggests: a policy on either account means separate claims. */
export function suggestedBilling(payer: string | null | undefined): HouseholdBilling {
  return payer && /insurance|ltc/i.test(payer) ? "separate" : "combined";
}

export function billingMismatch(household: Household, payerOf: (personId: string) => string | null | undefined): boolean {
  return household.members.some((m) => suggestedBilling(payerOf(m.personId)) !== household.billing);
}

export function mismatchMessage(household: Household): string {
  return household.billing === "combined"
    ? `${household.label} are billed together, but a policy is now on the account. Insurance claims need an invoice in each person's own name.`
    : `${household.label} are invoiced separately, but neither account shows insurance. Billing together means they are not charged twice for one caregiver.`;
}

export function householdOf(households: readonly Household[], personId: string): Household | undefined {
  return households.find((h) => h.members.some((m) => m.personId === personId));
}

export function companionsOf(households: readonly Household[], personId: string): HouseholdMember[] {
  const h = householdOf(households, personId);
  return h ? h.members.filter((m) => m.personId !== personId) : [];
}

/** Everyone a visit serves, the named client first. */
export function servedPeople(visit: Pick<Visit, "clientName" | "clientPersonId" | "alsoServes">): HouseholdMember[] {
  return [{ personId: visit.clientPersonId ?? visit.clientName, name: visit.clientName }, ...(visit.alsoServes ?? [])];
}

export function hasCompanions(visit: Pick<Visit, "alsoServes">): boolean {
  return (visit.alsoServes?.length ?? 0) > 0;
}

export function visitServes(visit: Pick<Visit, "clientName" | "clientPersonId" | "alsoServes">, personId: string, name?: string): boolean {
  return servedPeople(visit).some((p) => p.personId === personId || (name !== undefined && p.name === name));
}

/** "Charles S and Sara S". */
export function servedNames(visit: Pick<Visit, "clientName" | "clientPersonId" | "alsoServes">): string {
  const names = servedPeople(visit).map((p) => p.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Whether this visit goes on this person's invoice. */
export function billsToClient(visit: Visit, personId: string, name: string, households: readonly Household[]): boolean {
  if (!visitServes(visit, personId, name)) return false;
  if (!hasCompanions(visit) || visit.clientPersonId === personId || visit.clientName === name) return true;
  return householdOf(households, personId)?.billing === "separate";
}

/** The share of a shared visit's hours this person is charged for. */
export function shareOf(visit: Visit, personId: string, households: readonly Household[]): number {
  if (!hasCompanions(visit)) return 1;
  const h = householdOf(households, personId);
  return h?.billing !== "separate" ? 1 : 1 / servedPeople(visit).length;
}

/** Share of a week's advance a member carries. */
export function advanceShare(personId: string, households: readonly Household[]): number {
  const h = householdOf(households, personId);
  if (!h) return 1;
  if (h.billing === "separate") return 1 / h.members.length;
  return h.primaryPersonId === personId ? 1 : 0;
}

export function householdRate(households: readonly Household[], personId: string): number | null {
  return householdOf(households, personId)?.householdRate ?? null;
}

/** Normalised shares, equal when nothing is set. */
export function shares(household: Household): Record<string, number> {
  const ids = household.members.map((m) => m.personId);
  const equal = () => Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
  const split = household.split;
  if (!split) return equal();
  const total = ids.reduce((sum, id) => sum + (split[id] ?? 0), 0);
  if (!(total > 0) || !Number.isFinite(total)) return equal();
  return Object.fromEntries(ids.map((id) => [id, (split[id] ?? 0) / total]));
}

export function splitRate(household: Household, rate: number): Array<{ personId: string; name: string; share: number; rate: number }> {
  const s = shares(household);
  const rows = household.members.map((m) => ({
    personId: m.personId,
    name: m.name,
    share: s[m.personId] ?? 0,
    rate: Math.round(rate * (s[m.personId] ?? 0) * 100) / 100,
  }));
  const sum = Math.round(rows.reduce((acc, r) => acc + r.rate, 0) * 100) / 100;
  const drift = Math.round((rate - sum) * 100) / 100;
  if (drift !== 0 && rows.length > 0) {
    const last = rows[rows.length - 1];
    rows[rows.length - 1] = { ...last, rate: Math.round((last.rate + drift) * 100) / 100 };
  }
  return rows;
}

export function validateSplit(input: { rate: number | null; memberIds: string[]; shares: Record<string, number> }): string[] {
  const problems: string[] = [];
  if (input.rate === null || input.rate <= 0) problems.push("Set the household rate before splitting it.");
  if (!(input.memberIds.reduce((sum, id) => sum + (input.shares[id] ?? 0), 0) > 0)) {
    problems.push("Somebody has to carry the invoice — the shares add up to nothing.");
  }
  if (input.memberIds.some((id) => (input.shares[id] ?? 0) < 0)) problems.push("A share cannot be negative.");
  return problems;
}
