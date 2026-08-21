import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  annualIncidentLog,
  annualLogHeadline,
  yearsWithIncidents,
  type AnnualLogLine,
} from "@/domain/incidents/annualLog";
import { seedIncidents } from "@/lib/incidentsSeed";
import { cn } from "@/lib/utils";

/**
 * The yearly incident report — Karynn, 21 August: "It needs to be logged on the
 * yearly incident report."
 *
 * Two decisions about this page.
 *
 * It is COMPUTED from the incidents themselves, so there is nothing to keep and
 * nothing to forget to update. A hand-kept register drifts from what it
 * describes, and the copy handed to a surveyor is then the one that drifted.
 *
 * And it shows the misses first. A register that lists what happened without
 * saying whether Joy did what it said it would do lets an agency look diligent
 * through a bad year — which is the opposite of what this document is for.
 */

function Stat({
  label,
  value,
  bad,
}: {
  label: string;
  value: string | number;
  bad?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums",
          bad && Number(value) > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LogRow({ line }: { line: AnnualLogLine }) {
  const problems = [
    ...line.missedNotifications.map((p) => `${p} was never told`),
    ...line.lateNotifications.map((p) => `${p} was told late`),
    line.rnVisitRequired && line.rnVisitOnTime === false
      ? "The RN visit was late or has not happened"
      : null,
  ].filter(Boolean) as string[];

  return (
    <li className="border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium">
          {line.date} · {line.clientName} · {line.kindLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          Reported by {line.reportedByName}
          {line.closed ? ` · closed in ${line.daysToClose} days` : " · still open"}
        </p>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">{line.narrative}</p>

      {line.findings && (
        <p className="mt-1 text-sm">
          <span className="text-muted-foreground">Findings: </span>
          {line.findings}
        </p>
      )}

      {/* Icon and text in a two-column flow rather than wrapping siblings: a
          long list of misses otherwise pushed the warning icon onto a line of
          its own, which reads as a stray mark. */}
      <p className="mt-2 flex items-start gap-2 text-xs">
        {problems.length === 0 ? (
          <>
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              Everyone told on time{line.rnVisitRequired ? ", RN visit made" : ""}
            </span>
          </>
        ) : (
          <>
            <TriangleAlert
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span className="text-destructive">{problems.join(" · ")}</span>
          </>
        )}
      </p>
    </li>
  );
}

export default function IncidentReport() {
  const years = useMemo(() => yearsWithIncidents(seedIncidents), []);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());

  const log = useMemo(() => annualIncidentLog({ incidents: seedIncidents, year }), [year]);

  return (
    <>
      <PageHeader
        title="Yearly incident report"
        description="Every incident reported in the year, and whether Joy did what it said it would do each time."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/operations/incidents">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Back to Incidents
          </Link>
        </Button>

        {years.length > 1 && (
          <div className="flex gap-2">
            {years.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={y === year ? "default" : "outline"}
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
        )}
      </div>

      <p className="mb-6 max-w-prose text-sm">{annualLogHeadline(log)}</p>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Reported" value={log.total} />
        <Stat label="Still open" value={log.openAtRun} bad />
        <Stat label="Never classified" value={log.neverClassified} bad />
        <Stat label="Somebody never told" value={log.withMissedNotifications} bad />
        <Stat
          label="RN visits made on time"
          value={`${log.rnVisitsOnTime} / ${log.rnVisitsRequired}`}
        />
      </div>

      {log.byKind.length > 0 && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By kind
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {log.byKind.map((row) => (
                <li key={row.kind} className="flex justify-between gap-4">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              By severity
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {log.bySeverity.map((row) => (
                <li key={row.severity} className="flex justify-between gap-4">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">The register</h2>
        <ul className="mt-1">
          {log.lines.map((line) => (
            <LogRow key={line.id} line={line} />
          ))}
          {log.lines.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              Nothing was reported in {year}.
            </li>
          )}
        </ul>
      </section>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Computed from the incidents themselves rather than kept as a separate register, so this
        and the Incidents screen cannot disagree. Keyed on when each incident was reported, not
        when it closed — one reported on 30 December and closed in January belongs to the year it
        happened in.
      </p>
    </>
  );
}
