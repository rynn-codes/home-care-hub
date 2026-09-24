import type { Visit } from "@/domain/scheduling/conflicts";
import { servedNames } from "@/domain/billing/households";

/**
 * Electronic visit verification, the way a surveyor reads it.
 *
 * The Cures Act fixes six things a verified visit has to carry: the service,
 * the person served, the date, the place, the person providing it, and the
 * time it began and ended. A record short of any one of them is not a
 * verified visit, whatever else is on it. Joy is private pay and reports to no
 * state aggregator, but the six elements are still the standard the visit
 * record is held to, because they are what proves care happened.
 */
export interface EvvRecordLike {
  visitId: string;
  date: string;
  service: string | null;
  clientName: string | null;
  caregiverName: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  location: string | null;
  method: "mobile" | "telephony" | "manual";
  reasonCode: string | null;
  editedBy: string | null;
}

export interface EvvPeriod {
  from: string;
  to: string;
}

export const METHOD_LABELS: Record<EvvRecordLike["method"], string> = {
  mobile: "Mobile app",
  telephony: "Client landline",
  manual: "Entered by office",
};

export const EVV_ELEMENTS: Array<{ key: string; label: string; holds: (r: EvvRecordLike) => boolean }> = [
  { key: "service", label: "Type of service performed", holds: (r) => !!r.service },
  { key: "client", label: "Individual receiving the service", holds: (r) => !!r.clientName },
  { key: "date", label: "Date of service", holds: (r) => !!r.date },
  { key: "location", label: "Location of service delivery", holds: (r) => !!r.location },
  { key: "caregiver", label: "Individual providing the service", holds: (r) => !!r.caregiverName },
  { key: "times", label: "Time the service begins and ends", holds: (r) => !!r.clockInAt && !!r.clockOutAt },
];

export type EvvExceptionKind = "no_record" | "missing_element" | "open_clock" | "manual_without_reason";

export const EXCEPTION_LABELS: Record<EvvExceptionKind, string> = {
  no_record: "No EVV record",
  missing_element: "Missing a required element",
  open_clock: "Never clocked out",
  manual_without_reason: "Entered by hand, no reason given",
};

export const EXCEPTION_SHORT: Record<EvvExceptionKind, string> = {
  no_record: "No record",
  missing_element: "Missing element",
  open_clock: "No clock-out",
  manual_without_reason: "No reason given",
};

export interface EvvException {
  kind: EvvExceptionKind;
  visitId: string;
  date: string;
  clientName: string;
  caregiverName: string;
  detail: string;
}

const inPeriod = (date: string, period: EvvPeriod) => date >= period.from && date <= period.to;

const clockLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Everything wrong with one record. An empty list is a verified visit. */
export function recordExceptions(r: EvvRecordLike): EvvException[] {
  const out: EvvException[] = [];
  const base = {
    visitId: r.visitId,
    date: r.date,
    clientName: r.clientName ?? "Unnamed client",
    caregiverName: r.caregiverName ?? "Unnamed caregiver",
  };
  if (r.clockInAt && !r.clockOutAt) {
    out.push({ ...base, kind: "open_clock", detail: `Clocked in at ${clockLabel(r.clockInAt)} and never clocked out.` });
  }
  for (const element of EVV_ELEMENTS.filter((e) => !e.holds(r))) {
    // An open clock already says the end time is missing; saying it twice is noise.
    if (element.key === "times" && r.clockInAt && !r.clockOutAt) continue;
    out.push({ ...base, kind: "missing_element", detail: `${element.label} is blank.` });
  }
  if (r.method === "manual" && !r.reasonCode) {
    out.push({ ...base, kind: "manual_without_reason", detail: `Entered by ${r.editedBy ?? "the office"} with no reason recorded.` });
  }
  return out;
}

export function isVerified(r: EvvRecordLike): boolean {
  return recordExceptions(r).length === 0;
}

/** Visits on the board in the period with nothing clocked against them. */
export function unrecordedVisits(input: { records: readonly EvvRecordLike[]; visits: readonly Visit[]; period: EvvPeriod }): EvvException[] {
  const recorded = new Set(input.records.map((r) => r.visitId));
  return input.visits
    .filter((v) => v.caregiverName)
    .filter((v) => inPeriod(v.startsAt.slice(0, 10), input.period))
    .filter((v) => !recorded.has(v.id))
    .map((v) => ({
      kind: "no_record" as const,
      visitId: v.id,
      date: v.startsAt.slice(0, 10),
      clientName: servedNames(v),
      caregiverName: v.caregiverName as string,
      detail: "The visit is on the board and nothing was clocked against it.",
    }));
}

export interface EvvSummary {
  period: EvvPeriod;
  records: number;
  verified: number;
  exceptions: EvvException[];
  byKind: Record<EvvExceptionKind, number>;
  /** Verified over everything that should have a record. 1 when there is nothing to check. */
  rate: number;
}

export function evvSummary(input: { records: readonly EvvRecordLike[]; visits: readonly Visit[]; period: EvvPeriod }): EvvSummary {
  const records = input.records.filter((r) => inPeriod(r.date, input.period));
  const missing = unrecordedVisits(input);
  const exceptions = [...missing, ...records.flatMap(recordExceptions)].sort((a, b) =>
    a.date === b.date ? a.clientName.localeCompare(b.clientName) : b.date.localeCompare(a.date),
  );
  const byKind = exceptions.reduce(
    (m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }),
    { no_record: 0, missing_element: 0, open_clock: 0, manual_without_reason: 0 } as Record<EvvExceptionKind, number>,
  );
  const verified = records.filter(isVerified).length;
  const expected = records.length + missing.length;
  return { period: input.period, records: records.length, verified, exceptions, byKind, rate: expected === 0 ? 1 : verified / expected };
}

/** The default log window: the three months ending today. */
export function defaultEvvPeriod(today: string): EvvPeriod {
  const end = new Date(`${today}T12:00:00`);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  start.setDate(start.getDate() + 1);
  return { from: start.toISOString().slice(0, 10), to: today };
}

/** "1 July – 24 September 2026", the year named once unless the range crosses it. */
export function evvPeriodLabel(period: EvvPeriod): string {
  const fmt = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}) });
  const sameYear = period.from.slice(0, 4) === period.to.slice(0, 4);
  return `${fmt(period.from, !sameYear)} – ${fmt(period.to, true)}`;
}
