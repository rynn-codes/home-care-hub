import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, Clock, CornerDownRight, Moon, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogActivityDialog } from "@/components/records/LogActivityDialog";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { useOpenRequest } from "@/hooks/use-open-request";
import { useScheduleBoard, movedTo } from "@/hooks/use-schedule-board";
import { consentSessionForClient } from "@/lib/demoStore";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { clientPersonIdFor, clientRateFor } from "@/lib/clientRates";
import { cn } from "@/lib/utils";
import { canSeeProfit } from "@/domain/agency/settings";
import { agencyWeekLabel } from "@/domain/calendar/agencyWeek";
import { OVERTIME_THRESHOLD_HOURS, findConflicts, hoursOf, openShifts, scheduleConflicts, type Visit } from "@/domain/scheduling/conflicts";
import { coverDecisionFor, offOnDate, overlapsWeek, timeOffLabel, visitsAffected, dateOnly, type TimeOff } from "@/domain/scheduling/timeOff";
import { COVERAGE_STATE_LABELS, coverageState, coverageSummary, type CoverageEvent } from "@/domain/scheduling/coverage";
import { currentSchedule, describeSchedule, type ClientSchedule } from "@/domain/scheduling/clientSchedule";
import { clockLine as clockLineOf, clockState, visitStatus, alreadyWorked, type EditScope, type VisitStatus } from "@/domain/scheduling/visitState";
import { DEFAULT_MIX, hoursLabel, matchesMix, splitHours } from "@/domain/scheduling/serviceMix";
import { locationsFor, proposeLocation } from "@/domain/scheduling/locations";
import { isOvernight, laneCount, nightLanes, segmentsOn, overnightBandLabel, type NightSegment } from "@/domain/scheduling/overnight";
import { expensesLine } from "@/domain/scheduling/expenses";
import { correctionSummary, stopsBilling, confirmSource, actionCode, reasonCode, codeLabel } from "@/domain/scheduling/clockCorrections";
import { servedNames } from "@/domain/billing/households";
import { giftSummaryLine, giftTotalFor } from "@/domain/records/activity";
import { AssignCaregiver } from "@/components/scheduling/AssignCaregiver";
import { VisitSheet } from "@/components/scheduling/VisitSheet";
import { NewVisitDialog, type NewVisitKind } from "@/components/scheduling/NewVisitDialog";
import { TimeOffDialog } from "@/components/scheduling/TimeOffDialog";
import { CoverageBuilder } from "@/components/scheduling/CoverageBuilder";
import { ScopeDialog } from "@/components/scheduling/ScopeDialog";
import { EditVisitDialog, type VisitEdit } from "@/components/scheduling/EditVisitDialog";
import { ScheduleEditDialog } from "@/components/scheduling/ScheduleEditDialog";
import { ChangeConfirmSheet, nothingChanged, type PendingChange } from "@/components/scheduling/ChangeConfirmSheet";
import { PILL, fmtLong, fmtShort, fmtTime, initialsOf } from "@/components/scheduling/joy";

void AssignCaregiver;

/**
 * Scheduling — THE one Joy schedule. Week is the office's workspace; day,
 * month and agenda are other views of the same board. A visit reads as a
 * small white card: OPEN and CONFLICT pills, dashed borders on open shifts,
 * green once it is worked, amber when a clock is missing.
 *
 * Every change a person makes is confirmed with the before and after and who
 * it affects. Nothing is sent: Spruce is not wired, and every confirmation
 * says so.
 */

const DAY_NAMES = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const dayCol = (d: Date) => (d.getDay() + 1) % 7;
type QuickAction = "request_off" | "build_coverage" | { kind: NewVisitKind; repeat?: boolean };
const QUICK_ADD: Array<{ label: string; action: QuickAction }> = [
  { label: "New shift", action: { kind: "shift" } },
  { label: "Build coverage", action: "build_coverage" },
  { label: "Recurring schedule", action: { kind: "shift", repeat: true } },
  { label: "Visit", action: { kind: "client_visit" } },
  { label: "Assessment", action: { kind: "rn_assessment" } },
  { label: "Orientation", action: { kind: "orientation" } },
  { label: "Request off", action: "request_off" },
];
const JOY_PROMPTS = ["Who can cover Robert's shift this week?", "Show scheduling conflicts this week", "Show everyone approaching overtime"];

