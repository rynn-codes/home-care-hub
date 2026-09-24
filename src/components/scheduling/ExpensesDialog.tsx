import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Trash2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoySuggests } from "@/components/scheduling/joy";
import { cn } from "@/lib/utils";
import {
  DELETED_KEPT_DAYS,
  EXPENSE_CATEGORIES,
  RECEIPT_REQUIRED_FROM,
  REVIEW_RULE,
  categoryInfo,
  deletedLine,
  descriptionLine,
  expensesLine,
  expensesTotal,
  isDeleted,
  kindLabel,
  mayReview,
  needsReview,
  receiptMissing,
  validateExpense,
  whyNotReviewable,
  type ExpenseCategory,
  type ReceiptMeta,
  type VisitExpense,
} from "@/domain/scheduling/expenses";

/**
 * Expenses on a visit. The receipt image never leaves the device: only its
 * name, size, type and when it was taken are kept. A deleted item is kept
 * thirty days; nothing reaches an invoice or payroll until reviewed by
 * somebody other than the person who recorded it.
 */
export function ExpensesDialog({
  open,
  onOpenChange,
  visitId,
  visitDate,
  caregiverName,
  existing,
  ratePerMile,
  gpsMiles,
  tripStart,
  reviewer,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  visitDate: string;
  caregiverName: string;
  existing: readonly VisitExpense[];
  ratePerMile: number;
  gpsMiles: number | null;
  tripStart: string | null;
  reviewer: string;
  onSave: (items: VisitExpense[]) => void;
}) {
  const [items, setItems] = useState<VisitExpense[]>([]);
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("mileage");
  const [otherKind, setOtherKind] = useState("");
  const [description, setDescription] = useState("");
  const [tripFrom, setTripFrom] = useState("");
  const [tripTo, setTripTo] = useState("");
  const [amount, setAmount] = useState("");
  const [miles, setMiles] = useState("");
  const [milesFrom, setMilesFrom] = useState<"gps" | "typed" | null>(null);
  const [receipt, setReceipt] = useState<ReceiptMeta | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearForm = () => {
    setOtherKind("");
    setDescription("");
    setTripFrom(tripStart ?? "");
    setTripTo("");
    setAmount("");
    setMiles("");
    setMilesFrom(null);
    setReceipt(null);
  };

  useEffect(() => {
    if (!open) return;
    setItems([...existing]);
    setDate(visitDate);
    setCategory("mileage");
    setOtherKind("");
    setDescription("");
    setTripFrom(tripStart ?? "");
    setTripTo("");
    setAmount("");
    setMiles("");
    setMilesFrom(null);
    setReceipt(null);
  }, [open, existing, visitDate, tripStart]);

  const info = categoryInfo(category);
  const draft: VisitExpense = {
    id: "draft",
    visitId,
    category,
    otherKind,
    description,
    amount: amount.trim() === "" ? 0 : Number(amount),
    miles: miles.trim() === "" ? 0 : Number(miles),
    tripFrom,
    tripTo,
    receipt,
    date,
    recordedBy: caregiverName,
    recordedOn: "",
  };
  const problem = validateExpense({ expense: draft, others: items });
  const noReceipt = receiptMissing(draft) && problem === null;

  const add = () => {
    if (problem) return;
    setItems((prev) => [
      ...prev,
      {
        id: `exp-${visitId}-${Date.now()}`,
        visitId,
        date,
        category,
        otherKind: category === "other" ? otherKind.trim() : "",
        description: description.trim(),
        amount: info.byMiles ? 0 : draft.amount,
        miles: info.byMiles ? draft.miles : 0,
        milesFrom: info.byMiles ? milesFrom ?? "typed" : null,
        tripFrom: info.byMiles ? tripFrom.trim() : "",
        tripTo: info.byMiles ? tripTo.trim() : "",
        receipt,
        recordedBy: caregiverName,
        recordedOn: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        deletedBy: null,
        deletedAt: null,
      },
    ]);
    clearForm();
  };
  const saved = (id: string) => existing.some((e) => e.id === id);
  const remove = (id: string) => setItems((prev) => (saved(id) ? prev.map((e) => (e.id === id ? { ...e, deletedBy: reviewer || null, deletedAt: new Date().toISOString() } : e)) : prev.filter((e) => e.id !== id)));
  const restore = (id: string) => setItems((prev) => prev.map((e) => (e.id === id ? { ...e, deletedBy: null, deletedAt: null } : e)));
  const review = (id: string) => setItems((prev) => prev.map((e) => (e.id === id ? { ...e, reviewedBy: reviewer, reviewedAt: new Date().toISOString() } : e)));
  const pickReceipt = (via: "camera" | "upload") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Metadata only. The image itself is never written anywhere the demo stores state.
    setReceipt({ name: file.name, size: file.size, type: file.type, via, takenAt: new Date().toISOString() });
    e.target.value = "";
  };
  const total = expensesTotal(items, ratePerMile);
  const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[19px] tracking-[-.015em]">Expenses</DialogTitle>
          <DialogDescription>
            {caregiverName}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </DialogDescription>
        </DialogHeader>
        {items.length > 0 && (
          <div className="flex flex-col rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3.5 py-1">
            {items.map((e) => {
              const ci = categoryInfo(e.category);
              const gone = isDeleted(e);
              return (
                <div key={e.id} className={cn("flex flex-col gap-1 border-b border-[var(--hairline-soft)] py-2 last:border-0", gone && "opacity-60")}>
                  <div className="flex items-baseline gap-2.5">
                    <span className={cn("w-[76px] flex-none text-[12px] text-muted-foreground", gone && "line-through")}>{kindLabel(e)}</span>
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", gone && "line-through")}>{descriptionLine(e)}</span>
                    <span className={cn("flex-none text-[12.5px] tabular-nums", gone && "line-through")}>{ci.byMiles ? `${e.miles} mi` : `$${e.amount.toFixed(2)}`}</span>
                    {!gone && (
                      <span className={cn("flex-none text-[11px]", receiptMissing(e) ? "text-[#B54708]" : "text-muted-foreground")}>
                        {ci.byMiles ? (e.milesFrom === "gps" ? "GPS" : "typed") : e.receipt ? "receipt" : "no receipt"}
                      </span>
                    )}
                    {gone ? (
                      <button type="button" onClick={() => restore(e.id)} className="flex flex-none items-center gap-1 text-[12px] text-primary underline-offset-2 hover:underline">
                        <RotateCcw className="h-3 w-3" aria-hidden="true" /> Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${kindLabel(e)}`}
                        title={saved(e.id) ? `Kept ${DELETED_KEPT_DAYS} days, then gone for good` : "Not saved yet — comes straight off"}
                        onClick={() => remove(e.id)}
                        className="flex-none text-muted-foreground hover:text-[#B42318]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {gone ? (
                    <span className="text-[11.5px] text-muted-foreground">{deletedLine(e)}</span>
                  ) : needsReview(e) ? (
                    <span className="flex flex-wrap items-baseline gap-2 text-[11.5px]">
                      <span className="text-[#B54708]">Not reviewed yet — {ci.settlesTo === "client" ? "held off the invoice" : "held out of payroll"}.</span>
                      {mayReview(e, reviewer) ? (
                        <button type="button" onClick={() => review(e.id)} className="text-primary underline-offset-2 hover:underline">
                          Mark reviewed
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{whyNotReviewable(e, reviewer)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-[#027A48]">
                      Reviewed by {(e.reviewedBy ?? "").split(" ")[0]}
                      {e.reviewedAt ? ` · ${new Date(e.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  )}
                </div>
              );
            })}
            <div className="flex items-baseline gap-2.5 py-2 text-[12.5px]">
              <span className="text-muted-foreground">{expensesLine(items, ratePerMile)}</span>
              <span className="ml-auto font-semibold tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-date" className="text-[12px] font-medium">
                Date
              </Label>
              <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-cat" className="text-[12px] font-medium">
                Category
              </Label>
              <select id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="m-0 pt-0.5 text-[11.5px] leading-[1.4] text-muted-foreground [text-wrap:pretty]">
                {info.plain} {info.settlesTo === "client" ? "Goes on the client's invoice." : "Reimbursed through payroll."}
              </p>
            </div>
          </div>
          {category === "other" && (
            <div className="space-y-1">
              <Label htmlFor="exp-other" className="text-[12px] font-medium">
                What kind of expense
              </Label>
              <Input id="exp-other" value={otherKind} onChange={(e) => setOtherKind(e.target.value)} placeholder="Parking, tolls, a phone charger…" />
            </div>
          )}
          {info.byMiles ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="exp-from" className="text-[12px] font-medium">
                    From
                  </Label>
                  <Input id="exp-from" value={tripFrom} onChange={(e) => setTripFrom(e.target.value)} placeholder="Client's home" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="exp-to" className="text-[12px] font-medium">
                    To
                  </Label>
                  <Input id="exp-to" value={tripTo} onChange={(e) => setTripTo(e.target.value)} placeholder="Walgreens, Bellaire — and back" />
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="exp-miles" className="flex items-baseline gap-1.5 text-[12px] font-medium">
                    Miles
                    {milesFrom === "gps" && <span className="font-normal text-primary">· from GPS</span>}
                  </Label>
                  <Input
                    id="exp-miles"
                    type="number"
                    min="0"
                    step="0.1"
                    value={miles}
                    onChange={(e) => {
                      setMiles(e.target.value);
                      setMilesFrom("typed");
                    }}
                    placeholder="0"
                  />
                </div>
                <JoySuggests
                  className="max-w-[240px]"
                  headline={gpsMiles === null ? "No GPS trail on this visit, so Joy has no miles to offer — type them from the odometer." : `Joy read ${gpsMiles} miles off the GPS trail.`}
                  actions={
                    gpsMiles !== null ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMiles(String(gpsMiles));
                          setMilesFrom("gps");
                        }}
                        className="h-8 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-white hover:bg-[#2A1BD1]"
                      >
                        Use Joy's GPS miles
                      </button>
                    ) : undefined
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="exp-desc" className="text-[12px] font-medium">
                  Description
                </Label>
                <Input id="exp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kroger on Bellaire — weekly shop" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
                <div className="space-y-1">
                  <Label htmlFor="exp-amount" className="text-[12px] font-medium">
                    Amount
                  </Label>
                  <Input id="exp-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-medium">Receipt</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickReceipt("camera")} />
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickReceipt("upload")} />
                    <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                      <Camera className="mr-1.5 h-3.5 w-3.5" /> Take photo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
                    </Button>
                    {receipt && (
                      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <span className="max-w-[140px] truncate">{receipt.name}</span>
                        <button type="button" aria-label="Remove receipt" onClick={() => setReceipt(null)} className="hover:text-[#B42318]">
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" disabled={!!problem} onClick={add}>
              Add this expense
            </Button>
            {problem ? (
              <span className="min-w-0 flex-1 text-[12px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">{problem}</span>
            ) : noReceipt ? (
              <span className="min-w-0 flex-1 text-[12px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">No receipt — it can be saved, but the office will ask for one.</span>
            ) : null}
          </div>
          <p className="m-0 text-[11.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
            {REVIEW_RULE} Receipts are required from ${RECEIPT_REQUIRED_FROM}; a deleted expense is kept {DELETED_KEPT_DAYS} days, then gone. Kept three years as the IRS requires. The receipt image stays on this device in the prototype — the real system files it behind the client's chart.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(items);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
