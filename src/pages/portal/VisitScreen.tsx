import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedCarePlans } from "@/lib/carePlanSeed";
import { seedClients } from "@/lib/clientsSeed";
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
import { shortShiftCheck, shortShiftWarning } from "@/domain/portal/shortShift";
import { earlyClockIn, minutesLabel, type EarlyClockIn } from "@/domain/scheduling/earlyClockIn";
import { isOutOfRange, locationCheck, worthTellingOffice, type DevicePoint, type LocationCheck } from "@/domain/scheduling/clockLocation";
import { suggestClockIn } from "@/domain/scheduling/reminders";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { cn } from "@/lib/utils";

/**
 * Start visit, chart it, clock out — §10 and §11.
 *
 * The screen holds no clock of its own. Every state change goes through
 * `domain/portal/visit.ts`, which takes the time as an argument, because §10
 * keeps the server authoritative for official timestamps and a phone's clock
 * has no business in a timesheet.
 *
 * Three things happen around the tap, and all three are said out loud:
 * where the phone is against the client's address, whether the tap came
 * before the shift and when the paid time therefore starts, and — if Joy saw
 * the phone arrive earlier — whether the shift really started then.
 *
 * `serverNow` here stands in for the server's timestamp. It is the one place
 * a real implementation changes, and it is deliberately a function rather
 * than an inline `new Date()` so the substitution is obvious.
 */

/** Stand-in for the server's timestamp. The developer replaces this. */
async function serverNow(): Promise<string> {
  await new Promise((r) => setTimeout(r, 350));
  return new Date().toISOString();
}

/** The phone's position, or null when it cannot say. Never throws. */
async function deviceLocation(): Promise<DevicePoint | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 30_000 },
    );
  });
}

const OUTCOMES: TaskOutcome[] = ["done", "declined", "not_needed"];

/** An early tap further out than this is not a clock-in question yet. */
const EARLY_NOTICE_MINUTES = 60;

/**
 * No model is connected, so this drafts from what the caregiver recorded and
 * quotes her own words. It produces a complete, confirmable chart — see
 * `VerbatimChartDraftingService`.
 */
