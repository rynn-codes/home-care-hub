import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FolderOpen, Heart, ShieldAlert, TriangleAlert, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDemo } from "@/context/DemoDataProvider";
import { cn } from "@/lib/utils";
import { alertSummary, complianceAlerts, type ComplianceAlert } from "@/domain/credentials/alerts";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedApplicants } from "@/lib/hiringSeed";
import { firstShiftReadiness, isStale } from "@/domain/hiring/pipeline";
import { buildPortalQueue, portalQueueSummary } from "@/domain/portal/officeQueue";
import { incidentUrgency, sortIncidents } from "@/domain/incidents/incidents";
import { seedIncidents } from "@/lib/incidentsSeed";
import { seedMoments, seedPreferences, seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { seedTimeEntries } from "@/lib/payrollSeed";

/**
 * Operations — running the agency, as opposed to serving one client.
 *
 * §12 of the documents spec: confirmed credential data must not remain trapped
 * in the employee profile. This is where it surfaces in full — Home shows the
 * first four and links here.
 *
 * The compliance list is the same `complianceAlerts` Home renders, which
 * composes the same `auditReadiness` the employee record does. §27's one rule
 * engine, many views: a count here that disagreed with the Employees screen
 * would be a bug, not a difference of emphasis.
 */

type Filter = "all" | "blocking" | "warning";

function AlertRow({ alert }: { alert: ComplianceAlert }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
            alert.severity === "blocking" ? "bg-destructive" : "bg-[hsl(var(--warning))]",
          )}
          aria-hidden="true"
        />
        <Link
          to={`/employees/${alert.employeeId}`}
          className="text-sm underline-offset-4 hover:underline"
        >
          {alert.label}
        </Link>
      </span>
      <span className="shrink-0 pl-3.5 text-xs text-muted-foreground sm:pl-0">
        {alert.severity === "blocking"
          ? "Cannot be scheduled"
          : alert.dueOn
            ? `Due ${alert.dueOn}`
            : "Not on file"}
      </span>
    </li>
  );
}

export default function Operations() {
  const { newHires } = useDemo();
  const [filter, setFilter] = useState<Filter>("all");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const alerts = useMemo(() => {
    const hiredIds = new Set(newHires.map((e) => e.id));
    const workforce = [
      ...(newHires as unknown as typeof seedEmployees),
      ...seedEmployees.filter((e) => !hiredIds.has(e.id)),
    ];
    return complianceAlerts(workforce, seedCredentialRequirements, today);
  }, [newHires, today]);

  const visible = alerts.filter((a) => filter === "all" || a.severity === filter);
  const blocking = alerts.filter((a) => a.severity === "blocking").length;

  // Hiring's own two attention cases, so Operations is one place to stand.
  const hiring = useMemo(() => {
    const stale = seedApplicants.filter((a) => isStale(a, today));
    const blockedOnboarding = seedApplicants.filter(
      (a) => a.track === "onboarding" && !firstShiftReadiness(a).ready,
    );
    return { stale, blockedOnboarding };
  }, [today]);

  // The portals write into Joy; this is the office's line of sight into that.
  const portal = useMemo(
    () =>
      buildPortalQueue({
        moments: seedMoments,
        preferences: seedPreferences,
        timeEntries: seedTimeEntries,
        invitations: [],
        documentRequests: seedRequestedDocuments,
        nameFor: (id) => id.replace(/^p-/, ""),
        asOf: today,
      }),
    [today],
  );

  // Incidents come first on this screen because they are the only thing here
  // with a clock somebody else is holding.
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const incidentsOpen = seedIncidents.filter((i) => i.state !== "closed").length;
  const incidentsLate = seedIncidents.filter((i) => {
    const u = incidentUrgency(i, nowIso);
    return i.state !== "closed" && (u.overdue.length > 0 || (u.unclassifiedFor ?? 0) >= 2);
  }).length;
  const incidentsWorst = useMemo(() => {
    const [worst] = sortIncidents(
      seedIncidents.filter((i) => i.state !== "closed"),
      nowIso,
    );
    return worst ? `${worst.clientName} — ${incidentUrgency(worst, nowIso).headline}` : null;
  }, [nowIso]);

  return (
    <>
      <PageHeader
        title="Operations"
        description="Compliance across the workforce, and the hiring pipeline behind it."
      />

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Credentials</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{alertSummary(alerts)}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter compliance alerts">
            {(
              [
                ["all", `All (${alerts.length})`],
                ["blocking", `Stops work (${blocking})`],
                ["warning", `Needs chasing (${alerts.length - blocking})`],
              ] as Array<[Filter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {visible.map((alert) => (
            <AlertRow key={alert.employeeId + alert.credentialType} alert={alert} />
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {alerts.length === 0
                ? "Every credential on file is in date."
                : "Nothing in this filter."}
            </li>
          )}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold">Hiring</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/operations/hiring"
            className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert
                className={cn(
                  "h-4 w-4",
                  hiring.stale.length > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              {hiring.stale.length === 0
                ? "No applicant is going stale"
                : `${hiring.stale.length} ${hiring.stale.length === 1 ? "applicant has" : "applicants have"} not moved in a week`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hiring.stale.map((a) => a.name).join(", ") || "The pipeline is moving."}
            </p>
          </Link>

          <Link
            to="/operations/hiring"
            className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {hiring.blockedOnboarding.length === 0
                ? "Nobody is blocked in onboarding"
                : `${hiring.blockedOnboarding.length} in onboarding cannot take a first shift`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hiring.blockedOnboarding.map((a) => a.name).join(", ") || "Documents are up to date."}
            </p>
          </Link>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold">Incidents</h2>
        <Link
          to="/operations/incidents"
          className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert
              className={cn(
                "h-4 w-4",
                incidentsLate > 0 ? "text-destructive" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            {incidentsOpen === 0
              ? "No open incidents"
              : `${incidentsOpen} open ${incidentsOpen === 1 ? "incident" : "incidents"}`}
            {incidentsLate > 0 && (
              <span className="text-destructive">· {incidentsLate} past a deadline</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {incidentsWorst ?? "Everything reported has been dealt with."}
          </p>
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold">Portals</h2>
        <Link
          to="/operations/portal"
          className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Heart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {portalQueueSummary(portal)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Moments, preference suggestions, clock-out exceptions and document requests.
          </p>
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Elsewhere in Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { to: "/documents", icon: FolderOpen, label: "Documents", note: "Agency documents and templates" },
            { to: "/sops", icon: BookOpen, label: "SOPs", note: "Standard operating procedures" },
          ].map(({ to, icon: Icon, label, note }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{note}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Credential states are computed from expiry dates by the same engine the employee record
        and the scheduling assignment use. A disagreement between these screens would be a bug.
      </p>
    </>
  );
}
