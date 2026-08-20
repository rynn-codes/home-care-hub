import { Check, TriangleAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HIRING_ORDER,
  HIRING_STAGE_LABELS,
  NO_FIT_LABELS,
  ONBOARDING_ORDER,
  ONBOARDING_STAGE_LABELS,
  REQUIRED_BEFORE_FIRST_SHIFT,
  REQUIRED_TO_DRIVE,
  REQUIRED_WITHIN_FIRST_MONTH,
  canAdvanceHiring,
  canAdvanceOnboarding,
  canBecomeActiveEmployee,
  daysInStage,
  firstShiftReadiness,
  type Applicant,
  type NoFitReason,
} from "@/domain/hiring/pipeline";

/**
 * One applicant, and the moves available from where they are.
 *
 * Every stage button is shown, including the ones that are refused, with the
 * refusal underneath. A greyed button with no explanation is the thing that
 * makes people ring the office to ask why — and the refusals here are exactly
 * what someone needs to act on: "the background check has not cleared" is a
 * chase, not a mystery.
 */

const DOC_LABELS: Record<string, string> = {
  background_check: "Background check",
  tb_test: "TB test",
  licence: "Licence or certificate",
  cpr: "CPR certification",
  handbook: "Employee handbook",
  immunizations: "Immunisations",
  annual_training: "Annual training",
  drivers_license: "Driver's licence",
  auto_insurance: "Auto insurance",
};

interface Props {
  applicant: Applicant | null;
  today: string;
  onClose: () => void;
  onChange: (next: Applicant) => void;
}

export function ApplicantDrawer({ applicant, today, onClose, onChange }: Props) {
  return (
    <Sheet open={applicant !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {applicant && (
          <ApplicantBody
            applicant={applicant}
            today={today}
            onChange={onChange}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ApplicantBody({
  applicant,
  today,
  onChange,
  onClose,
}: {
  applicant: Applicant;
  today: string;
  onChange: (next: Applicant) => void;
  onClose: () => void;
}) {
  const readiness = firstShiftReadiness(applicant);
  const days = daysInStage(applicant, today);
  const stamp = () => today;

  const allDocs = [
    ...REQUIRED_BEFORE_FIRST_SHIFT,
    ...(applicant.drives ? REQUIRED_TO_DRIVE : []),
    ...REQUIRED_WITHIN_FIRST_MONTH,
  ];

  const toggleDoc = (key: string) => {
    const have = applicant.documents.includes(key);
    onChange({
      ...applicant,
      documents: have
        ? applicant.documents.filter((d) => d !== key)
        : [...applicant.documents, key],
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{applicant.name}</SheetTitle>
        <SheetDescription>
          {applicant.roleApplied} · applied {applicant.appliedOn} via {applicant.source}
        </SheetDescription>
      </SheetHeader>

      <dl className="mt-6 divide-y divide-border">
        {[
          ["Recruiter", applicant.recruiter ?? "Unassigned"],
          ["Availability", applicant.availability],
          ["Drives", applicant.drives ? "Yes" : "No"],
          ["Contact", `${applicant.phone} · ${applicant.email}`],
          ["In stage", days === 0 ? "Moved today" : `${days} days`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="text-right text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {applicant.track === "no_fit" && (
        <div className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
          <p className="text-sm font-semibold">Closed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {NO_FIT_LABELS[applicant.noFitReason ?? "not_a_fit"]}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              onChange({ ...applicant, track: "hiring", noFitReason: null, stageSince: stamp() })
            }
          >
            Reopen
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------- documents */}
      <section className="mt-6">
        <h3 className="text-sm font-semibold">Documents</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The first five stop a first shift. Immunisations and training are due but do not.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {allDocs.map((key) => {
            const have = applicant.documents.includes(key);
            const blocking = !REQUIRED_WITHIN_FIRST_MONTH.includes(
              key as (typeof REQUIRED_WITHIN_FIRST_MONTH)[number],
            );
            return (
              <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  {have ? (
                    <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        blocking ? "bg-destructive" : "bg-[hsl(var(--warning))]",
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span className={cn(!have && "text-muted-foreground")}>{DOC_LABELS[key] ?? key}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => toggleDoc(key)}>
                  {have ? "Remove" : "Mark received"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------------------------------------------------------- stages */}
      {applicant.track === "hiring" && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold">Move to</h3>
          <div className="mt-3 space-y-2">
            {HIRING_ORDER.filter((s) => s !== applicant.stage).map((stage) => {
              const check = canAdvanceHiring(applicant, stage);
              return (
                <div key={stage}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!check.allowed}
                    onClick={() => onChange({ ...applicant, stage, stageSince: stamp() })}
                    className="w-full justify-start"
                  >
                    {HIRING_STAGE_LABELS[stage]}
                  </Button>
                  {!check.allowed && check.reason && (
                    <p className="mt-1 px-1 text-xs text-muted-foreground">{check.reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          {applicant.stage === "offer" && (
            <Button
              className="mt-4 w-full"
              onClick={() =>
                onChange({
                  ...applicant,
                  track: "onboarding",
                  onboardingStage: "online_orientation",
                  offerAcceptedOn: stamp(),
                  stageSince: stamp(),
                })
              }
            >
              Offer accepted — start onboarding
            </Button>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">Close this applicant</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(NO_FIT_LABELS) as NoFitReason[]).map((reason) => (
                <Button
                  key={reason}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onChange({ ...applicant, track: "no_fit", noFitReason: reason, stageSince: stamp() });
                    onClose();
                  }}
                >
                  {NO_FIT_LABELS[reason]}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {applicant.track === "onboarding" && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold">Onboarding</h3>

          {!readiness.ready && (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                Cannot go out on a first shift
              </p>
              <ul className="mt-2 space-y-1">
                {readiness.missingBlocking.map((key) => (
                  <li key={key} className="text-sm text-muted-foreground">
                    {DOC_LABELS[key] ?? key} outstanding
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {ONBOARDING_ORDER.filter((s) => s !== applicant.onboardingStage).map((stage) => {
              const check = canAdvanceOnboarding(applicant, stage);
              return (
                <div key={stage}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!check.allowed}
                    onClick={() => onChange({ ...applicant, onboardingStage: stage, stageSince: stamp() })}
                    className="w-full justify-start"
                  >
                    {ONBOARDING_STAGE_LABELS[stage]}
                  </Button>
                  {!check.allowed && check.reason && (
                    <p className="mt-1 px-1 text-xs text-muted-foreground">{check.reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            {(() => {
              const check = canBecomeActiveEmployee(applicant);
              return (
                <>
                  <Button
                    className="w-full"
                    disabled={!check.allowed}
                    onClick={() => {
                      onChange({ ...applicant, track: "hired", stageSince: stamp() });
                      onClose();
                    }}
                  >
                    Complete onboarding — becomes an active employee
                  </Button>
                  {!check.allowed && check.reason && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{check.reason}</p>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      )}

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Payroll setup runs in Gusto — W-4, I-9 and direct deposit are completed there, and Joy
        records only whether they are done. That boundary is deliberate and not wired up yet.
      </p>
    </>
  );
}
