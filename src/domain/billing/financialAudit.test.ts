import { describe, expect, it } from "vitest";
import {
  billingRunCreated,
  externalPaymentRecorded,
  holdLifted,
  holdPlaced,
  invoiceAdjusted,
  invoiceApproved,
  invoiceIssued,
  invoiceSubmitted,
  invoiceWrittenOff,
  payerChanged,
} from "@/domain/billing/financialAudit";
import { AUDITED_ACTIONS, createAuditWriter, type AuditRecord } from "@/domain/audit/audit";

/**
 * The property these tests hold: every financial action produces an entry the
 * WRITER accepts — attributed, in the audited vocabulary — and no entry ever
 * carries what §12 keeps off financial paper: a service description, a
 * diagnosis, a wage.
 */

const ALL = [
  invoiceSubmitted({ invoiceId: "i1", total: 480 }),
  invoiceApproved({ invoiceId: "i1", total: 480, lineCount: 2, ratePlanVersionId: "r1" }),
  invoiceIssued({ invoiceId: "i1", total: 480, dueOn: "2026-08-25" }),
  invoiceAdjusted({
    invoiceId: "i1",
    adjustmentId: "a1",
    kind: "credit",
    amount: 80,
    reason: "One visit ran short.",
    balanceAfter: 400,
  }),
  invoiceWrittenOff({ invoiceId: "i1", balance: 400, reason: "Uncollectable after 90 days." }),
  externalPaymentRecorded({
    paymentId: "p1",
    invoiceId: "i1",
    amount: 400,
    method: "check",
    receivedOn: "2026-08-26",
    reference: "chq 1042",
    balanceAfter: 0,
  }),
  payerChanged({
    clientPersonId: "c1",
    fromAccountId: "acct-1",
    toAccountId: "acct-2",
    reason: "Daughter has taken over the finances.",
  }),
  holdPlaced({ accountId: "acct-1", reason: "Family conversation in progress." }),
  holdLifted({ accountId: "acct-1" }),
  billingRunCreated({
    runId: "run-1",
    periodStart: "2026-08-24",
    periodEnd: "2026-08-30",
    drafts: 3,
    exceptions: 1,
  }),
];

describe("every financial action is in the audited vocabulary", () => {
  it("uses actions the trail knows", () => {
    // An action outside the list still records, but the Audit screen would
    // print raw dot-notation at Karynn. The vocabulary is the contract.
    for (const entry of ALL) {
      expect(AUDITED_ACTIONS).toContain(entry.action);
    }
  });

  it("always points at the thing that changed", () => {
    for (const entry of ALL) {
      expect(entry.entityId).toBeTruthy();
      expect(entry.entityType).toBeTruthy();
    }
  });
});

describe("what reaches the trail", () => {
  async function through(entry: (typeof ALL)[number]): Promise<AuditRecord> {
    let written: AuditRecord | null = null;
    const writer = createAuditWriter({
      async append(e) {
        written = e;
      },
    });
    const result = await writer.record({
      ...entry,
      organizationId: "org-1",
      actor: { type: "user", userId: "u-karynn" },
    });
    expect(result.ok).toBe(true);
    return written!;
  }

  it("carries figures and reasons — money is not health information", async () => {
    const written = await through(
      invoiceAdjusted({
        invoiceId: "i1",
        adjustmentId: "a1",
        kind: "credit",
        amount: 80,
        reason: "One visit ran short.",
        balanceAfter: 400,
      }),
    );
    expect(written.after).toMatchObject({ amount: 80, reason: "One visit ran short." });
  });

  it("never carries a service description, a diagnosis or a wage", () => {
    // Structural, like the invoice_lines table: the builders have no parameter
    // for any of these, so the entry cannot carry one. This test is the tripwire
    // for somebody adding a "helpful" description field later.
    const forbidden = ["description", "service", "diagnosis", "wage", "narrative", "note"];
    for (const entry of ALL) {
      for (const payload of [entry.before, entry.after, entry.metadata]) {
        if (!payload) continue;
        for (const key of Object.keys(payload)) {
          expect(forbidden).not.toContain(key.toLowerCase());
        }
      }
    }
  });

  it("approval records which rate version priced the invoice", async () => {
    const written = await through(
      invoiceApproved({ invoiceId: "i1", total: 480, lineCount: 2, ratePlanVersionId: "r1" }),
    );
    // "Why was I charged this" still has an answer after the rate changes.
    expect(written.after).toMatchObject({ ratePlanVersionId: "r1" });
  });

  it("the external payment carries the spec's own list: reference, date, method", async () => {
    const written = await through(
      externalPaymentRecorded({
        paymentId: "p1",
        invoiceId: "i1",
        amount: 400,
        method: "check",
        receivedOn: "2026-08-26",
        reference: "chq 1042",
        balanceAfter: 0,
      }),
    );
    expect(written.after).toMatchObject({
      reference: "chq 1042",
      receivedOn: "2026-08-26",
      method: "check",
    });
  });
});
