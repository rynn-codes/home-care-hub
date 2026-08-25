import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import type { Visit } from "@/domain/scheduling/conflicts";
import { buildInvoice, isBillable, type Invoice, type PaymentMethod } from "@/domain/billing/invoice";
import {
  accountGaps,
  ACCOUNT_GAP_MESSAGES,
  rateInEffect,
  shareOf,
  type BillingAccount,
  type BillingAccountClient,
  type RatePlanVersion,
} from "@/domain/billing/accounts";
import type { CarryForwardLine } from "@/domain/billing/invoice";

/**
 * The weekly billing run — §7.2 steps 1 to 4.
 *
 * Joy bills the upcoming care week (§7.1, and Karynn, 21 August: "We bill in
 * advance"). A run is those four steps made inspectable: create the run for
 * the period, snapshot what it was priced from, detect the exceptions BEFORE
 * any draft exists, then draft for the clients with nothing in the way.
 *
 * WHY EXCEPTIONS COME BEFORE DRAFTS. A draft that should not exist has to be
 * noticed, explained and deleted; an exception is a task. The order in the
 * spec is not stylistic — it is the difference between "these three families
 * need something fixed" and three wrong invoices one review away from being
 * approved.
 *
 * THE SEVEN KINDS ARE THE SPEC'S, VERBATIM. §7.2 step 3: "missing rate,
 * overlapping service, unapproved schedule change, payer not ready,
 * authorization limit, credit/adjustment, or account hold." All seven exist
 * here even though one of them cannot fire for Joy today — see
 * AUTHORIZATION_LIMIT_NOTE — because the enum is the contract the developer
 * wires to, and a kind that is missing is a kind nobody can ever log.
 */

/**
 * Joy's billing calendar. Karynn, 22 August: "It would need to be Saturday AM
 * you can draft bc our billing ends of Friday. If we ever do get a 24/7 case,
 * the billing would end on Friday 11:59 PM. Everything should be prepped to go
 * out. I can approve anytime from Sat–Mon and then it goes out."
 *
 * So the billing week is SATURDAY through FRIDAY — the same seven days as the
 * Gusto payroll week, which means payroll, billing and Gusto all agree on what
 * "the week" is. And the Saturday draft bills the week beginning the FOLLOWING
 * Saturday. Karynn's worked example (22 August) settles the offset: "Client is
 * billed on Aug 10th for services that will start on Aug 15–21st" — invoice
 * out Monday the 10th means drafted Saturday the 8th, billing the week of the
 * 15th. A week's head start is what makes the whole collection rhythm
 * possible: reminders Thursday and Friday, and the Sunday gate, all BEFORE
 * Joy is more than a weekend exposed.
 */
export const BILLING_CALENDAR = {
  weekStartsOn: 6 as const, // Saturday
  draftsOn: "Saturday morning, for the week beginning the FOLLOWING Saturday",
  approvalWindow: "Saturday to Monday",
  sendsOn: "when approved — out by Monday, five days before the care week",
};

/**
 * The Saturday on or before this date — the billing week containing it.
 *
 * One line, delegating, on purpose: this was its own copy of the Saturday
 * arithmetic, and a second copy of a date rule is how two screens end up
 * naming two different weeks. The agency week is defined once, in
 * `domain/calendar/agencyWeek`.
 */
export function billingWeekStart(iso: string): string {
  return agencyWeekStart(iso);
}

/**
 * The week the office is billing and collecting for right now: the one that
 * begins NEXT Saturday. On Monday the 10th, that is the 15th — the invoice
 * going out today is for that week, per the worked example above.
 */
