import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientRecord, ClientStatus } from "@/domain/clients/roster";

/**
 * The directory table from the approved Clients mock, to its own values:
 * uppercase hairline headers, 30px indigo-soft avatars, quiet 13px rows.
 * Last activity is dropped — it is the least actionable column and the
 * record's Activity tab carries it in full.
 *
 * The status strip on the left is the same control Employees has: one
 * segment per status with its count, "All" at the end. A search that finds
 * people outside the current segment says so rather than hiding them.
 */

/**
 * Karynn, 21 August: "We are all private pay. We allow long term care
 * insurance, but only for them to reimburse the client once they have paid
 * us." So the payer is one of exactly two values (README business rule #1):
 * Private Pay, or Private Pay + LTC Insurance when a policy is in play.
 *
 * This map used to colour-code Medicaid STAR+PLUS, LTC Insurance (standalone),
 * VA Community Care and Medicare. None of them are payers Joy bills, so they
 * are gone rather than left as dead keys — a UI that has a colour ready for
 * Medicaid is a UI quietly asserting that Joy takes Medicaid.
 */
const PAYER_TONE: Record<string, string> = {
  "Private Pay": "text-primary bg-[#EEF0FE]",
  "Private Pay + LTC Insurance": "text-[#B54708] bg-[#FFFAEB]",
};

const STATUS_DOT: Record<ClientStatus, string> = {
  active: "bg-[#12B76A]",
  on_hold: "bg-[#F79009]",
  inactive: "bg-[#98A2B3]",
  discharged: "bg-[#D0D5DD]",
};

export type ClientStatusFilter = ClientStatus | "all";

const STATUS_FILTERS: Array<{ value: ClientStatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "inactive", label: "Inactive" },
  { value: "discharged", label: "Discharged" },
  { value: "all", label: "All" },
];

interface Props {
  clients: ClientRecord[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (personId: string) => void;
  onAdd: () => void;
  status: ClientStatusFilter;
  onStatusChange: (status: ClientStatusFilter) => void;
  counts: Record<ClientStatusFilter, number>;
  /** Search hits outside the current status segment. */
  hiddenBySearch: number;
}

export function ClientDirectory({
  clients,
  query,
  onQueryChange,
  onOpen,
  onAdd,
  status,
  onStatusChange,
  counts,
  hiddenBySearch,
}: Props) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className="flex flex-wrap gap-0.5 rounded-[10px] bg-[var(--paper-sunken)] p-[3px]"
          role="group"
          aria-label="Filter clients by status"
        >
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
              id="client-search"
              type="search"
              aria-label="Search clients"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search clients"
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
          >
            <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
            Add client
          </button>
        </div>
      </div>

      {hiddenBySearch > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {hiddenBySearch === 1
            ? "One more client matches, outside this filter."
            : `${hiddenBySearch} more clients match, outside this filter.`}{" "}
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Search all clients
          </button>
        </p>
      )}

      <div className="overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <caption className="sr-only">Client directory</caption>
            <thead>
              <tr>
                {["Client", "Status", "Location", "Payer", "Services", "Primary caregiver", "Next visit"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.personId}
                  onClick={() => onOpen(c.personId)}
                  className="cursor-pointer border-t border-[var(--hairline-soft)] hover:bg-[var(--wash)]"
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(c.personId)} className="flex items-center gap-2.5 text-left">
                      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                        {c.initials}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="whitespace-nowrap text-[13px] font-medium">{c.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {c.age === null ? "Age not recorded" : `${c.age} yrs`}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[var(--ink-body)]">
                      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATUS_DOT[c.status])} aria-hidden="true" />
                      {c.statusLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{c.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        PAYER_TONE[c.payer] ?? "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                      )}
                    >
                      {c.payer}
                    </span>
                  </td>
                  <td className="max-w-[13rem] px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                    {c.services.join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                    {c.caregiver ?? "Unassigned"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{c.nextVisit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {clients.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "No client matches that search."
              : status === "all"
                ? "No clients yet."
                : `No clients are ${STATUS_FILTERS.find((f) => f.value === status)?.label.toLowerCase()}.`}
          </p>
        )}
      </div>
    </>
  );
}
