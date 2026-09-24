import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { morningBrief } from "@/domain/home/brief";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { weekBadge } from "@/domain/calendar/agencyWeek";
import { daysUntilHoliday, holidayAskText, holidaysBetween, HOLIDAY_ASK_DAYS, upcomingHolidays, usHolidayOn, type USHoliday } from "@/domain/calendar/usHolidays";
import { assigneeName, subjectHref, subjectLabel } from "@/domain/brain/subjects";
import { cameFrom, readReopen } from "@/lib/navigation";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { useMonitors } from "@/components/brain/useMonitors";
import { WhatJoyNoticed } from "@/components/brain/WhatJoyNoticed";
import { Confetti } from "@/components/home/Confetti";
import { nowIndex } from "@/components/home/nowIndex";
import { PageTitle } from "@/components/layout/PageTitle";
import { todaysAgenda } from "@/lib/joySeed";
import { seedClients } from "@/lib/clientsSeed";
import {
  AGENCY_WEEK,
  agencyDay,
  brainActivity,
  brainEvents,
  brainHandled,
  brainNeedsYou,
  brainWaiting,
  brainWorking,
  myEvents,
  myNeeds,
  myTomorrow,
  weekLabel,
  type BrainEvent,
  type MyEvent,
  type MyNeed,
} from "@/lib/brainSeed";

/**
 * The Brain — the agency at a glance, one level under Home.
 *
 * Not the home screen: the design's sidebar carries Home AND The Brain, and
 * this page's own breadcrumb reads "Home / The Brain / Overview". Home is the
 * morning — today's queue and what needs doing. The Brain is the wider read:
 * the written brief, what Joy is handling, the calendar, the log, and what
 * the monitors noticed.
 *
 * Five tabs: Overview · My Work · Joy Operations · Calendar · Activity. The
 * Overview leads with the Brain Brief — a written paragraph, not metrics —
 * backed by a "See why" drawer of the records behind each sentence, and closes
 * with What Joy noticed: the daily monitors' findings, worst first.
 *
 * Recorded deviations, same rules as every screen: the mock's light grays sit
 * at the accessible muted token; counts derive from the seed lists rather than
 * the mock's static 12/3/4/1; the mock's rate-change approval is an hours
 * change (client rates are never stored); every calendar week runs Sat–Fri;
 * and "Spruce" claims say "not wired yet" because nothing here sends anything.
 */

type View = "overview" | "mywork" | "operations" | "calendar" | "activity";
type Range = "today" | "week" | "month" | "custom";
type OpsTab = "handled" | "working" | "waiting" | "needs";
type EventFilter = "All" | BrainEvent["cat"];
type ActivityFilter = "All" | (typeof brainActivity)[number]["cat"];

const VIEWS: View[] = ["overview", "mywork", "operations", "calendar", "activity"];
const TASK_CATEGORIES = ["Follow-up", "Client", "Employee", "People", "Scheduling", "Billing", "Payroll", "Admissions", "Hiring", "Compliance"];
const ASSIGNEES = ["Karynn Verrett (me)", "Kelsey Westley, RN", "John Segura", "Chanel P", "Tanya R", "Joy (if authorized)"];
const EVENT_TYPES = ["General", "Medical", "Family", "Personal", "Transport", "Shift", "Billing", "Payroll"];
const FEED_URL = "https://joyhealth.example/cal/feed/karynn-verrett.ics";

const EYEBROW = "text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground";
const CARD = "rounded-[18px] border border-black/[.06] bg-[var(--paper)] shadow-[0_1px_2px_rgba(0,0,0,.02)]";

const CAT_COLOR: Record<BrainEvent["cat"], string> = {
  People: "text-[#7C3AED]",
  Payroll: "text-[#15803D]",
  Billing: "text-[#C2410C]",
  Agency: "text-primary",
};

const todayIso = () => {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

/** "2:00 PM" → "14:00", for sorting booked events against the seeded ones. */
function toHHMM(time: string): string {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return "00:00";
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Local, per-device persistence for tasks and events added on this screen. */
function useLocalList<T>(key: string): [T[], (items: T[]) => void] {
  const [items, setItems] = useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  });
  const save = (next: T[]) => {
    setItems(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage may be unavailable; the list still works for this session.
    }
  };
  return [items, save];
}

/**
 * A one-shot request carried in router state — `{ open: "task" }` from the
 * header's New menu. Read once and cleared, so Back does not reopen it.
 */
function useOpenRequest(): string | null {
  const { state } = useLocation();
  const requested = (state as { open?: string } | null)?.open ?? null;
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (requested) {
      setOpen(requested);
      window.history.replaceState({ ...(window.history.state ?? {}), usr: { ...(state ?? {}), open: undefined } }, "");
    }
  }, [requested, state]);
  return open;
}

function viewFromPath(pathname: string): View {
  return pathname.endsWith("/my-work") ? "mywork" : pathname.endsWith("/operations") ? "operations" : "overview";
}

interface AddedEvent {
  date: string;
  title: string;
  start: string;
  end: string;
  type: string;
}

function agendaOf(events: BrainEvent[], filter: EventFilter, month: string): BrainEvent[] {
  return events
    .filter((e) => e.date.startsWith(month))
    .filter((e) => filter === "All" || e.cat === filter)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}

function NowLine() {
  return (
    <div className="flex items-center gap-3 border-t border-black/[.05] pb-1 pt-3">
      <span className="w-[88px] flex-none text-[12px] font-medium text-primary">Now</span>
      <span className="h-[7px] w-[7px] flex-none rounded-full bg-primary" aria-hidden="true" />
      <span className="h-px flex-1 bg-[#E9E9EF]" aria-hidden="true" />
    </div>
  );
}

function Check({ on, size = 11 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-opacity", on ? "opacity-100" : "opacity-0")}>
      <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
      <path d="M3.4 8.4l2.8 2.8 6.4-6.6" />
    </svg>
  );
}

