import type { Visit } from "@/domain/scheduling/conflicts";
import { isBillable, type ClientBillingTerms } from "@/domain/billing/invoice";
import { entryHours, workweekStart, type TimeEntry } from "@/domain/payroll/hours";
import { inRange, monthsIn, type DateRange } from "@/domain/reports/period";

/**
 * The six reports Karynn asked for, computed from the engines that already
 * exist rather than from a reporting table.
 *
 * THERE ARE FIVE, NOT SIX. The design carried an authorisation burn rate and it
 * has been removed rather than left empty — Karynn, 21 August: "We are all
 * private pay. We allow long term care insurance, but only for them to reimburse
 * the client once they have paid us. We don't need anything regarding
 * authorizations." A report about units a payer approved is meaningless when no
 * payer approves anything: the client pays Joy, and their insurer reimburses
 * them afterwards, which is a transaction Joy is not part of.
 *
 * THE RULE THAT SHAPES THIS FILE. Two of the five need an input Joy does not
 * have — client rates and pay rates — and both are numbers somebody would act
 * on. A margin of 47% invented from a mockup, printed next to three figures that
 * are real, is worse than a blank page: it is indistinguishable from a computed
 * one, and somebody will price a contract off it.
 *
 * So a report is either COMPUTED from real data or it says exactly what it is
 * missing and shows nothing else. `ReportResult.state` is what the screen reads
 * to tell those apart, and it is not a loading state — it is the difference
 * between "here is the answer" and "Joy cannot answer this yet".
 *
 * This is the same rule as `buildInvoice` refusing to invoice a client with no
 * rate rather than sending a zero, and `carePlanFromAssessment` refusing to
 * fill a missing answer with a plausible default.
 */

export type ReportKey =
  | "revenue_by_month"
  | "hours_by_service"
  | "caregiver_utilization"
  | "net_margin"
  | "unbillable";

export const REPORT_LABELS: Record<ReportKey, string> = {
  revenue_by_month: "Revenue by month",
  hours_by_service: "Hours by service",
  caregiver_utilization: "Caregiver utilisation",
  net_margin: "Net margin by client",
  unbillable: "Unbillable hours",
};

export type ReportState = "computed" | "needs_input" | "empty";

export interface ReportColumn {
  key: string;
  label: string;
  /** Right-aligned and tabular. */
  numeric?: boolean;
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  /** One line under the title: what this is and over what period. */
  subtitle: string;
  state: ReportState;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number>>;
  /** Draws the bar chart. Absent when the report is not a magnitude comparison. */
  chart?: { labelKey: string; valueKey: string; unit: string };
  /** Shown when state is not `computed`. Says precisely what is missing. */
  missing?: string[];
  /** The line under the table, when there is something worth saying. */
  note?: string;
}

// ------------------------------------------------------------------ util --

