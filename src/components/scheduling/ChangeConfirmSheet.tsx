import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JoyWarns } from "@/components/scheduling/joy";

/**
 * "Change this visit?" — every schedule change is confirmed by a person, with
 * the before and after side by side and who will be affected. Nobody is
 * notified: Spruce is not wired, and the sheet says so on every line.
 */

export type ChangeKind = "assign" | "reassign" | "unassign" | "create" | "cancel" | "edit";

export interface ChangeRow {
  label: string;
  from: string | null;
  to: string | null;
}

export interface PendingChange {
  kind: ChangeKind;
  clientName: string;
  service?: string;
  when?: string;
  rows: ChangeRow[];
  affects: string[];
  visitCount: number;
  blocker?: string | null;
  warning?: string | null;
}

const visits = (n: number) => `${n} ${n === 1 ? "visit" : "visits"}`;

export function changedRows(rows: readonly ChangeRow[]): ChangeRow[] {
  return rows.filter((r) => (r.from ?? "") !== (r.to ?? ""));
}

/** True when an edit changes nothing worth confirming. */
export function nothingChanged(change: PendingChange): boolean {
  return change.kind === "create" || change.kind === "cancel" ? false : changedRows(change.rows).length === 0;
}

function title(c: PendingChange): string {
  switch (c.kind) {
    case "assign":
      return "Put this shift on somebody?";
    case "reassign":
      return "Change who works this visit?";
    case "unassign":
      return "Take this visit off the caregiver?";
    case "create":
      return "Add this to the schedule?";
    case "cancel":
      return "Cancel this visit?";
    case "edit":
      return c.visitCount > 1 ? `Save these changes to ${visits(c.visitCount)}?` : "Save these changes?";
  }
}

function confirmLabel(c: PendingChange): string {
  switch (c.kind) {
    case "assign":
      return "Assign the shift";
    case "reassign":
      return "Change the caregiver";
    case "unassign":
      return "Take it off her";
    case "create":
      return "Add to the schedule";
    case "cancel":
      return "Cancel the visit";
    case "edit":
      return c.visitCount > 1 ? `Save ${visits(c.visitCount)}` : "Save the changes";
  }
}

function seriesNote(c: PendingChange): string | null {
  if (c.visitCount <= 1) return null;
  return c.kind === "create" ? `This puts ${visits(c.visitCount)} on the board.` : `This applies to ${visits(c.visitCount)} in the series, not only the one on screen.`;
}

export function ChangeConfirmSheet({ change, onCancel, onConfirm }: { change: PendingChange | null; onCancel: () => void; onConfirm: () => void }) {
  if (!change) return null;
  const rows = changedRows(change.rows);
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(25,26,46,.24)]" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-50 flex max-h-[88vh] w-[calc(100%-32px)] max-w-[452px] translate-x-[-50%] translate-y-[-50%] flex-col overflow-y-auto rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] shadow-[0_24px_60px_rgba(25,26,46,.18)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <div className="flex flex-col gap-[5px] px-[22px] pt-5">
            <DialogTitle className="text-[17px] font-semibold tracking-[-.01em]">{title(change)}</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {[change.clientName, change.service, change.when].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-4 px-[22px] py-[18px]">
            {rows.length > 0 && (
              <div className="flex flex-col">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-baseline gap-3.5 border-b border-[var(--hairline-soft)] py-2">
                    <span className="w-[104px] flex-none text-[12.5px] text-muted-foreground">{r.label}</span>
                    <span className="flex flex-1 items-baseline gap-2 text-[13px]">
                      {r.from ? (
                        <>
                          <span className="text-muted-foreground line-through decoration-[var(--hairline)]">{r.from}</span>
                          <span className="text-[11px] text-muted-foreground/60" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : null}
                      <span className="font-semibold">{r.to || "Nothing"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {seriesNote(change) && <span className="text-[12.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">{seriesNote(change)}</span>}
            {change.blocker && (
              <JoyWarns title="This creates a conflict">
                <span className="text-[12.5px] leading-[1.45] text-[#98322C]">{change.blocker}</span>
              </JoyWarns>
            )}
            {!change.blocker && change.warning && (
              <div className="flex flex-col gap-1 rounded-[11px] border border-[#F5DFB8] bg-[#FEF8EC] px-3.5 py-3">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.085em] text-[#B54708]">Worth knowing</span>
                <span className="text-[12.5px] leading-[1.45] text-[#93370D]">{change.warning}</span>
              </div>
            )}
            {change.affects.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Who this change affects</span>
                {change.affects.map((who) => (
                  <span key={who} className="flex items-center gap-2">
                    <span className="text-[12.5px]">{who}</span>
                    <span className="text-[11.5px] text-muted-foreground">Spruce · not wired yet</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 rounded-b-2xl border-t border-[var(--hairline)] bg-[var(--paper-sunken)] px-[22px] py-3.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-[38px] flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash-strong)] hover:text-foreground"
            >
              {change.blocker ? "Leave it as it was" : "Go back"}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={
                change.kind === "cancel"
                  ? "h-[38px] flex-[1.4] rounded-[10px] bg-[#D92D20] text-[13px] font-medium text-white transition-colors hover:bg-[#B42318]"
                  : "h-[38px] flex-[1.4] rounded-[10px] bg-primary text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
              }
            >
              {confirmLabel(change)}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
