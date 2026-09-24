import type { Finding, Monitor, MonitorInputs, Severity } from "./types";

/**
 * Running the monitors, and remembering what they found.
 *
 * Memory is a map of finding key to the day it was first seen, kept on this
 * device. It carries ids and dates only — never a name, never a sentence — so
 * the browser holds nothing about a client it could not already show. What
 * memory buys is honesty about age: "open a week" is a claim Joy can only make
 * if it wrote the date down the first time.
 */
export const MONITOR_MEMORY_KEY = "joy.monitors.v1";

export type MonitorMemory = Record<string, string>;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadMemory(): MonitorMemory {
  const raw = storage()?.getItem(MONITOR_MEMORY_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && !Number.isNaN(Date.parse(entry[1])),
      ),
    );
  } catch {
    return {};
  }
}

export function saveMemory(memory: MonitorMemory): void {
  try {
    storage()?.setItem(MONITOR_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Nothing to do: the findings still show, they just will not remember their age.
  }
}

export const SEVERITY_ORDER: Record<Severity, number> = { blocking: 0, due_soon: 1, note: 2 };

export const SEVERITY_LABELS: Record<Severity, string> = {
  blocking: "Fix today",
  due_soon: "Fix this week",
  note: "Worth knowing",
};

/** A finding younger than this is "new" and sorts ahead of older ones at the same severity. */
export const NEW_FOR_DAYS = 7;

function isNew(f: Finding, asOf: string): boolean {
  const first = Date.parse(`${f.firstSeen.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`);
  return now - first < NEW_FOR_DAYS * 86_400_000;
}

export interface MonitorRun {
  findings: Finding[];
  memory: MonitorMemory;
  ranAt: string;
}

export function runMonitors(monitors: readonly Monitor[], inputs: MonitorInputs, memory: MonitorMemory, ranAt: string): MonitorRun {
  const findings: Finding[] = [];
  const next: MonitorMemory = {};
  for (const monitor of monitors) {
    for (const raw of monitor.run(inputs)) {
      const firstSeen = memory[raw.key] ?? ranAt;
      next[raw.key] = firstSeen;
      findings.push({ ...raw, monitorId: monitor.id, monitorName: monitor.name, seenAt: ranAt, firstSeen });
    }
  }
  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const aNew = isNew(a, ranAt);
    const bNew = isNew(b, ranAt);
    if (aNew !== bNew) return aNew ? -1 : 1;
    const byAge = a.firstSeen.localeCompare(b.firstSeen);
    return byAge !== 0 ? byAge : a.subject.name.localeCompare(b.subject.name);
  });
  return { findings, memory: next, ranAt };
}

function daysOpen(f: Pick<Finding, "firstSeen">, asOf: string): number {
  const first = Date.parse(f.firstSeen.slice(0, 10));
  const now = Date.parse(asOf.slice(0, 10));
  if (Number.isNaN(first) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.floor((now - first) / 86_400_000));
}

const ORDINALS = ["", "First", "Second", "Third", "Fourth"];

/** "Open a week", "Second week running", "Open 3 months" — or nothing while it is fresh. */
export function openFor(f: Pick<Finding, "firstSeen">, asOf: string): string | null {
  const days = daysOpen(f, asOf);
  if (days < 7) return null;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Open a week";
  if (weeks < 5) return `${ORDINALS[weeks] ?? `${weeks}th`} week running`;
  const months = Math.round(days / 30.4);
  return months < 12 ? `Open ${months} months` : "Open over a year";
}

export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
  return {
    blocking: findings.filter((f) => f.severity === "blocking").length,
    due_soon: findings.filter((f) => f.severity === "due_soon").length,
    note: findings.filter((f) => f.severity === "note").length,
  };
}

/** The one line above the list. Null when there is nothing to say. */
export function findingsHeadline(findings: readonly Finding[]): string | null {
  if (findings.length === 0) return null;
  const n = countBySeverity(findings);
  if (n.blocking > 0) return n.blocking === 1 ? "One thing needs fixing today" : `${n.blocking} things need fixing today`;
  if (n.due_soon > 0) return n.due_soon === 1 ? "One thing needs fixing this week" : `${n.due_soon} things need fixing this week`;
  return findings.length === 1 ? "One thing worth knowing" : `${findings.length} things worth knowing`;
}
