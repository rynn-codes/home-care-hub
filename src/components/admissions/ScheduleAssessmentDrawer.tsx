import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDemo } from "@/context/DemoDataProvider";
import { isEnabled } from "@/lib/featureFlags";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  clientName: string;
  contactName: string;
  defaultAddress: string;
}

// Joy Health's registered nurses. Clients in the seed remain fictional.
const ASSESSORS = ["Kelsey Westley, RN", "Karynn Verrett, RN"];

/**
 * Schedule the RN assessment.
 *
 * The last step of the Golden Sprint 1 Demo (§47). What it demonstrates, and why
 * each part is there:
 *
 *  - Contact details carry forward from intake. §47 step 16: existing data is
 *    not re-entered.
 *  - The address is confirmed HERE, not at the start of the call. That is the
 *    source-form rule in §11.
 *  - Scheduling and notifying are separate. The schedule event commits; the
 *    message is queued afterwards. A failed notification never un-books the
 *    visit — §16.
 *  - With SPRUCE_ENABLED off, the notification is honestly reported as not sent
 *    rather than shown as delivered. §41: never fake success.
 */
export function ScheduleAssessmentDrawer({
  open,
  onOpenChange,
  admissionId,
  clientName,
  contactName,
  defaultAddress,
}: Props) {
  const navigate = useNavigate();
  const { scheduleAssessment, communications, retryCommunication } = useDemo();

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("10:30");
  const [duration, setDuration] = useState(90);
  const [assessor, setAssessor] = useState(ASSESSORS[0]);
  const [address, setAddress] = useState(defaultAddress);
  const [booked, setBooked] = useState<string | null>(null);

  const spruceOn = isEnabled("SPRUCE_ENABLED");
  const notification = communications.find((c) => c.entityId === booked);

  const submit = () => {
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    scheduleAssessment({
      admissionId,
      clientName,
      assessorName: assessor,
      startsAt,
      durationMinutes: duration,
      address,
      notifyName: contactName,
      // Spruce is not connected, so the send cannot succeed. Modelling that
      // honestly is the point — a demo that shows "Sent" would be a lie about
      // an integration that does not exist.
      simulateFailure: !spruceOn,
    });
    setBooked("pending");
  };

  // The store assigns the real id; find the newest notification for this client.
  const latest = communications[0];
  const showResult = booked !== null && latest;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{showResult ? "Assessment scheduled" : "Schedule RN assessment"}</SheetTitle>
          <SheetDescription>
            {showResult
              ? "The visit is on the schedule. The family notification is tracked separately."
              : `${clientName} · everything captured at intake carries into the visit.`}
          </SheetDescription>
        </SheetHeader>

        {!showResult ? (
          <div className="mt-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date" className="text-xs font-medium">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="time" className="text-xs font-medium">Start time</Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="duration" className="text-xs font-medium">Expected duration</Label>
                <Input
                  id="duration"
                  type="number"
                  min={30}
                  step={15}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assessor" className="text-xs font-medium">Assessor</Label>
                <select
                  id="assessor"
                  value={assessor}
                  onChange={(e) => setAssessor(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ASSESSORS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address" className="text-xs font-medium">Where the visit happens</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                From the referral — confirm the full address with the family. This is the first
                point the call asks for it.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notify through Spruce
              </p>
              <p className="mt-2 text-sm">{contactName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {spruceOn
                  ? "Will be sent once the visit is booked."
                  : "Spruce is not connected in this environment, so the message will be queued and reported as not sent."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={submit}>Schedule assessment</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
                Visit booked
              </p>
              <p className="mt-2 text-sm">
                {new Date(`${date}T${time}:00`).toLocaleString([], {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {assessor} · {address} · {duration} min
              </p>
            </div>

            {/* The notification's own outcome, reported separately from the
                booking — because it succeeded or failed independently. */}
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Family notification
              </p>
              {latest?.status === "failed" ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
                    Not sent — {latest.errorMessage}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The assessment is still scheduled. Only the message failed.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => retryCommunication(latest.id)}
                  >
                    Retry notification
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm">
                  Queued for {latest?.recipientName}. It will show as sent once Spruce confirms it.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate("/admissions");
                }}
              >
                Back to Admissions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/scheduling");
                }}
              >
                View on schedule
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
