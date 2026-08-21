import { describe, expect, it } from "vitest";
import {
  AUTHORIZATION_LIMIT_NOTE,
  detectRunExceptions,
  planBillingRun,
  runIsStale,
  runSummary,
  snapshotHash,
  type RunExceptionKind,
} from "@/domain/billing/run";
import type {
  BillingAccount,
  BillingAccountClient,
  RatePlanVersion,
} from "@/domain/billing/accounts";
import type { Visit } from "@/domain/scheduling/conflicts";

/** Clients are fictional throughout this repository. */

const WEEK = { periodStart: "2026-08-24", periodEnd: "2026-08-30" };

function account(over: Partial<BillingAccount> = {}): BillingAccount {
  return {
    id: "acct-1",
    organizationId: "org-1",
    payerPersonId: "p-diane",
    payerName: "Diane Miller",
    status: "ready",
    collectionMethod: "send_invoice",
    deliveryPreference: "email_and_portal",
    termsDays: 1,
    billingEmail: "diane@example.com",
    billingPhone: null,
    authorizationStatus: "not_captured",
    authorizationCapturedAt: null,
    authorizationDocumentId: null,
    depositRemaining: 0,
    paymentMethod: "ach",
    onHold: false,
    holdReason: null,
    ...over,
  };
}

const link: BillingAccountClient = {
  billingAccountId: "acct-1",
  clientPersonId: "c-evelyn",
  clientName: "Evelyn Carter",
};

function rate(over: Partial<RatePlanVersion> = {}): RatePlanVersion {
  return {
    id: "rate-1",
    billingAccountId: "acct-1",
    clientPersonId: null,
    hourlyRate: 30,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdByUserId: "u-karynn",
    createdAt: "2026-01-01T09:00:00Z",
    ...over,
  };
}

function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Evelyn Carter",
    clientPersonId: "c-evelyn",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-24T09:00:00",
    endsAt: "2026-08-24T13:00:00",
    ...over,
  };
}

function inputs(over: Partial<Parameters<typeof planBillingRun>[0]> = {}) {
  return {
    ...WEEK,
    visits: [visit()],
    accounts: [account()],
    accountClients: [link],
    rateVersions: [rate()],
    ...over,
  };
}

describe("a clean week drafts", () => {
  it("prices the draft from the rate version, not a bare number", () => {
    const run = planBillingRun(inputs());
    expect(run.exceptions).toEqual([]);
    expect(run.drafts).toHaveLength(1);
    expect(run.drafts[0].ratePlanVersionId).toBe("rate-1");
    expect(run.drafts[0].subtotal).toBe(120);
    expect(run.skipped).toEqual([]);
  });

  it("says so in one line", () => {
    expect(runSummary(planBillingRun(inputs()))).toBe("1 draft ready for review.");
  });
});

describe("the seven kinds, before any draft exists", () => {
  const kindsFor = (over: Partial<Parameters<typeof planBillingRun>[0]>) =>
    detectRunExceptions(inputs(over)).map((e) => e.kind);

  it("missing rate blocks — a draft without a rate is a guess in invoice clothes", () => {
    const run = planBillingRun(inputs({ rateVersions: [] }));
    expect(run.exceptions.map((e) => e.kind)).toContain("missing_rate");
    expect(run.drafts).toEqual([]);
    expect(run.skipped[0]).toMatchObject({ clientPersonId: "c-evelyn" });
  });

  it("overlapping service blocks — billing both charges the family twice for one hour", () => {
    expect(
      kindsFor({
        visits: [visit(), visit({ id: "v2", startsAt: "2026-08-24T11:00:00", endsAt: "2026-08-24T15:00:00" })],
      }),
    ).toContain("overlapping_service");
  });

  it("payer not ready blocks, and says which gaps", () => {
    const exceptions = detectRunExceptions(
      inputs({ accounts: [account({ collectionMethod: "automatic", paymentMethod: null })] }),
    );
    const payer = exceptions.find((e) => e.kind === "payer_not_ready")!;
    expect(payer.blocksDraft).toBe(true);
    expect(payer.detail).toContain("A saved card is not permission");
  });

  it("no account at all is also payer not ready", () => {
    expect(kindsFor({ accountClients: [] })).toContain("payer_not_ready");
  });

  it("account hold blocks and carries its reason", () => {
    const exceptions = detectRunExceptions(
      inputs({
        accounts: [account({ onHold: true, holdReason: "Family conversation in progress." })],
      }),
    );
    const hold = exceptions.find((e) => e.kind === "account_hold")!;
    expect(hold.detail).toContain("Family conversation in progress.");
    expect(hold.blocksDraft).toBe(true);
  });

  it("a credit is a task for the reviewer, not a blocked client", () => {
    const run = planBillingRun(
      inputs({
        credits: [{ clientPersonId: "c-evelyn", amount: 80, source: "overpaid the week of 10 August" }],
      }),
    );
    const credit = run.exceptions.find((e) => e.kind === "credit_on_account")!;
    expect(credit.blocksDraft).toBe(false);
    // The draft still exists — §7.2 step 5 has the reviewer apply the credit.
    expect(run.drafts).toHaveLength(1);
    expect(runSummary(run)).toBe("1 draft ready for review.");
  });

  it("authorization limit never fires for Joy, and the reason is on the record", () => {
    // The kind exists because §7.2 lists it; the note says why nothing raises
    // it: all private pay, LTC reimburses the client after Joy is paid.
    const everything = detectRunExceptions(inputs());
    expect(everything.map((e) => e.kind)).not.toContain(
      "authorization_limit" satisfies RunExceptionKind,
    );
    expect(AUTHORIZATION_LIMIT_NOTE).toContain("private pay");
    expect(AUTHORIZATION_LIMIT_NOTE).toContain("Karynn");
  });
});

