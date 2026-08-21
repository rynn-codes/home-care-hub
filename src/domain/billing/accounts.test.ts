import { describe, expect, it } from "vitest";
import {
  accountForClient,
  accountGaps,
  accountStatusFrom,
  changeRate,
  clientsOnAccount,
  rateInEffect,
  type BillingAccount,
  type BillingAccountClient,
  type RatePlanVersion,
} from "@/domain/billing/accounts";

/** Clients are fictional throughout this repository. */
function account(over: Partial<BillingAccount> = {}): BillingAccount {
  return {
    id: "acct-1",
    organizationId: "org-1",
    payerPersonId: "p-diane",
    payerName: "Diane Miller",
    status: "ready",
    collectionMethod: "automatic",
    deliveryPreference: "email_and_portal",
    termsDays: null,
    billingEmail: "diane@example.com",
    billingPhone: null,
    authorizationStatus: "captured",
    authorizationCapturedAt: "2026-08-01T10:00:00Z",
    authorizationDocumentId: "doc-agreement-1",
    depositRemaining: 0,
    paymentMethod: "card",
    ...over,
  };
}

const LINKS: BillingAccountClient[] = [
  { billingAccountId: "acct-1", clientPersonId: "c-mum", clientName: "Odessa Arceneaux" },
  { billingAccountId: "acct-1", clientPersonId: "c-dad", clientName: "Wendell Hollis" },
  { billingAccountId: "acct-2", clientPersonId: "c-other", clientName: "Lian Huang" },
];

function version(over: Partial<RatePlanVersion> = {}): RatePlanVersion {
  return {
    id: "rate-1",
    billingAccountId: "acct-1",
    clientPersonId: null,
    hourlyRate: 32,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdByUserId: "u-karynn",
    createdAt: "2026-01-01T09:00:00Z",
    ...over,
  };
}

describe("one payer, several clients", () => {
  it("is the case a client-keyed schema cannot express", () => {
    // A daughter paying for both parents. In the old shape she got two
    // unrelated rate records and, once Stripe were connected, two Customers and
    // two saved cards — then rang the office unable to understand why she was
    // charged twice for one arrangement.
    expect(clientsOnAccount(LINKS, "acct-1").map((c) => c.clientName)).toEqual([
      "Odessa Arceneaux",
      "Wendell Hollis",
    ]);
  });

  it("finds the account a client's care is billed to", () => {
    expect(accountForClient(LINKS, "c-dad")).toBe("acct-1");
    expect(accountForClient(LINKS, "c-nobody")).toBeNull();
  });
});

describe("what stops an account billing", () => {
  it("is nothing when everything is on file", () => {
    expect(accountGaps({ account: account(), clients: LINKS, hasRate: true })).toEqual([]);
    expect(accountStatusFrom([])).toBe("ready");
  });

  it("refuses automatic collection without recorded authority", () => {
    // §18.4, and the specific mistake it prevents: charging a saved card
    // off-session on the strength of the card existing. A saved card is not
    // permission, and it is easy to treat as permission because it is right
    // there.
    const gaps = accountGaps({
      account: account({ authorizationStatus: "not_captured" }),
      clients: LINKS,
      hasRate: true,
    });
    expect(gaps).toEqual(["no_authorization"]);
    expect(accountStatusFrom(gaps)).toBe("setup_needed");
  });

  it("tells withdrawn authority apart from never having had it", () => {
    // One is an account nobody finished setting up. The other is a family who
    // has changed their mind, which needs a person rather than a form.
    const gaps = accountGaps({
      account: account({ authorizationStatus: "withdrawn" }),
      clients: LINKS,
      hasRate: true,
    });
    expect(gaps).toEqual(["authorization_withdrawn"]);
    expect(accountStatusFrom(gaps)).toBe("attention_needed");
  });

  it("asks for no authority when the payer pays each invoice themselves", () => {
    // `send_invoice` means the payer is present and choosing every time, so
    // there is nothing to authorise in advance.
    expect(
      accountGaps({
        account: account({
          collectionMethod: "send_invoice",
          authorizationStatus: "not_captured",
          paymentMethod: null,
          termsDays: 1,
        }),
        clients: LINKS,
        hasRate: true,
      }),
    ).toEqual([]);
  });

  it("notices an account that pays for nobody, and one with nowhere to send an invoice", () => {
    expect(
      accountGaps({ account: account(), clients: [], hasRate: true }),
    ).toContain("no_clients");
    expect(
      accountGaps({
        account: account({ billingEmail: null, billingPhone: null }),
        clients: LINKS,
        hasRate: true,
      }),
    ).toContain("no_billing_contact");
  });

  it("counts a missing rate as a gap rather than pricing a week at zero", () => {
    expect(accountGaps({ account: account(), clients: LINKS, hasRate: false })).toContain(
      "no_rate",
    );
  });
});

