import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { HouseholdBilling } from "@/domain/billing/households";
import { PAYER_SETUP_MESSAGES, PAY_TYPES, payerSetupRefusals, type PayType, type PayerEdit } from "@/domain/billing/payerSetup";

const LABEL = "text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";
const SEGMENT = (on: boolean) =>
  cn("h-[30px] flex-1 rounded-[8px] px-3 text-[12.5px] transition-colors", on ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.10)]" : "text-muted-foreground hover:text-foreground");

/**
 * Pay type, rate, method and household — with the rate change dated from
 * the next billing week and its reason on the record.
 */
export function PayerSetupDialog({
  open,
  onOpenChange,
  clientName,
  effectiveLabel,
  current,
  householdCandidates,
  household,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  effectiveFrom: string;
  effectiveLabel: string;
  current: { rate: number | null; method: "ach" | "card" | null; type: string };
  householdCandidates: Array<{ clientPersonId: string; name: string; sharesVisits: boolean }>;
  household: { partnerPersonId: string; partnerName: string; billing: HouseholdBilling } | null;
  onSave: (input: { patch: PayerEdit; rate: number; reason: string; household: { partnerPersonId: string | null; billing: HouseholdBilling } }) => void;
}) {
  const [rateText, setRateText] = useState("");
  const [method, setMethod] = useState<"ach" | "card" | null>(null);
  const [type, setType] = useState<PayType | string>(PAY_TYPES[0]);
  const [reason, setReason] = useState("");
  const [partner, setPartner] = useState("");
  const [billing, setBilling] = useState<HouseholdBilling>("combined");

  useEffect(() => {
    if (!open) return;
    setPartner(household?.partnerPersonId ?? "");
    setBilling(household?.billing ?? "combined");
    setRateText(current.rate === null ? "" : current.rate.toFixed(2));
    setMethod(current.method);
    setType(current.type);
    setReason("");
  }, [open, current.rate, current.method, current.type, household]);

  const rate = Number(rateText) || 0;
  const rateMoved = rate > 0 && rate !== current.rate;
  const householdMoved = partner !== (household?.partnerPersonId ?? "") || billing !== (household?.billing ?? "combined");
  const changed = rateMoved || method !== current.method || type !== current.type || householdMoved;
  const refusals = payerSetupRefusals({ rate, method, currentRate: current.rate, reason, changed });
  const ok = refusals.length === 0;
  const chosen = householdCandidates.find((c) => c.clientPersonId === partner);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle className="text-[17px] tracking-[-.01em]">Payer setup</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.5]">{clientName}</DialogDescription>
        <div className="mt-1 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Pay type</span>
            <div className="flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Pay type">
              {PAY_TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn(SEGMENT(type === t), "px-2")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className={LABEL}>Billing rate</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  value={rateText}
                  onChange={(e) => setRateText(e.target.value)}
                  placeholder="0.00"
                  aria-label="Billing rate per hour"
                  className="h-[38px] w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] pl-6 pr-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary"
                />
              </span>
            </label>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className={LABEL}>Billing method</span>
              <div className="flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Billing method">
                {(["ach", "card"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={SEGMENT(method === m)}>
                    {m === "ach" ? "ACH" : "Card"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Household</span>
            <select value={partner} aria-label="Paired with" onChange={(e) => setPartner(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary">
              <option value="">Not in a household</option>
              {householdCandidates.map((c) => (
                <option key={c.clientPersonId} value={c.clientPersonId}>
                  Paired with {c.name}
                </option>
              ))}
            </select>
            {partner && !(chosen?.sharesVisits ?? false) && (
              <p className="m-0 rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#2B4A7E] [text-wrap:pretty]">
                No caregiver currently visits them both at once, so their care is invoiced separately. Billing together is for a shared visit — one caregiver, one hour, two people.
              </p>
            )}
            {partner && (chosen?.sharesVisits ?? false) && (
              <>
                <div className="mt-0.5 flex gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="How the household is billed">
                  {(["combined", "separate"] as const).map((b) => (
                    <button key={b} type="button" role="radio" aria-checked={billing === b} onClick={() => setBilling(b)} className={SEGMENT(billing === b)}>
                      {b === "combined" ? "Bill together" : "Invoice separately"}
                    </button>
                  ))}
                </div>
                <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">
                  {billing === "combined"
                    ? `One invoice for the visit. ${clientName} carries it; the other chart records the care and produces no charge.`
                    : "Each of them holds an invoice in their own name — which is what a reimbursement claim asks a policy to accept."}
                </span>
              </>
            )}
          </div>
          {rateMoved && (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Why is the rate changing?</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Annual rate review"
                className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
              />
            </label>
          )}
          {rateMoved && (
            <div className="rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-2.5">
              <span className="flex items-baseline gap-2.5">
                <span className="text-[12.5px] text-[#2B4A7E]">From {effectiveLabel}</span>
                <span className="ml-auto text-[13px] font-semibold tabular-nums text-[#1B3A6B]">
                  ${(current.rate ?? 0).toFixed(2)} → ${rate.toFixed(2)}
                </span>
              </span>
              <span className="mt-1 block text-[11.5px] leading-[1.5] text-[#2B4A7E]/85 [text-wrap:pretty]">Never mid-week — an invoice is priced from the rate in force when the care was given.</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={() => {
              onSave({
                patch: { ...(method ? { paymentMethod: method } : {}), payer: type },
                rate,
                reason: reason.trim(),
                household: { partnerPersonId: partner || null, billing: partner && chosen?.sharesVisits ? billing : "separate" },
              });
              onOpenChange(false);
            }}
            className={cn("ml-auto h-[38px] rounded-[10px] px-4 text-[13px] font-medium transition-colors", ok ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
          >
            {ok ? "Save payer setup" : PAYER_SETUP_MESSAGES[refusals[0]]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
