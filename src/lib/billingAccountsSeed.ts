import type {
  BillingAccount,
  BillingAccountClient,
  RatePlanVersion,
} from "@/domain/billing/accounts";
import { accountGaps, accountStatusFrom } from "@/domain/billing/accounts";
import { seedBillingTerms } from "@/lib/billingSeed";

/**
 * Billing accounts for the demo, derived from the existing terms.
 *
 * THE RATES ARE STILL FICTION and still say so — see `billingSeed.ts`. Karynn
 * has not supplied real ones, and the packet has Joy e-mailing each client's
 * rate separately "to ensure financial privacy", so a real rate would not live
 * in a committed file anyway.
 *
 * WHAT THIS DEMONSTRATES that the old shape could not: Diane Miller pays for two
 * clients on one account. In the client-keyed model she had two unrelated
 * records and — once Stripe were connected — would have had two Customers, two
 * saved cards and two dunning sequences, then rung the office unable to
 * understand why she was charged twice for one arrangement.
 *
 * Four account states, because an accounts screen where everything is ready
 * demonstrates nothing: one ready on automatic collection with authority
 * recorded, one on send-invoice needing no authority at all, one automatic with
 * a saved card and NO recorded authority — which is the state §18.4 exists to
 * prevent and the one that looks fine until somebody reads it — and one whose
 * authority has been withdrawn.
 */

const PAYERS = [
  { personId: "p-diane", name: "Diane Miller", email: "d.miller@example.com" },
  { personId: "p-anthony", name: "Anthony Green", email: "a.green@example.com" },
  { personId: "p-priya", name: "Priya Carter", email: "p.carter@example.com" },
  { personId: "p-yvonne", name: "Yvonne Bell", email: "y.bell@example.com" },
];

const RATE_START = "2026-01-01";

function account(
  i: number,
  over: Partial<BillingAccount> = {},
): BillingAccount {
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
    authorizationStatus: "not_captured",
    authorizationCapturedAt: null,
    authorizationDocumentId: null,
    depositRemaining: 0,
    paymentMethod: null,
    onHold: false,
    holdReason: null,
    ...over,
  };
}

const accounts: BillingAccount[] = [
  // Diane pays for two people. The case the old shape could not express.
  account(0, {
    id: "acct-diane",
    collectionMethod: "automatic",
    termsDays: null,
    paymentMethod: "card",
    authorizationStatus: "captured",
    authorizationCapturedAt: "2026-03-02T14:00:00.000Z",
    authorizationDocumentId: "doc-agreement-diane",
    depositRemaining: 180,
  }),
  // Pays each invoice himself. Nothing to authorise in advance.
  account(1, { id: "acct-anthony", paymentMethod: "ach" }),
  // A saved card and nobody has recorded authority to use it. Looks ready and
  // is not, which is exactly why the check exists.
  account(2, {
    id: "acct-priya",
    collectionMethod: "automatic",
    termsDays: null,
    paymentMethod: "card",
  }),
  // Changed her mind. Different from never having asked.
  account(3, {
    id: "acct-yvonne",
    collectionMethod: "automatic",
    termsDays: null,
    paymentMethod: "card",
    authorizationStatus: "withdrawn",
    authorizationCapturedAt: "2026-02-11T09:00:00.000Z",
  }),
];

/**
 * Clients hang off accounts. Derived from the existing terms so the two seeds
 * cannot disagree about who Joy bills for.
 */
/** Everybody except Diane, who is handled separately below. */
const OTHER_ACCOUNTS = ["acct-anthony", "acct-priya", "acct-yvonne"] as const;

export const seedBillingAccountClients: BillingAccountClient[] = seedBillingTerms.map(
  (terms, i) => ({
    // The first two are Diane's mother and father, on her one account. The rest
    // round-robin across the others — spelled out rather than computed off the
    // index, because an off-by-one here silently put a third client on Diane's
    // account and made the two-clients-one-payer case look like three.
    billingAccountId:
      i < 2 ? "acct-diane" : OTHER_ACCOUNTS[(i - 2) % OTHER_ACCOUNTS.length],
    clientPersonId: terms.clientPersonId,
    clientName: terms.clientName,
  }),
);

export const seedRatePlanVersions: RatePlanVersion[] = seedBillingTerms
  .filter((t) => t.hourlyRate !== null)
  .map((terms, i) => {
    const link = seedBillingAccountClients.find(
      (l) => l.clientPersonId === terms.clientPersonId,
    )!;
    return {
      id: `rate-${i + 1}`,
      billingAccountId: link.billingAccountId,
      // Client-specific, because two people on Diane's account may not be on
      // the same rate — different services, agreed at different times.
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
