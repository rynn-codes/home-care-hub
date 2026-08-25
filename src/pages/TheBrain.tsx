import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { morningBrief } from "@/domain/home/brief";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { todaysAgenda } from "@/lib/joySeed";
import { weekBadge } from "@/domain/calendar/agencyWeek";
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
  type MyNeed,
} from "@/lib/brainSeed";

/**
 * The Brain — the agency at a glance, one level under Home.
 *
 * Not the home screen: the design's sidebar carries Home AND The Brain, and
 * this page's own breadcrumb reads "Home / The Brain / Overview". Home is the
 * morning — today's queue and what needs doing. The Brain is the wider read:
 * the written brief, what Joy is handling, the calendar and the log. The two
 * were briefly collapsed into one and Home was deleted; Karynn caught it on
 * 24 August, and both screens exist again.
 *
 * Rebuilt to the updated design
 * (docs/mockups/Joy Health The Brain.dc.html), which supersedes the Brief Band
 * dashboard. Karynn uploaded the design 24 Aug and confirmed the rebuild.
 *
 * Five tabs: Overview · My Work · Joy Operations · Calendar · Activity. The
 * Overview leads with the Brain Brief — a written paragraph, not metrics —
 * backed by a "See why" drawer of the records behind each sentence. Ask the
 * Brain is the single AI dot in this header (the app-wide Ask Joy pill stays
 * off this screen); its scoped prompts answer inline at the top of Overview,
 * and a free-typed question opens the full Command Center.
 *
 * Recorded deviations, same rules as every screen: the mock's light grays sit
 * at the accessible muted token; counts derive from the seed lists rather than
 * the mock's static 12/3/4/1; the mock's rate-change approval is an hours
 * change (client rates are never stored); every calendar week runs Sat–Fri;
 * and "Spruce" claims say "not wired yet" because nothing here sends anything.
 */

type View = "overview" | "mywork" | "operations" | "calendar" | "activity";
type Range = "today" | "week" | "month";
type OpsTab = "handled" | "working" | "waiting" | "needs";

const EYEBROW = "text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground";
const CARD = "rounded-[18px] border border-black/[.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,.02)]";

