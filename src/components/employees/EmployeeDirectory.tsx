import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_STATUS_LABELS,
  ROLE_LABELS,
  type EmployeeRole,
  type EmployeeStatus,
} from "@/domain/employees/credentials";
import type { ComplianceSummary } from "@/domain/credentials/compliance";
import {
  COMPLIANCE_FILTER_LABELS,
  complianceBucket,
  type ComplianceFilter,
} from "@/domain/employees/directoryFilters";

/**
 * The directory, grouped by role, with the status strip, the search box and
 * the role/compliance filter — and the amber compliance-attention strip
 * underneath: one chip per person with something lapsed or expiring.
 *
 * Sorted by who holds the next move. A lapsed credential must not sit at R
 * because the person is called Robinson.
 */
export interface DirectoryRow {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  location: string;
  compliance: ComplianceSummary;
  clients: string[];
  nextShift: string | null;
  weeklyHours: number | null;
  drives: boolean;
  phone: string | null;
  email: string | null;
}

export type StatusFilter = EmployeeStatus | "all";
export type RoleFilter = EmployeeRole | "all";

const ROLE_TONE: Record<EmployeeRole, string> = {
  cna: "text-primary bg-[#EEF0FE]",
  // #0E9384 measured 3.61:1 on its own background — a pill is small text, so
  // it needs 4.5:1. Darkened to #0B7268, which is 5.51:1 and still reads teal.
  caregiver: "text-[#0B7268] bg-[#ECFDF7]",
  rn: "text-[#B54708] bg-[#FFFAEB]",
  lvn: "text-[#B54708] bg-[#FFFAEB]",
  office: "text-[var(--ink-body)] bg-[var(--hairline-soft)]",
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "on_leave", label: "On leave" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];

const STATUS_DOT: Record<EmployeeStatus, string> = {
  active: "bg-[#12B76A]",
  onboarding: "bg-primary",
  on_leave: "bg-[#F79009]",
  inactive: "bg-[#D0D5DD]",
};

const GROUPS: Array<{ key: string; label: string; roles: EmployeeRole[] }> = [
  { key: "field", label: "Caregivers & CNAs", roles: ["caregiver", "cna"] },
  { key: "lvn", label: ROLE_LABELS.lvn, roles: ["lvn"] },
  { key: "rn", label: ROLE_LABELS.rn, roles: ["rn"] },
  { key: "office", label: ROLE_LABELS.office, roles: ["office"] },
];

const COLUMNS = ["Employee", "Role", "Status", "Phone", "Email", "Hours", "Next shift"];