const drafting = new VerbatimChartDraftingService();

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
        ? tasksForVisit({ plans: seedCarePlans, clientPersonId: visit.clientPersonId, service: visit.service, date: visit.startsAt.slice(0, 10) })
        : [],
    [visit],
  );

  const { grant } = usePortalSession();
  const { earlyStarts, recordClockAttempt, recordClock, clockAttempts, clockProposals, proposeClock } = useDemo();
  const agency = useAgencySettings();
  const [early, setEarly] = useState<EarlyClockIn | null>(null);
  const [location, setLocation] = useState<LocationCheck | null>(null);
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
  const [ownStart, setOwnStart] = useState("");
  const now = new Date();

  const proposal = visit ? (clockProposals[`${visit.id}:in`] ?? null) : null;

  // Joy saw the phone arrive: the earliest clock attempt with a distance on
  // it, once the shift was due. The caregiver confirms or corrects it, and the
  // office approves before it touches pay.
  const arrival = useMemo(() => {
    if (!visit || Date.now() < new Date(visit.startsAt).getTime()) return null;
    const first = clockAttempts
      .filter((a) => a.visitId === visit.id && a.distanceMeters !== null)
      .sort((a, b) => a.at.localeCompare(b.at))[0];
    return first
      ? suggestClockIn({ scheduledStartsAt: visit.startsAt, arrival: { at: first.at, feet: Math.round((first.distanceMeters as number) * 3.28084) }, atAddressName: `${visit.clientName}'s home` })
      : null;
  }, [visit, clockAttempts]);

  const shortWarning = useMemo(() => {
    if (!visit || record.clock.state !== "clocked_in") return null;
    const clockedInAt = record.clock.clockedInAt ?? null;
    return clockedInAt
      ? shortShiftWarning({ check: shortShiftCheck({ scheduledStartsAt: visit.startsAt, scheduledEndsAt: visit.endsAt, clockedInAt, at: new Date(now).toISOString() }), fmt: clock })
      : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, record.clock.state, record.clock.clockedInAt, now]);

  if (!visit) {
    return (
      <PortalFrame>
        <h1 className="font-display text-2xl font-bold tracking-tight">Visit not found</h1>
        <p className="mt-3 text-base text-muted-foreground">This visit is not on your schedule. Call the office on (713) 231-9662.</p>
      </PortalFrame>
    );
  }

  const isCareVisit = !visit.eventType;
  const check = completionCheck(record, tasks);
  const ready = canClockOut(record, tasks);

  /**
   * Where the phone is. A clear miss is told to the office; whether it also
   * refuses the clock is the agency's setting. Returns the check when the
   * clock was refused, null when it may go ahead.
   */
  async function checkLocation(action: "in" | "out"): Promise<LocationCheck | null> {
    if (!visit) return null;
    const client = seedClients.find((c) => c.personId === visit.clientPersonId);
    const result = locationCheck({
      clientAt: client?.coordinates ?? null,
      deviceAt: await deviceLocation(),
      radiusMeters: agency.geofenceMeters,
      caregiverName: grant?.greetingName ?? visit.caregiverName ?? undefined,
      clientName: visit.clientName,
      action,
    });
    setLocation(result);
    const refused = isOutOfRange(result) && agency.switches.reject_out_of_range === true;
    if (worthTellingOffice(result)) {
      recordClockAttempt({
        id: `attempt-${visit.id}-${Date.now()}`,
        visitId: visit.id,
        clientName: visit.clientName,
        caregiverName: grant?.greetingName ?? visit.caregiverName ?? "A caregiver",
        action,
        at: new Date().toISOString(),
        distanceMeters: result.distanceMeters,
        accuracyMeters: result.accuracyMeters,
        verdict: result.verdict,
        refused,
        officeLine: result.officeLine,
      });
    }
    return refused ? result : null;
  }

  async function startVisit() {
    setBusy(true);
    setRecord((r) => requestClockIn(r));
    try {
      if (await checkLocation("in")) {
        setRecord((r) => failClockIn(r));
        return;
      }
      const at = await serverNow();
      const verdict = visit
        ? earlyClockIn({ scheduledStart: visit.startsAt, tappedAt: at, graceMinutes: agency.earlyClockInGraceMinutes, authorizedEarly: earlyStarts[visit.id] === true })
        : undefined;
      setEarly(verdict ?? null);
      setRecord((r) => confirmClockIn(r, at, verdict));
      recordClock(visit!.id, "in", at);
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
      setDraft(await drafting.draft({ record, tasks, visitId: id ?? "" }));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!draft) return;
    try {
      setConfirmedChart(confirmChart({ draft, personId: grant?.personId ?? null, at: new Date().toISOString(), edited }));
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
   */
  function shareMoment() {
    try {
      const drafted = draftMoment({ id: `moment-${id}`, visitId: id ?? "", clientPersonId: visit?.clientName ?? "", narrative: momentText, byPersonId: grant?.personId ?? null, at: new Date().toISOString() });
      const shared = approveMoment({ moment: drafted, approver: { personId: grant?.personId ?? "", isOffice: false }, disclosureConsent: "agree", at: new Date().toISOString() });
      setMoment(shared);
      setMomentError(null);
    } catch (e) {
      setMomentError(e instanceof Error ? e.message : "This could not be shared.");
    }
  }

  async function finish(withException: boolean) {
    setBusy(true);
    try {
      if (await checkLocation("out")) return;
      const at = await serverNow();
      setRecord((r) => (withException ? clockOutWithException(r, tasks, at) : clockOut(r, at)));
      if (visit) recordClock(visit.id, "out", at);
    } finally {
      setBusy(false);
    }
  }

  const state = record.clock.state;

  function confirmStart(confirmedAt: string, tookSuggestion: boolean) {
    if (!visit || !arrival) return;
    proposeClock({
      visitId: visit.id,
      which: "in",
      suggestedAt: arrival.at,
      confirmedAt,
      tookSuggestion,
      confirmedBy: grant?.greetingName ?? visit.caregiverName ?? "The caregiver",
      status: "awaiting_office",
    });
    setOwnStart("");
  }

  // Before the tap: what an early clock-in would mean, said in advance.
  const preview =
    visit && state === "not_started"
      ? earlyClockIn({ scheduledStart: visit.startsAt, tappedAt: now.toISOString(), graceMinutes: agency.earlyClockInGraceMinutes, authorizedEarly: earlyStarts[visit.id] === true })
      : null;
  const earlyNotice = preview && preview.earlyByMinutes <= EARLY_NOTICE_MINUTES ? preview : null;

  return (
    <PortalFrame>
      <button type="button" onClick={() => navigate("/portal/work")} className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">{visit.clientName}</h1>
      <p className="mt-2 text-base text-muted-foreground">{visit.service}</p>
      <p className="text-base text-muted-foreground">{timeRange(visit)}</p>

      {location && isOutOfRange(location) && agency.switches.reject_out_of_range && (
        <p role="alert" className="mt-6 rounded-2xl border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.06)] p-4 text-sm leading-[1.55]">
          {location.message} You need to be at the address to clock {state === "clocked_in" ? "out" : "in"}. The office has been told.
        </p>
      )}

      {(state === "not_started" || state === "requested") && earlyNotice?.verdict === "held" && (
        <p className="mt-6 rounded-2xl border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.07)] p-4 text-sm leading-[1.55]">
          You're {minutesLabel(earlyNotice.earlyByMinutes)} early. You can clock in now — your time would start at {clock(earlyNotice.countsFrom)}.
        </p>
      )}

      {state === "not_started" && arrival && !proposal && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#D9DCF5] bg-[#F4F5FE] p-4">
          <span className="text-sm font-semibold">Did your shift start at {clock(arrival.at)}?</span>
          <p className="m-0 text-sm leading-[1.5] text-muted-foreground [text-wrap:pretty]">That is {arrival.because}</p>
          <div className="flex flex-col gap-2">
            <Button className="h-12 w-full rounded-xl text-[15px]" onClick={() => confirmStart(arrival.at, true)}>
              Yes — start me at {clock(arrival.at)}
            </Button>
            <div className="flex items-center gap-2">
              <input type="time" aria-label="The time you actually started" value={ownStart} onChange={(e) => setOwnStart(e.target.value)} className="h-12 flex-1 rounded-xl border border-input bg-background px-3 text-[15px]" />
              <Button variant="outline" className="h-12 rounded-xl text-[15px]" disabled={ownStart === ""} onClick={() => confirmStart(`${visit.startsAt.slice(0, 10)}T${ownStart}:00`, false)}>
                Use this instead
              </Button>
            </div>
          </div>
          <p className="m-0 text-xs leading-[1.45] text-muted-foreground">Whichever you pick goes to the office to approve before it reaches your pay.</p>
        </div>
      )}

      {proposal && proposal.status === "awaiting_office" && (
        <div className="mt-6 rounded-2xl border border-[#FCE8B6] bg-[#FFFAEB] p-4">
          <p className="m-0 text-sm font-medium text-[#B54708]">Sent to the office · {clock(proposal.confirmedAt)}</p>
          <p className="m-0 mt-0.5 text-sm text-[#B54708]">They will approve it before it reaches your pay.</p>
        </div>
      )}

      {/* ------------------------------------------------- not started --- */}
      {state === "not_started" || state === "requested" ? (
        <Button className="mt-8 h-14 w-full rounded-2xl text-base" disabled={busy} onClick={startVisit}>
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
            <p className="text-sm font-medium">Visit in progress · clocked in {clock(record.clock.clockedInAt!)}</p>
            {elapsed(record.clock, now) && <p className="mt-0.5 text-sm text-muted-foreground">{elapsed(record.clock, now)} so far</p>}
            {record.clock.heldMinutes > 0 && record.clock.countsFrom && (
              <p className="mt-2 border-t border-[hsl(var(--success)/0.25)] pt-2 text-sm leading-[1.5] text-muted-foreground">
                Your time counts from {clock(record.clock.countsFrom)}, {agency.earlyClockInGraceMinutes} minutes before the shift.
              </p>
            )}
            {early?.verdict === "authorized_early" && (
              <p className="mt-2 border-t border-[hsl(var(--success)/0.25)] pt-2 text-sm leading-[1.5] text-muted-foreground">The office authorized an early start, so your time counts from when you clocked in.</p>
            )}
          </div>

          {/* A field orientation or an RN assessment is not care delivered to a
              client, so it has no plan and no task list. */}
          {isCareVisit && <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today's care</p>}
          {isCareVisit && tasks.length === 0 && (
            <p className="mt-2 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              There is no care plan for this visit yet, so there is no task list. Give the care you normally would, write it up below, and the office will sort the plan out.
            </p>
          )}

          <ul className="mt-2 space-y-3">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-base font-medium">
                  {task.label}
                  {!task.required && <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {OUTCOMES.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => setRecord((r) => ({ ...r, tasks: { ...r.tasks, [task.id]: outcome } }))}
                      className={cn(
                        "min-h-11 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                        record.tasks[task.id] === outcome ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]" : "border-border hover:bg-surface-muted",
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
          <Textarea value={record.note} onChange={(e) => setRecord((r) => ({ ...r, note: e.target.value }))} rows={5} placeholder="A few sentences is plenty." className="mt-3 rounded-2xl border-border bg-surface px-4 py-3 text-base" />

          <p className="mt-8 text-lg font-medium">Was there an incident or a fall?</p>
          <div className="mt-3 flex gap-2">
            {[
              { value: false, label: "No" },
              { value: true, label: "Yes" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setRecord((r) => ({ ...r, incidentAnswered: true, incidentOccurred: option.value }))}
                className={cn(
                  "min-h-12 flex-1 rounded-2xl border px-4 text-base transition-colors",
                  record.incidentAnswered && record.incidentOccurred === option.value ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]" : "border-border hover:bg-surface-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {record.incidentAnswered && record.incidentOccurred && (
            <Textarea value={record.incidentDetail} onChange={(e) => setRecord((r) => ({ ...r, incidentDetail: e.target.value }))} rows={4} placeholder="What happened, in your own words." className="mt-3 rounded-2xl border-border bg-surface px-4 py-3 text-base" />
          )}

          {/* ------------------------------------------------- chart --- */}
          {draft && !confirmedChart && (
            <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your visit note</p>
              <p className="mt-1 text-sm text-muted-foreground">Check this over — it becomes the official record once you confirm it.</p>
              <dl className="mt-4 space-y-3.5">
                {chartLines(draft).map((line) => (
                  <div key={line.heading}>
                    <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {line.heading}
                      {line.drafted && <span className="rounded-full bg-[hsl(var(--primary-soft))] px-2 py-0.5 text-[10.5px] font-medium normal-case text-[hsl(var(--accent-foreground))]">Suggested</span>}
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
              <p className="text-lg font-medium leading-snug">Anything you'd like the family to know about today?</p>
              <p className="mt-2 text-sm text-muted-foreground">Just the warm bit — something they'd like to hear. The care record stays in your visit note.</p>
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
                <Button className="h-12 flex-1 rounded-2xl text-base" disabled={!momentText.trim()} onClick={shareMoment}>
                  Share with family
                </Button>
                {/* §14 offers Skip as a real option. A caregiver who had a
                    quiet shift must not be nudged into inventing something. */}
                <Button variant="ghost" className="h-12 rounded-2xl text-base" onClick={() => setMomentSkipped(true)}>
                  Skip
                </Button>
              </div>
            </div>
          )}

          {moment && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared with the family 💛</p>
              <p className="mt-2 text-base leading-relaxed">{moment.body}</p>
            </div>
          )}

          {/* --------------------------------------------- clock out --- */}
          <div className="mt-10 border-t border-border pt-6">
            {showCheck && (
              <ul className="mb-5 space-y-2">
                {check.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    <span className={cn("font-semibold", item.complete ? "text-[hsl(var(--success))]" : "text-destructive")}>{item.complete ? "✓" : "✗"}</span>
                    <span className={cn(!item.complete && "text-muted-foreground")}>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mb-4 text-sm text-muted-foreground">{completionMessage(check)}</p>

            {shortWarning && (
              <div className="mb-4 flex flex-col gap-1.5 rounded-2xl border border-[#FCE8B6] bg-[#FFFAEB] px-4 py-3">
                <span className="text-sm font-semibold text-[#B54708]">Not quite the full shift</span>
                <p className="m-0 text-sm leading-[1.5] text-[#B54708] [text-wrap:pretty]">{shortWarning}</p>
              </div>
            )}

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
                {/* §11 stops short of trapping somebody on the clock. */}
                <button type="button" disabled={busy} onClick={() => finish(true)} className="mt-4 w-full text-center text-sm text-muted-foreground underline underline-offset-4">
                  I can't finish this now — clock me out anyway
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">The office will be told what's outstanding.</p>
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
          <h2 className="mt-6 font-display text-xl font-bold tracking-tight">Visit complete — {elapsed(record.clock, now)}</h2>
          {record.clock.exceptionReason && <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">The office has been told what was outstanding.</p>}
          <Button variant="ghost" className="mt-6 h-12" onClick={() => navigate("/portal/work")}>
            Back to your day
          </Button>
        </div>
      )}
    </PortalFrame>
  );
}
