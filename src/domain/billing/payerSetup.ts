import type { BillingAccount, RatePlanVersion } from "@/domain/billing/accounts";

/**
 * Payer setup — how a client pays, and the rate they agreed.
 *
 * A rate change never applies mid-week: an invoice is priced from the rate
 * in force when the care was given, so a change takes effect from the next
 * billing week and the old rate stays on the record as its own version.
 */

export const PAY_TYPES = ["Private Pay", "Private Pay + LTC Insurance"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export interface PayerEdit {
  paymentMethod?: "ach" | "card";
  payer?: string;
}

export interface RateChange {
  id: string;
  clientPersonId: string;
  from: number | null;
  to: number;
  reason: string;
  effectiveFrom: string;
  recordedAt: string;
  recordedByUserId: string;
}

export type PayerSetupRefusal = "no_rate" | "no_method" | "no_reason" | "unchanged";

export const PAYER_SETUP_MESSAGES: Record<PayerSetupRefusal, string> = {
  no_rate: "Enter the hourly rate.",
  no_method: "Choose how this client pays.",
  no_reason: "Say why the rate is changing. It goes on the record.",
  unchanged: "Nothing has changed yet",
};

export function payerSetupRefusals(input: { rate: number; method: "ach" | "card" | null; currentRate: number | null; reason: string; changed: boolean }): PayerSetupRefusal[] {
  const refusals: PayerSetupRefusal[] = [];
  if (!(input.rate > 0)) refusals.push("no_rate");
  if (!input.method) refusals.push("no_method");
  if (input.rate > 0 && input.rate !== input.currentRate && !input.reason.trim()) refusals.push("no_reason");
  if (!input.changed) refusals.push("unchanged");
  return refusals;
}

/** "$30.00 → $32.00 · Annual rate review". */
export function rateChangeLine(change: RateChange): string {
  const to = `$${change.to.toFixed(2)}`;
  return `${change.from === null ? `Recorded at ${to}` : `$${change.from.toFixed(2)} → ${to}`} · ${change.reason}`;
}

/** The authorization column on a payer, in words. */
export function authorizationLine(account: BillingAccount | null): string | null {
  if (!account) return null;
  const on = account.authorizationCapturedAt ? new Date(account.authorizationCapturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  return {
    captured: on ? `Signed authorization on file · ${on}` : "Signed authorization on file",
    not_captured: "Not on file — Joy cannot charge this account",
    withdrawn: on ? `Withdrawn ${on} — Joy cannot charge this account` : "Withdrawn",
  }[account.authorizationStatus];
}

/** "Spruce · Email and Text" — where invoices reach the payer. */
export function billingContactLine(account: BillingAccount | null): string | null {
  if (!account) return null;
  const channels = [account.billingEmail ? "Email" : null, account.billingPhone ? "Text" : null].filter(Boolean);
  return channels.length > 0 ? `Spruce · ${channels.join(" and ")}` : null;
}

/**
 * The seeded rate versions with the demo's rate changes laid on: each change
 * closes the client's open version the day before and opens a new one.
 */
export function applyRateChanges(input: { versions: readonly RatePlanVersion[]; changes: readonly RateChange[]; accountIdFor: (clientPersonId: string) => string | null }): RatePlanVersion[] {
  if (input.changes.length === 0) return [...input.versions];
  let versions = [...input.versions];
  const ordered = [...input.changes].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const change of ordered) {
    const accountId = input.accountIdFor(change.clientPersonId);
    if (!accountId) continue;
    const before = new Date(`${change.effectiveFrom}T12:00:00`);
    before.setDate(before.getDate() - 1);
    const dayBefore = before.toISOString().slice(0, 10);
    versions = versions.map((v) => (v.clientPersonId === change.clientPersonId && v.effectiveTo === null ? { ...v, effectiveTo: dayBefore } : v));
    versions.push({
      id: change.id,
      billingAccountId: accountId,
      clientPersonId: change.clientPersonId,
      hourlyRate: change.to,
      effectiveFrom: change.effectiveFrom,
      effectiveTo: null,
      createdByUserId: change.recordedByUserId,
      createdAt: change.recordedAt,
    });
  }
  return versions;
}
