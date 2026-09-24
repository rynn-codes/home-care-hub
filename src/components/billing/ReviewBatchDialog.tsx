import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  actionsFor,
  batchFinished,
  batchSourceLabel,
  batchTitle,
  currentId,
  hasNext,
  hasPrevious,
  jumpTo,
  next,
  previous,
  type ReviewBatch,
  type ReviewItem,
  type ReviewStatus,
} from "@/domain/billing/reviewBatch";

const STATUS_PILL: Record<ReviewStatus, string> = {
  "Needs review": "bg-[#FFFAEB] text-[#B54708]",
  Ready: "bg-[#EEF0FE] text-primary",
  Sent: "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
  "Past due": "bg-[#FEF3F2] text-[#B42318]",
  Paid: "bg-[#ECFDF3] text-[#027A48]",
  Adjusted: "bg-[#ECFDF7] text-[#0B7268]",
  Refunded: "bg-[#F5F9FF] text-[#2B4A7E]",
  Void: "bg-[var(--hairline-soft)] text-muted-foreground",
  "Needs attention": "bg-[#FEF3F2] text-[#B42318]",
};

const SECONDARY = "h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground";
const PRIMARY = "h-[38px] rounded-[10px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]";

const needsPerson = (status: ReviewStatus | undefined) => status === "Needs review" || status === "Needs attention";

/**
 * One invoice at a time: what Joy verified, what it recommends, and the one
 * decision the person makes before moving on. Approve, hold or edit — and
 * at the end, the send.
 */
