import type { ReactNode } from "react";
import { Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_PILL, type PayrollStatus } from "@/domain/payroll/review";

export interface PayrollRow {
  caregiverPersonId: string;
  name: string;
  role: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  /** Null for salaried staff. */
  rate: number | null;
  gross: number | null;
  status: PayrollStatus;
  detail: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const tenth = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Every employee on the payroll week: hours, overtime, rate, gross and where they stand. */
export function EmployeesTable({
  rows,
  periodLabel,
  query,
  onQuery,
  tab,
  onTab,
  counts,
  periodOvertimeHours,
  money,
  onOpen,
  onExport,
  filter,
}: {
  rows: PayrollRow[];
  periodLabel: string;
  query: string;
  onQuery: (q: string) => void;
  tab: "all" | "review";
  onTab: (t: "all" | "review") => void;
  counts: { all: number; review: number };
  periodOvertimeHours: number;
  money: (n: number | null) => string;
  onOpen: (caregiverPersonId: string) => void;
  onExport: () => void;
  filter: ReactNode;
}) {
  const totals = rows.reduce((t, r) => ({ hours: t.hours + r.totalHours, ot: t.ot + r.overtimeHours, gross: t.gross + (r.gross ?? 0), priced: t.priced + (r.gross === null ? 0 : 1) }), { hours: 0, ot: 0, gross: 0, priced: 0 });
  const th = (label: string, right?: boolean) => (
    <th key={label} scope="col" className={cn("whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground", right ? "text-right" : "text-left")}>
      {label}
    </th>
  );
  return (
    <section aria-label="Employees" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Employees · {periodLabel}</h2>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search employee"
              aria-label="Search employee"
              className="h-[34px] w-[220px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] pl-8 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          {filter}
          <button type="button" onClick={onExport} className="flex h-[34px] flex-none items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            <Download className="h-[13px] w-[13px]" aria-hidden="true" />
            Export grid
          </button>
        </div>
      </div>
      <div className="flex items-center gap-5 border-b border-[var(--hairline)]" role="tablist" aria-label="Employee list">
        {(
          [
            ["all", "All employees", counts.all],
            ["review", "Needs review", counts.review],
          ] as const
        ).map(([value, label, n]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => onTab(value)} className={cn("flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-[13px] transition-colors", tab === value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            <span className={cn("rounded-full px-1.5 py-[1px] text-[11px]", tab === value ? "bg-[#EEF0FE] text-primary" : "bg-[var(--wash-strong)] text-muted-foreground")}>{n}</span>
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">Verified hours, overtime and gross pay for every employee in {periodLabel}</caption>
            <thead>
              <tr>
                {th("Employee")}
                {th("Hours", true)}
                {th("OT", true)}
                {th("Rate", true)}
                {th("Gross", true)}
                {th("Status")}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-[var(--hairline-soft)]">
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                    Nobody matches that.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.caregiverPersonId} onClick={() => onOpen(r.caregiverPersonId)} className="cursor-pointer border-t border-[var(--hairline-soft)] transition-colors hover:bg-[var(--wash)]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">{initialsOf(r.name)}</span>
                        <span className="flex flex-col leading-[1.35]">
                          <span className="whitespace-nowrap text-[13px] font-medium">{r.name}</span>
                          <span className="text-[11.5px] text-muted-foreground">{r.role}</span>
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] tabular-nums">{r.totalHours.toFixed(1)}</td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right text-[12.5px] tabular-nums", r.status === "unexpected_ot" || r.status === "above_approved_ot" ? "font-medium text-[#B42318]" : "text-[var(--ink-body)]")}>{r.overtimeHours > 0 ? r.overtimeHours.toFixed(1) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] tabular-nums">{r.rate === null ? <span className="text-muted-foreground">Salaried</span> : money(r.rate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] font-medium tabular-nums">{r.gross === null ? <span className="text-muted-foreground">—</span> : money(r.gross)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", PAYROLL_STATUS_PILL[r.status])}>{PAYROLL_STATUS_LABELS[r.status]}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-[var(--hairline)] bg-[var(--paper-sunken)]">
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] font-semibold">
                    Total · {rows.length} {tab === "review" ? "needing review" : rows.length === 1 ? "employee" : "employees"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums">{tenth(totals.hours)}</td>
                  <td className={cn("whitespace-nowrap px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums", totals.ot > 0 ? "text-[#B42318]" : "text-muted-foreground/40")}>{totals.ot > 0 ? tenth(totals.ot) : "—"}</td>
                  <td />
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums">{money(totals.gross)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-3">
          <span className="text-[11.5px] text-muted-foreground">
            {rows.length} of {counts.all} {counts.all === 1 ? "employee" : "employees"}
            {totals.priced < rows.length && " · salaried staff carry no gross"}
          </span>
          <span className="ml-auto text-[11.5px] text-muted-foreground">{periodOvertimeHours > 0 ? `${tenth(periodOvertimeHours)} overtime hrs this period` : "No overtime this period"}</span>
        </div>
      </div>
    </section>
  );
}
