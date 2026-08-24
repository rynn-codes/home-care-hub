import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  OVERTIME_AFTER_HOURS,
  OVERTIME_MULTIPLIER,
  entryHours,
  payrollRun,
  workweekStart,
  type CaregiverHours,
  type PayrollException,
} from "@/domain/payroll/hours";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { seedPayrollPeople, seedPayrollVisits, seedTimeEntries } from "@/lib/payrollSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { cn } from "@/lib/utils";

/**
 * Payroll, to the approved mock (docs/mockups/Joy Health Payroll.dc.html):
 * the readiness hero with its progress bar, the tabbed Needs-review queue
 * whose rows open the exception drawer, the Payroll-cycle checklist and
 * Also-on-Monday card on the right rail, the week grid, the export preview,
 * and payroll history.
 *
 * The screen is a readiness check rather than a calculator, and the mock's
 * money is deliberately absent: rates are not in the payroll domain — Karynn
 * has not supplied real ones, and multiplying fictional rates by real hours
 * would produce something that reads exactly like a wage. Joy produces
 * hours; Gusto produces wages. The mock's Rate and Gross columns therefore
 * do not appear, and every pay-impact line says where the money actually
 * lives. Recorded in MOCKUP_ALIGNMENT.md.
 */

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

type Category = "Time & clock" | "Verification" | "Documentation" | "Overtime";
const TABS: Array<"All" | Category> = ["All", "Time & clock", "Verification", "Documentation", "Overtime"];

const categoryOf = (kind: PayrollException["kind"]): Category =>
  kind === "awaiting_verification"
    ? "Verification"
    : kind === "documentation_gap"
      ? "Documentation"
      : "Time & clock";

const KIND_LABEL: Record<PayrollException["kind"], string> = {
  open_entry: "Still on the clock",
  visit_without_time: "Visit with no time",
  implausible_length: "Implausible shift length",
  awaiting_verification: "Review unfinished",
  documentation_gap: "Documentation gap",
};

/** What actually clears each exception — the drawer says it instead of faking a button. */
const CLEARS_WHEN: Record<PayrollException["kind"], string> = {
  open_entry: "This clears when the caregiver clocks out, or the office records the clock-out she missed.",
  visit_without_time: "This clears when somebody who knows what happened approves hours for the visit — the verified-unit review the database migrations carry.",
  implausible_length: "This clears when the clock-out is corrected to the real end of the shift.",
  awaiting_verification: "This clears when the review that was started is finished and the hours are approved.",
  documentation_gap: "This does not hold up pay. It clears when the outstanding documentation is filed.",
};

interface QueueItem {
  id: string;
  caregiver: CaregiverHours;
  category: Category;
  /** Absent for the overtime-confirmation rows, which carry no exception. */
  exception?: PayrollException;
  summary: string;
  status: string;
  tone: "warn" | "muted";
}

