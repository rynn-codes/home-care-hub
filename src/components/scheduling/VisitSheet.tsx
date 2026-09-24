import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { AssignCaregiver } from "@/components/scheduling/AssignCaregiver";
import { ClockCorrectionCard, type ClockCorrectionInput } from "@/components/scheduling/ClockCorrectionCard";
import { JoyWarns, PILL, fmtLong, fmtTime, initialsOf } from "@/components/scheduling/joy";
import { cn } from "@/lib/utils";
import { cameFrom } from "@/lib/navigation";
import { seedEmployees } from "@/lib/employeesSeed";
import type { DemoClockAttempt, DemoUser } from "@/lib/demoStore";
import { findConflicts, hoursOf, type Visit } from "@/domain/scheduling/conflicts";
import type { CoverDecision, TimeOff } from "@/domain/scheduling/timeOff";
import { agencyWeekLabel } from "@/domain/calendar/agencyWeek";
import type { VisitStatus } from "@/domain/scheduling/visitState";
import { visitDisplayId } from "@/domain/scheduling/visitState";
import { clockInLadder, clockOutLadder, joyActivity, proposalLine, statusChips, type ClockProposal } from "@/domain/scheduling/reminders";
import { changeText, newestFirst, seriesOrigin, type VisitChange } from "@/domain/scheduling/visitChanges";
import { roleAbbreviation } from "@/domain/scheduling/visitReview";

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

/**
 * One visit, opened from the board: its status, who is on it, what Joy has
 * done about it, and every action a person can take.
 */
