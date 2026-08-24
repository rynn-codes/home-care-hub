import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemo } from "@/context/DemoDataProvider";
import { consentSessionForClient } from "@/lib/demoStore";
import { AssignCaregiver } from "@/components/scheduling/AssignCaregiver";
import { seedClients } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import {
  findConflicts,
  hoursOf,
  openShifts,
  scheduleConflicts,
  OVERTIME_THRESHOLD_HOURS,
  type Visit,
} from "@/domain/scheduling/conflicts";
import { cn } from "@/lib/utils";

/**
 * Scheduling, to the approved mock (docs/mockups/Joy Health Scheduling
 * .dc.html): the 252px rail of quiet white cards — Needs you with its colored
 * dots, This week's counts, Ask Joy prompts — beside the week canvas of small
 * white visit cards with OPEN and CONFLICT pills, dashed borders on open
 * shifts and avatar chips on covered ones. Day and Month views are the mock's
 * own; dragging a visit to another day raises the mock's confirm sheet, and a
 * confirmed change lands as the dark toast.
 *
 * §7 of the Scheduling Build Spec makes Week the primary office workspace;
 * §9 governs how a visit reads — no large coloured blocks, no rainbow
 * caregiver colours, no badge stacks. There is ONE Joy schedule (§20):
 * assessments booked in Admissions appear here because they are events on
 * this schedule, not on a separate admissions calendar (§15).
 *
 * One honesty departure from the mock: it announces "notified through
 * Spruce" on every change. Nothing here sends anything, so this screen says
 * so instead — a moved shift is saved on this device and the toast names the
 * missing wire.
 */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const QUICK_ADD: Array<{ label: string; to?: string; note?: string }> = [
  { label: "New shift", note: "Not built yet — shifts come from the seed and Admissions" },
  { label: "Recurring schedule", note: "Not built yet" },
  { label: "Client visit", note: "Not built yet" },
  { label: "Assessment", to: "/admissions" },
  { label: "Orientation", note: "Not built yet" },
  { label: "Supervisor visit", to: "/clients/supervision" },
];
const JOY_PROMPTS = [
  "Who can cover Ruth's shift this week?",
  "Show scheduling conflicts this week",
  "Show everyone approaching overtime",
];

