import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StepStrip, type StripStep } from "@/components/billing/StepStrip";
import { EmployeesTable, type PayrollRow } from "@/components/payroll/EmployeesTable";
import { EmployeeSheet } from "@/components/payroll/EmployeeSheet";
import { agencyWeekLabel, agencyWeekStart, payrollPeriod } from "@/domain/calendar/agencyWeek";
import { OVERTIME_AFTER_HOURS, OVERTIME_MULTIPLIER, entryHours, payrollRun, type CaregiverHours, type PayrollException } from "@/domain/payroll/hours";
import {
  CLEARS_WHEN,
  EXCEPTION_LABELS,
  EXCEPTION_TABS,
  categoryOf,
  dailyHours,
  grossFor,
  hoursLabel,
  overtimeAsk,
  overtimeDays,
  payrollStatus,
  roleLabel,
  type ExceptionCategory,
} from "@/domain/payroll/review";
import { seedPayrollPeople, seedPayrollShifts, seedPayrollVisits, seedTimeEntries, personIdFor } from "@/lib/payrollSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { useDemo } from "@/context/DemoDataProvider";
import { cn } from "@/lib/utils";

/**
 * Payroll — the week that just finished, ready or not for Gusto.
 *
 * Joy assembles verified hours from the visit clock; Gusto computes wages
 * and is the record of what is paid. The roster shows Joy's own arithmetic
 * (hours × the base rate on file) so a week can be checked, and every row
 * says what stands between it and the export. Overtime nobody approved in
 * advance is a decision for a person, recorded with their name on it.
 */

