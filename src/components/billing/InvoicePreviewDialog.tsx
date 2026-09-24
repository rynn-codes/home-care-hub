import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** The invoice as the family will see it. */
export function InvoicePreviewDialog({
  open,
  onOpenChange,
  agencyName,
  clientName,
  periodLabel,
  invoiceNumber,
  issuedOn,
  dueLabel,
  method,
  lines,
  total,
  money,
  position = null,
  onPrev,
  onNext,
  status = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyName: string;
  clientName: string;
  periodLabel: string;
  invoiceNumber: string | null;
  issuedOn: string | null;
  dueLabel: string;
  method: string;
  lines: Array<{ description: string; detail: string | null; amount: number | null }>;
  total: number | null;
  money: (n: number | null) => string;
  position?: { index: number; total: number } | null;
  onPrev?: () => void;
  onNext?: () => void;
  status?: string | null;
}) {
  const payable = method.split(" · ")[0].toLowerCase() === "card" ? "card" : "bank transfer";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[520px] overflow-y-auto pt-11">
        <DialogTitle className="sr-only">Invoice preview for {clientName}</DialogTitle>
        <DialogDescription className="sr-only">The invoice as the family will see it, for {periodLabel}</DialogDescription>
        {position && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[13px] font-medium">
              Invoice {position.index + 1} of {position.total}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--wash-strong)]" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${((position.index + 1) / position.total) * 100}%` }} />
            </span>
            {status && <span className="rounded-full bg-[var(--wash-strong)] px-2 py-[2px] text-[11px] font-medium text-[var(--ink-body)]">{status}</span>}
          </div>
        )}
        <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
          <div className="flex items-start gap-4">
            <span className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold tracking-[-.01em]">{agencyName}</span>
              <span className="text-[11.5px] text-muted-foreground">Houston, Texas</span>
            </span>
            <span className="ml-auto flex flex-col items-end gap-[3px]">
              <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Invoice</span>
              <span className="text-[13px] font-medium tabular-nums">{invoiceNumber ?? "DRAFT"}</span>
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
            {(
              [
                ["Billed to", clientName],
                ["Service period", periodLabel],
                [issuedOn ? "Issued" : "Prepared", issuedOn ?? "Not Sent Yet"],
                ["Payment due", dueLabel],
              ] as const
            ).map(([label, value]) => (
              <span key={label} className="flex flex-col gap-[2px]">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
                <span className="text-[12.5px]">{value}</span>
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-col border-t border-[var(--hairline)] pt-1">
            {lines.map((l, i) => (
              <span key={`${l.description}-${i}`} className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
                <span className="flex min-w-0 flex-col gap-[2px]">
                  <span className="text-[13px] [text-wrap:pretty]">{l.description}</span>
                  {l.detail && <span className="text-[11.5px] text-muted-foreground">{l.detail}</span>}
                </span>
                <span className="ml-auto flex-none text-[12.5px] tabular-nums">{money(l.amount)}</span>
              </span>
            ))}
            <span className="flex items-baseline gap-3 border-t border-[var(--hairline)] pt-3">
              <span className="text-[13px] font-semibold">Total due</span>
              <span className="ml-auto text-[17px] font-semibold tabular-nums">{money(total)}</span>
            </span>
          </div>
          <p className="m-0 mt-5 border-t border-[var(--hairline)] pt-3 text-[11.5px] leading-[1.55] text-muted-foreground [text-wrap:pretty]">
            Payable by {payable} through Stripe. Questions about this invoice are answered by the Joy Health office.
          </p>
        </div>
        {invoiceNumber === null && (
          <p className="m-0 mt-3 text-[11.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">This is a draft. It has no invoice number until it is sent, and nothing has gone to the family yet.</p>
        )}
        {position ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onPrev} disabled={!onPrev} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground disabled:opacity-40">
              Previous
            </button>
            <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
              Close
            </button>
            {onNext ? (
              <button type="button" onClick={onNext} className="h-[38px] rounded-[10px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                Next invoice
              </button>
            ) : (
              <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
                Done
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => onOpenChange(false)} className="mt-3 h-[38px] w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            Close preview
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
