import { daysBetween } from "@/domain/dates";
import type { PaymentMethod } from "@/domain/billing/invoice";

/**
 * Billing accounts — who actually pays, as opposed to who receives care.
 *
 * §6.1 and §3.2.4 of the billing specification. This is the change with the
 * widest blast radius in the whole plan, and it is first because everything
 * financial in this repository is currently keyed on the CLIENT.
 *
 * WHY THAT IS WRONG. A daughter paying for both her parents has no
 * representation in a client-keyed schema at all. She gets two rate records, two
 * invoices with no relationship to each other, and — once Stripe is connected —
 * two Customer objects, two saved cards and two dunning sequences. She then
 * rings the office unable to understand why she was charged twice for what she
 * thinks of as one arrangement, and nobody can tell her, because Joy does not
 * know the two are hers.
 *
 * So the account belongs to a PAYER, and clients hang off it.
 *
 * WHAT THIS DELIBERATELY DOES NOT MODEL. §13 lists "one client has split
 * payers" as an exception to handle, and §18.9 lists it as an open business
 * decision. Karynn has not said whether it happens at Joy. The join below is
 * many-to-many, so it could carry a split later, but there is no share or
 * percentage column: a schema that supports a case nobody has is a schema people
 * write code for, and that code has no test data and no way to be right.
 *
 * The payer is a person, reusing `people` and
 * `relationships.is_responsible_party` from 0001. No new party table.
 */

export type BillingAccountStatus = "setup_needed" | "ready" | "attention_needed" | "closed";

export const ACCOUNT_STATUS_LABELS: Record<BillingAccountStatus, string> = {
  setup_needed: "Setup needed",
  ready: "Ready",
  attention_needed: "Needs attention",
  closed: "Closed",
};

/** §6.2. How Joy collects, not how the client happens to have paid before. */
export type CollectionMethod = "automatic" | "send_invoice";

export const COLLECTION_LABELS: Record<CollectionMethod, string> = {
  automatic: "Charge the saved method automatically",
  send_invoice: "Send an invoice to pay",
};

export type DeliveryPreference = "portal" | "email_and_portal" | "paper_and_portal";

export const DELIVERY_LABELS: Record<DeliveryPreference, string> = {
  portal: "Portal only",
  email_and_portal: "E-mail and portal",
  paper_and_portal: "Paper and portal",
};

/**
 * Whether Joy may charge a saved method when nobody is present.
 *
 * §18.4 is an OPEN BUSINESS DECISION with legal weight: charging a card
 * off-session needs recorded authority, and whether the signed agreement
 * already constitutes it has not been confirmed. So this is recorded as a fact
 * about a particular account rather than assumed from the payment method
 * existing — a saved card is not permission.
 */
export type AuthorizationStatus = "not_captured" | "captured" | "withdrawn";

export interface BillingAccount {
  id: string;
  organizationId: string;
  /** The person who pays. Often the client; often not. */
  payerPersonId: string;
  payerName: string;

  status: BillingAccountStatus;
  collectionMethod: CollectionMethod;
  deliveryPreference: DeliveryPreference;
  /** Only meaningful for `send_invoice`. */
  termsDays: number | null;

  billingEmail: string | null;
  billingPhone: string | null;

  authorizationStatus: AuthorizationStatus;
  authorizationCapturedAt: string | null;
  /** The signed document the authority rests on. */
  authorizationDocumentId: string | null;

  /** Dollars of deposit Joy holds against this account. */
  depositRemaining: number;
  paymentMethod: PaymentMethod | null;
}

/** Which clients this account pays for. Many-to-many; see the note above. */
export interface BillingAccountClient {
  billingAccountId: string;
  clientPersonId: string;
  clientName: string;
}

// ------------------------------------------------------------- readiness --

export type AccountGap =
  | "no_payment_method"
  | "no_authorization"
  | "authorization_withdrawn"
  | "no_billing_contact"
  | "no_clients"
  | "no_rate";

export const ACCOUNT_GAP_MESSAGES: Record<AccountGap, string> = {
  no_payment_method: "No payment method on file.",
  no_authorization:
    "Nobody has recorded authority to charge this account. A saved card is not permission.",
  authorization_withdrawn: "Authority to charge this account has been withdrawn.",
  no_billing_contact: "No billing e-mail or phone, so an invoice has nowhere to go.",
  no_clients: "This account pays for nobody.",
  no_rate: "No rate is in effect, so a week cannot be priced.",
};

/**
 * What stands between this account and being able to bill.
 *
 * The rule §18.4 protects: an account collecting AUTOMATICALLY without recorded
 * authority cannot be ready. Charging a saved card off-session on the strength
 * of the card existing is the specific thing that gets an agency into trouble,
 * and it is easy to do by accident because the card is right there.
 *
 * An account on `send_invoice` needs no such authority — the payer is present
 * and choosing to pay each time.
 */
