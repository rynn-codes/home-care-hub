import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { useScheduleBoard } from "@/hooks/use-schedule-board";
import { seedEmployees } from "@/lib/employeesSeed";
import { clientRateFor } from "@/lib/clientRates";
import { RecordSectionLabel } from "@/components/records/RecordHeader";
import { ScheduleEditDialog } from "@/components/scheduling/ScheduleEditDialog";
import { AgreementDialog } from "@/components/scheduling/AgreementDialog";
import { agreementMessage, agreementState, currentSchedule, dateOnlyOf, describeSchedule, scheduleHistory } from "@/domain/scheduling/clientSchedule";
import { TONE_CLASSES, VISIT_STATUS_LABELS, VISIT_STATUS_TONES, visitStatus, type VisitStatus } from "@/domain/scheduling/visitState";
import type { ClientRecord } from "@/domain/clients/roster";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
const LEGEND: Array<[VisitStatus, string]> = [
  ["complete", "bg-[#12B76A]"],
  ["upcoming", "bg-primary"],
  ["open", "bg-[#F79009]"],
  ["missed_in", "bg-[#D92D20]"],
];

/**
 * The service agreement card on a client's profile: the schedule the
 * signed agreement describes, whether what is delivered still matches it,
 * and Joy's drafted amendment when it does not.
 */
export function ClientAgreementCard({ client, className }: { client: ClientRecord; className?: string }) {
  const { clientSchedules, households } = useDemo();
  const [open, setOpen] = useState(false);
  const state = useMemo(() => agreementState({ schedules: clientSchedules, clientPersonId: client.personId, now: new Date() }), [clientSchedules, client.personId]);
  const rate = useMemo(() => clientRateFor({ clientPersonId: client.personId, households, on: new Date().toISOString() }), [client.personId, households]);
  if (!state.current) return null;
  const settled = state.state === "settled";
  return (
    <section className={cn("flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]", className)}>
      <div className="flex flex-wrap items-baseline gap-3">
        <RecordSectionLabel>Service agreement</RecordSectionLabel>
        <button type="button" onClick={() => setOpen(true)} className="ml-auto h-8 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] transition-colors hover:bg-[var(--wash)]">
          {settled ? "View or edit" : "Review the amendment"}
        </button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[14px] font-medium">{describeSchedule(state.current)}</span>
        <span className="text-[12.5px] text-muted-foreground">{rate === null ? "No rate on file" : `$${rate.toFixed(2)} / hr`}</span>
      </div>
      <span className={cn("text-[12.5px] leading-[1.45] [text-wrap:pretty]", settled ? "text-[#027A48]" : "text-[#B54708]")}>{agreementMessage(state)}</span>
      {!settled && <span className="text-[12px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">Scheduling carries on as normal. The signed agreement stays in force until this one replaces it.</span>}
      <AgreementDialog open={open} onOpenChange={setOpen} schedule={state.current} previous={state.lastAgreed} hourlyRate={rate} />
    </section>
  );
}

