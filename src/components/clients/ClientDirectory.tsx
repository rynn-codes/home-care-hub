import { Plus, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientRecord } from "@/domain/clients/roster";

/**
 * The directory table from the approved Clients mock, to its own values:
 * uppercase hairline headers, 30px indigo-soft avatars, quiet 13px rows.
 * Last activity is dropped — it is the least actionable column and the
 * record's Activity tab carries it in full.
 *
 * One addition — a row whose paperwork has lapsed carries a warning beside
 * the name, and the ordering puts those rows first. The mock's directory is
 * in no particular order, which is fine at six clients and hides the one
 * lapsed authorization at sixty.
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
 * Medicaid is a UI quietly asserting that Joy takes Medicaid. LTC-insurance
 * amber (#B54708 on #FFFAEB) meets contrast; the mock's paler #12B76A/#ECFDF3
 * greens do not, which is why they are not reused here.
 */
const PAYER_TONE: Record<string, string> = {
  "Private Pay": "text-primary bg-[#EEF0FE]",
  "Private Pay + LTC Insurance": "text-[#B54708] bg-[#FFFAEB]",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-[#12B76A]",
  on_hold: "bg-[#F79009]",
  discharged: "bg-[#D0D5DD]",
};

interface Props {
  clients: ClientRecord[];
  query: string;
  onQueryChange: (q: string) => void;
  onOpen: (personId: string) => void;
  onAdd: () => void;
}

export function ClientDirectory({ clients, query, onQueryChange, onOpen, onAdd }: Props) {
  const attention = clients.filter((c) => c.needsAttention.length > 0).length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex h-[34px] w-full items-center gap-2 rounded-[9px] border border-[#ECECF1] bg-white px-2.5 sm:w-[212px]">
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
          disabled
          title="Filters are not built yet"
          className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-muted-foreground/50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filter
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
        >
          <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
          Add client
        </button>
      </div>

      {attention > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 text-[#F79009]" aria-hidden="true" />
          {attention === 1
            ? "One client has paperwork that has lapsed or was never signed."
            : `${attention} clients have paperwork that has lapsed or was never signed.`}
        </p>
      )}

      <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <caption className="sr-only">
              Client directory, ordered so clients needing attention appear first
            </caption>
            <thead>
              <tr>
                {["Client", "Status", "Location", "Payer", "Services", "Primary caregiver", "Next visit"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.personId}
                  onClick={() => onOpen(c.personId)}
                  className="cursor-pointer border-t border-[#F3F3F6] hover:bg-[#FAFAFB]"
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onOpen(c.personId)} className="flex items-center gap-2.5 text-left">
                      <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                        {c.initials}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
                          {c.name}
                          {c.needsAttention.length > 0 && (
                            <TriangleAlert className="h-3.5 w-3.5 text-[#F79009]" aria-label="Paperwork needs attention" />
                          )}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground">
                          {c.age === null ? "Age not recorded" : `${c.age} yrs`}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[#5B6274]">
                      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATUS_DOT[c.status])} aria-hidden="true" />
                      {c.statusLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">{c.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        PAYER_TONE[c.payer] ?? "bg-[#F3F3F6] text-[#5B6274]",
                      )}
                    >
                      {c.payer}
                    </span>
                  </td>
                  <td className="max-w-[13rem] px-4 py-3 text-[12.5px] text-[#5B6274]">
                    {c.services.join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                    {c.caregiver ?? "Unassigned"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">{c.nextVisit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {clients.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No client matches that search.
          </p>
        )}
      </div>
    </>
  );
}
