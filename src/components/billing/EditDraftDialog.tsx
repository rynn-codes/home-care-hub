import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { HouseholdBilling } from "@/domain/billing/households";
import {
  CHARGE_TYPES,
  DRAFT_EDIT_MESSAGES,
  draftEditRefusals,
  draftSubtotal,
  newChargeId,
  processingFee,
  reasonQuestion,
  regularCareLabel,
  type DraftCharge,
  type DraftEdit,
} from "@/domain/billing/manualInvoice";

const LABEL = "text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";
const SEGMENT = (on: boolean) =>
  cn("h-[30px] flex-1 rounded-[8px] px-3 text-[12.5px] transition-colors", on ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.10)]" : "text-muted-foreground hover:text-foreground");

/**
 * Change a draft before it goes: hours, rate, extra charges, method. A
 * difference from the agreement needs a reason, because the family will
 * ask. The caregiver is still paid for the shifts she worked.
 */
export function EditDraftDialog({
  open,
  onOpenChange,
  clientName,
  periodLabel,
  scheduledHours,
  agreedRate,
  current,
  accountMethod,
  payerType,
  household,
  onHouseholdBilling,
  money,
  onSave,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  periodLabel: string;
  scheduledHours: number;
  agreedRate: number | null;
  current: DraftEdit | null;
  accountMethod: "ach" | "card";
  payerType: string;
  household: { partnerName: string; billing: HouseholdBilling } | null;
  onHouseholdBilling?: (billing: HouseholdBilling) => void;
  money: (n: number | null) => string;
  onSave: (input: { hours: number; rate: number | null; reason: string; charges: DraftCharge[]; method: "ach" | "card" }) => void;
  onPreview: (input: { hours: number; rate: number | null; charges: DraftCharge[]; method: "ach" | "card" }) => void;
}) {
  const [hoursText, setHoursText] = useState("");
  const [rateText, setRateText] = useState("");
  const [reason, setReason] = useState("");
  const [charges, setCharges] = useState<DraftCharge[]>([]);
  const [method, setMethod] = useState<"ach" | "card">("ach");

  useEffect(() => {
    if (!open) return;
    setHoursText(String(current?.hours ?? scheduledHours));
    setRateText(current?.rate !== undefined ? current.rate.toFixed(2) : agreedRate === null ? "" : agreedRate.toFixed(2));
    setReason(current?.reason ?? "");
    setCharges(current?.charges ?? []);
    setMethod(current?.method ?? accountMethod);
  }, [open, current, scheduledHours, agreedRate, accountMethod]);

  const hours = Number(hoursText) || 0;
  const rate = rateText === "" ? null : Number(rateText) || 0;
  const hoursMoved = hours !== scheduledHours;
  const rateMoved = agreedRate !== null && rate !== null && rate !== agreedRate;
  const changed = hoursMoved || rateMoved || charges.length > 0 || (current?.charges?.length ?? 0) > 0 || !!current?.hours || current?.rate !== undefined || method !== (current?.method ?? accountMethod);
  const refusals = draftEditRefusals({ hours, scheduledHours, rate, agreedRate, reason, charges, changed });
  const ok = refusals.length === 0;
  const subtotal = draftSubtotal({ hours, rate, charges });
  const fee = subtotal === null ? 0 : processingFee({ subtotal, method });
  const total = subtotal === null ? null : Math.round((subtotal + fee) * 100) / 100;
  const patch = (id: string, change: Partial<DraftCharge>) => setCharges((cs) => cs.map((c) => (c.id === id ? { ...c, ...change } : c)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-[520px] overflow-y-auto">
        <DialogTitle className="text-[17px] tracking-[-.01em]">Edit invoice</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.5]">Change this draft before it goes out.</DialogDescription>
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[10px] bg-[var(--wash)] px-3.5 py-3">
          <span className="flex flex-col gap-[2px]">
            <span className={LABEL}>Client</span>
            <span className="text-[12.5px]">{clientName}</span>
          </span>
          <span className="flex flex-col gap-[2px]">
            <span className={LABEL}>Service period</span>
            <span className="text-[12.5px]">{periodLabel}</span>
          </span>
          <span className="flex flex-col gap-[2px]">
            <span className={LABEL}>Pay type</span>
            <span className="text-[12.5px] [text-wrap:pretty]">{payerType}</span>
          </span>
          <span className="flex flex-col gap-1">
            <span className={LABEL}>Pay by</span>
            <span className="flex w-fit gap-1 rounded-[8px] bg-[var(--paper)] p-[3px]" role="radiogroup" aria-label="Payment method for this invoice">
              {(["ach", "card"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn("h-[24px] rounded-[6px] px-2.5 text-[12px] transition-colors", method === m ? "bg-[#EEF0FE] font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {m === "ach" ? "ACH" : "Card"}
                </button>
              ))}
            </span>
          </span>
        </div>
        {household && (
          <>
            <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">Shared visits with {household.partnerName}</h3>
            <div className="flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="How the household is billed">
              {(["combined", "separate"] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={household.billing === b} onClick={() => onHouseholdBilling?.(b)} className={SEGMENT(household.billing === b)}>
                  {b === "combined" ? "Bill together" : "Invoice separately"}
                </button>
              ))}
            </div>
            <span className="mt-1 text-[11.5px] text-muted-foreground [text-wrap:pretty]">
              {household.billing === "combined" ? `One invoice for the visit — ${household.partnerName}'s chart records the care and produces no charge.` : "Each of them holds an invoice in their own name."} This is the household's setting, so it changes both.
            </span>
          </>
        )}
        <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">What is being billed?</h3>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">Billable hours</span>
            <input type="number" min={0} step="0.25" value={hoursText} onChange={(e) => setHoursText(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary" />
            <span className="text-[11.5px] text-muted-foreground">{scheduledHours} hrs scheduled</span>
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">Rate</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step="0.25"
                value={rateText}
                onChange={(e) => setRateText(e.target.value)}
                placeholder={agreedRate === null ? "No rate agreed" : "0.00"}
                aria-label="Rate per hour on this invoice"
                className="h-[38px] w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] pl-6 pr-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary"
              />
            </span>
            <span className={cn("text-[11.5px]", rateMoved ? "text-[#B54708]" : "text-muted-foreground")}>{agreedRate === null ? "None agreed" : `${money(agreedRate)} / hr agreed`}</span>
          </label>
        </div>
        {(hoursMoved || rateMoved) && (
          <label className="mt-3.5 flex flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">{reasonQuestion({ hoursMoved, rateMoved })}</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={rateMoved && !hoursMoved ? "Agreed reduction for this week" : "Hospital admission from Wednesday"}
              className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
            />
            <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">The caregiver is still paid for the shifts she worked. This changes the invoice only.</span>
          </label>
        )}
        <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">Charges</h3>
        <div className="flex flex-col gap-2">
          {charges.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <select value={c.type} aria-label="Charge type" onChange={(e) => patch(c.id, { type: e.target.value })} className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2 text-[12.5px] outline-none focus:border-primary">
                {CHARGE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={c.description}
                aria-label="Charge description"
                placeholder="What it was for"
                onChange={(e) => patch(c.id, { description: e.target.value })}
                className="h-[34px] min-w-[140px] flex-1 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={c.amount || ""}
                aria-label="Charge amount"
                placeholder="0.00"
                onChange={(e) => patch(c.id, { amount: Number(e.target.value) || 0 })}
                className="h-[34px] w-[92px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] tabular-nums outline-none focus:border-primary"
              />
              <button type="button" aria-label="Remove this charge" onClick={() => setCharges((cs) => cs.filter((x) => x.id !== c.id))} className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCharges((cs) => [...cs, { id: newChargeId(), type: CHARGE_TYPES[1].key, description: "", amount: 0 }])}
            className="flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--hairline)] text-[12.5px] text-primary transition-colors hover:bg-[var(--wash)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {charges.length ? "Add another charge" : "Add a charge"}
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-1.5 rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-3">
          <span className="flex items-baseline gap-2.5">
            <span className="text-[12.5px] text-[#2B4A7E]">
              {regularCareLabel({ hours, scheduledHours })}
              {rate !== null && ` · ${hours} hrs × ${money(rate)}`}
            </span>
            <span className="ml-auto text-[12.5px] tabular-nums text-[#1B3A6B]">{money(rate === null ? null : Math.round(hours * rate * 100) / 100)}</span>
          </span>
          {charges.map((c) => (
            <span key={c.id} className="flex items-baseline gap-2.5">
              <span className="text-[12.5px] text-[#2B4A7E]">{c.description || "New charge"}</span>
              <span className="ml-auto text-[12.5px] tabular-nums text-[#1B3A6B]">{money(c.amount)}</span>
            </span>
          ))}
          {fee > 0 && (
            <span className="flex items-baseline gap-2.5">
              <span className="text-[12.5px] text-[#2B4A7E]">{method === "card" ? "Card processing fee · 2.9%" : "ACH processing fee"}</span>
              <span className="ml-auto text-[12.5px] tabular-nums text-[#1B3A6B]">{money(fee)}</span>
            </span>
          )}
          <span className="flex items-baseline gap-2.5 border-t border-[#CFE0FF] pt-1.5">
            <span className="text-[12.5px] font-medium text-[#1B3A6B]">Total</span>
            <span className="ml-auto text-[15px] font-semibold tabular-nums text-[#1B3A6B]">{money(total)}</span>
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onPreview({ hours, rate, charges, method })} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            Preview invoice
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              onSave({ hours, rate, reason: reason.trim(), charges, method });
              onOpenChange(false);
            }}
            className={cn("ml-auto h-[38px] rounded-[10px] px-4 text-[13px] font-medium transition-colors", ok ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
          >
            {ok ? "Save draft" : DRAFT_EDIT_MESSAGES[refusals[0]]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