function startOfWeek(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - dayCol(d));
  d.setHours(0, 0, 0, 0);
  return d;
}
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const shortDay = (date: string) => {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isLive = (s: VisitStatus) => s === "upcoming" || s === "due_in" || s === "on_shift";

type Range = "day" | "week" | "month";
type Mode = "calendar" | "agenda";

export default function Scheduling() {
  const {
    assignments,
    assignShift,
    consentSessions,
    admissions,
    earlyStarts,
    authorizeEarlyStart,
    timeOff,
    coverDecisions,
    declineCover,
    clockAttempts,
    clockProposals,
    decideClockProposal,
    serviceMixes,
    approvedLocations,
    addApprovedLocation,
    visitMileage,
    visitExpenses,
    recordExpenses,
    visitPay,
    recordVisitPay,
    clientSchedules,
    reviseSchedule,
    interactions,
    logActivity,
    employeeEdits,
    askForPhone,
    phoneAsks,
    recordMileage,
    visitChanges,
    recordVisitChange,
    households,
    recordClockCorrection,
    setClockPlace,
    currentUser,
    requestTimeOff,
    cancelTimeOff,
    coverageEvents,
  } = useDemo();
  void assignments;
  const settings = useAgencySettings();
  const showProfit = canSeeProfit(currentUser.role, settings.profitVisibleTo);
  const [mode, setMode] = useState<Mode>("calendar");
  const [range, setRange] = useState<Range>("week");
  const view: Range | "agenda" = mode === "agenda" ? "agenda" : range;
  const setView = (v: Range | "agenda") => {
    if (v === "agenda") setMode("agenda");
    else {
      setMode("calendar");
      setRange(v);
    }
  };
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayCursor, setDayCursor] = useState(() => new Date());
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Visit | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{ visit: Visit; to: Date } | null>(null);
  const [undoOff, setUndoOff] = useState<TimeOff | null>(null);
  const [confirming, setConfirming] = useState<{ change: PendingChange; commit: () => void; onCancel?: () => void } | null>(null);
  const [scoping, setScoping] = useState<Visit | null>(null);
  const [editing, setEditing] = useState<{ visit: Visit; scope: EditScope; affected: Visit[] } | null>(null);
  const [cancelling, setCancelling] = useState<Visit | null>(null);
  const [logging, setLogging] = useState<Visit | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scheduleEditing, setScheduleEditing] = useState<ClientSchedule | null>(null);
  // Session-only: moves made by dragging.
  const [dayMoves, setDayMoves] = useState<Record<string, string>>({});
  const [toastLine, setToastLine] = useState<{ title: string; sub: string } | null>(null);
  const [offOpen, setOffOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageEditing, setCoverageEditing] = useState<CoverageEvent | null>(null);
  const [adding, setAdding] = useState<{ kind: NewVisitKind; repeat: boolean } | null>(null);
  const { visits, clockFor, today } = useScheduleBoard(dayMoves);
  const now = new Date();

  useEffect(() => {
    if (!toastLine) return;
    const t = setTimeout(() => setToastLine(null), 6000);
    return () => clearTimeout(t);
  }, [toastLine]);

  // The header's New menu and a client record's "Schedule care" land here.
  const { state: navState } = useLocation();
  const requested = useOpenRequest<"shift">();
  useEffect(() => {
    if (requested === "shift") setAdding({ kind: "shift", repeat: false });
  }, [requested]);
  useEffect(() => {
    const ask = (navState as { scheduleFor?: { client: string; caregiver?: string | null } } | null)?.scheduleFor;
    if (!ask) return;
    const draft = ask.caregiver ? `Put ${ask.caregiver} with ${ask.client} on ` : `Put  with ${ask.client} on `;
    document.dispatchEvent(new CustomEvent("joy:open", { detail: { draft } }));
    window.history.replaceState({ ...(window.history.state ?? {}), usr: { ...(navState ?? {}), scheduleFor: undefined } }, "");
  }, [navState]);

  /** Whether this client agreed to be driven. Undefined when nobody asked. */
  const transportConsentFor = (clientName: string): boolean | undefined => {
    const session = consentSessionForClient({ admissions, consentSessions }, clientName);
    const decision = session?.decisions?.transportation;
    if (!decision) {
      const seeded = seedClients.find((c) => `${c.firstName} ${c.lastName}` === clientName)?.decisions?.transportation;
      return seeded ? seeded === "agree" : undefined;
    }
    return decision === "agree";
  };
  const personIdOf = (v: Visit) => v.clientPersonId ?? clientPersonIdFor(v.clientName);
  const clientRateOf = (v: Visit) => clientRateFor({ clientPersonId: personIdOf(v), households, on: v.startsAt });
  const payRateOf = (name: string | null) => {
    if (!name) return null;
    const e = seedEmployees.find((x) => x.name === name);
    return e ? employeeEdits[e.id]?.baseRate ?? e.baseRate ?? null : null;
  };
  const locationsOf = (v: Visit) => {
    const id = personIdOf(v);
    return id ? locationsFor(approvedLocations, id) : [];
  };
  const pingsOf = (v: Visit) => clockAttempts.filter((a) => a.visitId === v.id && a.distanceMeters !== null).map((a) => ({ at: a.at, feet: Math.round(a.distanceMeters! * 3.28084) }));
  const otherHoursThisWeek = (v: Visit) => {
    if (!v.caregiverName) return 0;
    const week = startOfWeek(new Date(v.startsAt));
    const end = new Date(week);
    end.setDate(end.getDate() + 7);
    return Math.round(visits.filter((x) => x.id !== v.id && x.caregiverName === v.caregiverName && new Date(x.startsAt) >= week && new Date(x.startsAt) < end).reduce((sum, x) => sum + hoursOf(x), 0) * 100) / 100;
  };
  const mixOf = (v: Visit) => {
    const id = personIdOf(v);
    return (id && serviceMixes[id]) || DEFAULT_MIX;
  };
  const scheduleOf = (v: Visit) => {
    const id = personIdOf(v);
    return id ? currentSchedule(clientSchedules, id, new Date()) : null;
  };
  const clockLineFor = (v: Visit): string | null => {
    const { inAt, outAt } = clockFor(v);
    if (!inAt && !outAt) return null;
    const state = clockState({ clockedInAt: inAt, clockedOutAt: outAt, scheduledEndsAt: v.endsAt, now });
    return clockLineOf({ state, inAt: inAt ? fmtTime(inAt) : null, outAt: outAt ? fmtTime(outAt) : null })?.replace(/^\(|\)$/g, "") ?? null;
  };

  const weekStart = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const clientNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of seedClients) if (c.status === "active") names.add(`${c.firstName} ${c.lastName}`);
    for (const v of visits) if (!(v.eventType === "orientation" || v.eventType === "field_orientation" || v.eventType === "internal_event") && v.clientName) names.add(v.clientName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [visits]);
  const liveCoverage = useMemo(() => coverageEvents.filter((c) => !c.cancelledAt && new Date(c.endsAt).getTime() >= Date.now() - 86_400_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [coverageEvents]);
  const offThisWeek = useMemo(() => timeOff.filter((o) => overlapsWeek(o, weekStart)), [timeOff, weekStart]);
  const matches = (v: Visit) => {
    const needle = q.trim().toLowerCase();
    return needle ? `${v.clientName} ${v.caregiverName ?? "open"} ${v.service}`.toLowerCase().includes(needle) : true;
  };
  const weekVisits = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return visits.filter((v) => {
      const t = new Date(v.startsAt).getTime();
      return t >= weekStart.getTime() && t < end.getTime();
    });
  }, [visits, weekStart]);
  const inPast = weekOffset < 0;
  const offByDay = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return offOnDate(timeOff, localDate(d));
      }),
    [timeOff, weekStart],
  );
  const offOn = (d: Date) => offOnDate(timeOff, localDate(d));
  const nights = useMemo(() => weekVisits.filter((v) => matches(v) && isOvernight(v)), [weekVisits, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const nightGrid = useMemo(() => {
    const dayOf = (i: number) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return localDate(d);
    };
    const lanes = nightLanes(nights);
    const count = laneCount(lanes);
    return Array.from({ length: 7 }, (_, i) => {
      const column: Array<NightSegment | null> = Array.from({ length: count }, () => null);
      for (const seg of segmentsOn(nights, dayOf(i))) {
        const lane = lanes.get(seg.visitId);
        if (lane !== undefined) column[lane] = seg;
      }
      return column;
    });
  }, [nights, weekStart]);
  const byDay = useMemo(() => {
    const buckets: Visit[][] = [[], [], [], [], [], [], []];
    for (const v of weekVisits) if (matches(v) && !isOvernight(v)) buckets[dayCol(new Date(v.startsAt))].push(v);
    for (const b of buckets) b.sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());
    return buckets;
  }, [weekVisits, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => openShifts(weekVisits), [weekVisits]);
  const conflicts = useMemo(() => scheduleConflicts(weekVisits), [weekVisits]);
  const conflictedIds = useMemo(() => new Set(weekVisits.filter((v) => findConflicts(v, weekVisits).some((c) => c.severity === "blocking")).map((v) => v.id)), [weekVisits]);
  const covered = open.length === 0 && conflicts.length === 0;
  const weeklyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of weekVisits) if (v.caregiverName) totals[v.caregiverName] = (totals[v.caregiverName] ?? 0) + hoursOf(v);
    return totals;
  }, [weekVisits]);
  const approachingOvertime = Object.values(weeklyTotals).filter((h) => h >= OVERTIME_THRESHOLD_HOURS - 8).length;
  const rangeLabel = useMemo(() => {
    if (range === "day") return fmtLong(dayCursor);
    if (range === "month") return dayCursor.toLocaleDateString([], { month: "long", year: "numeric" });
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekStart.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}, ${end.getFullYear()}`;
  }, [range, weekStart, dayCursor]);
  const step = (dir: -1 | 1) => {
    if (range === "week") setWeekOffset((w) => w + dir);
    else if (range === "day") setDayCursor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir));
    else setDayCursor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };
  const recurrenceLine = (v: Visit) => {
    if (!v.seriesId) return null;
    const series = visits.filter((x) => x.seriesId === v.seriesId);
    if (series.length < 2) return null;
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = [...new Set(series.map((x) => new Date(x.startsAt).getDay()))].sort();
    const last = series.map((x) => x.startsAt).sort().slice(-1)[0];
    return `Weekly · ${days.map((d) => names[d]).join(", ")} · through ${shortDay(last)}`;
  };
  const statusOf = (v: Visit): VisitStatus => {
    const { inAt, outAt } = clockFor(v);
    return visitStatus({ visit: v, clockedInAt: inAt, clockedOutAt: outAt, hasConflict: conflictedIds.has(v.id), missedAfterMinutes: settings.missedClockInEscalationMinutes, now });
  };
  const confirmMove = () => {
    if (!moveConfirm) return;
    setDayMoves((m) => ({ ...m, [moveConfirm.visit.id]: moveConfirm.to.toISOString() }));
    setMoveConfirm(null);
    setToastLine({ title: "Schedule updated", sub: "Saved on this device — Spruce notification is not wired in the prototype" });
  };
  const moveChecks = useMemo(() => {
    if (!moveConfirm) return [];
    const proposed = movedTo(moveConfirm.visit, moveConfirm.to);
    return findConflicts(proposed, visits.filter((v) => v.id !== proposed.id));
  }, [moveConfirm, visits]);
  const moveBlocked = moveChecks.some((c) => c.severity === "blocking");
  const dayVisits = visits.filter((v) => sameDay(new Date(v.startsAt), dayCursor) && matches(v)).sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());
  const agendaDays = useMemo(() => {
    const sorted = (list: Visit[]) => list.filter(matches).sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());
    if (range === "day") return [{ date: dayCursor, visits: sorted(visits.filter((v) => sameDay(new Date(v.startsAt), dayCursor))) }];
    if (range === "week") {
      return byDay.map((list, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, visits: list };
      });
    }
    const first = new Date(dayCursor.getFullYear(), dayCursor.getMonth(), 1);
    const days = new Date(dayCursor.getFullYear(), dayCursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return { date: d, visits: sorted(visits.filter((v) => sameDay(new Date(v.startsAt), d))) };
    });
  }, [range, dayCursor, weekStart, byDay, visits, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthCells = useMemo(() => {
    const first = new Date(dayCursor.getFullYear(), dayCursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - dayCol(first));
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return { date, inMonth: date.getMonth() === dayCursor.getMonth(), visits: visits.filter((v) => sameDay(new Date(v.startsAt), date)) };
    });
  }, [dayCursor, visits]);

  /** What an edit changes, for the confirmation — null when nothing did. */
  const reviewEdit = (e: VisitEdit): PendingChange | null => {
    if (!editing) return null;
    const { visit, affected } = editing;
    const clock = clockFor(visit);
    const lines = (l: VisitEdit["serviceLines"]) => l.map((x) => `${x.service} ${hoursLabel(x.hours)}`).join(" · ");
    const hours = (Date.parse(`${e.endsOn}T${e.end}:00`) - Date.parse(`${e.date}T${e.start}:00`)) / 3_600_000;
    const pay = visitPay[visit.id];
    const change: PendingChange = {
      kind: "edit",
      clientName: visit.clientName,
      service: visit.service,
      when: `${fmtLong(new Date(visit.startsAt))} · ${fmtTime(visit.startsAt)} – ${fmtTime(visit.endsAt)}`,
      rows: [
        { label: "Day", from: shortDay(visit.startsAt), to: shortDay(e.date) },
        { label: "Start", from: fmtTime(visit.startsAt), to: fmtTime(`${e.date}T${e.start}:00`) },
        { label: "End", from: fmtTime(visit.endsAt), to: fmtTime(`${e.endsOn}T${e.end}:00`) },
        { label: "Caregiver", from: visit.caregiverName, to: e.caregiverName },
        { label: "Services", from: matchesMix(e.serviceLines, mixOf(visit), hours) ? lines(e.serviceLines) : lines(splitHours(mixOf(visit), hoursOf(visit))), to: lines(e.serviceLines) },
        { label: "Clocked in", from: clock.inAt ? fmtTime(clock.inAt) : null, to: e.actualIn ? fmtTime(`${e.date}T${e.actualIn}:00`) : null },
        { label: "Clocked out", from: clock.outAt ? fmtTime(clock.outAt) : null, to: e.actualOut ? fmtTime(`${e.endsOn}T${e.actualOut}:00`) : null },
        { label: "Expenses", from: expensesLine(visitExpenses[visit.id] ?? [], settings.mileageRatePerMile), to: expensesLine(e.expenses, settings.mileageRatePerMile) },
        {
          label: "Pay Rate",
          from: (() => {
            const r = pay?.rate ?? payRateOf(visit.caregiverName);
            return r === null || r === undefined ? null : `$${r.toFixed(2)}`;
          })(),
          to: e.rate === null ? null : `$${e.rate.toFixed(2)}`,
        },
        { label: "Billed", from: pay?.rateKind === "daily" ? "Daily" : "Hourly", to: e.rateKind === "daily" ? "Daily" : "Hourly" },
        { label: "On-call", from: pay?.onCall ? "Yes" : null, to: e.onCall ? "Yes" : null },
        { label: "Paid next day", from: pay?.payNextDay ? "Yes" : null, to: e.payNextDay ? "Yes" : null },
        {
          label: "Reason",
          from: null,
          to: (() => {
            const r = reasonCode(e.reasonCode);
            return r ? codeLabel(r) : null;
          })(),
        },
        {
          label: "Confirmed by",
          from: null,
          to: (() => {
            const s = confirmSource(e.actionCode);
            if (s) return s.label;
            const a = actionCode(e.actionCode);
            return a ? codeLabel(a) : null;
          })(),
        },
        { label: "Note", from: null, to: e.note.trim() || null },
      ],
      affects: [...(visit.caregiverName ? [visit.caregiverName] : []), ...(e.caregiverName && e.caregiverName !== visit.caregiverName ? [e.caregiverName] : []), `${visit.clientName} / family contact`],
      visitCount: affected.length,
    };
    return nothingChanged(change) ? null : change;
  };

  const saveEdit = (e: VisitEdit) => {
    if (!editing) return;
    const { visit, affected } = editing;
    if (reviewEdit(e) === null) {
      setEditing(null);
      setToastLine({ title: "Nothing changed", sub: "The visit is as it was." });
      return;
    }
    const at = new Date().toISOString();
    if (e.actualIn || e.actualOut) {
      recordClockCorrection({
        visitId: visit.id,
        clockedInAt: e.actualIn ? `${e.date}T${e.actualIn}:00` : null,
        clockedOutAt: e.actualOut ? `${e.endsOn}T${e.actualOut}:00` : null,
        reasonCode: e.reasonCode,
        actionCode: e.actionCode,
        note: e.note,
        by: currentUser.name,
        at,
      });
      setClockPlace(visit.id, "out", { kind: e.outLocationId === null ? "not_recorded" : "service_address", where: locationsOf(visit).find((l) => l.id === e.outLocationId)?.label ?? "" });
    }
    const newStart = `${e.date}T${e.start}:00`;
    if (visit.startsAt !== newStart) {
      const dayChanged = e.date !== visit.startsAt.slice(0, 10);
      recordVisitChange({ visitId: visit.id, kind: dayChanged ? "day_moved" : "time_moved", at, by: currentUser.name, why: e.note.trim() || null, from: dayChanged ? shortDay(visit.startsAt) : visit.startsAt, to: dayChanged ? shortDay(e.date) : newStart });
    }
    if ((e.caregiverName ?? null) !== visit.caregiverName) {
      recordVisitChange({ visitId: visit.id, kind: e.caregiverName === null ? "unassigned" : "reassigned", at, by: currentUser.name, why: e.note.trim() || null, from: visit.caregiverName, to: e.caregiverName });
      if (e.caregiverName) assignShift(visit.id, e.caregiverName);
    }
    const hadExpenses = (visitExpenses[visit.id] ?? []).length > 0;
    if (e.expenses.length > 0 || hadExpenses) recordExpenses(visit.id, e.expenses, currentUser.name);
    const pay = visitPay[visit.id] ?? null;
    const isDefault = !pay && e.rate === payRateOf(visit.caregiverName) && e.rateKind === "hourly" && !e.onCall && !e.payNextDay;
    if (pay ? pay.rate !== e.rate || pay.rateKind !== e.rateKind || pay.onCall !== e.onCall || pay.payNextDay !== e.payNextDay : !isDefault) {
      recordVisitPay({ visitId: visit.id, rate: e.rate, rateKind: e.rateKind, onCall: e.onCall, payNextDay: e.payNextDay, setBy: currentUser.name, setAt: at });
    }
    const miles = visitMileage[visit.id]?.actualMiles ?? 0;
    if (e.actualMiles !== miles || e.milesNote !== (visitMileage[visit.id]?.note ?? "")) {
      recordMileage({ visitId: visit.id, plannedMiles: visitMileage[visit.id]?.plannedMiles ?? 0, actualMiles: e.actualMiles, note: e.milesNote, recordedBy: currentUser.name, recordedOn: at });
    }
    if (e.actualIn || e.actualOut) recordVisitChange({ visitId: visit.id, kind: "clock_corrected", at, by: currentUser.name, why: e.note.trim() || null });
    setToastLine({
      title: `Saved to ${affected.length} ${affected.length === 1 ? "visit" : "visits"}`,
      sub: e.reasonCode ? correctionSummary(e) : `${e.serviceLines.length === 1 ? e.serviceLines[0].service : `${e.serviceLines.length} services`} · ${e.start}–${e.end}`,
    });
    setEditing(null);
  };

  const card = (v: Visit, row = false) => {
    const status = statusOf(v);
    const { inAt, outAt } = clockFor(v);
    const clocked = !!(inAt || outAt);
    const cs = clockState({ clockedInAt: inAt, clockedOutAt: outAt, scheduledEndsAt: v.endsAt, now });
    const noOut = cs === "missing_clock_out";
    const cls = cn(
      "cursor-grab rounded-[10px] border bg-[var(--paper)] text-left shadow-[0_1px_2px_rgba(25,26,46,.04)] transition-colors",
      status === "open" && "border-dashed border-[#D6D8EA] bg-[#FBFBFE]",
      status === "conflict" && "border-[#FBD9D3] bg-[#FFFBFA]",
      isLive(status) && "border-[var(--hairline)]",
      status === "complete" && "border-[#A6E3C4] bg-[#F3FAF5]",
      status === "no_clock_out" && "border-[#F3DDAE] bg-[#FFFDF6]",
      status === "missed_in" && "border-[#F4D7D5] bg-[#FDF3F3]",
      dragId === v.id && "opacity-40",
      row ? "flex items-center gap-4 px-4 py-3" : "flex flex-col gap-0.5 px-2 py-2",
    );
    const handlers = {
      draggable: true,
      onDragStart: () => setDragId(v.id),
      onDragEnd: () => {
        setDragId(null);
        setOverCol(null);
      },
      onClick: () => setSelected(v),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelected(v);
        }
      },
      role: "button" as const,
      tabIndex: 0,
    };
    const declined = !v.caregiverName && !!coverDecisionFor(coverDecisions, v.id);
    const who = (
      <span className="flex min-w-0 items-center gap-1.5">
        {v.caregiverName ? (
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[9.5px] font-semibold text-primary">{initialsOf(v.caregiverName)}</span>
        ) : (
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-dashed border-[#C9C9D0] text-[9.5px] text-muted-foreground/60">?</span>
        )}
        <span className={cn("min-w-0 truncate text-[11.5px]", v.caregiverName ? "text-[var(--ink-body)]" : declined ? "text-muted-foreground" : "font-medium text-primary")}>
          {v.caregiverName ?? (declined ? "No replacement — family confirmed" : v.coverFor ? `Needs cover · ${v.coverFor} off` : "Open")}
        </span>
      </span>
    );
    const line = clockLineOf({ state: cs, inAt: inAt ? fmtTime(inAt) : null, outAt: outAt ? fmtTime(outAt) : null })?.replace(/^\(|\)$/g, "") ?? "";
    const clockChip = clocked && (
      <span title={noOut ? `Clocked in ${line} — no clock-out recorded` : `Clocked ${line}`} className={cn("flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums", noOut ? "text-[#B54708]" : "text-[#0B7268]")}>
        <Clock className="h-3 w-3 flex-none" aria-hidden="true" />({line})
      </span>
    );
    if (row) {
      return (
        <div key={v.id} {...handlers} className={cls}>
          <span className="flex w-[92px] flex-none flex-col leading-[1.3]">
            <span className="text-[13px] font-semibold tabular-nums">{fmtTime(v.startsAt)}</span>
            <span className="text-[11.5px] tabular-nums text-muted-foreground">{fmtTime(v.endsAt)}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-[13.5px] font-medium" title={servedNames(v)}>
              {servedNames(v)}
            </span>
            {v.service !== "Personal Care" && (
              <span className="truncate text-[12px] text-muted-foreground" title={v.service}>
                {v.service}
              </span>
            )}
          </span>
          <span className="hidden w-[160px] flex-none sm:flex">{who}</span>
          <span className="hidden w-[170px] flex-none justify-end sm:flex">{clockChip}</span>
          <span className="flex flex-none items-center gap-2">
            {status === "open" && <span className={PILL.open}>OPEN</span>}
            {status === "conflict" && <span className={PILL.conflict}>CONFLICT</span>}
          </span>
        </div>
      );
    }
    const hrs = `${hoursOf(v).toFixed(1).replace(/\.0$/, "")} hrs`;
    return (
      <div key={v.id} {...handlers} className={cls}>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--ink)]">{fmtTime(v.startsAt)}</span>
          {status === "open" && <span className={PILL.open}>OPEN</span>}
          {status === "conflict" && <span className={PILL.conflict}>CONFLICT</span>}
        </span>
        <span className="truncate text-[13px] font-medium leading-[1.3]" title={servedNames(v)}>
          {servedNames(v)}
        </span>
        {v.service !== "Personal Care" && (
          <span className="truncate text-[11.5px] leading-[1.35] text-muted-foreground" title={v.service}>
            {v.service}
          </span>
        )}
        <span className="pt-0.5">{who}</span>
        <span
          title={clocked && !noOut ? `Clocked ${line} · scheduled ${fmtTime(v.startsAt)} – ${fmtTime(v.endsAt)}` : `Scheduled ${fmtTime(v.startsAt)} – ${fmtTime(v.endsAt)}`}
          className={cn("flex items-baseline justify-between gap-1.5 text-[11px] tabular-nums", clocked && !noOut ? "font-semibold text-[#0B7268]" : "text-muted-foreground")}
        >
          <span className="truncate">{clocked && !noOut && inAt && outAt ? `${fmtShort(inAt)}–${fmtShort(outAt)}` : `${fmtShort(v.startsAt)}–${fmtShort(v.endsAt)}`}</span>
          <span className="flex-none">{hrs}</span>
        </span>
        {noOut && (
          <span title={`Clocked in ${line} — no clock-out recorded`} className="mt-0.5 flex items-start gap-1 rounded-[6px] bg-[#FFF6E4] px-1.5 py-1 text-[10.5px] font-semibold leading-[1.3] text-[#B54708] [text-wrap:pretty]">
            <span className="mt-[1px] flex-none">⚠</span>
            <span className="min-w-0">{inAt ? `In ${fmtShort(inAt)}` : "Clocked in"} · no clock-out</span>
          </span>
        )}
      </div>
    );
  };

  const thisWeekRows = [
    {
      key: "visits",
      label: "Scheduled visits",
      value: String(weekVisits.filter((v) => v.caregiverName !== null).length),
      details: (() => {
        const m = new Map<string, number>();
        for (const v of weekVisits) if (v.caregiverName !== null) m.set(v.startsAt.slice(0, 10), (m.get(v.startsAt.slice(0, 10)) ?? 0) + 1);
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => ({ id: d, text: `${shortDay(d)} · ${n} ${n === 1 ? "visit" : "visits"}` }));
      })(),
    },
    { key: "open", label: "Open shifts", value: String(open.length), accent: open.length > 0, details: open.map((v) => ({ id: v.id, text: `${v.clientName} · ${shortDay(v.startsAt)} ${fmtTime(v.startsAt)}`, onClick: () => setSelected(v) })) },
    { key: "working", label: "Caregivers working", value: String(Object.keys(weeklyTotals).length), details: Object.entries(weeklyTotals).sort((a, b) => b[1] - a[1]).map(([n, h]) => ({ id: n, text: `${n} · ${Math.round(h * 100) / 100} hrs` })) },
    {
      key: "overtime",
      label: "Approaching overtime",
      value: String(approachingOvertime),
      warn: approachingOvertime > 0,
      details: Object.entries(weeklyTotals)
        .filter(([, h]) => h >= OVERTIME_THRESHOLD_HOURS - 8)
        .sort((a, b) => b[1] - a[1])
        .map(([n, h]) => ({ id: n, text: `${n} · ${Math.round(h * 100) / 100} hrs · ${Math.round((OVERTIME_THRESHOLD_HOURS - h) * 100) / 100} before OT` })),
    },
    { key: "off", label: "On request off", value: String(offThisWeek.length), warn: offThisWeek.length > 0, details: offThisWeek.map((o) => ({ id: o.id, text: `${o.caregiverName} · ${timeOffLabel(o)}${o.reason ? ` · ${o.reason}` : ""}` })) },
  ] as Array<{ key: string; label: string; value: string; accent?: boolean; warn?: boolean; details: Array<{ id: string; text: string; onClick?: () => void }> }>;

  const btn = "h-[30px] rounded-lg border border-[var(--hairline)] bg-[var(--paper)] transition-colors hover:bg-[var(--wash)]";
  const loggingId = logging ? personIdOf(logging) : null;
  const loggingClient = seedClients.find((c) => c.personId === loggingId);
  const year = new Date().getFullYear();
  const selectedClock = selected ? clockFor(selected) : { inAt: null, outAt: null };

  return (
    <>
      <PageHeader
        title="Scheduling"
        week
        actions={
          <>
            <div className="flex h-[34px] w-[196px] items-center gap-2 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5">
              <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client or caregiver" aria-label="Search client or caregiver" className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                  Quick Add
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[212px] rounded-xl p-1.5">
                {QUICK_ADD.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onSelect={() => {
                      if (item.action === "request_off") setOffOpen(true);
                      else if (item.action === "build_coverage") setCoverageOpen(true);
                      else setAdding({ kind: item.action.kind, repeat: !!item.action.repeat });
                    }}
                    className="rounded-lg px-2.5 py-2 text-[12.5px]"
                  >
                    <span className="mr-1 text-muted-foreground">+</span>
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-[5px]">
          <button type="button" aria-label={`Previous ${range}`} onClick={() => step(-1)} className={cn(btn, "w-[30px] text-muted-foreground hover:text-foreground")}>
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              setWeekOffset(0);
              setDayCursor(new Date());
            }}
            className={cn(btn, "px-3 text-[12.5px]")}
          >
            Today
          </button>
          <button type="button" aria-label={`Next ${range}`} onClick={() => step(1)} className={cn(btn, "w-[30px] text-muted-foreground hover:text-foreground")}>
            ›
          </button>
        </div>
        <span className="text-base font-semibold tracking-[-.015em]">{rangeLabel}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-0.5 rounded-[9px] bg-[var(--wash-strong)] p-[3px]" role="group" aria-label="Calendar range">
            {(["day", "week", "month"] as Range[]).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={cn("h-7 rounded-[7px] px-3 text-[12.5px] capitalize transition-colors", range === r ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]" : "text-muted-foreground hover:text-foreground")}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-[9px] bg-[var(--wash-strong)] p-[3px]" role="tablist" aria-label="Schedule views">
            {(["calendar", "agenda"] as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("h-7 rounded-[7px] px-3.5 text-[12.5px] capitalize transition-colors", mode === m ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]" : "text-muted-foreground hover:text-foreground")}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("grid items-start gap-4", view === "agenda" && "lg:grid-cols-[252px_1fr]")}>
        {view === "agenda" && (
          <div className="flex flex-col gap-3.5">
            {liveCoverage.length > 0 && (
              <section className="flex flex-col gap-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
                <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Coverage</h2>
                {liveCoverage.map((c) => {
                  const s = coverageSummary(c.shifts);
                  const state = coverageState(c, new Date().toISOString());
                  return (
                    <button key={c.id} type="button" onClick={() => setCoverageEditing(c)} className="flex w-full flex-col gap-0.5 rounded-[9px] p-2 text-left transition-colors hover:bg-[var(--wash)]">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {c.clientName} · {c.coverageType}
                        </span>
                        <span className={cn("flex-none rounded-full px-2 py-[1px] text-[10.5px] font-semibold", state === "fully_covered" ? "bg-[#E7F6EE] text-[#0B7268]" : state === "needs_attention" ? "bg-[#FDEAD7] text-[#B54708]" : "bg-[var(--wash-strong)] text-[var(--ink-body)]")}>
                          {COVERAGE_STATE_LABELS[state].toUpperCase()}
                        </span>
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {fmtLong(new Date(c.startsAt))} → {fmtLong(new Date(c.endsAt))}
                      </span>
                      <span className="text-[11.5px] font-medium text-[var(--ink-body)]">
                        {s.coveredHours} / {s.requiredHours} hrs covered · {s.openShifts} open · {s.projectedOtHours} projected OT
                      </span>
                    </button>
                  );
                })}
              </section>
            )}
            <section className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Needs you</h2>
              {covered ? (
                <div className="flex flex-col gap-1 pb-0.5 pt-1.5">
                  <span className="text-[13.5px] font-medium">Schedule is covered.</span>
                  <span className="text-xs text-muted-foreground">No open shifts or conflicts this week.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {open.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setView("week");
                        setSelected(open[0]);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-[9px] p-2 text-left transition-colors hover:bg-[var(--wash)]"
                    >
                      <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-primary" aria-hidden="true" />
                      <span className="flex flex-col leading-[1.3]">
                        <span className="text-[13px]">
                          {open.length} open {open.length === 1 ? "shift" : "shifts"}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground">{open.map((v) => `${DAY_NAMES[dayCol(new Date(v.startsAt))]} · ${servedNames(v)}`).join(" · ")}</span>
                      </span>
                    </button>
                  )}
                  {conflicts.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setView("week");
                        if (c.conflictsWith) setSelected(c.conflictsWith);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-[9px] p-2 text-left transition-colors hover:bg-[var(--wash)]"
                    >
                      <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-[#D92D20]" aria-hidden="true" />
                      <span className="flex flex-col leading-[1.3]">
                        <span className="text-[13px]">Scheduling conflict</span>
                        <span className="text-[11.5px] text-muted-foreground">{c.message}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">This week</h2>
              <div className="flex flex-col">
                {thisWeekRows.map((r) => {
                  const isOpen = expanded === r.key;
                  const has = r.details.length > 0;
                  return (
                    <div key={r.key} className="flex flex-col border-b border-[var(--hairline-soft)] last:border-b-0">
                      <button type="button" aria-expanded={has ? isOpen : undefined} onClick={() => has && setExpanded(isOpen ? null : r.key)} className={cn("flex w-full items-center gap-2.5 py-[7px] text-left", has && "hover:text-foreground")}>
                        <span className="text-[12.5px] text-muted-foreground">{r.label}</span>
                        <span className={cn("ml-auto text-[12.5px] font-medium tabular-nums", r.accent && "text-primary", r.warn && "text-[#B54708]")}>{r.value}</span>
                        {has && <ChevronRight className={cn("h-3.5 w-3.5 flex-none text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden="true" />}
                      </button>
                      {isOpen && (
                        <ul className="m-0 mb-1.5 list-none p-0">
                          {r.details.map((d) =>
                            d.onClick ? (
                              <li key={d.id}>
                                <button type="button" onClick={d.onClick} className="w-full rounded-[7px] px-2 py-[3px] text-left text-[12px] hover:bg-[var(--wash)]">
                                  {d.text}
                                </button>
                              </li>
                            ) : (
                              <li key={d.id} className="px-2 py-[3px] text-[12px]">
                                {d.text}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="flex flex-col gap-2.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <span className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#8FA0FF]" style={{ animation: "joyGlow 2.6s ease-in-out infinite" }} aria-hidden="true" />
                <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Ask Joy</h2>
              </span>
              <div className="flex flex-col gap-px">
                {JOY_PROMPTS.map((p) => (
                  <button key={p} type="button" onClick={() => document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: p } }))} className="rounded-lg p-2 text-left text-[12.5px] leading-[1.4] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                    {p}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === "week" && (
          <div className="overflow-x-auto rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="grid min-w-[1040px] grid-cols-7">
              {DAY_NAMES.map((name, i) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + i);
                const isToday = sameDay(date, new Date());
                return (
                  <div key={name} className={cn("flex flex-col gap-px border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5", i < 6 && "border-r border-r-[#F3F3F6]")}>
                    <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">{name}</span>
                    <span className={cn("text-[15px] font-semibold tracking-[-.01em] tabular-nums", isToday && "text-primary")}>{date.getDate()}</span>
                  </div>
                );
              })}
              {DAY_NAMES.map((name, i) => (
                <div
                  key={`col-${name}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overCol !== i) setOverCol(i);
                  }}
                  onDragLeave={() => {
                    if (overCol === i) setOverCol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverCol(null);
                    const v = visits.find((x) => x.id === dragId);
                    setDragId(null);
                    if (!v) return;
                    const target = new Date(weekStart);
                    target.setDate(target.getDate() + i);
                    if (!sameDay(new Date(v.startsAt), target)) setMoveConfirm({ visit: v, to: target });
                  }}
                  className={cn("flex flex-col gap-[7px] p-2", weekVisits.length === 0 ? "min-h-[56px]" : "min-h-[280px]", i < 6 && "border-r border-[var(--hairline-soft)]", overCol === i ? "bg-[#F7F8FE]" : i < 2 ? "bg-[var(--paper-sunken)]" : "bg-[var(--paper)]")}
                >
                  {offByDay[i].length > 0 && (
                    <span className="flex flex-col gap-[3px] rounded-[9px] border border-[#FCE8B6] bg-[#FFFAEB] px-2 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#B54708]">Off</span>
                      {offByDay[i].map((o) => (
                        <button key={o.id} type="button" onClick={() => setUndoOff(o)} title={`Undo ${o.caregiverName}'s time off`} className="truncate rounded-[5px] text-left text-[11.5px] text-[#B54708] underline-offset-2 transition-colors hover:bg-[#FBEFD3] hover:underline">
                          {o.caregiverName}
                        </button>
                      ))}
                    </span>
                  )}
                  {byDay[i].length === 0 && offByDay[i].length === 0 && weekVisits.length > 0 && <span className="px-0.5 py-1.5 text-[11.5px] text-muted-foreground/40">No visits</span>}
                  {byDay[i].map((v) => card(v))}
                </div>
              ))}
              {weekVisits.length === 0 && (
                <div className="col-span-7 flex flex-col items-center gap-1 px-4 py-10 text-center">
                  <span className="text-[13px] font-medium">{inPast ? "No visits recorded for this week" : "Nothing scheduled this week yet"}</span>
                  <span className="max-w-[46ch] text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
                    {inPast ? "Nothing was deleted. This prototype only generates the current week, so earlier weeks are empty — in the real system this is where the history lives." : "Nothing has been put on the board for these days yet. Use Quick Add to schedule a visit."}
                  </span>
                  {weekOffset !== 0 && (
                    <button type="button" onClick={() => setWeekOffset(0)} className="mt-1.5 h-8 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] transition-colors hover:bg-[var(--wash)]">
                      Back to this week
                    </button>
                  )}
                </div>
              )}
              {nights.length > 0 && (
                <>
                  <div className="col-span-7 flex items-center gap-2 border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-1.5">
                    <Moon className="h-3 w-3 flex-none text-muted-foreground" aria-hidden="true" />
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{overnightBandLabel(nights.length)}</span>
                  </div>
                  {DAY_NAMES.map((name, i) => {
                    const date = new Date(weekStart);
                    date.setDate(date.getDate() + i);
                    return (
                      <div key={`night-head-${name}`} className={cn("flex items-baseline gap-1.5 border-t border-[var(--hairline-soft)] bg-[var(--paper-sunken)] px-3 pb-1 pt-1", i < 6 && "border-r border-r-[#F3F3F6]", i < 2 && "bg-[var(--wash)]")}>
                        <span className="text-[9.5px] font-semibold uppercase tracking-[.07em] text-muted-foreground">{name}</span>
                        <span className={cn("text-[11px] font-semibold tabular-nums text-muted-foreground", sameDay(date, new Date()) && "text-primary")}>{date.getDate()}</span>
                      </div>
                    );
                  })}
                  {Array.from({ length: nightGrid[0].length }).flatMap((_, lane) =>
                    DAY_NAMES.map((name, i) => {
                      const seg = nightGrid[i][lane];
                      const v = seg ? nights.find((x) => x.id === seg.visitId) : null;
                      const status = v ? statusOf(v) : null;
                      const done = status === "complete";
                      const noOut = status === "no_clock_out";
                      return (
                        <div key={`night-${lane}-${name}`} className={cn("flex flex-col gap-[6px] p-2", lane === 0 && "border-t border-[var(--hairline-soft)]", i < 6 && !seg?.continuesNext && "border-r border-[var(--hairline-soft)]", i < 2 ? "bg-[var(--paper-sunken)]" : "bg-[var(--paper)]")}>
                          {seg && v && (
                            <button
                              type="button"
                              onClick={() => setSelected(v)}
                              className={cn(
                                "flex flex-col gap-[3px] rounded-[10px] px-2.5 py-2 text-left transition-colors",
                                done ? "border border-[#A6E3C4] bg-[#F3FAF5] text-[var(--ink)] hover:bg-[#EAF6EF]" : noOut ? "border border-[#F3DDAE] bg-[#FFFDF6] text-[var(--ink)] hover:bg-[#FFF9EC]" : "border border-[#2E3269] bg-[#2E3269] text-white hover:border-[#3A3F81] hover:bg-[#3A3F81]",
                                seg.continuesNext && "-mr-2 rounded-r-none border-r-2 [border-right-style:dashed]",
                                seg.continues && "-ml-2 rounded-l-none border-l-2 [border-left-style:dashed]",
                                (seg.continues || seg.continuesNext) && (done ? "border-l-[#5EBE92] border-r-[#5EBE92]" : noOut ? "border-l-[#D9A441] border-r-[#D9A441]" : "border-l-[#8A90D6] border-r-[#8A90D6]"),
                              )}
                            >
                              <span className={cn("text-[12px] font-semibold tabular-nums", done || noOut ? "text-[var(--ink)]" : "text-white")}>
                                {seg.continues && <CornerDownRight className={cn("mr-1 inline h-3 w-3 -translate-y-[1px]", done || noOut ? "text-muted-foreground" : "text-[#DEDFF0]/80")} aria-label="Carried on from the night before" />}
                                {fmtShort(seg.startsAt)}
                              </span>
                              <span className="truncate text-[12.5px] font-medium leading-[1.25]" title={servedNames(v)}>
                                {servedNames(v)}
                              </span>
                              {v.service !== "Personal Care" && <span className={cn("truncate text-[11px]", done || noOut ? "text-muted-foreground" : "text-[#DEDFF0]/80")}>{v.service}</span>}
                              <span className="flex items-center gap-1.5 pt-0.5">
                                <span className={cn("flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[9.5px] font-semibold", done || noOut ? "bg-[#EEF0FE] text-primary" : "bg-white/15")}>{v.caregiverName ? initialsOf(v.caregiverName) : "?"}</span>
                                <span className={cn("truncate text-[11px]", done || noOut ? "text-[var(--ink-body)]" : "text-[#DEDFF0]")}>{v.caregiverName ?? "Open"}</span>
                              </span>
                              <span className={cn("flex items-baseline justify-between gap-1.5 text-[11px] tabular-nums", done ? "font-semibold text-[#0B7268]" : noOut ? "font-semibold text-[#B54708]" : "text-[#DEDFF0]/80")}>
                                <span className="truncate">
                                  {fmtShort(seg.startsAt)}–{fmtShort(seg.endsAt)}
                                </span>
                                <span className="flex-none">{seg.hours.toFixed(1).replace(/\.0$/, "")} hrs</span>
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    }),
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {view === "day" && (
          <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">{DAY_NAMES[dayCol(dayCursor)]}</span>
              <span className={cn("text-[15px] font-semibold", sameDay(dayCursor, new Date()) && "text-primary")}>{dayCursor.getDate()}</span>
              <span className="ml-auto text-[12.5px] text-muted-foreground">
                {dayVisits.length} {dayVisits.length === 1 ? "visit" : "visits"}
              </span>
            </div>
            <div className="flex min-h-[280px] flex-col gap-[7px] p-2">
              {offOn(dayCursor).length > 0 && (
                <span className="flex flex-wrap items-center gap-2 rounded-[9px] border border-[#FCE8B6] bg-[#FFFAEB] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#B54708]">Off</span>
                  {offOn(dayCursor).map((o) => (
                    <button key={o.id} type="button" onClick={() => setUndoOff(o)} title={`Undo ${o.caregiverName}'s time off`} className="rounded-[5px] text-[12px] text-[#B54708] underline-offset-2 hover:underline">
                      {o.caregiverName}
                      {o.reason ? <span className="text-[#B54708]/70"> · {o.reason}</span> : null}
                    </button>
                  ))}
                </span>
              )}
              {dayVisits.length === 0 && <span className="px-0.5 py-1.5 text-[11.5px] text-muted-foreground/40">No visits</span>}
              {dayVisits.map((v) => card(v, true))}
            </div>
          </div>
        )}

        {view === "agenda" && (
          <div className="flex flex-col gap-3.5">
            {agendaDays.map(({ date, visits: list }, i) => {
              const off = offOn(date);
              if (list.length === 0 && off.length === 0) return null;
              return (
                <div key={i} className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] bg-[#F7F7F9] px-4 py-[11px]">
                    <span className={cn("text-[12.5px] font-medium", sameDay(date, new Date()) ? "text-primary" : "text-[var(--ink-soft)]")}>{date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</span>
                    {off.map((o) => (
                      <button key={o.id} type="button" onClick={() => setUndoOff(o)} title={`Undo ${o.caregiverName}'s time off`} className="rounded-full border border-[#FCE8B6] bg-[#FFFAEB] px-2.5 py-[2px] text-[11.5px] font-medium text-[#B54708] hover:bg-[#FBEFD3]">
                        {o.caregiverName} off
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{list.length === 0 ? "No visits" : `${list.length} ${list.length === 1 ? "visit" : "visits"}`}</span>
                  </div>
                  {list.map((v) => {
                    const status = statusOf(v);
                    const line = clockLineFor(v);
                    return (
                      <button key={v.id} type="button" onClick={() => setSelected(v)} className={cn("flex w-full gap-4 border-b border-[var(--hairline-soft)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--wash)]", status === "complete" && "bg-[#F3FAF5]", status === "no_clock_out" && "bg-[#FFFDF6]")}>
                        <span className="flex w-24 flex-none flex-col leading-[1.3]">
                          <span className="text-[13px] font-semibold tabular-nums">{fmtTime(v.startsAt)}</span>
                          <span className="text-[11.5px] text-muted-foreground tabular-nums">{fmtTime(v.endsAt)}</span>
                        </span>
                        <span className={cn("w-0.5 flex-none rounded-sm", status === "open" ? "bg-[#C9CEF2]" : status === "conflict" ? "bg-[#FBD9D3]" : status === "complete" ? "bg-[#6CCF9C]" : status === "no_clock_out" ? "bg-[#E8B96A]" : "bg-[#E4E4EA]")} aria-hidden="true" />
                        <span className="flex min-w-0 flex-col gap-[3px]">
                          <span className="text-sm font-medium">{servedNames(v)}</span>
                          {v.service !== "Personal Care" && <span className="text-[12.5px] text-muted-foreground">{v.service}</span>}
                          {line && (
                            <span className="flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-[#0B7268]">
                              <Clock className="h-3 w-3 flex-none" aria-hidden="true" />({line})
                            </span>
                          )}
                        </span>
                        <span className="ml-auto flex flex-none items-center gap-3">
                          {status === "open" && <span className={PILL.open}>OPEN</span>}
                          {status === "conflict" && <span className={PILL.conflict}>CONFLICT</span>}
                          <span className={cn("text-[12.5px]", v.caregiverName ? "text-[var(--ink-body)]" : "font-medium text-primary")}>{v.caregiverName ?? (v.coverFor ? `Cover for ${v.coverFor}` : "Unassigned")}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {agendaDays.every((d) => d.visits.length === 0 && offOn(d.date).length === 0) && (
              <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing scheduled {range === "day" ? "this day" : range === "week" ? "this week" : "this month"}.</div>
            )}
          </div>
        )}

        {view === "month" && (
          <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="grid grid-cols-7">
              {DAY_NAMES.map((w) => (
                <div key={w} className="border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                  {w}
                </div>
              ))}
              {monthCells.map(({ date, inMonth, visits: cell }) => {
                const isToday = sameDay(date, new Date());
                const openN = cell.filter((v) => v.caregiverName === null).length;
                const coveredN = cell.length - openN;
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => {
                      setDayCursor(date);
                      setView("day");
                    }}
                    className={cn("flex min-h-24 flex-col items-start gap-[3px] border-b border-r border-[var(--hairline-soft)] px-2.5 py-2 text-left transition-colors hover:bg-[var(--wash)]", isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-[var(--paper)]" : "bg-[var(--paper-sunken)]")}
                  >
                    <span className={cn("text-xs tabular-nums", isToday ? "font-semibold text-primary" : inMonth ? "text-[var(--ink-body)]" : "text-muted-foreground/40")}>{date.getDate()}</span>
                    {cell.length > 0 && (
                      <>
                        <span className="text-[11.5px] text-[var(--ink-body)]">
                          {coveredN} {coveredN === 1 ? "visit" : "visits"}
                        </span>
                        {openN > 0 && <span className="text-[11.5px] font-medium text-primary">{openN} open</span>}
                      </>
                    )}
                    {offOn(date).map((o) => (
                      <span key={o.id} className="max-w-full truncate rounded-[5px] bg-[#FFFAEB] px-1.5 text-[11px] font-medium text-[#B54708]">
                        {o.caregiverName} off
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ScopeDialog
        open={scoping !== null}
        onOpenChange={(o) => !o && setScoping(null)}
        visit={scoping}
        allVisits={visits}
        recurrenceLine={scoping ? recurrenceLine(scoping) : null}
        fmtDay={(iso) => shortDay(iso)}
        onContinue={(scope, affected) => {
          if (scoping) setEditing({ visit: scoping, scope, affected });
          setScoping(null);
        }}
      />
      <EditVisitDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        visit={editing?.visit ?? null}
        scope={editing?.scope ?? "this"}
        affected={editing?.affected ?? []}
        allVisits={visits}
        clockedInAt={editing ? clockFor(editing.visit).inAt : null}
        clockedOutAt={editing ? clockFor(editing.visit).outAt : null}
        rate={editing ? payRateOf(editing.visit.caregiverName) : null}
        standardRate={editing ? payRateOf(editing.visit.caregiverName) : null}
        clientRate={editing ? clientRateOf(editing.visit) : null}
        pay={editing ? visitPay[editing.visit.id] ?? null : null}
        currentUserName={currentUser.name}
        showProfit={showProfit}
        expenses={editing ? visitExpenses[editing.visit.id] ?? [] : []}
        gpsMiles={null}
        mix={editing ? mixOf(editing.visit) : DEFAULT_MIX}
        locations={editing ? locationsOf(editing.visit) : []}
        pings={editing ? pingsOf(editing.visit) : []}
        otherHoursThisWeek={editing ? otherHoursThisWeek(editing.visit) : 0}
        payrollWeek={editing ? agencyWeekLabel(editing.visit.startsAt) : ""}
        mileage={editing ? visitMileage[editing.visit.id] ?? null : null}
        mileageRatePerMile={settings.mileageRatePerMile}
        onProposeLocation={(label, address) => {
          if (!editing) return null;
          const id = personIdOf(editing.visit);
          if (!id) return null;
          const loc = proposeLocation({ clientPersonId: id, label, address, by: currentUser.name, at: new Date().toISOString() });
          addApprovedLocation(loc);
          return loc;
        }}
        onSave={saveEdit}
        review={reviewEdit}
        onAskForPhone={(name) => {
          askForPhone(name, currentUser.name, new Date().toISOString());
          setToastLine({ title: `Asked ${name.split(" ")[0]} for her number`, sub: "It is on her Joy app home now — nothing was texted, Spruce is still not wired." });
        }}
        phoneAskPending={editing?.visit.caregiverName ? phoneAsks[editing.visit.caregiverName]?.answeredAt === null : false}
      />

      {undoOff && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Undo this time off?">
          <div className="absolute inset-0 bg-[rgba(25,26,46,.24)]" onClick={() => setUndoOff(null)} />
          <div className="relative flex w-full max-w-[420px] flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] shadow-[0_24px_60px_rgba(25,26,46,.18)]">
            <div className="flex flex-col gap-[5px] px-[22px] pt-5">
              <span className="text-[17px] font-semibold tracking-[-.01em]">Undo this time off?</span>
              <span className="text-[13px] text-muted-foreground">
                {undoOff.caregiverName} · {timeOffLabel(undoOff)}
              </span>
            </div>
            <div className="flex flex-col gap-3 px-[22px] py-[18px]">
              <p className="m-0 text-[13px] leading-[1.5] text-[var(--ink-body)] [text-wrap:pretty]">
                {undoOff.caregiverName} goes back on the board for {undoOff.from === undoOff.to ? "that day" : "those days"}, and the open shifts the request created come off it.
              </p>
              {coverDecisions.some((d) => visits.some((v) => v.id === d.visitId && v.coverFor === undoOff.caregiverName && dateOnly(v.startsAt) >= undoOff.from && dateOnly(v.startsAt) <= undoOff.to)) && (
                <p className="m-0 rounded-[9px] bg-[#FFFAEB] px-3 py-2 text-[12.5px] leading-[1.45] text-[#B54708]">A family has already confirmed they do not need a replacement on one of these days. That decision goes with it.</p>
              )}
              {undoOff.reason && (
                <p className="m-0 text-[12.5px] leading-[1.45] text-muted-foreground">
                  Recorded by {undoOff.recordedBy} — “{undoOff.reason}”
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--hairline)] px-[22px] py-3.5">
              <button type="button" onClick={() => setUndoOff(null)} className="h-[38px] rounded-[10px] px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[var(--wash)]">
                Keep the time off
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelTimeOff(undoOff.id);
                  setToastLine({ title: `${undoOff.caregiverName} is back on the board`, sub: `Time off for ${timeOffLabel(undoOff)} undone — the shifts it opened are closed.` });
                  setUndoOff(null);
                }}
                className="h-[38px] rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              >
                Undo the request
              </button>
            </div>
          </div>
        </div>
      )}

      <LogActivityDialog
        open={logging !== null}
        onOpenChange={(o) => !o && setLogging(null)}
        initialChannel="phone"
        subjectName={logging?.clientName ?? ""}
        suggestedParty={loggingClient?.responsiblePartyName ?? null}
        giftsSoFar={loggingId ? giftSummaryLine(giftTotalFor(interactions, "client", loggingId, year), year) : null}
        onSave={(draft) => {
          if (!logging || !loggingId) return;
          logActivity({ draft, subject: { kind: "client", id: loggingId, name: logging.clientName } });
          setToastLine({ title: `Logged on ${logging.clientName}'s record`, sub: "It is on the activity feed and in the trail." });
        }}
      />
      <ScheduleEditDialog
        open={scheduleEditing !== null}
        onOpenChange={(o) => !o && setScheduleEditing(null)}
        schedule={scheduleEditing}
        visits={visits}
        caregivers={seedEmployees.filter((e) => e.role !== "office" && e.status === "active").map((e) => e.name)}
        hourlyRate={selected ? clientRateOf(selected) : null}
        currentUserName={currentUser.name}
        onRevise={(rev) => {
          reviseSchedule(rev);
          setScheduleEditing(null);
          setSelected(null);
          setToastLine({ title: `${rev.started.clientName}'s schedule changes from ${shortDay(rev.started.startsOn)}`, sub: `${describeSchedule(rev.started)} — the old visits are off the board from that day and the new ones are booked 3 months ahead.` });
        }}
      />
      <ScopeDialog
        open={cancelling !== null}
        onOpenChange={(o) => !o && setCancelling(null)}
        visit={cancelling}
        allVisits={visits}
        recurrenceLine={cancelling ? recurrenceLine(cancelling) : null}
        fmtDay={(iso) => shortDay(iso)}
        onContinue={(_scope, affected) => {
          setCancelling(null);
          setToastLine({ title: `${affected.length} ${affected.length === 1 ? "visit" : "visits"} to cancel`, sub: "Cancelling lands with the developer — nobody has been told yet." });
        }}
      />

      {moveConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Change this visit?">
          <div className="absolute inset-0 bg-[rgba(25,26,46,.24)]" onClick={() => setMoveConfirm(null)} />
          <div className="relative flex w-full max-w-[452px] flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] shadow-[0_24px_60px_rgba(25,26,46,.18)]">
            <div className="flex flex-col gap-[5px] px-[22px] pt-5">
              <span className="text-[17px] font-semibold tracking-[-.01em]">Change this visit?</span>
              <span className="text-[13px] text-muted-foreground">
                {moveConfirm.visit.clientName} · {moveConfirm.visit.service}
              </span>
            </div>
            <div className="flex flex-col gap-4 px-[22px] py-[18px]">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3.5 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">From</span>
                  <span className="text-[13.5px] text-[var(--ink-body)]">
                    {fmtLong(new Date(moveConfirm.visit.startsAt))} · {fmtTime(moveConfirm.visit.startsAt)}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground/60" aria-hidden="true">
                  →
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">To</span>
                  <span className="text-[13.5px] font-semibold">
                    {fmtLong(moveConfirm.to)} · {fmtTime(moveConfirm.visit.startsAt)}
                  </span>
                </span>
              </div>
              <div className="flex flex-col">
                {(
                  [
                    ["Caregiver", moveConfirm.visit.caregiverName ?? "Unassigned", ""],
                    ["Duration", `${hoursOf(moveConfirm.visit).toFixed(1).replace(/\.0$/, "")} hrs · ${fmtTime(moveConfirm.visit.startsAt)} – ${fmtTime(moveConfirm.visit.endsAt)}`, ""],
                    ["Checks", moveBlocked ? moveChecks.find((c) => c.severity === "blocking")?.message ?? "Conflict" : moveChecks.length > 0 ? moveChecks[0].message : "Availability and double-booking clear", moveBlocked ? "text-[#B42318]" : moveChecks.length > 0 ? "text-[#B54708]" : "text-[#027A48]"],
                  ] as Array<[string, string, string]>
                ).map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2">
                    <span className="w-[104px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
                    <span className={cn("text-[13px]", tone)}>{value}</span>
                  </div>
                ))}
              </div>
              {moveBlocked && (
                <div className="flex flex-col gap-[7px] rounded-xl border border-[#FBD9D3] bg-[#FEF3F2] px-3.5 py-3">
                  <span className="text-[13px] font-semibold text-[#B42318]">This change creates a scheduling conflict.</span>
                  <span className="text-[12.5px] leading-[1.45] text-[#912018]">{moveChecks.find((c) => c.severity === "blocking")?.message}</span>
                </div>
              )}
              {!moveBlocked && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Who this change affects</span>
                  {[moveConfirm.visit.caregiverName ?? "Assigned caregiver", `${moveConfirm.visit.clientName} / family contact`].map((who) => (
                    <span key={who} className="flex items-center gap-2">
                      <span className="text-[12.5px]">{who}</span>
                      <span className="text-[11.5px] text-muted-foreground">Spruce · not wired yet</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 rounded-b-2xl border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-[22px] py-3.5">
              <button type="button" onClick={() => setMoveConfirm(null)} className="h-[38px] flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash-strong)] hover:text-foreground">
                {moveBlocked ? "Keep original" : "Cancel"}
              </button>
              <button type="button" disabled={moveBlocked} onClick={confirmMove} className="h-[38px] flex-[1.4] rounded-[10px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1] disabled:cursor-not-allowed disabled:opacity-50">
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangeConfirmSheet
        change={confirming?.change ?? null}
        onCancel={() => {
          confirming?.onCancel?.();
          setConfirming(null);
        }}
        onConfirm={() => {
          confirming?.commit();
          setConfirming(null);
        }}
      />

      {toastLine && (
        <div className="fixed bottom-[26px] left-1/2 z-[90] -translate-x-1/2" role="status">
          <div className="flex min-w-[340px] items-center gap-3.5 rounded-xl bg-[var(--ink-strong)] px-4 py-3 shadow-[0_12px_32px_rgba(25,26,46,.24)]">
            <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[#12B76A] text-[10px] font-bold text-white">✓</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-white">{toastLine.title}</span>
              <span className="text-[11.5px] text-white/[.62]">{toastLine.sub}</span>
            </span>
            <button type="button" aria-label="Dismiss" onClick={() => setToastLine(null)} className="ml-auto flex-none px-0.5 text-[13px] text-white/60">
              ✕
            </button>
          </div>
        </div>
      )}

      <CoverageBuilder
        open={coverageOpen || coverageEditing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCoverageOpen(false);
            setCoverageEditing(null);
          }
        }}
        visits={visits}
        timeOff={timeOff}
        today={today}
        clients={clientNames}
        editing={coverageEditing}
      />
      <NewVisitDialog open={adding !== null} onOpenChange={(o) => !o && setAdding(null)} kind={adding?.kind ?? "shift"} repeatByDefault={adding?.repeat ?? false} visits={visits} onAdded={(d) => toast("Added to the schedule", { description: d })} />
      <TimeOffDialog
        open={offOpen}
        onOpenChange={setOffOpen}
        visits={visits}
        onRecord={(draft) => {
          const n = visitsAffected(visits, draft).length;
          requestTimeOff(draft);
          toast(`${draft.caregiverName} is off ${timeOffLabel(draft)}`, {
            description: n === 0 ? "Nothing on the schedule needed covering." : `${n} ${n === 1 ? "shift needs" : "shifts need"} cover — open ${n === 1 ? "it" : "each one"} and Joy will say who can take it.`,
          });
        }}
      />
      <VisitSheet
        visit={selected}
        onClose={() => setSelected(null)}
        allVisits={visits}
        today={today}
        transportConsent={selected ? transportConsentFor(selected.clientName) : undefined}
        clientRate={selected ? clientRateOf(selected) : null}
        payRateFor={showProfit ? payRateOf : undefined}
        onAssign={(id, name) => {
          const v = visits.find((x) => x.id === id);
          if (!v) return;
          const before = v.caregiverName;
          const checks = findConflicts({ ...v, caregiverName: name }, visits);
          const blocker = checks.find((c) => c.severity === "blocking");
          const warning = checks.find((c) => c.severity !== "blocking");
          setSelected(null);
          setConfirming({
            change: {
              kind: before === null ? "assign" : "reassign",
              clientName: v.clientName,
              service: v.service,
              when: `${fmtLong(new Date(v.startsAt))} · ${fmtTime(v.startsAt)} – ${fmtTime(v.endsAt)}`,
              rows: [{ label: "Caregiver", from: before, to: name }],
              affects: [...(before ? [before] : []), name, `${v.clientName} / family contact`],
              visitCount: 1,
              blocker: blocker?.message ?? null,
              warning: warning?.message ?? null,
            },
            commit: () => {
              assignShift(id, name);
              setToastLine({ title: before === null ? `Shift assigned to ${name}` : `${name} takes this visit`, sub: "Saved on this device — Spruce notification is not wired in the prototype" });
            },
            onCancel: () => setSelected(v),
          });
        }}
        status={selected ? statusOf(selected) : "upcoming"}
        earlyStartAllowed={selected ? earlyStarts[selected.id] === true : false}
        onAuthorizeEarlyStart={authorizeEarlyStart}
        graceMinutes={settings.earlyClockInGraceMinutes}
        timeOff={timeOff}
        clockLine={selected ? clockLineFor(selected) : null}
        missedClockIn={selected !== null && selected.caregiverName !== null && selectedClock.inAt === null && selected.eventType === undefined && now.getTime() > new Date(selected.startsAt).getTime() + settings.missedClockInEscalationMinutes * 60_000}
        missingClockOut={selected ? clockState({ clockedInAt: selectedClock.inAt, clockedOutAt: selectedClock.outAt, scheduledEndsAt: selected.endsAt, now }) === "missing_clock_out" : false}
        clockedInAt={selectedClock.inAt}
        clockedOutAt={selectedClock.outAt}
        clockAttempts={clockAttempts}
        visitChanges={visitChanges}
        escalateAfterMinutes={settings.missedClockInEscalationMinutes}
        proposal={selected ? clockProposals[`${selected.id}:in`] ?? clockProposals[`${selected.id}:out`] ?? null : null}
        onDecideProposal={(key, approved) => {
          decideClockProposal(key, approved, currentUser.name);
          setToastLine({ title: approved ? "Approved" : "Not approved", sub: approved ? "The time is on the board and goes to payroll." : "Record the time yourself below — nothing has been written." });
        }}
        currentUser={currentUser}
        onCorrectClockOut={(id, input) => {
          recordClockCorrection({ visitId: id, clockedInAt: input.clockedInAt, clockedOutAt: input.clockedOutAt, reasonCode: input.reasonCode, actionCode: input.actionCode, note: input.note, by: currentUser.name, at: new Date().toISOString() });
          setClockPlace(id, "out", input.place);
          setToastLine({
            title: stopsBilling(input.actionCode) ? "Recorded — held out of billing" : "Clock-out recorded",
            sub: stopsBilling(input.actionCode) ? "Marked unverified against the visit. Billing does not read that yet — take it off the draft by hand." : `${correctionSummary(input)} — the schedule and payroll now read the same hours.`,
          });
        }}
        coverDecision={selected ? coverDecisionFor(coverDecisions, selected.id) : null}
        lastMovedTo={selected ? dayMoves[selected.id] ?? null : null}
        recurrenceLine={selected ? recurrenceLine(selected) : null}
        onEditSchedule={selected && scheduleOf(selected) ? () => setScheduleEditing(scheduleOf(selected)) : undefined}
        onEditVisit={() => {
          if (!selected) return;
          if (alreadyWorked(selected, new Date()) || !selected.seriesId) setEditing({ visit: selected, scope: "this", affected: [selected] });
          else setScoping(selected);
        }}
        onLogCall={() => selected && setLogging(selected)}
        onCancelVisit={() => setCancelling(selected)}
        onDeclineCover={(id, who, note) => {
          declineCover({ visitId: id, confirmedWith: who, note: note || null });
          setToastLine({ title: `${who.trim()} confirmed no replacement`, sub: "The shift stays on the board with the decision against it." });
        }}
      />
    </>
  );
}