/** The client's recurring schedule, its history and agreement, and a month of their visits off the one board. */
export function ClientScheduleTab({ clientName, personId }: { clientName: string; personId: string }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const { clientSchedules, reviseSchedule, households, currentUser } = useDemo();
  const settings = useAgencySettings();
  const { visits: board, clockFor } = useScheduleBoard();
  const history = useMemo(() => scheduleHistory(clientSchedules, personId), [clientSchedules, personId]);
  const current = useMemo(() => currentSchedule(clientSchedules, personId, new Date()), [clientSchedules, personId]);
  const upcoming = useMemo(() => {
    const today = dateOnlyOf(new Date());
    return history.filter((s) => s.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
  }, [history]);
  const agreement = useMemo(() => agreementState({ schedules: clientSchedules, clientPersonId: personId, now: new Date() }), [clientSchedules, personId]);
  const rate = useMemo(() => clientRateFor({ clientPersonId: personId, households, on: new Date().toISOString() }), [personId, households]);
  const caregivers = useMemo(() => seedEmployees.filter((e) => e.role !== "office" && e.status === "active").map((e) => e.name), []);
  const visits = useMemo(() => board.filter((v) => v.clientName === clientName), [board, clientName]);
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return { date, inMonth: date.getMonth() === cursor.getMonth(), visits: visits.filter((v) => new Date(v.startsAt).toDateString() === date.toDateString()) };
    });
  }, [cursor, visits]);
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = dateOnlyOf(new Date());

  return (
    <div className="flex flex-col gap-4">
      {current && (
        <section className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Recurring schedule</h2>
            <button type="button" onClick={() => setEditing(true)} className="ml-auto h-8 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] transition-colors hover:bg-[var(--wash)]">
              Edit schedule
            </button>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[15px] font-semibold tracking-[-.01em]">{describeSchedule(current)}</span>
            <span className="text-[12.5px] text-muted-foreground">
              {current.caregiverName ?? "Cover each week"} · since {fmtDate(`${current.startsOn}T12:00:00`)}
            </span>
          </div>
          {upcoming && (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-[11px] border border-[#DDE1FA] bg-[#F7F8FE] px-3.5 py-2.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.085em] text-primary">From {fmtDate(`${upcoming.startsOn}T12:00:00`)}</span>
              <span className="text-[12.5px] font-medium">{describeSchedule(upcoming)}</span>
              <span className="text-[12px] text-muted-foreground">
                {upcoming.caregiverName ?? "Cover each week"}
                {upcoming.reason ? ` · ${upcoming.reason}` : ""}
              </span>
            </div>
          )}
          {agreement.state !== "settled" && (
            <div className={cn("flex flex-col gap-1 rounded-[11px] border px-3.5 py-3", agreement.state === "needs_agreement" ? "border-[#F4D7D5] bg-[#FDF3F3]" : "border-[#F5DFB8] bg-[#FEF8EC]")}>
              <span className={cn("text-[10.5px] font-semibold uppercase tracking-[.085em]", agreement.state === "needs_agreement" ? "text-[#B4443C]" : "text-[#B54708]")}>
                {agreement.state === "needs_agreement" ? "An updated agreement is needed" : "Recently changed"}
              </span>
              <span className={cn("text-[12.5px] leading-[1.45] [text-wrap:pretty]", agreement.state === "needs_agreement" ? "text-[#98322C]" : "text-[#93370D]")}>{agreementMessage(agreement)}</span>
              {agreement.state === "needs_agreement" && (
                <button type="button" onClick={() => setReviewing(true)} className="mt-1 h-8 self-start rounded-lg bg-primary px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  Review Joy's draft
                </button>
              )}
            </div>
          )}
          {history.length > 1 && (
            <div className="flex flex-col">
              <span className="pb-1 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">History</span>
              {history.map((s) => (
                <div key={s.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                  <span className="text-[12.5px]">{describeSchedule(s)}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {s.startsOn > today ? `from ${fmtDate(`${s.startsOn}T12:00:00`)}` : `${fmtDate(`${s.startsOn}T12:00:00`)} – ${s.endsOn ? fmtDate(`${s.endsOn}T12:00:00`) : "now"}`}
                  </span>
                  <span className="ml-auto text-[11.5px] text-muted-foreground">
                    {s.setBy}
                    {s.reason ? ` · ${s.reason}` : ""}
                    {s.agreementSignedAt ? " · signed" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <ScheduleEditDialog open={editing} onOpenChange={setEditing} schedule={current} visits={board} caregivers={caregivers} hourlyRate={rate} currentUserName={currentUser.name} onRevise={reviseSchedule} />
      <AgreementDialog open={reviewing} onOpenChange={setReviewing} schedule={agreement.current} previous={agreement.lastAgreed} hourlyRate={rate} />
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
        <div className="flex flex-wrap items-center gap-3 pb-3.5">
          <span className="text-[15px] font-semibold tracking-[-.01em]">{cursor.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
          <span className="ml-auto flex flex-wrap items-center gap-3.5 text-[12.5px] text-muted-foreground">
            {LEGEND.map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-sm", color)} aria-hidden="true" />
                {VISIT_STATUS_LABELS[status]}
              </span>
            ))}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Previous month" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="h-7 w-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:bg-[var(--wash)]">
              ‹
            </button>
            <button type="button" onClick={() => setCursor(new Date())} className="h-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] hover:bg-[var(--wash)]">
              Today
            </button>
            <button type="button" aria-label="Next month" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="h-7 w-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:bg-[var(--wash)]">
              ›
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-[11px] border border-[var(--hairline)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map(({ date, inMonth, visits: day }) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div key={date.toISOString()} className={cn("flex min-h-[84px] flex-col gap-1 border-b border-r border-[var(--hairline-soft)] px-2 py-1.5", isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-[var(--paper)]" : "bg-[var(--paper-sunken)]")}>
                <span className={cn("text-xs tabular-nums", isToday ? "font-semibold text-primary" : inMonth ? "text-[var(--ink-body)]" : "text-muted-foreground/40")}>{date.getDate()}</span>
                {day.map((v) => {
                  const clock = clockFor(v);
                  const status = visitStatus({ visit: v, clockedInAt: clock.inAt, clockedOutAt: clock.outAt, hasConflict: false, missedAfterMinutes: settings.missedClockInEscalationMinutes, now: new Date() });
                  return (
                    <span key={v.id} title={VISIT_STATUS_LABELS[status]} className={cn("block rounded-md px-1.5 py-1 leading-[1.3]", TONE_CLASSES[VISIT_STATUS_TONES[status]])}>
                      <span className="block text-[10.5px] opacity-90">{fmtTime(v.startsAt)}</span>
                      <span className="block text-[11px] font-medium">{v.caregiverName ?? "Unassigned"}</span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mb-0 mt-3 text-xs text-muted-foreground">
          The same visits the Scheduling board shows, filtered to this client — one Joy schedule, per §20.{" "}
          <Link to="/scheduling" className="text-primary hover:text-[#2A1BD1]">
            Open Scheduling →
          </Link>
        </p>
      </div>
    </div>
  );
}
