import { OVERTIME_THRESHOLD_HOURS } from "@/domain/scheduling/conflicts";
import { AT_ADDRESS_FEET } from "@/domain/scheduling/reminders";
import { isPending, type ApprovedLocation } from "@/domain/scheduling/locations";
import { expensesLine, live, needsReview, receiptMissing, type VisitExpense } from "@/domain/scheduling/expenses";
import type { RateKind } from "@/domain/scheduling/visitPay";

/**
 * "Joy is checking" — what Joy looks at while a visit is being edited, and
 * what it says about each thing. Nothing here blocks a save on its own; a
 * person reads the list and decides.
 */

export type Verdict = "pass" | "warn" | "blocked" | "unknown";

export interface ReviewCheck {
  key: string;
  title: string;
  detail: string;
  verdict: Verdict;
}

const PING_MATCH_MINUTES = 5;
const minutesApart = (a: string, b: string) => Math.abs(Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));
const valid = (iso: string | null | undefined): iso is string => typeof iso === "string" && !Number.isNaN(new Date(iso).getTime());
const money = (n: number) => `$${n.toFixed(2)}`;
const firstName = (name: string | null) => (name ?? "").split(" ")[0] || "the caregiver";

export function onCallNote(input: { onCall: boolean; payRate: number | null; standardRate: number | null; caregiverName: string | null }): string | null {
  if (!input.onCall) return null;
  const who = firstName(input.caregiverName);
  const tail = " Hourly or daily is still set in Billed.";
  if (input.standardRate === null) return `On-call rate. ${who} has no standard rate on file to compare it with.${tail}`;
  if (input.payRate === null || Math.abs(input.payRate - input.standardRate) < 0.005) {
    return `Flagged on-call but paid at ${who}'s standard ${money(input.standardRate)} — on-call usually pays more.${tail}`;
  }
  if (input.payRate < input.standardRate) return `Flagged on-call and paid below ${who}'s standard ${money(input.standardRate)} — check the rate.${tail}`;
  return `On-call rate, so pay is above ${who}'s standard ${money(input.standardRate)}.${tail}`;
}

function onCallCheck(input: { payRate: number | null; standardRate: number | null; rateKind: RateKind; caregiverName: string; payNextDay: boolean }): string {
  const kind = input.rateKind === "daily" ? "daily" : "hourly";
  const next = input.payNextDay ? " Marked to be paid out next day." : "";
  const needs = " Needs a supervisor before payroll runs.";
  if (input.payRate === null) return `Flagged on-call with no rate on the visit yet.${needs}${next}`;
  if (input.standardRate === null) return `Flagged on-call at ${money(input.payRate)} ${kind}; ${firstName(input.caregiverName)} has no standard rate to compare.${needs}${next}`;
  if (Math.abs(input.payRate - input.standardRate) < 0.005) return `Flagged on-call but paid at the standard ${money(input.standardRate)} ${kind} — on-call usually pays more.${needs}${next}`;
  return `Flagged on-call, so ${money(input.payRate)} ${kind} is expected instead of ${money(input.standardRate)}.${needs}${next}`;
}

