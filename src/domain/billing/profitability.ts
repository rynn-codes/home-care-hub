import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { employerTaxes, grossWages } from "@/domain/billing/employerTaxes";
import { billsToClient, householdOf, householdRate, shareOf, shares, type Household } from "@/domain/billing/households";
import { hasCompanions, isBillable, servedPeople } from "@/domain/billing/invoice";
import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * What each client was invoiced over a period, what the care cost in wages
 * and employer taxes, and what is left. The billed side is priced from the
 * rate on file; the cost side from each caregiver's base rate. Where either
 * is missing the row says so instead of multiplying a placeholder.
 */

export type ProfitScope = "week" | "month" | "year";
export const PROFIT_SCOPES: readonly ProfitScope[] = ["week", "month", "year"];
export const PROFIT_SCOPE_LABELS: Record<ProfitScope, string> = { week: "Week", month: "Month", year: "Year" };

/** The margin Karynn steers to. */
export const MARGIN_TARGET = 12;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeLabel(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return `${short(a)} – ${short(b)}, ${b.getFullYear()}`;
}

export interface ScopeRange {
  start: string;
  end: string;
  label: string;
}

/** The week, month or year `offset` steps from now (0 = current, negative = earlier). */
export function scopeRange(input: { scope: ProfitScope; offset: number; weekAnchor: string; today: string }): ScopeRange {
  if (input.scope === "week") {
    const d = new Date(`${agencyWeekStart(input.weekAnchor)}T12:00:00`);
    d.setDate(d.getDate() + input.offset * 7);
    const start = isoOf(d);
    d.setDate(d.getDate() + 6);
    const end = isoOf(d);
    return { start, end, label: rangeLabel(start, end) };
  }
  const today = new Date(`${input.today.slice(0, 10)}T12:00:00`);
  if (input.scope === "month") {
    const first = new Date(today.getFullYear(), today.getMonth() + input.offset, 1, 12);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
    return { start: isoOf(first), end: isoOf(last), label: `${MONTHS[first.getMonth()]} ${first.getFullYear()}` };
  }
  const year = today.getFullYear() + input.offset;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
}

/** Every agency-week start from the week containing `start` to `end`, capped at 60. */
export function weekStartsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${agencyWeekStart(start)}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (d <= last && out.length < 60) {
    out.push(isoOf(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export function inRange(iso: string, range: { start: string; end: string }): boolean {
  const day = iso.slice(0, 10);
  return day >= range.start && day <= range.end;
}

export const hoursOfVisit = (v: Visit) => (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()) / 36e5;

export interface BilledRow {
  hours: number;
  /** Null once any hour could not be priced. */
  billed: number | null;
  /** True when this person's care sits on somebody else's invoice. */
  billedElsewhere: boolean;
}

/** Hours and invoiced dollars per person served, from the rate in force on each visit. */
export function billedByClient(input: { visits: readonly Visit[]; households: readonly Household[]; rateFor: (clientPersonId: string, at: string) => number | null }): Map<string, BilledRow> {
  const out = new Map<string, BilledRow>();
  for (const visit of input.visits) {
    if (!visit.clientPersonId || !isBillable(visit)) continue;
    const hours = hoursOfVisit(visit);
    for (const person of servedPeople(visit)) {
      const row = out.get(person.personId) ?? { hours: 0, billed: 0, billedElsewhere: false };
      const bills = billsToClient(visit, person.personId, person.name, input.households);
      const homeRate = hasCompanions(visit) ? householdRate(input.households, person.personId) : null;
      const rate = homeRate ?? input.rateFor(person.personId, visit.startsAt);
      let share: number;
      if (homeRate !== null) {
        if (bills) {
          const household = householdOf(input.households, person.personId);
          share = shareOf(visit, person.personId, input.households) === 1 ? 1 : household ? (shares(household)[person.personId] ?? 0) : 0;
        } else {
          share = 0;
        }
      } else {
        share = shareOf(visit, person.personId, input.households);
      }
      out.set(person.personId, {
        hours: row.hours + hours,
        billed: bills ? (typeof rate === "number" && row.billed !== null ? row.billed + hours * rate * share : null) : row.billed,
        billedElsewhere: row.billedElsewhere || (!bills && hasCompanions(visit)),
      });
    }
  }
  return out;
}

export interface CostRow {
  cost: number;
  wages: number;
  taxes: number;
  /** A caregiver on the visits is not on the payroll roster. */
  unknown: boolean;
}

/** Wages plus employer taxes per client, split across a shared visit's billed people. */
export function costByClient(input: { visits: readonly Visit[]; households: readonly Household[]; payRates: ReadonlyMap<string, number | null> }): Map<string, CostRow> {
  const zero = (): CostRow => ({ cost: 0, wages: 0, taxes: 0, unknown: false });
  const out = new Map<string, CostRow>();
  for (const visit of input.visits) {
    if (!visit.clientPersonId) continue;
    const hours = hoursOfVisit(visit);
    const row = out.get(visit.clientPersonId) ?? zero();
    if (!visit.caregiverName) {
      out.set(visit.clientPersonId, row);
      continue;
    }
    if (!input.payRates.has(visit.caregiverName)) {
      out.set(visit.clientPersonId, { ...row, unknown: true });
      continue;
    }
    const rate = input.payRates.get(visit.caregiverName);
    const served = servedPeople(visit);
    if (typeof rate !== "number") {
      for (const p of served) out.set(p.personId, out.get(p.personId) ?? row);
      continue;
    }
    const wages = grossWages({ regularHours: hours, hourlyRate: rate });
    const taxes = employerTaxes({ grossWages: wages, on: visit.startsAt.slice(0, 10) }).total;
    const billed = served.filter((p) => billsToClient(visit, p.personId, p.name, input.households));
    const targets = billed.length > 0 ? billed : served.slice(0, 1);
    for (const p of targets) {
      const prev = out.get(p.personId) ?? zero();
      out.set(p.personId, {
        ...prev,
        wages: prev.wages + wages / targets.length,
        taxes: prev.taxes + taxes / targets.length,
        cost: prev.cost + (wages + taxes) / targets.length,
      });
    }
    for (const p of served) if (!out.has(p.personId)) out.set(p.personId, zero());
  }
  return out;
}

/** Green at target, amber at half, rose below. */
export function marginTone(margin: number | null): string {
  if (margin === null) return "text-muted-foreground";
  if (margin >= MARGIN_TARGET) return "text-[#027A48]";
  if (margin >= MARGIN_TARGET / 2) return "text-[#B54708]";
  return "text-[#B42318]";
}
