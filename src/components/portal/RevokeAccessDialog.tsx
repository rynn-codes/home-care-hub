import { useState } from "react";
import { ShieldOff } from "lucide-react";
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
import {
  REVOCATION_LABELS,
  type PortalGrant,
  type RevocationReason,
} from "@/domain/portal/identity";
import { cn } from "@/lib/utils";

/**
 * Withdrawing somebody's portal access.
 *
 * Issuing access existed on both sides; taking it back did not, so a caregiver
 * who left in March kept a working login and a discharged client's daughter
 * kept reading a schedule she had no further business seeing.
 *
 * The reason is required and comes from a closed list, because these are the
 * reasons that actually occur and a typed one can be searched for later. `other`
 * takes a note.
 *
 * The dialog says plainly what will and will not happen. "Their login will stop
 * working" is what somebody expects; that their Joy record survives, and that
 * revoking a portal grant is not the same as deactivating an employee, is the
 * part people get wrong — and getting it wrong here means somebody deletes a
 * caregiver to close a portal.
 */

const REASONS: RevocationReason[] = [
  "employment_ended",
  "client_discharged",
  "no_longer_authorised",
  "requested_by_person",
  "issued_in_error",
  "other",
];

export function RevokeAccessDialog({
  open,
  onOpenChange,
  grant,
  personName,
  onRevoke,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant: PortalGrant;
  personName: string;
  onRevoke: (input: { reason: RevocationReason; note: string }) => void;
}) {
  const [reason, setReason] = useState<RevocationReason | null>(null);
  const [note, setNote] = useState("");

  const ready = reason !== null && (reason !== "other" || note.trim().length > 2);

  // A family grant is about somebody's care; a workforce one is about work.
  // Naming which is being withdrawn matters for the person who holds both.
  const what =
    grant.audience === "family"
      ? `access to ${grant.subjectName ?? "this client"}'s care`
      : "access to their work portal";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason(null);
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw {personName}'s access</DialogTitle>
          <DialogDescription>
            This removes {what}. Their login stops working on their next request — not at their
            next sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs">Why</Label>
          {REASONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setReason(value)}
              aria-pressed={reason === value}
              className={cn(
                "block w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                reason === value
                  ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                  : "border-border hover:bg-surface-muted",
              )}
            >
              {REVOCATION_LABELS[value]}
            </button>
          ))}

          {reason === "other" && (
            <Input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="In a few words"
              className="mt-2"
            />
          )}
        </div>

        <p className="rounded-xl border border-border bg-surface-muted p-3 text-xs text-muted-foreground">
          Their Joy record, documents and history are kept. This closes the portal only — it does
          not remove them from Joy or end their employment.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => {
              if (!reason) return;
              onRevoke({ reason, note: note.trim() });
              onOpenChange(false);
            }}
          >
            <ShieldOff className="mr-1.5 h-4 w-4" />
            Withdraw access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
