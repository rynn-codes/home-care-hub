import { employerTaxes } from "@/domain/billing/employerTaxes";

/**
 * What a visit pays and what it earns.
 *
 * The pay rate is the caregiver's base rate unless the office sets a visit
 * rate (a daily rate for a live-in, on-call, paid next day). The margin
 * lines are decision support for whoever is allowed to see profit — see
 * agency settings `profitVisibleTo` — never a payroll figure.
 */

export type RateKind = "hourly" | "daily";

export interface VisitPay {
  visitId: string;
  rate: number | null;
  rateKind: RateKind;
  onCall: boolean;
  payNextDay: boolean;
  setBy: string;
  setAt: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Margin {
  billed: number;
  pay: number;
  margin: number;
  percent: number | null;
  perHour: number | null;
}

export function visitMargin(input: { clientRate: number | null; payRate: number | null; hours: number; rateKind: RateKind }): Margin | null {
  if (input.payRate === null || input.clientRate === null || !(input.payRate >= 0) || !(input.clientRate >= 0) || !(input.hours > 0)) return null;
  const billed = r2(input.clientRate * input.hours);
  const pay = input.rateKind === "daily" ? r2(input.payRate) : r2(input.payRate * input.hours);
  const margin = r2(billed - pay);
  return {
    billed,
    pay,
    margin,
    percent: billed > 0 ? margin / billed : null,
    perHour: input.rateKind === "hourly" ? r2(input.clientRate - input.payRate) : null,
  };
}

const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;

export function marginLine(m: Margin): string {
  const pct = m.percent === null ? "" : ` (${Math.round(m.percent * 100)}%)`;
  return m.perHour !== null ? `Margin ${money(m.perHour)} an hour${pct} · ${money(m.margin)} on this visit` : `Margin ${money(m.margin)} on this visit${pct}`;
}

export function whyNoMargin(input: { clientRate: number | null; payRate: number | null }): string | null {
  if (input.clientRate === null && input.payRate === null) return "No client rate or pay rate on file — no margin to show.";
  if (input.clientRate === null) return "No client rate on file for this visit — no margin to show.";
  if (input.payRate === null) return "No pay rate yet — no margin to show.";
  return null;
}

/** Margin across a coverage plan, overtime at time and a half. */
export function planMargin(input: { clientRate: number | null; shifts: ReadonlyArray<{ hours: number; otHours: number; payRate: number | null }> }) {
  if (input.clientRate === null) return null;
  let billed = 0;
  let pay = 0;
  let unpriced = 0;
  for (const s of input.shifts) {
    if (s.payRate === null) {
      unpriced += 1;
      continue;
    }
    billed += input.clientRate * s.hours;
    const ot = Math.min(Math.max(0, s.otHours), s.hours);
    pay += s.payRate * (s.hours - ot) + s.payRate * 1.5 * ot;
  }
  const margin = r2(billed - pay);
  return { billed: r2(billed), pay: r2(pay), margin, percent: billed > 0 ? margin / billed : null, unpriced };
}

export interface ShiftProfit {
  billed: number;
  pay: number;
  taxes: number;
  gross: number;
  net: number;
  grossPercent: number;
  netPercent: number;
}

/** Gross and net (after employer payroll taxes) profit on one shift. */
export function shiftProfit(input: { payRate: number | null; clientRate: number | null; hours: number; on: string }): ShiftProfit | null {
  if (input.payRate === null || input.clientRate === null || !(input.payRate >= 0) || !(input.clientRate > 0) || !(input.hours > 0)) return null;
  const billed = r2(input.clientRate * input.hours);
  const pay = r2(input.payRate * input.hours);
  const taxes = employerTaxes({ grossWages: pay, on: input.on }).total;
  const gross = r2(billed - pay);
  const net = r2(gross - taxes);
  return { billed, pay, taxes, gross, net, grossPercent: gross / billed, netPercent: net / billed };
}

export function percentLabel(p: number): string {
  const n = Math.round(p * 1000) / 10;
  return `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
}