function startOfWeek(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtLong(date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** Move a visit to another calendar day, keeping its time of day and length. */
function movedTo(v: Visit, target: Date): Visit {
  const start = new Date(v.startsAt);
  const end = new Date(v.endsAt);
  const length = end.getTime() - start.getTime();
  const s = new Date(target);
  s.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return { ...v, startsAt: s.toISOString(), endsAt: new Date(s.getTime() + length).toISOString() };
}

type ViewMode = "day" | "week" | "month";

const pill = {
  open: "inline-flex items-center whitespace-nowrap rounded-full bg-[#EEF0FE] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-primary",
  conflict: "inline-flex items-center whitespace-nowrap rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-[#B42318]",
  confirmed: "inline-flex items-center whitespace-nowrap rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-semibold tracking-[.03em] text-[#027A48]",
};

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function Scheduling() {
  const { scheduleEvents, assignments, assignShift, consentSessions, admissions } = useDemo();
  const [view, setView] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayCursor, setDayCursor] = useState(() => new Date());
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Visit | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{ visit: Visit; to: Date } | null>(null);
  // Session-only: moves made by dragging. The demo has no schedule store yet.
  const [dayMoves, setDayMoves] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ title: string; sub: string } | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  /** Whether this client agreed to be driven. Undefined when nobody asked. */
  const transportConsentFor = (clientName: string): boolean | undefined => {
    const session = consentSessionForClient({ admissions, consentSessions }, clientName);
    const decision = session?.decisions?.transportation;
    if (!decision) {
      const seeded = seedClients.find((c) => `${c.firstName} ${c.lastName}` === clientName);
      const seededDecision = seeded?.decisions?.transportation;
      return seededDecision ? seededDecision === "agree" : undefined;
    }
    return decision === "agree";
  };

  const weekStart = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  // Assessments booked through Admissions are visits on this same board.
  const visits: Visit[] = useMemo(() => {
    const booked: Visit[] = scheduleEvents.map((e) => ({
      id: e.id,
      clientName: e.clientName,
      service: "RN Assessment",
      caregiverName: e.assessorName,
      startsAt: e.startsAt,
      endsAt: new Date(new Date(e.startsAt).getTime() + e.durationMinutes * 60_000).toISOString(),
      eventType: e.eventType,
    }));
    return [...seedVisits, ...booked].map((v) => {
      let out = assignments[v.id] ? { ...v, caregiverName: assignments[v.id] } : v;
      if (dayMoves[out.id]) out = movedTo(out, new Date(dayMoves[out.id]));
      return out;
    });
  }, [scheduleEvents, assignments, dayMoves]);

  const matches = (v: Visit) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${v.clientName} ${v.caregiverName ?? "open"} ${v.service}`.toLowerCase().includes(needle);
  };

  const weekVisits = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return visits.filter((v) => {
      const t = new Date(v.startsAt).getTime();
      return t >= weekStart.getTime() && t < end.getTime();
    });
  }, [visits, weekStart]);

  const byDay = useMemo(() => {
    const buckets: Visit[][] = [[], [], [], [], [], [], []];
    for (const v of weekVisits) {
      if (!matches(v)) continue;
      buckets[(new Date(v.startsAt).getDay() + 6) % 7].push(v);
    }
    for (const b of buckets) b.sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekVisits, q]);

  const open = useMemo(() => openShifts(weekVisits), [weekVisits]);
  const conflicts = useMemo(() => scheduleConflicts(weekVisits), [weekVisits]);
  const conflictedIds = useMemo(
    () =>
      new Set(
        weekVisits
          .filter((v) => findConflicts(v, weekVisits).some((c) => c.severity === "blocking"))
          .map((v) => v.id),
      ),
    [weekVisits],
  );
  const covered = open.length === 0 && conflicts.length === 0;

  const weeklyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const v of weekVisits) {
      if (!v.caregiverName) continue;
      totals[v.caregiverName] = (totals[v.caregiverName] ?? 0) + hoursOf(v);
    }
    return totals;
  }, [weekVisits]);
  const approachingOvertime = Object.values(weeklyTotals).filter(
    (h) => h >= OVERTIME_THRESHOLD_HOURS - 8,
  ).length;

  const rangeLabel = useMemo(() => {
    if (view === "day") return fmtLong(dayCursor);
    if (view === "month")
      return dayCursor.toLocaleDateString([], { month: "long", year: "numeric" });
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekStart.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}, ${end.getFullYear()}`;
  }, [view, weekStart, dayCursor]);

  const step = (dir: -1 | 1) => {
    if (view === "week") setWeekOffset((w) => w + dir);
    else if (view === "day") setDayCursor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir));
    else setDayCursor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const statusOf = (v: Visit): "open" | "conflict" | "confirmed" =>
    v.caregiverName === null ? "open" : conflictedIds.has(v.id) ? "conflict" : "confirmed";

  const confirmMove = () => {
    if (!moveConfirm) return;
    setDayMoves((m) => ({ ...m, [moveConfirm.visit.id]: moveConfirm.to.toISOString() }));
    setMoveConfirm(null);
    setToast({
      title: "Schedule updated",
      sub: "Saved on this device — Spruce notification is not wired in the prototype",
    });
  };

  const moveChecks = useMemo(() => {
    if (!moveConfirm) return [];
    const proposed = movedTo(moveConfirm.visit, moveConfirm.to);
    return findConflicts(proposed, visits.filter((v) => v.id !== proposed.id));
  }, [moveConfirm, visits]);
  const moveBlocked = moveChecks.some((c) => c.severity === "blocking");

  const dayVisits = visits
    .filter((v) => sameDay(new Date(v.startsAt), dayCursor) && matches(v))
    .sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());

  const monthCells = useMemo(() => {
    const first = new Date(dayCursor.getFullYear(), dayCursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const cellVisits = visits.filter((v) => sameDay(new Date(v.startsAt), date));
      return { date, inMonth: date.getMonth() === dayCursor.getMonth(), visits: cellVisits };
    });
  }, [dayCursor, visits]);

  return (
    <>
      <PageHeader
        title="Scheduling"
        description="Manage client schedules, caregiver assignments, and open shifts."
        actions={
          <>
            <div className="flex h-[34px] w-[196px] items-center gap-2 rounded-[9px] border border-[#ECECF1] bg-white px-2.5">
              <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Client or caregiver"
                aria-label="Search client or caregiver"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                >
                  <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                  Quick add
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[212px] rounded-xl p-1.5">
                {QUICK_ADD.map((item) =>
                  item.to ? (
                    <DropdownMenuItem key={item.label} asChild className="rounded-lg px-2.5 py-2 text-[12.5px]">
                      <Link to={item.to}>
                        <span className="mr-1 text-muted-foreground">+</span>
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={item.label} disabled title={item.note} className="rounded-lg px-2.5 py-2 text-[12.5px]">
                      <span className="mr-1 text-muted-foreground">+</span>
                      {item.label}
                      <span className="ml-auto text-[10.5px] text-muted-foreground">soon</span>
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            aria-label={`Previous ${view}`}
            onClick={() => step(-1)}
            className="h-[30px] w-[30px] rounded-lg border border-[#ECECF1] bg-white text-muted-foreground transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              setWeekOffset(0);
              setDayCursor(new Date());
            }}
            className="h-[30px] rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] transition-colors hover:bg-[#FAFAFB]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label={`Next ${view}`}
            onClick={() => step(1)}
            className="h-[30px] w-[30px] rounded-lg border border-[#ECECF1] bg-white text-muted-foreground transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
          >
            ›
          </button>
        </div>
        <span className="text-base font-semibold tracking-[-.015em]">{rangeLabel}</span>
        <div className="ml-auto flex gap-0.5 rounded-[9px] bg-[#F1F2F6] p-[3px]" role="tablist" aria-label="Calendar views">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-7 rounded-[7px] px-3.5 text-[12.5px] capitalize transition-colors",
                view === v
                  ? "bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[252px_1fr]">
        <div className="flex flex-col gap-3.5">
          {/* Needs you — §17: only actionable items, a plain statement when none. */}
          <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
              Needs you
            </h2>
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
                    className="flex w-full items-start gap-2.5 rounded-[9px] p-2 text-left transition-colors hover:bg-[#FAFAFB]"
                  >
                    <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-primary" aria-hidden="true" />
                    <span className="flex flex-col leading-[1.3]">
                      <span className="text-[13px]">
                        {open.length} open {open.length === 1 ? "shift" : "shifts"}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {open
                          .map(
                            (v) =>
                              `${DAY_NAMES[(new Date(v.startsAt).getDay() + 6) % 7]} · ${v.clientName}`,
                          )
                          .join(" · ")}
                      </span>
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
                    className="flex w-full items-start gap-2.5 rounded-[9px] p-2 text-left transition-colors hover:bg-[#FAFAFB]"
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

          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
              This week
            </h2>
            <div className="flex flex-col">
              {[
                { label: "Scheduled visits", value: String(weekVisits.filter((v) => v.caregiverName !== null).length) },
                { label: "Open shifts", value: String(open.length), accent: open.length > 0 },
                { label: "Caregivers working", value: String(Object.keys(weeklyTotals).length) },
                { label: "Approaching overtime", value: String(approachingOvertime), warn: approachingOvertime > 0 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-[7px] last:border-b-0">
                  <span className="text-[12.5px] text-muted-foreground">{row.label}</span>
                  <span
                    className={cn(
                      "ml-auto text-[12.5px] font-medium tabular-nums",
                      row.accent && "text-primary",
                      row.warn && "text-[#B54708]",
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <span className="flex items-center gap-2">
              <span
                className="h-[7px] w-[7px] flex-none rounded-full bg-[#8FA0FF]"
                style={{ animation: "joyGlow 2.6s ease-in-out infinite" }}
                aria-hidden="true"
              />
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Ask Joy
              </h2>
            </span>
            <div className="flex flex-col gap-px">
              {JOY_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: p } }))
                  }
                  className="rounded-lg p-2 text-left text-[12.5px] leading-[1.4] text-muted-foreground transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        </div>

        {view === "week" && (
          <div className="overflow-x-auto rounded-[14px] border border-[#ECECF1] bg-white">
            <div className="grid min-w-[840px] grid-cols-7">
              {DAY_NAMES.map((name, i) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + i);
                const isToday = sameDay(date, new Date());
                return (
                  <div
                    key={name}
                    className={cn(
                      "flex flex-col gap-px border-b border-[#ECECF1] bg-[#FCFCFD] px-3 py-2.5",
                      i < 6 && "border-r border-r-[#F3F3F6]",
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                      {name}
                    </span>
                    <span className={cn("text-[15px] font-semibold tracking-[-.01em] tabular-nums", isToday && "text-primary")}>
                      {date.getDate()}
                    </span>
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
                    if (sameDay(new Date(v.startsAt), target)) return;
                    setMoveConfirm({ visit: v, to: target });
                  }}
                  className={cn(
                    "flex min-h-[280px] flex-col gap-[7px] p-2",
                    i < 6 && "border-r border-[#F3F3F6]",
                    overCol === i ? "bg-[#F7F8FE]" : i > 4 ? "bg-[#FCFCFD]" : "bg-white",
                  )}
                >
                  {byDay[i].length === 0 && (
                    <span className="px-0.5 py-1.5 text-[11.5px] text-muted-foreground/40">No visits</span>
                  )}
                  {byDay[i].map((v) => {
                    const status = statusOf(v);
                    return (
                      <div
                        key={v.id}
                        draggable
                        onDragStart={() => setDragId(v.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onClick={() => setSelected(v)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected(v);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "flex cursor-grab flex-col gap-0.5 rounded-[10px] border bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(25,26,46,.04)] transition-colors",
                          status === "open" && "border-dashed border-[#D6D8EA] bg-[#FBFBFE]",
                          status === "conflict" && "border-[#FBD9D3] bg-[#FFFBFA]",
                          status === "confirmed" && "border-[#ECECF1]",
                          dragId === v.id && "opacity-40",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#5B6274]">{fmtTime(v.startsAt)}</span>
                          {status === "open" && <span className={pill.open}>OPEN</span>}
                          {status === "conflict" && <span className={pill.conflict}>CONFLICT</span>}
                        </span>
                        <span className="break-words text-[13px] font-medium leading-[1.3]">{v.clientName}</span>
                        <span className="break-words text-[11.5px] leading-[1.35] text-muted-foreground">{v.service}</span>
                        <span className="flex items-center gap-1.5 pt-0.5">
                          {v.caregiverName ? (
                            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[8.5px] font-semibold text-primary">
                              {initialsOf(v.caregiverName)}
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-dashed border-[#C9C9D0] text-[9px] text-muted-foreground/60">
                              ?
                            </span>
                          )}
                          <span
                            className={cn(
                              "min-w-0 truncate text-[11.5px]",
                              v.caregiverName ? "text-[#5B6274]" : "font-medium text-primary",
                            )}
                          >
                            {v.caregiverName ?? "Open"}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {fmtTime(v.startsAt)} – {fmtTime(v.endsAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "day" && (
          <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
            <div className="flex items-center gap-2.5 border-b border-[#ECECF1] px-4 py-3.5">
              <span className="text-sm font-semibold">{fmtLong(dayCursor)}</span>
              <span className="ml-auto text-[12.5px] text-muted-foreground">
                {dayVisits.length} {dayVisits.length === 1 ? "visit" : "visits"}
              </span>
            </div>
            {dayVisits.length === 0 && (
              <p className="px-4 py-6 text-[13px] text-muted-foreground">Nothing scheduled this day.</p>
            )}
            {dayVisits.map((v) => {
              const status = statusOf(v);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected(v)}
                  className="flex w-full gap-4 border-b border-[#F3F3F6] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[#FAFAFB]"
                >
                  <span className="flex w-24 flex-none flex-col leading-[1.3]">
                    <span className="text-[13px] font-semibold tabular-nums">{fmtTime(v.startsAt)}</span>
                    <span className="text-[11.5px] text-muted-foreground tabular-nums">{fmtTime(v.endsAt)}</span>
                  </span>
                  <span
                    className={cn(
                      "w-0.5 flex-none rounded-sm",
                      status === "open" ? "bg-[#C9CEF2]" : status === "conflict" ? "bg-[#FBD9D3]" : "bg-[#E4E4EA]",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-sm font-medium">{v.clientName}</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {v.service} · {hoursOf(v).toFixed(1).replace(/\.0$/, "")} hrs
                    </span>
                  </span>
                  <span className="ml-auto flex flex-none items-center gap-3">
                    {status === "open" && <span className={pill.open}>OPEN</span>}
                    {status === "conflict" && <span className={pill.conflict}>CONFLICT</span>}
                    <span className="flex items-center gap-2">
                      {v.caregiverName ? (
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[8.5px] font-semibold text-primary">
                          {initialsOf(v.caregiverName)}
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-dashed border-[#C9C9D0] text-[9px] text-muted-foreground/60">
                          ?
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[12.5px]",
                          v.caregiverName ? "text-[#5B6274]" : "font-medium text-primary",
                        )}
                      >
                        {v.caregiverName ?? "Unassigned"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {view === "month" && (
          <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
            <div className="grid grid-cols-7">
              {DAY_NAMES.map((w) => (
                <div
                  key={w}
                  className="border-b border-[#ECECF1] bg-[#FCFCFD] px-3 py-2 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                >
                  {w}
                </div>
              ))}
              {monthCells.map(({ date, inMonth, visits: cellVisits }) => {
                const isToday = sameDay(date, new Date());
                const openN = cellVisits.filter((v) => v.caregiverName === null).length;
                const coveredN = cellVisits.length - openN;
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => {
                      setDayCursor(date);
                      setView("day");
                    }}
                    className={cn(
                      "flex min-h-24 flex-col items-start gap-[3px] border-b border-r border-[#F3F3F6] px-2.5 py-2 text-left transition-colors hover:bg-[#FAFAFB]",
                      isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-white" : "bg-[#FCFCFD]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        isToday ? "font-semibold text-primary" : inMonth ? "text-[#5B6274]" : "text-muted-foreground/40",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {cellVisits.length > 0 && (
                      <>
                        <span className="text-[11.5px] text-[#5B6274]">
                          {coveredN} {coveredN === 1 ? "visit" : "visits"}
                        </span>
                        {openN > 0 && (
                          <span className="text-[11.5px] font-medium text-primary">{openN} open</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data plus anything you booked through Admissions. Conflict detection is real and
        tested; a dragged move saves on this device only, and recurring visits are not built yet.
      </p>

      {/* The mock's confirm sheet for a dragged move. */}
      {moveConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Change this visit?">
          <div className="absolute inset-0 bg-[rgba(25,26,46,.24)]" onClick={() => setMoveConfirm(null)} />
          <div className="relative flex w-full max-w-[452px] flex-col rounded-2xl border border-[#ECECF1] bg-white shadow-[0_24px_60px_rgba(25,26,46,.18)]">
            <div className="flex flex-col gap-[5px] px-[22px] pt-5">
              <span className="text-[17px] font-semibold tracking-[-.01em]">Change this visit?</span>
              <span className="text-[13px] text-muted-foreground">
                {moveConfirm.visit.clientName} · {moveConfirm.visit.service}
              </span>
            </div>
            <div className="flex flex-col gap-4 px-[22px] py-[18px]">
              <div className="flex items-center gap-3 rounded-xl border border-[#ECECF1] bg-[#FCFCFD] px-3.5 py-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">From</span>
                  <span className="text-[13.5px] text-[#5B6274]">
                    {fmtLong(new Date(moveConfirm.visit.startsAt))} · {fmtTime(moveConfirm.visit.startsAt)}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground/60" aria-hidden="true">→</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">To</span>
                  <span className="text-[13.5px] font-semibold">
                    {fmtLong(moveConfirm.to)} · {fmtTime(moveConfirm.visit.startsAt)}
                  </span>
                </span>
              </div>

              <div className="flex flex-col">
                {[
                  ["Caregiver", moveConfirm.visit.caregiverName ?? "Unassigned", ""],
                  [
                    "Duration",
                    `${hoursOf(moveConfirm.visit).toFixed(1).replace(/\.0$/, "")} hrs · ${fmtTime(moveConfirm.visit.startsAt)} – ${fmtTime(moveConfirm.visit.endsAt)}`,
                    "",
                  ],
                  [
                    "Checks",
                    moveBlocked
                      ? moveChecks.find((c) => c.severity === "blocking")?.message ?? "Conflict"
                      : moveChecks.length > 0
                        ? moveChecks[0].message
                        : "Availability and double-booking clear",
                    moveBlocked ? "text-[#B42318]" : moveChecks.length > 0 ? "text-[#B54708]" : "text-[#027A48]",
                  ],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline gap-3.5 border-b border-[#F3F3F6] py-2">
                    <span className="w-[104px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
                    <span className={cn("text-[13px]", tone)}>{value}</span>
                  </div>
                ))}
              </div>

              {moveBlocked && (
                <div className="flex flex-col gap-[7px] rounded-xl border border-[#FBD9D3] bg-[#FEF3F2] px-3.5 py-3">
                  <span className="text-[13px] font-semibold text-[#B42318]">
                    This change creates a scheduling conflict.
                  </span>
                  <span className="text-[12.5px] leading-[1.45] text-[#912018]">
                    {moveChecks.find((c) => c.severity === "blocking")?.message}
                  </span>
                </div>
              )}

              {!moveBlocked && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    Who this change affects
                  </span>
                  {[moveConfirm.visit.caregiverName ?? "Assigned caregiver", `${moveConfirm.visit.clientName} / family contact`].map(
                    (who) => (
                      <span key={who} className="flex items-center gap-2">
                        <span className="text-[12.5px]">{who}</span>
                        <span className="text-[11.5px] text-muted-foreground">Spruce · not wired yet</span>
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 rounded-b-2xl border-t border-[#ECECF1] bg-[#FCFCFD] px-[22px] py-3.5">
              <button
                type="button"
                onClick={() => setMoveConfirm(null)}
                className="h-[38px] flex-1 rounded-[10px] border border-[#ECECF1] bg-white text-[13px] text-[#5B6274] transition-colors hover:bg-[#F1F2F6] hover:text-foreground"
              >
                {moveBlocked ? "Keep original" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={moveBlocked}
                onClick={confirmMove}
                className="h-[38px] flex-[1.4] rounded-[10px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-[26px] left-1/2 z-[90] -translate-x-1/2" role="status">
          <div className="flex min-w-[340px] items-center gap-3.5 rounded-xl bg-[#191A2E] px-4 py-3 shadow-[0_12px_32px_rgba(25,26,46,.24)]">
            <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[#12B76A] text-[10px] font-bold text-white">
              ✓
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-white">{toast.title}</span>
              <span className="text-[11.5px] text-white/[.62]">{toast.sub}</span>
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
              className="ml-auto flex-none px-0.5 text-[13px] text-white/60"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <VisitDrawer
        visit={selected}
        onClose={() => setSelected(null)}
        allVisits={visits}
        today={today}
        transportConsent={selected ? transportConsentFor(selected.clientName) : undefined}
        onAssign={(id, name) => {
          assignShift(id, name);
          setToast({
            title: `Shift assigned to ${name}`,
            sub: "Saved on this device — Spruce notification is not wired in the prototype",
          });
        }}
        status={selected ? statusOf(selected) : "confirmed"}
      />
    </>
  );
}

function VisitDrawer({
  visit,
  onClose,
  allVisits,
  today,
  transportConsent,
  onAssign,
  status,
}: {
  visit: Visit | null;
  onClose: () => void;
  allVisits: Visit[];
  today: string;
  /** Undefined when nobody has asked this client yet. */
  transportConsent?: boolean;
  onAssign: (visitId: string, caregiverName: string) => void;
  status: "open" | "conflict" | "confirmed";
}) {
  const conflicts = useMemo(
    () => (visit ? findConflicts(visit, allVisits) : []),
    [visit, allVisits],
  );

  return (
    <Sheet open={visit !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[452px]">
        {visit && (
          <>
            <SheetHeader className="space-y-1 text-left">
              <span
                className={cn(
                  "self-start",
                  status === "open" ? pill.open : status === "conflict" ? pill.conflict : pill.confirmed,
                )}
              >
                {status === "open" ? "OPEN SHIFT" : status === "conflict" ? "CONFLICT" : "CONFIRMED"}
              </span>
              <SheetTitle className="text-[17px] font-semibold tracking-[-.01em]">
                {visit.clientName}
              </SheetTitle>
              <SheetDescription className="text-[12.5px]">
                {visit.service} · {fmtLong(new Date(visit.startsAt))} · {fmtTime(visit.startsAt)} –{" "}
                {fmtTime(visit.endsAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#ECECF1] bg-[#FCFCFD] px-3.5 py-3">
              {visit.caregiverName ? (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
                  {initialsOf(visit.caregiverName)}
                </span>
              ) : (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-dashed border-[#C9C9D0] text-[13px] text-muted-foreground/60">
                  ?
                </span>
              )}
              <span className="flex flex-col leading-[1.3]">
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                  Assigned
                </span>
                <span className={cn("text-[13.5px] font-medium", !visit.caregiverName && "text-primary")}>
                  {visit.caregiverName ?? "Unassigned"}
                </span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {status === "open" ? "Needs coverage" : status === "conflict" ? "Double-booked" : "Confirmed"}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Details
              </h3>
              <div className="flex flex-col">
                {[
                  ["Client", visit.clientName, ""],
                  ["Service", visit.eventType === "rn_assessment" ? "RN assessment" : visit.service, ""],
                  ["Date", fmtLong(new Date(visit.startsAt)), ""],
                  ["Time", `${fmtTime(visit.startsAt)} – ${fmtTime(visit.endsAt)} · ${hoursOf(visit).toFixed(1).replace(/\.0$/, "")} hrs`, ""],
                  [
                    "Conflict check",
                    conflicts.length > 0 ? conflicts[0].message : "No conflicts found",
                    conflicts.some((c) => c.severity === "blocking")
                      ? "text-[#B42318]"
                      : conflicts.length > 0
                        ? "text-[#B54708]"
                        : "text-[#027A48]",
                  ],
                  ["Last notification", "None — Spruce is not wired in the prototype", "text-muted-foreground"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline gap-3.5 border-b border-[#F3F3F6] py-2">
                    <span className="w-[132px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
                    <span className={cn("min-w-0 text-[13px] [text-wrap:pretty]", tone)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {visit.caregiverName === null && visit.eventType !== "rn_assessment" && (
              <AssignCaregiver
                visit={visit}
                allVisits={allVisits}
                today={today}
                clientAgreedToTransport={transportConsent}
                onAssign={(name) => {
                  onAssign(visit.id, name);
                  onClose();
                }}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
