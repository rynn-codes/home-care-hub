import type { Visit } from "@/domain/scheduling/conflicts";
import type { TimeEntry } from "@/domain/payroll/hours";

/**
 * The verified service unit — one approved fact about a visit.
 *
 * §6.3 of the billing specification, and the keystone of Phase 1. Joy has
 * visits and time entries, and until now billing and payroll each looked at
 * that raw data and drew their own conclusion. §3.1.5 forbids exactly that:
 * they share verified service facts and never infer one another's result.
 *
 * WHY ONE RECORD IS NOT ENOUGH, AND TWO ARE. This record carries the approved
 * payable minutes AND the approved billable minutes as separate fields. They
 * are usually the same number, and the cases where they diverge are precisely
 * the ones that cost money or trust:
 *
 *   - A caregiver stays forty minutes late because the family asked her to.
 *     Payable, and whether it is billable depends on what Joy agreed.
 *   - A caregiver clocks out with documentation outstanding. Karynn, on that
 *     exact case: "Let her out, record the gap." She worked; she is paid. The
 *     visit is still billable.
 *   - A caregiver arrives forty minutes late. The client had less care than was
 *     scheduled, so the billable figure follows the actual and the payable one
 *     does too — but somebody has to decide that rather than a subtraction.
 *   - A visit runs over because the caregiver could not leave a client alone.
 *     Payable without question. Billing it is a conversation with the family.
 *
 * Which one it is, in every case, is a judgement somebody makes. So neither
 * figure is ever computed and stored without a name against it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not round. Rounding to the
 * nearest quarter hour is common in this industry and it is a business decision
 * with money attached in both directions — it belongs in Karynn's open
 * decisions, not in an arithmetic helper that quietly shaves six minutes off
 * every visit.
 */

export type UnitState = "proposed" | "verified" | "superseded";

export type UnitException =
  | "no_clock_in"
  | "no_clock_out"
  | "documentation_outstanding"
  | "much_shorter_than_scheduled"
  | "much_longer_than_scheduled";

export const EXCEPTION_MESSAGES: Record<UnitException, string> = {
  no_clock_in: "Nobody clocked in. There is no record that this visit happened.",
  no_clock_out: "Still clocked in. The worked time is unknown until somebody closes it.",
  documentation_outstanding:
    "Clocked out with paperwork outstanding. She worked the time — the gap is a separate matter.",
  much_shorter_than_scheduled:
    "Much shorter than scheduled. The client had less care than was booked.",
  much_longer_than_scheduled:
    "Much longer than scheduled. Somebody should say whether that was asked for.",
};

/**
 * How far from scheduled counts as worth a second look.
 *
 * Fifteen minutes either way is a caregiver hitting traffic or staying to
 * finish a conversation, and flagging it would make the exception list
 * meaningless. Joy's own decision, held as one number.
 */
export const VARIANCE_MINUTES = 15;

export interface VerifiedServiceUnit {
  id: string;
  organizationId: string;
  visitId: string;
  clientPersonId: string;
  caregiverPersonId: string | null;

  /**
   * The date the care happened, as YYYY-MM-DD.
   *
   * Both ledgers need it and neither can derive it from anything else here.
   * Payroll places the hours in a workweek, which is where overtime is decided;
   * billing places the line in an invoice period. Taking it from the clock
   * instead would put a visit nobody clocked into whichever week somebody
   * happened to review it, which is how a caregiver ends up with overtime in a
   * week she did not work.
   */
  servedOn: string;

  scheduledMinutes: number;
  /** From the clock. Null when nobody clocked in or out. */
  actualMinutes: number | null;

  /** Payroll's fact. Null until somebody approves it. */
  approvedPayableMinutes: number | null;
  /** Billing's fact. Null until somebody approves it. */
  approvedBillableMinutes: number | null;

  serviceCode: string;
  exceptions: UnitException[];
  /** Why the approved figures are what they are, when they differ from actual. */
  note: string | null;

  state: UnitState;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  /** Set when a later revision replaces this one. */
  supersededBy: string | null;
}

function minutesBetween(from: string, to: string): number {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60_000) : 0;
}

/**
 * Build the unverified record from what actually happened.
 *
 * Proposes nothing. `approvedPayableMinutes` and `approvedBillableMinutes` come
 * back null, because a figure that appears without anybody choosing it is a
 * figure everybody assumes somebody checked.
 */
