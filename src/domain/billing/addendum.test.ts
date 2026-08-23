import { describe, expect, it } from "vitest";
import {
  AUTOPAY_MESSAGES,
  activeAuthorization,
  autopayCollectionRefusals,
  collectionMethodFromMode,
  modeFromCollectionMethod,
  type PaymentAuthorization,
} from "@/domain/billing/paymentAuthorization";
import { careCostPreview, paymentMethodRequestGate } from "@/domain/billing/careCost";
import { paymentSetupFromFacts } from "@/domain/billing/paymentSetup";
import {
  MemoryPaymentProcessor,
  paymentFailureCards,
  reconcileEvent,
} from "@/domain/billing/processor";
import { composeMessage } from "@/domain/portal/messaging";

/** Clients are fictional throughout this repository. */

function authorization(over: Partial<PaymentAuthorization> = {}): PaymentAuthorization {
  return {
    id: "auth-1",
    billingAccountId: "acct-1",
    authorizedByPersonId: "p-susan",
    authorizedByName: "Susan Bell",
    paymentMode: "autopay",
    authorizationTextVersion: "joy-epay-v1",
    authorizedAt: "2026-08-22T10:00:00Z",
    stripeCustomerRef: null,
    stripePaymentMethodRef: null,
    status: "active",
    revokedAt: null,
    revokedByPersonId: null,
    revokedReason: null,
    ...over,
  };
}

describe("the two modes are one pair, in two vocabularies", () => {
  it("maps the addendum's names onto 0014's columns and back", () => {
    expect(modeFromCollectionMethod("automatic")).toBe("autopay");
    expect(modeFromCollectionMethod("send_invoice")).toBe("pay_invoice");
    expect(collectionMethodFromMode("autopay")).toBe("automatic");
    expect(collectionMethodFromMode("pay_invoice")).toBe("send_invoice");
  });
});

describe("the autopay gate — §4 and §11 as refusals", () => {
  const clean = {
    authorization: authorization(),
    invoiceState: "issued",
    invoiceAvailableToClient: true,
    methodUsable: true,
  };

  it("collects when everything the addendum requires is true", () => {
    expect(autopayCollectionRefusals(clean)).toEqual([]);
  });

  it("never charges without a finalized invoice — AutoPay is not blind billing", () => {
    expect(autopayCollectionRefusals({ ...clean, invoiceState: "draft" })).toContain(
      "invoice_not_finalized",
    );
  });

  it("never charges before the client could see the invoice — the locked rule", () => {
    // §21: "Joy creates the invoice. The client sees the invoice. Stripe
    // processes the money." In that order.
    expect(
      autopayCollectionRefusals({ ...clean, invoiceAvailableToClient: false }),
    ).toContain("invoice_not_available_to_client");
  });

  it("a revoked authorization stops collection loudly, not silently (§11)", () => {
    const refusals = autopayCollectionRefusals({
      ...clean,
      authorization: authorization({ status: "revoked" }),
    });
    expect(refusals).toContain("authorization_revoked");
    expect(AUTOPAY_MESSAGES.authorization_revoked).toContain("must not silently continue");
  });

  it("pay_invoice authority is not autopay authority", () => {
    expect(
      autopayCollectionRefusals({
        ...clean,
        authorization: authorization({ paymentMode: "pay_invoice" }),
      }),
    ).toContain("wrong_mode");
  });

  it("an unusable method is a needs-attention, not a charge attempt", () => {
    expect(autopayCollectionRefusals({ ...clean, methodUsable: false })).toContain(
      "method_unusable",
    );
  });

  it("finds the one live authorization and ignores history", () => {
    const records = [
      authorization({ id: "a1", status: "revoked", revokedAt: "2026-08-01T00:00:00Z", revokedByPersonId: "p-susan", revokedReason: "switched" }),
      authorization({ id: "a2" }),
    ];
    expect(activeAuthorization(records, "acct-1")?.id).toBe("a2");
    expect(activeAuthorization(records, "acct-other")).toBeNull();
  });
});

describe("YOUR CARE COST comes before the card (§2)", () => {
  it("computes the addendum's own example from approved data", () => {
    const preview = careCostPreview({ agreedWeeklyHours: 20, hourlyRate: 32 })!;
    expect(preview.estimatedWeekly).toBe(640);
    expect(preview.otherChargesNote).toBe("Per your Service Agreement");
  });

  it("shows nothing rather than guessing", () => {
    expect(careCostPreview({ agreedWeeklyHours: null, hourlyRate: 32 })).toBeNull();
    expect(careCostPreview({ agreedWeeklyHours: 20, hourlyRate: null })).toBeNull();
  });

  it("blocks the payment-method request until the family has seen the cost", () => {
    const preview = careCostPreview({ agreedWeeklyHours: 20, hourlyRate: 32 });
    const unseen = paymentMethodRequestGate({ preview, pricingReviewedAt: null });
    expect(unseen.ok).toBe(false);
    // `in` narrowing: strict is off, so a boolean discriminant does not narrow.
    if ("reason" in unseen) expect(unseen.reason).toBe("not_reviewed");

    const seen = paymentMethodRequestGate({
      preview,
      pricingReviewedAt: "2026-08-22T10:00:00Z",
    });
    expect(seen.ok).toBe(true);
  });

  it("distinguishes 'nothing to show' from 'not shown' — different tasks", () => {
    const gate = paymentMethodRequestGate({ preview: null, pricingReviewedAt: null });
    expect(gate.ok).toBe(false);
    if ("reason" in gate) expect(gate.reason).toBe("no_pricing_to_show");
  });
});

