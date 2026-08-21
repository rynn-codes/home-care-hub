import {
  INCIDENT_LABELS,
  NOTIFY_LABELS,
  SEVERITY_LABELS,
  type Incident,
  type IncidentKind,
  type IncidentSeverity,
} from "@/domain/incidents/incidents";

/**
 * The yearly incident report.
 *
 * KARYNN, 21 AUGUST: "It needs to be logged on the yearly incident report."
 *
 * This is the artifact a surveyor asks for by name, and it is not a list of
 * incidents. It is the answer to a harder question: over a year, did the agency
 * do what it said it would do each time something went wrong? A register that
 * only lists what happened lets an agency look diligent while every deadline in
 * it was missed.
 *
 * So each line carries whether the obligations were met, and the summary counts
 * the misses rather than burying them. If Joy had a bad year, this says so.
 *
 * IT IS COMPUTED, NEVER MAINTAINED. Nothing anywhere writes a row to a separate
 * annual log. That matters more than it sounds: a hand-kept register drifts from
 * the incidents it describes, and the version somebody hands to a surveyor is
 * then the one that has drifted. This reads the same incidents the office
 * screen reads, so the two cannot disagree.
 */

export interface AnnualLogLine {
  id: string;
  /** `YYYY-MM-DD`, so the register reads as a chronology. */
  date: string;
  clientName: string;
  reportedByName: string;
  kind: IncidentKind | null;
  kindLabel: string;
  severity: IncidentSeverity | null;
  severityLabel: string;
  /** The caregiver's own words, as recorded. */
  narrative: string;
  findings: string | null;
  actionTaken: string | null;

  /** Every party who had to be told, and whether they were, on time. */
  notifiedOnTime: boolean;
  lateNotifications: string[];
  missedNotifications: string[];

  /** Null when this kind did not call for one. */
  rnVisitRequired: boolean;
  rnVisitOnTime: boolean | null;

  closed: boolean;
  /** Days from report to close. Null while open. */
  daysToClose: number | null;
}

export interface AnnualIncidentLog {
  year: number;
  total: number;
  byKind: Array<{ kind: IncidentKind; label: string; count: number }>;
  bySeverity: Array<{ severity: IncidentSeverity; label: string; count: number }>;
  /** Still open at the moment the report is run. */
  openAtRun: number;
  /** Reported and never classified. Its own count, because it is its own problem. */
  neverClassified: number;
  /** Lines where somebody was told late, or not at all. */
  withLateNotifications: number;
  withMissedNotifications: number;
  /** Lines that needed an RN visit, and how many got one inside the window. */
  rnVisitsRequired: number;
  rnVisitsOnTime: number;
  lines: AnnualLogLine[];
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Build the register for one calendar year.
 *
 * Keyed on when the incident was REPORTED, not when it closed. An incident
 * reported on 30 December and closed in January belongs to the year it happened
 * in — filing it under the year the paperwork finished would move a bad
 * December into a clean January.
 */
export function annualIncidentLog(input: {
  incidents: readonly Incident[];
  year: number;
}): AnnualIncidentLog {
  const inYear = input.incidents
    .filter((i) => Number(i.reportedAt.slice(0, 4)) === input.year)
    .slice()
    .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));

  const lines: AnnualLogLine[] = inYear.map((incident) => {
    const late: string[] = [];
    const missed: string[] = [];

    for (const n of incident.notifications) {
      if (!n.doneAt) missed.push(NOTIFY_LABELS[n.party]);
      else if (n.doneAt > n.dueBy) late.push(NOTIFY_LABELS[n.party]);
    }

    const rnVisitOnTime = incident.rnVisit
      ? Boolean(incident.rnVisit.doneAt && incident.rnVisit.doneAt <= incident.rnVisit.dueBy)
      : null;

    return {
      id: incident.id,
      date: dayOf(incident.reportedAt),
      clientName: incident.clientName,
      reportedByName: incident.reportedByName,
      kind: incident.kind,
      kindLabel: incident.kind ? INCIDENT_LABELS[incident.kind] : "Never classified",
      severity: incident.severity,
      severityLabel: incident.severity ? SEVERITY_LABELS[incident.severity] : "—",
      narrative: incident.narrative,
      findings: incident.findings,
      actionTaken: incident.actionTaken,
      notifiedOnTime: late.length === 0 && missed.length === 0,
      lateNotifications: late,
      missedNotifications: missed,
      rnVisitRequired: incident.rnVisit !== null,
      rnVisitOnTime,
      closed: incident.state === "closed",
      daysToClose: incident.closedAt ? daysBetween(incident.reportedAt, incident.closedAt) : null,
    };
  });

  const countBy = <T extends string>(values: Array<T | null>) => {
    const counts = new Map<T, number>();
    for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    return counts;
  };

  const kinds = countBy(inYear.map((i) => i.kind));
  const severities = countBy(inYear.map((i) => i.severity));

  return {
    year: input.year,
    total: inYear.length,
    byKind: [...kinds]
      .map(([kind, count]) => ({ kind, label: INCIDENT_LABELS[kind], count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    bySeverity: (["serious", "significant", "minor"] as IncidentSeverity[])
      .filter((s) => severities.has(s))
      .map((severity) => ({
        severity,
        label: SEVERITY_LABELS[severity],
        count: severities.get(severity)!,
      })),
    openAtRun: inYear.filter((i) => i.state !== "closed").length,
    neverClassified: inYear.filter((i) => !i.kind).length,
    withLateNotifications: lines.filter((l) => l.lateNotifications.length > 0).length,
    withMissedNotifications: lines.filter((l) => l.missedNotifications.length > 0).length,
    rnVisitsRequired: lines.filter((l) => l.rnVisitRequired).length,
    rnVisitsOnTime: lines.filter((l) => l.rnVisitOnTime === true).length,
    lines,
  };
}

/**
 * The years Joy has incidents for, newest first.
 *
 * Derived rather than a range, so the picker never offers a year with nothing
 * in it and never omits one because somebody forgot to extend a constant.
 */
export function yearsWithIncidents(incidents: readonly Incident[]): number[] {
  return [...new Set(incidents.map((i) => Number(i.reportedAt.slice(0, 4))))].sort((a, b) => b - a);
}

/**
 * One line for the top of the report.
 *
 * Deliberately says the bad number out loud. A summary that reads "14 incidents
 * in 2026" and stops is the kind of document that gets signed without being
 * read.
 */
export function annualLogHeadline(log: AnnualIncidentLog): string {
  if (log.total === 0) return `No incidents were reported in ${log.year}.`;

  const parts: string[] = [
    `${log.total} incident${log.total === 1 ? "" : "s"} reported in ${log.year}`,
  ];

  const problems: string[] = [];
  if (log.withMissedNotifications > 0) {
    problems.push(`${log.withMissedNotifications} where somebody was never told`);
  }
  if (log.withLateNotifications > 0) {
    problems.push(`${log.withLateNotifications} where a notification was late`);
  }
  const rnMissed = log.rnVisitsRequired - log.rnVisitsOnTime;
  if (rnMissed > 0) {
    problems.push(`${rnMissed} where the RN visit was late or has not happened`);
  }
  if (log.neverClassified > 0) {
    problems.push(`${log.neverClassified} never classified`);
  }

  if (problems.length === 0) return `${parts[0]}. Every obligation was met on time.`;
  return `${parts[0]} — ${problems.join(", ")}.`;
}
