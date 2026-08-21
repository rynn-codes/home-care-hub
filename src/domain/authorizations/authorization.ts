import { daysBetween } from "@/domain/dates";

/**
 * Payer authorisations, and how fast a client is using one up.
 *
 * Joy's client roster has always named payers — Medicaid STAR+PLUS, LTC
 * Insurance, VA Community Care — and one record even says "authorization
 * through Dec 2026". Nothing behind that was modelled, so "auth burn rate"
 * could not be computed at all: there were no authorised units to burn.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS. A private-pay client who uses more
 * hours than expected produces a larger invoice. An authorised client who uses
 * more hours than expected produces hours nobody pays for — the agency
 * delivered the care, the payer declines it, and the first anybody notices is a
 * denial six weeks later. The burn rate is the only thing that catches it while
 * there is still time to request more units.
 *
 * UNITS, NOT HOURS. Payers authorise in their own denomination and 15-minute
 * units are common. Storing hours and converting on the way out is how a
 * quarter of an hour goes missing on every visit, so the unit is what is
 * recorded and `minutesPerUnit` says what one means.
 */

export type PayerKind = "private_pay" | "medicaid" | "ltc_insurance" | "va" | "other";

export const PAYER_LABELS: Record<PayerKind, string> = {
  private_pay: "Private pay",
  medicaid: "Medicaid",
  ltc_insurance: "LTC insurance",
  va: "VA Community Care",
  other: "Other payer",
};

export interface Authorization {
  id: string;
  clientPersonId: string;
  clientName: string;
  payer: PayerKind;
  /** The payer's own reference, for the phone call when something is denied. */
  authorizationNumber: string | null;
  /** What the payer approved, in their units. */
  unitsAuthorized: number;
  minutesPerUnit: number;
  /** Inclusive ISO dates. */
  startsOn: string;
  endsOn: string;
  /** The service the units are for, in the payer's words. */
  service: string | null;
}

export type BurnState =
  | "on_track"
  | "burning_fast"
  | "will_run_out"
  | "exhausted"
  | "expired"
  | "not_started";

export const BURN_LABELS: Record<BurnState, string> = {
  on_track: "On track",
  burning_fast: "Burning faster than the period",
  will_run_out: "Will run out before the period ends",
  exhausted: "Units exhausted",
  expired: "Period ended",
  not_started: "Not started yet",
};

export interface AuthorizationBurn {
  authorization: Authorization;
  unitsUsed: number;
  unitsRemaining: number;
  /** 0–1, or above 1 when more was delivered than authorised. */
  fractionUsed: number;
  /** 0–1: how far through the authorised period today is. */
  fractionElapsed: number;
  /** Units per day at the current rate. Null before any have been used. */
  unitsPerDay: number | null;
  /** ISO date the units are projected to run out. Null when they will not. */
  projectedExhaustionOn: string | null;
  /** Days of care left at the current rate. Null when units will outlast the period. */
  daysOfCareLeft: number | null;
  state: BurnState;
  /** What to do, said to whoever is reading it. */
  advice: string;
}

