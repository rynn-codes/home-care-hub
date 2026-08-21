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
  it("puts one payer on two clients, which the old shape could not express", () => {
    // Diane pays for her mother and her father. Keyed on the client she had two
    // unrelated records; once Stripe were connected, two Customers and two
    // saved cards.
    const diane = clientsOnAccount(seedBillingAccountClients, "acct-diane");
    expect(diane).toHaveLength(2);
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
    // A saved card and nobody has recorded authority to use it. It looks ready
    // and is not, which is the whole reason the constraint is in the database
    // rather than only in a form.
    const priya = seedBillingAccounts.find((a) => a.id === "acct-priya")!;
    expect(priya.collectionMethod).toBe("automatic");
    expect(priya.paymentMethod).toBe("card");
    expect(priya.authorizationStatus).toBe("not_captured");
    expect(priya.status).not.toBe("ready");
  });

  it("tells withdrawn authority apart from never having asked", () => {
    const yvonne = seedBillingAccounts.find((a) => a.id === "acct-yvonne")!;
    expect(yvonne.status).toBe("attention_needed");
  });

  it("carries no rate for the client who deliberately has none", () => {
    // billingSeed leaves one client unpriced on purpose: the interesting
    // behaviour is Joy refusing to invoice rather than sending a zero.
    const unpriced = seedBillingTerms.filter((t) => t.hourlyRate === null);
    expect(unpriced.length).toBeGreaterThan(0);
    for (const t of unpriced) {
      expect(seedRatePlanVersions.some((r) => r.clientPersonId === t.clientPersonId)).toBe(false);
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
