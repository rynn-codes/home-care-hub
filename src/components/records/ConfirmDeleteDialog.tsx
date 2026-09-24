import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONFIRM_WORD, DEFAULT_RECOVERY_DAYS, confirmsDeletion } from "@/domain/records/deletion";

/**
 * The one delete dialog. Says what goes with the record, how long it can be
 * brought back, and asks for the word DELETE — a mis-click cannot type it.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  subject,
  consequences,
  permanent = false,
  recoveryDays = DEFAULT_RECOVERY_DAYS,
  askForReason = false,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Who or what, under the title. */
  subject: string;
  consequences: string[];
  permanent?: boolean;
  recoveryDays?: number;
  askForReason?: boolean;
  confirmLabel?: string;
  onConfirm: (reason: string | null) => void;
}) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setTyped("");
      setReason("");
    }
  }, [open]);
  const ok = confirmsDeletion(typed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-[18px] w-[18px] text-[#B42318]" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-[10px] border border-[#FBD9D3] bg-[#FFFBFA] p-3">
            <p className="m-0 text-[12px] font-medium text-[#912018]">
              {permanent ? "This cannot be undone" : "What goes with it"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {consequences.map((c) => (
                <li key={c} className="text-[12.5px] leading-[1.45] text-[var(--ink-body)]">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground">
            {permanent
              ? "This record is being removed for good. Nothing brings it back."
              : `It moves to Deleted items and can be brought back for ${recoveryDays} days. After that it goes for good.`}
          </p>
          {askForReason && (
            <div className="space-y-1">
              <Label htmlFor="delete-reason" className="text-[12px] font-medium">
                Reason (optional)
              </Label>
              <Input
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Duplicate · wrong person · never wanted care"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="delete-word" className="text-[12px] font-medium">
              Type {CONFIRM_WORD} to confirm
            </Label>
            <Input
              id="delete-word"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={!ok}
            onClick={() => {
              if (!ok) return;
              onConfirm(reason.trim() || null);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
