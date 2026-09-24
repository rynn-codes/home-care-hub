import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, Clock, ShieldAlert } from "lucide-react";
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
  acknowledgeAsAdmin,
  classifyIncident,
  closeIncident,
  closeRefusals,
  incidentUrgency,
  recordNotification,
  recordRnVisit,
  sortIncidents,
  type Incident,
  type IncidentKind,
  type IncidentSeverity,
} from "@/domain/incidents/incidents";
import { seedIncidents } from "@/lib/incidentsSeed";
import { isRegisteredNurse } from "@/domain/clinical/registeredNurse";
import { useDemo } from "@/context/DemoDataProvider";
import { cn } from "@/lib/utils";

/**
 * Reports → Incidents.
 *
 * §11 makes a caregiver answer an incident question before she can clock
 * out, and this is where that answer lands. Ordered by what is late rather
 * than by what is recent: an incident nobody has classified is the top of the
 * list, because until somebody says what kind it is, Joy does not know who
 * has to be told or by when.
 *
 * The administrator reading this list is the administrator being told, so
 * her own notification is marked as she opens it and her row is not shown
 * back to her as a task.
 */

const KINDS: IncidentKind[] = ["fall", "injury", "medication_error", "behavioural", "property_damage", "missing_client", "allegation", "death", "other"];
const SEVERITIES: IncidentSeverity[] = ["minor", "significant", "serious"];
const ADMIN = "u-karynn";

