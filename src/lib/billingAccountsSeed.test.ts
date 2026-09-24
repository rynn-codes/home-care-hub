import { describe, expect, it } from "vitest";
import {
  seedBillingAccountClients,
  seedBillingAccounts,
  seedRatePlanVersions,
} from "@/lib/billingAccountsSeed";
import {
  accountGaps,
  clientsOnAccount,
  rateInEffect,
} from "@/domain/billing/accounts";
import { seedBillingTerms } from "@/lib/billingSeed";

describe("the seeded accounts", () => {
  it("gives every client their own account, in their own name", () => {
    // Joy is all private pay and invoices the client. The payer on each
    // account is the client, whoever holds the chequebook at home.
    for (const terms of seedBillingTerms) {
      const account = seedBillingAccounts.find((a) => a.id === `acct-${terms.clientPersonId}`)!;
      expect(account.payerPersonId).toBe(terms.clientPersonId);
      expect(clientsOnAccount(seedBillingAccountClients, account.id)).toHaveLength(1);
    }
  });

  it("bills the agreed weekly hours the standing schedule actually carries", () => {
    // The advance invoice bills the agreement's hours, read from the
    // schedule so the two cannot disagree.
    const charles = seedBillingAccountClients.find((l) => l.clientPersonId === "c-charles")!;
    expect(charles.agreedWeeklyHours).toBe(56);
  });

  it("bills every client that has terms, and no more", () => {
    // Derived from the existing terms rather than listed separately, so the two
    // seeds cannot disagree about who Joy bills for.
    expect(seedBillingAccountClients.map((l) => l.clientPersonId).sort()).toEqual(
      seedBillingTerms.map((t) => t.clientPersonId).sort(),
    );
  });

  it("gives a client one payer, never two", () => {
    const ids = seedBillingAccountClients.map((l) => l.clientPersonId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not claim an account is ready when it is not", () => {
    // Status is computed from the gaps rather than asserted in the fixture. A
    // seed that hardcodes "ready" is a seed that demonstrates the check is
    // absent.
    for (const account of seedBillingAccounts) {
      const gaps = accountGaps({
        account,
        clients: seedBillingAccountClients,
        hasRate: seedRatePlanVersions.some((r) => r.billingAccountId === account.id),
      });
      expect(account.status === "ready", `${account.payerName}`).toBe(gaps.length === 0);
    }
  });

  it("includes the state §18.4 exists to prevent", () => {
    // Automatic collection with nothing to charge and nobody's authority
    // recorded. It looks like setup and is not finished, which is the whole
    // reason the constraint is in the database rather than only in a form.
    const vince = seedBillingAccounts.find((a) => a.id === "acct-c-vince")!;
    expect(vince.collectionMethod).toBe("automatic");
    expect(vince.paymentMethod).toBeNull();
    expect(vince.authorizationStatus).toBe("not_captured");
    expect(vince.status).not.toBe("ready");
  });

  it("tells withdrawn authority apart from never having asked", () => {
    const robert = seedBillingAccounts.find((a) => a.id === "acct-c-robert")!;
    expect(robert.status).toBe("attention_needed");
  });

  it("keeps rate versions in step with the billing terms", () => {
    // Every priced client has a version in effect and nobody unpriced does —
    // a rate version with no terms behind it would price a client Joy has
    // not agreed a rate with. (Since the cast swap every seeded client is
    // priced; the unpriced case is exercised by the invoice tests.)
    for (const t of seedBillingTerms) {
      const hasVersion = seedRatePlanVersions.some((r) => r.clientPersonId === t.clientPersonId);
      expect(hasVersion, t.clientName).toBe(t.hourlyRate !== null);
    }
  });

  it("prices a client from the version in effect, not from a default", () => {
    const priced = seedBillingTerms.find((t) => t.hourlyRate !== null)!;
    const link = seedBillingAccountClients.find(
      (l) => l.clientPersonId === priced.clientPersonId,
    )!;

    expect(
      rateInEffect({
        versions: seedRatePlanVersions,
        billingAccountId: link.billingAccountId,
        clientPersonId: priced.clientPersonId,
        on: "2026-08-21",
      })?.hourlyRate,
    ).toBe(priced.hourlyRate);

    // And nothing before the rate existed.
    expect(
      rateInEffect({
        versions: seedRatePlanVersions,
        billingAccountId: link.billingAccountId,
        clientPersonId: priced.clientPersonId,
        on: "2025-06-01",
      }),
    ).toBeNull();
  });
});
