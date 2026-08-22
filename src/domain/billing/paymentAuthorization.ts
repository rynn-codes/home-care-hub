import type { CollectionMethod } from "@/domain/billing/accounts";

/**
 * Payment authorization and the two payment modes — addendum §3, §4, §5, §11.
 *
 * THE TWO MODES ARE THE SAME PAIR 0014 ALREADY HOLDS. The addendum names them
 * by their product names — `pay_invoice` and `autopay` — and 0014's
 * `collection_method` calls them `send_invoice` and `automatic`. One concept,
 * two vocabularies; the mapping below is the single place they meet, so a
 * screen can speak the family's language while the database keeps its
 * constraints.
 *
 * THE LOCKED RULE (§21): "Joy creates the invoice. The client sees the
 * invoice. Stripe processes the money." AutoPay does not mean charging
 * without an invoice — the finalized invoice must be available for review
 * before scheduled collection. `autopayCollectionRefusals` is that sentence
 * as code.
 */

export type PaymentMode = "pay_invoice" | "autopay";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  pay_invoice: "Pay Invoice — you review, then you pay",
  autopay: "AutoPay — collected under your agreed billing terms",
};

/** The family-facing line under each preference — addendum §5's own copy. */
export const PAYMENT_MODE_BLURBS: Record<PaymentMode, string> = {
  pay_invoice: "You'll receive an update when a new invoice is ready.",
  autopay: "Your invoices are available for review before your scheduled payment.",
};

export function modeFromCollectionMethod(method: CollectionMethod): PaymentMode {
  return method === "automatic" ? "autopay" : "pay_invoice";
}

export function collectionMethodFromMode(mode: PaymentMode): CollectionMethod {
  return mode === "autopay" ? "automatic" : "send_invoice";
}

// ---------------------------------------------------------- the record --

/**
 * The wording currently in use. Karynn supplied the full text on 22 August;
 * it is vendored verbatim at docs/billing/ELECTRONIC_PAYMENT_AUTHORIZATION_v1.md
 * and every authorization row cites the version it was signed under. A wording
 * change is a NEW version — never an edit to this one, because signatures
 * point at it.
 */
export const CURRENT_AUTHORIZATION_TEXT_VERSION = "joy-epay-v1";

export type AuthorizationRecordStatus = "active" | "revoked" | "superseded";

/**
 * §3's list, complete: who, which account, which mode, which wording, when,
 * and the whole revocation history. Mirrors `payment_authorizations` (0020).
 */
export interface PaymentAuthorization {
  id: string;
  billingAccountId: string;
  /** The payer or responsible party who put their name to it. */
  authorizedByPersonId: string;
  authorizedByName: string;
  paymentMode: PaymentMode;
  /**
   * WHICH WORDING they agreed to. Joy's approved legal language, versioned —
   * an authorization that cannot say which version it was is one nobody can
   * defend when the wording changes.
   */
  authorizationTextVersion: string;
  authorizedAt: string;
  /** References only. Never a credential. */
  stripeCustomerRef: string | null;
  stripePaymentMethodRef: string | null;
  status: AuthorizationRecordStatus;
  revokedAt: string | null;
  revokedByPersonId: string | null;
  revokedReason: string | null;
}

/** The one authorization currently in force, if any. */
export function activeAuthorization(
  records: readonly PaymentAuthorization[],
  billingAccountId: string,
): PaymentAuthorization | null {
  return (
    records.find((r) => r.billingAccountId === billingAccountId && r.status === "active") ?? null
  );
}

// ------------------------------------------------ the autopay gate (§11) --

export type AutopayRefusal =
  | "no_authorization"
  | "authorization_revoked"
  | "wrong_mode"
  | "invoice_not_finalized"
  | "invoice_not_available_to_client"
  | "method_unusable";

export const AUTOPAY_MESSAGES: Record<AutopayRefusal, string> = {
  no_authorization: "No payment authorization is on file. Capture Joy's form before any charge.",
  authorization_revoked:
    "The authorization was revoked. Joy must not silently continue collection — this is a conversation, then a new authorization.",
  wrong_mode: "This account authorized Pay Invoice, not AutoPay. The client initiates payment.",
  invoice_not_finalized:
    "The invoice is not finalized. AutoPay never means charging without an invoice.",
  invoice_not_available_to_client:
    "The finalized invoice has not been made available for review. The client sees the invoice before collection — the locked rule.",
  method_unusable: "The saved payment method is expired or failed verification. Nothing to charge.",
};

/**
 * May the scheduled AutoPay collection proceed? Every refusal is a §4 or §11
 * sentence. The server layer asks this before creating any charge; the answer
 * "no" surfaces as a needs-attention exception, never as a silent skip and
 * never as a silent charge.
 */
export function autopayCollectionRefusals(input: {
  authorization: PaymentAuthorization | null;
  invoiceState: string;
  /** The invoice is visible in the portal / was delivered per preference. */
  invoiceAvailableToClient: boolean;
  methodUsable: boolean;
}): AutopayRefusal[] {
  const refusals: AutopayRefusal[] = [];

  if (!input.authorization) refusals.push("no_authorization");
  else if (input.authorization.status !== "active") refusals.push("authorization_revoked");
  else if (input.authorization.paymentMode !== "autopay") refusals.push("wrong_mode");

  if (input.invoiceState !== "issued") refusals.push("invoice_not_finalized");
  else if (!input.invoiceAvailableToClient) refusals.push("invoice_not_available_to_client");

  if (!input.methodUsable) refusals.push("method_unusable");

  return refusals;
}
