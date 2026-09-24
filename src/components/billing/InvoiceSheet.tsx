import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CARD_CONVENIENCE_RATE, type Invoice, type InvoiceLine } from "@/domain/billing/invoice";
import { RUN_EXCEPTION_LABELS, type RunException } from "@/domain/billing/run";
import type { InvoiceBalance } from "@/domain/billing/receivables";
import {
  PAYMENT_STAGES,
  PAYMENT_STAGE_LABELS,
  PAYMENT_STATUS_DOT,
  PAYMENT_STATUS_PILL,
  STAGE_BAR,
  financialHistory,
  invoiceActions,
  paymentStages,
  paymentStatusLabel,
  relativeDay,
  type InvoiceAction,
  type PaymentFailure,
  type PaymentStatusInput,
  type Refund,
} from "@/domain/billing/invoiceActions";

const shortDay = (iso: string | null | undefined) => {
  if (!iso || iso === "—") return iso ?? "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const dayTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/** Sent → viewed → payment sent → paid, with "viewed" honestly untracked. */
export function PaymentStatus({ asOf, dueLabel, ...input }: PaymentStatusInput & { asOf: string; dueLabel: string | null }) {
  const stages = paymentStages(input);
  const label = paymentStatusLabel(input);
  const latest = [...stages].reverse().find((s) => s.on !== null)?.on ?? null;
  const ago = relativeDay(latest, asOf);
  return (
    <section aria-label="Payment status" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Payment status</h3>
        {dueLabel && !input.settled && <span className="ml-auto text-[11.5px] text-muted-foreground">{dueLabel}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", PAYMENT_STATUS_PILL[label])}>
          <span className={cn("h-1.5 w-1.5 flex-none rounded-full", PAYMENT_STATUS_DOT[label])} aria-hidden="true" />
          {label}
        </span>
        {ago && <span className="text-[11.5px] text-muted-foreground">{label === "Not sent" ? ago : `${label} ${ago}`}</span>}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {stages.map((s) => (
          <span key={s.stage} className={cn("h-1.5 flex-1 rounded-full", STAGE_BAR[s.state])} />
        ))}
      </div>
      <div className="flex gap-1.5">
        {PAYMENT_STAGES.map((stage) => {
          const s = stages.find((x) => x.stage === stage)!;
          return (
            <span key={stage} className="flex min-w-0 flex-1 flex-col gap-[1px]">
              <span className={cn("truncate text-[11px]", s.state === "failed" ? "text-[#B42318]" : "text-muted-foreground")}>{s.state === "failed" ? "Payment failed" : PAYMENT_STAGE_LABELS[stage]}</span>
              <span className={cn("truncate text-[11.5px] tabular-nums", s.state === "failed" ? "text-[#B42318]" : s.on ? "text-[var(--ink-body)]" : "text-muted-foreground/70")}>{s.on ? shortDay(s.on) : "—"}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

export interface ManualLine {
  description: string;
  amount: number;
  hours?: number;
  rate?: number | null;
}

/**
 * One invoice, opened from the list: the amount, where the payment is, the
 * lines, the history, Joy's reminders and what can still be done to it.
 */
export function InvoiceSheet({
  open,
  onOpenChange,
  clientName,
  periodLabel,
  statusLabel,
  statusClass,
  amount,
  method,
  dueLabel,
  responsibleParty,
  hours,
  draft,
  manualLines,
  balance,
  exceptions,
  money,
  onAction,
  failure,
  retryRefusals = [],
  refunds = [],
  editedLines,
  onRetry,
  reminders = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  periodLabel: string;
  statusLabel: string;
  statusClass: string;
  amount: number | null;
  method: string;
  dueLabel: string;
  responsibleParty: string | null;
  hours: number | null;
  draft: Invoice | null;
  manualLines: ManualLine[] | null;
  balance: InvoiceBalance | null;
  exceptions: RunException[];
  money: (n: number | null) => string;
  onAction: (action: InvoiceAction) => void;
  failure: PaymentFailure | null;
  retryRefusals?: string[];
  refunds?: Refund[];
  editedLines: InvoiceLine[] | null;
  onRetry?: (failure: PaymentFailure) => void;
  reminders?: Array<{ when: string; label: string }>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!open) setMenuOpen(false);
  }, [open]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [menuOpen]);

  const history = balance ? financialHistory(balance.invoice) : null;
  const settled = !!balance && balance.balance <= 0 && balance.state !== "written_off";
  const voided = !!balance?.invoice.writtenOffOn;
  const actions = invoiceActions({ issued: !!balance, voided, settled, collected: balance?.paid ?? 0 });
  const refunded = Math.round(refunds.reduce((t, r) => t + r.amount, 0) * 100) / 100;
  const received = Math.round(((balance?.paid ?? 0) + refunded) * 100) / 100;
  const refundedInFull = refunded > 0 && settled && (balance?.paid ?? 0) <= 0;
  const lines: InvoiceLine[] =
    editedLines ?? draft?.lines ?? (manualLines ?? []).map((l) => ({ kind: "manual" as const, description: l.description, hours: l.hours ?? 0, rate: l.rate ?? null, multiplier: 1, amount: l.amount }));
  const today = new Date().toISOString().slice(0, 10);

  const events = balance
    ? [
        { when: balance.invoice.issuedOn, label: `Invoice sent${responsibleParty ? ` to ${responsibleParty}` : ""}`, amount: 0, bad: false },
        ...(received > 0 ? [{ when: balance.lastPaymentOn ?? "—", label: balance.balance <= 0 ? `${method.split(" · ")[0]} payment received in full` : "Payment received", amount: received, bad: false }] : []),
        ...refunds.map((r) => ({ when: r.on, label: `Refunded — ${r.reason}`, amount: -r.amount, bad: false })),
        ...(failure ? [{ when: failure.failedOn, label: failure.reason, amount: 0, bad: true }] : []),
        ...(balance.state === "overdue" ? [{ when: balance.invoice.dueOn, label: `Was due — ${balance.daysOverdue} days overdue`, amount: 0, bad: true }] : []),
        ...(balance.invoice.adjustments ?? []).filter((a) => a.origin !== "refund").map((a) => ({ when: a.createdAt.slice(0, 10), label: "Adjusted invoice reissued", amount: 0, bad: false })),
        ...(balance.invoice.writtenOffOn ? [{ when: balance.invoice.writtenOffOn, label: balance.invoice.writtenOffReason ?? "Written off", amount: 0, bad: true }] : []),
      ].sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-[460px]">
        <SheetHeader className="space-y-1.5 text-left">
          <span className={cn("inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", statusClass)}>{statusLabel}</span>
          <SheetTitle className="text-[17px] tracking-[-.01em]">{clientName}</SheetTitle>
          <SheetDescription className="text-[12.5px]">{[periodLabel, hours ? `${hours} hrs` : null, responsibleParty].filter(Boolean).join(" · ")}</SheetDescription>
        </SheetHeader>

        <div className="mt-3.5 flex items-start gap-4 rounded-[12px] border border-[var(--hairline)] px-4 py-3.5">
          <span className="flex flex-col gap-[3px]">
            <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{refundedInFull ? "Refunded in full" : settled ? "Paid in full" : "Amount due"}</span>
            <span className="text-[24px] font-semibold tracking-[-.015em] tabular-nums">{money(refundedInFull ? refunded : settled ? amount : balance ? balance.balance : amount)}</span>
            {balance && balance.paid > 0 && !settled && (
              <span className="text-[11.5px] text-muted-foreground tabular-nums">
                {money(amount)} billed · {money(balance.paid)} received
              </span>
            )}
          </span>
          <span className="ml-auto flex flex-col items-end gap-1 text-[12px] text-muted-foreground">
            <span>{dueLabel}</span>
            <span>{method}</span>
          </span>
        </div>

        <div className="mt-4">
          <PaymentStatus issuedOn={balance?.invoice.issuedOn ?? null} paidOn={balance?.lastPaymentOn ?? null} settled={settled} failedOn={failure?.failedOn ?? null} asOf={today} dueLabel={balance ? dueLabel : null} />
        </div>

        {exceptions.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-1.5">
            {exceptions.map((e, i) => (
              <div key={`${e.kind}-${i}`} className="flex items-start gap-2.5 rounded-xl bg-[#FFFAEB] px-3 py-2.5">
                <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-[#F79009]" aria-hidden="true" />
                <span className="text-[12px] leading-[1.45] text-[#7A6320] [text-wrap:pretty]">
                  <span className="font-medium text-foreground">{RUN_EXCEPTION_LABELS[e.kind]}.</span> {e.detail}
                </span>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <>
            <div className="mb-1 mt-4 flex items-center gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Invoice</h3>
              <div className={cn("relative ml-auto", actions.length === 0 && "hidden")}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex h-[30px] items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                >
                  Actions
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div role="menu" className="absolute right-0 z-20 mt-1 w-[190px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]">
                      {actions.map((a) => (
                        <button
                          key={a}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            onAction(a);
                          }}
                          className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--wash)]", a === "Void invoice" ? "text-[#B42318]" : "text-[var(--ink-body)]")}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              {lines.map((l, i) => (
                <div key={`${l.kind}-${i}`} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                  <span className="text-[13px]">{l.description}</span>
                  {l.hours > 0 && (
                    <span className="text-[11.5px] text-muted-foreground">
                      {l.hours} hrs{l.rate !== null && ` × $${(l.rate * l.multiplier).toFixed(2)}`}
                    </span>
                  )}
                  <span className="ml-auto text-[12.5px] tabular-nums">{money(l.amount)}</span>
                </div>
              ))}
              {draft && draft.depositApplied > 0 && (
                <div className="flex items-baseline gap-2.5 border-t border-[var(--hairline)] py-2">
                  <span className="text-[13px]">Deposit applied</span>
                  <span className="ml-auto text-[12.5px] text-[#B42318] tabular-nums">−{money(draft.depositApplied)}</span>
                </div>
              )}
              {(balance?.invoice.adjustments ?? []).map((a) => (
                <div key={a.id} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                  <span className="text-[13px]">
                    {a.origin === "refund" ? "Refund" : "Adjustment"} — {a.reason.replace(/ after .*/, "")}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {shortDay(a.createdAt)} · approved by {a.createdByUserId}
                  </span>
                  <span className="ml-auto text-[12.5px] text-[#B42318] tabular-nums">
                    {a.kind === "debit" ? "" : "−"}
                    {money(a.amount)}
                  </span>
                </div>
              ))}
              {!editedLines && draft && draft.convenienceFee > 0 && (
                <div className="flex items-baseline gap-2.5 border-t border-[var(--hairline-soft)] py-2">
                  <span className="text-[13px]">{method.startsWith("Card") ? `Card processing fee · ${(CARD_CONVENIENCE_RATE * 100).toFixed(1)}%` : "ACH processing fee"}</span>
                  <span className="ml-auto text-[12.5px] tabular-nums">{money(draft.convenienceFee)}</span>
                </div>
              )}
              <div className="flex items-baseline gap-2.5 border-t border-[var(--hairline)] py-2.5">
                <span className="text-[13px] font-medium">Total</span>
                <span className="ml-auto text-[13px] font-semibold tabular-nums">{money(editedLines ? amount : draft ? draft.total : amount)}</span>
              </div>
            </div>
          </>
        )}

        {history?.adjusted && (
          <>
            <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Financial history</h3>
            <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--wash)] px-3.5 py-3">
              {(
                [
                  ["Original invoice", money(history.original), ""],
                  [(balance?.invoice.adjustments ?? []).every((a) => a.origin === "refund") ? "Refunded" : "Adjustment", `${history.adjustment < 0 ? "−" : ""}${money(Math.abs(history.adjustment))}`, "text-[#B42318]"],
                  ["Revised balance", money(history.revised), "font-semibold"],
                ] as const
              ).map(([label, value, tone]) => (
                <span key={label} className="flex items-baseline gap-3">
                  <span className="text-[12.5px] text-muted-foreground">{label}</span>
                  <span className={cn("ml-auto text-[12.5px] tabular-nums", tone)}>{value}</span>
                </span>
              ))}
              {(balance?.invoice.adjustments ?? []).map((a) => (
                <span key={a.id} className="flex flex-col gap-2">
                  <span className="flex items-start gap-3">
                    <span className="flex-none text-[12.5px] text-muted-foreground">Reason</span>
                    <span className="ml-auto max-w-[62%] text-right text-[12.5px] [text-wrap:pretty]">{a.reason}</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-[12.5px] text-muted-foreground">Changed by</span>
                    <span className="ml-auto text-[12.5px]">
                      {a.createdByUserId} · {dayTime(a.createdAt)}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </>
        )}

        <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Payment history</h3>
        <div className="flex flex-col">
          {balance ? (
            events.map((e, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
                <span className="w-[52px] flex-none text-[11.5px] text-muted-foreground">{shortDay(e.when)}</span>
                <span className={cn("mt-[6px] h-1.5 w-1.5 flex-none rounded-full", e.bad ? "bg-[#D92D20]" : e.amount > 0 ? "bg-[#12B76A]" : "bg-[#D0D5DD]")} aria-hidden="true" />
                <span className={cn("text-[12.5px]", e.bad && "text-[#B42318]")}>{e.label}</span>
                {e.amount !== 0 && (
                  <span className={cn("ml-auto text-[12.5px] tabular-nums", e.amount < 0 && "text-[#B42318]")}>
                    {e.amount < 0 ? "−" : ""}
                    {money(Math.abs(e.amount))}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-[52px] flex-none text-[11.5px] text-muted-foreground">Not sent</span>
              <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-[#D0D5DD]" aria-hidden="true" />
              <span className="text-[12.5px]">Invoice has not been sent yet</span>
            </div>
          )}
        </div>

        {reminders.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Joy's reminders</h3>
            <div className="flex flex-col">
              {reminders.map((r) => {
                const due = r.when < today;
                return (
                  <div key={r.when + r.label} className="flex items-start gap-3 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
                    <span className="w-[52px] flex-none text-[11.5px] text-muted-foreground">{shortDay(r.when)}</span>
                    <span className={cn("mt-[6px] h-1.5 w-1.5 flex-none rounded-full", due ? "bg-[#F79009]" : "bg-[#D0D5DD]")} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col gap-[2px]">
                      <span className="text-[12.5px]">{r.label}</span>
                      <span className="text-[11.5px] text-muted-foreground">{due ? "Due — not sent" : "Scheduled"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="m-0 mt-2 rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-2.5 text-[11.5px] leading-[1.5] text-[#2B4A7E] [text-wrap:pretty]">
              Nothing has gone out. Joy's texts and emails send through Spruce, which is not connected yet. A call you make is logged on the client's record.
            </p>
          </>
        )}

        {failure && (
          <div className="mt-4 rounded-[12px] border border-[#FECDCA] bg-[#FEF3F2] p-3.5">
            <p className="m-0 text-[12.5px] font-medium text-[#B42318]">{failure.reason}</p>
            <p className="m-0 mt-1 text-[11.5px] leading-[1.5] text-[#B42318]/85 [text-wrap:pretty]">
              {retryRefusals.length === 0
                ? "Insufficient funds often clears on its own. Retrying charges the same saved card again through Stripe — it does not record a payment; Stripe reports whether it worked."
                : retryRefusals[0]}
            </p>
            <button
              type="button"
              disabled={retryRefusals.length > 0}
              onClick={() => onRetry?.(failure)}
              className={cn("mt-2.5 h-[34px] rounded-[9px] px-3.5 text-[12.5px] font-medium transition-colors", retryRefusals.length === 0 ? "bg-[#B42318] text-white hover:bg-[#912018]" : "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/60")}
            >
              Retry payment
            </button>
          </div>
        )}

        <p className="m-0 mt-3 border-t border-[var(--hairline)] pt-3 text-[11px] leading-[1.55] text-muted-foreground [text-wrap:pretty]">Payments settle through Stripe. Corrections keep the original amount on record.</p>
      </SheetContent>
    </Sheet>
  );
}
