import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_STATUS_LABELS,
  ROLE_LABELS,
  type EmployeeRole,
  type EmployeeStatus,
} from "@/domain/employees/credentials";
import type { ComplianceSummary } from "@/domain/credentials/compliance";

/**
 * The directory from the approved Employees mock, to its own values —
 * including the mock's compliance-attention strip: one amber chip per person
 * with something lapsed or expiring, each opening that record.
 *
 * The compliance column is the reason this screen exists. An agency's real
 * exposure is a caregiver who went out with an expired TB test — so the
 * column names the item rather than counting items, and the ordering puts a
 * lapse at the top instead of leaving it at R for Robinson.
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
}

const ROLE_TONE: Record<EmployeeRole, string> = {
  cna: "text-primary bg-[#EEF0FE]",
  // #0E9384 measured 3.61:1 on its own background — a pill is small text, so
  // it needs 4.5:1. Darkened to #0B7268, which is 5.51:1 and still reads teal.
  hha: "text-[#0B7268] bg-[#ECFDF7]",
  lvn: "text-[#B54708] bg-[#FFFAEB]",
  office: "text-[#5B6274] bg-[#F3F3F6]",
};

const STATUS_DOT: Record<EmployeeStatus, string> = {
  active: "bg-[#12B76A]",
  onboarding: "bg-primary",
  on_leave: "bg-[#F79009]",
  inactive: "bg-[#D0D5DD]",
};

const COMPLIANCE_DOT: Record<string, string> = {
  current: "bg-[#12B76A]",
  expiring: "bg-[#F79009]",
  incomplete: "bg-[#F79009]",
  blocked: "bg-[#D92D20]",
};

interface Props {
  rows: DirectoryRow[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (id: string) => void;
}

export function EmployeeDirectory({ rows, query, onQueryChange, onOpen }: Props) {
  const attention = rows.filter(
    (r) => r.compliance.verdict === "blocked" || r.compliance.verdict === "expiring",
  );

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex h-[34px] w-full items-center gap-2 rounded-[9px] border border-[#ECECF1] bg-white px-2.5 sm:w-[212px]">
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
        <button
          type="button"
          disabled
          title="Filters are not built yet"
          className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-muted-foreground/50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filter
        </button>
        {/* Hiring owns adding people (§6): a new employee comes out of the
            pipeline, never typed straight into the directory. */}
        <Link
          to="/operations/hiring"
          className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
        >
          <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
          Add employee
        </Link>
      </div>

      {attention.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#ECECF1] bg-white px-3.5 py-2.5">
          <span className="flex flex-none items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#F79009]" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
              Compliance attention
            </span>
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

      <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <caption className="sr-only">
              Staff directory, ordered so lapsed credentials appear first
            </caption>
            <thead>
              <tr>
                {["Employee", "Role", "Status", "Compliance", "Clients", "Hours", "Next shift"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpen(r.id)}
                  className="cursor-pointer border-t border-[#F3F3F6] hover:bg-[#FAFAFB]"
                >
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
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        ROLE_TONE[r.role],
                      )}
                    >
                      {ROLE_LABELS[r.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[#5B6274]">
                      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATUS_DOT[r.status])} aria-hidden="true" />
                      {EMPLOYEE_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[#5B6274]">
                      <span
                        className={cn("h-[7px] w-[7px] flex-none rounded-full", COMPLIANCE_DOT[r.compliance.verdict])}
                        aria-hidden="true"
                      />
                      {r.compliance.summary}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                    {r.clients.join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274] tabular-nums">
                    {r.weeklyHours === null ? "—" : `${r.weeklyHours} hrs`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                    {r.nextShift ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nobody matches that search.
          </p>
        )}
      </div>
    </>
  );
}
