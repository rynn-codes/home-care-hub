import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/context/DemoDataProvider";
import { SERVICES } from "@/domain/scheduling/serviceMix";
import { amendmentDisclaimer, amendmentText, type ClientSchedule } from "@/domain/scheduling/clientSchedule";

/**
 * The schedule amendment Joy drafts. Nothing is sent or signed here — no
 * e-signature provider is connected — so the buttons record what a person
 * did outside the prototype.
 */
export function AgreementDialog({
  open,
  onOpenChange,
  schedule,
  previous,
  hourlyRate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ClientSchedule | null;
  previous: ClientSchedule | null;
  hourlyRate: number | null;
}) {
  const { sendScheduleAgreement, signScheduleAgreement, currentUser } = useDemo();
  const [copied, setCopied] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  if (!schedule) return null;
  const draft = amendmentText({ schedule, previous, services: [...SERVICES], hourlyRate });
  const text = edited ?? draft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <span className="text-[11px] font-semibold uppercase tracking-[.085em] text-muted-foreground">Joy has drafted this</span>
          <DialogTitle className="text-[19px] tracking-[-.015em]">Schedule amendment · {schedule.clientName}</DialogTitle>
          <DialogDescription>{amendmentDisclaimer()}</DialogDescription>
        </DialogHeader>
        {editing ? (
          <textarea
            aria-label="The amendment text"
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            className="m-0 h-[46vh] w-full resize-y rounded-[11px] border border-input bg-background px-4 py-3.5 font-sans text-[12.5px] leading-[1.6] text-[var(--ink-body)]"
          />
        ) : (
          <pre className="m-0 max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-3.5 font-sans text-[12.5px] leading-[1.6] text-[var(--ink-body)]">
            {text}
          </pre>
        )}
        <p className="m-0 text-[12px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
          Only the services and schedule page changes. Payment, cancellation, overtime, holiday and consent terms are untouched and stay in force.
        </p>
        <DialogFooter className="sm:justify-between">
          <span className="order-last text-[12px] text-muted-foreground sm:order-first sm:self-center">{copied ? "Copied — paste it wherever it is sent from." : ""}</span>
          <span className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setEditing((e) => !e)}>
              {editing ? "Done editing" : "Edit the wording"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              Copy the text
            </Button>
            {!schedule.agreementSentAt && (
              <Button
                variant="outline"
                onClick={() => {
                  sendScheduleAgreement(schedule.id, currentUser.name, new Date().toISOString());
                  toast.success(`Marked as sent to ${schedule.clientName}`, { description: "Joy will chase it after three days. Nothing was e-mailed — send it however you normally do." });
                  onOpenChange(false);
                }}
              >
                Mark as sent
              </Button>
            )}
            <Button
              onClick={() => {
                signScheduleAgreement(schedule.id, currentUser.name, new Date().toISOString());
                toast.success(`${schedule.clientName}'s schedule is agreed`, { description: "Recorded against this schedule. Joy did not send or sign anything — that was done outside the prototype." });
                onOpenChange(false);
              }}
            >
              Mark it signed
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
