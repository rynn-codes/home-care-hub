import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CLOSE_MESSAGES,
  INCIDENT_LABELS,
  CLASSIFY_WITHIN_HOURS,
  NOTIFY_LABELS,
  SEVERITY_LABELS,
  classifyIncident,
  closeIncident,
  closeRefusals,
  incidentUrgency,
  recordNotification,
  sortIncidents,
  type Incident,
  type IncidentKind,
  type IncidentSeverity,
} from "@/domain/incidents/incidents";
import { seedIncidents } from "@/lib/incidentsSeed";
import { cn } from "@/lib/utils";

/**
 * Operations → Incidents.
 *
 * The screen that was missing. §11 makes a caregiver answer an incident
 * question before she can clock out, and until now that answer went into a
 * chart line and nowhere else — which is worse than not asking, because it
 * looks like diligence and the first the office hears of a fall is when a
 * daughter rings.
 *
 * Ordered by what is late rather than by what is recent. An incident nobody has
 * classified is the top of the list, because until somebody says what kind it
 * is, Joy does not know who has to be told or by when.
 */

const KINDS: IncidentKind[] = [
  "fall",
  "injury",
  "medication_error",
  "behavioural",
  "property_damage",
  "missing_client",
  "allegation",
  "death",
  "other",
];

const SEVERITIES: IncidentSeverity[] = ["minor", "significant", "serious"];

const ADMIN = "u-karynn";

function IncidentCard({
  incident,
  onChange,
}: {
  incident: Incident;
  onChange: (next: Incident) => void;
}) {
  const now = new Date().toISOString();
  const urgency = incidentUrgency(incident, now);
  const [kind, setKind] = useState<IncidentKind | null>(incident.kind);
  // Deliberately null rather than a sensible default. Severity is what sets
  // the notification clocks, so a pre-selected "significant" means Joy — not
  // the person reading the narrative — decided how serious somebody's fall
  // was, and a distracted tap on Classify records that decision as theirs.
  const [severity, setSeverity] = useState<IncidentSeverity | null>(incident.severity ?? null);
  const [findings, setFindings] = useState(incident.findings ?? "");

  const late =
    urgency.overdue.length > 0 || (urgency.unclassifiedFor ?? 0) >= CLASSIFY_WITHIN_HOURS;
  const refusals = closeRefusals({ ...incident, findings: findings.trim() || null });

  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface p-5",
        incident.state === "closed"
          ? "border-border opacity-70"
          : late
            ? "border-destructive/40"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {incident.state === "closed" ? (
              <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
            ) : late ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            ) : (
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {incident.clientName}
            {incident.kind && (
              <span className="text-muted-foreground">· {INCIDENT_LABELS[incident.kind]}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reported by {incident.reportedByName} · {incident.reportedAt.slice(0, 16).replace("T", " ")}
          </p>
        </div>

        <p
          className={cn(
            "shrink-0 text-xs font-medium",
            incident.state === "closed"
              ? "text-muted-foreground"
              : late
                ? "text-destructive"
                : "text-[hsl(var(--warning))]",
          )}
        >
          {urgency.headline}
        </p>
      </div>

      {/* Her words, unchanged. The office classifies; it does not rewrite. */}
      <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm leading-relaxed">
        {incident.narrative}
      </blockquote>

      {/* ------------------------------------------------------ classify -- */}
      {!incident.kind && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium">What kind of incident is this?</p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors",
                  kind === k
                    ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                {INCIDENT_LABELS[k]}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium">How serious?</p>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                aria-pressed={severity === s}
                className={cn(
                  "min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors",
                  severity === s
                    ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                {SEVERITY_LABELS[s]}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            disabled={!kind || !severity}
            onClick={() => {
              if (!kind || !severity) return;
              onChange(classifyIncident({ incident, kind, severity, byUserId: ADMIN }));
              toast.success("Classified — Joy has worked out who needs telling");
            }}
          >
            Classify
          </Button>
        </div>
      )}

      {/* --------------------------------------------------- notifications -- */}
      {incident.notifications.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Who has to be told
          </p>
          <ul className="mt-2 space-y-2">
            {incident.notifications.map((n) => {
              const isLate = !n.doneAt && Date.parse(n.dueBy) < Date.parse(now);
              return (
                <li key={n.party} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    {n.doneAt ? (
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-hidden="true" />
                    ) : (
                      <AlertTriangle
                        className={cn(
                          "h-3.5 w-3.5",
                          isLate ? "text-destructive" : "text-[hsl(var(--warning))]",
                        )}
                        aria-hidden="true"
                      />
                    )}
                    {NOTIFY_LABELS[n.party]}
                    <span className={cn("text-xs", isLate ? "text-destructive" : "text-muted-foreground")}>
                      {n.doneAt ? n.note ?? "Done" : `by ${n.dueBy.slice(11, 16)}`}
                    </span>
                  </span>

                  {!n.doneAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onChange(
                          recordNotification({
                            incident,
                            party: n.party,
                            note: "Told",
                            byUserId: ADMIN,
                            at: new Date().toISOString(),
                          }),
                        )
                      }
                    >
                      Mark told
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------------- close -- */}
      {incident.state === "under_review" && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <label htmlFor={`findings-${incident.id}`} className="text-xs font-medium">
            What did you find?
          </label>
          <Textarea
            id={`findings-${incident.id}`}
            rows={2}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="What happened, and whether anything changes."
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={refusals.length > 0}
              onClick={() => {
                onChange(
                  closeIncident({
                    incident: { ...incident, findings: findings.trim() },
                    byUserId: ADMIN,
                    at: new Date().toISOString(),
                  }),
                );
                toast.success("Incident closed");
              }}
            >
              Close incident
            </Button>
            {refusals.length > 0 && (
              <p className="text-xs text-muted-foreground">{CLOSE_MESSAGES[refusals[0]]}</p>
            )}
          </div>
        </div>
      )}

      {incident.state === "closed" && incident.findings && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          {incident.findings}
        </p>
      )}
    </li>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>(seedIncidents);
  const now = useMemo(() => new Date().toISOString(), []);

  const ordered = sortIncidents(incidents, now);
  const open = incidents.filter((i) => i.state !== "closed").length;
  const late = incidents.filter((i) => {
    const u = incidentUrgency(i, now);
    return i.state !== "closed" && (u.overdue.length > 0 || (u.unclassifiedFor ?? 0) >= 2);
  }).length;

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Everything a caregiver reported at clock-out, and who still has to be told."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        {open === 0 ? "Nothing open." : `${open} open`}
        {late > 0 && <span className="text-destructive"> · {late} past a deadline</span>}
      </p>

      <ul className="space-y-4">
        {ordered.map((incident) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onChange={(next) =>
              setIncidents((all) => all.map((i) => (i.id === next.id ? next : i)))
            }
          />
        ))}
        {ordered.length === 0 && (
          <li className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
            No incidents reported.
          </li>
        )}
      </ul>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Notification deadlines are Joy's own policy, held as data in
        <code className="mx-1">NOTIFICATION_POLICY</code>, and need checking against the current
        Texas requirements for Joy's licence category. The workflow is right; the windows are a
        starting point.
      </p>
    </>
  );
}