describe("one blocked client does not hold up the week", () => {
  it("drafts the others and names who was skipped", () => {
    const second: BillingAccountClient = {
      billingAccountId: "acct-2",
      clientPersonId: "c-marcus",
      clientName: "Marcus Bell",
    };
    const run = planBillingRun(
      inputs({
        visits: [
          visit(),
          visit({ id: "v2", clientPersonId: "c-marcus", clientName: "Marcus Bell" }),
        ],
        accounts: [account(), account({ id: "acct-2", payerPersonId: "p-x", payerName: "X" })],
        accountClients: [link, second],
        // Only Evelyn's account has a rate.
        rateVersions: [rate()],
      }),
    );

    expect(run.drafts).toHaveLength(1);
    expect(run.drafts[0].clientName).toBe("Evelyn Carter");
    expect(run.skipped).toEqual([
      { clientPersonId: "c-marcus", clientName: "Marcus Bell", because: "missing_rate" },
    ]);
    expect(runSummary(run)).toBe("1 draft ready for review; 1 exception needs you first.");
  });
});

describe("the snapshot, and the schedule changing under a review", () => {
  it("does not depend on board order", () => {
    const a = visit();
    const b = visit({ id: "v2", startsAt: "2026-08-26T09:00:00", endsAt: "2026-08-26T13:00:00" });
    expect(snapshotHash({ visits: [a, b], rateVersions: [rate()] })).toBe(
      snapshotHash({ visits: [b, a], rateVersions: [rate()] }),
    );
  });

  it("is calm while nothing changed", () => {
    const run = planBillingRun(inputs());
    expect(runIsStale(run, inputs())).toBeNull();
  });

  it("raises the seventh kind when a visit moved after drafting", () => {
    const run = planBillingRun(inputs());
    const moved = inputs({
      visits: [visit({ startsAt: "2026-08-24T10:00:00", endsAt: "2026-08-24T14:00:00" })],
    });
    const stale = runIsStale(run, moved)!;
    expect(stale.kind).toBe("unapproved_schedule_change");
    expect(stale.detail).toContain("Re-run it");
    expect(stale.blocksDraft).toBe(true);
  });

  it("raises it when a rate changed, too — the drafts price a week that is gone", () => {
    const run = planBillingRun(inputs());
    const repriced = inputs({
      rateVersions: [
        rate({ effectiveTo: "2026-08-23" }),
        rate({ id: "rate-2", hourlyRate: 34, effectiveFrom: "2026-08-24" }),
      ],
    });
    expect(runIsStale(run, repriced)?.kind).toBe("unapproved_schedule_change");
  });

  it("ignores changes outside the period", () => {
    const run = planBillingRun(inputs());
    const nextMonth = inputs({
      visits: [visit(), visit({ id: "v9", startsAt: "2026-09-20T09:00:00", endsAt: "2026-09-20T13:00:00" })],
    });
    expect(runIsStale(run, nextMonth)).toBeNull();
  });
});
