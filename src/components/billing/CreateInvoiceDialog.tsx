import { useMemo, useState } from "react";
import { ChevronDown, Info, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CHARGE_TYPES, MILEAGE_RATE, chargeAmount, chargeType, feeLine, recentWeeks, type ManualCharge, type ManualDraft } from "@/domain/billing/manualInvoice";

const today = () => new Date().toISOString().slice(0, 10);
const longDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const FIELD = "h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary";
const LABEL = "text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";

export interface InvoiceClient {
  clientPersonId: string;
  name: string;
  rate: number | null;
  method: string;
  payerType: string;
}

/**
 * An additional or one-time charge, raised by hand. It lands in Invoices
 * as a draft; nothing is sent and no payment is collected until it is
 * approved.
 */
export function CreateInvoiceDialog({
  open,
  onOpenChange,
  clients,
  existingPeriods,
  money,
  onCreateDraft,
  onFirstTimePayment,
  onApproveSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: InvoiceClient[];
  /** Week starts each client already has an invoice for. */
  existingPeriods: Record<string, string[]>;
  money: (n: number | null) => string;
  onCreateDraft: (draft: ManualDraft) => void;
  onFirstTimePayment?: () => void;
  onApproveSend: (key: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [charges, setCharges] = useState<ManualCharge[]>([]);
  const [seq, setSeq] = useState(1);
  const [typeOpen, setTypeOpen] = useState(false);
  const [separate, setSeparate] = useState(false);
  const [shape, setShape] = useState<"single" | "period">("single");
  const [date, setDate] = useState(today);
  const weeks = useMemo(() => recentWeeks(), []);
  const [week, setWeek] = useState(weeks[0].value);
  const [weekOpen, setWeekOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [methodChoice, setMethodChoice] = useState<"ach" | "card" | null>(null);
  const [created, setCreated] = useState<{ key: string; lines: Array<{ description: string; type: string; amount: number }>; subtotal: number; fee: { label: string; amount: number } | null; total: number } | null>(null);

  const client = clients.find((c) => c.clientPersonId === clientId) ?? null;
  const method = methodChoice ?? (client && /card/i.test(client.method) ? "card" : "ach");
  const methodLabel = method === "card" ? "Card" : "ACH";
  const subtotal = useMemo(() => Math.round(charges.reduce((t, c) => t + chargeAmount(c), 0) * 100) / 100, [charges]);
  const fee = client ? feeLine(method, subtotal) : null;
  const total = Math.round((subtotal + (fee?.amount ?? 0)) * 100) / 100;
  const duplicate = shape === "period" && client ? (existingPeriods[client.clientPersonId] ?? []).includes(week) : false;
  const incurred = shape === "single" ? longDay(date) : (weeks.find((w) => w.value === week)?.label ?? longDay(week));

  const reset = () => {
    setClientId("");
    setCharges([]);
    setSeparate(false);
    setShape("single");
    setDate(today());
    setWeek(weeks[0].value);
    setMethodChoice(null);
    setEditing(null);
    setCreated(null);
  };
  const addCharge = (key: string) => {
    const t = chargeType(key);
    const id = seq;
    setCharges((cs) => [...cs, { id, type: key, description: "", quantity: 1, rate: t.key === "mileage" ? MILEAGE_RATE : t.key === "hours" ? (client?.rate ?? 0) : 0, amount: 0 }]);
    setSeq((n) => n + 1);
    setTypeOpen(false);
    setEditing(id);
  };
  const patch = (id: number, change: Partial<ManualCharge>) => setCharges((cs) => cs.map((c) => (c.id === id ? { ...c, ...change } : c)));
  const canCreate = !!client && charges.length > 0 && subtotal > 0 && (!duplicate || separate);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-32px)] max-w-[560px] flex-col gap-0 overflow-y-auto p-6 sm:rounded-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-[17px] tracking-[-.01em]">Create invoice</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-[1.55]">Create an additional or one-time client charge.</DialogDescription>
        </DialogHeader>
        {created && client ? (
          <>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="rounded-full bg-[var(--hairline-soft)] px-2.5 py-[3px] text-[11px] font-medium text-[var(--ink-body)]">Draft</span>
              <span className="text-[11.5px] text-muted-foreground">Marked manually created · not sent yet</span>
            </div>
            <div className="mt-3 rounded-[12px] border border-[var(--hairline)] px-4 py-3.5">
              <p className="m-0 text-[15px] font-semibold tracking-[-.01em]">{client.name}</p>
              <p className="m-0 mt-[2px] text-[12px] text-muted-foreground">{incurred}</p>
              <p className="m-0 mt-[2px] text-[12px] text-muted-foreground [text-wrap:pretty]">{`Bill to the client · ${methodLabel}`}</p>
              <div className="mt-3 flex flex-col border-t border-[var(--hairline-soft)] pt-2.5">
                {created.lines.map((l, i) => (
                  <span key={i} className="flex items-start gap-2.5 py-1.5">
                    <span className="flex flex-col gap-[2px] leading-[1.35]">
                      <span className="text-[13px]">{l.type}</span>
                      {l.description !== l.type && <span className="text-[11.5px] text-muted-foreground">{l.description}</span>}
                    </span>
                    <span className="ml-auto text-[13px] tabular-nums">{money(l.amount)}</span>
                  </span>
                ))}
                {created.fee && (
                  <span className="flex items-baseline gap-2.5 py-1.5">
                    <span className="text-[12.5px] text-muted-foreground">{created.fee.label}</span>
                    <span className="ml-auto text-[12.5px] tabular-nums">{money(created.fee.amount)}</span>
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2.5 border-t border-[var(--hairline)] pt-2.5">
                <span className="text-[13px] font-medium">Invoice total</span>
                <span className="ml-auto text-[19px] font-semibold tabular-nums">{money(created.total)}</span>
              </div>
            </div>
            {client.payerType.includes("LTC") && (
              <p className="m-0 mt-3 text-[12px] leading-[1.55] text-[var(--ink-body)] [text-wrap:pretty]">Once the family pays this invoice, Joy will include it in the next LTCI reimbursement packet.</p>
            )}
            <p className="m-0 mt-2 text-[11.5px] text-muted-foreground">Saved to Invoices as a draft — you can close this and come back to it.</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setCreated(null)} className="h-[40px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-4 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground">
                Edit charges
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveSend(created.key);
                  reset();
                  onOpenChange(false);
                }}
                className="ml-auto h-[40px] rounded-[10px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              >
                Approve & send
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">
                Client <span className="text-[#B42318]">*</span>
              </span>
              <div className="relative">
                <button type="button" onClick={() => setClientOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={clientOpen} className={cn(FIELD, "flex w-full items-center gap-2 text-left")}>
                  <span className={cn(!client && "text-muted-foreground")}>{client ? client.name : "Select client"}</span>
                  <ChevronDown className="ml-auto h-3.5 w-3.5 flex-none opacity-50" aria-hidden="true" />
                </button>
                {clientOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setClientOpen(false)} aria-hidden="true" />
                    <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-[260px] overflow-y-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                      {clients.map((c) => (
                        <li key={c.clientPersonId}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={clientId === c.clientPersonId}
                            onClick={() => {
                              setClientId(c.clientPersonId);
                              setClientOpen(false);
                              setSeparate(false);
                              setCharges((cs) => cs.map((x) => (x.type === "hours" ? { ...x, rate: c.rate ?? 0 } : x)));
                            }}
                            className="flex w-full flex-col gap-[2px] rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--wash)]"
                          >
                            <span className="text-[13px]">{c.name}</span>
                            <span className="text-[11.5px] text-muted-foreground">{[c.payerType, c.rate === null ? "No rate on file" : `${money(c.rate)}/hr`].join(" · ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            {client && (
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-[10px] bg-[var(--wash)] px-3.5 py-3">
                {(
                  [
                    ["Rate on file", client.rate === null ? "Not recorded" : `${money(client.rate)} / hr`],
                    ["Pay type", client.payerType],
                    ["Billing method", methodLabel],
                  ] as const
                ).map(([label, value]) => (
                  <span key={label} className="flex flex-col gap-[2px]">
                    <span className={LABEL}>{label}</span>
                    <span className="text-[12.5px] [text-wrap:pretty]">{value}</span>
                  </span>
                ))}
                <span className="flex flex-col gap-1">
                  <span className={LABEL}>Pay by</span>
                  <span className="flex w-fit gap-1 rounded-[8px] bg-[var(--paper)] p-[3px]" role="radiogroup" aria-label="Payment method for this invoice">
                    {(["ach", "card"] as const).map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethodChoice(m)} className={cn("h-[24px] rounded-[6px] px-2.5 text-[12px] transition-colors", method === m ? "bg-[#EEF0FE] font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
                        {m === "ach" ? "ACH" : "Card"}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
            )}
            {duplicate && (
              <div className="mt-2.5 flex flex-col gap-1.5 rounded-[10px] border border-[#DDE1FA] bg-[#F7F8FE] px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-[12.5px] text-[var(--ink-body)]">
                  <Info className="h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
                  Invoice already exists for {weeks.find((w) => w.value === week)?.label}
                </span>
                <label className="flex items-center gap-2 pl-[22px] text-[12.5px] text-[var(--ink-body)]">
                  <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                  This is a separate charge
                </label>
              </div>
            )}
            <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">What are you billing?</h3>
            <div className="flex w-fit flex-wrap gap-1 rounded-[10px] bg-[var(--wash)] p-1" role="radiogroup" aria-label="Charge shape">
              {(["single", "period", "first"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={shape === s}
                  onClick={() => (s === "first" ? onFirstTimePayment?.() : setShape(s))}
                  className={cn("h-[30px] rounded-[8px] px-3 text-[12.5px] transition-colors", shape === s ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.10)]" : "text-muted-foreground hover:text-foreground")}
                >
                  {s === "single" ? "Single date" : s === "period" ? "Service period" : "First-time payment"}
                </button>
              ))}
            </div>
            {shape === "single" ? (
              <label className="mt-2.5 flex flex-col gap-1.5">
                <span className="text-[11.5px] text-muted-foreground">Service / expense date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
              </label>
            ) : (
              <div className="mt-2.5">
                <div className="relative">
                  <button type="button" onClick={() => setWeekOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={weekOpen} className={cn(FIELD, "flex w-full items-center gap-2 text-left")}>
                    {weeks.find((w) => w.value === week)?.label}
                    <ChevronDown className="ml-auto h-3.5 w-3.5 flex-none opacity-50" aria-hidden="true" />
                  </button>
                  {weekOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setWeekOpen(false)} aria-hidden="true" />
                      <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-[240px] overflow-y-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                        {weeks.map((w) => (
                          <li key={w.value}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={week === w.value}
                              onClick={() => {
                                setWeek(w.value);
                                setWeekOpen(false);
                              }}
                              className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", week === w.value ? "font-medium text-primary" : "text-[var(--ink-body)]")}
                            >
                              {w.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
            <h3 className="mb-1.5 mt-4 text-[12.5px] font-medium">Charges</h3>
            <div className="flex flex-col gap-2">
              {charges.map((c) => {
                const t = chargeType(c.type);
                const openRow = editing === c.id;
                return (
                  <div key={c.id} className="rounded-[12px] border border-[var(--hairline)]">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <button type="button" onClick={() => setEditing(openRow ? null : c.id)} className="flex min-w-0 flex-1 flex-col items-start gap-[2px] text-left">
                        <span className="text-[13px]">{c.description.trim() || t.label}</span>
                        {c.description.trim() && <span className="text-[11.5px] text-muted-foreground">{t.label}</span>}
                      </button>
                      <span className="text-[13px] font-medium tabular-nums">{money(chargeAmount(c))}</span>
                      <button type="button" onClick={() => setCharges((cs) => cs.filter((x) => x.id !== c.id))} aria-label={`Remove ${t.label}`} className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-[#B42318]">
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    {openRow && (
                      <div className="flex flex-col gap-2 border-t border-[var(--hairline-soft)] px-3.5 py-3">
                        <input type="text" value={c.description} onChange={(e) => patch(c.id, { description: e.target.value })} placeholder={t.key === "hours" ? "Weekend respite visit" : "What this is for"} aria-label="Description" className={cn(FIELD, "h-[32px] text-[12.5px]")} />
                        <div className="flex items-end gap-2">
                          {t.rated ? (
                            <>
                              <label className="flex flex-1 flex-col gap-1">
                                <span className="text-[11px] text-muted-foreground">{t.quantityLabel}</span>
                                <input type="number" min={0} step="0.25" value={c.quantity} onChange={(e) => patch(c.id, { quantity: Number(e.target.value) })} className={cn(FIELD, "h-[32px] text-[12.5px] tabular-nums")} />
                              </label>
                              <label className="flex flex-1 flex-col gap-1">
                                <span className="text-[11px] text-muted-foreground">Rate</span>
                                <input type="number" min={0} step="0.01" value={c.rate} onChange={(e) => patch(c.id, { rate: Number(e.target.value) })} className={cn(FIELD, "h-[32px] text-[12.5px] tabular-nums")} />
                              </label>
                            </>
                          ) : (
                            <label className="flex flex-1 flex-col gap-1">
                              <span className="text-[11px] text-muted-foreground">Amount</span>
                              <input type="number" min={0} step="0.01" value={c.amount} onChange={(e) => patch(c.id, { amount: Number(e.target.value) })} className={cn(FIELD, "h-[32px] text-[12.5px] tabular-nums")} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="relative">
                <button
                  type="button"
                  disabled={!client}
                  onClick={() => setTypeOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={typeOpen}
                  className={cn("flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[12.5px] transition-colors", client ? "border-[var(--hairline)] text-primary hover:bg-[var(--wash)]" : "cursor-not-allowed border-[var(--hairline-soft)] text-muted-foreground/50")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {charges.length ? "Add another charge" : "Add a charge"}
                </button>
                {typeOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} aria-hidden="true" />
                    <ul role="listbox" aria-label="Charge type" className="absolute left-0 right-0 z-20 mt-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                      {CHARGE_TYPES.map((t) => (
                        <li key={t.key}>
                          <button type="button" role="option" aria-selected={false} onClick={() => addCharge(t.key)} className="flex w-full flex-col gap-[2px] rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--wash)]">
                            <span className="text-[13px]">{t.label}</span>
                            <span className="text-[11.5px] text-muted-foreground">{t.hint}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
            {client && charges.length > 0 && (
              <>
                <h3 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">Invoice summary</h3>
                <div className="rounded-[12px] border border-[var(--hairline)] px-3.5 py-3">
                  <p className="m-0 text-[13.5px] font-medium">{client.name}</p>
                  <p className="m-0 mt-[2px] text-[12px] text-muted-foreground">{incurred}</p>
                  <div className="mt-2.5 flex flex-col border-t border-[var(--hairline-soft)] pt-2">
                    {charges.map((c) => (
                      <span key={c.id} className="flex items-baseline gap-2.5 py-1">
                        <span className="text-[12.5px]">{c.description.trim() || chargeType(c.type).label}</span>
                        <span className="ml-auto text-[12.5px] tabular-nums">{money(chargeAmount(c))}</span>
                      </span>
                    ))}
                    {fee && (
                      <span className="flex items-baseline gap-2.5 py-1">
                        <span className="text-[12.5px] text-muted-foreground">{fee.label}</span>
                        <span className="ml-auto text-[12.5px] tabular-nums">{money(fee.amount)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="mt-4 flex items-baseline gap-2.5 border-t border-[var(--hairline)] pt-3">
              <span className="text-[13px] font-medium">Invoice total</span>
              <span className="ml-auto text-[22px] font-semibold tabular-nums">{money(total)}</span>
            </div>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => {
                if (!client) return;
                const key = `manual-${client.clientPersonId}-${Date.now()}`;
                const lines = charges.map((c) => ({ description: c.description.trim() || chargeType(c.type).label, type: chargeType(c.type).label, amount: chargeAmount(c) }));
                onCreateDraft({
                  key,
                  clientPersonId: client.clientPersonId,
                  clientName: client.name,
                  lines: [...lines.map((l) => ({ description: l.description, amount: l.amount })), ...(fee ? [{ description: fee.label, amount: fee.amount }] : [])],
                  total,
                  incurred,
                  method,
                });
                setCreated({ key, lines, subtotal, fee, total });
              }}
              className={cn("mt-3 h-[44px] w-full rounded-[10px] text-[13.5px] font-medium transition-colors", canCreate ? "bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50")}
            >
              {duplicate && !separate ? "Confirm it is a separate charge" : "Create draft invoice"}
            </button>
            <p className="m-0 mt-2.5 text-center text-[11px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">Nothing is sent and no payment is collected until you approve the draft.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