export function upcomingBillingWeek(iso: string): string {
  const thisWeek = billingWeekStart(iso);
  const d = new Date(`${thisWeek}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export type RunExceptionKind =
  | "missing_rate"
  | "overlapping_service"
  | "unapproved_schedule_change"
  | "payer_not_ready"
  | "authorization_limit"
  | "credit_on_account"
  | "account_hold";

export const RUN_EXCEPTION_LABELS: Record<RunExceptionKind, string> = {
  missing_rate: "No rate in effect",
  overlapping_service: "Overlapping visits",
  unapproved_schedule_change: "Schedule changed since the snapshot",
  payer_not_ready: "Payer not ready",
  authorization_limit: "Authorization limit",
  credit_on_account: "Credit on the account",
  account_hold: "Account on hold",
};

/**
 * §7.2 lists "authorization limit" because agencies billing Medicaid or an
 * insurer run out of authorised units. Joy is all private pay — Karynn,
 * 21 August: "We are all private pay... We don't need anything regarding
 * authorizations." Long-term-care insurance reimburses the CLIENT after Joy is
 * paid, so no authorisation ever caps a Joy invoice. The kind stays in the
 * enum as the spec's contract; nothing in this file ever raises it, and that
 * is a business fact, not an omission.
 */
export const AUTHORIZATION_LIMIT_NOTE =
  "Never fires: Joy is all private pay, so no payer authorisation caps an invoice. " +
  "LTC insurance reimburses the client after Joy is paid. — Karynn, 21 August";

export interface RunException {
  kind: RunExceptionKind;
  clientPersonId: string | null;
  clientName: string | null;
  /** Plain words the office can act on. */
  detail: string;
  /**
   * Whether this stops the client's draft being generated. A credit does not —
   * the reviewer applies it at §7.2 step 5. A missing rate does: the draft
   * would be a guess wearing an invoice's clothes.
   */
  blocksDraft: boolean;
}

// ------------------------------------------------------------- snapshot --

/**
 * A stable fingerprint of what the run priced.
 *
 * FNV-1a over a canonical string, not a cryptographic hash — the question it
 * answers is "did anything change between review and approval", asked between
 * two honest parties. The canonical string sorts by visit id so the hash does
 * not depend on board order.
 */
export function snapshotHash(input: {
  visits: readonly Visit[];
  rateVersions: readonly RatePlanVersion[];
}): string {
  const visits = [...input.visits]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((v) => `${v.id}|${v.clientPersonId ?? ""}|${v.startsAt}|${v.endsAt}|${v.service}`)
    .join(";");
  const rates = [...input.rateVersions]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `${r.id}|${r.hourlyRate}|${r.effectiveFrom}|${r.effectiveTo ?? ""}`)
    .join(";");

  let hash = 0x811c9dc5;
  const text = `${visits}#${rates}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ------------------------------------------------------------ detection --

interface RunInputs {
  periodStart: string;
  periodEnd: string;
  /** The whole board; the run selects the period's billable client visits. */
  visits: readonly Visit[];
  accounts: readonly BillingAccount[];
  accountClients: readonly BillingAccountClient[];
  rateVersions: readonly RatePlanVersion[];
  /**
   * Unapplied money: overpayments and credit adjustments waiting to reduce a
   * bill. Positive dollars.
   */
  credits?: readonly { clientPersonId: string; amount: number; source: string }[];
  /**
   * What last week owes this week, per client — Karynn's carry-forward model.
   * Built by `carryForwardFrom` out of the previous week's invoice and its
   * verified units.
   */
  carryForward?: Readonly<Record<string, readonly CarryForwardLine[]>>;
}

function periodVisits(input: RunInputs): Visit[] {
  return input.visits.filter(
    (v) =>
      isBillable(v) &&
      v.clientPersonId &&
      v.startsAt.slice(0, 10) >= input.periodStart &&
      v.startsAt.slice(0, 10) <= input.periodEnd,
  );
}

function overlap(a: Visit, b: Visit): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * §7.2 step 3, run over the upcoming period.
 *
 * Detection is per CLIENT because that is what a draft is for — one blocked
 * client does not hold up the rest of the week's invoices. That is also why
 * the return is a flat list rather than a verdict: the office reads it as a
 * work queue.
 */
export function detectRunExceptions(input: RunInputs): RunException[] {
  const exceptions: RunException[] = [];
  const visits = periodVisits(input);

  const clients = new Map<string, string>();
  for (const v of visits) clients.set(v.clientPersonId!, v.clientName);

  for (const [clientId, clientName] of clients) {
    const links = input.accountClients.filter((c) => c.clientPersonId === clientId);

    // -------------------------------------------------- payer not ready --
    if (links.length === 0) {
      exceptions.push({
        kind: "payer_not_ready",
        clientPersonId: clientId,
        clientName,
        detail: "No billing account pays for this client. Set one up before the week is billed.",
        blocksDraft: true,
      });
    } else {
      // Shares that do not reach the whole bill. The database allows the gap
      // (the moment between adding the first sibling and the second is a real
      // editing state); the run is where it must not pass, because a silently
      // unbilled 40% is revenue nobody notices losing.
      const committed = links.reduce((t, l) => t + shareOf(l), 0);
      if (committed !== 100) {
        exceptions.push({
          kind: "payer_not_ready",
          clientPersonId: clientId,
          clientName,
          detail: `The payers on this client cover ${committed}% of the bill. Shares must reach 100 before the week is billed.`,
          blocksDraft: true,
        });
      }

      for (const link of links) {
        const account = input.accounts.find((a) => a.id === link.billingAccountId) ?? null;
        if (!account) continue;

        if (account.onHold) {
          // ------------------------------------------------- account hold --
          exceptions.push({
            kind: "account_hold",
            clientPersonId: clientId,
            clientName,
            detail: account.holdReason
              ? `Billing is paused on ${account.payerName}'s account: ${account.holdReason}`
              : `Billing is paused on ${account.payerName}'s account.`,
            blocksDraft: true,
          });
        }

        const gaps = accountGaps({
          account,
          clients: input.accountClients,
          // The rate has its own exception below, with a better message.
          hasRate: true,
        });
        if (gaps.length > 0) {
          exceptions.push({
            kind: "payer_not_ready",
            clientPersonId: clientId,
            clientName,
            detail: gaps.map((g) => ACCOUNT_GAP_MESSAGES[g]).join(" "),
            blocksDraft: true,
          });
        }

        // ------------------------------------------------------ missing rate --
        const rate = rateInEffect({
          versions: input.rateVersions,
          billingAccountId: account.id,
          clientPersonId: clientId,
          on: input.periodStart,
        });
        if (!rate) {
          exceptions.push({
            kind: "missing_rate",
            clientPersonId: clientId,
            clientName,
            detail: `No rate is in effect on ${account.payerName}'s account for the week of ${input.periodStart}. The agreed rate is emailed at admission — record it before billing.`,
            blocksDraft: true,
          });
        }
      }
    }

    // ---------------------------------------------- overlapping service --
    const mine = visits.filter((v) => v.clientPersonId === clientId);
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        if (overlap(mine[i], mine[j])) {
          exceptions.push({
            kind: "overlapping_service",
            clientPersonId: clientId,
            clientName,
            detail:
              `Two visits overlap on ${mine[i].startsAt.slice(0, 10)}. ` +
              "Billing both would charge the family twice for the same hour — fix the schedule first.",
            blocksDraft: true,
          });
        }
      }
    }

    // --------------------------------------------------- credit on account --
    for (const credit of input.credits ?? []) {
      if (credit.clientPersonId !== clientId) continue;
      exceptions.push({
        kind: "credit_on_account",
        clientPersonId: clientId,
        clientName,
        detail: `$${credit.amount.toFixed(2)} sits unapplied (${credit.source}). Apply it at review rather than invoicing over it.`,
        // The reviewer applies it — §7.2 step 5 lists credits by name.
        blocksDraft: false,
      });
    }
  }

  return exceptions;
}