const money = (n: number | null) => (n === null ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const shortDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const clockTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

interface QueueItem {
  id: string;
  caregiver: CaregiverHours;
  category: ExceptionCategory;
  exception?: PayrollException;
  summary: string;
  status: string;
  tone: "warn" | "muted";
}

const HERO_KEY = "joy.payroll.heroMinimized";

export default function Payroll() {
  const { overtimeApprovals, approveOvertime } = useDemo();
  const [view, setView] = useState<"roster" | "grid">("roster");
  const [rosterTab, setRosterTab] = useState<"all" | "review">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<(typeof EXCEPTION_TABS)[number]>("All");
  const [sel, setSel] = useState<QueueItem | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [historyYear, setHistoryYear] = useState<number | null>(null);
  const [yearOpen, setYearOpen] = useState(false);
  const [excluded, setExcluded] = useState<Record<string, true>>({});
  const [filters, setFilters] = useState<{ category: ExceptionCategory | null; overtime: boolean; role: string | null }>({ category: null, overtime: false, role: null });
  const [filterOpen, setFilterOpen] = useState(false);
  const [heroMinimized, setHeroMinimized] = useState(() => {
    try {
      return window.localStorage.getItem(HERO_KEY) === "1";
    } catch {
      return false;
    }
  });
  const minimizeHero = (on: boolean) => {
    setHeroMinimized(on);
    try {
      window.localStorage.setItem(HERO_KEY, on ? "1" : "0");
    } catch {
      /* per-viewer convenience only */
    }
  };

  // The payroll week: the agency week the latest clock-in fell in.
  const period = useMemo(() => {
    const latest = seedTimeEntries.reduce((t, e) => (e.clockedInAt > t ? e.clockedInAt : t), "");
    const start = agencyWeekStart(latest || new Date().toISOString());
    const end = new Date(`${start}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return { start, end: end.toISOString().slice(0, 10) };
  }, []);
  const periodLabel = useMemo(() => agencyWeekLabel(period.start), [period]);
  const run = useMemo(() => payrollRun({ period, people: seedPayrollPeople, entries: seedTimeEntries, visits: seedPayrollVisits }), [period]);
  const labels = useMemo(() => {
    const cycle = payrollPeriod(period.start);
    return { payroll: agencyWeekLabel(period.start), cycle: `${shortDay(cycle.start)} – ${shortDay(cycle.end)}` };
  }, [period]);

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    for (const c of run.caregivers) {
      for (const [i, ex] of c.exceptions.entries()) {
        items.push({ id: `${c.caregiverPersonId}-${i}`, caregiver: c, category: categoryOf(ex.kind), exception: ex, summary: `${EXCEPTION_LABELS[ex.kind]} · ${ex.detail}`, status: ex.blocking ? "Needs review" : "Doesn't hold pay", tone: ex.blocking ? "warn" : "muted" });
      }
      if (c.overtimeHours > 0) {
        items.push({ id: `${c.caregiverPersonId}-ot`, caregiver: c, category: "Overtime", summary: `Overtime review · Regular ${c.regularHours} hrs · OT ${c.overtimeHours} hrs at ${OVERTIME_MULTIPLIER}×`, status: "Confirm OT", tone: "warn" });
      }
    }
    return items;
  }, [run]);
  const countFor = (t: (typeof EXCEPTION_TABS)[number]) => (t === "All" ? queue.length : queue.filter((i) => i.category === t).length);
  const visibleQueue = queue.filter((i) => queueTab === "All" || i.category === queueTab);
  const total = run.caregivers.length;
  const blockingCount = queue.filter((i) => i.exception?.blocking).length;

  const rows = useMemo<PayrollRow[]>(
    () =>
      run.caregivers
        .map((c) => {
          const employee = seedEmployees.find((e) => e.name === c.caregiverName);
          const approved = overtimeApprovals.filter((a) => a.caregiverName === c.caregiverName && a.weekStart === period.start).reduce((t, a) => t + a.hours, 0);
          const { status, detail } = payrollStatus({ hours: c, approvedOvertime: approved });
          const rate = employee?.baseRate ?? null;
          return {
            caregiverPersonId: c.caregiverPersonId,
            name: c.caregiverName,
            role: roleLabel(employee?.title),
            regularHours: c.regularHours,
            overtimeHours: c.overtimeHours,
            totalHours: c.totalHours,
            rate,
            gross: grossFor({ regularHours: c.regularHours, overtimeHours: c.overtimeHours, rate }),
            status,
            detail,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [run.caregivers, overtimeApprovals, period.start],
  );
  const needing = rows.filter((r) => r.status !== "cleared");
  const cleared = total - needing.length;
  const pct = total === 0 ? 100 : Math.round((cleared / total) * 100);
  const ready = needing.length === 0;
  const categoriesOf = (id: string) => new Set((run.caregivers.find((c) => c.caregiverPersonId === id)?.exceptions ?? []).map((e) => categoryOf(e.kind)));
  const passes = (r: PayrollRow) => (filters.category === null || categoriesOf(r.caregiverPersonId).has(filters.category)) && (!filters.overtime || r.overtimeHours > 0) && (filters.role === null || r.role === filters.role);
  const filterCount = (filters.category ? 1 : 0) + (filters.overtime ? 1 : 0) + (filters.role ? 1 : 0);
  const shown = (rosterTab === "review" ? needing : rows).filter((r) => (query.trim() === "" ? true : `${r.name} ${r.role}`.toLowerCase().includes(query.trim().toLowerCase()))).filter(passes);
  const openRow = rows.find((r) => r.caregiverPersonId === openId) ?? null;

  const sheet = useMemo(() => {
    if (!openRow) return { days: [], overtimeDays: [] as string[], ask: null, compare: [] as Array<{ label: string; value: string; variance?: boolean }>, audit: [] as Array<{ text: string; when: string }>, stillIn: false };
    const days = dailyHours({ entries: seedTimeEntries, caregiverPersonId: openRow.caregiverPersonId, start: period.start, end: period.end });
    const approvals = overtimeApprovals.filter((a) => a.caregiverName === openRow.name && a.weekStart === period.start);
    const approved = approvals.reduce((t, a) => t + a.hours, 0);
    const last = approvals[approvals.length - 1];
    const projected =
      Math.round(
        seedPayrollShifts
          .filter((v) => v.caregiverName && personIdFor(v.caregiverName) === openRow.caregiverPersonId && v.startsAt.slice(0, 10) >= period.start && v.startsAt.slice(0, 10) <= period.end)
          .reduce((t, v) => t + (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()) / 36e5, 0) * 10,
      ) / 10;
    const ask = overtimeAsk({ actualOvertime: openRow.overtimeHours, approvedOvertime: approved, approvedBy: last?.approvedBy ?? null, approvedAt: last ? `${shortDay(last.approvedAt.slice(0, 10))} · ${clockTime(last.approvedAt)}` : null });
    const variance = Math.round((openRow.overtimeHours - approved) * 100) / 100;
    const compare =
      openRow.overtimeHours > 0 || approved > 0
        ? [
            { label: "Projected at assignment", value: `${projected.toFixed(1)} hrs` },
            { label: "Approved OT", value: `${approved.toFixed(1)} hrs` },
            { label: "Actual OT", value: `${openRow.overtimeHours.toFixed(1)} hrs` },
            { label: "Variance", value: variance === 0 ? "None" : `${variance > 0 ? "+" : ""}${hoursLabel(variance)}`, variance: variance > 0 },
          ]
        : [];
    const today = new Date().toISOString().slice(0, 10);
    const asOf = period.end < today ? period.end : today;
    const stillIn = (run.caregivers.find((c) => c.caregiverPersonId === openRow.caregiverPersonId)?.exceptions ?? []).some((e) => e.kind === "open_entry");
    const audit = [
      { at: `${period.start}T00:00`, text: `Projected ${projected.toFixed(1)} hrs from the schedule`, when: shortDay(period.start) },
      ...approvals.map((a) => ({ at: a.approvedAt, text: `${hoursLabel(a.hours)} overtime approved by ${a.approvedBy}`, when: `${shortDay(a.approvedAt.slice(0, 10))} · ${clockTime(a.approvedAt)}` })),
      { at: `${asOf}T06:00`, text: "Verified time imported from EVV", when: `${shortDay(asOf)} · 6:00 AM` },
      {
        at: `${asOf}T06:01`,
        text: stillIn ? "Hours not final — a shift is still clocked in" : openRow.overtimeHours > 0 ? `Actual ${openRow.totalHours.toFixed(1)} hrs · ${openRow.overtimeHours.toFixed(1)} hrs OT` : `Actual ${openRow.totalHours.toFixed(1)} hrs · no overtime`,
        when: `${shortDay(asOf)} · Payroll`,
      },
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map(({ text, when }) => ({ text, when }));
    return { days, overtimeDays: overtimeDays({ days }), ask, compare, audit, stillIn };
  }, [openRow, overtimeApprovals, period.start, period.end, run.caregivers]);

  const heroTitle = prepared ? "Prepared for Gusto" : ready ? "Ready for Gusto" : cleared === 0 ? "Payroll needs review" : "Payroll is almost ready";
  const heroSub = prepared
    ? `Joy assembled the export summary for ${labels.payroll}. Submit the hours inside Gusto — Joy does not run payroll.`
    : ready
      ? `Payroll review is complete for ${labels.payroll}.`
      : `${needing.length} ${needing.length === 1 ? "employee needs" : "employees need"} review before this cycle is ready for Gusto.`;
  const otCount = run.caregivers.filter((c) => c.overtimeHours > 0).length;

  // Demo history, from the standing schedule: sixty weeks of the same week.
  const history = useMemo(() => {
    const hoursByName = new Map<string, number>();
    for (const v of seedVisits) {
      if (!v.caregiverName) continue;
      hoursByName.set(v.caregiverName, (hoursByName.get(v.caregiverName) ?? 0) + (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()) / 36e5);
    }
    let regular = 0;
    let ot = 0;
    let gross = 0;
    for (const [name, hours] of hoursByName) {
      const reg = Math.min(OVERTIME_AFTER_HOURS, hours);
      const over = Math.max(0, hours - OVERTIME_AFTER_HOURS);
      regular += reg;
      ot += over;
      const rate = seedEmployees.find((e) => e.name === name)?.baseRate ?? null;
      if (rate !== null) gross += reg * rate + over * rate * OVERTIME_MULTIPLIER;
    }
    const shift = (iso: string, days: number) => {
      const d = new Date(`${iso}T12:00:00`);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    return Array.from({ length: 60 }, (_, i) => {
      const weekStart = shift(period.start, -7 * (i + 1));
      return { weekStart, label: agencyWeekLabel(weekStart), employees: hoursByName.size, regular: Math.round(regular * 10) / 10, ot: Math.round(ot * 10) / 10, gross: Math.round(gross * 100) / 100, preparedOn: shift(weekStart, 9), preparedBy: "Karynn V" };
    });
  }, [period.start]);
  const years = useMemo(() => Array.from(new Set(history.map((h) => Number(h.weekStart.slice(0, 4))))).sort((a, b) => b - a), [history]);
  const year = historyYear ?? years[0] ?? new Date().getFullYear();
  const yearRows = history.filter((h) => Number(h.weekStart.slice(0, 4)) === year);
  const byMonth = yearRows.reduce<Array<{ month: string; rows: typeof yearRows }>>((groups, h) => {
    const month = new Date(`${h.weekStart}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rows.push(h);
    else groups.push({ month, rows: [h] });
    return groups;
  }, []);
  const yearTotals = { weeks: yearRows.length, regular: Math.round(yearRows.reduce((t, h) => t + h.regular, 0) * 10) / 10, ot: Math.round(yearRows.reduce((t, h) => t + h.ot, 0) * 10) / 10, gross: Math.round(yearRows.reduce((t, h) => t + h.gross, 0) * 100) / 100 };

  const exporting = run.caregivers.filter((c) => !excluded[c.caregiverPersonId]);
  const exportTotals = {
    regular: Math.round(exporting.reduce((t, c) => t + c.regularHours, 0) * 10) / 10,
    ot: Math.round(exporting.reduce((t, c) => t + c.overtimeHours, 0) * 10) / 10,
    visits: exporting.reduce((t, c) => t + seedPayrollVisits.filter((v) => v.caregiverPersonId === c.caregiverPersonId).length, 0),
  };
  const visitsOf = (id: string) => seedPayrollVisits.filter((v) => v.caregiverPersonId === id).length;

  const steps = useMemo<StripStep[]>(
    () => [
      { key: "hours", label: "Hours verified", note: `${total} employees`, state: "done" },
      { key: "exceptions", label: "Exceptions", note: blockingCount === 0 ? "Cleared" : `${blockingCount} remaining`, state: blockingCount === 0 ? "done" : "open", onClick: blockingCount === 0 ? undefined : () => { setView("roster"); setRosterTab("review"); } },
      { key: "overtime", label: "Overtime", note: otCount === 0 ? "None this cycle" : `${otCount} need review`, state: otCount === 0 ? "done" : "open", onClick: otCount === 0 ? undefined : () => { setView("roster"); setRosterTab("review"); } },
      { key: "approved", label: "Payroll approved", note: ready ? "Review clear" : "Pending", state: ready ? "done" : "todo" },
      { key: "gusto", label: "Prepared for Gusto", note: prepared ? "Export ready" : "Pending", state: prepared ? "done" : "todo", onClick: prepared ? () => setShowExport(true) : undefined },
      { key: "complete", label: "Complete", note: prepared ? "Done" : "Pending", state: prepared ? "done" : "todo" },
    ],
    [total, blockingCount, otCount, ready, prepared],
  );
  const joyLine = useMemo(() => {
    if (needing.length === 0) return null;
    const details = [...new Set(needing.map((r) => r.detail).filter(Boolean))].slice(0, 4);
    return `Joy: ${needing.length} ${needing.length === 1 ? "employee is" : "employees are"} holding payroll${details.length > 0 ? ` — ${details.join("; ")}` : ""}.`;
  }, [needing]);

  const grid = useMemo(() => {
    const start = new Date(`${period.start}T12:00:00`);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const flagged = new Map<string, Set<string>>();
    for (const c of run.caregivers) {
      const dates = new Set<string>();
      for (const ex of c.exceptions) {
        const entry = ex.entryId ? seedTimeEntries.find((e) => e.id === ex.entryId) : null;
        const visit = ex.visitId ? seedPayrollVisits.find((v) => v.id === ex.visitId) : null;
        const when = entry?.clockedInAt ?? visit?.startsAt;
        if (when) dates.add(when.slice(0, 10));
      }
      flagged.set(c.caregiverPersonId, dates);
    }
    const gridRows = run.caregivers.map((c) => {
      const mine = seedTimeEntries.filter((e) => e.caregiverPersonId === c.caregiverPersonId);
      const cells = days.map((d) => {
        const k = key(d);
        const hours = mine.filter((e) => e.clockedInAt.slice(0, 10) === k).reduce((t, e) => t + entryHours(e), 0);
        return { hours: Math.round(hours * 100) / 100, flagged: flagged.get(c.caregiverPersonId)?.has(k) ?? false };
      });
      const row = rows.find((r) => r.caregiverPersonId === c.caregiverPersonId);
      const weekTotals = c.weeks.find((w) => w.weekStart === key(days[0]));
      return {
        c,
        cells,
        title: row?.role ?? roleLabel(seedEmployees.find((e) => e.name === c.caregiverName)?.title),
        total: Math.round(cells.reduce((t, x) => t + x.hours, 0) * 100) / 100,
        ot: weekTotals?.overtimeHours ?? 0,
        rate: row?.rate ?? null,
        gross: row?.gross ?? null,
      };
    });
    const footer = days.map((_, i) => Math.round(gridRows.reduce((t, r) => t + r.cells[i].hours, 0) * 100) / 100);
    return {
      days,
      rows: gridRows,
      footer,
      totalHrs: Math.round(gridRows.reduce((t, r) => t + r.total, 0) * 100) / 100,
      totalOt: Math.round(gridRows.reduce((t, r) => t + r.ot, 0) * 100) / 100,
      totalGross: Math.round(gridRows.reduce((t, r) => t + (r.gross ?? 0), 0) * 100) / 100,
    };
  }, [run, rows, period.start]);

  const csv = (name: string, header: string[], body: string[][]) => {
    const text = [header, ...body].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const reviewItems = () => {
    setView("roster");
    setRosterTab("review");
    setQueueTab("All");
    if (queue[0]) setSel(queue[0]);
  };

  const filterMenu = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={filterOpen}
        className={cn("flex h-[34px] items-center gap-[7px] rounded-[9px] border px-3 text-[13px] transition-colors", filterCount > 0 ? "border-primary bg-[#EEF0FE] font-medium text-primary" : "border-[var(--hairline)] bg-[var(--wash)] text-[var(--ink-body)] hover:text-foreground")}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        Filter
        {filterCount > 0 && <span className="text-[11.5px]">{filterCount}</span>}
      </button>
      {filterOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} aria-hidden="true" />
          <div role="listbox" aria-label="Filter the roster" className="absolute right-0 z-20 mt-1.5 w-[270px] rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-2 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
            {(() => {
              const option = (label: string, n: number, on: boolean, toggle: () => void) => (
                <button key={label} type="button" role="option" aria-selected={on} onClick={toggle} className={cn("flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-[var(--wash)]", on ? "bg-[var(--wash)] font-medium text-foreground" : "text-[var(--ink-body)]")}>
                  {label}
                  <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">{n}</span>
                </button>
              );
              const heading = (label: string) => (
                <span key={`h-${label}`} className="block px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                  {label}
                </span>
              );
              const rule = (k: string) => <span key={k} className="mx-2.5 my-1.5 block border-t border-[var(--hairline-soft)]" aria-hidden="true" />;
              const categories = EXCEPTION_TABS.filter((t): t is ExceptionCategory => t !== "All");
              const roles = Array.from(new Set(rows.map((r) => r.role))).sort();
              return [
                heading("Exception"),
                ...categories.map((c) => option(c, rows.filter((r) => categoriesOf(r.caregiverPersonId).has(c)).length, filters.category === c, () => setFilters((f) => ({ ...f, category: f.category === c ? null : c })))),
                rule("r1"),
                heading("Hours"),
                option("Has overtime", rows.filter((r) => r.overtimeHours > 0).length, filters.overtime, () => setFilters((f) => ({ ...f, overtime: !f.overtime }))),
                rule("r2"),
                heading("Role"),
                ...roles.map((role) => option(role, rows.filter((r) => r.role === role).length, filters.role === role, () => setFilters((f) => ({ ...f, role: f.role === role ? null : role })))),
                ...(filterCount > 0
                  ? [
                      <button
                        key="clear"
                        type="button"
                        onClick={() => {
                          setFilters({ category: null, overtime: false, role: null });
                          setFilterOpen(false);
                        }}
                        className="mt-1.5 w-full rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-medium text-primary hover:bg-[var(--wash)]"
                      >
                        Clear filters
                      </button>,
                    ]
                  : []),
              ];
            })()}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Payroll"
        week={period.start}
        actions={
          <>
            <button type="button" onClick={() => setShowExport(true)} className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
              Preview export file
            </button>
            <button type="button" onClick={() => setShowHistory((v) => !v)} className={cn("h-[34px] rounded-[9px] border border-[var(--hairline)] px-3 text-[13px] transition-colors", showHistory ? "bg-[var(--wash-strong)] text-foreground" : "bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)] hover:text-foreground")}>
              Payroll history
            </button>
            <button
              type="button"
              disabled={!ready}
              title={ready ? undefined : "Resolve the review items first"}
              onClick={() => (prepared ? setShowExport(true) : setPrepared(true))}
              className={cn("h-[34px] rounded-[9px] px-3.5 text-[13px] font-medium transition-colors", ready ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
            >
              {prepared ? "Prepared · view summary" : "Prepare for Gusto"}
            </button>
          </>
        }
      />

      {showHistory && (
        <section className="mb-5 overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
            <span className="text-[13.5px] font-semibold">Payroll history</span>
            <div className="relative">
              <button type="button" onClick={() => setYearOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={yearOpen} className="flex h-[30px] items-center gap-1.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                {year}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              </button>
              {yearOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setYearOpen(false)} aria-hidden="true" />
                  <ul role="listbox" aria-label="Year" className="absolute left-0 z-20 mt-1 w-[110px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                    {years.map((y) => (
                      <li key={y}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={year === y}
                          onClick={() => {
                            setHistoryYear(y);
                            setYearOpen(false);
                          }}
                          className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", year === y ? "font-medium text-primary" : "text-[var(--ink-body)]")}
                        >
                          {y}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              {yearTotals.weeks} {yearTotals.weeks === 1 ? "week" : "weeks"} · {yearTotals.regular.toFixed(1)} regular hrs{yearTotals.ot > 0 ? ` · ${yearTotals.ot.toFixed(1)} OT hrs` : ""} · {money(yearTotals.gross)} gross
            </span>
            <button
              type="button"
              onClick={() => {
                csv(`joy-payroll-history-${year}.csv`, ["Week", "Employees", "Regular hrs", "OT hrs", "Gross", "Prepared on", "Prepared by"], yearRows.map((h) => [h.label, String(h.employees), h.regular.toFixed(2), h.ot.toFixed(2), h.gross.toFixed(2), h.preparedOn, h.preparedBy]));
                toast.success(`Exported ${yearRows.length} weeks of ${year}.`);
              }}
              className="ml-auto flex h-[30px] items-center gap-[6px] rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              Export {year}
            </button>
            <button type="button" onClick={() => setShowHistory(false)} className="text-[12.5px] text-primary hover:text-[#2A1BD1]">
              Close
            </button>
          </div>
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <caption className="sr-only">Earlier payroll weeks, as prepared for Gusto, by month</caption>
              <thead>
                <tr>
                  {["Week", "Employees", "Regular hrs", "OT hrs", "Gross", "Prepared", "Status"].map((h, i) => (
                    <th key={h} scope="col" className={cn("sticky top-0 whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground", i >= 1 && i <= 4 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {byMonth.map((g) => (
                <tbody key={g.month}>
                  <tr>
                    <th scope="colgroup" colSpan={7} className="border-t border-[var(--hairline)] bg-[var(--wash)] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-[var(--ink-body)]">
                      {g.month}
                      <span className="ml-1.5 font-medium text-muted-foreground">
                        {g.rows.length} {g.rows.length === 1 ? "week" : "weeks"} · {money(Math.round(g.rows.reduce((t, h) => t + h.gross, 0) * 100) / 100)}
                      </span>
                    </th>
                  </tr>
                  {g.rows.map((h) => (
                    <tr key={h.weekStart} className="border-t border-[var(--hairline-soft)]">
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] font-medium">{h.label}</td>
                      <td className="px-4 py-3 text-right text-[13px] tabular-nums">{h.employees}</td>
                      <td className="px-4 py-3 text-right text-[13px] tabular-nums">{h.regular.toFixed(1)}</td>
                      <td className={cn("px-4 py-3 text-right text-[13px] tabular-nums", h.ot > 0 ? "text-[#B54708]" : "text-muted-foreground")}>{h.ot > 0 ? h.ot.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums">{money(h.gross)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                        {shortDay(h.preparedOn)} · {h.preparedBy}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[#ECFDF3] px-2.5 py-[3px] text-[11px] font-medium text-[#027A48]">Sent to Gusto</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="m-0 border-t border-[var(--hairline)] px-4 py-2.5 text-[11.5px] text-muted-foreground">Demo history, derived from the standing schedule. Real cycles land here as each week is prepared.</p>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-baseline gap-x-7 gap-y-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted-foreground">Pay cycle</span>
          <span className="text-sm font-semibold">{labels.cycle}</span>
        </span>
        <span className="ml-auto flex gap-0.5 rounded-[9px] bg-[var(--wash-strong)] p-[3px]" role="tablist" aria-label="Payroll views">
          {(
            [
              ["roster", "Employee roster"],
              ["grid", "Week grid"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)} className={cn("h-7 rounded-[7px] px-3.5 text-[12.5px] transition-colors", view === value ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </span>
      </div>

      {heroMinimized ? (
        <div className={cn("mb-5 flex flex-wrap items-center gap-3 rounded-2xl border bg-[var(--paper)] py-2.5 pl-5 pr-2", ready ? "border-[#D3F0DF]" : "border-[var(--hairline)]")}>
          <span className={cn("h-[7px] w-[7px] flex-none rounded-full", ready ? "bg-[#12B76A]" : "bg-[#F79009]")} aria-hidden="true" />
          <span className="text-[14px] font-semibold">{heroTitle}</span>
          <span className="text-[12.5px] text-muted-foreground">
            {cleared} of {total} caregivers cleared
          </span>
          {!ready && (
            <button type="button" onClick={reviewItems} className="text-[12.5px] font-medium text-primary hover:underline">
              Review items →
            </button>
          )}
          <button type="button" onClick={() => minimizeHero(false)} aria-label="Show payroll status" title="Show" className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <section className={cn("relative mb-5 flex flex-col rounded-2xl border bg-[var(--paper)] px-6 py-6", ready ? "border-[#D3F0DF]" : "border-[var(--hairline)]")}>
          <button type="button" onClick={() => minimizeHero(true)} aria-label="Minimize payroll status" title="Minimize" className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="flex flex-wrap items-center gap-6 pr-8">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[29px] font-semibold leading-[1.1] tracking-[-.025em]">{heroTitle}</span>
              <p className="m-0 max-w-[520px] text-sm text-[var(--ink-body)] [text-wrap:pretty]">{heroSub}</p>
            </div>
            <div className="ml-auto flex flex-none items-center gap-5">
              <span className="flex flex-col items-end gap-[7px]">
                <span className="text-[13px] text-muted-foreground">
                  {cleared} of {total} caregivers cleared
                </span>
                <span className="block h-[5px] w-[170px] overflow-hidden rounded-full bg-[var(--wash-strong)]">
                  <span className={cn("block h-full rounded-full", ready ? "bg-[#12B76A]" : "bg-primary")} style={{ width: `${pct}%` }} />
                </span>
              </span>
              {!ready && (
                <button type="button" onClick={reviewItems} className="h-9 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                  Review items →
                </button>
              )}
              {ready && (
                <button type="button" onClick={() => setShowExport(true)} className="h-9 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-4 text-[13px] font-medium transition-colors hover:bg-[var(--wash)]">
                  View payroll summary
                </button>
              )}
            </div>
          </div>
          {prepared && (
            <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline)] pt-4">
              <span className="text-[12.5px] text-[var(--ink-body)]">Prepared just now in this session</span>
              <button type="button" onClick={() => setShowExport(true)} className="text-[12.5px] text-primary hover:text-[#2A1BD1]">
                View export summary
              </button>
              <span className="ml-auto text-[11.5px] text-muted-foreground">Joy prepared the summary — submit the hours inside Gusto.</span>
            </div>
          )}
        </section>
      )}

      {view === "grid" && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold tracking-[-.01em]">Week grid · {periodLabel}</span>
            </div>
            <span className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-[7px] w-[7px] rounded-sm bg-[#F79009]" aria-hidden="true" />
                Needs review
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-[7px] w-[7px] rounded-sm bg-[#B42318]" aria-hidden="true" />
                Overtime
              </span>
              <button
                type="button"
                onClick={() => {
                  csv(
                    `joy-payroll-week-${grid.days[0].toISOString().slice(0, 10)}.csv`,
                    ["Employee", ...grid.days.map((d) => d.toISOString().slice(0, 10)), "Hrs", "OT", "Rate", "Gross"],
                    [
                      ...grid.rows.map((r) => [r.c.caregiverName, ...r.cells.map((c) => (c.hours === 0 ? "" : String(c.hours))), String(r.total), r.ot > 0 ? String(r.ot) : "", r.rate === null ? "" : r.rate.toFixed(2), r.gross === null ? "" : r.gross.toFixed(2)]),
                      ["Total", ...grid.footer.map((v) => (v === 0 ? "" : String(v))), String(grid.totalHrs), String(grid.totalOt), "", grid.totalGross.toFixed(2)],
                    ],
                  );
                  toast.success("Week grid exported exactly as shown.", { description: "Joy's own arithmetic for checking the week. Gusto stays the record of what is paid." });
                }}
                className="flex h-[30px] items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-xs font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                Export
              </button>
            </span>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-r border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">Employee</th>
                    {grid.days.map((d, i) => (
                      <th key={d.toISOString()} className={cn("whitespace-nowrap px-2.5 py-2 text-center leading-[1.35]", i < 2 ? "bg-[var(--wash)]" : "bg-[var(--paper-sunken)]")}>
                        <span className="block text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">{d.toLocaleDateString([], { weekday: "short" })}</span>
                        <span className="block text-[11px] font-normal text-muted-foreground/50">{d.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </th>
                    ))}
                    {["Hrs", "OT", "Rate", "Gross"].map((h) => (
                      <th key={h} className={cn("whitespace-nowrap bg-[var(--paper-sunken)] py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground", h === "Hrs" ? "px-3.5" : "px-4")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map(({ c, cells, title, total: t, ot, rate, gross }) => (
                    <tr key={c.caregiverPersonId} className="border-t border-[var(--hairline-soft)] hover:bg-[var(--paper-sunken)]">
                      <td className="border-r border-[var(--hairline-soft)] bg-[var(--paper)] px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">{initialsOf(c.caregiverName)}</span>
                          <span className="flex flex-col leading-[1.3]">
                            <span className="whitespace-nowrap text-[12.5px]">{c.caregiverName}</span>
                            <span className="text-[11px] text-muted-foreground">{title}</span>
                          </span>
                        </span>
                      </td>
                      {cells.map((cell, i) => (
                        <td key={i} className={cn("whitespace-nowrap px-2.5 py-2.5 text-center text-[12.5px] tabular-nums", cell.flagged ? "bg-[#FFFAEB] font-medium text-[#B54708]" : cell.hours === 0 ? "text-muted-foreground/30" : "text-foreground")}>
                          {cell.hours === 0 ? "·" : cell.hours.toFixed(1).replace(/\.0$/, "")}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12.5px] font-medium tabular-nums">{t.toFixed(1).replace(/\.0$/, "")}</td>
                      <td className={cn("whitespace-nowrap px-4 py-2.5 text-right text-[12.5px] tabular-nums", ot > 0 ? "font-medium text-[#B54708]" : "text-muted-foreground/40")}>{ot > 0 ? ot.toFixed(1) : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-[12.5px] tabular-nums">{rate === null ? <span className="text-muted-foreground">Salaried</span> : money(rate)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-[12.5px] font-medium tabular-nums">{gross === null ? <span className="text-muted-foreground">—</span> : money(gross)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--hairline)] bg-[var(--paper-sunken)]">
                    <td className="whitespace-nowrap border-r border-[var(--hairline)] px-4 py-3 text-[12.5px] font-semibold">Total · {grid.rows.length} shown</td>
                    {grid.footer.map((v, i) => (
                      <td key={i} className="px-2.5 py-3 text-center text-xs font-semibold tabular-nums">
                        {v === 0 ? "·" : v.toFixed(1).replace(/\.0$/, "")}
                      </td>
                    ))}
                    <td className="px-3.5 py-3 text-right text-[12.5px] font-semibold tabular-nums">{grid.totalHrs.toFixed(1)}</td>
                    <td className={cn("px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums", grid.totalOt > 0 ? "text-[#B42318]" : "text-muted-foreground/40")}>{grid.totalOt > 0 ? grid.totalOt.toFixed(1) : "—"}</td>
                    <td />
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums">{money(grid.totalGross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-2.5 border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-3">
              <span className="ml-auto text-[11.5px] text-muted-foreground">{ready ? "All hours reconciled" : `${needing.length} flagged for review`}</span>
            </div>
          </div>
        </section>
      )}

      {view === "roster" && (
        <div className="mb-5">
          <EmployeesTable
            rows={shown}
            periodLabel={periodLabel}
            query={query}
            onQuery={setQuery}
            tab={rosterTab}
            onTab={setRosterTab}
            counts={{ all: rows.length, review: needing.length }}
            periodOvertimeHours={rows.reduce((t, r) => t + r.overtimeHours, 0)}
            money={money}
            onOpen={setOpenId}
            filter={filterMenu}
            onExport={() => {
              csv(`joy-payroll-${period.start}.csv`, ["Employee", "Role", "Hours", "Regular", "OT", "Rate", "Gross", "Status"], shown.map((r) => [r.name, r.role, r.totalHours.toFixed(2), r.regularHours.toFixed(2), r.overtimeHours.toFixed(2), r.rate?.toFixed(2) ?? "", r.gross?.toFixed(2) ?? "", r.status]));
              toast.success(`Exported ${shown.length} ${shown.length === 1 ? "row" : "rows"} as shown.`);
            }}
          />
        </div>
      )}

      <EmployeeSheet
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        row={openRow}
        periodLabel={periodLabel}
        days={sheet.days}
        overtimeDays={sheet.overtimeDays}
        ask={sheet.ask}
        compare={sheet.compare}
        audit={sheet.audit}
        hoursUnknown={sheet.stillIn}
        money={money}
        onApproveOvertime={
          openRow && sheet.ask
            ? () => {
                const hours = sheet.ask!.variance;
                approveOvertime({ caregiverName: openRow.name, hours, weekStart: period.start, reason: "" });
                toast.success(`${hoursLabel(hours)} overtime approved for ${openRow.name}`, { description: "Recorded with your name on it. The hours were already being paid." });
              }
            : undefined
        }
      />

      {view === "roster" && rosterTab === "review" && (
        <div className="grid items-start gap-[18px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-[3px]">
              <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Needs review</h2>
              <span className="text-[12.5px] text-muted-foreground">Only payroll items requiring action appear here.</span>
            </div>
            <div className="flex items-center gap-5 overflow-x-auto border-b border-[var(--hairline)]" role="tablist" aria-label="Exception categories">
              {EXCEPTION_TABS.map((t) => (
                <button key={t} role="tab" aria-selected={queueTab === t} onClick={() => setQueueTab(t)} className={cn("-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors", queueTab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
                  <span className={cn("rounded-full px-[7px] py-px text-[11px]", queueTab === t ? "bg-[#EEF0FE] text-primary" : "bg-[var(--hairline-soft)] text-muted-foreground")}>{countFor(t)}</span>
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
              {visibleQueue.map((item) => (
                <button key={item.id} type="button" onClick={() => setSel(item)} className="flex w-full items-center gap-4 border-b border-[var(--hairline-soft)] p-[18px] text-left transition-colors last:border-b-0 hover:bg-[var(--wash)]">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">{initialsOf(item.caregiver.caregiverName)}</span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-sm font-medium">{item.caregiver.caregiverName}</span>
                    <span className="text-[12.5px] text-muted-foreground">{item.summary}</span>
                  </span>
                  <span className="ml-auto flex flex-none items-center gap-3.5">
                    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-[11px] py-1 text-[11.5px] font-medium", item.tone === "warn" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]")}>{item.status}</span>
                    <span className="text-[13px] text-muted-foreground/50" aria-hidden="true">
                      →
                    </span>
                  </span>
                </button>
              ))}
              {visibleQueue.length === 0 && (
                <div className="flex flex-col gap-1.5 p-11 text-center">
                  <span className="text-sm font-medium">Nothing needs review</span>
                  <span className="text-[12.5px] text-muted-foreground">{queue.length === 0 ? `All ${total} caregivers are cleared for ${labels.payroll}.` : "Nothing in this category — check the other tabs."}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-4 py-3">
              <span className="h-2 w-2 flex-none rounded-full bg-[#8FA0FF]" style={{ animation: "joyGlow 2.6s ease-in-out infinite" }} aria-hidden="true" />
              <span className="text-[13px] [text-wrap:pretty]">
                {ready ? `Joy: Payroll for ${labels.payroll} is clear. The Gusto summary is ready to prepare.` : `Joy: ${run.blockedBy.length === 1 ? `${run.blockedBy[0]} is` : `${run.blockedBy.length} caregivers are`} holding payroll — each row above says what clears it.`}
              </span>
            </div>
          </div>
        </div>
      )}

      <StepStrip title={`Payroll cycle · ${periodLabel}`} summary={`${cleared} of ${total} employees cleared${needing.length > 0 ? ` · ${needing.length} need review before payroll is ready` : " · ready for Gusto"}`} steps={steps} joyLine={joyLine} className="mt-6" />

      {showExport && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-6 pt-14" role="dialog" aria-modal="true" aria-label="Payroll export preview">
          <div className="absolute inset-0 bg-[rgba(25,26,46,.22)]" onClick={() => setShowExport(false)} />
          <div className="relative flex w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] shadow-[0_24px_60px_rgba(25,26,46,.16)]">
            <div className="flex items-start gap-4 border-b border-[var(--hairline)] px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-[17px] font-semibold tracking-[-.01em]">Payroll export · {labels.payroll}</span>
                <span className="text-[12.5px] text-muted-foreground">{prepared ? "Prepared this session · Gusto time-import format" : "Gusto time-import format"}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={exporting.length === 0}
                  onClick={() => {
                    csv(`joy-gusto-hours-${period.start}.csv`, ["Employee", "Regular hrs", "OT hrs", "Visits"], exporting.map((c) => [c.caregiverName, c.regularHours.toFixed(2), c.overtimeHours.toFixed(2), String(visitsOf(c.caregiverPersonId))]));
                    toast.success(`Exported ${exporting.length} ${exporting.length === 1 ? "caregiver" : "caregivers"} for ${labels.payroll}.`);
                  }}
                  className={cn("h-[34px] rounded-[9px] px-3.5 text-[13px] font-medium transition-colors", exporting.length === 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]")}
                >
                  Download .csv
                </button>
                <button type="button" aria-label="Close export preview" onClick={() => setShowExport(false)} className="h-[34px] w-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] text-sm text-muted-foreground transition-colors hover:bg-[var(--wash-strong)] hover:text-foreground">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-8 border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-6 py-4">
              {(
                [
                  ["Caregivers cleared", `${cleared} of ${total}`],
                  ["Exporting", `${exporting.length} of ${run.caregivers.length}`],
                  ["Regular hrs", exportTotals.regular.toFixed(1)],
                  ["Overtime hrs", exportTotals.ot.toFixed(1)],
                  ["Visits", String(exportTotals.visits)],
                ] as const
              ).map(([label, value]) => (
                <span key={label} className="flex flex-col gap-[3px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">{label}</span>
                  <span className="text-[17px] font-semibold tracking-[-.01em] tabular-nums">{value}</span>
                </span>
              ))}
            </div>
            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 w-[44px] bg-[var(--paper-sunken)] py-2.5 pl-6 pr-2">
                      <input
                        type="checkbox"
                        aria-label="Export everyone"
                        checked={exporting.length === run.caregivers.length}
                        onChange={(e) => setExcluded(e.target.checked ? {} : Object.fromEntries(run.caregivers.map((c) => [c.caregiverPersonId, true])))}
                        className="h-4 w-4 rounded border-[var(--hairline)] accent-[hsl(var(--primary))]"
                      />
                    </th>
                    {["Employee", "Regular hrs", "OT hrs", "Visits"].map((h, i) => (
                      <th key={h} className={cn("sticky top-0 whitespace-nowrap bg-[var(--paper-sunken)] py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground", i === 0 ? "px-2 text-left" : i === 3 ? "px-6 text-right" : "px-4 text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.caregivers.map((c) => (
                    <tr key={c.caregiverPersonId} className={cn("border-t border-[var(--hairline-soft)]", excluded[c.caregiverPersonId] && "opacity-50")}>
                      <td className="py-3 pl-6 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Export ${c.caregiverName}`}
                          checked={!excluded[c.caregiverPersonId]}
                          onChange={(e) =>
                            setExcluded((x) => {
                              const next = { ...x };
                              if (e.target.checked) delete next[c.caregiverPersonId];
                              else next[c.caregiverPersonId] = true;
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-[var(--hairline)] accent-[hsl(var(--primary))]"
                        />
                      </td>
                      <td className="px-2 py-3 text-[13px]">{c.caregiverName}</td>
                      <td className="px-4 py-3 text-right text-[13px] tabular-nums">{c.regularHours.toFixed(1)}</td>
                      <td className={cn("px-4 py-3 text-right text-[13px] tabular-nums", c.overtimeHours > 0 ? "font-medium text-[#B54708]" : "text-muted-foreground")}>{c.overtimeHours.toFixed(1)}</td>
                      <td className="px-6 py-3 text-right text-[12.5px] tabular-nums text-[var(--ink-body)]">{visitsOf(c.caregiverPersonId)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--hairline)] bg-[var(--paper-sunken)]">
                    <td colSpan={2} className="px-6 py-3 text-[12.5px] font-semibold">
                      Total · {exporting.length} {exporting.length === 1 ? "caregiver" : "caregivers"}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{exportTotals.regular.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{exportTotals.ot.toFixed(1)}</td>
                    <td className="px-6 py-3 text-right text-[12.5px] font-semibold tabular-nums">{exportTotals.visits}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-6 py-3.5">
              <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">
                {ready ? "Joy assembled these hours from the visit clock. Upload them in Gusto to run payroll — Joy does not submit it for you, and wages are computed there." : "Joy assembled these hours from the visit clock. Upload them in Gusto to run payroll — wages are computed there."}
              </span>
              <span className="ml-auto flex flex-none items-center gap-2">
                <span className={cn("h-[7px] w-[7px] rounded-full", ready ? "bg-[#12B76A]" : "bg-[#F79009]")} aria-hidden="true" />
                <span className="text-xs text-[var(--ink-body)]">{ready ? "Reconciled · 0 exceptions" : `Draft · ${blockingCount} unresolved`}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      <Sheet open={sel !== null} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[468px]">
          {sel && (
            <>
              <SheetHeader className="space-y-1 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[13px] font-semibold text-primary">{initialsOf(sel.caregiver.caregiverName)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <SheetTitle className="text-[16.5px] font-semibold tracking-[-.01em]">{sel.caregiver.caregiverName}</SheetTitle>
                    <SheetDescription className="text-[12.5px]">
                      {sel.exception ? EXCEPTION_LABELS[sel.exception.kind] : "Overtime review"} · {labels.payroll}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {(sel.exception
                  ? [
                      { label: "Hours", value: `${sel.caregiver.totalHours}`, sub: "This period", warn: false },
                      { label: "Status", value: sel.exception.blocking ? "Blocking" : "Advisory", sub: sel.exception.blocking ? "Holds Gusto" : "Doesn't hold pay", warn: sel.exception.blocking },
                      { label: "Category", value: sel.category, sub: EXCEPTION_LABELS[sel.exception.kind], warn: false },
                    ]
                  : [
                      { label: "Regular", value: `${sel.caregiver.regularHours}`, sub: "hrs this period", warn: false },
                      { label: "Overtime", value: `${sel.caregiver.overtimeHours}`, sub: `hrs at ${OVERTIME_MULTIPLIER}×`, warn: true },
                      { label: "Threshold", value: `${OVERTIME_AFTER_HOURS}`, sub: "hrs per week", warn: false },
                    ]
                ).map((c) => (
                  <div key={c.label} className={cn("flex flex-col gap-1 rounded-[11px] border p-3", c.warn ? "border-[#FCE8B6] bg-[#FFFAEB]" : "border-[var(--hairline)] bg-[var(--paper-sunken)]")}>
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted-foreground">{c.label}</span>
                    <span className={cn("text-[13.5px] font-semibold leading-[1.3]", c.warn ? "text-[#B54708]" : "text-foreground")}>{c.value}</span>
                    <span className="text-[11.5px] text-muted-foreground">{c.sub}</span>
                  </div>
                ))}
              </div>
              {sel.exception && (
                <div className="mt-5 flex flex-col gap-2">
                  <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">What Joy found</h3>
                  <p className="m-0 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5 text-[12.5px] leading-[1.5]">{sel.exception.detail}</p>
                </div>
              )}
              <div className="mt-5 flex flex-col gap-2">
                <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Hours by week</h3>
                <div className="flex flex-col">
                  {sel.caregiver.weeks.map((w) => (
                    <div key={w.weekStart} className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2">
                      <span className="w-[150px] flex-none text-[12.5px] text-muted-foreground">Week of {shortDay(w.weekStart)}</span>
                      <span className="text-[13px] tabular-nums">
                        {w.regularHours} regular
                        {w.overtimeHours > 0 && <span className="font-medium text-[#B54708]"> · {w.overtimeHours} OT</span>}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2">
                    <span className="w-[150px] flex-none text-[12.5px] text-muted-foreground">Pay impact</span>
                    <span className="text-[13px] text-muted-foreground">Computed in Gusto — Joy hands over hours, not wages.</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 border-t border-[var(--hairline)] pt-4">
                <p className="m-0 text-[13px] leading-[1.5]">{sel.exception ? CLEARS_WHEN[sel.exception.kind] : "Overtime stands once the week's hours are verified — confirming it is part of approving the period."}</p>
                <p className="m-0 text-[11px] text-muted-foreground [text-wrap:pretty]">Resolving from this drawer isn't built yet — the fix happens at the source (the clock entry or the visit review) so payroll and the record can't disagree.</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