describe("the processor boundary never invents success (§10)", () => {
  it("the fake answers 'processing', never 'succeeded'", async () => {
    const processor = new MemoryPaymentProcessor();
    const result = await processor.initiatePayment({
      billingAccountId: "acct-1",
      invoiceId: "inv-1",
      amount: 648.4,
      method: "card",
      initiatedBy: "client",
    });
    // A fake that resolved payments instantly would train every screen built
    // against it to expect the wrong shape.
    expect(result.state).toBe("processing");
    expect(processor.initiated).toHaveLength(1);
  });

  it("reconciles only from unprocessed verified events, idempotently", () => {
    expect(
      reconcileEvent({
        stripeEventId: "evt_1",
        eventType: "payment_intent.succeeded",
        relatedInvoiceId: "inv-1",
        status: "received",
      }),
    ).toEqual({ kind: "record_payment", invoiceId: "inv-1" });

    expect(
      reconcileEvent({
        stripeEventId: "evt_1",
        eventType: "payment_intent.succeeded",
        relatedInvoiceId: "inv-1",
        status: "processed",
      }).kind,
    ).toBe("nothing");

    expect(
      reconcileEvent({
        stripeEventId: "evt_2",
        eventType: "invoice.payment_failed",
        relatedInvoiceId: "inv-1",
        status: "received",
      }),
    ).toEqual({ kind: "payment_failed", invoiceId: "inv-1" });
  });

  it("an event with no Joy invoice goes to a person, not a guess", () => {
    const outcome = reconcileEvent({
      stripeEventId: "evt_3",
      eventType: "payment_intent.succeeded",
      relatedInvoiceId: null,
      status: "received",
    });
    expect(outcome.kind).toBe("nothing");
  });
});

describe("a failed payment makes two cards (§13)", () => {
  it("tells the client what to do, and the office who to help", () => {
    const cards = paymentFailureCards({
      clientName: "Marcus Bell",
      invoiceNumber: "JH-10428",
      amount: 648.4,
      methodSummary: "Visa •••• 4242",
    });
    expect(cards.client.body).toBe(
      "We couldn't complete the payment for invoice JH-10428 using Visa •••• 4242.",
    );
    expect(cards.client.actions).toEqual(["Update payment method", "Try again"]);
    // No processor diagnostics anywhere near a family.
    expect(cards.client.body).not.toMatch(/declin|insufficient|stripe/i);
    expect(cards.admin.queue).toBe("needs_you");
    expect(cards.admin.line).toContain("Marcus Bell");
  });
});

describe("the receipt text (§18)", () => {
  it("says the payment was received, with the figures left in the portal", () => {
    const msg = composeMessage("payment_received", "+17132319662", {
      firstName: "Susan",
      link: "https://joy.example/p/abc",
    });
    expect(msg.body).toContain("payment was received");
    expect(msg.body).not.toMatch(/\$|\d+\.\d{2}/);
    expect(msg.carrier).toBe("spruce");
  });
});

describe("payment setup is computed from facts, never picked (§4.2, §16)", () => {

  it("starts at not started, with the steps in flow order", () => {
    const { state, nextSteps } = paymentSetupFromFacts({
      pricingReviewedAt: null,
      preference: null,
      methodOnFile: false,
      authorizationCapturedAt: null,
    });
    expect(state).toBe("not_started");
    // Pricing first — the first billing interaction is never "enter your card".
    expect(nextSteps[0]).toContain("care cost");
  });

  it("pay invoice is ready without a saved method — the payer chooses each time", () => {
    const { state } = paymentSetupFromFacts({
      pricingReviewedAt: "2026-08-22T10:00:00Z",
      preference: "pay_invoice",
      methodOnFile: false,
      authorizationCapturedAt: "2026-08-22T10:05:00Z",
    });
    expect(state).toBe("ready");
  });

  it("autopay without a method is method_needed — the spec's own definition", () => {
    const { state, nextSteps } = paymentSetupFromFacts({
      pricingReviewedAt: "2026-08-22T10:00:00Z",
      preference: "autopay",
      methodOnFile: false,
      authorizationCapturedAt: "2026-08-22T10:05:00Z",
    });
    expect(state).toBe("method_needed");
    expect(nextSteps.join(" ")).toContain("nothing to charge");
  });

  it("autopay with method and authorization is ready", () => {
    const { state } = paymentSetupFromFacts({
      pricingReviewedAt: "2026-08-22T10:00:00Z",
      preference: "autopay",
      methodOnFile: true,
      authorizationCapturedAt: "2026-08-22T10:05:00Z",
    });
    expect(state).toBe("ready");
  });
});