// -------------------------------------------------------------- the run --

export interface BillingRun {
  periodStart: string;
  periodEnd: string;
  /** What the drafts were priced from. Compare with `runIsStale`. */
  snapshotHash: string;
  exceptions: RunException[];
  /** Drafts for the clients with nothing blocking. §7.2 step 4: state `draft`. */
  drafts: Invoice[];
  /** Who was skipped, and the exception that skipped them. */
  skipped: { clientPersonId: string; clientName: string; because: RunExceptionKind }[];
}

/**
 * §7.2 steps 1–4 in one call: snapshot, detect, then draft only where nothing
 * blocks.
 */
export function planBillingRun(input: RunInputs): BillingRun {
  const exceptions = detectRunExceptions(input);
  const visits = periodVisits(input);

  const blocked = new Map<string, RunExceptionKind>();
  for (const e of exceptions) {
    if (e.blocksDraft && e.clientPersonId && !blocked.has(e.clientPersonId)) {
      blocked.set(e.clientPersonId, e.kind);
    }
  }

  const clients = new Map<string, string>();
  for (const v of visits) clients.set(v.clientPersonId!, v.clientName);

  const drafts: Invoice[] = [];
  const skipped: BillingRun["skipped"] = [];

  for (const [clientId, clientName] of clients) {
    const because = blocked.get(clientId);
    if (because) {
      skipped.push({ clientPersonId: clientId, clientName, because });
      continue;
    }

    // One draft per PAYER. Two siblings at 50/50 each get their own invoice
    // for their own share, on their own account and terms.
    const links = input.accountClients.filter((c) => c.clientPersonId === clientId);
    const carry = input.carryForward?.[clientId] ?? [];

    for (const link of links) {
      const account = input.accounts.find((a) => a.id === link.billingAccountId)!;
      const rate = rateInEffect({
        versions: input.rateVersions,
        billingAccountId: account.id,
        clientPersonId: clientId,
        on: input.periodStart,
      })!;
      const share = shareOf(link) / 100;

      // The agreement's hours, scaled by the payer's share, and the same for
      // every carried line — the siblings split the corrections exactly as
      // they split the week.
      const advance =
        link.agreedWeeklyHours != null
          ? {
              agreedHours: Math.round(link.agreedWeeklyHours * share * 100) / 100,
              carryForward: carry.map((c) => ({
                ...c,
                hours: Math.round(c.hours * share * 100) / 100,
              })),
            }
          : null;

      drafts.push(
        buildInvoice({
          terms: {
            clientPersonId: clientId,
            clientName,
            // The version prices it; a bare rate here would be a second answer.
            hourlyRate: null,
            paymentMethod: (account.paymentMethod ?? "check") as PaymentMethod,
            depositRemaining: account.depositRemaining,
          },
          visits: input.visits,
          weekStart: input.periodStart,
          rateVersion: { id: rate.id, hourlyRate: rate.hourlyRate },
          advance,
        }),
      );
    }
  }

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    snapshotHash: snapshotHash({ visits, rateVersions: input.rateVersions }),
    exceptions,
    drafts,
    skipped,
  };
}

