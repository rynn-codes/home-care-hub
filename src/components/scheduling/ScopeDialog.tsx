import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Visit } from "@/domain/scheduling/conflicts";
import { SCOPE_LABELS, SCOPE_MEANINGS, affectedByScope, affectedSummary, alreadyWorked, type EditScope } from "@/domain/scheduling/visitState";

const SCOPES: EditScope[] = ["this", "future", "series"];

/** For a visit in a series: this one, this and future, or the whole series. */
export function ScopeDialog({
  open,
  onOpenChange,
  visit,
  allVisits,
  recurrenceLine,
  fmtDay,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: Visit | null;
  allVisits: readonly Visit[];
  recurrenceLine: string | null;
  fmtDay: (iso: string) => string;
  onContinue: (scope: EditScope, affected: Visit[]) => void;
}) {
  const [scope, setScope] = useState<EditScope>("this");
  if (!visit) return null;
  const now = new Date();
  const affected = affectedByScope({ visit, all: allVisits, scope, now });
  const worked = visit.seriesId ? allVisits.filter((v) => v.seriesId === visit.seriesId && alreadyWorked(v, now)).length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setScope("this");
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-[480px] gap-0">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-[17px] tracking-[-.01em]">Apply this change to</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {visit.clientName}
            {recurrenceLine ? ` · ${recurrenceLine}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Apply this change to">
          {SCOPES.map((s) => {
            const on = scope === s;
            const would = affectedByScope({ visit, all: allVisits, scope: s, now });
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setScope(s)}
                className={cn("flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors", on ? "border-primary bg-[#F7F7FE]" : "border-[var(--hairline)] hover:bg-[var(--wash)]")}
              >
                <span className={cn("mt-[2px] flex h-[16px] w-[16px] flex-none items-center justify-center rounded-full border-2 transition-colors", on ? "border-primary" : "border-[#C9C9D4]")} aria-hidden="true">
                  {on && <span className="h-[7px] w-[7px] rounded-full bg-primary" />}
                </span>
                <span className="flex min-w-0 flex-col gap-[2px]">
                  <span className="text-[13.5px] font-medium">{SCOPE_LABELS[s]}</span>
                  <span className="text-[12px] leading-[1.4] text-muted-foreground [text-wrap:pretty]">{SCOPE_MEANINGS[s]}</span>
                  <span className={cn("mt-[3px] text-[11.5px] tabular-nums", on ? "text-primary" : "text-muted-foreground")}>{affectedSummary(would, fmtDay)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {worked > 0 && (
          <p className="m-0 mt-3 text-[11.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
            {worked} in this series {worked === 1 ? "has" : "have"} already been worked, so{worked === 1 ? " it is" : " they are"} left alone — a visit that has happened is never rewritten.
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-4 text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={affected.length === 0}
            onClick={() => onContinue(scope, affected)}
            className={cn(
              "h-[38px] flex-1 rounded-[10px] px-4 text-[13px] font-medium transition-colors sm:flex-none sm:min-w-[140px]",
              affected.length === 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]",
            )}
          >
            Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