export function VisitSheet({
  visit,
  onClose,
  allVisits,
  today,
  transportConsent,
  clientRate,
  payRateFor,
  onAssign,
  status,
  earlyStartAllowed,
  onAuthorizeEarlyStart,
  graceMinutes,
  timeOff,
  clockLine,
  coverDecision,
  onDeclineCover,
  missingClockOut,
  missedClockIn,
  clockedInAt,
  clockedOutAt,
  clockAttempts,
  visitChanges,
  escalateAfterMinutes,
  proposal,
  onDecideProposal,
  onCorrectClockOut,
  currentUser,
  lastMovedTo,
  recurrenceLine,
  onEditVisit,
  onEditSchedule,
  onLogCall,
  onCancelVisit,
}: {
  visit: Visit | null;
  onClose: () => void;
  allVisits: readonly Visit[];
  today: string;
  transportConsent?: boolean;
  clientRate: number | null;
  payRateFor?: (name: string) => number | null;
  onAssign: (visitId: string, caregiverName: string) => void;
  status: VisitStatus;
  earlyStartAllowed: boolean;
  onAuthorizeEarlyStart: (visitId: string, allowed: boolean) => void;
  graceMinutes: number;
  timeOff: readonly TimeOff[];
  clockLine: string | null;
  coverDecision: CoverDecision | null;
  onDeclineCover: (visitId: string, confirmedWith: string, note: string) => void;
  missingClockOut: boolean;
  missedClockIn: boolean;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  clockAttempts: readonly DemoClockAttempt[];
  visitChanges: readonly VisitChange[];
  escalateAfterMinutes: number;
  proposal: ClockProposal | null;
  onDecideProposal: (key: string, approved: boolean) => void;
  onCorrectClockOut: (visitId: string, input: ClockCorrectionInput) => void;
  currentUser: DemoUser;
  lastMovedTo: string | null;
  recurrenceLine: string | null;
  onEditVisit: () => void;
  onEditSchedule?: () => void;
  onLogCall: () => void;
  onCancelVisit: () => void;
}) {
  const conflicts = useMemo(() => (visit ? findConflicts(visit, allVisits) : []), [visit, allVisits]);
  const blocking = useMemo(() => conflicts.filter((c) => c.severity === "blocking"), [conflicts]);
  const lastPing = useMemo(() => {
    if (!visit) return null;
    const pings = clockAttempts.filter((a) => a.visitId === visit.id && a.distanceMeters !== null).sort((a, b) => a.at.localeCompare(b.at));
    const last = pings[pings.length - 1];
    return last ? { at: last.at, feet: Math.round(last.distanceMeters! * 3.28084) } : null;
  }, [visit, clockAttempts]);
  const reminders = useMemo(
    () =>
      visit
        ? clockedInAt === null
          ? clockInLadder({ visit, clockedInAt: null, escalateAfterMinutes, now: new Date() })
          : clockOutLadder({ visit, clockedInAt, clockedOutAt, now: new Date() })
        : [],
    [visit, clockedInAt, clockedOutAt, escalateAfterMinutes],
  );
  const considered = useMemo(() => new Set(allVisits.map((v) => v.caregiverName).filter(Boolean)).size, [allVisits]);
  const eligible = useMemo(
    () =>
      visit
        ? [...new Set(allVisits.map((v) => v.caregiverName).filter((n): n is string => !!n))].filter(
            (name) => name !== visit.caregiverName && !allVisits.some((v) => v.caregiverName === name && v.id !== visit.id && v.startsAt < visit.endsAt && v.endsAt > visit.startsAt),
          ).length
        : 0,
    [visit, allVisits],
  );
  const role = useMemo(() => {
    if (!visit?.caregiverName) return null;
    const e = seedEmployees.find((x) => x.name === visit.caregiverName);
    return e ? roleAbbreviation(e.title) : null;
  }, [visit?.caregiverName]);
  const chips = useMemo(() => (visit ? statusChips({ visit, clockedInAt, clockedOutAt, conflicts, joyWorking: conflicts.length > 0 || visit.caregiverName === null, now: new Date() }) : []), [visit, clockedInAt, clockedOutAt, conflicts]);
  const activity = useMemo(() => (visit ? joyActivity({ visit, conflicts, considered, eligible, clockedInAt, clockedOutAt, reminders, now: new Date() }) : []), [visit, conflicts, considered, eligible, clockedInAt, clockedOutAt, reminders]);
  const feed = useMemo(() => {
    if (!visit) return [];
    const origin = seriesOrigin(visit);
    const changes = newestFirst([...visitChanges.filter((c) => c.visitId === visit.id), ...(origin ? [origin] : [])]).map((c, i) => ({ at: c.at, text: changeText(c, fmtTime), lead: i === 0 && c.kind !== "scheduled", timed: false }));
    return [...activity.map((a) => ({ ...a, lead: !!a.lead, timed: !!a.timed })), ...changes];
  }, [visit, visitChanges, activity]);
  const [reassigning, setReassigning] = useState(false);
  useEffect(() => {
    if (!visit) setReassigning(false);
  }, [visit]);
  const [declining, setDeclining] = useState(false);
  const [confirmedWith, setConfirmedWith] = useState("");
  const [declineNote, setDeclineNote] = useState("");

  return (
    <Sheet open={visit !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[452px]">
        {visit && (
          <>
            <SheetHeader className="space-y-1 text-left">
              {status !== "complete" && (
                <span className={cn("self-start", status === "open" ? PILL.open : status === "conflict" ? PILL.conflict : status === "no_clock_out" || status === "missed_in" ? PILL.exception : PILL.confirmed)}>
                  {status === "open" ? (visit.coverFor ? "NEEDS COVER" : "OPEN SHIFT") : status === "conflict" ? "CONFLICT" : status === "no_clock_out" ? "NO CLOCK-OUT" : status === "missed_in" ? "NO CLOCK-IN" : "CONFIRMED"}
                </span>
              )}
              <SheetTitle className="text-[17px] font-semibold tracking-[-.01em]">{visit.clientName}</SheetTitle>
              <SheetDescription className="text-[12.5px]">
                {visit.service} · {fmtLong(new Date(visit.startsAt))} · {fmtTime(visit.startsAt)} – {fmtTime(visit.endsAt)}
              </SheetDescription>
              <span className="block pt-0.5 text-[11px] tabular-nums text-muted-foreground">Visit ID {visitDisplayId(visit.id)}</span>
            </SheetHeader>

            {chips.length > 0 && (
              <div className="mt-5 flex flex-col gap-1.5">
                <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Operational status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c.key}
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        c.tone === "good" && "bg-[#ECFDF3] text-[#027A48]",
                        c.tone === "warn" && "bg-[#FFFAEB] text-[#B54708]",
                        c.tone === "bad" && "bg-[#FEF3F2] text-[#B42318]",
                        c.tone === "info" && "bg-[#EEF0FE] text-primary",
                        c.tone === "muted" && "bg-[var(--wash-strong)] text-[var(--ink-body)]",
                      )}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {conflicts.length > 0 && (
              <JoyWarns className="mt-4" title={conflicts.some((c) => c.severity === "blocking") ? "Why this conflicts" : "Worth knowing"}>
                {conflicts.map((c, i) => (
                  <p key={i} className="m-0 first:mt-0 [&+p]:mt-1">
                    {c.message}
                  </p>
                ))}
              </JoyWarns>
            )}

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3.5 py-3">
              {visit.caregiverName ? (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">{initialsOf(visit.caregiverName)}</span>
              ) : (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dashed border-[#C9C9D0] text-[13px] text-muted-foreground/60">?</span>
              )}
              <span className="flex flex-col leading-[1.3]">
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Assigned</span>
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className={cn("text-[13.5px] font-medium", !visit.caregiverName && "text-primary")}>{visit.caregiverName ?? (visit.coverFor ? `${visit.coverFor} is off` : "Unassigned")}</span>
                  {role && <span className="rounded-full bg-[var(--wash-strong)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[var(--ink-body)]">{role}</span>}
                </span>
              </span>
              <span className={cn("ml-auto flex-none", status === "complete" && clockLine ? "text-[13px] font-semibold tabular-nums tracking-[-.01em] text-[#027A48]" : "text-xs text-muted-foreground")}>
                {status === "open"
                  ? "Needs coverage"
                  : status === "conflict"
                    ? "Double-booked"
                    : status === "no_clock_out"
                      ? "Never clocked out"
                      : status === "missed_in"
                        ? "Never clocked in"
                        : (status === "complete" || status === "on_shift") && clockLine
                          ? clockLine
                          : "Confirmed"}
              </span>
            </div>

            {proposal && proposal.status === "awaiting_office" && (
              <div className="mt-4 flex flex-col gap-2.5 rounded-[11px] border border-[#D9DCF5] bg-[#F4F5FE] px-3.5 py-3">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.085em] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Waiting on you
                </span>
                <p className="m-0 text-[13px] leading-[1.5] text-[var(--ink)] [text-wrap:pretty]">{proposalLine(proposal, fmtTime)}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onDecideProposal(`${visit.id}:${proposal.which}`, true)} className="h-[34px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                    Approve {fmtTime(proposal.confirmedAt)}
                  </button>
                  <button type="button" onClick={() => onDecideProposal(`${visit.id}:${proposal.which}`, false)} className="h-[34px] rounded-[9px] border border-[var(--hairline)] px-3.5 text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
                    Not approved — record it myself
                  </button>
                </div>
              </div>
            )}

            {(missingClockOut || missedClockIn) && proposal?.status !== "awaiting_office" && (
              <ClockCorrectionCard
                visit={visit}
                clockedInAt={clockedInAt}
                by={currentUser.name}
                role={role}
                lastPing={lastPing}
                addressName={`${visit.clientName}'s home`}
                payrollWeek={agencyWeekLabel(visit.startsAt)}
                escalateAfterMinutes={escalateAfterMinutes}
                onRecord={(input) => {
                  const endDay = visit.endsAt.slice(0, 10);
                  const startDay = visit.startsAt.slice(0, 10);
                  onCorrectClockOut(visit.id, { ...input, clockedInAt: input.clockedInAt ? `${startDay}T${input.clockedInAt}:00` : null, clockedOutAt: `${endDay}T${input.clockedOutAt}:00` });
                  onClose();
                }}
              />
            )}

            <div className="mt-5 flex flex-col gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Details</h3>
              <div className="flex flex-col">
                {(
                  [
                    ["Client", visit.clientName, ""],
                    ["Service", visit.eventType === "rn_assessment" ? "RN assessment" : visit.service, ""],
                    ["Date", fmtLong(new Date(visit.startsAt)), ""],
                    ["Time", `${fmtTime(visit.startsAt)} – ${fmtTime(visit.endsAt)} · ${hoursOf(visit).toFixed(1).replace(/\.0$/, "")} hrs`, ""],
                    ["Recurrence", recurrenceLine ?? "One-time visit", ""],
                    [
                      "Conflict check",
                      blocking.length > 0 ? `${blocking.length} ${blocking.length === 1 ? "conflict" : "conflicts"} — see above` : conflicts.length > 0 ? `No conflicts · ${conflicts.length} ${conflicts.length === 1 ? "warning" : "warnings"}` : "No conflicts found",
                      blocking.length > 0 ? "text-[#98322C]" : conflicts.length > 0 ? "text-[#B54708]" : "text-[#027A48]",
                    ],
                    ["Scheduling notes", "—", "text-muted-foreground"],
                    ["Last change", lastMovedTo === null ? "No changes since scheduled" : `Moved to ${fmtLong(new Date(lastMovedTo))}`, lastMovedTo === null ? "text-muted-foreground" : ""],
                  ] as Array<[string, string, string]>
                ).map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2">
                    <span className="w-[132px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
                    <span className={cn("min-w-0 text-[13px] [text-wrap:pretty]", tone)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Edit visit", onClick: onEditVisit },
                  ...(onEditSchedule ? [{ label: "Edit schedule", onClick: onEditSchedule }] : []),
                  ...(visit.caregiverName !== null && visit.eventType !== "rn_assessment" ? [{ label: reassigning ? "Cancel reassign" : "Reassign", onClick: () => setReassigning((r) => !r) }] : []),
                  { label: "Log a call", onClick: onLogCall },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
                  >
                    {a.label}
                  </button>
                ))}
                {visit.clientPersonId && (
                  <Link
                    to={`/clients/${visit.clientPersonId}?tab=Schedule`}
                    state={cameFrom({ label: "Scheduling", to: "/scheduling" })}
                    className="flex h-[34px] items-center rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
                  >
                    Open client
                  </Link>
                )}
                <button type="button" onClick={onCancelVisit} className="h-[34px] rounded-[9px] border border-[#F7D2CE] bg-[var(--paper)] px-3.5 text-[13px] text-[#B42318] transition-colors hover:bg-[#FEF3F2]">
                  Cancel visit
                </button>
              </div>
            </div>

            {reassigning && visit.caregiverName !== null && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="m-0 text-[12.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
                  Replacing {visit.caregiverName} on this visit. Picking somebody takes the shift off her and puts it on them; the family is not told, because Joy cannot tell them yet.
                </p>
                <AssignCaregiver
                  visit={{ ...visit, caregiverName: null }}
                  allVisits={allVisits}
                  today={today}
                  clientAgreedToTransport={transportConsent}
                  timeOff={timeOff}
                  clientRate={clientRate}
                  payRateFor={payRateFor}
                  onAssign={(name) => {
                    onAssign(visit.id, name);
                    setReassigning(false);
                    onClose();
                  }}
                />
              </div>
            )}
            {visit.caregiverName === null && visit.eventType !== "rn_assessment" && (
              <AssignCaregiver
                visit={visit}
                allVisits={allVisits}
                today={today}
                clientAgreedToTransport={transportConsent}
                timeOff={timeOff}
                clientRate={clientRate}
                payRateFor={payRateFor}
                onAssign={(name) => {
                  onAssign(visit.id, name);
                  onClose();
                }}
              />
            )}
            {visit.caregiverName === null && visit.coverFor && (
              <div className="mt-4 border-t border-[var(--hairline)] pt-4">
                {coverDecision ? (
                  <div className="flex flex-col gap-1 rounded-[11px] border border-[#C7EED8] bg-[#ECFDF3] px-3.5 py-3">
                    <span className="text-[12.5px] font-semibold text-[#027A48]">No replacement — {coverDecision.confirmedWith} confirmed</span>
                    <span className="text-[11.5px] text-[#027A48]">
                      Recorded by {coverDecision.recordedBy} on {fmtLong(new Date(coverDecision.recordedAt))}
                      {coverDecision.note ? ` · ${coverDecision.note}` : ""}
                    </span>
                  </div>
                ) : declining ? (
                  <div className="flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Who confirmed it</span>
                      <input
                        id="decline-cover-who"
                        value={confirmedWith}
                        onChange={(e) => setConfirmedWith(e.target.value)}
                        placeholder="Name of the client or family member"
                        className="h-[36px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                        Note <span className="font-normal normal-case tracking-normal">(optional)</span>
                      </span>
                      <input
                        id="decline-cover-note"
                        value={declineNote}
                        onChange={(e) => setDeclineNote(e.target.value)}
                        placeholder="Daughter staying that day"
                        className="h-[36px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={confirmedWith.trim() === ""}
                        onClick={() => {
                          onDeclineCover(visit.id, confirmedWith, declineNote);
                          setDeclining(false);
                          setConfirmedWith("");
                          setDeclineNote("");
                          onClose();
                        }}
                        className={cn("h-[36px] flex-1 rounded-[9px] px-3.5 text-[13px] font-medium transition-colors", confirmedWith.trim() === "" ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]")}
                      >
                        {confirmedWith.trim() === "" ? "Name who confirmed it first" : `Record that ${confirmedWith.trim()} declined cover`}
                      </button>
                      <button type="button" onClick={() => setDeclining(false)} className="h-[36px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeclining(true)} className="h-[36px] w-full rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                    The family doesn't want a replacement
                  </button>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Joy activity</h3>
              {feed.length === 0 ? (
                <span className="text-[12.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">Nothing needed — this visit is assigned and has not started.</span>
              ) : (
                <div className="flex flex-col">
                  {feed.map((line, i) => (
                    <span key={`${line.text}-${i}`} className="flex items-start gap-2.5 border-b border-[var(--hairline-soft)] py-2 last:border-b-0">
                      <span className="w-[52px] flex-none pt-[1px] text-[12px] text-muted-foreground">{line.at ? shortDate(line.at) : ""}</span>
                      <span className={cn("mt-[6px] h-1.5 w-1.5 flex-none rounded-full", line.lead ? "bg-primary" : "bg-[var(--hairline)]")} aria-hidden="true" />
                      <span className={cn("min-w-0 text-[12.5px] leading-[1.45] [text-wrap:pretty]", line.lead ? "font-medium" : "text-[var(--ink-body)]")}>
                        {line.text}
                        {line.timed && <span className="ml-1.5 tabular-nums text-muted-foreground">{fmtTime(line.at)}</span>}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {visit.caregiverName !== null && visit.eventType !== "rn_assessment" && (
              <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-[var(--hairline)] px-3.5 py-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-medium">Allow an early start</span>
                  <span className="text-[12px] leading-[1.45] text-muted-foreground">
                    {earlyStartAllowed ? `${visit.caregiverName} is paid from the moment she clocks in on this visit.` : `Clocking in more than ${graceMinutes} minutes early counts from ${graceMinutes} minutes before the shift.`}
                  </span>
                </span>
                <Switch checked={earlyStartAllowed} onCheckedChange={(on) => onAuthorizeEarlyStart(visit.id, on)} aria-label="Allow an early start on this visit" className="mt-0.5 flex-none" />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