export function ReviewBatchDialog({
  batch,
  onBatchChange,
  itemFor,
  readyToSend,
  money,
  onApprove,
  onHold,
  onEdit,
  onDetails,
  onSendAll,
  weekLabel,
  dueLabel,
}: {
  batch: ReviewBatch | null;
  onBatchChange: (batch: ReviewBatch | null) => void;
  itemFor: (id: string) => ReviewItem | null;
  readyToSend: Array<{ key: string; clientName: string; amount: number | null }>;
  money: (n: number | null) => string;
  onApprove: (item: ReviewItem) => void;
  onHold: (item: ReviewItem) => void;
  onEdit: (item: ReviewItem) => void;
  onDetails: (item: ReviewItem) => void;
  onSendAll: () => void;
  weekLabel: string;
  dueLabel: string;
}) {
  const [reviewed, setReviewed] = useState(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const open = batch !== null;
  const id = batch ? currentId(batch) : null;
  const item = id ? itemFor(id) : null;
  const finished = batch !== null && batchFinished(batch);

  const close = (stay: boolean) => {
    if (!stay) {
      setReviewed(0);
      setJumpOpen(false);
      onBatchChange(null);
    }
  };
  const forward = () => batch && onBatchChange(next(batch));
  const back = () => batch && onBatchChange(previous(batch));
  const approve = () => {
    if (!item) return;
    onApprove(item);
    setReviewed((n) => n + 1);
    forward();
  };
  const hold = () => {
    if (!item) return;
    onHold(item);
    forward();
  };

  const readyTotal = readyToSend.reduce((t, r) => t + (r.amount ?? 0), 0);
  const actions = item ? actionsFor(item.status) : [];
  const last = batch ? !hasNext(batch) : true;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-2.5 border-b border-[var(--hairline)] px-5 py-3.5 pr-12">
          <div className="flex items-center gap-3">
            <DialogTitle className="m-0 flex-none text-[12.5px] font-medium text-[var(--ink-body)]">{batch ? batchTitle(batch) : ""}</DialogTitle>
            <span className="h-1 max-w-[220px] flex-1 overflow-hidden rounded-full bg-[var(--wash-strong)]" aria-hidden="true">
              <span
                className={cn("block h-full rounded-full transition-all", finished ? "bg-[#12B76A]" : "bg-primary")}
                style={{ width: batch ? (finished ? "100%" : `${Math.round(((batch.index + 1) / Math.max(1, batch.ids.length)) * 100)}%`) : "0%" }}
              />
            </span>
          </div>
          {batch && !finished && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setJumpOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={jumpOpen}
                  className="flex h-[30px] items-center gap-1.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
                >
                  {batchSourceLabel(batch)}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
                {jumpOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setJumpOpen(false)} aria-hidden="true" />
                    <ul
                      role="listbox"
                      aria-label="Jump to an invoice in this batch"
                      className="absolute left-0 z-20 mt-1 max-h-[300px] w-[340px] overflow-y-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_16px_40px_rgba(25,26,46,.14)]"
                    >
                      {batch.ids.map((other, i) => {
                        const row = itemFor(other);
                        const here = i === batch.index;
                        return (
                          <li key={other}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={here}
                              onClick={() => {
                                onBatchChange(jumpTo(batch, other));
                                setJumpOpen(false);
                              }}
                              className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--wash)]", here && "bg-[var(--wash)]")}
                            >
                              <span
                                className={cn(
                                  "flex h-[16px] w-[16px] flex-none items-center justify-center rounded-full text-[9.5px] font-bold",
                                  here ? "bg-primary text-white" : needsPerson(row?.status) ? "bg-[#FEF0C7] text-[#B54708]" : "bg-[#ECFDF3] text-[#12B76A]",
                                )}
                                aria-hidden="true"
                              >
                                {here ? <ChevronRight className="h-3 w-3" strokeWidth={3} /> : needsPerson(row?.status) ? "!" : <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{row?.clientName ?? other}</span>
                              <span className="flex-none text-[12px] text-muted-foreground tabular-nums">{money(row?.amount ?? null)}</span>
                              <span className="w-[96px] flex-none text-right text-[11px] text-muted-foreground">{here ? "Viewing" : (row?.status ?? "")}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
              <span className="ml-auto flex items-center gap-1">
                <button type="button" onClick={back} disabled={!hasPrevious(batch)} className="flex h-[30px] items-center gap-1 rounded-[8px] px-2 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Previous
                </button>
                <button type="button" onClick={forward} disabled={!hasNext(batch)} className="flex h-[30px] items-center gap-1 rounded-[8px] px-2 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground disabled:opacity-40">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            </div>
          )}
        </div>

        {item && !finished ? (
          <>
            <DialogDescription className="sr-only">
              {item.clientName}'s invoice for the care week of {weekLabel}, with what Joy verified and what it needs.
            </DialogDescription>
            <div className="max-h-[56vh] overflow-y-auto px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="m-0 text-[19px] font-semibold tracking-[-.01em]">{item.clientName}</h2>
                  <p className="m-0 text-[12.5px] text-muted-foreground [text-wrap:pretty]">
                    {item.invoiceNumber ? `${item.invoiceNumber} · ` : ""}
                    {weekLabel}
                    {item.hours > 0 && ` · ${item.hours} hrs`}
                    {item.rate !== null && ` · $${item.rate.toFixed(2)}/hr`} · {item.payerType}
                  </p>
                </div>
                <div className="ml-auto flex flex-none flex-col items-end gap-1.5">
                  <span className="text-[21px] font-semibold tracking-[-.01em] tabular-nums">{money(item.amount)}</span>
                  <span className={cn("rounded-full px-2.5 py-[3px] text-[11px] font-medium", STATUS_PILL[item.status])}>{item.status}</span>
                </div>
              </div>
              {item.checks.length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5">
                  {item.checks.map((c) => (
                    <div key={c.key} className={cn("flex items-start gap-3 rounded-xl px-3.5 py-3", c.ok ? "bg-[var(--wash)]" : "bg-[#FFFAEB]")}>
                      <span className={cn("mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold", c.ok ? "bg-[#ECFDF3] text-[#12B76A]" : "bg-[#FEF0C7] text-[#B54708]")} aria-hidden="true">
                        {c.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : "!"}
                      </span>
                      <span className="flex min-w-0 flex-col gap-[3px] leading-[1.4]">
                        <span className="text-[13px] font-medium">{c.label}</span>
                        <span className="text-[11.5px] text-muted-foreground [text-wrap:pretty]">{c.detail}</span>
                      </span>
                      {c.amount && <span className="ml-auto flex-none text-[12.5px] font-medium text-[#B54708] tabular-nums">{c.amount}</span>}
                    </div>
                  ))}
                </div>
              )}
              {item.lines.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Invoice lines</h3>
                  <div className="flex flex-col">
                    {item.lines.map((l, i) => (
                      <div key={`${l.description}-${i}`} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                        <span className="text-[13px]">{l.description}</span>
                        {l.detail && <span className="text-[11.5px] text-muted-foreground">{l.detail}</span>}
                        <span className="ml-auto text-[12.5px] tabular-nums">{money(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 rounded-xl bg-[#F7F8FE] px-3.5 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-primary">Joy check</span>
                </span>
                <p className="m-0 mt-1.5 text-[12.5px] leading-[1.55] text-[var(--ink-body)] [text-wrap:pretty]">{item.recommendation}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] px-5 py-3.5">
              {actions.includes("edit") && (
                <button type="button" onClick={() => onEdit(item)} className={SECONDARY}>
                  Edit invoice
                </button>
              )}
              {actions.includes("hold") && (
                <button type="button" onClick={hold} className={SECONDARY}>
                  Hold invoice
                </button>
              )}
              <button type="button" onClick={() => onDetails(item)} className="h-[38px] px-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                Details
              </button>
              {actions.includes("approve") ? (
                <button type="button" onClick={approve} className={cn("ml-auto", PRIMARY)}>
                  {last ? "Approve & finish" : "Approve & next"}
                </button>
              ) : (
                <button type="button" onClick={last ? () => close(false) : forward} className={cn("ml-auto", PRIMARY)}>
                  {last ? "Done" : "Next invoice"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogDescription className="sr-only">Every invoice in the batch has been looked at. {readyToSend.length} are ready to send.</DialogDescription>
            <div className="max-h-[62vh] overflow-y-auto px-5 py-5">
              <h2 className="m-0 text-[19px] font-semibold tracking-[-.01em]">{reviewed > 0 ? `${reviewed} ${reviewed === 1 ? "invoice" : "invoices"} reviewed` : "Nothing left to review"}</h2>
              <p className="m-0 mt-1 text-[12.5px] text-muted-foreground [text-wrap:pretty]">
                {readyToSend.length === 0 ? "Every draft is either approved and sent, or held for something to be settled first." : `${readyToSend.length} ready to send · ${money(readyTotal)} total · due ${dueLabel}`}
              </p>
              <div className="mt-3.5 flex flex-col">
                {readyToSend.map((r) => (
                  <div key={r.key} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2.5 last:border-0">
                    <span className="text-[13px]">{r.clientName}</span>
                    <span className="rounded-full bg-[#ECFDF3] px-2.5 py-[3px] text-[11px] font-medium text-[#027A48]">Approved</span>
                    <span className="ml-auto text-[12.5px] font-medium tabular-nums">{money(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-5 py-3.5">
              <button type="button" onClick={() => close(false)} className={SECONDARY}>
                Back to invoices
              </button>
              {batch && batch.ids.length > 0 && (
                <button type="button" onClick={() => onBatchChange(jumpTo(batch, batch.ids[0]))} className={SECONDARY}>
                  Review again
                </button>
              )}
              <button
                type="button"
                disabled={readyToSend.length === 0}
                onClick={() => {
                  onSendAll();
                  close(false);
                }}
                className={cn("ml-auto h-[38px] rounded-[10px] px-[18px] text-[13px] font-medium transition-colors", readyToSend.length === 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]")}
              >
                Send all invoices
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