export function accountGaps(input: {
  account: BillingAccount;
  clients: readonly BillingAccountClient[];
  hasRate: boolean;
}): AccountGap[] {
  const { account } = input;
  const gaps: AccountGap[] = [];

  if (input.clients.filter((c) => c.billingAccountId === account.id).length === 0) {
    gaps.push("no_clients");
  }
  if (!account.billingEmail && !account.billingPhone) gaps.push("no_billing_contact");
  if (!input.hasRate) gaps.push("no_rate");

  if (account.collectionMethod === "automatic") {
    if (!account.paymentMethod) gaps.push("no_payment_method");
    if (account.authorizationStatus === "withdrawn") gaps.push("authorization_withdrawn");
    else if (account.authorizationStatus !== "captured") gaps.push("no_authorization");
  }

  return gaps;
}

export function accountStatusFrom(gaps: readonly AccountGap[]): BillingAccountStatus {
  if (gaps.length === 0) return "ready";
  // Withdrawn authority is a change to something that used to work, and reads
  // differently from an account nobody has finished setting up.
  return gaps.includes("authorization_withdrawn") ? "attention_needed" : "setup_needed";
}

// ----------------------------------------------------------- rate plans --

/**
 * A rate, as of a date.
 *
 * Versioned and never updated in place. An invoice cites the version it was
 * built from, so editing a rate would rewrite what a family was told they
 * agreed to — and the invoice they were sent last March would silently start
 * saying something else.
 *
 * The same reasoning as care plan versions in `carePlan/plan.ts` and superseded
 * credentials in `documents`: a record somebody acted on is not editable.
 */
export interface RatePlanVersion {
  id: string;
  billingAccountId: string;
  /** Null means it applies to every client on the account. */
  clientPersonId: string | null;
  hourlyRate: number;
  /** Inclusive. */
  effectiveFrom: string;
  /** Inclusive. Null means still in effect. */
  effectiveTo: string | null;
  createdByUserId: string;
  createdAt: string;
}

/**
 * The rate in effect for a client on a date.
 *
 * A client-specific version wins over an account-wide one. Nothing here
 * interpolates or falls back to a default: a date with no version returns null,
 * and `buildInvoice` already refuses to invoice without a rate rather than
 * sending a zero.
 */
export function rateInEffect(input: {
  versions: readonly RatePlanVersion[];
  billingAccountId: string;
  clientPersonId: string;
  on: string;
}): RatePlanVersion | null {
  const day = input.on.slice(0, 10);

  const applicable = input.versions.filter(
    (v) =>
      v.billingAccountId === input.billingAccountId &&
      (v.clientPersonId === null || v.clientPersonId === input.clientPersonId) &&
      v.effectiveFrom.slice(0, 10) <= day &&
      (v.effectiveTo === null || v.effectiveTo.slice(0, 10) >= day),
  );

  if (applicable.length === 0) return null;

  // Client-specific first, then the most recently effective. Two account-wide
  // versions overlapping is a data error the database refuses; this ordering
  // means the newer one wins rather than an arbitrary one.
  return applicable.sort(
    (a, b) =>
      Number(b.clientPersonId !== null) - Number(a.clientPersonId !== null) ||
      b.effectiveFrom.localeCompare(a.effectiveFrom),
  )[0];
}

/**
 * Close the current version and open a new one.
 *
 * Returns both, because a rate change is two facts: the old rate stopped
 * applying on a date, and the new one started. Writing only the new one leaves
 * two versions claiming the same week.
 */
export function changeRate(input: {
  current: RatePlanVersion | null;
  next: Omit<RatePlanVersion, "effectiveTo">;
}): { closed: RatePlanVersion | null; opened: RatePlanVersion } {
  const opened: RatePlanVersion = { ...input.next, effectiveTo: null };

  if (!input.current) return { closed: null, opened };

  if (daysBetween(input.current.effectiveFrom, input.next.effectiveFrom) <= 0) {
    throw new Error(
      "A new rate has to start after the one it replaces. Backdating a rate rewrites invoices that have already been sent.",
    );
  }

  const dayBefore = new Date(`${input.next.effectiveFrom.slice(0, 10)}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  return {
    closed: { ...input.current, effectiveTo: dayBefore.toISOString().slice(0, 10) },
    opened,
  };
}

/** The account a client's care is billed to. */
export function accountForClient(
  links: readonly BillingAccountClient[],
  clientPersonId: string,
): string | null {
  return links.find((l) => l.clientPersonId === clientPersonId)?.billingAccountId ?? null;
}

/** Everybody one account pays for — the daughter-with-two-parents view. */
export function clientsOnAccount(
  links: readonly BillingAccountClient[],
  billingAccountId: string,
): BillingAccountClient[] {
  return links.filter((l) => l.billingAccountId === billingAccountId);
}