export function unitFromVisit(input: {
  id: string;
  organizationId: string;
  visit: Visit;
  entry: TimeEntry | null;
}): VerifiedServiceUnit {
  const { visit, entry } = input;
  const scheduledMinutes = minutesBetween(visit.startsAt, visit.endsAt);

  const actualMinutes =
    entry?.clockedInAt && entry.clockedOutAt
      ? minutesBetween(entry.clockedInAt, entry.clockedOutAt)
      : null;

  const exceptions: UnitException[] = [];
  if (!entry) exceptions.push("no_clock_in");
  else if (!entry.clockedOutAt) exceptions.push("no_clock_out");
  if (entry?.exceptionReason) exceptions.push("documentation_outstanding");

  if (actualMinutes !== null) {
    const variance = actualMinutes - scheduledMinutes;
    if (variance < -VARIANCE_MINUTES) exceptions.push("much_shorter_than_scheduled");
    if (variance > VARIANCE_MINUTES) exceptions.push("much_longer_than_scheduled");
  }

  return {
    id: input.id,
    organizationId: input.organizationId,
    visitId: visit.id,
    clientPersonId: visit.clientPersonId ?? "",
    // From the visit, not the clock. A caregiver who was assigned and never
    // clocked in is still the person this visit is about — reading it off the
    // entry left an approved payable figure with nobody to pay it to, which is
    // the exact case (`no_clock_in`) this record is meant to handle.
    caregiverPersonId: entry?.caregiverPersonId ?? visit.caregiverPersonId ?? null,
    servedOn: visit.startsAt.slice(0, 10),
    scheduledMinutes,
    actualMinutes,
    approvedPayableMinutes: null,
    approvedBillableMinutes: null,
    serviceCode: visit.service,
    exceptions,
    note: null,
    state: "proposed",
    verifiedByUserId: null,
    verifiedAt: null,
    supersededBy: null,
  };
}

/**
 * What Joy would suggest, for somebody to accept or change.
 *
 * Separate from `verify` on purpose. A suggestion a person accepts is still
 * that person's decision; a figure that arrives already approved is nobody's.
 */
export function suggestedMinutes(unit: VerifiedServiceUnit): {
  payable: number | null;
  billable: number | null;
} {
  // Unknown worked time suggests nothing. There is no honest guess between
  // "she was there for four hours" and "nobody closed the clock".
  if (unit.actualMinutes === null) return { payable: null, billable: null };

  // Both follow the clock by default. Where they should differ, somebody says
  // so — see the file comment for the four cases that matter.
  return { payable: unit.actualMinutes, billable: unit.actualMinutes };
}

export type VerifyRefusal =
  | "no_approver"
  | "already_verified"
  | "no_worked_time"
  | "negative_minutes"
  | "unexplained_difference";

export const VERIFY_MESSAGES: Record<VerifyRefusal, string> = {
  no_approver: "Verifying a visit is somebody's decision and needs their name against it.",
  already_verified: "This visit is already verified. Revise it instead, so the change is visible.",
  no_worked_time:
    "Nobody clocked this visit, so these minutes are somebody's word rather than " +
    "a measurement. Say what happened and who confirmed it.",
  negative_minutes: "Minutes cannot be negative.",
  unexplained_difference:
    "The payable and billable figures differ. Say why — that difference is the whole reason this record has two fields.",
};

export function verifyRefusals(input: {
  unit: VerifiedServiceUnit;
  payableMinutes: number;
  billableMinutes: number;
  byUserId: string | null;
  note: string;
}): VerifyRefusal[] {
  const refusals: VerifyRefusal[] = [];

  if (!input.byUserId) refusals.push("no_approver");
  if (input.unit.state === "verified") refusals.push("already_verified");
  // A visit with no clock on it. This used to be refused outright, which left
  // the one case Karynn actually described — the caregiver worked and the app
  // recorded nothing — with no way to reach payroll at all: it blocked the run
  // and there was nowhere to record the decision that unblocked it. Approving
  // it is allowed, and the note is not optional, because the figure is somebody
  // asserting a fact the system did not observe.
  if (input.unit.actualMinutes === null && input.payableMinutes > 0 && !input.note.trim()) {
    refusals.push("no_worked_time");
  }
  if (input.payableMinutes < 0 || input.billableMinutes < 0) refusals.push("negative_minutes");

  // The reason the two fields exist is that they sometimes differ. When they do,
  // the difference is a decision, and a decision with no reason recorded is one
  // nobody can defend later — to a family, to a caregiver, or to a surveyor.
  if (input.payableMinutes !== input.billableMinutes && !input.note.trim()) {
    refusals.push("unexplained_difference");
  }

  return refusals;
}

