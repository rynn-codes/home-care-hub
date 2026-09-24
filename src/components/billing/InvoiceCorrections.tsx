import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ADJUSTMENT_LABELS,
  ADJUSTMENT_MESSAGES,
  REFUND_FEE_NOTE,
  REFUND_KIND_LABELS,
  REFUND_KIND_MEANINGS,
  REFUND_MESSAGES,
  adjustmentRefusals,
  lessMoney,
  reducesInvoice,
  refundRefusals,
  type RefundKind,
} from "@/domain/billing/invoiceActions";

const LABEL = "text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";
const SEGMENT = (on: boolean) =>
  cn("h-[30px] flex-1 rounded-[8px] px-3 text-[12.5px] transition-colors", on ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.10)]" : "text-muted-foreground hover:text-foreground");
const CANCEL = "h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground";
const TEXTAREA = "rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary";

type Money = (n: number | null) => string;

/** A credit or debit on an issued invoice, with the reason the family would read. */
export function AdjustmentDialog({ open, onOpenChange, clientName, invoiceNumber, currentTotal, money, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; clientName: string; invoiceNumber: string; currentTotal: number; money: Money; onSave: (input: { kind: "credit" | "debit"; amount: number; reason: string }) => void }) {
  const [kind, setKind] = useState<"credit" | "debit">("credit");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setKind("credit");
      setAmountText("");
      setReason("");
    }
  }, [open]);
  const amount = Number(amountText) || 0;
  const refusals = adjustmentRefusals({ amount, reason });
  const revised = Math.round((currentTotal + (kind === "debit" ? amount : -amount)) * 100) / 100;
  const tooBig = kind === "credit" && amount > currentTotal;
  const ok = refusals.length === 0 && !tooBig;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle className="text-[17px] tracking-[-.01em]">Add an adjustment</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.5]">
          {clientName} · {invoiceNumber} · currently {money(currentTotal)}
        </DialogDescription>
        <div className="mt-1 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Direction</span>
            <div className="flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Adjustment kind">
              {(["credit", "debit"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={SEGMENT(kind === k)}>
                  {ADJUSTMENT_LABELS[k].split(" — ")[0]}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-muted-foreground">{ADJUSTMENT_LABELS[kind].split(" — ")[1]}</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Amount</span>
            <input type="number" min={0} step="0.01" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Reason</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="4 service hours removed after a caregiver correction" className={TEXTAREA} />
            <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">It goes on the invoice, so write it as the family would read it.</span>
          </label>
          {amount > 0 && (
            <div className="flex items-baseline gap-2.5 rounded-[10px] bg-[var(--wash)] px-3.5 py-2.5">
              <span className="text-[12.5px] text-muted-foreground">Revised total</span>
              <span className="ml-auto text-[15px] font-semibold tabular-nums">{money(revised)}</span>
            </div>
          )}
          {tooBig && (
            <p className="m-0 rounded-[10px] border border-[#FCE8B6] bg-[#FFFCF5] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#7A6320] [text-wrap:pretty]">
              A credit larger than the invoice would owe the family money. That is a refund through Stripe, not a correction to what they owe.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            onSave({ kind, amount, reason: reason.trim() });
            onOpenChange(false);
          }}
          className={cn("mt-4 h-[40px] w-full rounded-[10px] text-[13px] font-medium transition-colors", ok ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
        >
          {tooBig ? "Credit is larger than the invoice" : refusals.length > 0 ? ADJUSTMENT_MESSAGES[refusals[0]] : "Add adjustment"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** Void: it stops counting as owed and keeps its number and history. Typed confirmation, because it is destructive. */
export function VoidDialog({ open, onOpenChange, clientName, invoiceNumber, amount, money, onVoid }: { open: boolean; onOpenChange: (open: boolean) => void; clientName: string; invoiceNumber: string; amount: number; money: Money; onVoid: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (open) {
      setReason("");
      setConfirm("");
    }
  }, [open]);
  const ok = reason.trim().length > 0 && confirm.trim().toUpperCase() === "VOID";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle className="text-[17px] tracking-[-.01em]">Void this invoice</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.55] [text-wrap:pretty]">
          {clientName} · {invoiceNumber} · {money(amount)}. It stops counting as money owed and keeps its number and history, so anyone who rings about it can still be answered.
        </DialogDescription>
        <div className="mt-1 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Why is it being voided?</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Issued to the wrong client" className={TEXTAREA} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Type VOID to confirm</span>
            <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="VOID" className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[#B42318]" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={CANCEL}>
            Keep it
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              onVoid(reason.trim());
              onOpenChange(false);
            }}
            className={cn("ml-auto h-[38px] rounded-[10px] px-4 text-[13px] font-medium transition-colors", ok ? "bg-[#B42318] text-white hover:bg-[#912018]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
          >
            {reason.trim() ? (ok ? "Void invoice" : "Type VOID to confirm") : "Give a reason first"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Money back through Stripe, the way it came. */
export function RefundDialog({ open, onOpenChange, clientName, invoiceNumber, paid, method, invoiceTotal, money, onRefund }: { open: boolean; onOpenChange: (open: boolean) => void; clientName: string; invoiceNumber: string; paid: number; method: string; invoiceTotal: number; money: Money; onRefund: (input: { amount: number; reason: string; kind: RefundKind }) => void }) {
  const [kind, setKind] = useState<RefundKind>("not_delivered");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setKind("not_delivered");
      setAmountText(paid > 0 ? paid.toFixed(2) : "");
      setReason("");
    }
  }, [open, paid]);
  const amount = Number(amountText) || 0;
  const refusals = refundRefusals({ paid, amount, reason });
  const ok = refusals.length === 0;
  const rail = method.split(" · ")[0] || "Stripe";
  const first = clientName.split(" ")[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogTitle className="text-[17px] tracking-[-.01em]">Refund this invoice</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.5]">
          {clientName} · {invoiceNumber} · {money(paid)} collected
        </DialogDescription>
        <div className="mt-1 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Why is it going back?</span>
            <div className="flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Reason for the refund">
              {(["not_delivered", "charged_in_error"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={SEGMENT(kind === k)}>
                  {REFUND_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">{REFUND_KIND_MEANINGS[kind]}</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Amount to send back</span>
            <input type="number" min={0} step="0.01" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Reason</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={kind === "not_delivered" ? "Hospital admission Tuesday — 3 days of the paid week not delivered" : "The card was run twice on Monday"} className={TEXTAREA} />
            <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">{reducesInvoice(kind) ? "It goes on the invoice, so write it as the family would read it." : "It goes on the record beside the refund, so write it as the family would read it."}</span>
          </label>
          {ok && (
            <div className="rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-2.5">
              <span className="flex items-baseline gap-2.5">
                <span className="text-[12.5px] text-[#2B4A7E]">{reducesInvoice(kind) ? `${first} will have paid` : `${first} will still owe`}</span>
                <span className="ml-auto text-[15px] font-semibold tabular-nums text-[#1B3A6B]">{money(reducesInvoice(kind) ? lessMoney(paid, amount) : lessMoney(invoiceTotal, lessMoney(paid, amount)))}</span>
              </span>
              <span className="mt-1 block text-[11.5px] leading-[1.5] text-[#2B4A7E]/85 [text-wrap:pretty]">
                {rail === "ACH" ? "ACH" : rail} refund through Stripe. {REFUND_FEE_NOTE}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={CANCEL}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              onRefund({ amount, reason: reason.trim(), kind });
              onOpenChange(false);
            }}
            className={cn("ml-auto h-[38px] rounded-[10px] px-4 text-[13px] font-medium transition-colors", ok ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
          >
            {ok ? `Refund ${money(amount)}` : REFUND_MESSAGES[refusals[0]]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
