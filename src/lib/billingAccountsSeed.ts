import type {
  BillingAccount,
  BillingAccountClient,
  RatePlanVersion,
} from "@/domain/billing/accounts";
import { accountGaps, accountStatusFrom } from "@/domain/billing/accounts";
import { isBillable, servedPeople } from "@/domain/billing/invoice";
import { seedBillingTerms } from "@/lib/billingSeed";
import { seedVisits } from "@/lib/schedulingSeed";

/**
 * Billing accounts for the demo, one per client, derived from the terms.
 *
 * THE RATES ARE STILL PLACEHOLDERS and still say so — see `billingSeed.ts`.
 * Karynn has not supplied real ones, and the packet has Joy e-mailing each
 * client's rate separately "to ensure financial privacy", so a real rate
 * would not live in a committed file anyway.
 *
 * The payer on each account is the client: Joy is all private pay and
 * invoices the client, whoever holds the chequebook. The billing e-mails are
 * example.com placeholders, never a real address.
 *
 * Four account states, because an accounts screen where everything is ready
 * demonstrates nothing: one automatic with authority recorded and a deposit
 * held; the rest on send-invoice needing no authority at all; one automatic
 * with NO payment method and no recorded authority — the state §18.4 exists
 * to prevent; and one whose authority has been withdrawn.
 */

const PAYERS = seedBillingTerms.map((t) => ({
  personId: t.clientPersonId,
  name: t.clientName,
  email: `${t.clientName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
}));

const RATE_START = "2026-01-01";

function account(i: number, over: Partial<BillingAccount> = {}): BillingAccount {
  const payer = PAYERS[i % PAYERS.length];
  return {
    id: `acct-${i + 1}`,
    organizationId: "org-joy-health",
    payerPersonId: payer.personId,
    payerName: payer.name,
    status: "ready",
    collectionMethod: "send_invoice",
    deliveryPreference: "email_and_portal",
    // The packet: payment is due within one calendar day of the invoice.
    termsDays: 1,
    billingEmail: payer.email,
    billingPhone: null,
    authorizationStatus: "captured",
    authorizationCapturedAt: null,
    authorizationDocumentId: null,
    depositRemaining: 0,
    paymentMethod: null,
    onHold: false,
    holdReason: null,
    ...over,
  };
}

const accounts: BillingAccount[] = PAYERS.map((_, i) => {
  const id = `acct-${seedBillingTerms[i].clientPersonId}`;
  if (i === 0) {
    // Automatic, authority on file, a deposit partly spent.
    return account(i, {
      id,
      collectionMethod: "automatic",
      termsDays: null,
      paymentMethod: "card",
      authorizationStatus: "captured",
      authorizationCapturedAt: "2026-03-02T14:00:00.000Z",
      authorizationDocumentId: "doc-agreement-1",
      depositRemaining: 180,
    });
  }
  if (i === 2) {
    // Automatic with nothing to charge and nobody's authority recorded.
    return account(i, { id, collectionMethod: "automatic", termsDays: null, authorizationStatus: "not_captured", authorizationCapturedAt: null });
  }
  if (i === 3) {
    // Changed their mind. Different from never having asked.
    return account(i, {
      id,
      collectionMethod: "automatic",
      termsDays: null,
      paymentMethod: "card",
      authorizationStatus: "withdrawn",
      authorizationCapturedAt: "2026-02-11T09:00:00.000Z",
    });
  }
  return account(i, { id, paymentMethod: "ach" });
});

// The standing week's hours per person served — what the advance invoice
// bills, read from the schedule so the two cannot disagree.
const weeklyHours = new Map<string, number>();
for (const visit of seedVisits) {
  if (!isBillable(visit)) continue;
  const hours = (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / 36e5;
  for (const p of servedPeople(visit)) weeklyHours.set(p.personId, (weeklyHours.get(p.personId) ?? 0) + hours);
}

/** Clients hang off accounts — here their own. */
export const seedBillingAccountClients: BillingAccountClient[] = seedBillingTerms.map((terms) => ({
  billingAccountId: `acct-${terms.clientPersonId}`,
  clientPersonId: terms.clientPersonId,
  clientName: terms.clientName,
  agreedWeeklyHours: Math.round((weeklyHours.get(terms.clientPersonId) ?? 0) * 100) / 100,
}));

export const seedRatePlanVersions: RatePlanVersion[] = seedBillingTerms
  .filter((t) => t.hourlyRate !== null)
  .map((terms, i) => {
    const link = seedBillingAccountClients.find((l) => l.clientPersonId === terms.clientPersonId)!;
    return {
      id: `rate-${i + 1}`,
      billingAccountId: link.billingAccountId,
      clientPersonId: terms.clientPersonId,
      hourlyRate: terms.hourlyRate!,
      effectiveFrom: RATE_START,
      effectiveTo: null,
      createdByUserId: "u-karynn",
      createdAt: `${RATE_START}T09:00:00.000Z`,
    };
  });

/** Status computed rather than asserted, so the seed cannot claim to be ready. */
export const seedBillingAccounts: BillingAccount[] = accounts.map((a) => ({
  ...a,
  status: accountStatusFrom(
    accountGaps({
      account: a,
      clients: seedBillingAccountClients,
      hasRate: seedRatePlanVersions.some((r) => r.billingAccountId === a.id),
    }),
  ),
}));