export default function Payroll() {
  const [view, setView] = useState<"review" | "grid">("review");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [sel, setSel] = useState<QueueItem | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const period = useMemo(() => {
    // A fortnight ending today, which is what the demo data covers. The real
    // version reads Joy's configured schedule.
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 13);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: iso(start), end: iso(end) };
  }, []);

  const run = useMemo(
    () =>
      payrollRun({
        period,
        people: seedPayrollPeople,
        entries: seedTimeEntries,
        visits: seedPayrollVisits,
      }),
    [period],
  );

  // The week everything on this screen means by "the week": Saturday–Friday,
  // matching Gusto. Payroll pays the one that just finished.
  const weekDates = useMemo(() => {
    const currentStart = new Date(`${workweekStart(new Date().toISOString())}T12:00:00`);
    const payrollStart = new Date(currentStart);
    payrollStart.setDate(payrollStart.getDate() - 7);
    const label = (start: Date) => {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}`;
    };
    const billingStart = new Date(`${upcomingBillingWeek(new Date().toISOString())}T12:00:00`);
    return { payroll: label(payrollStart), billing: label(billingStart) };
  }, []);

  const queue: QueueItem[] = useMemo(() => {
    const items: QueueItem[] = [];
    for (const c of run.caregivers) {
      for (const [i, ex] of c.exceptions.entries()) {
        items.push({
          id: `${c.caregiverPersonId}-${i}`,
          caregiver: c,
          category: categoryOf(ex.kind),
          exception: ex,
          summary: `${KIND_LABEL[ex.kind]} · ${ex.detail}`,
          status: ex.blocking ? "Needs review" : "Doesn't hold pay",
          tone: ex.blocking ? "warn" : "muted",
        });
      }
      if (c.overtimeHours > 0) {
        items.push({
          id: `${c.caregiverPersonId}-ot`,
          caregiver: c,
          category: "Overtime",
          summary: `Overtime review · Regular ${c.regularHours} hrs · OT ${c.overtimeHours} hrs at ${OVERTIME_MULTIPLIER}×`,
          status: "Confirm OT",
          tone: "warn",
        });
      }
    }
    return items;
  }, [run]);

  const countFor = (t: (typeof TABS)[number]) =>
    t === "All" ? queue.length : queue.filter((i) => i.category === t).length;
  const visibleQueue = queue.filter((i) => tab === "All" || i.category === tab);

  const cleared = run.caregivers.filter((c) => c.ready).length;
  const total = run.caregivers.length;
  const pct = total === 0 ? 100 : Math.round((cleared / total) * 100);
  const ready = run.ready;
  const blockingCount = queue.filter((i) => i.exception?.blocking).length;

  const heroTitle = prepared
    ? "Prepared for Gusto"
    : ready
      ? "Ready for Gusto"
      : cleared === 0
        ? "Payroll needs review"
        : "Payroll is almost ready";
  const heroSub = prepared
    ? `Joy assembled the export summary for ${weekDates.payroll}. Submit the hours inside Gusto — Joy does not run payroll.`
    : ready
      ? `Payroll review is complete for ${weekDates.payroll}.`
      : `${blockingCount} ${blockingCount === 1 ? "item needs" : "items need"} review before this cycle is ready for Gusto.`;

  const otToConfirm = run.caregivers.filter((c) => c.overtimeHours > 0).length;
  const cycleAll = [
    { label: "Visit hours collected", state: "done" as const, note: `${total} caregivers` },
    { label: "Schedule compared", state: "done" as const, note: `${seedPayrollVisits.length} shifts` },
    {
      label: "Exceptions reviewed",
      state: blockingCount === 0 ? ("done" as const) : ("open" as const),
      note: blockingCount === 0 ? "Cleared" : `${blockingCount} remaining`,
    },
    {
      label: "Overtime reviewed",
      state: otToConfirm === 0 ? ("done" as const) : ("open" as const),
      note: otToConfirm === 0 ? "None this week" : `${otToConfirm} to confirm`,
    },
    { label: "Payroll approved", state: ready ? ("done" as const) : ("todo" as const), note: ready ? "Review clear" : "" },
    { label: "Prepared for Gusto", state: prepared ? ("done" as const) : ("todo" as const), note: prepared ? "Export ready" : "" },
    { label: "LTI / paid invoice sent", state: "todo" as const, note: "" },
    { label: "Cycle complete", state: "todo" as const, note: "" },
  ];
  const doneCount = cycleAll.filter((c) => c.state === "done").length;
  const cycle = showDone ? cycleAll : cycleAll.filter((c) => c.state !== "done");

  // The week grid: the payroll week — the Saturday–Friday that just ended,
  // the one this cycle pays — hours per day from the same entries the run
  // reads.
  const grid = useMemo(() => {
    const start = new Date(`${workweekStart(new Date().toISOString())}T12:00:00`);
    start.setDate(start.getDate() - 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const flaggedDates = new Map<string, Set<string>>();
    for (const c of run.caregivers) {
      const dates = new Set<string>();
      for (const ex of c.exceptions) {
        const entry = ex.entryId ? seedTimeEntries.find((e) => e.id === ex.entryId) : null;
        const visit = ex.visitId ? seedPayrollVisits.find((v) => v.id === ex.visitId) : null;
        const when = entry?.clockedInAt ?? visit?.startsAt;
        if (when) dates.add(when.slice(0, 10));
      }
      flaggedDates.set(c.caregiverPersonId, dates);
    }
    const rows = run.caregivers.map((c) => {
      const mine = seedTimeEntries.filter((e) => e.caregiverPersonId === c.caregiverPersonId);
      const cells = days.map((d) => {
        const key = dayKey(d);
        const hours = mine
          .filter((e) => e.clockedInAt.slice(0, 10) === key)
          .reduce((t, e) => t + entryHours(e), 0);
        return {
          hours: Math.round(hours * 100) / 100,
          flagged: flaggedDates.get(c.caregiverPersonId)?.has(key) ?? false,
        };
      });
      const employee = seedEmployees.find((e) => c.caregiverName.startsWith(e.name));
      // Totals cover the week shown, not the whole period — a grid whose Hrs
      // column disagrees with its own cells reads as a mistake.
      const weekKey = days[0].toISOString().slice(0, 10);
      const weekTotals = c.weeks.find((w) => w.weekStart === weekKey);
      const total = Math.round(cells.reduce((t, cell) => t + cell.hours, 0) * 100) / 100;
      return {
        c,
        cells,
        title: employee?.title ?? "Caregiver",
        total,
        ot: weekTotals?.overtimeHours ?? 0,
      };
    });
    const footer = days.map((_, i) =>
      Math.round(rows.reduce((t, r) => t + r.cells[i].hours, 0) * 100) / 100,
    );
    const totalHrs = Math.round(rows.reduce((t, r) => t + r.total, 0) * 100) / 100;
    const totalOt = Math.round(rows.reduce((t, r) => t + r.ot, 0) * 100) / 100;
    return { days, rows, footer, totalHrs, totalOt };
  }, [run]);

  const monday = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Review payroll readiness, resolve exceptions, and prepare the cycle for Gusto."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="h-[34px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
            >
              Preview export file
            </button>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                "h-[34px] rounded-[9px] border border-[#ECECF1] px-3 text-[13px] transition-colors",
                showHistory ? "bg-[#F1F2F6] text-foreground" : "bg-white text-[#5B6274] hover:bg-[#FAFAFB] hover:text-foreground",
              )}
            >
              Payroll history
            </button>
            <button
              type="button"
              disabled={!ready}
              title={ready ? undefined : "Resolve the review items first"}
              onClick={() => (prepared ? setShowExport(true) : setPrepared(true))}
              className={cn(
                "h-[34px] rounded-[9px] px-3.5 text-[13px] font-medium transition-colors",
                ready
                  ? "bg-primary text-white hover:bg-[#2A1BD1]"
                  : "cursor-not-allowed bg-[#F1F2F6] text-muted-foreground/50",
              )}
            >
              {prepared ? "Prepared · view summary" : "Prepare for Gusto"}
            </button>
          </>
        }
      />

      {showHistory && (
        <section className="mb-5 overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
          <div className="flex items-center gap-2 border-b border-[#ECECF1] px-4 py-3.5">
            <span className="text-[13.5px] font-semibold">Payroll history</span>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="ml-auto text-[12.5px] text-primary hover:text-[#2A1BD1]"
            >
              Close
            </button>
          </div>
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            No completed cycles yet. A row lands here each time a cycle is prepared for Gusto —
            history isn't seeded in the prototype, so this list starts honest and empty.
          </p>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-baseline gap-x-7 gap-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
          Today · {monday}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted-foreground">Payroll week</span>
          <span className="text-sm font-semibold">{weekDates.payroll}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted-foreground">Billing week</span>
          <span className="text-sm font-semibold">{weekDates.billing}</span>
        </span>
        <span className="ml-auto flex gap-0.5 rounded-[9px] bg-[#F1F2F6] p-[3px]" role="tablist" aria-label="Payroll views">
          {(
            [
              ["review", "Review queue"],
              ["grid", "Week grid"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                "h-7 rounded-[7px] px-3.5 text-[12.5px] transition-colors",
                view === value
                  ? "bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </span>
      </div>

      <section
        className={cn(
          "mb-5 flex flex-col rounded-2xl border bg-white px-6 py-6",
          ready ? "border-[#D3F0DF]" : "border-[#ECECF1]",
        )}
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[29px] font-semibold leading-[1.1] tracking-[-.025em]">{heroTitle}</span>
            <p className="m-0 max-w-[520px] text-sm text-[#5B6274] [text-wrap:pretty]">{heroSub}</p>
          </div>
          <div className="ml-auto flex flex-none items-center gap-5">
            <span className="flex flex-col items-end gap-[7px]">
              <span className="text-[13px] text-muted-foreground">
                {cleared} of {total} caregivers cleared
              </span>
              <span className="block h-[5px] w-[170px] overflow-hidden rounded-full bg-[#F1F2F6]">
                <span
                  className={cn("block h-full rounded-full", ready ? "bg-[#12B76A]" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </span>
            {!ready && (
              <button
                type="button"
                onClick={() => {
                  setView("review");
                  setTab("All");
                  if (queue[0]) setSel(queue[0]);
                }}
                className="h-9 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              >
                Review items →
              </button>
            )}
            {ready && (
              <button
                type="button"
                onClick={() => setShowExport(true)}
                className="h-9 rounded-[10px] border border-[#ECECF1] bg-white px-4 text-[13px] font-medium transition-colors hover:bg-[#FAFAFB]"
              >
                View payroll summary
              </button>
            )}
          </div>
        </div>
        {prepared && (
          <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-[#ECECF1] pt-4">
            <span className="text-[12.5px] text-[#5B6274]">Prepared just now in this session</span>
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="text-[12.5px] text-primary hover:text-[#2A1BD1]"
            >
              View export summary
            </button>
            <span className="ml-auto text-[11.5px] text-muted-foreground">
              Joy prepared the summary — submit the hours inside Gusto.
            </span>
          </div>
        )}
      </section>

      {view === "grid" && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold tracking-[-.01em]">
                Week grid · {grid.days[0].toLocaleDateString([], { month: "short", day: "numeric" })} –{" "}
                {grid.days[6].toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                Hours logged per day, from the same clock the review reads.
              </span>
            </div>
            <span className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-[7px] w-[7px] rounded-sm bg-[#F79009]" aria-hidden="true" />
                Needs review
              </span>
              {/* The grid's own Export, per the README: the grid exactly as
                  displayed. Hours only — that is all Joy holds; the priced
                  .xlsx stays with the developer and Gusto. */}
              <button
                type="button"
                onClick={() => {
                  const header = ["Employee", ...grid.days.map((d) => d.toISOString().slice(0, 10)), "Hrs", "OT"];
                  const body = grid.rows.map((r) => [
                    r.c.caregiverName,
                    ...r.cells.map((cell) => (cell.hours === 0 ? "" : String(cell.hours))),
                    String(r.total),
                    r.ot > 0 ? String(r.ot) : "",
                  ]);
                  const totals = ["Total", ...grid.footer.map((v) => (v === 0 ? "" : String(v))), String(grid.totalHrs), String(grid.totalOt)];
                  const csv = [header, ...body, totals]
                    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                    .join("\n");
                  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `joy-payroll-hours-${grid.days[0].toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("Week grid exported as shown — hours only, no wages.");
                }}
                className="flex h-[30px] items-center gap-1.5 rounded-lg border border-[#ECECF1] bg-white px-2.5 text-xs font-medium text-[#5B6274] transition-colors hover:bg-[#FAFAFB] hover:text-foreground"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                Export
              </button>
            </span>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-r border-[#ECECF1] bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                      Employee
                    </th>
                    {grid.days.map((d, i) => (
                      <th
                        key={d.toISOString()}
                        className={cn(
                          "whitespace-nowrap px-2.5 py-2 text-center leading-[1.35]",
                          i < 2 ? "bg-[#FAFAFB]" : "bg-[#FCFCFD]",
                        )}
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                          {d.toLocaleDateString([], { weekday: "short" })}
                        </span>
                        <span className="block text-[11px] font-normal text-muted-foreground/50">
                          {d.toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </th>
                    ))}
                    <th className="whitespace-nowrap bg-[#FCFCFD] px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                      Hrs
                    </th>
                    <th className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                      OT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map(({ c, cells, title, total, ot }) => (
                    <tr key={c.caregiverPersonId} className="border-t border-[#F3F3F6] hover:bg-[#FCFCFD]">
                      <td className="border-r border-[#F3F3F6] bg-white px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary">
                            {initialsOf(c.caregiverName)}
                          </span>
                          <span className="flex flex-col leading-[1.3]">
                            <span className="whitespace-nowrap text-[12.5px]">{c.caregiverName}</span>
                            <span className="text-[11px] text-muted-foreground">{title}</span>
                          </span>
                        </span>
                      </td>
                      {cells.map((cell, i) => (
                        <td
                          key={i}
                          className={cn(
                            "whitespace-nowrap px-2.5 py-2.5 text-center text-[12.5px] tabular-nums",
                            cell.flagged
                              ? "bg-[#FFFAEB] font-medium text-[#B54708]"
                              : cell.hours === 0
                                ? "text-muted-foreground/30"
                                : "text-foreground",
                          )}
                        >
                          {cell.hours === 0 ? "·" : cell.hours.toFixed(1).replace(/\.0$/, "")}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12.5px] font-medium tabular-nums">
                        {total.toFixed(1).replace(/\.0$/, "")}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-2.5 text-right text-[12.5px] tabular-nums",
                          ot > 0 ? "font-medium text-[#B54708]" : "text-muted-foreground/40",
                        )}
                      >
                        {ot > 0 ? ot.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ECECF1] bg-[#FCFCFD]">
                    <td className="whitespace-nowrap border-r border-[#ECECF1] px-4 py-3 text-[12.5px] font-semibold">
                      Total · {grid.rows.length} shown
                    </td>
                    {grid.footer.map((v, i) => (
                      <td key={i} className="px-2.5 py-3 text-center text-xs font-semibold tabular-nums">
                        {v === 0 ? "·" : v.toFixed(1).replace(/\.0$/, "")}
                      </td>
                    ))}
                    <td className="px-3.5 py-3 text-right text-[12.5px] font-semibold tabular-nums">
                      {grid.totalHrs.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums text-[#B54708]">
                      {grid.totalOt.toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-2.5 border-t border-[#ECECF1] bg-[#FCFCFD] px-4 py-3">
              <span className="text-[11.5px] text-muted-foreground">
                Hours only — rates and wages live in Gusto. Overtime accrues per Saturday–Friday
                workweek at {OVERTIME_AFTER_HOURS} hrs.
              </span>
              <span className="ml-auto text-[11.5px] text-muted-foreground">
                {ready ? "All hours reconciled" : `${blockingCount} flagged for review`}
              </span>
            </div>
          </div>
        </section>
      )}

      {view === "review" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-[3px]">
              <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Needs review</h2>
              <span className="text-[12.5px] text-muted-foreground">
                Only payroll items requiring action appear here.
              </span>
            </div>
            <div className="flex items-center gap-5 overflow-x-auto border-b border-[#ECECF1]" role="tablist" aria-label="Exception categories">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "-mb-px flex items-center gap-[7px] whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
                    tab === t
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                  <span
                    className={cn(
                      "rounded-full px-[7px] py-px text-[11px]",
                      tab === t ? "bg-[#EEF0FE] text-primary" : "bg-[#F3F3F6] text-muted-foreground",
                    )}
                  >
                    {countFor(t)}
                  </span>
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
              {visibleQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSel(item)}
                  className="flex w-full items-center gap-4 border-b border-[#F3F3F6] p-[18px] text-left transition-colors last:border-b-0 hover:bg-[#FAFAFB]"
                >
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11.5px] font-semibold text-primary">
                    {initialsOf(item.caregiver.caregiverName)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-sm font-medium">{item.caregiver.caregiverName}</span>
                    <span className="text-[12.5px] text-muted-foreground">{item.summary}</span>
                  </span>
                  <span className="ml-auto flex flex-none items-center gap-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full px-[11px] py-1 text-[11.5px] font-medium",
                        item.tone === "warn" ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#F3F3F6] text-[#5B6274]",
                      )}
                    >
                      {item.status}
                    </span>
                    <span className="text-[13px] text-muted-foreground/50" aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
              {visibleQueue.length === 0 && (
                <div className="flex flex-col gap-1.5 p-11 text-center">
                  <span className="text-sm font-medium">Nothing needs review</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {queue.length === 0
                      ? `All ${total} caregivers are cleared for ${weekDates.payroll}.`
                      : "Nothing in this category — check the other tabs."}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-[#ECECF1] bg-white px-4 py-3">
              <span
                className="h-2 w-2 flex-none rounded-full bg-[#8FA0FF]"
                style={{ animation: "joyGlow 2.6s ease-in-out infinite" }}
                aria-hidden="true"
              />
              <span className="text-[13px] [text-wrap:pretty]">
                {ready
                  ? `Joy: Payroll for ${weekDates.payroll} is clear. The Gusto summary is ready to prepare.`
                  : `Joy: ${run.blockedBy.length === 1 ? `${run.blockedBy[0]} is` : `${run.blockedBy.length} caregivers are`} holding payroll — open the queue rows to see exactly what clears each one.`}
              </span>
              <button
                type="button"
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("joy:ask", { detail: { question: "What is holding up payroll?" } }),
                  )
                }
                className="ml-auto flex-none text-[12.5px] text-primary hover:text-[#2A1BD1]"
              >
                Review with Joy →
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Payroll cycle
              </h2>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex w-full items-center gap-2.5 pb-1 text-left"
              >
                <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[#12B76A] text-[10.5px] font-semibold text-white">
                  ✓
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {doneCount} {doneCount === 1 ? "step" : "steps"} complete
                </span>
                <span
                  className={cn(
                    "ml-auto text-[13px] text-muted-foreground/50 transition-transform",
                    showDone && "rotate-180",
                  )}
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </button>
              <div className="flex flex-col">
                {cycle.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 border-b border-[#F3F3F6] py-2 last:border-b-0">
                    <span
                      className={cn(
                        "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10.5px] font-semibold",
                        s.state === "done"
                          ? "bg-[#12B76A] text-white"
                          : s.state === "open"
                            ? "bg-[#F79009] text-white"
                            : "bg-[#F1F2F6] text-muted-foreground/50",
                      )}
                    >
                      {s.state === "done" ? "✓" : s.state === "open" ? "!" : "○"}
                    </span>
                    <span className={cn("text-[13px]", s.state === "todo" && "text-muted-foreground")}>
                      {s.label}
                    </span>
                    <span className="ml-auto whitespace-nowrap text-[11.5px] text-muted-foreground">{s.note}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
              <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                Also on Monday
              </h2>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-[13px]">LTI / paid invoice</span>
                  <span
                    className={cn(
                      "inline-flex items-center whitespace-nowrap rounded-full px-[11px] py-1 text-[11.5px] font-medium",
                      ready ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F3F3F6] text-[#5B6274]",
                    )}
                  >
                    {ready ? "Ready to send" : "Waiting on payroll review"}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#F3F3F6] pt-3">
                <span className="text-[13px]">Bill {weekDates.billing}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  The Saturday drafts are waiting for review in Billing.
                </span>
                <Link to="/billing" className="pt-0.5 text-[12.5px] text-primary hover:text-[#2A1BD1]">
                  Open Billing →
                </Link>
              </div>
            </section>
          </div>
        </div>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Overtime is calculated per Saturday–Friday workweek — the week Gusto uses — rather than per
        pay period, so a light week followed by a heavy one still earns it. No pay rates appear
        here: Joy produces hours, Gusto produces wages.
      </p>

      {/* ------------------------------------------------ export preview -- */}
      {showExport && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-6 pt-14"
          role="dialog"
          aria-modal="true"
          aria-label="Payroll export preview"
        >
          <div className="absolute inset-0 bg-[rgba(25,26,46,.22)]" onClick={() => setShowExport(false)} />
          <div className="relative flex w-full max-w-[1000px] flex-col overflow-hidden rounded-2xl border border-[#ECECF1] bg-white shadow-[0_24px_60px_rgba(25,26,46,.16)]">
            <div className="flex items-start gap-4 border-b border-[#ECECF1] px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-[17px] font-semibold tracking-[-.01em]">
                  Payroll export · {weekDates.payroll}
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  {prepared
                    ? "Prepared this session · Gusto time-import format"
                    : "Draft — regenerates as items are reviewed · Gusto time-import format"}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="File generation lands with the developer — the summary below is the export's content"
                  className="h-[34px] cursor-not-allowed rounded-[9px] bg-[#F1F2F6] px-3.5 text-[13px] font-medium text-muted-foreground/50"
                >
                  Download .xlsx
                </button>
                <button
                  type="button"
                  aria-label="Close export preview"
                  onClick={() => setShowExport(false)}
                  className="h-[34px] w-[34px] rounded-[9px] border border-[#ECECF1] bg-white text-sm text-muted-foreground transition-colors hover:bg-[#F1F2F6] hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-8 border-b border-[#ECECF1] bg-[#FCFCFD] px-6 py-4">
              {[
                ["Caregivers cleared", `${cleared} of ${total}`],
                ["Regular hrs", `${(run.totalHours - run.overtimeHours).toFixed(1)}${ready ? "" : " *"}`],
                ["Overtime hrs", `${run.overtimeHours.toFixed(1)}${ready ? "" : " *"}`],
                ["Visits", String(seedPayrollVisits.length)],
              ].map(([label, value]) => (
                <span key={label} className="flex flex-col gap-[3px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-[17px] font-semibold tracking-[-.01em] tabular-nums">{value}</span>
                </span>
              ))}
            </div>

            <div className="max-h-[52vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Employee", "Regular hrs", "OT hrs", "Visits"].map((label, i) => (
                      <th
                        key={label}
                        className={cn(
                          "sticky top-0 whitespace-nowrap bg-[#FCFCFD] py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground",
                          i === 0 ? "px-6 text-left" : i === 3 ? "px-6 text-right" : "px-4 text-right",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.caregivers.map((c) => (
                    <tr key={c.caregiverPersonId} className="border-t border-[#F3F3F6]">
                      <td className="px-6 py-3 text-[13px]">
                        {c.caregiverName}
                        {!c.ready && <span className="ml-1 text-[#B54708]">*</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] tabular-nums">
                        {c.regularHours.toFixed(1)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right text-[13px] tabular-nums",
                          c.overtimeHours > 0 ? "font-medium text-[#B54708]" : "text-muted-foreground",
                        )}
                      >
                        {c.overtimeHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-3 text-right text-[12.5px] tabular-nums text-[#5B6274]">
                        {seedPayrollVisits.filter((v) => v.caregiverPersonId === c.caregiverPersonId).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ECECF1] bg-[#FCFCFD]">
                    <td className="px-6 py-3 text-[12.5px] font-semibold">
                      Total · {total} caregivers
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">
                      {(run.totalHours - run.overtimeHours).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">
                      {run.overtimeHours.toFixed(1)}
                    </td>
                    <td className="px-6 py-3 text-right text-[12.5px] font-semibold tabular-nums">
                      {seedPayrollVisits.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center gap-3 border-t border-[#ECECF1] bg-[#FCFCFD] px-6 py-3.5">
              <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">
                {ready
                  ? "Joy assembled these hours from the visit clock. Upload them in Gusto to run payroll — Joy does not submit it for you, and wages are computed there."
                  : `* Draft figures — starred rows can still change as the ${blockingCount} open ${blockingCount === 1 ? "exception is" : "exceptions are"} resolved.`}
              </span>
              <span className="ml-auto flex flex-none items-center gap-2">
                <span
                  className={cn("h-[7px] w-[7px] rounded-full", ready ? "bg-[#12B76A]" : "bg-[#F79009]")}
                  aria-hidden="true"
                />
                <span className="text-xs text-[#5B6274]">
                  {ready ? "Reconciled · 0 exceptions" : `Draft · ${blockingCount} unresolved`}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- exception drawer -- */}
      <Sheet open={sel !== null} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[468px]">
          {sel && (
            <>
              <SheetHeader className="space-y-1 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[13px] font-semibold text-primary">
                    {initialsOf(sel.caregiver.caregiverName)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <SheetTitle className="text-[16.5px] font-semibold tracking-[-.01em]">
                      {sel.caregiver.caregiverName}
                    </SheetTitle>
                    <SheetDescription className="text-[12.5px]">
                      {sel.exception ? KIND_LABEL[sel.exception.kind] : "Overtime review"} ·{" "}
                      {weekDates.payroll}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {(sel.exception
                  ? [
                      { label: "Hours", value: `${sel.caregiver.totalHours}`, sub: "This period" },
                      {
                        label: "Status",
                        value: sel.exception.blocking ? "Blocking" : "Advisory",
                        sub: sel.exception.blocking ? "Holds Gusto" : "Doesn't hold pay",
                        warn: sel.exception.blocking,
                      },
                      { label: "Category", value: sel.category, sub: KIND_LABEL[sel.exception.kind] },
                    ]
                  : [
                      { label: "Regular", value: `${sel.caregiver.regularHours}`, sub: "hrs this period" },
                      {
                        label: "Overtime",
                        value: `${sel.caregiver.overtimeHours}`,
                        sub: `hrs at ${OVERTIME_MULTIPLIER}×`,
                        warn: true,
                      },
                      { label: "Threshold", value: `${OVERTIME_AFTER_HOURS}`, sub: "hrs per week" },
                    ]
                ).map((c) => (
                  <div
                    key={c.label}
                    className={cn(
                      "flex flex-col gap-1 rounded-[11px] border p-3",
                      c.warn ? "border-[#FCE8B6] bg-[#FFFAEB]" : "border-[#ECECF1] bg-[#FCFCFD]",
                    )}
                  >
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] font-semibold leading-[1.3]",
                        c.warn ? "text-[#B54708]" : "text-foreground",
                      )}
                    >
                      {c.value}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">{c.sub}</span>
                  </div>
                ))}
              </div>

              {sel.exception && (
                <div className="mt-5 flex flex-col gap-2">
                  <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    What Joy found
                  </h3>
                  <p className="m-0 rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD] px-3 py-2.5 text-[12.5px] leading-[1.5]">
                    {sel.exception.detail}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                  Hours by week
                </h3>
                <div className="flex flex-col">
                  {sel.caregiver.weeks.map((w) => (
                    <div key={w.weekStart} className="flex items-baseline gap-3.5 border-b border-[#F3F3F6] py-2">
                      <span className="w-[150px] flex-none text-[12.5px] text-muted-foreground">
                        Week of {fmtDay(w.weekStart)}
                      </span>
                      <span className="text-[13px] tabular-nums">
                        {w.regularHours} regular
                        {w.overtimeHours > 0 && (
                          <span className="font-medium text-[#B54708]"> · {w.overtimeHours} OT</span>
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-baseline gap-3.5 border-b border-[#F3F3F6] py-2">
                    <span className="w-[150px] flex-none text-[12.5px] text-muted-foreground">Pay impact</span>
                    <span className="text-[13px] text-muted-foreground">
                      Computed in Gusto — Joy hands over hours, not wages.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-[#ECECF1] pt-4">
                <p className="m-0 text-[13px] leading-[1.5]">
                  {sel.exception ? CLEARS_WHEN[sel.exception.kind] : "Overtime stands once the week's hours are verified — confirming it is part of approving the period."}
                </p>
                <p className="m-0 text-[11px] text-muted-foreground [text-wrap:pretty]">
                  Resolving from this drawer isn't built yet — the fix happens at the source (the
                  clock entry or the visit review) so payroll and the record can't disagree.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