/** Delivered minutes falling inside an authorisation's window. */
export function minutesInWindow(
  visits: ReadonlyArray<{ clientPersonId?: string; startsAt: string; endsAt: string }>,
  auth: Authorization,
  upTo: string,
): number {
  return visits
    .filter(
      (v) =>
        v.clientPersonId === auth.clientPersonId &&
        v.startsAt.slice(0, 10) >= auth.startsOn &&
        v.startsAt.slice(0, 10) <= auth.endsOn &&
        v.startsAt.slice(0, 10) <= upTo.slice(0, 10),
    )
    .reduce((total, v) => {
      const ms = Date.parse(v.endsAt) - Date.parse(v.startsAt);
      return total + (Number.isFinite(ms) && ms > 0 ? ms / 60_000 : 0);
    }, 0);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * How fast this authorisation is going.
 *
 * The comparison that matters is between how much of the AUTHORISATION has been
 * used and how much of the PERIOD has passed. Half the units at the halfway
 * point is fine; half the units a quarter of the way in means the client runs
 * out in November and Joy either stops or works for nothing.
 */
export function authorizationBurn(input: {
  authorization: Authorization;
  visits: ReadonlyArray<{ clientPersonId?: string; startsAt: string; endsAt: string }>;
  today: string;
}): AuthorizationBurn {
  const auth = input.authorization;
  const today = input.today.slice(0, 10);

  const minutes = minutesInWindow(input.visits, auth, today);
  const unitsUsed = auth.minutesPerUnit > 0 ? minutes / auth.minutesPerUnit : 0;
  const unitsRemaining = auth.unitsAuthorized - unitsUsed;
  const fractionUsed = auth.unitsAuthorized > 0 ? unitsUsed / auth.unitsAuthorized : 0;

  const totalDays = Math.max(daysBetween(auth.startsOn, auth.endsOn) + 1, 1);
  const elapsedDays = Math.min(Math.max(daysBetween(auth.startsOn, today) + 1, 0), totalDays);
  const fractionElapsed = elapsedDays / totalDays;

  const unitsPerDay = elapsedDays > 0 && unitsUsed > 0 ? unitsUsed / elapsedDays : null;

  const daysOfCareLeftRaw =
    unitsPerDay && unitsPerDay > 0 && unitsRemaining > 0
      ? Math.floor(unitsRemaining / unitsPerDay)
      : unitsRemaining <= 0
        ? 0
        : null;

  // Only a date inside the authorisation is worth printing. A week of demo data
  // against a five-month authorisation extrapolates to "runs out in 2077",
  // which is not a projection, it is arithmetic nobody asked for — and printing
  // it next to real dates makes the real ones look equally invented.
  const projected = daysOfCareLeftRaw !== null ? addDays(today, daysOfCareLeftRaw) : null;
  const projectedExhaustionOn = projected && projected <= auth.endsOn ? projected : null;

  const state: BurnState = (() => {
    if (today < auth.startsOn) return "not_started";
    if (unitsRemaining <= 0) return "exhausted";
    if (today > auth.endsOn) return "expired";
    if (projectedExhaustionOn && projectedExhaustionOn < auth.endsOn) return "will_run_out";
    // Ahead of the period by more than a tenth. The tolerance is there because
    // care is not delivered evenly — a week with an extra shift should not read
    // as a crisis.
    if (fractionUsed > fractionElapsed + 0.1) return "burning_fast";
    return "on_track";
  })();

  const advice = (() => {
    switch (state) {
      case "exhausted":
        return `Every authorised unit is used and the period runs to ${auth.endsOn}. Care given from here is not covered.`;
      case "will_run_out":
        return `At this rate the units run out around ${projectedExhaustionOn}, ${daysBetween(projectedExhaustionOn!, auth.endsOn)} days before the period ends. Ask for more now.`;
      case "burning_fast":
        return `${Math.round(fractionUsed * 100)}% of the units used, ${Math.round(fractionElapsed * 100)}% of the way through. Worth watching.`;
      case "expired":
        return `The period ended on ${auth.endsOn} with ${Math.round(unitsRemaining)} units unused.`;
      case "not_started":
        return `Starts ${auth.startsOn}.`;
      default:
        return `${Math.round(fractionUsed * 100)}% used, ${Math.round(fractionElapsed * 100)}% elapsed.`;
    }
  })();

  return {
    authorization: auth,
    unitsUsed: Math.round(unitsUsed * 100) / 100,
    unitsRemaining: Math.round(unitsRemaining * 100) / 100,
    fractionUsed,
    fractionElapsed,
    unitsPerDay: unitsPerDay ? Math.round(unitsPerDay * 100) / 100 : null,
    projectedExhaustionOn,
    daysOfCareLeft: projectedExhaustionOn ? daysOfCareLeftRaw : null,
    state,
    advice,
  };
}

const ORDER: BurnState[] = [
  "exhausted",
  "will_run_out",
  "burning_fast",
  "on_track",
  "not_started",
  "expired",
];

/** Worst first: the ones that cost Joy money if nobody looks. */
export function sortBurn(rows: readonly AuthorizationBurn[]): AuthorizationBurn[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || b.fractionUsed - a.fractionUsed,
    );
}