function DrawerHeader({ title, sub, sub2, onClose }: { title: string; sub: string; sub2?: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[17px] font-semibold tracking-[-.02em]">{title}</span>
        <span className="text-[13px] text-[var(--ink-muted)]">{sub}</span>
        {sub2 && <span className="text-[12.5px] text-muted-foreground">{sub2}</span>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[var(--wash-strong)] hover:text-foreground">
        ✕
      </button>
    </div>
  );
}

const closeButton = "ml-auto h-7 w-7 rounded-lg text-sm text-muted-foreground hover:bg-[var(--wash-strong)] hover:text-foreground";
const inputClass = "h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none placeholder:text-muted-foreground";
const drawerClass = "fixed bottom-0 right-0 top-0 z-[45] flex max-w-full flex-col overflow-y-auto border-l border-black/[.08] bg-[var(--paper)] shadow-[-12px_0_40px_rgba(0,0,0,.08)]";
const modalClass = "fixed left-1/2 top-1/2 z-[55] flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[18px] border border-black/[.07] bg-[var(--paper)] shadow-[0_24px_60px_rgba(20,20,30,.18)]";

export default function TheBrain() {
  const signals = useHomeSignals();
  const { findings } = useMonitors();
  const { scheduleEvents, currentUser } = useDemo();
  const { pathname, state: routeState } = useLocation();

  // Deep links into a tab. /brain/my-work exists because the sidebar
  // promotes My Work to its own row while it still lives inside The Brain;
  // /brain/operations exists because Home's Joy column links every line it
  // prints somewhere, and most of them end up here.
  const [view, setView] = useState<View>(() => viewFromPath(pathname));
  useEffect(() => {
    setView(viewFromPath(pathname));
  }, [pathname]);

  const [drawer, setDrawer] = useState<{ kind: "audit"; index: number } | { kind: "day"; date: string } | { kind: "sched" } | { kind: "why" } | null>(null);

  // Back from a screen this one opened restores the panel it was opened from.
  useEffect(() => {
    const reopen = readReopen(routeState);
    if (!reopen) return;
    if (reopen === "why") {
      setDrawer({ kind: "why" });
      return;
    }
    if ((VIEWS as string[]).includes(reopen)) setView(reopen as View);
  }, [routeState]);

  const [range, setRange] = useState<Range>("week");
  const [filter, setFilter] = useState<EventFilter>("All");
  const [actFilter, setActFilter] = useState<ActivityFilter>("All");
  const [ops, setOps] = useState<OpsTab>("working");
  const [opsNeedDone, setOpsNeedDone] = useState(false);
  const [holidayDone, setHolidayDone] = useState(false);
  const holiday: USHoliday | null = upcomingHolidays(todayIso())[0] ?? null;
  const activeClients = seedClients.filter((c) => c.status === "active").length;
  const needsCount = (opsNeedDone ? 0 : 1) + (holiday && !holidayDone ? 1 : 0);
  const [myDay, setMyDay] = useState(0);
  const [myTab, setMyTab] = useState<"schedule" | "needs" | "waiting">("schedule");
  const [myDone, setMyDone] = useState<Record<string, boolean>>({});
  const [celebrating, setCelebrating] = useState(false);
  const [calView, setCalView] = useState<"month" | "agenda">("month");
  const [modal, setModal] = useState<"task" | "event" | "subscribe" | null>(null);
  const [addedTasks, setAddedTasks] = useLocalList<MyNeed>("joy-brain-tasks");
  const [addedEvents, setAddedEvents] = useLocalList<AddedEvent>("joy-brain-events");

  // ----------------------------------------------------------- the brief --
  const urgent = signals.filter((s) => s.urgent);
  const brief = useMemo(() => {
    const now = new Date().toISOString();
    const base = morningBrief({
      visitsToday: todaysAgenda.length,
      unassignedToday: todaysAgenda.filter((e) => e.state === "unassigned").length,
      signals,
      upcomingBillingWeek: upcomingBillingWeek(now),
      today: now,
      holiday: usHolidayOn(now.slice(0, 10)),
    });
    const followUps = `Joy is carrying ${brainWorking.length} items forward and waiting on ${brainWaiting.length} outside parties.`;
    return `${base} ${followUps}`;
  }, [signals]);
  const headline = urgent.length === 0 ? "Operations are in good shape." : `${urgent.length} ${urgent.length === 1 ? "thing needs" : "things need"} attention.`;

  // ------------------------------------------------------------- events --
  const holidays = useMemo(() => {
    const year = Number(todayIso().slice(0, 4));
    return holidaysBetween(`${year}-01-01`, `${year + 1}-12-31`);
  }, []);
  const allEvents: BrainEvent[] = useMemo(
    () => [
      ...brainEvents,
      ...holidays.map((h) => ({
        date: h.date,
        title: h.name,
        meta: h.observed === h.date ? (h.premium ? "Holiday · premium rate" : "Holiday") : `Holiday · office observes ${shortDate(h.observed)}`,
        cat: "Agency" as const,
        icon: "🇺🇸",
      })),
      ...addedEvents.map((e) => ({
        date: e.date,
        title: e.title,
        meta: `${e.start} – ${e.end} · added here`,
        cat: "Agency" as const,
        icon: "📅",
      })),
    ],
    [addedEvents, holidays],
  );

  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(() => agencyDay(31));
  const rangeFrom = range === "today" ? todayIso() : range === "week" ? AGENCY_WEEK.start : range === "month" ? agencyDay(-3) : customFrom;
  const rangeTo = range === "today" ? todayIso() : range === "week" ? AGENCY_WEEK.end : range === "month" ? agencyDay(31) : customTo;

  function todayOffset(): number {
    const t = new Date(`${todayIso()}T12:00:00`).getTime();
    const s = new Date(`${AGENCY_WEEK.start}T12:00:00`).getTime();
    return Math.round((t - s) / 86_400_000);
  }

  const goingOn = allEvents
    .filter((e) => filter === "All" || e.cat === filter)
    .filter((e) => e.date >= rangeFrom && e.date <= rangeTo)
    .sort((a, b) => a.date.localeCompare(b.date));
  const countByDate = goingOn.reduce<Record<string, number>>((m, e) => ((m[e.date] = (m[e.date] ?? 0) + 1), m), {});

  // ------------------------------------------------------------- needs me --
  const needsAll: MyNeed[] = [...myNeeds, ...addedTasks];

  // The user's own booked events for today join the seeded day, sorted by time.
  const mySchedule = useMemo(() => {
    const me = currentUser.name.split(",")[0].trim().toLowerCase();
    const today = todayIso();
    const booked = scheduleEvents
      .filter((e) => e.startsAt.slice(0, 10) === today && e.assessorName.split(",")[0].trim().toLowerCase() === me)
      .map((e) => {
        const at = new Date(e.startsAt);
        const kind =
          e.eventType === "rn_assessment"
            ? "RN assessment"
            : e.eventType === "client_visit"
              ? "Client visit"
              : e.eventType === "orientation" || e.eventType === "field_orientation"
                ? "Orientation"
                : e.eventType === "supervisor_visit"
                  ? "Supervisor visit"
                  : "Booked";
        const event: MyEvent & { _at: number } = {
          time: at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          duration: e.durationMinutes >= 60 ? `${(e.durationMinutes / 60).toFixed(1).replace(/\.0$/, "")} hr` : `${e.durationMinutes} min`,
          title: `${kind} · ${e.clientName}`,
          meta: e.address || "Booked from the schedule",
          joyNote: "",
          tag: kind,
          done: at.getTime() + e.durationMinutes * 60_000 < Date.now(),
          drawer: false,
          _at: at.getTime(),
        };
        return event;
      });
    return [...myEvents.map((e) => ({ ...e, _at: Date.parse(`${today}T${toHHMM(e.time)}:00`) })), ...booked].sort((a, b) => a._at - b._at);
  }, [scheduleEvents, currentUser.name]);
  const nowAt = nowIndex(
    mySchedule.map((e) => e.time),
    new Date(),
  );
  const needsOpen = needsAll.filter((n) => !myDone[n.title]).length;

  // --------------------------------------------------------------- month --
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const stepMonth = (dir: -1 | 1) =>
    setMonthCursor(({ year, month }) => {
      const d = new Date(year, month + dir, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const monthCells = useMemo(() => {
    const { year, month } = monthCursor;
    const lead = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);
  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const onCurrentMonth = monthCursor.year === new Date().getFullYear() && monthCursor.month === new Date().getMonth();
  const cursorMonth = `${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, "0")}`;
  const inBillingWeek = (iso: string) => iso >= AGENCY_WEEK.start && iso <= AGENCY_WEEK.end;

  const acts = brainActivity.filter((a) => actFilter === "All" || a.cat === actFilter).filter((a) => a.date >= rangeFrom && a.date <= rangeTo);

  // ------------------------------------------------------------ new task --
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState(TASK_CATEGORIES[0]);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDue, setTaskDue] = useState(todayIso());
  const [taskAssignee, setTaskAssignee] = useState(ASSIGNEES[0]);
  const createTask = () => {
    if (!taskTitle.trim()) {
      toast.error("A task needs a title.");
      return;
    }
    setAddedTasks([
      ...addedTasks,
      {
        title: taskTitle.trim(),
        subject: `${taskCategory} · assigned to ${taskAssignee}${taskDesc.trim() ? ` · ${taskDesc.trim()}` : ""}`,
        joyNote: `${taskPriority} priority · added here, saved on this device`,
        due: `Due ${shortDate(taskDue)}`,
        cta: "Open My Work →",
        href: "/",
      },
    ]);
    setModal(null);
    setTaskTitle("");
    setTaskDesc("");
    setView("mywork");
    setMyTab("needs");
    toast.success("Task saved on this device", { description: "It's in My Work → Needs Me." });
  };

  // ----------------------------------------------------------- new event --
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(todayIso());
  const [evStart, setEvStart] = useState("14:00");
  const [evEnd, setEvEnd] = useState("15:00");
  const [evType, setEvType] = useState("General");
  const [editing, setEditing] = useState<number | null>(null);
  const openNewEvent = () => {
    setEditing(null);
    setEvTitle("");
    setEvDate(todayIso());
    setEvStart("14:00");
    setEvEnd("15:00");
    setEvType("General");
    setModal("event");
  };
  const openEditEvent = (index: number) => {
    const e = addedEvents[index];
    if (!e) return;
    setEditing(index);
    setEvTitle(e.title);
    setEvDate(e.date);
    setEvStart(e.start);
    setEvEnd(e.end);
    setEvType(e.type);
    setModal("event");
  };
  const saveEvent = () => {
    if (!evTitle.trim()) {
      toast.error("An event needs a title.");
      return;
    }
    const next: AddedEvent = { date: evDate, title: evTitle.trim(), start: evStart, end: evEnd, type: evType };
    if (editing !== null) {
      setAddedEvents(addedEvents.map((e, i) => (i === editing ? next : e)));
      toast.success("Event updated", { description: `${shortDate(evDate)} · ${evStart}–${evEnd}` });
    } else {
      setAddedEvents([...addedEvents, next]);
      toast.success("Event saved on this device", { description: `${shortDate(evDate)} · ${evStart}–${evEnd}` });
    }
    const [y, m] = evDate.split("-").map(Number);
    if (y && m) setMonthCursor({ year: y, month: m - 1 });
    setView("calendar");
    setModal(null);
    setEditing(null);
    setEvTitle("");
  };
  const deleteEvent = () => {
    if (editing === null) return;
    const gone = addedEvents[editing];
    setAddedEvents(addedEvents.filter((_, i) => i !== editing));
    setModal(null);
    setEditing(null);
    toast.success("Event removed", { description: gone?.title });
  };

  const closeDrawer = () => setDrawer(null);
  const payrollCloses = agencyDay(2) >= todayIso() ? agencyDay(2) : agencyDay(9);

  const openRequest = useOpenRequest();
  useEffect(() => {
    if (openRequest === "task") setModal("task");
  }, [openRequest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(null);
        setModal(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pill = (on: boolean) =>
    cn("whitespace-nowrap rounded-[9px] px-4 py-2 text-[13px] transition-colors", on ? "border border-black/[.09] bg-[var(--paper)] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)]" : "text-muted-foreground hover:text-foreground");
  const filterLink = (on: boolean) => cn("whitespace-nowrap text-[12.5px] transition-colors", on ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground");
  const tab = (on: boolean) => cn("-mb-px border-b-2 pb-3 text-[14.5px] tracking-[-.012em] transition-colors", on ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground");

  const viewLabel = view === "overview" ? "Overview" : view === "mywork" ? "My Work" : view === "operations" ? "Joy Operations" : view === "calendar" ? "Calendar" : "Activity";

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-[22px]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 text-[13px]">
        <Link to="/" className="text-muted-foreground hover:text-primary">
          Home
        </Link>
        <span className="text-muted-foreground/40" aria-hidden="true">
          /
        </span>
        <span className="text-muted-foreground">The Brain</span>
        <span className="text-muted-foreground/40" aria-hidden="true">
          /
        </span>
        <span className="font-medium">{viewLabel}</span>
      </nav>

      <section className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[280px] flex-1 flex-col gap-[5px]">
          <PageTitle>The Brain</PageTitle>
          <p className="m-0 text-sm text-muted-foreground">Your agency at a glance.</p>
          <p className="m-0 mt-0.5 text-[13px] text-[var(--ink-muted)]">{weekBadge(todayIso())}</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-2.5">
          {(view === "overview" || view === "activity") && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-0.5 rounded-xl bg-[#F7F7F9] p-1" role="group" aria-label="Time range">
                {(
                  [
                    ["today", "Today"],
                    ["week", "This Week"],
                    ["month", "This Month"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} aria-pressed={range === value} onClick={() => setRange(value)} className={pill(range === value)}>
                    {label}
                  </button>
                ))}
              </div>
              {range === "custom" && (
                <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">From</span>
                    <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 rounded-[9px] border border-black/[.09] bg-[var(--paper)] px-2 text-[12.5px] text-foreground outline-none" />
                  </label>
                  <span aria-hidden="true">→</span>
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">To</span>
                    <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="h-8 rounded-[9px] border border-black/[.09] bg-[var(--paper)] px-2 text-[12.5px] text-foreground outline-none" />
                  </label>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setModal("task")} className="flex h-9 items-center gap-2 rounded-[11px] border border-black/[.08] bg-[var(--paper)] px-[15px] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              Add task
            </button>
          </div>
        </div>
      </section>

      <section className="no-scrollbar flex items-center gap-[26px] overflow-x-auto border-b border-black/[.07]" role="tablist" aria-label="Brain views">
        {(
          [
            ["overview", "Overview"],
            ["mywork", "My Work"],
            ["operations", "Joy Operations"],
            ["calendar", "Calendar"],
            ["activity", "Activity"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)} className={tab(view === value)}>
            {label}
          </button>
        ))}
      </section>

      {view === "overview" && (
        <div className="flex flex-col gap-[22px]">
          <section className={cn(CARD, "flex flex-col gap-3 px-[26px] py-6")}>
            <span className={EYEBROW}>Brain Brief</span>
            <p className="m-0 text-[19px] font-medium leading-[1.5] tracking-[-.018em]">{headline}</p>
            <p className="m-0 max-w-[800px] text-[15px] leading-[1.75] text-[var(--ink-soft)] [text-wrap:pretty]">{brief}</p>
            <button type="button" onClick={() => setDrawer({ kind: "why" })} className="self-start text-[13px] font-medium text-primary hover:text-[#2A1BD1]">
              See why →
            </button>
          </section>

          <div className="grid items-stretch gap-[18px] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)]">
            <section className={cn(CARD, "flex min-w-0 flex-col px-6 py-5")}>
              <div className="mb-2 flex items-center gap-[18px]">
                <span className={cn(EYEBROW, "whitespace-nowrap")}>What's Going On</span>
                <div className="ml-auto flex flex-none gap-3">
                  {(["All", "Agency", "Payroll", "Billing", "People"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)} className={filterLink(filter === f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {goingOn.map((e) => {
                const body = (
                  <>
                    <span className="w-[58px] flex-none text-[12.5px] font-medium text-muted-foreground">{shortDate(e.date)}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-sm font-medium tracking-[-.01em]">
                        {e.icon}
                        {" "}
                        {e.title}
                      </span>
                      <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                    </div>
                    <span className="flex-none self-center rounded-full bg-[#F4F4F6] px-2.5 py-[3px] text-[11px] text-[var(--ink-muted)]">{e.subject ? subjectLabel(e.subject) : e.cat}</span>
                  </>
                );
                const key = `${e.date}-${e.title}`;
                return e.subject ? (
                  <Link key={key} to={subjectHref(e.subject)} state={cameFrom({ label: "What's going on", to: "/brain" })} className="flex items-start gap-5 border-t border-black/[.05] py-3.5 transition-colors hover:bg-[var(--paper-sunken)]">
                    {body}
                  </Link>
                ) : (
                  <div key={key} className="flex items-start gap-5 border-t border-black/[.05] py-3.5">
                    {body}
                  </div>
                );
              })}
              {goingOn.length === 0 && <p className="m-0 py-6 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this period.</p>}
            </section>

            <section className={cn(CARD, "flex min-w-0 flex-col gap-3.5 px-6 py-5")}>
              <div className="flex items-baseline gap-3">
                <span className={EYEBROW}>Calendar</span>
                <span className="ml-auto text-[12.5px] text-muted-foreground">{monthLabel}</span>
              </div>
              <div className="grid flex-1 grid-cols-7 gap-[5px]">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i} className="text-center text-[10px] font-semibold tracking-[.06em] text-muted-foreground/70">
                    {d}
                  </span>
                ))}
                {monthCells.map((cell, i) => {
                  if (cell === null) return <span key={`b${i}`} className="h-[30px]" />;
                  const hol = usHolidayOn(cell.iso);
                  const n = countByDate[cell.iso];
                  const items = n ? `${n} ${n === 1 ? "item" : "items"}` : null;
                  return (
                    <span
                      key={cell.iso}
                      title={[hol?.name, items].filter(Boolean).join(" · ") || undefined}
                      aria-label={items ? `${cell.day}, ${items}` : undefined}
                      className={cn(
                        "relative flex h-[30px] items-center justify-center pb-[3px] text-[11.5px]",
                        inBillingWeek(cell.iso)
                          ? cn("bg-[#DCE0FB] text-[#3B2FB8]", cell.iso === AGENCY_WEEK.start && "rounded-l-lg", cell.iso === AGENCY_WEEK.end && "rounded-r-lg")
                          : "rounded-lg text-muted-foreground",
                        hol && "font-semibold text-[#B54708]",
                        cell.iso === todayIso() && "font-semibold text-primary shadow-[inset_0_0_0_1.5px_#1407A2]",
                      )}
                    >
                      {cell.day}
                      {n > 0 && <span aria-hidden="true" className={cn("absolute bottom-[5px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full", inBillingWeek(cell.iso) ? "bg-[#3B2FB8]" : "bg-primary/55")} />}
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-[9px]">
                  <span className="h-2.5 w-[22px] flex-none rounded-[5px] bg-[#DCE0FB]" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{weekLabel} · this billing week</span>
                </div>
                <div className="flex items-center gap-[9px]">
                  <span className="flex w-[22px] flex-none justify-center" aria-hidden="true">
                    <span className="h-[3px] w-[3px] rounded-full bg-primary/55" />
                  </span>
                  <span className="text-xs text-muted-foreground">a day with something on it</span>
                </div>
                <div className="flex items-center gap-[9px]">
                  <span className="flex w-[22px] flex-none justify-center text-[11.5px] font-semibold text-[#B54708]" aria-hidden="true">
                    25
                  </span>
                  <span className="text-xs text-muted-foreground">a US holiday</span>
                </div>
              </div>
              <button type="button" onClick={() => setView("calendar")} className="self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                View calendar →
              </button>
            </section>
          </div>

          <div className="grid items-stretch gap-[18px] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)]">
            <section className={cn(CARD, "flex min-w-0 flex-col px-6 py-5")}>
              <span className={cn(EYEBROW, "mb-2")}>Recent Activity</span>
              {brainActivity.slice(0, 5).map((a) => (
                <div key={a.title} className="flex gap-[18px] border-t border-black/[.05] py-[13px]">
                  <span className="w-[74px] flex-none text-[12.5px] text-muted-foreground">{a.time}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-sm font-medium leading-[1.45] tracking-[-.01em]">{a.title}</span>
                    <Link to={a.href} state={cameFrom({ label: "Recent activity", to: "/brain" })} className="w-fit text-[12.5px] font-medium text-primary transition-colors hover:text-[#2A1BD1]">
                      {a.meta}
                    </Link>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setView("activity")} className="mt-3.5 self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                View activity →
              </button>
            </section>

            <section className={cn(CARD, "flex min-w-0 flex-col gap-3.5 px-6 py-5")}>
              <span className={EYEBROW}>Joy Operations</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {(
                  [
                    [String(brainHandled.length), "HANDLED", "text-[#15803D]"],
                    [String(brainWorking.length), "WORKING", "text-primary"],
                    [String(brainWaiting.length), "WAITING", "text-muted-foreground"],
                    [opsNeedDone ? "0" : "1", "NEEDS YOU", "text-[#C2410C]"],
                  ] as const
                ).map(([n, label, tone]) => (
                  <div key={label} className="flex flex-col gap-[3px]">
                    <span className={cn("text-[22px] font-medium leading-none tracking-[-.03em]", label === "NEEDS YOU" && !opsNeedDone && "text-[#C2410C]")}>{n}</span>
                    <span className={cn("text-[10.5px] font-semibold tracking-[.13em]", tone)}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-1 flex-col pt-1.5">
                <div className="flex items-start gap-3.5 border-t border-black/[.05] py-[13px]">
                  <span className="w-16 flex-none pt-0.5 text-[10.5px] font-semibold tracking-[.1em] text-primary">WORKING</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13.5px] font-medium tracking-[-.01em]">{brainWorking[1].title}</span>
                    <span className="text-[12.5px] text-muted-foreground">Caregiver contacted 7:48 AM · follow-up 10:00 AM</span>
                  </div>
                </div>
                {!opsNeedDone && (
                  <div className="flex items-start gap-3.5 border-t border-black/[.05] py-[13px]">
                    <span className="w-16 flex-none pt-0.5 text-[10.5px] font-semibold tracking-[.1em] text-[#C2410C]">NEEDS YOU</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[13.5px] font-medium tracking-[-.01em]">{brainNeedsYou.title}</span>
                      <span className="text-[12.5px] text-muted-foreground">{brainNeedsYou.subject} · waiting on your approval</span>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setView("operations")} className="self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                View Joy Operations →
              </button>
            </section>
          </div>

          <WhatJoyNoticed findings={findings} />
        </div>
      )}

      {view === "mywork" && (
        <div className="flex flex-col gap-5">
          <h2 className="m-0 text-xl font-semibold tracking-[-.02em]">My Work</h2>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setMyDay((d) => Math.max(0, d - 1))} aria-label="Previous day" className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)] hover:bg-[var(--wash)]">
                ‹
              </button>
              <span className="min-w-[150px] text-center text-sm font-medium tracking-[-.01em]">{longDate(myDay === 0 ? todayIso() : agencyDay(todayOffset() + 1))}</span>
              <button type="button" onClick={() => setMyDay((d) => Math.min(1, d + 1))} aria-label="Next day" className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)] hover:bg-[var(--wash)]">
                ›
              </button>
              <button type="button" onClick={() => setMyDay(0)} className={cn("rounded-[9px] border border-black/[.08] px-[13px] py-[7px] text-[12.5px] font-medium", myDay === 0 ? "bg-[var(--wash-strong)] text-primary" : "bg-[var(--paper)] text-[var(--ink-muted)]")}>
                Today
              </button>
            </div>
            <div className="ml-1.5 flex gap-0.5 rounded-xl bg-[#F7F7F9] p-1">
              {(
                [
                  ["schedule", "My Schedule"],
                  ["needs", "Needs Me"],
                  ["waiting", "Waiting on Others"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setMyTab(value)} className={pill(myTab === value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {myTab === "schedule" && (
            <section className={cn(CARD, "px-6 py-5")}>
              <span className={EYEBROW}>{myDay === 0 ? `Today · ${longDate(todayIso()).toUpperCase()}` : longDate(agencyDay(todayOffset() + 1)).toUpperCase()}</span>
              {myDay === 0 ? (
                <>
                  {mySchedule.map((e, i) => (
                    <div key={e.title}>
                      {i === nowAt && <NowLine />}
                      <button type="button" onClick={() => e.drawer && setDrawer({ kind: "sched" })} className={cn("flex w-full items-start gap-[22px] border-t border-black/[.05] py-[18px] pr-2 text-left", e.drawer ? "cursor-pointer" : "cursor-default")}>
                        <span className="flex w-[88px] flex-none flex-col gap-0.5">
                          <span className={cn("text-[13px] font-medium", e.done ? "text-muted-foreground/50" : "text-muted-foreground")}>{e.time}</span>
                          <span className={cn("text-[11.5px]", e.done ? "text-muted-foreground/40" : "text-muted-foreground/70")}>{e.duration}</span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={cn("text-[15px] font-medium tracking-[-.01em]", e.done && "text-muted-foreground/60")}>{e.title}</span>
                          <span className={cn("text-[13px]", e.done ? "text-muted-foreground/50" : "text-muted-foreground")}>{e.meta}</span>
                          <span className={cn("text-[12.5px]", e.done ? "text-muted-foreground/50" : "text-[#6E6E8A]")}>{e.joyNote}</span>
                        </span>
                        <span className={cn("flex-none self-center rounded-full px-[11px] py-1 text-[11.5px]", e.done ? "bg-[#F4F4F6] text-muted-foreground" : "bg-[#EFEDFB] text-primary")}>{e.tag}</span>
                      </button>
                    </div>
                  ))}
                  {nowAt >= mySchedule.length && <NowLine />}
                  <div className="mt-5 flex flex-col gap-2.5 border-t border-black/[.05] pt-4">
                    <span className={EYEBROW}>Tomorrow · {longDate(agencyDay(todayOffset() + 1)).toUpperCase()}</span>
                    {myTomorrow.map((t) => (
                      <div key={t.label} className="flex gap-[22px] text-[13.5px] text-[var(--ink-muted)]">
                        <span className="w-[88px] flex-none text-muted-foreground">{t.time}</span>
                        {t.label}
                      </div>
                    ))}
                    <button type="button" onClick={() => setMyDay(1)} className="self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                      View tomorrow →
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2.5 pt-3">
                  {myTomorrow.map((t) => (
                    <div key={t.label} className="flex gap-[22px] border-t border-black/[.05] py-3 text-[13.5px]">
                      <span className="w-[88px] flex-none text-muted-foreground">{t.time}</span>
                      {t.label}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {myTab === "needs" && (
            <section className={cn(CARD, "relative overflow-hidden px-6 py-5")}>
              {celebrating && <Confetti onDone={() => setCelebrating(false)} />}
              <div className="mb-1 flex items-center gap-3">
                <span className={EYEBROW}>Needs Me</span>
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {needsOpen} {needsOpen === 1 ? "item" : "items"}
                </span>
              </div>
              {needsOpen === 0 && (
                <div className="flex flex-col items-center gap-[7px] py-11 text-center">
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--wash-strong)]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1407A2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.6 8.4l2.8 2.8 6-6.4" />
                    </svg>
                  </span>
                  <span className="text-base font-medium tracking-[-.015em]">You're all caught up.</span>
                  <span className="text-[13.5px] text-muted-foreground">Joy doesn't need any decisions from you right now.</span>
                </div>
              )}
              {needsAll.map((n) => {
                const done = !!myDone[n.title];
                return (
                  <div key={n.title} className="flex gap-5 border-t border-black/[.05] py-5">
                    <button
                      type="button"
                      onClick={() =>
                        setMyDone((prev) => {
                          const next = { ...prev, [n.title]: !prev[n.title] };
                          const left = needsAll.filter((x) => !next[x.title]).length;
                          if (!prev[n.title] && left === 0) setCelebrating(true);
                          return next;
                        })
                      }
                      aria-label={done ? `Reopen ${n.title}` : `Mark ${n.title} done`}
                      className={cn("mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.4px] transition-colors", done ? "border-primary bg-primary" : "border-[#C8C8D0] bg-transparent")}
                    >
                      <Check on={done} size={10} />
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <span className={cn("text-[15px] font-medium tracking-[-.01em]", done && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>{n.title}</span>
                      <span className={cn("text-[13px]", done ? "text-muted-foreground/50" : "text-[var(--ink-muted)]")}>{n.subject}</span>
                      <span className={cn("text-[12.5px]", done ? "text-muted-foreground/40" : "text-muted-foreground")}>{n.joyNote}</span>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-[9px]">
                      <span className={cn("text-xs", done ? "text-muted-foreground/50" : "text-[#C2410C]")}>{n.due}</span>
                      <Link to={n.href} state={cameFrom({ label: "My Work", to: "/brain/my-work" })} className={cn("text-[12.5px] font-medium", done ? "text-muted-foreground/50" : "text-primary hover:text-[#2A1BD1]")}>
                        {n.cta}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {myTab === "waiting" && (
            <section className={cn(CARD, "px-6 py-5")}>
              <div className="mb-1 flex items-center gap-3">
                <span className={EYEBROW}>Waiting on Others</span>
                <span className="ml-auto text-[12.5px] text-muted-foreground">{brainWaiting.length} items</span>
              </div>
              {brainWaiting.map((w) => (
                <div key={w.title} className="flex gap-5 border-t border-black/[.05] py-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="text-[15px] font-medium tracking-[-.01em]">{w.title}</span>
                    <span className="text-[13px] text-[var(--ink-muted)]">{w.state}</span>
                    <span className="text-[12.5px] text-muted-foreground">{w.next}</span>
                    <span className="text-[12px] text-muted-foreground">
                      Assigned to <span className="font-medium text-primary">{assigneeName(w.assignedTo)}</span>
                    </span>
                  </div>
                  <Link to={w.href} state={cameFrom({ label: "My Work", to: "/brain/my-work" })} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {w.cta} →
                  </Link>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {view === "operations" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-semibold tracking-[-.02em]">Joy Operations</h2>
            <p className="m-0 text-[13.5px] text-muted-foreground">Everything Joy is handling across your agency.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["handled", "HANDLED", String(brainHandled.length), "Joy completed the approved action.", "text-[#15803D]"],
                ["working", "WORKING", String(brainWorking.length), "Joy is progressing the workflow.", "text-primary"],
                ["waiting", "WAITING", String(brainWaiting.length), "Acted; waiting on an outside party.", "text-muted-foreground"],
                ["needs", "NEEDS YOU", String(needsCount), "Human judgment required.", "text-[#C2410C]"],
              ] as const
            ).map(([key, label, n, note, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOps(key)}
                aria-pressed={ops === key}
                className={cn("flex flex-col items-start gap-2 rounded-2xl border bg-[var(--paper)] p-5 text-left transition-colors", ops === key ? "border-[#1407A2]/[.28] shadow-[0_1px_2px_rgba(20,7,162,.08)]" : "border-black/[.06] shadow-[0_1px_2px_rgba(0,0,0,.02)]")}
              >
                <span className={cn("text-[10.5px] font-semibold tracking-[.13em]", tone)}>{label}</span>
                <span className={cn("text-2xl font-medium leading-none tracking-[-.03em]", key === "needs" && !opsNeedDone && "text-[#C2410C]")}>{n}</span>
                <span className="text-xs text-muted-foreground">{note}</span>
              </button>
            ))}
          </div>

          {ops === "working" && (
            <section className={cn(CARD, "px-6 py-5")}>
              <span className={EYEBROW}>Working · {brainWorking.length}</span>
              {brainWorking.map((w, i) => (
                <div key={w.title} className="flex gap-[22px] border-t border-black/[.05] py-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[15px] font-medium tracking-[-.01em]">{w.title}</span>
                    <span className="text-xs text-muted-foreground">{w.area}</span>
                    <span className="text-[13.5px] leading-[1.6] text-[var(--ink-soft)] [text-wrap:pretty]">{w.summary}</span>
                    <span className="mt-1.5 text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">NEXT ACTION</span>
                    <span className="text-[13px] text-[var(--ink-muted)]">{w.next}</span>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2.5">
                    <span className="text-xs text-muted-foreground/70">Updated {w.updated}</span>
                    <button type="button" onClick={() => setDrawer({ kind: "audit", index: i })} className="rounded-[20px] border border-[#1407A2]/[.16] bg-[var(--paper)] px-[13px] py-1.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--wash)]">
                      Audit
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {ops === "handled" && (
            <section className={cn(CARD, "px-6 py-5")}>
              <span className={EYEBROW}>Handled · {brainHandled.length}</span>
              {brainHandled.map((h) => (
                <div key={h.title} className="flex items-center gap-3.5 border-t border-black/[.05] py-3.5">
                  <Tick />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium tracking-[-.01em]">{h.title}</span>
                    <span className="text-[12.5px] text-muted-foreground">{h.meta}</span>
                  </div>
                  <span className="flex-none text-xs text-muted-foreground/70">{h.time}</span>
                </div>
              ))}
            </section>
          )}

          {ops === "waiting" && (
            <section className={cn(CARD, "px-6 py-5")}>
              <span className={EYEBROW}>Waiting · {brainWaiting.length}</span>
              {brainWaiting.map((w) => (
                <div key={w.title} className="flex gap-[22px] border-t border-black/[.05] py-[18px]">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[15px] font-medium tracking-[-.01em]">{w.title}</span>
                    <span className="text-[13px] text-[var(--ink-muted)]">{w.state}</span>
                    <span className="text-[12.5px] text-muted-foreground">{w.next}</span>
                    <span className="text-[12px] text-muted-foreground">
                      Assigned to <span className="font-medium text-primary">{assigneeName(w.assignedTo)}</span>
                    </span>
                  </div>
                  <Link to={w.href} state={cameFrom({ label: "Joy Operations", to: "/brain/operations" })} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {w.cta} →
                  </Link>
                </div>
              ))}
              <p className="m-0 mt-3.5 text-[12.5px] text-muted-foreground">Nothing here needs you — Joy acted and knows what happens next.</p>
            </section>
          )}

          {ops === "needs" && (
            <section className="rounded-[18px] border border-[#C2410C]/[.18] bg-[var(--paper)] px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,.02)]">
              <span className={EYEBROW}>Needs You · {needsCount}</span>
              <div className="flex gap-5 border-t border-black/[.05] py-5">
                <button type="button" onClick={() => setOpsNeedDone((v) => !v)} aria-label="Mark handled" className={cn("mt-[3px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border-[1.5px] transition-colors", opsNeedDone ? "border-primary bg-primary" : "border-[#C8C8D0] bg-transparent")}>
                  <Check on={opsNeedDone} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <span className={cn("text-base font-medium tracking-[-.015em]", opsNeedDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>{brainNeedsYou.title}</span>
                  <span className="text-[13.5px] text-[var(--ink-muted)]">{brainNeedsYou.subject}</span>
                  <span className="max-w-[580px] text-[13.5px] leading-[1.65] text-[var(--ink-soft)] [text-wrap:pretty]">{brainNeedsYou.detail}</span>
                  <span className="text-[13px] text-[#6E6E8A]">{brainNeedsYou.recommends}</span>
                </div>
                <div className="flex flex-none flex-col gap-[9px] self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setOpsNeedDone(true);
                      toast.success("Hours increase approved", { description: "Vince W moves to 16 hrs/week. The schedule change is Joy's to carry out." });
                    }}
                    className="flex h-9 items-center justify-center rounded-[11px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                  >
                    Approve
                  </button>
                  <Link to={brainNeedsYou.href} state={cameFrom({ label: "Joy Operations", to: "/brain/operations" })} className="flex h-9 items-center justify-center rounded-[11px] border border-black/[.08] px-[18px] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
                    Review details
                  </Link>
                </div>
              </div>
              {holiday && (
                <div className="flex gap-[18px] border-t border-black/[.05] pt-[18px]">
                  <button type="button" onClick={() => setHolidayDone((v) => !v)} aria-pressed={holidayDone} aria-label={`Mark the ${holiday.name} asks approved`} className={cn("mt-[3px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border transition-colors", holidayDone ? "border-primary bg-primary" : "border-black/20 bg-[var(--paper)] hover:border-primary/50")}>
                    <Check on={holidayDone} />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                    <span className={cn("text-base font-medium tracking-[-.015em]", holidayDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>Holiday coverage · {holiday.name}</span>
                    <span className="text-[13.5px] text-[var(--ink-muted)]">
                      {longDate(holiday.date)} · {daysUntilHoliday(todayIso(), holiday)} days away
                      {holiday.observed !== holiday.date && ` · office observes ${shortDate(holiday.observed)}`}
                    </span>
                    <span className="max-w-[580px] text-[13.5px] leading-[1.65] text-[var(--ink-soft)] [text-wrap:pretty]">
                      Joy has drafted the ask for {activeClients} active {activeClients === 1 ? "client" : "clients"}: whether they want their caregiver to work that day. Nothing sends until you approve it.
                    </span>
                    <span className="max-w-[580px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3.5 py-2.5 text-[12.5px] leading-[1.6] text-[var(--ink-body)]">{holidayAskText(holiday, "Mrs. Davis")}</span>
                    <span className="text-[13px] text-[#6E6E8A]">Joy asks {HOLIDAY_ASK_DAYS} days ahead so an unfilled shift is still fillable.</span>
                  </div>
                  <div className="flex flex-none flex-col gap-[9px] self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setHolidayDone(true);
                        toast.success(`${holiday.name} asks approved`, { description: `Queued for ${activeClients} clients. Joy reports each reply as it lands.` });
                      }}
                      className="flex h-9 items-center justify-center rounded-[11px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                    >
                      Approve & send
                    </button>
                    <Link to="/clients" state={cameFrom({ label: "Joy Operations", to: "/brain/operations" })} className="flex h-9 items-center justify-center rounded-[11px] border border-black/[.08] px-[18px] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
                      View clients
                    </Link>
                  </div>
                </div>
              )}
              <p className="m-0 mt-3.5 text-[12.5px] text-muted-foreground">A short list here is the goal — everything else Joy is authorized to carry forward.</p>
            </section>
          )}
        </div>
      )}

      {view === "calendar" && (
        <section className={cn(CARD, "px-6 py-[22px]")}>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--wash)]">
                ‹
              </button>
              <h2 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-.02em]">{monthLabel}</h2>
              <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--wash)]">
                ›
              </button>
              {!onCurrentMonth && (
                <button type="button" onClick={() => setMonthCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })} className="rounded-[9px] border border-black/[.08] bg-[var(--paper)] px-[13px] py-[7px] text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--wash)]">
                  Back to this month
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex gap-0.5 rounded-xl bg-[#F7F7F9] p-1">
                {(
                  [
                    ["month", "Month"],
                    ["agenda", "Agenda"],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setCalView(value)} className={pill(calView === value)}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setModal("subscribe")} className="flex h-9 items-center gap-2 rounded-[11px] border border-black/[.08] bg-[var(--paper)] px-[15px] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
                <Share2 className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
                Subscribe
              </button>
              <button type="button" onClick={openNewEvent} className="flex h-9 items-center gap-2 rounded-[11px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                Add event
              </button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3.5">
            <span className="text-[12.5px] text-muted-foreground">
              {weekLabel} · this billing week · payroll closes {shortDate(agencyDay(2))}
            </span>
            <div className="ml-auto flex gap-3.5">
              {(["All", "Agency", "Payroll", "Billing", "People"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={filterLink(filter === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {calView === "month" && (
            <div className="grid grid-cols-7 gap-1.5">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                <span key={d} className="pb-1 text-[10.5px] font-semibold tracking-[.09em] text-muted-foreground/70">
                  {d}
                </span>
              ))}
              {monthCells.map((cell, i) => {
                if (cell === null) return <span key={`b${i}`} className="min-h-[78px]" />;
                const items = allEvents.filter((e) => e.date === cell.iso && (filter === "All" || e.cat === filter));
                const isToday = cell.iso === todayIso();
                const inWeek = inBillingWeek(cell.iso);
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setDrawer({ kind: "day", date: cell.iso })}
                    className={cn("flex min-h-[78px] flex-col items-start gap-1 overflow-hidden rounded-[11px] border p-2 text-left transition-colors", inWeek ? "border-[#1407A2]/[.14] bg-[#EFF1FE]" : "border-black/[.06] bg-[var(--paper)] hover:bg-[var(--wash)]", isToday && "border-[#1407A2]/[.45]")}
                  >
                    <span className={cn("text-[12.5px] tabular-nums", isToday ? "font-semibold text-primary" : "text-[var(--ink-muted)]")}>{cell.day}</span>
                    {items.map((e, j) => (
                      <span key={`${e.title}-${j}`} className={cn("block max-w-full truncate text-[10.5px] leading-[1.35]", CAT_COLOR[e.cat])}>
                        {e.icon} {e.title}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          )}

          {calView === "agenda" && (
            <div className="flex flex-col gap-3.5">
              {[...new Set(agendaOf(allEvents, filter, cursorMonth).map((e) => e.date))].map((date) => (
                <div key={date} className="overflow-hidden rounded-[14px] border border-black/[.06]">
                  <div className="bg-[#F7F7F9] px-4 py-[11px] text-[12.5px] font-medium text-[var(--ink-soft)]">{longDate(date)}</div>
                  {agendaOf(allEvents, filter, cursorMonth)
                    .filter((e) => e.date === date)
                    .map((e, i) => {
                      const idx = addedEvents.findIndex((a) => a.date === e.date && a.title === e.title);
                      return (
                        <div key={`${e.date}-${e.title}-${i}`} className="flex items-center gap-3.5 border-t border-black/[.05] px-4 py-3.5">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[#F1F0FC] text-sm">{e.icon}</span>
                          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                            <span className="text-sm font-medium tracking-[-.01em]">{e.title}</span>
                            <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                          </div>
                          <span className="flex-none rounded-full bg-[#F4F4F6] px-2.5 py-[3px] text-[11px] text-[var(--ink-muted)]">{e.subject ? subjectLabel(e.subject) : e.cat}</span>
                          {idx >= 0 && (
                            <button type="button" onClick={() => openEditEvent(idx)} className="flex-none rounded-[9px] border border-black/[.08] bg-[var(--paper)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]">
                              Edit
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
              {agendaOf(allEvents, filter, cursorMonth).length === 0 && <p className="m-0 py-6 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this period.</p>}
            </div>
          )}
        </section>
      )}

      {view === "activity" && (
        <section className={cn(CARD, "px-6 py-[22px]")}>
          <div className="mb-1.5 flex flex-wrap items-center gap-3.5">
            <div className="flex flex-col gap-[3px]">
              <h2 className="m-0 text-xl font-semibold tracking-[-.02em]">Activity</h2>
              <p className="m-0 text-[13px] text-muted-foreground">What happened across Joy Health.</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              {(["All", "Clients", "Employees", "Payroll", "Billing", "Joy"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setActFilter(f)} className={filterLink(actFilter === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          {acts.map((a) => (
            <div key={a.title} className="flex gap-5 border-t border-black/[.05] py-4">
              <span className="w-[74px] flex-none text-[12.5px] text-muted-foreground">{a.time}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-sm font-medium tracking-[-.01em]">{a.title}</span>
                <span className="text-[12.5px] text-muted-foreground">{a.meta}</span>
              </div>
              <Link to={a.href} state={cameFrom({ label: "Activity", to: "/brain", reopen: "activity" })} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                {a.cta} →
              </Link>
            </div>
          ))}
          {acts.length === 0 && <p className="m-0 py-[30px] text-center text-[13.5px] text-muted-foreground">No activity in this time range.</p>}
        </section>
      )}

      {/* ------------------------------------------------------- drawers -- */}
      {drawer && <div className="fixed inset-0 z-40 bg-[#14141E]/[.14]" onClick={closeDrawer} aria-hidden="true" />}

      {drawer?.kind === "audit" &&
        (() => {
          const a = brainWorking[drawer.index].audit;
          const sections: Array<[string, ReactNode]> = [
            ["CURRENT STATUS", <span key="s" className="text-sm font-medium">{a.status}</span>],
            ["WHY JOY ACTED", <span key="w" className="text-[13.5px] leading-[1.6] text-[var(--ink-soft)] [text-wrap:pretty]">{a.why}</span>],
            [
              "JOY ACTIVITY",
              <div key="t" className="flex flex-col gap-[11px]">
                {a.timeline.map(([when, what]) => (
                  <div key={when + what} className="flex gap-3.5">
                    <span className="w-[66px] flex-none text-[12.5px] text-muted-foreground">{when}</span>
                    <span className="flex-1 text-[13.5px] text-[var(--ink-soft)]">{what}</span>
                  </div>
                ))}
                <span className="text-[12.5px] text-muted-foreground">Channel · {a.channel}</span>
              </div>,
            ],
            [
              "NEXT ACTION",
              <div key="n" className="flex flex-col gap-1">
                <span className="text-[13.5px] leading-[1.6] text-[var(--ink-soft)] [text-wrap:pretty]">{a.next}</span>
                <span className="mt-1 text-[13px] text-[#6E6E8A]">No action needed from you.</span>
              </div>,
            ],
          ];
          return (
            <div role="dialog" aria-label="Joy audit" className={cn(drawerClass, "w-[420px]")}>
              <DrawerHeader title={a.title} sub={a.subtitle} onClose={closeDrawer} />
              {sections.map(([label, body]) => (
                <div key={label} className="flex flex-col gap-[7px] border-b border-black/[.05] px-6 py-5">
                  <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">{label}</span>
                  {body}
                </div>
              ))}
              <div className="flex flex-col gap-[9px] px-6 py-5">
                <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">SOURCE RECORDS</span>
                {a.sources.map((s) => (
                  <span key={s} className="text-[13px] text-[var(--ink-muted)]">
                    {s}
                  </span>
                ))}
                <Link to={a.href} state={cameFrom({ label: "Joy Operations", to: "/brain/operations" })} className="mt-1.5 flex h-[38px] items-center justify-center rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  {a.cta}
                </Link>
              </div>
            </div>
          );
        })()}

      {drawer?.kind === "day" && (
        <div role="dialog" aria-label="Day detail" className={cn(drawerClass, "w-[400px]")}>
          <DrawerHeader title={longDate(drawer.date)} sub={inBillingWeek(drawer.date) ? `${weekLabel} · this billing week` : "Outside the current billing week"} onClose={closeDrawer} />
          <div className="flex flex-col px-6 pb-5 pt-2">
            {allEvents
              .filter((e) => e.date === drawer.date)
              .map((e, i) => {
                const idx = addedEvents.findIndex((a) => a.date === e.date && a.title === e.title);
                return (
                  <div key={`${e.title}-${i}`} className="flex items-start gap-[13px] border-b border-black/[.05] py-4">
                    <span className="flex-none text-[15px] leading-[1.3]">{e.icon}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-sm font-medium tracking-[-.01em]">{e.title}</span>
                      <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                    </div>
                    {idx >= 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          closeDrawer();
                          openEditEvent(idx);
                        }}
                        className="flex-none rounded-[9px] border border-black/[.08] bg-[var(--paper)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                );
              })}
            {allEvents.filter((e) => e.date === drawer.date).length === 0 && <p className="m-0 py-7 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this day.</p>}
          </div>
        </div>
      )}

      {drawer?.kind === "sched" && (
        <div role="dialog" aria-label="Prepared visit" className={cn(drawerClass, "w-[400px]")}>
          <DrawerHeader title="Pamela P" sub="Family care conference · client home" sub2="Today · 2:00–2:45 PM" onClose={closeDrawer} />
          <div className="flex flex-col gap-[7px] border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">STATUS</span>
            <span className="text-sm font-medium">Family confirmed</span>
          </div>
          <div className="flex flex-col gap-2.5 border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">JOY PREPARED</span>
            {["Latest care plan", "Last visit summary", "Open family questions", "The incident report from Aug 18"].map((item) => (
              <span key={item} className="flex items-center gap-[9px] text-[13.5px] text-[var(--ink-soft)]">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M3.4 8.4l2.8 2.8 6.4-6.6" />
                </svg>
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">ATTENDEES</span>
            <span className="text-[13.5px] text-[var(--ink-soft)]">Kelsey Westley, RN</span>
            <span className="text-[13.5px] text-[var(--ink-soft)]">Marta Pamela P · Niece</span>
          </div>
          <div className="flex flex-col gap-[9px] px-6 py-5">
            <Link to="/clients" className="flex h-[38px] items-center justify-center rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              Open client
            </Link>
            <Link to="/clients/care-plans" className="flex h-[38px] items-center justify-center rounded-[11px] border border-black/[.08] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
              View care plan
            </Link>
          </div>
        </div>
      )}

      {drawer?.kind === "why" && (
        <div role="dialog" aria-label="Behind the brief" className={cn(drawerClass, "z-[60] w-[400px] overflow-hidden")}>
          <div className="flex flex-none items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[17px] font-semibold tracking-[-.02em]">Behind the brief</span>
              <span className="text-[13px] text-[var(--ink-muted)]">{longDate(todayIso())}</span>
            </div>
            <button type="button" onClick={closeDrawer} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[var(--wash-strong)] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
            {[
              {
                label: "VISIT COVERAGE",
                body: (() => {
                  const open = todaysAgenda.filter((e) => e.state === "unassigned").length;
                  const base = `${todaysAgenda.length} scheduled ${todaysAgenda.length === 1 ? "entry" : "entries"} today`;
                  return open === 0 ? `${base} · all assigned.` : `${base} · ${open} still ${open === 1 ? "needs" : "need"} a caregiver.`;
                })(),
                link: ["View scheduling", "/scheduling"] as const,
              },
              {
                label: "PAYROLL",
                body: `Closes ${shortDate(payrollCloses)}. Two timecards outstanding — Chanel P's Saturday clock-out is one. Joy queued reminders at 7:42 AM.`,
                link: ["View payroll", "/payroll"] as const,
              },
              {
                label: "BILLING",
                body: `The Saturday run drafts ${weekLabel}'s invoices on ${shortDate(agencyDay(7))}. Approved invoices go out ${shortDate(payrollCloses)}.`,
                link: ["View billing", "/billing"] as const,
              },
              {
                label: "CLIENTS",
                body: (() => {
                  const clientKeys = new Set(["incidents", "care-plans", "supervision", "portal"]);
                  const open = urgent.filter((s) => clientKeys.has(s.key));
                  const names = open.map((s) => s.label.toLowerCase());
                  const list = names.length <= 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
                  return `${open.length === 0 ? "No open client escalations." : `${open.length} open client ${open.length === 1 ? "escalation" : "escalations"} — ${list}.`} One family conference today (Pamela P, 2:00 PM).`;
                })(),
                link: ["View clients", "/clients"] as const,
              },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-[5px]">
                <span className="text-[10.5px] font-semibold tracking-[.13em] text-[#9B9BA3]">{s.label}</span>
                <span className="text-[13.5px] leading-[1.6] text-[var(--ink-soft)] [text-wrap:pretty]">{s.body}</span>
                <Link to={s.link[1]} state={cameFrom({ label: "Behind the brief", to: "/brain", reopen: "why" })} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                  {s.link[0]} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- modals -- */}
      {modal && <div className="fixed inset-0 z-50 bg-[#14141E]/[.28]" onClick={() => setModal(null)} aria-hidden="true" />}

      {modal === "task" && (
        <div role="dialog" aria-label="New task" className={cn(modalClass, "w-[430px] overflow-hidden")}>
          <div className="flex flex-none items-center gap-3 px-6 pb-3 pt-[22px]">
            <span className="whitespace-nowrap text-base font-semibold tracking-[-.015em]">New task</span>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className={closeButton}>
              ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[15px] overflow-y-auto px-6 pb-2">
            <Field label="Title">
              <input type="text" value={taskTitle} autoFocus onChange={(e) => setTaskTitle(e.target.value)} placeholder="Call Vince W about increased hours" className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 bg-[var(--paper)] px-2.5 text-[13.5px] outline-none">
                {TASK_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3} placeholder="What needs to happen, and any context Joy should keep with the task." className="resize-y rounded-[11px] border border-black/10 px-3 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <div className="flex gap-1.5">
                  {["Low", "Medium", "High"].map((p) => (
                    <button key={p} type="button" onClick={() => setTaskPriority(p)} className={cn("h-[38px] flex-1 rounded-[11px] border text-[12.5px] transition-colors", taskPriority === p ? "border-[#1407A2]/30 bg-[#EFEDFB] font-medium text-primary" : "border-black/10 bg-[var(--paper)] text-[var(--ink-muted)]")}>
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Due date">
                <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Assigned to">
              <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 bg-[var(--paper)] px-2.5 text-[13.5px] outline-none">
                {ASSIGNEES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-none gap-2.5 border-t border-black/[.06] bg-[var(--paper-sunken)] px-6 py-4">
            <button type="button" onClick={() => setModal(null)} className="h-[38px] flex-1 rounded-[11px] border border-black/[.08] bg-[var(--paper)] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
              Cancel
            </button>
            <button type="button" onClick={createTask} className="h-[38px] flex-[1.6] rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              Create task
            </button>
          </div>
        </div>
      )}

      {modal === "event" && (
        <div role="dialog" aria-label={editing === null ? "New calendar event" : "Edit event"} className={cn(modalClass, "w-[420px] gap-4 overflow-y-auto px-6 py-[22px]")}>
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-[-.015em]">{editing === null ? "New calendar event" : "Edit event"}</span>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className={closeButton}>
              ✕
            </button>
          </div>
          <Field label="Title">
            <input type="text" value={evTitle} autoFocus onChange={(e) => setEvTitle(e.target.value)} placeholder="Dr. Li PCP appointment" className={inputClass} />
          </Field>
          <Field label="Date">
            <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input type="time" value={evStart} onChange={(e) => setEvStart(e.target.value)} className={inputClass} />
            </Field>
            <Field label="End">
              <input type="time" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[var(--ink-muted)]">Type</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setEvType(t)} className={cn("rounded-[20px] border px-[13px] py-1.5 text-[12.5px] transition-colors", evType === t ? "border-[#1407A2]/30 bg-[#EFEDFB] font-medium text-primary" : "border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)]")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {editing !== null && (
              <button type="button" onClick={deleteEvent} className="h-[38px] rounded-[11px] border border-[rgba(194,65,12,.24)] bg-[var(--paper)] px-3.5 text-[13px] font-medium text-[#C2410C] transition-colors hover:bg-[#FDF0E7]">
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setModal(null);
                setEditing(null);
              }}
              className="h-[38px] flex-1 rounded-[11px] border border-black/[.08] bg-[var(--paper)] text-[13px] font-medium transition-colors hover:bg-[var(--wash)]"
            >
              Cancel
            </button>
            <button type="button" onClick={saveEvent} className="h-[38px] flex-1 rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              {editing === null ? "Add event" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {modal === "subscribe" && (
        <div role="dialog" aria-label="Subscribe to the calendar" className={cn(modalClass, "w-[420px] gap-4 overflow-y-auto px-6 py-[22px]")}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="text-base font-semibold tracking-[-.015em]">Subscribe to the Joy Health calendar</span>
              <span className="text-[13px] leading-[1.55] text-[var(--ink-muted)]">Add this calendar to Apple, Google, or Outlook. Events keep syncing automatically.</span>
            </div>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[var(--wash-strong)] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {["Apple Calendar", "Google Calendar"].map((p) => (
              <button key={p} disabled title="The feed goes live when the developer connects calendar hosting" className="h-10 cursor-not-allowed rounded-[11px] border border-black/[.08] bg-[var(--wash-strong)] text-[13px] font-medium text-muted-foreground/60">
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="text-xs font-medium text-[var(--ink-muted)]">The subscribe link, once the feed is live</span>
            <div className="flex items-center gap-2">
              <span className="flex h-[38px] min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[11px] border border-[#1407A2]/[.35] bg-[#F7F7FE] px-3 text-[12.5px] text-primary">{FEED_URL}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(FEED_URL).catch(() => {});
                  toast.info("Example link copied", { description: "The real feed lands with the developer." });
                }}
                aria-label="Copy link"
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] border border-black/[.08] bg-[var(--paper)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--wash)]"
              >
                <Copy className="h-[15px] w-[15px]" aria-hidden="true" />
              </button>
            </div>
            <span className="text-xs leading-[1.5] text-muted-foreground">Anyone with the link can view this calendar — share carefully. The feed itself is not wired in the prototype; this is the shape of the real thing.</span>
          </div>
        </div>
      )}
    </div>
  );
}
