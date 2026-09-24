/**
 * Employer payroll taxes on a shift — for margin lines only.
 *
 * NOT_FOR_PAYROLL. Gusto is the record of what is paid and what is owed;
 * these are the statutory rates as of 2026 so a scheduler can see roughly
 * what a shift nets after the employer's share. Nothing here is filed,
 * remitted or reconciled, and the year-to-date wage bases default to zero
 * because Joy does not hold them.
 */
export const NOT_FOR_PAYROLL = true;

const SOCIAL_SECURITY = 0.062;
const MEDICARE = 0.0145;
const FUTA_RATE = 0.006;
const FUTA_WAGE_BASE = 7_000;
const TEXAS_SUTA_WAGE_BASE = 9_000;

export interface SutaRate {
  effectiveStart: string;
  effectiveEnd: string | null;
  rate: number;
}

/** Placeholder Texas SUTA schedule — the real rate is on the TWC notice. */
export const TEXAS_SUTA_RATES: SutaRate[] = [
  { effectiveStart: "2026-01-01", effectiveEnd: "2026-03-31", rate: 0.027 },
  { effectiveStart: "2026-04-01", effectiveEnd: null, rate: 0.0032 },
];

export function sutaRateOn(iso: string, rates: readonly SutaRate[] = TEXAS_SUTA_RATES): number {
  const day = iso.slice(0, 10);
  return rates.find((r) => day >= r.effectiveStart && (r.effectiveEnd === null || day <= r.effectiveEnd))?.rate ?? 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface EmployerTaxes {
  socialSecurity: number;
  medicare: number;
  futa: number;
  texasSuta: number;
  total: number;
}

export function employerTaxes(input: { grossWages: number; on: string; futaWagesYtd?: number; sutaWagesYtd?: number; sutaRates?: readonly SutaRate[] }): EmployerTaxes {
  const gross = Math.max(0, input.grossWages);
  const ss = gross * SOCIAL_SECURITY;
  const medicare = gross * MEDICARE;
  const futaRoom = Math.max(0, FUTA_WAGE_BASE - (input.futaWagesYtd ?? 0));
  const futa = Math.min(gross, futaRoom) * FUTA_RATE;
  const sutaRoom = Math.max(0, TEXAS_SUTA_WAGE_BASE - (input.sutaWagesYtd ?? 0));
  const suta = Math.min(gross, sutaRoom) * sutaRateOn(input.on, input.sutaRates);
  return { socialSecurity: r2(ss), medicare: r2(medicare), futa: r2(futa), texasSuta: r2(suta), total: r2(ss + medicare + futa + suta) };
}

export function grossWages(input: { regularHours: number; overtimeHours?: number; hourlyRate: number }): number {
  const ot = input.overtimeHours ?? 0;
  return r2(input.regularHours * input.hourlyRate + ot * input.hourlyRate * 1.5);
}