interface Props {
  rows: DirectoryRow[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (id: string) => void;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  role: RoleFilter;
  onRoleChange: (r: RoleFilter) => void;
  compliance: ComplianceFilter | "all";
  onComplianceChange: (c: ComplianceFilter | "all") => void;
  /** The rows the role and compliance filters count against — after status and search. */
  pool: DirectoryRow[];
  counts: Record<StatusFilter, number>;
  hiddenByFilters: number;
  onClearFilters: () => void;
}

export function EmployeeDirectory({
  rows,
  query,
  onQueryChange,
  onOpen,
  status,
  onStatusChange,
  role,
  onRoleChange,
  compliance,
  onComplianceChange,
  pool,
  counts,
  hiddenByFilters,
  onClearFilters,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilters = (role === "all" ? 0 : 1) + (compliance === "all" ? 0 : 1);
  const roleCount = (r: EmployeeRole) => pool.filter((x) => x.role === r).length;
  const complianceCount = (c: ComplianceFilter) => pool.filter((x) => complianceBucket(x.compliance.verdict) === c).length;
  const attention = rows.filter((r) => r.compliance.verdict === "blocked" || r.compliance.verdict === "expiring");
  const groups = GROUPS.map((g) => [g, rows.filter((r) => g.roles.includes(r.role))] as const).filter(([, list]) => list.length > 0);
  const option = "flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-[var(--wash)]";

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-0.5 rounded-[10px] bg-[var(--paper-sunken)] p-[3px]" role="group" aria-label="Filter employees by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => onStatusChange(f.value)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 py-[7px] text-[12.5px] transition-colors",
                status === f.value
                  ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)]"
                  : "font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="tabular-nums text-[11.5px] text-muted-foreground">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
          <div className="flex h-[34px] w-full items-center gap-2 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 sm:w-[212px]">
            <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
            <input
              id="employee-search"
              type="search"
              aria-label="Search employees"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search employees"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              className={cn(
                "flex h-[34px] items-center gap-[7px] rounded-[9px] border px-3 text-[13px] transition-colors",
                activeFilters > 0
                  ? "border-primary bg-[#EEF0FE] font-medium text-primary"
                  : "border-[var(--hairline)] bg-[var(--wash)] text-[var(--ink-body)] hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              Filter
              {activeFilters > 0 && <span className="text-[11.5px]">{activeFilters}</span>}
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} aria-hidden="true" />
                <div
                  role="listbox"
                  aria-label="Filter employees"
                  className="absolute right-0 z-20 mt-1.5 w-[260px] rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-2 shadow-[0_16px_40px_rgba(25,26,46,.14)]"
                >
                  <span className="block px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Role</span>
                  {(["caregiver", "cna", "lvn", "rn", "office"] as EmployeeRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="option"
                      aria-selected={role === r}
                      onClick={() => onRoleChange(role === r ? "all" : r)}
                      className={cn(option, role === r ? "bg-[var(--wash)] font-medium text-foreground" : "text-[var(--ink-body)]")}
                    >
                      {ROLE_LABELS[r]}
                      <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">{roleCount(r)}</span>
                    </button>
                  ))}
                  <span className="mx-2.5 my-1.5 block border-t border-[var(--hairline-soft)]" aria-hidden="true" />
                  <span className="block px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Compliance</span>
                  {(["attention", "expiring", "current"] as ComplianceFilter[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={compliance === c}
                      onClick={() => onComplianceChange(compliance === c ? "all" : c)}
                      className={cn(option, compliance === c ? "bg-[var(--wash)] font-medium text-foreground" : "text-[var(--ink-body)]")}
                    >
                      {COMPLIANCE_FILTER_LABELS[c]}
                      <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">{complianceCount(c)}</span>
                    </button>
                  ))}
                  {activeFilters > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearFilters();
                        setFilterOpen(false);
                      }}
                      className="mt-1.5 w-full rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-medium text-primary hover:bg-[var(--wash)]"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {hiddenByFilters > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {hiddenByFilters === 1 ? "One more person matches, outside these filters." : `${hiddenByFilters} more people match, outside these filters.`}{" "}
          <button type="button" onClick={onClearFilters} className="font-medium text-primary underline-offset-4 hover:underline">
            Search everyone
          </button>
        </p>
      )}

      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <caption className="sr-only">Staff directory, ordered so lapsed credentials appear first</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(([g, list]) => (
              <tbody key={g.key}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={7}
                    className="border-t border-[var(--hairline)] bg-[var(--wash)] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-[var(--ink-body)]"
                  >
                    {g.label}
                    <span className="ml-1.5 font-medium text-muted-foreground">{list.length}</span>
                  </th>
                </tr>
                {list.map((r) => (
                  <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-t border-[var(--hairline-soft)] hover:bg-[var(--wash)]">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onOpen(r.id)} className="flex items-center gap-2.5 text-left">
                        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                          {r.initials}
                        </span>
                        <span className="flex flex-col leading-[1.35]">
                          <span className="whitespace-nowrap text-[13px] font-medium">{r.name}</span>
                          <span className="text-[11.5px] text-muted-foreground">{r.title}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium", ROLE_TONE[r.role])}>
                        {ROLE_LABELS[r.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[var(--ink-body)]">
                        <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATUS_DOT[r.status])} aria-hidden="true" />
                        {EMPLOYEE_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                      {r.phone ? (
                        <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {r.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[210px] truncate px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                      {r.email ? (
                        <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} className="hover:underline" title={r.email}>
                          {r.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)] tabular-nums">
                      {r.weeklyHours === null ? "—" : `${r.weeklyHours} hrs`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{r.nextShift ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nobody matches that.</p>}
      </div>

      {attention.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-3.5 py-2.5">
          <span className="flex flex-none items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#F79009]" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Compliance attention</span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {attention.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex items-center gap-1.5 rounded-full border border-[#FCE8B6] bg-[#FFFAEB] px-3 py-[5px] text-[12.5px] text-[#B54708] transition-colors hover:bg-[#FEF3D6]"
              >
                <span className="font-medium text-foreground">{r.name}</span>
                {r.compliance.summary}
              </button>
            ))}
          </span>
        </div>
      )}
    </>
  );
}