const CAT_COLOR: Record<BrainEvent["cat"], string> = {
  People: "text-[#7C3AED]",
  Payroll: "text-[#15803D]",
  Billing: "text-[#C2410C]",
  Agency: "text-primary",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

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

interface AddedEvent {
  date: string;
  title: string;
  start: string;
  end: string;
  type: string;
}

export default function TheBrain() {
  const signals = useHomeSignals();

  // Deep links into a tab. /brain/my-work exists because the current canvas
  // promotes My Work to its own nav item while it still lives inside The Brain;
  // /brain/operations exists because Home's Joy column now links every line it
  // prints somewhere, and most of them end up here.
  const { pathname } = useLocation();
  const [view, setView] = useState<View>(
    pathname.endsWith("/my-work") ? "mywork" : pathname.endsWith("/operations") ? "operations" : "overview",
  );
  const [range, setRange] = useState<Range>("week");
  const [filter, setFilter] = useState<"All" | BrainEvent["cat"]>("All");
  const [actFilter, setActFilter] = useState<"All" | (typeof brainActivity)[number]["cat"]>("All");
  const [ops, setOps] = useState<OpsTab>("working");
  const [opsNeedDone, setOpsNeedDone] = useState(false);
  const [myDay, setMyDay] = useState(0);
  const [myTab, setMyTab] = useState<"schedule" | "needs" | "waiting">("schedule");
  const [myDone, setMyDone] = useState<Record<string, boolean>>({});
  const [calView, setCalView] = useState<"month" | "agenda">("month");
  const [drawer, setDrawer] = useState<
    | { kind: "audit"; index: number }
    | { kind: "day"; date: string }
    | { kind: "sched" }
    | { kind: "why" }
    | null
  >(null);
  const [modal, setModal] = useState<"task" | "event" | "subscribe" | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askQ, setAskQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);

  const [addedTasks, setAddedTasks] = useLocalList<MyNeed>("joy-brain-tasks");
  const [addedEvents, setAddedEvents] = useLocalList<AddedEvent>("joy-brain-events");

  // ----------------------------------------------------------- the brief --
  const urgent = signals.filter((s) => s.urgent);
  const brief = useMemo(() => {
    const today = new Date().toISOString();
    const base = morningBrief({
      visitsToday: todaysAgenda.length,
      unassignedToday: todaysAgenda.filter((e) => e.state === "unassigned").length,
      signals,
      upcomingBillingWeek: upcomingBillingWeek(today),
      today,
    });
    const followUps = `Joy is carrying ${brainWorking.length} items forward and waiting on ${brainWaiting.length} outside parties.`;
    return `${base} ${followUps}`;
  }, [signals]);

  const headline =
    urgent.length === 0
      ? "Operations are in good shape."
      : `${urgent.length} ${urgent.length === 1 ? "thing needs" : "things need"} attention.`;

  // ------------------------------------------------------------- events --
  const allEvents: BrainEvent[] = useMemo(
    () => [
      ...brainEvents,
      ...addedEvents.map((e) => ({
        date: e.date,
        title: e.title,
        meta: `${e.start} – ${e.end} · added here`,
        cat: "Agency" as const,
        icon: "📅",
      })),
    ],
    [addedEvents],
  );

  const rangeEnd = range === "today" ? agencyDayOffsetOfToday() : range === "week" ? 6 : 31;
  const rangeStart = range === "today" ? agencyDayOffsetOfToday() : range === "week" ? 0 : -3;

  function agencyDayOffsetOfToday(): number {
    const t = new Date(`${todayIso()}T12:00:00`).getTime();
    const s = new Date(`${AGENCY_WEEK.start}T12:00:00`).getTime();
    return Math.round((t - s) / 86_400_000);
  }

  const goingOn = allEvents
    .filter((e) => filter === "All" || e.cat === filter)
    .filter((e) => e.date >= agencyDay(rangeStart) && e.date <= agencyDay(rangeEnd))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ------------------------------------------------------------- needs me --
  const needsAll: MyNeed[] = [...myNeeds, ...addedTasks];
  const needsOpen = needsAll.filter((n) => !myDone[n.title]).length;

  // --------------------------------------------------------------- month --
  // The month the grid is showing. A calendar whose arrows do nothing is worse
  // than one that scrolls into an empty month — an empty month is a true
  // statement about the diary, a dead arrow is a broken control.
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
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 1) % 7; // Sat-first columns
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ iso, day: d });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);

  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const onCurrentMonth =
    monthCursor.year === new Date().getFullYear() && monthCursor.month === new Date().getMonth();
  const cursorMonth = `${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, "0")}`;
  const inBillingWeek = (iso: string) => iso >= AGENCY_WEEK.start && iso <= AGENCY_WEEK.end;

  const acts = brainActivity.filter((a) => actFilter === "All" || a.cat === actFilter);

  // ------------------------------------------------------------- the ask --
  const askAnswers: Record<string, { a: string; links: Array<[string, string]> }> = {
    "What changed since yesterday?": {
      a: "Two things. Brandon finished Gusto onboarding and is one clear background check away from schedulable. Ruth Alvarez's Wednesday shift reopened after a caregiver call-out and still needs coverage. Nothing else changed materially.",
      links: [
        ["View hiring", "/operations/hiring"],
        ["View scheduling", "/scheduling"],
      ],
    },
    "Anything threatening payroll?": {
      a: `Not yet. Payroll closes ${shortDate(agencyDay(2))} with two corrected timecards outstanding — Chanel P's missing Saturday clock-out is one of them. Joy queued reminders at 7:42 AM and escalates at 2:00 PM today if they are not returned.`,
      links: [["View payroll", "/payroll"]],
    },
    "What are you waiting on?": {
      a: `${brainWaiting.length} items, all with outside parties: ${brainWaiting
        .map((w) => w.title)
        .join("; ")}. Each has an automated follow-up already scheduled.`,
      links: [["View Joy Operations", "#operations"]],
    },
  };

  const answer = asked ? askAnswers[asked] : null;

  const sendAsk = () => {
    const q = askQ.trim();
    setAskOpen(false);
    setAskQ("");
    if (!q) return;
    if (askAnswers[q]) {
      setAsked(q);
      return;
    }
    // A free question goes to the real conversational surface.
    document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: q } }));
  };

  // ------------------------------------------------------- task modal ----
  const [tTitle, setTTitle] = useState("");
  const [tCategory, setTCategory] = useState("Client follow-up");
  const [tDesc, setTDesc] = useState("");
  const [tPriority, setTPriority] = useState("Medium");
  const [tDue, setTDue] = useState(todayIso());
  const [tAssignee, setTAssignee] = useState("Karynn Verrett (me)");

  const createTask = () => {
    if (!tTitle.trim()) {
      toast.error("A task needs a title.");
      return;
    }
    setAddedTasks([
      ...addedTasks,
      {
        title: tTitle.trim(),
        subject: `${tCategory} · assigned to ${tAssignee}${tDesc.trim() ? ` · ${tDesc.trim()}` : ""}`,
        joyNote: `${tPriority} priority · added here, saved on this device`,
        due: `Due ${shortDate(tDue)}`,
        cta: "Open My Work →",
        href: "/",
      },
    ]);
    setModal(null);
    setTTitle("");
    setTDesc("");
    setView("mywork");
    setMyTab("needs");
    toast.success("Task saved on this device", { description: "It's in My Work → Needs Me." });
  };

  // ------------------------------------------------------ event modal ----
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(todayIso());
  const [evStart, setEvStart] = useState("14:00");
  const [evEnd, setEvEnd] = useState("15:00");
  const [evType, setEvType] = useState("General");

  const createEvent = () => {
    if (!evTitle.trim()) {
      toast.error("An event needs a title.");
      return;
    }
    setAddedEvents([...addedEvents, { date: evDate, title: evTitle.trim(), start: evStart, end: evEnd, type: evType }]);
    setModal(null);
    setEvTitle("");
    toast.success("Event saved on this device", { description: `${shortDate(evDate)} · ${evStart}–${evEnd}` });
  };

  const closeDrawer = () => setDrawer(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(null);
        setModal(null);
        setAskOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---------------------------------------------------------------- UI ---
  const pill = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-[9px] px-4 py-2 text-[13px] transition-colors",
      active ? "border border-black/[.09] bg-white font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)]" : "text-muted-foreground hover:text-foreground",
    );

  const quiet = (active: boolean) =>
    cn("whitespace-nowrap text-[12.5px] transition-colors", active ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground");

  const tabStyle = (active: boolean) =>
    cn(
      "-mb-px border-b-2 pb-3 text-[14.5px] tracking-[-.012em] transition-colors",
      active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-[22px]">
      {/* The design's own breadcrumb: Home / The Brain / {tab}. It is the line
          that says The Brain sits under Home rather than replacing it. */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 text-[13px]">
        <Link to="/" className="text-muted-foreground hover:text-primary">Home</Link>
        <span className="text-muted-foreground/40" aria-hidden="true">/</span>
        <span className="text-muted-foreground">The Brain</span>
        <span className="text-muted-foreground/40" aria-hidden="true">/</span>
        <span className="font-medium">
          {view === "overview" ? "Overview" : view === "mywork" ? "My Work" : view === "operations" ? "Joy Operations" : view === "calendar" ? "Calendar" : "Activity"}
        </span>
      </nav>

      {/* ------------------------------------------------------- header -- */}
      <section className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[280px] flex-1 flex-col gap-[5px]">
          <h1 className="m-0 bg-gradient-to-r from-[#1B1B1F] via-[#3B2FB8] to-[#1407A2] bg-clip-text text-[30px] font-bold leading-[1.15] tracking-[-.03em] text-transparent">
            The Brain
          </h1>
          <p className="m-0 text-sm text-muted-foreground">Your agency at a glance. Joy is monitoring the details.</p>
          <p className="m-0 mt-0.5 text-[13px] text-[#6E6E76]">
            {longDate(todayIso())} · {weekBadge(todayIso())}
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-2.5">
          <div className="flex gap-0.5 rounded-xl bg-[#F7F7F9] p-1" role="group" aria-label="Time range">
            {(
              [
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} aria-pressed={range === value} onClick={() => setRange(value)} className={pill(range === value)}>
                {label}
              </button>
            ))}
            <button
              disabled
              title="Custom ranges come with real data volumes"
              className="cursor-not-allowed whitespace-nowrap rounded-[9px] px-4 py-2 text-[13px] text-muted-foreground/50"
            >
              Custom
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setModal("task")}
              className="flex h-9 items-center gap-2 rounded-[11px] border border-black/[.08] bg-white px-[15px] text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              Add task
            </button>
            <button
              type="button"
              onClick={() => setAskOpen((v) => !v)}
              title="Ask the Brain"
              aria-label="Ask the Brain"
              className={cn(
                "flex h-9 w-9 flex-none items-center justify-center rounded-full border bg-[#191A2E] transition-colors",
                askOpen ? "border-[#1407A2]/40" : "border-black/[.08]",
              )}
            >
              <span className="h-[9px] w-[9px] rounded-full bg-[#8FA0FF]" style={{ animation: "joyGlow 2.6s ease-in-out infinite" }} />
            </button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- tabs -- */}
      <section className="flex items-center gap-[26px] overflow-x-auto border-b border-black/[.07]" role="tablist" aria-label="Brain views">
        {(
          [
            ["overview", "Overview"],
            ["mywork", "My Work"],
            ["operations", "Joy Operations"],
            ["calendar", "Calendar"],
            ["activity", "Activity"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)} className={tabStyle(view === value)}>
            {label}
          </button>
        ))}
      </section>

      {/* --------------------------------------------------- ask answer -- */}
      {asked && answer && (
        <section className="flex flex-col gap-2.5 rounded-[18px] border border-[#1407A2]/[.16] bg-white p-6 shadow-[0_1px_2px_rgba(20,7,162,.05)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#191A2E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8FA0FF]" style={{ animation: "joyGlow 2.6s ease-in-out infinite" }} />
            </span>
            <span className="text-[12.5px] text-[#6E6E76]">{asked}</span>
            <button type="button" onClick={() => setAsked(null)} className="ml-auto text-[12.5px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
          <p className="m-0 max-w-[800px] text-[15px] leading-[1.7] [text-wrap:pretty]">{answer.a}</p>
          <div className="flex flex-wrap gap-4">
            {answer.links.map(([label, href]) =>
              href.startsWith("#") ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => setView("operations")}
                  className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
                >
                  {label} →
                </button>
              ) : (
                <Link key={label} to={href} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                  {label} →
                </Link>
              ),
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- Overview -- */}
      {view === "overview" && (
        <div className="flex flex-col gap-[22px]">
          <section className={cn(CARD, "flex flex-col gap-3 px-[26px] py-6")}>
            <span className={EYEBROW}>Brain Brief</span>
            <p className="m-0 text-[19px] font-medium leading-[1.5] tracking-[-.018em]">{headline}</p>
            <p className="m-0 max-w-[800px] text-[15px] leading-[1.75] text-[#3A3A42] [text-wrap:pretty]">{brief}</p>
            {/* A recorded deviation the static mock cannot show: the most
                pressing signals as live links into the screen that can do
                something about them. Capped at three and kept in the quiet
                link colour — the brief is a paragraph, not an alarm board, and
                the full list is one tap away under See why. */}
            {urgent.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {urgent.slice(0, 3).map((s) => (
                  <Link key={s.key} to={s.to} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {s.label} — {s.detail ?? s.value} →
                  </Link>
                ))}
                {urgent.length > 3 && (
                  <span className="text-[12.5px] text-muted-foreground">
                    and {urgent.length - 3} more
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setDrawer({ kind: "why" })}
              className="self-start text-[13px] font-medium text-primary hover:text-[#2A1BD1]"
            >
              See why →
            </button>
          </section>

          <div className="grid items-stretch gap-[18px] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)]">
            <section className={cn(CARD, "flex min-w-0 flex-col px-6 py-5")}>
              <div className="mb-2 flex items-center gap-[18px]">
                <span className={cn(EYEBROW, "whitespace-nowrap")}>What's Going On</span>
                <div className="ml-auto flex flex-none gap-3">
                  {(["All", "Agency", "Payroll", "Billing", "People"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)} className={quiet(filter === f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {goingOn.map((e) => (
                <div key={`${e.date}-${e.title}`} className="flex items-start gap-5 border-t border-black/[.05] py-3.5">
                  <span className="w-[58px] flex-none text-[12.5px] font-medium text-muted-foreground">{shortDate(e.date)}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-sm font-medium tracking-[-.01em]">
                      {e.icon}&ensp;{e.title}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                  </div>
                  <span className="flex-none self-center rounded-full bg-[#F4F4F6] px-2.5 py-[3px] text-[11px] text-[#6E6E76]">{e.cat}</span>
                </div>
              ))}
              {goingOn.length === 0 && (
                <p className="m-0 py-6 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this period.</p>
              )}
            </section>

            <section className={cn(CARD, "flex min-w-0 flex-col gap-3.5 px-6 py-5")}>
              <div className="flex items-baseline gap-3">
                <span className={EYEBROW}>Calendar</span>
                <span className="ml-auto text-[12.5px] text-muted-foreground">{monthLabel}</span>
              </div>
              <div className="grid flex-1 grid-cols-7 gap-[5px]">
                {["S", "S", "M", "T", "W", "T", "F"].map((d, i) => (
                  <span key={i} className="text-center text-[10px] font-semibold tracking-[.06em] text-muted-foreground/70">
                    {d}
                  </span>
                ))}
                {monthCells.map((c, i) =>
                  c === null ? (
                    <span key={`b${i}`} className="h-[26px]" />
                  ) : (
                    <span
                      key={c.iso}
                      className={cn(
                        "flex h-[26px] items-center justify-center text-[11.5px]",
                        inBillingWeek(c.iso)
                          ? cn(
                              "bg-[#DCE0FB] text-[#3B2FB8]",
                              c.iso === AGENCY_WEEK.start && "rounded-l-lg",
                              c.iso === AGENCY_WEEK.end && "rounded-r-lg",
                            )
                          : "rounded-lg text-muted-foreground",
                        c.iso === todayIso() && "font-semibold text-primary shadow-[inset_0_0_0_1.5px_#1407A2]",
                      )}
                    >
                      {c.day}
                    </span>
                  ),
                )}
              </div>
              <div className="flex items-center gap-[9px]">
                <span className="h-2.5 w-[22px] flex-none rounded-[5px] bg-[#DCE0FB]" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{weekLabel} · this billing week</span>
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
                    <span className="text-[12.5px] text-muted-foreground">{a.meta}</span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setView("activity")}
                className="mt-3.5 self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
              >
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
                    <span className={cn("text-[22px] font-medium leading-none tracking-[-.03em]", label === "NEEDS YOU" && !opsNeedDone && "text-[#C2410C]")}>
                      {n}
                    </span>
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
              <button
                type="button"
                onClick={() => setView("operations")}
                className="self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
              >
                View Joy Operations →
              </button>
            </section>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ My Work -- */}
      {view === "mywork" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-semibold tracking-[-.02em]">My Work</h2>
            <p className="m-0 text-[13.5px] text-muted-foreground">Your schedule, decisions, and items you're tracking.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMyDay((d) => Math.max(0, d - 1))}
                aria-label="Previous day"
                className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-white text-[#6E6E76] hover:bg-[#FAFAFB]"
              >
                ‹
              </button>
              <span className="min-w-[150px] text-center text-sm font-medium tracking-[-.01em]">
                {myDay === 0 ? longDate(todayIso()) : longDate(agencyDay(agencyDayOffsetOfToday() + 1))}
              </span>
              <button
                type="button"
                onClick={() => setMyDay((d) => Math.min(1, d + 1))}
                aria-label="Next day"
                className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-white text-[#6E6E76] hover:bg-[#FAFAFB]"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setMyDay(0)}
                className={cn(
                  "rounded-[9px] border border-black/[.08] px-[13px] py-[7px] text-[12.5px] font-medium",
                  myDay === 0 ? "bg-[#F1F2F6] text-primary" : "bg-white text-[#6E6E76]",
                )}
              >
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
              <span className={EYEBROW}>
                {myDay === 0 ? `Today · ${longDate(todayIso()).toUpperCase()}` : longDate(agencyDay(agencyDayOffsetOfToday() + 1)).toUpperCase()}
              </span>
              {myDay === 0 ? (
                <>
                  {myEvents.map((ev) => (
                    <button
                      key={ev.title}
                      type="button"
                      onClick={() => ev.drawer && setDrawer({ kind: "sched" })}
                      className={cn(
                        "flex w-full items-start gap-[22px] border-t border-black/[.05] py-[18px] pr-2 text-left",
                        ev.drawer ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      <span className="flex w-[88px] flex-none flex-col gap-0.5">
                        <span className={cn("text-[13px] font-medium", ev.done ? "text-muted-foreground/50" : "text-muted-foreground")}>{ev.time}</span>
                        <span className={cn("text-[11.5px]", ev.done ? "text-muted-foreground/40" : "text-muted-foreground/70")}>{ev.duration}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className={cn("text-[15px] font-medium tracking-[-.01em]", ev.done && "text-muted-foreground/60")}>{ev.title}</span>
                        <span className={cn("text-[13px]", ev.done ? "text-muted-foreground/50" : "text-muted-foreground")}>{ev.meta}</span>
                        <span className={cn("text-[12.5px]", ev.done ? "text-muted-foreground/50" : "text-[#6E6E8A]")}>{ev.joyNote}</span>
                      </span>
                      <span
                        className={cn(
                          "flex-none self-center rounded-full px-[11px] py-1 text-[11.5px]",
                          ev.done ? "bg-[#F4F4F6] text-muted-foreground" : "bg-[#EFEDFB] text-primary",
                        )}
                      >
                        {ev.tag}
                      </span>
                    </button>
                  ))}
                  <div className="mt-5 flex flex-col gap-2.5 border-t border-black/[.05] pt-4">
                    <span className={EYEBROW}>Tomorrow · {longDate(agencyDay(agencyDayOffsetOfToday() + 1)).toUpperCase()}</span>
                    {myTomorrow.map((t) => (
                      <div key={t.label} className="flex gap-[22px] text-[13.5px] text-[#6E6E76]">
                        <span className="w-[88px] flex-none text-muted-foreground">{t.time}</span>
                        {t.label}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMyDay(1)}
                      className="self-start text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
                    >
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
            <section className={cn(CARD, "px-6 py-5")}>
              <div className="mb-1 flex items-center gap-3">
                <span className={EYEBROW}>Needs Me</span>
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {needsOpen} {needsOpen === 1 ? "item" : "items"}
                </span>
              </div>
              {needsOpen === 0 && (
                <div className="flex flex-col items-center gap-[7px] py-11 text-center">
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#F1F2F6]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1407A2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.6 8.4l2.8 2.8 6-6.4" />
                    </svg>
                  </span>
                  <span className="text-base font-medium tracking-[-.015em]">You're all caught up.</span>
                  <span className="text-[13.5px] text-muted-foreground">Joy doesn't need any decisions from you right now.</span>
                </div>
              )}
              {needsAll.map((n) => {
                const isDone = Boolean(myDone[n.title]);
                return (
                  <div key={n.title} className="flex gap-5 border-t border-black/[.05] py-5">
                    <button
                      type="button"
                      onClick={() => setMyDone((d) => ({ ...d, [n.title]: !d[n.title] }))}
                      aria-label={isDone ? `Reopen ${n.title}` : `Mark ${n.title} done`}
                      className={cn(
                        "mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.4px] transition-colors",
                        isDone ? "border-primary bg-primary" : "border-[#C8C8D0] bg-transparent",
                      )}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn("transition-opacity", isDone ? "opacity-100" : "opacity-0")}
                      >
                        <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                      </svg>
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                      <span className={cn("text-[15px] font-medium tracking-[-.01em]", isDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>
                        {n.title}
                      </span>
                      <span className={cn("text-[13px]", isDone ? "text-muted-foreground/50" : "text-[#6E6E76]")}>{n.subject}</span>
                      <span className={cn("text-[12.5px]", isDone ? "text-muted-foreground/40" : "text-muted-foreground")}>{n.joyNote}</span>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-[9px]">
                      <span className={cn("text-xs", isDone ? "text-muted-foreground/50" : "text-[#C2410C]")}>{n.due}</span>
                      <Link to={n.href} className={cn("text-[12.5px] font-medium", isDone ? "text-muted-foreground/50" : "text-primary hover:text-[#2A1BD1]")}>
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
                    <span className="text-[13px] text-[#6E6E76]">{w.state}</span>
                    <span className="text-[12.5px] text-muted-foreground">{w.next}</span>
                  </div>
                  <Link to={w.href} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {w.cta} →
                  </Link>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {/* ------------------------------------------------- Joy Operations -- */}
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
                ["needs", "NEEDS YOU", opsNeedDone ? "0" : "1", "Human judgment required.", "text-[#C2410C]"],
              ] as const
            ).map(([value, label, n, blurb, tone]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOps(value)}
                aria-pressed={ops === value}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-2xl border bg-white p-5 text-left transition-colors",
                  ops === value ? "border-[#1407A2]/[.28] shadow-[0_1px_2px_rgba(20,7,162,.08)]" : "border-black/[.06] shadow-[0_1px_2px_rgba(0,0,0,.02)]",
                )}
              >
                <span className={cn("text-[10.5px] font-semibold tracking-[.13em]", tone)}>{label}</span>
                <span className={cn("text-2xl font-medium leading-none tracking-[-.03em]", value === "needs" && !opsNeedDone && "text-[#C2410C]")}>{n}</span>
                <span className="text-xs text-muted-foreground">{blurb}</span>
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
                    <span className="text-[13.5px] leading-[1.6] text-[#3A3A42] [text-wrap:pretty]">{w.summary}</span>
                    <span className="mt-1.5 text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">NEXT ACTION</span>
                    <span className="text-[13px] text-[#6E6E76]">{w.next}</span>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2.5">
                    <span className="text-xs text-muted-foreground/70">Updated {w.updated}</span>
                    <button
                      type="button"
                      onClick={() => setDrawer({ kind: "audit", index: i })}
                      className="rounded-[20px] border border-[#1407A2]/[.16] bg-white px-[13px] py-1.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-[#FAFAFB]"
                    >
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
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                    <path d="M3.4 8.4l2.8 2.8 6.4-6.6" />
                  </svg>
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
                    <span className="text-[13px] text-[#6E6E76]">{w.state}</span>
                    <span className="text-[12.5px] text-muted-foreground">{w.next}</span>
                  </div>
                  <Link to={w.href} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {w.cta} →
                  </Link>
                </div>
              ))}
              <p className="m-0 mt-3.5 text-[12.5px] text-muted-foreground">Nothing here needs you — Joy acted and knows what happens next.</p>
            </section>
          )}

          {ops === "needs" && (
            <section className="rounded-[18px] border border-[#C2410C]/[.18] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,.02)]">
              <span className={EYEBROW}>Needs You · {opsNeedDone ? 0 : 1}</span>
              <div className="flex gap-5 border-t border-black/[.05] py-5">
                <button
                  type="button"
                  onClick={() => setOpsNeedDone((v) => !v)}
                  aria-label="Mark handled"
                  className={cn(
                    "mt-[3px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-md border-[1.5px] transition-colors",
                    opsNeedDone ? "border-primary bg-primary" : "border-[#C8C8D0] bg-transparent",
                  )}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("transition-opacity", opsNeedDone ? "opacity-100" : "opacity-0")}
                  >
                    <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                  </svg>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <span className={cn("text-base font-medium tracking-[-.015em]", opsNeedDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>
                    {brainNeedsYou.title}
                  </span>
                  <span className="text-[13.5px] text-[#6E6E76]">{brainNeedsYou.subject}</span>
                  <span className="max-w-[580px] text-[13.5px] leading-[1.65] text-[#3A3A42] [text-wrap:pretty]">{brainNeedsYou.detail}</span>
                  <span className="text-[13px] text-[#6E6E8A]">{brainNeedsYou.recommends}</span>
                </div>
                <div className="flex flex-none flex-col gap-[9px] self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setOpsNeedDone(true);
                      toast.success("Hours increase approved", {
                        description: "Susan Miller moves to 16 hrs/week. The schedule change is Joy's to carry out.",
                      });
                    }}
                    className="flex h-9 items-center justify-center rounded-[11px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                  >
                    Approve
                  </button>
                  <Link
                    to={brainNeedsYou.href}
                    className="flex h-9 items-center justify-center rounded-[11px] border border-black/[.08] px-[18px] text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]"
                  >
                    Review details
                  </Link>
                </div>
              </div>
              <p className="m-0 mt-3.5 text-[12.5px] text-muted-foreground">
                A short list here is the goal — everything else Joy is authorized to carry forward.
              </p>
            </section>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- Calendar -- */}
      {view === "calendar" && (
        <section className={cn(CARD, "px-6 py-[22px]")}>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
                className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-white text-[#6E6E76] transition-colors hover:bg-[#FAFAFB]"
              >
                ‹
              </button>
              <h2 className="m-0 whitespace-nowrap text-xl font-semibold tracking-[-.02em]">{monthLabel}</h2>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                aria-label="Next month"
                className="h-[30px] w-[30px] rounded-[9px] border border-black/[.08] bg-white text-[#6E6E76] transition-colors hover:bg-[#FAFAFB]"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() =>
                  setMonthCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })
                }
                aria-label="Jump the calendar to this month"
                className={cn(
                  "rounded-[9px] border border-black/[.08] px-[13px] py-[7px] text-[12.5px] font-medium transition-colors",
                  onCurrentMonth ? "bg-[#F1F2F6] text-primary" : "bg-white text-[#6E6E76] hover:bg-[#FAFAFB]",
                )}
              >
                Today
              </button>
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
              <button
                type="button"
                onClick={() => setModal("subscribe")}
                className="flex h-9 items-center gap-2 rounded-[11px] border border-black/[.08] bg-white px-[15px] text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]"
              >
                <Share2 className="h-3.5 w-3.5 text-[#6E6E76]" aria-hidden="true" />
                Subscribe
              </button>
              <button
                type="button"
                onClick={() => setModal("event")}
                className="flex h-9 items-center gap-2 rounded-[11px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              >
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
                <button key={f} type="button" onClick={() => setFilter(f)} className={quiet(filter === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {calView === "month" && (
            <div className="grid grid-cols-7 gap-1.5">
              {["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"].map((d) => (
                <span key={d} className="pb-1 text-[10.5px] font-semibold tracking-[.09em] text-muted-foreground/70">
                  {d}
                </span>
              ))}
              {monthCells.map((c, i) => {
                if (c === null) return <span key={`b${i}`} className="min-h-[78px]" />;
                const marks = allEvents.filter((e) => e.date === c.iso && (filter === "All" || e.cat === filter));
                const isToday = c.iso === todayIso();
                const billing = inBillingWeek(c.iso);
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => setDrawer({ kind: "day", date: c.iso })}
                    className={cn(
                      "flex min-h-[78px] flex-col items-start gap-1 overflow-hidden rounded-[11px] border p-2 text-left transition-colors",
                      billing ? "border-[#1407A2]/[.14] bg-[#EFF1FE]" : "border-black/[.06] bg-white hover:bg-[#FAFAFB]",
                      isToday && "border-[#1407A2]/[.45]",
                    )}
                  >
                    <span className={cn("text-[12.5px] tabular-nums", isToday ? "font-semibold text-primary" : "text-[#6E6E76]")}>{c.day}</span>
                    {marks.map((m) => (
                      <span key={m.title} className={cn("block max-w-full truncate text-[10.5px] leading-[1.35]", CAT_COLOR[m.cat])}>
                        {m.icon} {m.title}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          )}

          {calView === "agenda" && (
            <div className="flex flex-col gap-3.5">
              {[...new Set(goingOnAllMonth(allEvents, filter, cursorMonth).map((e) => e.date))].map((date) => (
                <div key={date} className="overflow-hidden rounded-[14px] border border-black/[.06]">
                  <div className="bg-[#F7F7F9] px-4 py-[11px] text-[12.5px] font-medium text-[#3A3A42]">{longDate(date)}</div>
                  {goingOnAllMonth(allEvents, filter, cursorMonth)
                    .filter((e) => e.date === date)
                    .map((e) => (
                      <div key={e.title} className="flex items-center gap-3.5 border-t border-black/[.05] px-4 py-3.5">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[#F1F0FC] text-sm">{e.icon}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                          <span className="text-sm font-medium tracking-[-.01em]">{e.title}</span>
                          <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                        </div>
                        <span className="flex-none rounded-full bg-[#F4F4F6] px-2.5 py-[3px] text-[11px] text-[#6E6E76]">{e.cat}</span>
                      </div>
                    ))}
                </div>
              ))}
              {goingOnAllMonth(allEvents, filter, cursorMonth).length === 0 && (
                <p className="m-0 py-6 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this period.</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ----------------------------------------------------- Activity -- */}
      {view === "activity" && (
        <section className={cn(CARD, "px-6 py-[22px]")}>
          <div className="mb-1.5 flex flex-wrap items-center gap-3.5">
            <div className="flex flex-col gap-[3px]">
              <h2 className="m-0 text-xl font-semibold tracking-[-.02em]">Activity</h2>
              <p className="m-0 text-[13px] text-muted-foreground">What happened across Joy Health.</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              {(["All", "Clients", "Employees", "Payroll", "Billing", "Joy"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setActFilter(f)} className={quiet(actFilter === f)}>
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
              <Link to={a.href} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                {a.cta} →
              </Link>
            </div>
          ))}
          {acts.length === 0 && <p className="m-0 py-[30px] text-center text-[13.5px] text-muted-foreground">No activity in this time range.</p>}
        </section>
      )}

      {/* --------------------------------------------------- Ask popover -- */}
      {askOpen && (
        <>
          <div className="fixed inset-0 z-[48]" onClick={() => setAskOpen(false)} aria-hidden="true" />
          <div className="fixed right-14 top-[150px] z-[52] flex w-[400px] flex-col gap-3 rounded-[18px] border border-[#1407A2]/[.14] bg-white p-[18px] shadow-[0_20px_50px_rgba(20,20,30,.16)]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#191A2E]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8FA0FF]" style={{ animation: "joyGlow 2.6s ease-in-out infinite" }} />
              </span>
              <span className="whitespace-nowrap text-sm font-semibold tracking-[-.01em]">Ask the Brain</span>
              <button
                type="button"
                onClick={() => setAskOpen(false)}
                aria-label="Close"
                className="ml-auto h-[26px] w-[26px] rounded-lg text-[13px] text-muted-foreground transition-colors hover:bg-[#F1F2F6] hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-[9px] rounded-[13px] border border-[#1407A2]/[.14] py-[7px] pl-[13px] pr-[7px]">
              <input
                type="text"
                value={askQ}
                autoFocus
                onChange={(e) => setAskQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAsk()}
                placeholder="Ask the Brain anything…"
                aria-label="Ask the Brain"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={sendAsk}
                aria-label="Send"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-[#2A1BD1]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13V3.4M4.2 7.2L8 3.4l3.8 3.8" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-start gap-[7px]">
              {Object.keys(askAnswers).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setAsked(q);
                    setAskOpen(false);
                    setView("overview");
                  }}
                  className="rounded-[20px] border border-[#1407A2]/[.16] bg-white px-3 py-1.5 text-left text-xs text-primary transition-colors hover:bg-[#FAFAFB]"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="m-0 text-[11.5px] text-muted-foreground [text-wrap:pretty]">
              A typed question opens the full Joy conversation.
            </p>
          </div>
        </>
      )}

      {/* ------------------------------------------------------- drawers -- */}
      {drawer && <div className="fixed inset-0 z-40 bg-[#14141E]/[.14]" onClick={closeDrawer} aria-hidden="true" />}

      {drawer?.kind === "audit" && (
        <div role="dialog" aria-label="Joy audit" className="fixed bottom-0 right-0 top-0 z-[45] flex w-[420px] max-w-full flex-col overflow-y-auto border-l border-black/[.08] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.08)]">
          {(() => {
            const a = brainWorking[drawer.index].audit;
            return (
              <>
                <div className="flex items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[17px] font-semibold tracking-[-.02em]">{a.title}</span>
                    <span className="text-[13px] text-[#6E6E76]">{a.subtitle}</span>
                  </div>
                  <button type="button" onClick={closeDrawer} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
                    ✕
                  </button>
                </div>
                {(
                  [
                    ["CURRENT STATUS", <span key="s" className="text-sm font-medium">{a.status}</span>],
                    ["WHY JOY ACTED", <span key="w" className="text-[13.5px] leading-[1.6] text-[#3A3A42] [text-wrap:pretty]">{a.why}</span>],
                    [
                      "JOY ACTIVITY",
                      <div key="t" className="flex flex-col gap-[11px]">
                        {a.timeline.map(([time, label]) => (
                          <div key={time + label} className="flex gap-3.5">
                            <span className="w-[66px] flex-none text-[12.5px] text-muted-foreground">{time}</span>
                            <span className="flex-1 text-[13.5px] text-[#3A3A42]">{label}</span>
                          </div>
                        ))}
                        <span className="text-[12.5px] text-muted-foreground">Channel · {a.channel}</span>
                      </div>,
                    ],
                    [
                      "NEXT ACTION",
                      <div key="n" className="flex flex-col gap-1">
                        <span className="text-[13.5px] leading-[1.6] text-[#3A3A42] [text-wrap:pretty]">{a.next}</span>
                        <span className="mt-1 text-[13px] text-[#6E6E8A]">No action needed from you.</span>
                      </div>,
                    ],
                  ] as const
                ).map(([label, body]) => (
                  <div key={label} className="flex flex-col gap-[7px] border-b border-black/[.05] px-6 py-5">
                    <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">{label}</span>
                    {body}
                  </div>
                ))}
                <div className="flex flex-col gap-[9px] px-6 py-5">
                  <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">SOURCE RECORDS</span>
                  {a.sources.map((s) => (
                    <span key={s} className="text-[13px] text-[#6E6E76]">
                      {s}
                    </span>
                  ))}
                  <Link
                    to={a.href}
                    className="mt-1.5 flex h-[38px] items-center justify-center rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
                  >
                    {a.cta}
                  </Link>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {drawer?.kind === "day" && (
        <div role="dialog" aria-label="Day detail" className="fixed bottom-0 right-0 top-0 z-[45] flex w-[400px] max-w-full flex-col overflow-y-auto border-l border-black/[.08] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.08)]">
          <div className="flex items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[17px] font-semibold tracking-[-.02em]">{longDate(drawer.date)}</span>
              <span className="text-[13px] text-[#6E6E76]">
                {inBillingWeek(drawer.date) ? `${weekLabel} · this billing week` : "Outside the current billing week"}
              </span>
            </div>
            <button type="button" onClick={closeDrawer} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex flex-col px-6 pb-5 pt-2">
            {allEvents
              .filter((e) => e.date === drawer.date)
              .map((e) => (
                <div key={e.title} className="flex gap-[13px] border-b border-black/[.05] py-4">
                  <span className="flex-none text-[15px] leading-[1.3]">{e.icon}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-sm font-medium tracking-[-.01em]">{e.title}</span>
                    <span className="text-[12.5px] text-muted-foreground">{e.meta}</span>
                  </div>
                </div>
              ))}
            {allEvents.filter((e) => e.date === drawer.date).length === 0 && (
              <p className="m-0 py-7 text-center text-[13.5px] text-muted-foreground">Nothing notable is scheduled for this day.</p>
            )}
          </div>
        </div>
      )}

      {drawer?.kind === "sched" && (
        <div role="dialog" aria-label="Prepared visit" className="fixed bottom-0 right-0 top-0 z-[45] flex w-[400px] max-w-full flex-col overflow-y-auto border-l border-black/[.08] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.08)]">
          <div className="flex items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[17px] font-semibold tracking-[-.02em]">Dolores Vance</span>
              <span className="text-[13px] text-[#6E6E76]">Family care conference · client home</span>
              <span className="text-[12.5px] text-muted-foreground">Today · 2:00–2:45 PM</span>
            </div>
            <button type="button" onClick={closeDrawer} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-[7px] border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">STATUS</span>
            <span className="text-sm font-medium">Family confirmed</span>
          </div>
          <div className="flex flex-col gap-2.5 border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">JOY PREPARED</span>
            {["Latest care plan", "Last visit summary", "Open family questions", "The incident report from Aug 18"].map((l) => (
              <span key={l} className="flex items-center gap-[9px] text-[13.5px] text-[#3A3A42]">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M3.4 8.4l2.8 2.8 6.4-6.6" />
                </svg>
                {l}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-b border-black/[.05] px-6 py-5">
            <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">ATTENDEES</span>
            <span className="text-[13.5px] text-[#3A3A42]">Kelsey Westley, RN</span>
            <span className="text-[13.5px] text-[#3A3A42]">Marta Vance · Niece</span>
          </div>
          <div className="flex flex-col gap-[9px] px-6 py-5">
            <Link to="/clients" className="flex h-[38px] items-center justify-center rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              Open client
            </Link>
            <Link to="/clients/care-plans" className="flex h-[38px] items-center justify-center rounded-[11px] border border-black/[.08] text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]">
              View care plan
            </Link>
          </div>
        </div>
      )}

      {drawer?.kind === "why" && (
        <div role="dialog" aria-label="Behind the brief" className="fixed bottom-0 right-0 top-0 z-[45] flex w-[400px] max-w-full flex-col overflow-y-auto border-l border-black/[.08] bg-white shadow-[-12px_0_40px_rgba(0,0,0,.08)]">
          <div className="flex items-start gap-3 border-b border-black/[.05] px-6 pb-4 pt-[22px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[17px] font-semibold tracking-[-.02em]">Behind the brief</span>
              <span className="text-[13px] text-[#6E6E76]">{longDate(todayIso())} · records supporting today's summary</span>
            </div>
            <button type="button" onClick={closeDrawer} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-[18px] px-6 py-5">
            {/* Everything the brief capped, in full — the brief shows three,
                this is the whole list, each still a link to the owning screen. */}
            {urgent.length > 0 && (
              <div className="flex flex-col gap-[5px]">
                <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">
                  NEEDS YOU · {urgent.length}
                </span>
                {urgent.map((u) => (
                  <Link
                    key={u.key}
                    to={u.to}
                    className="text-[13.5px] leading-[1.6] text-primary hover:text-[#2A1BD1]"
                  >
                    {u.label} — {u.detail ?? u.value} →
                  </Link>
                ))}
              </div>
            )}
            {[
              {
                label: "VISIT COVERAGE",
                body: `${todaysAgenda.length} scheduled entries today · ${
                  todaysAgenda.filter((e) => e.state === "unassigned").length === 0
                    ? "all assigned"
                    : `${todaysAgenda.filter((e) => e.state === "unassigned").length} still need a caregiver`
                }.`,
                link: ["View scheduling", "/scheduling"],
              },
              {
                label: "PAYROLL",
                body: `Closes ${shortDate(agencyDay(2))}. Two timecards outstanding — Chanel P's Saturday clock-out is one. Joy queued reminders at 7:42 AM.`,
                link: ["View payroll", "/payroll"],
              },
              {
                label: "BILLING",
                body: `The Saturday run drafts ${shortDate(agencyDay(7))} for the week beginning ${shortDate(agencyDay(7))}. Approved invoices go out ${shortDate(agencyDay(2))}.`,
                link: ["View billing", "/billing"],
              },
              {
                label: "CLIENTS",
                // Client matters only. An earlier version listed every urgent
                // signal here, which filed payroll and billing under CLIENTS —
                // the full list has its own section at the top of this drawer.
                body: (() => {
                  const clientKeys = new Set(["incidents", "care-plans", "supervision", "portal"]);
                  const mine = urgent.filter((u) => clientKeys.has(u.key));
                  const lead =
                    mine.length === 0
                      ? "No open client escalations."
                      : `${mine.map((u) => `${u.label.toLowerCase()} (${u.detail ?? u.value})`).join(", ")}.`;
                  return `${lead} One family conference today (Dolores Vance, 2:00 PM).`;
                })(),
                link: ["View clients", "/clients"],
              },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-[5px]">
                <span className="text-[10.5px] font-semibold tracking-[.13em] text-muted-foreground">{s.label}</span>
                <span className="text-[13.5px] leading-[1.6] text-[#3A3A42] [text-wrap:pretty]">{s.body}</span>
                <Link to={s.link[1]} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
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
        <div role="dialog" aria-label="New task" className="fixed left-1/2 top-24 z-[55] flex w-[430px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-[15px] rounded-[18px] border border-black/[.07] bg-white px-6 py-[22px] shadow-[0_24px_60px_rgba(20,20,30,.18)]">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-base font-semibold tracking-[-.015em]">New task</span>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className="ml-auto h-7 w-7 rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <ModalField label="Title">
            <input
              type="text"
              value={tTitle}
              autoFocus
              onChange={(e) => setTTitle(e.target.value)}
              placeholder="Call Susan Miller about increased hours"
              className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none placeholder:text-muted-foreground"
            />
          </ModalField>
          <ModalField label="Category">
            <select value={tCategory} onChange={(e) => setTCategory(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 bg-white px-2.5 text-[13.5px] outline-none">
              {["Client follow-up", "Caregiver / employee", "Scheduling", "Billing", "Payroll", "Admissions", "Hiring", "Compliance"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Description">
            <textarea
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              rows={3}
              placeholder="What needs to happen, and any context Joy should keep with the task."
              className="resize-y rounded-[11px] border border-black/10 px-3 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground"
            />
          </ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Priority">
              <div className="flex gap-1.5">
                {["Low", "Medium", "High"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTPriority(p)}
                    className={cn(
                      "h-[38px] flex-1 rounded-[11px] border text-[12.5px] transition-colors",
                      tPriority === p ? "border-[#1407A2]/30 bg-[#EFEDFB] font-medium text-primary" : "border-black/10 bg-white text-[#6E6E76]",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </ModalField>
            <ModalField label="Due date">
              <input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none" />
            </ModalField>
          </div>
          <ModalField label="Assigned to">
            <select value={tAssignee} onChange={(e) => setTAssignee(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 bg-white px-2.5 text-[13.5px] outline-none">
              {["Karynn Verrett (me)", "Kelsey Westley, RN", "John Segura", "Chanel P", "Tanya Robinson", "Joy (if authorized)"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </ModalField>
          <div className="flex gap-2.5 pt-0.5">
            <button type="button" onClick={() => setModal(null)} className="h-[38px] flex-1 rounded-[11px] border border-black/[.08] bg-white text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]">
              Cancel
            </button>
            <button type="button" onClick={createTask} className="h-[38px] flex-[1.6] rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              Create task
            </button>
          </div>
        </div>
      )}

      {modal === "event" && (
        <div role="dialog" aria-label="New calendar event" className="fixed left-1/2 top-24 z-[55] flex w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-4 rounded-[18px] border border-black/[.07] bg-white px-6 py-[22px] shadow-[0_24px_60px_rgba(20,20,30,.18)]">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-[-.015em]">New calendar event</span>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className="ml-auto h-7 w-7 rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <ModalField label="Title">
            <input
              type="text"
              value={evTitle}
              autoFocus
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="Dr. Li PCP appointment"
              className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none placeholder:text-muted-foreground"
            />
          </ModalField>
          <ModalField label="Date">
            <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none" />
          </ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Start">
              <input type="time" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none" />
            </ModalField>
            <ModalField label="End">
              <input type="time" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="h-[38px] rounded-[11px] border border-black/10 px-3 text-[13.5px] outline-none" />
            </ModalField>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[#6E6E76]">Type</span>
            <div className="flex flex-wrap gap-2">
              {["General", "Medical", "Family", "Personal", "Transport", "Shift", "Billing", "Payroll"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEvType(t)}
                  className={cn(
                    "rounded-[20px] border px-[13px] py-1.5 text-[12.5px] transition-colors",
                    evType === t ? "border-[#1407A2]/30 bg-[#EFEDFB] font-medium text-primary" : "border-black/[.08] bg-white text-[#6E6E76]",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => setModal(null)} className="h-[38px] flex-1 rounded-[11px] border border-black/[.08] bg-white text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]">
              Cancel
            </button>
            <button type="button" onClick={createEvent} className="h-[38px] flex-1 rounded-[11px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              Add event
            </button>
          </div>
        </div>
      )}

      {modal === "subscribe" && (
        <div role="dialog" aria-label="Subscribe to the calendar" className="fixed left-1/2 top-[150px] z-[55] flex w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-4 rounded-[18px] border border-black/[.07] bg-white px-6 py-[22px] shadow-[0_24px_60px_rgba(20,20,30,.18)]">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="text-base font-semibold tracking-[-.015em]">Subscribe to the Joy Health calendar</span>
              <span className="text-[13px] leading-[1.55] text-[#6E6E76]">
                Add this calendar to Apple, Google, or Outlook. Events keep syncing automatically.
              </span>
            </div>
            <button type="button" onClick={() => setModal(null)} aria-label="Close" className="h-7 w-7 flex-none rounded-lg text-sm text-muted-foreground hover:bg-[#F1F2F6] hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {["Apple Calendar", "Google Calendar"].map((c) => (
              <button key={c} disabled title="The feed goes live when the developer connects calendar hosting" className="h-10 cursor-not-allowed rounded-[11px] border border-black/[.08] bg-[#F1F2F6] text-[13px] font-medium text-muted-foreground/60">
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-[7px]">
            <span className="text-xs font-medium text-[#6E6E76]">The subscribe link, once the feed is live</span>
            <div className="flex items-center gap-2">
              <span className="flex h-[38px] min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[11px] border border-[#1407A2]/[.35] bg-[#F7F7FE] px-3 text-[12.5px] text-primary">
                https://joyhealth.example/cal/feed/karynn-verrett.ics
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText("https://joyhealth.example/cal/feed/karynn-verrett.ics").catch(() => {});
                  toast.info("Example link copied", { description: "The real feed lands with the developer." });
                }}
                aria-label="Copy link"
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] border border-black/[.08] bg-white text-[#6E6E76] transition-colors hover:bg-[#FAFAFB]"
              >
                <Copy className="h-[15px] w-[15px]" aria-hidden="true" />
              </button>
            </div>
            <span className="text-xs leading-[1.5] text-muted-foreground">
              Anyone with the link can view this calendar — share carefully. The feed itself is not wired in the prototype; this is the shape of the real thing.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function goingOnAllMonth(
  events: BrainEvent[],
  filter: "All" | BrainEvent["cat"],
  /** The month the calendar is showing, "YYYY-MM" — the agenda follows the grid. */
  month: string,
): BrainEvent[] {
  return events
    .filter((e) => e.date.startsWith(month))
    .filter((e) => filter === "All" || e.cat === filter)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#6E6E76]">{label}</span>
      {children}
    </label>
  );
}
