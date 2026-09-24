import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { packetGaps, type LtciEnrollment } from "@/domain/billing/ltci";
import { rateChangeLine, type RateChange } from "@/domain/billing/payerSetup";

export interface PayerRow {
  clientPersonId: string;
  name: string;
  type: string;
  method: string;
  terms: string;
  rate: number | null;
  authorization: string | null;
  billingContact: string | null;
  ltci: LtciEnrollment | null;
}

const NOT_RECORDED = <span className="text-muted-foreground">Not recorded</span>;

/** One payer: how they pay, what the carrier still needs, and the rate's history. */
export function PayerSheet({ open, onOpenChange, payer, rateChanges = [], onEdit }: { open: boolean; onOpenChange: (open: boolean) => void; payer: PayerRow | null; rateChanges?: RateChange[]; onEdit?: () => void }) {
  if (!payer) return null;
  const rows: Array<[string, ReactNode]> = [
    ["Pay type", payer.type],
    ...(payer.ltci ? ([["LTC carrier", payer.ltci.carrier || NOT_RECORDED], ["Policy or claim number", payer.ltci.policyReference || NOT_RECORDED]] as Array<[string, ReactNode]>) : []),
    ["Billing rate", payer.rate === null ? NOT_RECORDED : `$${payer.rate.toFixed(2)} / hr`],
    ["Billing method", payer.method],
    ["Billing contact", payer.billingContact ?? NOT_RECORDED],
    ["Authorization", payer.authorization ?? NOT_RECORDED],
    ["Terms", payer.terms],
  ];
  const missing = payer.ltci ? packetGaps(payer.ltci) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-[440px]">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="text-[17px] tracking-[-.01em]">{payer.name}</SheetTitle>
          <SheetDescription className="text-[12.5px]">{payer.type}</SheetDescription>
        </SheetHeader>
        <div className="mt-3.5 flex flex-col">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
              <span className="w-[146px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
              <span className="text-[13px] [text-wrap:pretty]">{value}</span>
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <div className="mt-4 rounded-[14px] border border-[#CFE0FF] bg-[#F5F9FF] p-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-[1px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white" aria-hidden="true">
                i
              </span>
              <h3 className="m-0 max-w-[210px] text-[13px] font-semibold leading-[1.35] text-foreground [text-wrap:pretty]">Before a reimbursement packet can go out</h3>
              <span className="ml-auto flex-none whitespace-nowrap text-[12px] text-[#2B4A7E]">
                {missing.length} {missing.length === 1 ? "item" : "items"} missing
              </span>
            </div>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {missing.map((m) => (
                <li key={m} className="flex items-start gap-2.5">
                  <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-[12.5px] leading-[1.45] text-[var(--ink-body)] [text-wrap:pretty]">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Rate history</h3>
        <div className="flex flex-col">
          {rateChanges.length === 0 ? (
            <div className="flex items-baseline gap-3 py-2">
              <span className="w-[96px] flex-none text-[11.5px] text-muted-foreground">On file</span>
              <span className="text-[12.5px] [text-wrap:pretty]">{payer.rate === null ? "No rate agreed yet" : `Rate is $${payer.rate.toFixed(2)} / hr · no changes recorded`}</span>
            </div>
          ) : (
            rateChanges.map((c) => (
              <div key={c.id} className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                <span className="w-[96px] flex-none text-[11.5px] text-muted-foreground">{new Date(`${c.effectiveFrom}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="text-[12.5px] [text-wrap:pretty]">{rateChangeLine(c)}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {onEdit && (
            <button type="button" onClick={onEdit} className="h-[38px] flex-none rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
              Edit payer setup
            </button>
          )}
          <Link to={`/clients/${payer.clientPersonId}`} className="ml-auto flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
            Open the client record
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