describe("rates, as of a date", () => {
  const versions = [
    version({ id: "r1", effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30", hourlyRate: 30 }),
    version({ id: "r2", effectiveFrom: "2026-07-01", hourlyRate: 34 }),
    version({ id: "r3", clientPersonId: "c-dad", effectiveFrom: "2026-01-01", hourlyRate: 28 }),
  ];

  const at = (on: string, clientPersonId = "c-mum") =>
    rateInEffect({ versions, billingAccountId: "acct-1", clientPersonId, on });

  it("returns the version in force on the day, not the newest one", () => {
    // An invoice for March priced at July's rate is a family being charged for
    // an agreement they had not made yet.
    expect(at("2026-03-15")?.hourlyRate).toBe(30);
    expect(at("2026-08-15")?.hourlyRate).toBe(34);
  });

  it("lets a client-specific rate beat the account-wide one", () => {
    expect(at("2026-08-15", "c-dad")?.hourlyRate).toBe(28);
  });

  it("returns nothing for a date before any rate existed", () => {
    // Rather than falling back to a default. `buildInvoice` already refuses to
    // invoice without a rate, and inventing one here would defeat that.
    expect(at("2025-12-31")).toBeNull();
  });
});

describe("changing a rate", () => {
  it("closes the old version rather than editing it", () => {
    // Editing would rewrite what a family was told they agreed to, and the
    // invoice sent last March would silently start saying something else.
    const current = version({ id: "r1", hourlyRate: 30, effectiveFrom: "2026-01-01" });
    const { closed, opened } = changeRate({
      current,
      next: {
        id: "r2",
        billingAccountId: "acct-1",
        clientPersonId: null,
        hourlyRate: 34,
        effectiveFrom: "2026-07-01",
        createdByUserId: "u-karynn",
        createdAt: "2026-06-20T09:00:00Z",
      },
    });

    expect(closed!.effectiveTo).toBe("2026-06-30");
    expect(closed!.hourlyRate).toBe(30);
    expect(opened.effectiveTo).toBeNull();
    // No gap and no overlap: the old one ends the day before the new one starts.
    expect(opened.effectiveFrom).toBe("2026-07-01");
  });

  it("refuses to backdate a rate over one already in effect", () => {
    // Backdating rewrites invoices that have already been sent and, worse,
    // already been paid.
    expect(() =>
      changeRate({
        current: version({ effectiveFrom: "2026-07-01" }),
        next: {
          id: "r3",
          billingAccountId: "acct-1",
          clientPersonId: null,
          hourlyRate: 40,
          effectiveFrom: "2026-03-01",
          createdByUserId: "u-karynn",
          createdAt: "2026-08-01T09:00:00Z",
        },
      }),
    ).toThrow(/Backdating a rate/);
  });

  it("opens the first version with nothing to close", () => {
    const { closed, opened } = changeRate({
      current: null,
      next: {
        id: "r1",
        billingAccountId: "acct-1",
        clientPersonId: null,
        hourlyRate: 32,
        effectiveFrom: "2026-01-01",
        createdByUserId: "u-karynn",
        createdAt: "2026-01-01T09:00:00Z",
      },
    });
    expect(closed).toBeNull();
    expect(opened.hourlyRate).toBe(32);
  });
});
