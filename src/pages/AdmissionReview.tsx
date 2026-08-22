import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/context/DemoDataProvider";
import {
  GATE_STATE_LABELS,
  checkAdmission,
  gateSatisfied,
  startOfCareRestrictions,
} from "@/domain/admissions/readiness";
import { PAYMENT_SETUP_LABELS, type PaymentSetupState } from "@/domain/billing/paymentSetup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { admissionIsMovingForward } from "@/domain/admissions/classify";
import { FamilyPortalCard } from "@/components/clients/FamilyPortalCard";
import type { Invitation } from "@/domain/hiring/invitation";
import { canCompleteAssessment } from "@/domain/assessment/questions";
import { cn } from "@/lib/utils";

/**
 * Pre-onboarding, the admission decision, and start of care.
 *
 * §37. Joy assembles the picture; a human admits. §26 keeps admissions at
 * "prepare summary" authority — nothing here approves anyone automatically, and
 * the approver's name is recorded because it is a consequential decision.
 *
 * The last step is the one that matters architecturally. Activating a client
 * adds a client profile to the person who has existed since the referral. It
 * does not create a second record — §10 forbids it, and the screen says so
 * where someone might otherwise wonder.
 */
export default function AdmissionReview() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const {
    admissions, people, intakes, assessments, consentSessions, preOnboarding,
    savePreOnboarding, approveAdmission, activateClient,
  } = useDemo();

  const admission = admissions.find((a) => a.id === id);
  const consent = consentSessions[id];
  const pre = preOnboarding[id];
  const [approver, setApprover] = useState("Karynn Verrett");
  const [overrideReason, setOverrideReason] = useState("");
  const [familyInvitation, setFamilyInvitation] = useState<Invitation | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
  );

  const check = useMemo(
    () =>
      checkAdmission({
        intakeComplete: Boolean(intakes[id]?.completedAt),
        assessmentComplete: canCompleteAssessment(assessments[id]?.answers ?? {}),
        consentDecisions: consent?.decisions ?? {},
        packetSigned: Boolean(consent?.signedAt),
        paymentSetup: pre?.paymentSetup ?? "not_started",
        carePlanApproved: Boolean(pre?.carePlanApproved),
        // Nothing requests documents during an admission in the demo data yet;
        // an empty list reads as "nothing has been requested", which is true.
        requestedDocuments: [],
        startOfCareDate: pre?.startOfCareDate ?? startDate,
        // The caller from phone intake is the responsible party §19 invites —
        // if intake captured them, billing has somewhere to send an invoice.
        billingContactNamed: Boolean(
          (intakes[id]?.answers as Record<string, unknown> | undefined)?.caller_name,
        ),
        rateAgreed: Boolean(pre?.rateAgreed),
        override: pre?.gateOverride
          ? { reason: pre.gateOverride.reason, byUserId: pre.gateOverride.by, at: pre.gateOverride.at }
          : null,
      }),
    [id, intakes, assessments, consent, pre, startDate],
  );

  // §19's gate, live on the screen where the admission actually is. The client
  // record has carried this card for a while, but a client record only exists
  // after activation — and §19's whole point is that the family gets the portal
  // DURING the admission, so a daughter can upload the medication list and
  // watch the start-of-care date settle rather than ringing to ask.
  const movingForward = admissionIsMovingForward({
    stage: admission?.stage ?? "new_referral",
    status: admission?.status ?? "active",
  });

  // The caller from phone intake. §19's link goes to the responsible party, and
  // that is the person Joy has already been speaking to — asking for the number
  // again when it is sitting in the intake is how it gets typed in wrong.
  const intakeAnswers = (intakes[id]?.answers ?? {}) as Record<string, unknown>;
  const callerName =
    typeof intakeAnswers.caller_name === "string" ? intakeAnswers.caller_name : null;
  const callerPhone =
    typeof intakeAnswers.caller_phone === "string" ? intakeAnswers.caller_phone : null;

  const restrictions = useMemo(
    () => startOfCareRestrictions(consent?.decisions ?? {}),
    [consent],
  );

  if (!admission) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-lg font-semibold">That admission isn't here</h1>
        <Button className="mt-5" onClick={() => navigate("/admissions")}>Back to Admissions</Button>
      </div>
    );
  }

  const person = people.find((p) => `${p.firstName} ${p.lastName}` === admission.name);
  const activated = Boolean(pre?.activatedAt);
  const approved = Boolean(pre?.approvedAt);

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admissions")} aria-label="Back to Admissions">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Admissions · Review for admission</p>
          <h1 className="truncate text-lg font-semibold">{admission.name}</h1>
        </div>
      </div>

      {activated ? (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--success))]">
            <Check className="h-4 w-4" aria-hidden="true" />
            Active client
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            Care starts {new Date(pre!.startOfCareDate!).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {admission.name}'s record now lives under Clients. The same person row has carried
            through from the referral — admission added a client profile to it rather than
            creating a second record.
          </p>

          {restrictions.length > 0 && (
            <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
              <p className="text-sm font-semibold">Caregiver restrictions from the signed packet</p>
              <ul className="mt-2 space-y-1.5">
                {restrictions.map((r) => (
                  <li key={r} className="text-sm text-muted-foreground">{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button onClick={() => navigate(person ? `/clients/${person.personId}` : "/clients")}>
              Open client record
            </Button>
            <Button variant="outline" onClick={() => navigate("/admissions")}>Back to Admissions</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-surface p-7">
            <h2 className="text-lg font-semibold tracking-tight">Readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What the office needs before {admission.name.split(" ")[0]} can be admitted.
            </p>

            <ul className="mt-4 divide-y divide-border">
              {check.items.map((item) => (
                <li key={item.key} className="flex items-start gap-3 py-3">
                  <span aria-hidden="true" className="mt-0.5">
                    {gateSatisfied(item.state) ? (
                      <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                    ) : item.state === "needs_attention" ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 text-xs",
                    gateSatisfied(item.state) ? "text-[hsl(var(--success))]"
                      : item.state === "needs_attention" ? "text-destructive"
                      : "text-[hsl(var(--warning))]",
                  )}>
                    {GATE_STATE_LABELS[item.state]}
                  </span>
                </li>
              ))}
            </ul>

            {/* What the office records itself. Payment setup is picked by hand
                only until billing accounts are wired live — §4.2 wants it
                computed, and paymentSetupFrom() is waiting to compute it. */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <span id="payment-state-label" className="text-xs font-medium text-muted-foreground">
                  Payment setup
                </span>
                <Select
                  value={pre?.paymentSetup ?? "not_started"}
                  onValueChange={(v) =>
                    savePreOnboarding(id, { paymentSetup: v as PaymentSetupState })
                  }
                >
                  <SelectTrigger aria-labelledby="payment-state-label" className="h-8 w-56 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_SETUP_LABELS) as PaymentSetupState[]).map((state) => (
                      <SelectItem key={state} value={state}>
                        {PAYMENT_SETUP_LABELS[state]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant={pre?.rateAgreed ? "default" : "outline"}
                onClick={() => savePreOnboarding(id, { rateAgreed: !pre?.rateAgreed })}
              >
                {pre?.rateAgreed ? "Rate recorded" : "Record the agreed rate"}
              </Button>
              <Button
                size="sm"
                variant={pre?.carePlanApproved ? "default" : "outline"}
                onClick={() => savePreOnboarding(id, { carePlanApproved: !pre?.carePlanApproved })}
              >
                {pre?.carePlanApproved ? "Plan of care approved" : "Approve plan of care"}
              </Button>
            </div>
          </section>

          {/* §19. Offered as soon as the gate opens rather than after
              activation — a family whose father starts on Monday has documents
              to send and a date to watch this week, not next. */}
          <div className="mt-5">
            <FamilyPortalCard
              clientName={admission.name}
              clientPersonId={admission.id}
              responsibleParty={callerName}
              responsiblePartyPhone={callerPhone}
              assessmentComplete={canCompleteAssessment(assessments[id]?.answers ?? {})}
              movingForward={movingForward}
              existing={familyInvitation}
              onInvite={setFamilyInvitation}
            />
          </div>

          <section className="mt-5 rounded-2xl border border-border bg-surface p-7">
            <h2 className="text-lg font-semibold tracking-tight">
              {approved ? "Prepare start of care" : "Admission decision"}
            </h2>

            {!approved ? (
              <>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                  Joy has assembled the picture. The decision is yours, and your name goes on it.
                </p>

                {check.reason && (
                  <p className={cn(
                    "mt-4 rounded-xl border p-3.5 text-sm",
                    check.blocked.length > 0
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)]",
                  )}>
                    {check.reason}
                  </p>
                )}

                {/* §4.2's documented exception. Only offered when gates are
                    unsatisfied but nothing is a hard stop — a refused consent
                    cannot be excepted past, and the button never appears. */}
                {!check.canAdmit && check.blocked.every((b) => b.key !== "consents") && (
                  <div className="mt-4 max-w-prose rounded-xl border border-border bg-surface-muted p-4">
                    <p className="text-xs font-medium">Admit anyway, with a documented exception</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A reason, your name, and an audit entry. The gates stay visible — an
                      exception explains a decision, it does not tidy one away.
                    </p>
                    <Input
                      className="mt-2"
                      placeholder="Why admission should proceed — words a surveyor could read"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={!overrideReason.trim() || !approver.trim()}
                      onClick={() =>
                        savePreOnboarding(id, {
                          gateOverride: {
                            reason: overrideReason.trim(),
                            by: approver.trim(),
                            at: new Date().toISOString(),
                          },
                        })
                      }
                    >
                      Document the exception
                    </Button>
                  </div>
                )}

                {pre?.gateOverride && (
                  <p className="mt-4 max-w-prose rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-3.5 text-sm">
                    Exception documented by {pre.gateOverride.by}: {pre.gateOverride.reason}
                  </p>
                )}

                <div className="mt-4 max-w-sm">
                  <Label htmlFor="approver" className="text-xs font-medium">Approving as</Label>
                  <Input
                    id="approver"
                    className="mt-1.5"
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    disabled={!check.canAdmit || !approver.trim()}
                    onClick={() => approveAdmission(id, approver.trim())}
                  >
                    Approve admission
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/admissions")}>Not yet</Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approved by {pre?.approvedBy}. Set the first day of care.
                </p>

                <div className="mt-4 max-w-sm">
                  <Label htmlFor="startDate" className="text-xs font-medium">Start of care</Label>
                  <Input
                    id="startDate"
                    type="date"
                    className="mt-1.5"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {restrictions.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
                    <p className="text-sm font-semibold">Carried to the caregiver</p>
                    <ul className="mt-2 space-y-1.5">
                      {restrictions.map((r) => (
                        <li key={r} className="text-sm text-muted-foreground">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-4 text-xs text-muted-foreground">
                  Activating uses the existing person record — {person ? `${person.firstName} ${person.lastName}` : admission.name} has
                  been one record since the referral, and stays one.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button onClick={() => activateClient(id, startDate)}>
                    Activate client
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/admissions")}>Later</Button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