const whenLabel = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors",
        active ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]" : "border-border hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function OpenIncident({ incident, isRn, isAdmin, onChange }: { incident: Incident; isRn: boolean; isAdmin: boolean; onChange: (next: Incident) => void }) {
  const now = new Date().toISOString();
  const urgency = incidentUrgency(incident, now);
  const [kind, setKind] = useState<IncidentKind | null>(incident.kind);
  // Deliberately null rather than a sensible default. Severity is what sets
  // the notification clocks, so a pre-selected "significant" means Joy — not
  // the person reading the narrative — decided how serious somebody's fall was.
  const [severity, setSeverity] = useState<IncidentSeverity | null>(incident.severity ?? null);
  const [findings, setFindings] = useState(incident.findings ?? "");
  const [visitFindings, setVisitFindings] = useState("");

  const late = urgency.rnVisitOverdue || urgency.overdue.length > 0 || (urgency.unclassifiedFor ?? 0) >= CLASSIFY_WITHIN_HOURS;
  // The administrator's own row is not a task for the administrator.
  const toTell = incident.notifications.filter((n) => !(isAdmin && n.party === "administrator"));
  const refusals = closeRefusals({ ...incident, findings: findings.trim() || null });
  const canClose = !!incident.kind && refusals.every((r) => r === "no_findings");

  return (
    <li className={cn("rounded-2xl border bg-surface p-5", late ? "border-destructive/40" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {late ? <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            {incident.clientName}
            {incident.kind && <span className="text-muted-foreground">· {INCIDENT_LABELS[incident.kind]}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {incident.reportedByName} · {whenLabel(incident.reportedAt)}
          </p>
        </div>
        <p className={cn("shrink-0 text-xs font-medium", late ? "text-destructive" : "text-[hsl(var(--warning))]")}>{urgency.headline}</p>
      </div>

      {/* Her words, unchanged. The office classifies; it does not rewrite. */}
      <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm leading-relaxed">{incident.narrative}</blockquote>

      {!incident.kind && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium">What kind of incident is this?</p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Choice key={k} active={kind === k} onClick={() => setKind(k)}>
                {INCIDENT_LABELS[k]}
              </Choice>
            ))}
          </div>
          <p className="text-xs font-medium">How serious?</p>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <Choice key={s} active={severity === s} onClick={() => setSeverity(s)}>
                {SEVERITY_LABELS[s]}
              </Choice>
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

      {incident.kind && toTell.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who has to be told</p>
          <ul className="mt-2 space-y-2">
            {toTell.map((n) => {
              const isLate = !n.doneAt && Date.parse(n.dueBy) < Date.parse(now);
              return (
                <li key={n.party} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    {n.doneAt ? (
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className={cn("h-3.5 w-3.5", isLate ? "text-destructive" : "text-[hsl(var(--warning))]")} aria-hidden="true" />
                    )}
                    {NOTIFY_LABELS[n.party]}
                    <span className={cn("text-xs", isLate ? "text-destructive" : "text-muted-foreground")}>{n.doneAt ? (n.note ?? "Done") : `by ${timeLabel(n.dueBy)}`}</span>
                  </span>
                  {!n.doneAt && (
                    <Button size="sm" variant="outline" onClick={() => onChange(recordNotification({ incident, party: n.party, note: "Told", byUserId: ADMIN, at: new Date().toISOString() }))}>
                      Mark Told
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {incident.kind && incident.rnVisit && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RN visit</p>
          {incident.rnVisit.doneAt ? (
            <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
              <Check className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[hsl(var(--success))]" aria-hidden="true" />
              <span>{incident.rnVisit.findings}</span>
              <span className="text-xs text-muted-foreground">Seen {whenLabel(incident.rnVisit.doneAt)}</span>
            </p>
          ) : (
            <>
              {/* A phone call to the RN is not a nurse looking at the client. */}
              <p className={cn("mt-2 text-sm", Date.parse(incident.rnVisit.dueBy) < Date.parse(now) ? "text-destructive" : "text-muted-foreground")}>
                An RN has to see {incident.clientName.split(" ")[0]} by {whenLabel(incident.rnVisit.dueBy)}.
              </p>
              {isRn ? (
                <>
                  <Textarea id={`rn-visit-${incident.id}`} aria-label="What did the nurse find?" rows={2} className="mt-2" value={visitFindings} onChange={(e) => setVisitFindings(e.target.value)} placeholder="What you found when you got there." />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!visitFindings.trim()}
                    onClick={() => {
                      onChange(recordRnVisit({ incident, findings: visitFindings, byUserId: ADMIN, isRn, at: new Date().toISOString() }));
                      toast.success("RN visit recorded");
                    }}
                  >
                    Record the visit
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">The nurse records the visit from her own sign-in.</p>
              )}
            </>
          )}
        </div>
      )}

      {canClose && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <label htmlFor={`findings-${incident.id}`} className="text-xs font-medium">
            What did you find?
          </label>
          <Textarea id={`findings-${incident.id}`} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="What happened, and whether anything changes." />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={refusals.length > 0}
              onClick={() => {
                onChange(closeIncident({ incident: { ...incident, findings: findings.trim() }, byUserId: ADMIN, at: new Date().toISOString() }));
                toast.success("Incident closed");
              }}
            >
              Close incident
            </Button>
            {refusals.length > 0 && <p className="text-xs text-muted-foreground">{CLOSE_MESSAGES[refusals[0]]}</p>}
          </div>
        </div>
      )}
      {incident.kind && !canClose && <p className="mt-3 text-xs text-muted-foreground">{CLOSE_MESSAGES[refusals.find((r) => r !== "no_findings") ?? "no_findings"]}</p>}
    </li>
  );
}

function ClosedIncident({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border first:border-t-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted">
        <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{incident.clientName}</span>
          {incident.kind && <span className="text-muted-foreground"> · {INCIDENT_LABELS[incident.kind]}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">Closed {incident.closedAt ? whenLabel(incident.closedAt) : ""}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 pl-11 text-sm">
          <blockquote className="border-l-2 border-border pl-3 leading-relaxed text-muted-foreground">{incident.narrative}</blockquote>
          {incident.rnVisit?.findings && (
            <p className="m-0">
              <span className="text-muted-foreground">RN: </span>
              {incident.rnVisit.findings}
            </p>
          )}
          {incident.findings && (
            <p className="m-0">
              <span className="text-muted-foreground">Found: </span>
              {incident.findings}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function Incidents() {
  const { currentUser } = useDemo();
  const [incidents, setIncidents] = useState<Incident[]>(seedIncidents);
  const now = useMemo(() => new Date().toISOString(), []);
  const isRn = isRegisteredNurse(currentUser, now);
  const isAdmin = currentUser.role === "ceo_admin";

  // Opening the list is the office hearing about it.
  useEffect(() => {
    if (!isAdmin) return;
    const at = new Date().toISOString();
    setIncidents((all) => all.map((i) => (i.state === "closed" ? i : acknowledgeAsAdmin({ incident: i, byUserId: ADMIN, at }))));
  }, [isAdmin]);

  const ordered = sortIncidents(incidents, now);
  const open = ordered.filter((i) => i.state !== "closed");
  const closed = ordered.filter((i) => i.state === "closed");
  const late = open.filter((i) => {
    const u = incidentUrgency(i, now);
    return u.rnVisitOverdue || u.overdue.length > 0 || (u.unclassifiedFor ?? 0) >= CLASSIFY_WITHIN_HOURS;
  }).length;
  const update = (next: Incident) => setIncidents((all) => all.map((i) => (i.id === next.id ? next : i)));

  return (
    <>
      <PageHeader
        parents={[{ label: "Reports", to: "/reports" }]}
        title="Incidents"
        actions={
          <Button variant="outline" asChild>
            <Link to="/reports/incidents/annual">Yearly report</Link>
          </Button>
        }
      />

      <p className="mb-5 text-sm text-muted-foreground">
        {open.length === 0 ? "Nothing open." : `${open.length} open`}
        {late > 0 && <span className="text-destructive"> · {late} past a deadline</span>}
      </p>

      <ul className="space-y-4">
        {open.map((incident) => (
          <OpenIncident key={incident.id} incident={incident} isRn={isRn} isAdmin={isAdmin} onChange={update} />
        ))}
        {open.length === 0 && <li className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">Nothing needs you.</li>}
      </ul>

      {closed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Closed · {closed.length}</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {closed.map((incident) => (
              <ClosedIncident key={incident.id} incident={incident} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
