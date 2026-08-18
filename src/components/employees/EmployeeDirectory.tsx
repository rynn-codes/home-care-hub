import { Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMPLOYEE_STATUS_LABELS,
  ROLE_LABELS,
  type EmployeeCompliance,
  type EmployeeRole,
  type EmployeeStatus,
} from "@/domain/employees/credentials";

/**
 * The directory from the approved Employees mockup: everyone on staff, with
 * role, status, compliance and current assignments.
 *
 * The compliance column is the reason this screen exists. An agency's real
 * exposure is a caregiver who went out with an expired TB test — so the column
 * names the item rather than counting items, and the ordering puts a lapse at
 * the top instead of leaving it at R for Robinson.
 */

export interface DirectoryRow {
  id: string;
  name: string;
  initials: string;
  title: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  location: string;
  compliance: EmployeeCompliance;
  clients: string[];
  nextShift: string | null;
  weeklyHours: number | null;
  drives: boolean;
}

const ROLE_TONE: Record<EmployeeRole, string> = {
  cna: "text-primary bg-primary-soft",
  hha: "text-[#0E9384] bg-[#ECFDF7]",
  lvn: "text-[#B54708] bg-[#FFFAEB]",
  office: "text-muted-foreground bg-surface-muted",
};

const STATUS_DOT: Record<EmployeeStatus, string> = {
  active: "bg-[hsl(var(--success))]",
  onboarding: "bg-primary",
  on_leave: "bg-[hsl(var(--warning))]",
  inactive: "bg-border",
};

const COMPLIANCE_TONE: Record<string, string> = {
  current: "text-[hsl(var(--success))]",
  expiring: "text-[hsl(var(--warning))]",
  incomplete: "text-[hsl(var(--warning))]",
  blocked: "text-destructive",
};

interface Props {
  rows: DirectoryRow[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (id: string) => void;
}

export function EmployeeDirectory({ rows, query, onQueryChange, onOpen }: Props) {
  const blocked = rows.filter((r) => r.compliance.verdict === "blocked").length;
  const expiring = rows.filter((r) => r.compliance.verdict === "expiring").length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="employee-search"
            aria-label="Search employees"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search staff…"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Filter
        </Button>
      </div>

      {(blocked > 0 || expiring > 0) && (
        <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert
            className={cn("mt-0.5 h-4 w-4 shrink-0", blocked > 0 ? "text-destructive" : "text-[hsl(var(--warning))]")}
            aria-hidden="true"
          />
          <span>
            {blocked > 0 && (
              <>
                <strong className="font-medium text-foreground">
                  {blocked === 1 ? "One caregiver cannot be scheduled" : `${blocked} caregivers cannot be scheduled`}
                </strong>{" "}
                — a credential has lapsed.{" "}
              </>
            )}
            {expiring > 0 && `${expiring} more ${expiring === 1 ? "has something" : "have something"} expiring soon.`}
          </span>
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">
            Staff directory, ordered so lapsed credentials appear first
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Name</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Role</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Compliance</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-3 font-medium lg:table-cell">Clients</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-3 font-medium 2xl:table-cell">Next shift</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpen(r.id)} className="flex items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {r.initials}
                    </span>
                    <span>
                      <span className="block whitespace-nowrap font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">{r.title}</span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                      ROLE_TONE[r.role],
                    )}
                  >
                    {ROLE_LABELS[r.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[r.status])} aria-hidden="true" />
                    {EMPLOYEE_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("whitespace-nowrap", COMPLIANCE_TONE[r.compliance.verdict])}>
                    {r.compliance.summary}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                  {r.clients.join(", ") || "—"}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground 2xl:table-cell">
                  {r.nextShift ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nobody matches that search.
          </p>
        )}
      </div>
    </>
  );
}
