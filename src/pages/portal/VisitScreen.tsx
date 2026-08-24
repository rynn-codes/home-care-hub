import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { tasksForVisit } from "@/domain/carePlan/plan";
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
  type TaskOutcome,
} from "@/domain/portal/visit";
import type { ChartDraft, ConfirmedChart } from "@/domain/portal/charting";
import { approveMoment, draftMoment, type Moment } from "@/domain/portal/moments";
import { chartLines, confirmChart } from "@/domain/portal/charting";
import { VerbatimChartDraftingService } from "@/domain/portal/memoryAdapters";
import { usePortalSession } from "@/context/PortalSessionProvider";
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

/**
 * No model is connected, so this drafts from what the caregiver recorded and
 * quotes her own words. It produces a complete, confirmable chart — see
 * `VerbatimChartDraftingService`.
 */
const drafting = new VerbatimChartDraftingService();

export default function VisitScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const visit = useMemo(() => seedVisits.find((v) => v.id === id), [id]);
  // From the care plan that was in effect on this visit's date, not from a
  // list this screen makes up. A client with no active plan gets no task list
  // and is told why, which is the honest state and the one that gets fixed.
  const tasks = useMemo(
    () =>
      visit?.clientPersonId
        ? tasksForVisit({
            plans: seedCarePlans,
            clientPersonId: visit.clientPersonId,
            service: visit.service,
            date: visit.startsAt.slice(0, 10),
          })
        : [],
    [visit],
  );

  const { grant } = usePortalSession();
  const [record, setRecord] = useState(() => newVisitRecord(id ?? ""));
  const [busy, setBusy] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const [confirmedChart, setConfirmedChart] = useState<ConfirmedChart | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [momentText, setMomentText] = useState("");
  const [moment, setMoment] = useState<Moment | null>(null);
  const [momentError, setMomentError] = useState<string | null>(null);
  const [momentSkipped, setMomentSkipped] = useState(false);
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

  const isCareVisit = !visit.eventType;
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

  /**
   * §12: build the chart, then show it for confirmation. The caregiver is not
   * clocked out by this — reviewing the record and ending the shift are two
   * different acts, and merging them would mean confirming a clinical document
   * by tapping a button labelled "Clock out".
   */
  async function buildChart() {
    setBusy(true);
    try {
      const d = await drafting.draft({ record, tasks, visitId: id ?? "" });
      setDraft(d);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!draft) return;
    try {
      setConfirmedChart(
        confirmChart({
          draft,
          personId: grant?.personId ?? null,
          at: new Date().toISOString(),
          edited,
        }),
      );
      setChartError(null);
    } catch (e) {
      // Surfaced rather than swallowed. A refusal here means a line could not
      // account for itself, which the caregiver needs to see.
      setChartError(e instanceof Error ? e.message : "This chart could not be confirmed.");
    }
  }

  /**
   * §14: ask near visit completion, and never publish without the approval
   * step. The check runs before sharing, so a Moment that reads like a chart
   * line is stopped here rather than landing on a daughter's phone.
   *
   * The consent is hardcoded to `accept` for the demo. In the real thing it
   * comes from this client's disclosure list — see `checkMoment`.
   */
  function shareMoment() {
    try {
      const drafted = draftMoment({
        id: `moment-${id}`,
        visitId: id ?? "",
        clientPersonId: visit?.clientName ?? "",
        narrative: momentText,
        byPersonId: grant?.personId ?? null,
        at: new Date().toISOString(),
      });
      const shared = approveMoment({
        moment: drafted,
        approver: { personId: grant?.personId ?? "", isOffice: false },
        disclosureConsent: "agree",
        at: new Date().toISOString(),
      });
      setMoment(shared);
      setMomentError(null);
    } catch (e) {
      setMomentError(e instanceof Error ? e.message : "This could not be shared.");
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

          {/* A field orientation or an RN assessment is not care delivered to a
              client, so it has no plan and no task list — and telling somebody
              shadowing a shift that "there is no care plan for this visit" is
              both wrong and slightly alarming. */}
          {isCareVisit && (
            <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Today's care
            </p>
          )}
          {isCareVisit && tasks.length === 0 && (
            // Not a rendering nicety. The previous version of this screen made
            // up five tasks for every visit, so a client whose care had never
            // been planned looked exactly like one whose care had. Saying so
            // costs the caregiver nothing — she still charts the visit — and it
            // is the only way the office ever finds out.
            <p className="mt-2 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              There is no care plan for this visit yet, so there is no task list.
              Give the care you normally would, write it up below, and the office
              will sort the plan out.
            </p>
          )}

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

          {/* ------------------------------------------------- chart --- */}
          {draft && !confirmedChart && (
            <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your visit note
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check this over — it becomes the official record once you confirm it.
              </p>

              <dl className="mt-4 space-y-3.5">
                {chartLines(draft).map((line) => (
                  <div key={line.heading}>
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {line.heading}
                      {/* A caregiver reviewing should know which lines are
                          hers and which are a suggestion. */}
                      {line.drafted && (
                        <span className="rounded-full bg-[hsl(var(--primary-soft))] px-2 py-0.5 text-[10.5px] font-medium normal-case text-[hsl(var(--accent-foreground))]">
                          Suggested
                        </span>
                      )}
                    </dt>
                    <dd className="mt-0.5 text-base">{line.body}</dd>
                  </div>
                ))}
              </dl>

              {chartError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {chartError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button className="h-12 flex-1 rounded-2xl text-base" onClick={confirm}>
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 rounded-2xl text-base"
                  onClick={() => {
                    setDraft(null);
                    setEdited(true);
                  }}
                >
                  Change something
                </Button>
              </div>
            </div>
          )}

          {confirmedChart && (
            <p className="mt-10 flex items-center gap-2 rounded-2xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.06)] p-4 text-sm">
              <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
              Visit note confirmed. It is now the official record.
            </p>
          )}

          {/* -------------------------------------------------- moment --- */}
          {confirmedChart && !moment && !momentSkipped && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <p className="text-lg font-medium leading-snug">
                Anything you'd like the family to know about today?
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Just the warm bit — something they'd like to hear. The care record stays in
                your visit note.
              </p>

              <Textarea
                value={momentText}
                onChange={(e) => {
                  setMomentText(e.target.value);
                  setMomentError(null);
                }}
                rows={4}
                placeholder="She watched Family Feud and talked about her garden."
                className="mt-4 rounded-2xl border-border bg-surface px-4 py-3 text-base"
              />

              {momentError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {momentError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  className="h-12 flex-1 rounded-2xl text-base"
                  disabled={!momentText.trim()}
                  onClick={shareMoment}
                >
                  Share with family
                </Button>
                {/* §14 offers Skip as a real option. A caregiver who had a
                    quiet shift must not be nudged into inventing something
                    charming — that is how §15's "never invent" gets broken. */}
                <Button
                  variant="ghost"
                  className="h-12 rounded-2xl text-base"
                  onClick={() => setMomentSkipped(true)}
                >
                  Skip
                </Button>
              </div>
            </div>
          )}

          {moment && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Shared with the family 💛
              </p>
              <p className="mt-2 text-base leading-relaxed">{moment.body}</p>
            </div>
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
              onClick={() => {
                if (!ready) {
                  setShowCheck(true);
                  return;
                }
                // §12 before §11: the record is confirmed, then the shift ends.
                if (!confirmedChart) {
                  void buildChart();
                  return;
                }
                void finish(false);
              }}
            >
              {ready && !confirmedChart ? "Review your visit note" : "Clock out"}
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
