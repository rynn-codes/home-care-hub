import { useState } from "react";
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
import { PHONE_PROBLEM_MESSAGES, formatPhone, normalizePhone } from "@/domain/portal/phone";

/**
 * Inviting a candidate Joy has decided to move forward with.
 *
 * WHY THIS IS NOT "ADD APPLICANT"
 *
 * The button here used to say Add applicant and did nothing — a defect, and one
 * that turned out to be pointing at the right answer. §2 says GHL owns
 * recruiting through the in-person interview and that "Joy does not need to
 * house every early-stage applicant". A screen for typing in people who have
 * not been interviewed would build the duplicate pipeline that section exists
 * to prevent, and Karynn would end up maintaining two lists of the same
 * candidates.
 *
 * So the action is the boundary itself: Karynn has just interviewed somebody
 * and wants to move forward. That decision is what creates the Joy record and
 * sends the portal link, in one step, because in the real workflow they are one
 * step.
 *
 * The same fields are what a GHL webhook would carry, so the automated path
 * later replaces the typing without changing anything behind it.
 */

export interface InviteDraft {
  name: string;
  roleApplied: string;
  phone: string;
  email: string;
}

export function InviteCandidateDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (draft: InviteDraft & { e164: string }) => void;
}) {
  const [draft, setDraft] = useState<InviteDraft>({
    name: "",
    roleApplied: "Caregiver",
    phone: "",
    email: "",
  });
  const [touched, setTouched] = useState(false);

  const phone = normalizePhone(draft.phone);
  // `"problem" in phone` rather than `!phone.ok`, deliberately. This project
  // compiles with `strict: false`, and with strictNullChecks off TypeScript
  // does not narrow a union by a boolean discriminant — it keeps the `ok: true`
  // arm in both branches. `in` narrowing works either way.
  //
  // The original read `phone.reason`, which exists on neither arm, so a
  // mistyped number showed an empty red line and no explanation. Nothing caught
  // it: the build does not type-check, and no test rendered this dialog.
  const phoneProblem = "problem" in phone ? PHONE_PROBLEM_MESSAGES[phone.problem] : null;
  const nameOk = draft.name.trim().length > 1;
  const ready = nameOk && phone.ok;

  function reset() {
    setDraft({ name: "", roleApplied: "Caregiver", phone: "", email: "" });
    setTouched(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a candidate</DialogTitle>
          <DialogDescription>
            For someone you have already interviewed in person and want to move forward with.
            Joy will text them a link to start their application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="As they gave it in the interview"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Applying for</Label>
            <Input
              id="invite-role"
              value={draft.roleApplied}
              onChange={(e) => setDraft({ ...draft, roleApplied: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-phone">Mobile number</Label>
            <Input
              id="invite-phone"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              onBlur={() => setTouched(true)}
              placeholder="(713) 555-0100"
              aria-describedby="invite-phone-note"
              aria-invalid={touched && draft.phone.length > 0 && !phone.ok}
            />
            <p id="invite-phone-note" className="text-xs text-muted-foreground">
              {touched && draft.phone.length > 0 && !phone.ok ? (
                // `problem`, not `reason` — this was rendering undefined, so a
                // mistyped number showed an empty red line and no explanation.
                <span className="text-destructive">{phoneProblem}</span>
              ) : phone.ok ? (
                // Shown back formatted so a mistyped digit is visible before
                // the link goes to a stranger's phone.
                `Joy will text ${formatPhone(phone.e164)}`
              ) : (
                "This is the number they will sign in with, so it must be their mobile."
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email (optional)</Label>
            <Input
              id="invite-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              if (!phone.ok) return;
              onInvite({ ...draft, e164: phone.e164 });
              reset();
            }}
          >
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
