import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { seedVisits } from "@/lib/schedulingSeed";
import { timeRange } from "@/domain/portal/employeeHome";
import {
  TASK_OUTCOME_LABELS,
  canClockOut,
  clockOut,
  clockOutWithException,
  completionCheck,
  completionMessage,
  confirmClockIn,
  elapsed,
  failClockIn,
  newVisitRecord,
  requestClockIn,
  tasksForVisit,
  type TaskOutcome,
} from "@/domain/portal/visit";
import { cn } from "@/lib/utils";

/**
 * Start visit, chart it, clock out — §10 and §11.
 *
 * The screen holds no clock of its own. Every state change goes through
 * `domain/portal/visit.ts`, which takes the time as an argument, because §10
 * keeps the server authoritative for official timestamps and a phone's clock
 * has no business in a timesheet.
 *
 * `serverNow` here stands in for that call. It is the one place a real
 * implementation changes, and it is deliberately a function rather than an
 * inline `new Date()` so the substitution is obvious.
 */

/** Stand-in for the server's timestamp. The developer replaces this. */
async function serverNow(): Promise<string> {
  await new Promise((r) => setTimeout(r, 350));
  return new Date().toISOString();
}

const OUTCOMES: TaskOutcome[] = ["done", "declined", "not_needed"];

export default function VisitScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const visit = useMemo(() => seedVisits.find((v) => v.id === id), [id]);
  const tasks = useMemo(() => (visit ? tasksForVisit(visit) : []), [visit]);

  const [record, setRecord] = useState(() => newVisitRecord(id ?? ""));
  const [busy, setBusy] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const now = new Date();

  if (!visit) {
    return (
      <PortalFrame>
        <h1 className="font-display text-2xl font-bold tracking-tight">Visit not found</h1>
        <p className="mt-3 text-base text-muted-foreground">
          This visit is not on your schedule. Call the office on (713) 231-9662.
        </p>
      </PortalFrame>
    );
  }

  const check = completionCheck(record, tasks);
  const ready = canClockOut(record, tasks);

  async function startVisit() {
    setBusy(true);
    setRecord((r) => requestClockIn(r));
    try {
      const at = await serverNow();
      setRecord((r) => confirmClockIn(r, at));
    } catch {
      setRecord((r) => failClockIn(r));
    } finally {
      setBusy(false);
    }
  }

  async function finish(withException: boolean) {
    setBusy(true);
    try {
      const at = await serverNow();
      setRecord((r) => (withException ? clockOutWithException(r, tasks, at) : clockOut(r, at)));
    } finally {
      setBusy(false);
    }
  }

  const state = record.clock.state;

  return (
    <PortalFrame>
      <button
        type="button"
        onClick={() => navigate("/portal/work")}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {visit.clientName}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{visit.service}</p>
      <p className="text-base text-muted-foreground">{timeRange(visit)}</p>

      {/* ------------------------------------------------- not started --- */}
      {state === "not_started" || state === "requested" ? (
        <Button
          className="mt-8 h-14 w-full rounded-2xl text-base"
          disabled={busy}
          onClick={startVisit}
        >
          {state === "requested" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            "Clock in"
          )}
        </Button>
      ) : null}

      {/* ------------------------------------------------- in progress --- */}
      {state === "clocked_in" && (
        <>
          <div className="mt-6 rounded-2xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.06)] p-4">
            <p className="text-sm font-medium">
              Visit in progress · clocked in{" "}
              {new Date(record.clock.clockedInAt!).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {elapsed(record.clock, now)} so far
            </p>
          </div>

          <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today's care
          </p>
          <ul className="mt-2 space-y-3">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-base font-medium">
                  {task.label}
                  {!task.required && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {OUTCOMES.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() =>
                        setRecord((r) => ({ ...r, tasks: { ...r.tasks, [task.id]: outcome } }))
                      }
                      className={cn(
                        "min-h-11 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                        record.tasks[task.id] === outcome
                          ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                          : "border-border hover:bg-surface-muted",
                      )}
                    >
                      {TASK_OUTCOME_LABELS[outcome]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-lg font-medium">How did the visit go?</p>
          <Textarea
            value={record.note}
            onChange={(e) => setRecord((r) => ({ ...r, note: e.target.value }))}
            rows={5}
            placeholder="A few sentences is plenty."
            className="mt-3 rounded-2xl border-border bg-surface px-4 py-3 text-base"
          />

          <p className="mt-8 text-lg font-medium">Was there an incident or a fall?</p>
          <div className="mt-3 flex gap-2">
            {[
              { value: false, label: "No" },
              { value: true, label: "Yes" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() =>
                  setRecord((r) => ({
                    ...r,
                    incidentAnswered: true,
                    incidentOccurred: option.value,
                  }))
                }
                className={cn(
                  "min-h-12 flex-1 rounded-2xl border px-4 text-base transition-colors",
                  record.incidentAnswered && record.incidentOccurred === option.value
                    ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                    : "border-border hover:bg-surface-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {record.incidentAnswered && record.incidentOccurred && (
            <Textarea
              value={record.incidentDetail}
              onChange={(e) => setRecord((r) => ({ ...r, incidentDetail: e.target.value }))}
              rows={4}
              placeholder="What happened, in your own words."
              className="mt-3 rounded-2xl border-border bg-surface px-4 py-3 text-base"
            />
          )}

          {/* --------------------------------------------- clock out --- */}
          <div className="mt-10 border-t border-border pt-6">
            {showCheck && (
              <ul className="mb-5 space-y-2">
                {check.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "font-semibold",
                        item.complete ? "text-[hsl(var(--success))]" : "text-destructive",
                      )}
                    >
                      {item.complete ? "✓" : "✗"}
                    </span>
                    <span className={cn(!item.complete && "text-muted-foreground")}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mb-4 text-sm text-muted-foreground">{completionMessage(check)}</p>

            <Button
              className="h-14 w-full rounded-2xl text-base"
              disabled={busy}
              onClick={() => (ready ? finish(false) : setShowCheck(true))}
            >
              Clock out
            </Button>

            {showCheck && !ready && (
              <>
                {/* §11 stops short of trapping somebody on the clock. A shift
                    that has ended must be able to end; the gap is recorded
                    instead, and the office chases one exception rather than
                    finding it at audit. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => finish(true)}
                  className="mt-4 w-full text-center text-sm text-muted-foreground underline underline-offset-4"
                >
                  I can't finish this now — clock me out anyway
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  The office will be told what's outstanding.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------- finished --- */}
      {state === "clocked_out" && (
        <div className="mt-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success)/0.12)]">
            <Check className="h-7 w-7 text-[hsl(var(--success))]" aria-hidden="true" />
          </span>
          <h2 className="mt-6 font-display text-xl font-bold tracking-tight">
            Visit complete — {elapsed(record.clock, now)}
          </h2>
          {record.clock.exceptionReason && (
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
              The office has been told what was outstanding.
            </p>
          )}
          <Button
            variant="ghost"
            className="mt-6 h-12"
            onClick={() => navigate("/portal/work")}
          >
            Back to your day
          </Button>
        </div>
      )}
    </PortalFrame>
  );
}
