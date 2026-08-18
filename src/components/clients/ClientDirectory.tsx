import { Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientRecord } from "@/domain/clients/roster";

/**
 * The directory table from the approved Clients mockup: client, status,
 * location, payer, services, primary caregiver and next visit. Last activity
 * is dropped — it is the least actionable column and the record's Activity tab
 * carries it in full.
 *
 * One addition — a row whose paperwork has lapsed carries a warning beside the
 * name, and the ordering puts those rows first. The mockup's directory is in no
 * particular order, which is fine at six clients and hides the one lapsed
 * authorization at sixty.
 */

const PAYER_TONE: Record<string, string> = {
  "Private Pay": "text-primary bg-primary-soft",
  "Medicaid · STAR+PLUS": "text-[#0E9384] bg-[#ECFDF7]",
  "LTC Insurance": "text-[#B54708] bg-[#FFFAEB]",
  "VA Community Care": "text-muted-foreground bg-surface-muted",
  Medicare: "text-muted-foreground bg-surface-muted",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-[hsl(var(--success))]",
  on_hold: "bg-[hsl(var(--warning))]",
  discharged: "bg-border",
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="client-search"
            aria-label="Search clients"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search clients…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" onClick={onAdd}>
            Add client
          </Button>
        </div>
      </div>

      {attention > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
          {attention === 1
            ? "One client has paperwork that has lapsed or was never signed."
            : `${attention} clients have paperwork that has lapsed or was never signed.`}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">
            Client directory, ordered so clients needing attention appear first
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Client</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-3 font-medium md:table-cell">Location</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Payer</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-3 font-medium 2xl:table-cell">Services</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Primary caregiver</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Next visit</th>
                          </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.personId} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(c.personId)}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {c.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 whitespace-nowrap font-medium">
                        {c.name}
                        {c.needsAttention.length > 0 && (
                          <TriangleAlert
                            className="h-3.5 w-3.5 text-[hsl(var(--warning))]"
                            aria-label="Paperwork needs attention"
                          />
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.age === null ? "Age not recorded" : `${c.age} yrs`}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[c.status])} aria-hidden="true" />
                    {c.statusLabel}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">{c.location}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                      PAYER_TONE[c.payer] ?? "bg-surface-muted text-muted-foreground",
                    )}
                  >
                    {c.payer}
                  </span>
                </td>
                <td className="hidden max-w-[13rem] px-4 py-3 text-muted-foreground 2xl:table-cell">{c.services.join(", ") || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.caregiver ?? "Unassigned"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{c.nextVisit ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No client matches that search.
          </p>
        )}
      </div>
    </>
  );
}
