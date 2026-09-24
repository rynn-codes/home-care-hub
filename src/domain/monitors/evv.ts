import { evvSummary, EXCEPTION_LABELS, type EvvExceptionKind } from "@/domain/audit/evv";
import type { Monitor, RawFinding, Severity } from "./types";

/**
 * EVV Watch: is the visit record complete enough to hand to a surveyor?
 *
 * Looks back two weeks. An open clock is reported per shift once it has been
 * open long enough that nobody is still on it; the other kinds are rolled up,
 * because twelve lines saying "no reason given" is one problem, not twelve.
 */
export const EVV_WINDOW_DAYS = 14;
export const OPEN_CLOCK_AFTER_HOURS = 18;

export const EVV_BECAUSE: Record<EvvExceptionKind, string> = {
  no_record: "A visit on the board with nothing clocked against it is a visit we cannot prove happened. It is also the one a family disputes on the invoice.",
  missing_element: "The Cures Act fixes six things a verified visit has to carry. A record short of one of them is not a verified visit, whatever else is on it.",
  open_clock: "Nobody can be paid for a shift with no end time, and the caregiver still remembers what time she left today.",
  manual_without_reason: "An entry typed by the office with no reason beside it looks the same as one somebody invented. This is the record a surveyor asks to see the file for.",
};

const SEVERITY: Record<EvvExceptionKind, Severity> = {
  no_record: "blocking",
  manual_without_reason: "due_soon",
  missing_element: "due_soon",
  open_clock: "blocking",
};

function daysBack(today: string, days: number): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "long" });

export const evvWatch: Monitor = {
  id: "evv",
  name: "EVV Watch",
  question: "Is the visit record complete enough to hand to a surveyor?",
  cadence: "daily",
  run({ evvRecords, evvVisits, today, now }) {
    const period = { from: daysBack(today, EVV_WINDOW_DAYS), to: today };
    const summary = evvSummary({ records: evvRecords, visits: evvVisits, period });
    if (summary.exceptions.length === 0) return [];
    const out: RawFinding[] = [];

    const stale = evvRecords.filter((r) => {
      if (!r.clockInAt || r.clockOutAt || r.date < period.from) return false;
      return (now.getTime() - new Date(r.clockInAt).getTime()) / 3_600_000 >= OPEN_CLOCK_AFTER_HOURS;
    });
    for (const r of stale) {
      out.push({
        key: `evv:${r.visitId}:open-clock`,
        subject: { kind: "shift", id: r.visitId, name: r.caregiverName ?? "A caregiver" },
        severity: "blocking",
        headline: `${r.caregiverName ?? "Somebody"} never clocked out of ${longDay(r.date)}`,
        because: EVV_BECAUSE.open_clock,
        next: { label: "Open the EVV log", to: "/reports/audit/evv" },
      });
    }

    for (const kind of ["no_record", "manual_without_reason", "missing_element"] as const) {
      const of = summary.exceptions.filter((e) => e.kind === kind);
      if (of.length === 0) continue;
      const first = of[0];
      out.push({
        key: `evv:window:${kind}`,
        subject: { kind: "shift", id: first.visitId, name: first.clientName },
        severity: SEVERITY[kind],
        headline:
          of.length === 1
            ? `${first.clientName}'s visit on ${longDay(first.date)} — ${EXCEPTION_LABELS[kind]}`
            : `${of.length} visits in the last ${EVV_WINDOW_DAYS} days — ${EXCEPTION_LABELS[kind]}`,
        because: EVV_BECAUSE[kind],
        next: { label: "Open the EVV log", to: "/reports/audit/evv" },
      });
    }
    return out;
  },
};