export function reviewVisit(input: {
  clockedInAt: string | null;
  clockedOutAt: string | null;
  pings: ReadonlyArray<{ at: string; feet: number }>;
  inLocation: ApprovedLocation | null;
  outLocation: ApprovedLocation | null;
  outSameAsIn: boolean;
  scheduledHours: number;
  actualHours: number;
  otherHoursThisWeek: number;
  payrollWeek: string;
  clientName: string;
  expenses: readonly VisitExpense[];
  mileageRatePerMile: number;
  payRate: number | null;
  standardRate: number | null;
  rateKind: RateKind;
  caregiverName: string | null;
  onCall: boolean;
  payNextDay: boolean;
}): ReviewCheck[] {
  const checks: ReviewCheck[] = [];
  const near = input.pings.filter((p) => p.feet <= AT_ADDRESS_FEET && valid(p.at));
  const matches = (iso: string | null) => valid(iso) && near.some((p) => minutesApart(p.at, iso) <= PING_MATCH_MINUTES);
  if (near.length === 0) {
    checks.push({ key: "gps", title: "GPS trail", detail: "No location was recorded for this visit — nothing to match against.", verdict: "unknown" });
  } else {
    const both = matches(input.clockedInAt) && matches(input.clockedOutAt);
    const one = matches(input.clockedInAt) || matches(input.clockedOutAt);
    checks.push({
      key: "gps",
      title: "GPS trail",
      detail: both ? `Both clocks match a ping within ${PING_MATCH_MINUTES} minutes.` : one ? `One clock matches a ping; the other has nothing within ${PING_MATCH_MINUTES} minutes.` : "Neither clock matches a ping at the address.",
      verdict: both ? "pass" : "warn",
    });
  }
  checks.push({
    key: "in_address",
    title: "Clock-in address",
    detail: input.inLocation === null ? "Nothing picked yet." : isPending(input.inLocation) ? `${input.inLocation.label} is new — it will go to you to approve.` : `Approved on ${input.clientName || "the client"}'s record.`,
    verdict: input.inLocation === null ? "unknown" : isPending(input.inLocation) ? "warn" : "pass",
  });
  checks.push({
    key: "out_address",
    title: "Clock-out address",
    detail: input.outSameAsIn
      ? "Same as clock-in — nothing to check."
      : input.outLocation === null
        ? "Nothing picked yet."
        : isPending(input.outLocation)
          ? `${input.outLocation.label} is new — it will go to you to approve.`
          : `${input.outLocation.label} is approved for this client.`,
    verdict: input.outSameAsIn ? "pass" : input.outLocation === null ? "unknown" : isPending(input.outLocation) ? "warn" : "pass",
  });
  if (input.caregiverName) {
    const who = input.caregiverName.split(" ")[0];
    const kind = input.rateKind === "daily" ? "daily" : "hourly";
    const pay = input.payRate;
    const std = input.standardRate;
    if (input.onCall) {
      checks.push({ key: "pay_rate", title: "On-call pay", detail: onCallCheck({ payRate: pay, standardRate: std, rateKind: input.rateKind, caregiverName: input.caregiverName, payNextDay: input.payNextDay }), verdict: "warn" });
    } else {
      checks.push({
        key: "pay_rate",
        title: "Pay rate",
        detail:
          pay === null
            ? "No rate on this visit yet."
            : std === null
              ? `${money(pay)} ${kind} — ${who} has no standard rate on file to compare.`
              : Math.abs(pay - std) < 0.005
                ? `${money(pay)} ${kind} matches ${who}'s standard rate.`
                : `${money(pay)} ${kind} — ${who}'s standard rate is ${money(std)}.`,
        verdict: pay === null || std === null ? "unknown" : Math.abs(pay - std) < 0.005 ? "pass" : "warn",
      });
    }
  }
  const items = live(input.expenses);
  checks.push({ key: "expenses", title: "Expenses", detail: expensesLine(items, input.mileageRatePerMile), verdict: items.some((e) => receiptMissing(e) || needsReview(e)) ? "warn" : "pass" });
  const actual = Math.round(input.actualHours * 100) / 100;
  const delta = Math.round((input.actualHours - input.scheduledHours) * 100) / 100;
  const week = Math.round((input.otherHoursThisWeek + input.actualHours) * 100) / 100;
  const ot = Math.round((week - OVERTIME_THRESHOLD_HOURS) * 100) / 100;
  const noClock = !valid(input.clockedInAt) && !valid(input.clockedOutAt);
  const total = input.payRate === null ? null : input.rateKind === "daily" ? input.payRate : Math.round(input.payRate * input.scheduledHours * 100) / 100;
  if (noClock) {
    checks.push({ key: "payroll", title: "Payroll", detail: ["Clock still empty", total === null ? null : money(total), `${input.payrollWeek} week`].filter(Boolean).join(" · "), verdict: "unknown" });
  } else {
    checks.push({
      key: "payroll",
      title: "Payroll",
      detail: [`${actual} hrs`, delta === 0 ? "matches the plan" : `${delta > 0 ? "+" : ""}${delta} vs plan`, ot > 0 ? `${ot} hrs overtime` : "no overtime", `${input.payrollWeek} week`].join(" · "),
      verdict: ot > 0 ? "warn" : "pass",
    });
  }
  return checks;
}

export function reviewSummary(checks: readonly ReviewCheck[]): string {
  const blocked = checks.filter((c) => c.verdict === "blocked");
  if (blocked.length > 0) return `${blocked[0].title} has to be sorted before this can be saved.`;
  const warns = checks.filter((c) => c.verdict === "warn");
  if (warns.length === 0) return "Joy found nothing that blocks saving.";
  return warns.length === 1 ? `${warns[0].title} is worth a look — nothing blocks saving.` : `${warns.length} things are worth a look — nothing blocks saving.`;
}

export function validateMileage(input: { actualMiles: number; note: string }): string | null {
  if (!Number.isFinite(input.actualMiles) || input.actualMiles < 0) return "Miles cannot be below zero.";
  if (input.actualMiles > 0 && input.note.trim() === "") return "Say where the driving was for.";
  if (input.actualMiles > 300) return "Over 300 miles on one visit — check the number.";
  return null;
}

/** "CNA", "HHA", "RN" or "Caregiver" from a job title. */
export function roleAbbreviation(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (t === "") return "Caregiver";
  const l = t.toLowerCase();
  if (l.includes("certified nursing assistant") || /\bcna\b/.test(l)) return "CNA";
  if (l.includes("home health aide") || /\bhha\b/.test(l)) return "HHA";
  if (l.includes("registered nurse") || /\brn\b/.test(l)) return "RN";
  if (l.includes("caregiver") || l.includes("aide") || l.includes("attendant")) return "Caregiver";
  return t;
}