/**
 * §7.2's "unapproved schedule change", checked where it actually happens:
 * between the run being reviewed and somebody approving its drafts. The visit
 * moved, the rate changed, a shift was added — the drafts no longer describe
 * the week they price.
 */
export function runIsStale(run: BillingRun, current: RunInputs): RunException | null {
  const now = snapshotHash({
    visits: periodVisits(current),
    rateVersions: current.rateVersions,
  });
  if (now === run.snapshotHash) return null;

  return {
    kind: "unapproved_schedule_change",
    clientPersonId: null,
    clientName: null,
    detail:
      "The schedule or a rate changed after this run was drafted. Re-run it — approving these drafts would bill a week that no longer exists.",
    blocksDraft: true,
  };
}

/** One line for the top of the screen. */
export function runSummary(run: BillingRun): string {
  const blocking = run.exceptions.filter((e) => e.blocksDraft).length;
  const draftWord = run.drafts.length === 1 ? "draft" : "drafts";
  if (blocking === 0 && run.drafts.length === 0) return "Nothing to bill this week.";
  if (blocking === 0) return `${run.drafts.length} ${draftWord} ready for review.`;
  return `${run.drafts.length} ${draftWord} ready for review; ${blocking} ${
    blocking === 1 ? "exception needs" : "exceptions need"
  } you first.`;
}