function hoursOf(visit: Visit): number {
  const ms = Date.parse(visit.endsAt) - Date.parse(visit.startsAt);
  return Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : 0;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Visits that actually happened to a client inside the range. */
function deliveredVisits(visits: readonly Visit[], range: DateRange): Visit[] {
  return visits.filter(
    (v) => inRange(v.startsAt, range) && v.caregiverName !== null && !v.eventType,
  );
}

// ------------------------------------------------------- revenue by month --

/**
 * What Joy invoiced, by month.
 *
 * Rate × hours, per client, from the same `ClientBillingTerms` the Billing
 * screen reads. A client with no rate contributes NO revenue and is counted
 * separately — the alternative is treating a missing rate as zero dollars,
 * which makes an unpriced client look like a client who generated nothing, and
 * those are opposite problems.
 */
export function revenueByMonth(input: {
  visits: readonly Visit[];
  terms: readonly ClientBillingTerms[];
  range: DateRange;
}): ReportResult {
  const rateFor = new Map(input.terms.map((t) => [t.clientPersonId, t.hourlyRate]));
  const delivered = deliveredVisits(input.visits, input.range).filter(isBillable);

  const byMonth = new Map<string, { revenue: number; hours: number; unpricedHours: number }>();
  for (const month of monthsIn(input.range)) {
    byMonth.set(month, { revenue: 0, hours: 0, unpricedHours: 0 });
  }

  const unpricedClients = new Set<string>();

  for (const visit of delivered) {
    const month = visit.startsAt.slice(0, 7);
    const bucket = byMonth.get(month) ?? { revenue: 0, hours: 0, unpricedHours: 0 };
    const hours = hoursOf(visit);
    const rate = visit.clientPersonId ? rateFor.get(visit.clientPersonId) : null;

    bucket.hours += hours;
    if (rate == null) {
      bucket.unpricedHours += hours;
      unpricedClients.add(visit.clientName);
    } else {
      bucket.revenue += hours * rate;
    }
    byMonth.set(month, bucket);
  }

  const rows = [...byMonth].map(([month, b]) => ({
    month,
    revenue: money(b.revenue),
    hours: round(b.hours),
    unpricedHours: round(b.unpricedHours),
  }));

  // Scoped to the clients who actually had visits in this period, not to the
  // whole terms list. An earlier version asked whether ANY client had a rate,
  // which meant one priced client somewhere in the roster was enough to make
  // this report "computed" — and it then printed $0 revenue against 31 real
  // hours. A confident zero is worse than a refusal: it reads as a bad month
  // rather than as missing data.
  const servedClients = new Set(delivered.map((v) => v.clientPersonId).filter(Boolean));
  const anyRate = [...servedClients].some((id) => rateFor.get(id!) != null);
  const totalHours = rows.reduce((n, r) => n + Number(r.hours), 0);

  // No care delivered is a quiet period, not a missing rate. Telling somebody
  // their clients have no rates when the real answer is "nobody was visited"
  // sends them to fix the wrong thing.
  if (delivered.length === 0) {
    return {
      key: "revenue_by_month",
      title: REPORT_LABELS.revenue_by_month,
      subtitle: input.range.label,
      state: "empty",
      columns: [],
      rows: [],
    };
  }

  if (!anyRate) {
    return {
      key: "revenue_by_month",
      title: REPORT_LABELS.revenue_by_month,
      subtitle: input.range.label,
      state: "needs_input",
      columns: [],
      rows: [],
      missing: [
        "No client who received care in this period has an hourly rate on file, so there is no revenue to compute.",
        `${round(totalHours)} hours were delivered in this period and none of them can be priced.`,
        "Rates go to the client by e-mail rather than into the packet, so they belong in the database rather than in this repository.",
      ],
    };
  }

  return {
    key: "revenue_by_month",
    title: REPORT_LABELS.revenue_by_month,
    subtitle: input.range.label,
    state: rows.length === 0 ? "empty" : "computed",
    columns: [
      { key: "month", label: "Month" },
      { key: "hours", label: "Hours", numeric: true },
      { key: "revenue", label: "Revenue", numeric: true },
      { key: "unpricedHours", label: "Unpriced hours", numeric: true },
    ],
    rows,
    chart: { labelKey: "month", valueKey: "revenue", unit: "$" },
    note:
      unpricedClients.size > 0
        ? `${unpricedClients.size} client${unpricedClients.size === 1 ? " has" : "s have"} no rate on file, so their hours are excluded from revenue rather than counted as zero: ${[...unpricedClients].join(", ")}.`
        : undefined,
  };
}

// -------------------------------------------------------- hours by service --

/**
 * Billed hours by service line.
 *
 * KARYNN, 21 AUGUST: "We don't separate care. All of our clients get personal
 * care services, companion care, light housekeeping. The only time we
 * distinguish care is if it is respite, post-surgical."
 *
 * So the split here is a BILLING and SCHEDULING split, not a description of
 * what a caregiver does when she arrives — the same distinction that emptied
 * `SERVICE_TASK_CATEGORIES`. The note under the report says so, because a
 * reader who has not had that conversation will otherwise take the chart as
 * evidence that Joy runs separate service lines.
 */
export function hoursByService(input: {
  visits: readonly Visit[];
  range: DateRange;
}): ReportResult {
  const delivered = deliveredVisits(input.visits, input.range);

  const byService = new Map<string, number>();
  for (const visit of delivered) {
    byService.set(visit.service, (byService.get(visit.service) ?? 0) + hoursOf(visit));
  }

  const rows = [...byService]
    .map(([service, hours]) => ({ service, hours: round(hours) }))
    .sort((a, b) => Number(b.hours) - Number(a.hours));

  const total = rows.reduce((n, r) => n + Number(r.hours), 0);

  return {
    key: "hours_by_service",
    title: REPORT_LABELS.hours_by_service,
    subtitle: `${round(total)} hours delivered · ${input.range.label}`,
    state: rows.length === 0 ? "empty" : "computed",
    columns: [
      { key: "service", label: "Service" },
      { key: "hours", label: "Hours", numeric: true },
    ],
    rows,
    chart: { labelKey: "service", valueKey: "hours", unit: "h" },
    note:
      "The service on a visit is a billing and scheduling label. Karynn, 21 August: Joy does not separate care, and every client gets personal care, companion care and light housekeeping.",
  };
}

// --------------------------------------------------- caregiver utilisation --

/**
 * Hours worked against hours scheduled, per caregiver.
 *
 * Measured against the SCHEDULE rather than against a capacity target, and that
 * is the honest choice rather than the convenient one. Joy holds no
 * availability or contracted-hours data, so a percentage against "full time"
 * would be a percentage of a number nobody entered. Against the schedule it
 * answers a question Joy can actually act on: did the shifts we committed to
 * get worked?
 *
 * Overtime comes from the payroll engine so this and the Payroll screen cannot
 * disagree.
 */
export function caregiverUtilization(input: {
  visits: readonly Visit[];
  entries: readonly TimeEntry[];
  /** Time entries carry a person id; the schedule carries a name. */
  nameFor: (personId: string) => string;
  range: DateRange;
}): ReportResult {
  const scheduled = new Map<string, number>();
  for (const visit of deliveredVisits(input.visits, input.range)) {
    if (!visit.caregiverName) continue;
    scheduled.set(visit.caregiverName, (scheduled.get(visit.caregiverName) ?? 0) + hoursOf(visit));
  }

  const worked = new Map<string, number>();
  const weeks = new Map<string, Map<string, number>>();
  for (const entry of input.entries) {
    if (!inRange(entry.clockedInAt, input.range)) continue;
    const name = input.nameFor(entry.caregiverPersonId);
    const hours = entryHours(entry);
    worked.set(name, (worked.get(name) ?? 0) + hours);

    const week = workweekStart(entry.clockedInAt);
    const perWeek = weeks.get(name) ?? new Map<string, number>();
    perWeek.set(week, (perWeek.get(week) ?? 0) + hours);
    weeks.set(name, perWeek);
  }

  const names = [...new Set([...scheduled.keys(), ...worked.keys()])].sort();

  const rows = names.map((name) => {
    const s = scheduled.get(name) ?? 0;
    const w = worked.get(name) ?? 0;
    // Overtime per workweek, the same rule payroll applies. Summing the period
    // and taking anything over 40 would invent overtime nobody earned.
    const overtime = [...(weeks.get(name)?.values() ?? [])].reduce(
      (n, h) => n + Math.max(h - 40, 0),
      0,
    );
    return {
      caregiver: name,
      scheduled: round(s),
      worked: round(w),
      utilization: s > 0 ? Math.round((w / s) * 100) : 0,
      overtime: round(overtime),
    };
  });

  const totalScheduled = rows.reduce((n, r) => n + Number(r.scheduled), 0);
  const totalWorked = rows.reduce((n, r) => n + Number(r.worked), 0);

  return {
    key: "caregiver_utilization",
    title: REPORT_LABELS.caregiver_utilization,
    subtitle: `${round(totalWorked)} of ${round(totalScheduled)} scheduled hours worked · ${input.range.label}`,
    state: rows.length === 0 ? "empty" : "computed",
    columns: [
      { key: "caregiver", label: "Caregiver" },
      { key: "scheduled", label: "Scheduled", numeric: true },
      { key: "worked", label: "Worked", numeric: true },
      { key: "utilization", label: "% of schedule", numeric: true },
      { key: "overtime", label: "Overtime", numeric: true },
    ],
    rows,
    chart: { labelKey: "caregiver", valueKey: "worked", unit: "h" },
    note:
      "Measured against the schedule, not against a capacity target — Joy holds no availability or contracted hours, so a percentage of “full time” would be a percentage of a number nobody entered.",
  };
}

// ------------------------------------------------------------ net margin --

/**
 * Net margin by client — the one report that cannot be computed at all.
 *
 * It needs two numbers Joy does not have: what the client pays, and what the
 * caregiver on that client's case is paid. The first goes to clients by e-mail
 * rather than into the packet. The second does not exist anywhere in this
 * repository on purpose — the figures on the Employees screen came from the
 * mockup and are fiction, and Payroll deliberately computes hours rather than
 * wages for exactly that reason.
 *
 * A margin percentage is the single most decision-shaped number on a reports
 * page. Somebody prices a contract off it, or declines a referral. So this
 * returns nothing rather than something plausible, and names both inputs.
 */
export function netMarginByClient(input: {
  terms: readonly ClientBillingTerms[];
  /** Dollars per hour paid to caregivers, by person id. Empty in this repository. */
  payRates: ReadonlyMap<string, number>;
  visits: readonly Visit[];
  range: DateRange;
}): ReportResult {
  // Scoped to the clients actually seen in this period, the same fix revenue
  // needed: one priced client elsewhere in the roster must not make this look
  // answerable for the people who were not.
  const served = new Set(
    deliveredVisits(input.visits, input.range).map((v) => v.clientPersonId).filter(Boolean),
  );
  const ratesForServed = input.terms.filter((t) => served.has(t.clientPersonId));

  const missing: string[] = [];
  if (!ratesForServed.some((t) => t.hourlyRate != null)) {
    missing.push(
      "No client who received care in this period has an hourly rate on file — that is the revenue side.",
    );
  }
  if (input.payRates.size === 0) {
    missing.push(
      "No caregiver pay rates are recorded — that is the cost side. Joy produces hours; Gusto produces wages, and no rate has ever been entered here.",
    );
  }

  if (missing.length > 0) {
    return {
      key: "net_margin",
      title: REPORT_LABELS.net_margin,
      subtitle: input.range.label,
      state: "needs_input",
      columns: [],
      rows: [],
      missing: [
        ...missing,
        "Margin is the number somebody prices a contract off. Showing a plausible one would be worse than showing none.",
      ],
    };
  }

  const rateFor = new Map(input.terms.map((t) => [t.clientPersonId, t.hourlyRate]));
  const byClient = new Map<string, { name: string; revenue: number; cost: number; hours: number }>();

  for (const visit of deliveredVisits(input.visits, input.range).filter(isBillable)) {
    const id = visit.clientPersonId;
    if (!id) continue;
    const rate = rateFor.get(id);
    if (rate == null) continue;

    const hours = hoursOf(visit);
    const pay = visit.caregiverName ? (input.payRates.get(visit.caregiverName) ?? 0) : 0;
    const bucket = byClient.get(id) ?? { name: visit.clientName, revenue: 0, cost: 0, hours: 0 };
    bucket.revenue += hours * rate;
    bucket.cost += hours * pay;
    bucket.hours += hours;
    byClient.set(id, bucket);
  }

  const rows = [...byClient.values()]
    .map((b) => ({
      client: b.name,
      hours: round(b.hours),
      revenue: money(b.revenue),
      cost: money(b.cost),
      margin: b.revenue > 0 ? Math.round(((b.revenue - b.cost) / b.revenue) * 100) : 0,
    }))
    .sort((a, b) => Number(b.margin) - Number(a.margin));

  return {
    key: "net_margin",
    title: REPORT_LABELS.net_margin,
    subtitle: input.range.label,
    state: rows.length === 0 ? "empty" : "computed",
    columns: [
      { key: "client", label: "Client" },
      { key: "hours", label: "Hours", numeric: true },
      { key: "revenue", label: "Revenue", numeric: true },
      { key: "cost", label: "Direct cost", numeric: true },
      { key: "margin", label: "Margin %", numeric: true },
    ],
    rows,
    chart: { labelKey: "client", valueKey: "margin", unit: "%" },
    note:
      "Direct labour cost only. Payroll taxes, insurance, mileage and overhead are not in it, so this is contribution rather than true net.",
  };
}

// ------------------------------------------------------------ unbillable --

/**
 * Hours Joy delivered and cannot invoice.
 *
 * The report Karynn is most likely to want on a Monday, and the only one of the
 * six that is fully computable today — because "cannot bill" is a state the
 * billing engine already produces, and the reasons are all facts Joy holds.
 *
 * Each row is an hour somebody worked and was paid for that no invoice can
 * carry. Grouped by reason rather than by client, because the reasons have
 * different fixes: an unpriced client is a phone call, an unstaffed visit is
 * scheduling, and a non-billable event type is working as intended.
 */
export function unbillableHours(input: {
  visits: readonly Visit[];
  terms: readonly ClientBillingTerms[];
  range: DateRange;
}): ReportResult {
  const rateFor = new Map(input.terms.map((t) => [t.clientPersonId, t.hourlyRate]));
  const inWindow = input.visits.filter((v) => inRange(v.startsAt, input.range));

  const reasons = new Map<string, { hours: number; detail: Set<string> }>();
  const add = (reason: string, hours: number, who: string) => {
    const bucket = reasons.get(reason) ?? { hours: 0, detail: new Set<string>() };
    bucket.hours += hours;
    bucket.detail.add(who);
    reasons.set(reason, bucket);
  };

  for (const visit of inWindow) {
    const hours = hoursOf(visit);

    if (visit.caregiverName === null) {
      // Nobody worked it, so it costs nothing — but it is revenue Joy planned
      // for and did not earn, which is the thing worth seeing.
      add("Shift never staffed", hours, visit.clientName);
      continue;
    }
    if (!isBillable(visit)) {
      add("Not a billable event", hours, visit.service);
      continue;
    }
    if (!visit.clientPersonId || rateFor.get(visit.clientPersonId) == null) {
      add("Client has no rate on file", hours, visit.clientName);
    }
  }

  const rows = [...reasons]
    .map(([reason, b]) => ({
      reason,
      hours: round(b.hours),
      who: [...b.detail].join(", "),
    }))
    .sort((a, b) => Number(b.hours) - Number(a.hours));

  const total = rows.reduce((n, r) => n + Number(r.hours), 0);

  return {
    key: "unbillable",
    title: REPORT_LABELS.unbillable,
    subtitle:
      total === 0
        ? `Nothing unbillable · ${input.range.label}`
        : `${round(total)} hours cannot be invoiced · ${input.range.label}`,
    state: rows.length === 0 ? "empty" : "computed",
    columns: [
      { key: "reason", label: "Reason" },
      { key: "hours", label: "Hours", numeric: true },
      { key: "who", label: "Who or what" },
    ],
    rows,
    chart: { labelKey: "reason", valueKey: "hours", unit: "h" },
    note:
      "Grouped by reason rather than by client, because the fixes differ: an unpriced client is a phone call, an unstaffed shift is scheduling, and a non-billable event is working as intended.",
  };
}