export function verifyUnit(input: {
  unit: VerifiedServiceUnit;
  payableMinutes: number;
  billableMinutes: number;
  byUserId: string | null;
  note: string;
  at: string;
}): VerifiedServiceUnit {
  const refusals = verifyRefusals(input);
  if (refusals.length > 0) {
    throw new Error(refusals.map((r) => VERIFY_MESSAGES[r]).join(" "));
  }

  return {
    ...input.unit,
    approvedPayableMinutes: input.payableMinutes,
    approvedBillableMinutes: input.billableMinutes,
    note: input.note.trim() || null,
    state: "verified",
    verifiedByUserId: input.byUserId,
    verifiedAt: input.at,
  };
}

/**
 * Correct a verified unit by making a new one.
 *
 * §6.3: "Corrections create adjustments/version history; they do not overwrite
 * approved history silently." Payroll may already have paid on the old figure
 * and an invoice may already have been sent from it. Overwriting would leave
 * both ledgers pointing at a record that no longer says what they acted on.
 *
 * Both rows go in one transaction, and the order is not free: write
 * `superseded` first, then `revision`. The database keeps one live unit per
 * visit, so the revision cannot take its place until the original has stepped
 * aside — which is why `id` is an input here rather than something this
 * function invents. `verified_service_units.superseded_by` is a deferred
 * foreign key so the original may name a successor that does not exist yet;
 * a transaction that ends without writing it still fails at commit.
 */
export function reviseUnit(input: {
  unit: VerifiedServiceUnit;
  id: string;
  reason: string;
  byUserId: string;
  at: string;
}): { superseded: VerifiedServiceUnit; revision: VerifiedServiceUnit } {
  if (!input.reason.trim()) {
    throw new Error(
      "Revising a verified visit needs a reason. Payroll may have paid on the old figure and an invoice may have gone out from it.",
    );
  }

  return {
    superseded: { ...input.unit, state: "superseded", supersededBy: input.id },
    revision: {
      ...input.unit,
      id: input.id,
      // A revision earns its own approval. Carrying the old one forward would
      // mean somebody's name sits against figures they never saw.
      approvedPayableMinutes: null,
      approvedBillableMinutes: null,
      note: input.reason.trim(),
      state: "proposed",
      verifiedByUserId: null,
      verifiedAt: null,
      supersededBy: null,
    },
  };
}

// -------------------------------------------------- what each ledger reads --

/**
 * Payroll's hours. Null when nothing has been approved.
 *
 * Deliberately returns null rather than falling back to actual worked time.
 * Payroll paying on an unapproved figure is payroll paying on a number nobody
 * checked, and the whole point of this record is that somebody did.
 */
export function payableHours(unit: VerifiedServiceUnit): number | null {
  if (unit.state !== "verified" || unit.approvedPayableMinutes === null) return null;
  return Math.round((unit.approvedPayableMinutes / 60) * 100) / 100;
}

/** Billing's hours. Same rule, same reason. */
export function billableHours(unit: VerifiedServiceUnit): number | null {
  if (unit.state !== "verified" || unit.approvedBillableMinutes === null) return null;
  return Math.round((unit.approvedBillableMinutes / 60) * 100) / 100;
}

/** The unit in force for a visit, ignoring anything superseded. */
export function unitForVisit(
  units: readonly VerifiedServiceUnit[],
  visitId: string,
): VerifiedServiceUnit | null {
  return units.find((u) => u.visitId === visitId && u.state !== "superseded") ?? null;
}

/** Verification is a work queue: exceptions first, then oldest. */
export function sortForReview(units: readonly VerifiedServiceUnit[]): VerifiedServiceUnit[] {
  return units
    .filter((u) => u.state === "proposed")
    .slice()
    .sort(
      (a, b) =>
        Number(b.exceptions.length > 0) - Number(a.exceptions.length > 0) ||
        a.visitId.localeCompare(b.visitId),
    );
}
