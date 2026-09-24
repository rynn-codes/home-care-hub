import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FIRST_PAYMENT_MESSAGES, firstPaymentLines, firstPaymentRefusals, oneWeekOfCare, weekOf } from "@/domain/billing/manualInvoice";

const LABEL = "text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";

export interface FirstPaymentClient {
  clientPersonId: string;
  name: string;
  rate: number | null;
  weeklyHours: number | null;
  payerType: string;
  method: "ach" | "card";
  alreadyIssued: boolean;
}

export interface FirstPaymentDraft {
  clientPersonId: string;
  deposit: number;
  depositReason: string;
  chargeTechnologyFee: boolean;
  method: "ach" | "card";
  startsOn: string;
  dueOn: string;
  weekLabel: string;
  lines: Array<{ description: string; amount: number }>;
  total: number;
}

/**
 * Deposit, technology fee and the first week of care — before service
 * starts. The deposit is one week of care unless somebody says why not.
 */
export function FirstPaymentDialog({
  open,
  onOpenChange,
  clients,
  today,
  money,
  onOrdinaryCharge,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: FirstPaymentClient[];
  today: string;
  money: (n: number | null) => string;
  onOrdinaryCharge?: () => void;
  onSave: (draft: FirstPaymentDraft) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [depositText, setDepositText] = useState("");
  const [depositReason, setDepositReason] = useState("");
  const [method, setMethod] = useState<"ach" | "card">("ach");
  const [startsOn, setStartsOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const client = clients.find((c) => c.clientPersonId === clientId) ?? null;
  const suggested = client ? oneWeekOfCare({ weeklyHours: client.weeklyHours, rate: client.rate }) : null;

  useEffect(() => {
    if (!open) return;
    setClientId("");
    setDepositText("");
    setDepositReason("");
    setStartsOn("");
    setDueOn(today);
  }, [open, today]);
  useEffect(() => {
    if (!client) return;
    const week = oneWeekOfCare({ weeklyHours: client.weeklyHours, rate: client.rate });
    setDepositText(week === null ? "" : week.toFixed(2));
    setDepositReason("");
    setMethod(client.method);
  }, [client]);

  const deposit = depositText === "" ? 0 : Number(depositText) || 0;
  const week = startsOn ? weekOf(startsOn) : { label: "the first week" };
  const priced = firstPaymentLines({ weeklyHours: client?.weeklyHours ?? null, rate: client?.rate ?? null, deposit, chargeTechnologyFee: !client?.alreadyIssued, method, weekLabel: week.label });
  const refusals = firstPaymentRefusals({ hasClient: !!client, rate: client?.rate ?? null, weeklyHours: client?.weeklyHours ?? null, deposit, suggested, depositReason, startsOn, dueOn, alreadyIssued: client?.alreadyIssued ?? false });
  const ok = refusals.length === 0;
  const depositMoved = suggested !== null && Math.abs(deposit - suggested) > 5e-3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-[520px] overflow-y-auto">
        <DialogTitle className="text-[17px] tracking-[-.01em]">First-time payment</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-[1.5]">Deposit, technology fee and the first week of care — before service starts.</DialogDescription>
        <h3 className="mb-1.5 mt-3 text-[12.5px] font-medium">What are you billing?</h3>
        <div className="flex w-fit flex-wrap gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Charge shape">
          {(["single", "period", "first"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={shape === "first"}
              onClick={() => shape !== "first" && onOrdinaryCharge?.()}
              className={cn("h-[30px] rounded-[8px] px-3 text-[12.5px] transition-colors", shape === "first" ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.10)]" : "text-muted-foreground hover:text-foreground")}
            >
              {shape === "single" ? "Single date" : shape === "period" ? "Service period" : "First-time payment"}
            </button>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">
            Client <span className="text-[#B42318]">*</span>
          </span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary">
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.clientPersonId} value={c.clientPersonId}>
                {c.name}
                {c.alreadyIssued ? " · already invoiced" : ""}
              </option>
            ))}
          </select>
        </label>
        {client && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[10px] bg-[var(--wash)] px-3.5 py-3">
            <span className="flex flex-col gap-[2px]">
              <span className={LABEL}>Rate on file</span>
              <span className="text-[12.5px]">{client.rate === null ? "Not recorded" : `${money(client.rate)} / hr`}</span>
            </span>
            <span className="flex flex-col gap-[2px]">
              <span className={LABEL}>Agreed hours</span>
              <span className="text-[12.5px]">{client.weeklyHours === null ? "Not recorded" : `${client.weeklyHours} / week`}</span>
            </span>
            <span className="flex flex-col gap-[2px]">
              <span className={LABEL}>Pay type</span>
              <span className="text-[12.5px] [text-wrap:pretty]">{client.payerType}</span>
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
        )}
        <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">When does care start?</h3>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">First day of care</span>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">Payment due</span>
            <input type="date" value={dueOn} max={startsOn || undefined} onChange={(e) => setDueOn(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary" />
            <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">Usually at signing. It has to clear before the first shift.</span>
          </label>
        </div>
        <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">Deposit</h3>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-muted-foreground">Amount to hold</span>
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={depositText}
              onChange={(e) => setDepositText(e.target.value)}
              placeholder="0.00"
              aria-label="Deposit amount"
              className="h-[38px] w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] pl-6 pr-3 text-[13px] tabular-nums outline-none transition-colors focus:border-primary"
            />
          </span>
          <span className={cn("text-[11.5px]", depositMoved ? "text-[#B54708]" : "text-muted-foreground")}>{suggested === null ? "One week of care, once the rate and hours are on file" : `${money(suggested)} is one week of care`}</span>
        </label>
        {depositMoved && (
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-[11.5px] text-muted-foreground">Why is the deposit not one week of care?</span>
            <input
              type="text"
              value={depositReason}
              onChange={(e) => setDepositReason(e.target.value)}
              placeholder="Continuous care — a full week upfront is not workable"
              className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
            />
          </label>
        )}
        {client && (
          <div className="mt-4 flex flex-col gap-1.5 rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-3">
            {priced.lines.map((l) => (
              <span key={l.key} className="flex items-baseline gap-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[12.5px] text-[#2B4A7E]">{l.description}</span>
                  {l.detail && <span className="text-[11px] text-[#2B4A7E]/75 [text-wrap:pretty]">{l.detail}</span>}
                </span>
                <span className="ml-auto flex-none text-[12.5px] tabular-nums text-[#1B3A6B]">{money(l.amount)}</span>
              </span>
            ))}
            {priced.fee > 0 && (
              <span className="flex items-baseline gap-2.5">
                <span className="text-[12.5px] text-[#2B4A7E]">{method === "card" ? "Card processing fee · 2.9%" : "ACH processing fee"}</span>
                <span className="ml-auto text-[12.5px] tabular-nums text-[#1B3A6B]">{money(priced.fee)}</span>
              </span>
            )}
            <span className="flex items-baseline gap-2.5 border-t border-[#CFE0FF] pt-1.5">
              <span className="text-[12.5px] font-medium text-[#1B3A6B]">Due before care starts</span>
              <span className="ml-auto text-[15px] font-semibold tabular-nums text-[#1B3A6B]">{money(priced.total)}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            if (!client) return;
            onSave({
              clientPersonId: client.clientPersonId,
              deposit,
              depositReason: depositReason.trim(),
              chargeTechnologyFee: !client.alreadyIssued,
              method,
              startsOn,
              dueOn,
              weekLabel: week.label,
              lines: priced.lines.map((l) => ({ description: l.description, amount: l.amount })),
              total: priced.total,
            });
            onOpenChange(false);
          }}
          className={cn("mt-4 h-[40px] w-full rounded-[10px] text-[13px] font-medium transition-colors", ok ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
        >
          {ok ? `Create draft · ${money(priced.total)}` : FIRST_PAYMENT_MESSAGES[refusals[0]]}
        </button>
      </DialogContent>
    </Dialog>
  );
}
