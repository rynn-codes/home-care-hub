import { Fragment, useMemo, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  defaultEvvPeriod,
  EVV_ELEMENTS,
  evvPeriodLabel,
  evvSummary,
  EXCEPTION_LABELS,
  EXCEPTION_SHORT,
  isVerified,
  METHOD_LABELS,
  recordExceptions,
  type EvvExceptionKind,
} from "@/domain/audit/evv";
import { seedEvvRecords, seedEvvVisits } from "@/lib/evvSeed";
import { cn } from "@/lib/utils";

/**
 * The EVV log — every visit clocked in the last three months, and whether
 * each record carries the six things a verified visit has to carry.
 *
 * Joy is private pay and files with no state aggregator, so nothing here
 * claims a transmission status. What it reports is whether the record is
 * complete, which is the question a surveyor asks.
 */
type Filter = "all" | "exceptions" | EvvExceptionKind;

const KIND_ORDER: EvvExceptionKind[] = ["no_record", "open_clock", "manual_without_reason", "missing_element"];

export default function EvvLog() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const period = useMemo(() => defaultEvvPeriod(today), [today]);
  const [filter, setFilter] = useState<Filter>("all");
  const summary = useMemo(() => evvSummary({ records: seedEvvRecords, visits: seedEvvVisits, period }), [period]);
  const rows = useMemo(() => {
    const inPeriod = seedEvvRecords.filter((r) => r.date >= period.from && r.date <= period.to).sort((a, b) => b.date.localeCompare(a.date));
    if (filter === "all") return inPeriod;
    if (filter === "exceptions") return inPeriod.filter((r) => !isVerified(r));
    return inPeriod.filter((r) => recordExceptions(r).some((e) => e.kind === filter));
  }, [filter, period]);
  const percent = Math.round(summary.rate * 100);
  const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null);

  return (
    <>
      <PageHeader
        parents={[
          { label: "Reports", to: "/reports" },
          { label: "Audit", to: "/reports/audit" },
        ]}
        title="EVV records"
        description={`Every visit clocked between ${evvPeriodLabel(period)}.`}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Visits in the period", value: summary.records + summary.byKind.no_record },
          { label: "Fully verified", value: summary.verified },
          { label: "With something outstanding", value: summary.exceptions.length },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-5 py-[18px]">
            <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{s.label}</span>
            <span className="text-[32px] font-semibold leading-none tracking-[-.02em] text-[var(--ink)]">{s.value}</span>
          </div>
        ))}
      </section>
      <p className="mt-4 text-sm text-muted-foreground">{percent}% of visits in the period carry all six required elements with nothing outstanding.</p>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">What a verified visit has to carry</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          The six elements the 21st Century Cures Act fixes. Every row below is checked against this list, and a record short of one of them is counted as an exception however complete the rest of it looks.
        </p>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {EVV_ELEMENTS.map((e, i) => (
            <li key={e.key}>
              <span className="tabular-nums text-[var(--ink-body)]">{i + 1}.</span> {e.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">What is outstanding</h2>
        {summary.exceptions.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Nothing. Every visit in the period is fully verified.</p>
        ) : (
          <>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Stated here rather than left to be found. A surveyor reaches these either way, and the difference between an agency that knew and one that did not is most of the conversation.
            </p>
            <ul className="mt-3 divide-y divide-border">
              {KIND_ORDER.filter((k) => summary.byKind[k] > 0).map((k) => (
                <li key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm">{EXCEPTION_LABELS[k]}</span>
                  <button
                    type="button"
                    onClick={() => setFilter(filter === k ? "all" : k)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                      filter === k ? "bg-primary text-white" : "bg-[var(--hairline-soft)] text-[var(--ink-body)] hover:bg-[var(--wash-strong)]",
                    )}
                  >
                    {summary.byKind[k]} — {filter === k ? "showing" : "show"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-2">
        <h2 className="m-0 mr-auto text-sm font-semibold">The log</h2>
        {(
          [
            ["all", "Every visit"],
            ["exceptions", "Only exceptions"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-[9px] border px-3 py-1.5 text-[12.5px] transition-colors",
              filter === value ? "border-primary bg-[#EEF0FE] font-medium text-primary" : "border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:bg-[var(--wash)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <caption className="sr-only">Electronic visit verification records for {evvPeriodLabel(period)}, newest first</caption>
            <thead>
              <tr>
                {["Date", "Client", "Service", "Caregiver", "In", "Out", "Location", "Captured", ""].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap bg-[var(--paper-sunken)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const problems = recordExceptions(r);
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-[var(--hairline-soft)] align-top">
                      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] tabular-nums">{r.date}</td>
                      <td className="min-w-[8rem] px-3 py-3 text-[12.5px] font-medium">{r.clientName ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[var(--ink-body)]">{r.service ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[var(--ink-body)]">{r.caregiverName ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] tabular-nums text-[var(--ink-body)]">{clock(r.clockInAt) ?? "—"}</td>
                      <td className={cn("whitespace-nowrap px-3 py-3 text-[12.5px] tabular-nums", r.clockOutAt ? "text-[var(--ink-body)]" : "font-medium text-[#B42318]")}>{clock(r.clockOutAt) ?? "Never"}</td>
                      <td title={r.location ?? undefined} className={cn("max-w-[11rem] truncate whitespace-nowrap px-3 py-3 text-[12.5px]", r.location ? "text-[var(--ink-body)]" : "font-medium text-[#B42318]")}>
                        {r.location ? r.location.split(",")[0] : "Not captured"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[var(--ink-body)]">{METHOD_LABELS[r.method]}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {problems.length === 0 ? (
                          <span className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--success))]">
                            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[12px] text-[#B54708]">
                            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            {problems.length === 1 ? EXCEPTION_SHORT[problems[0].kind] : `${problems.length} problems`}
                          </span>
                        )}
                      </td>
                    </tr>
                    {r.method === "manual" && (
                      <tr className="border-t border-transparent">
                        <td />
                        <td colSpan={8} className="px-3 pb-3 text-[12px] leading-[1.5]">
                          <span className={r.reasonCode ? "text-muted-foreground" : "font-medium text-[#B42318]"}>{r.reasonCode ?? "No reason recorded for a visit entered by hand."}</span>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No records match that filter.</p>}
      </div>

      {summary.byKind.no_record > 0 && (
        <section className="mt-6 rounded-2xl border border-[hsl(var(--warning)/0.5)] bg-surface p-5">
          <h2 className="text-sm font-semibold">Visits with no record at all</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            These are on the schedule for the period and nothing was clocked against them. They have no row in the log above because there is nothing to draw.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {summary.exceptions
              .filter((e) => e.kind === "no_record")
              .map((e) => (
                <li key={e.visitId} className="flex flex-wrap gap-x-3 py-2 text-sm">
                  <span className="tabular-nums text-muted-foreground">{e.date}</span>
                  <span className="font-medium">{e.clientName}</span>
                  <span className="text-muted-foreground">with {e.caregiverName}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, computed from the visit board. Joy is private pay and files with no state aggregator, so nothing here claims a transmission status — what it reports is whether the record is complete.
      </p>
    </>
  );
}
