import { Check, TriangleAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  HIRING_ORDER,
  HIRING_STAGE_LABELS,
  NO_FIT_LABELS,
  ONBOARDING_ORDER,
  ONBOARDING_STAGE_LABELS,
  documentsDueSoonAfterHire,
  documentsRequiredBeforeFirstShift,
  roleFromApplication,
  canAdvanceHiring,
  canAdvanceOnboarding,
  canBecomeActiveEmployee,
  daysInStage,
  firstShiftReadiness,
  type Applicant,
  type HireDetails,
  type NoFitReason,
} from "@/domain/hiring/pipeline";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";

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
  onHire: (applicant: Applicant, details: HireDetails) => void;
}

export function ApplicantDrawer({ applicant, today, onClose, onChange, onHire }: Props) {
  return (
    <Sheet open={applicant !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {applicant && (
          <ApplicantBody
            applicant={applicant}
            today={today}
            onChange={onChange}
            onClose={onClose}
            onHire={onHire}
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
  onHire,
}: {
  applicant: Applicant;
  today: string;
  onChange: (next: Applicant) => void;
  onClose: () => void;
  onHire: (applicant: Applicant, details: HireDetails) => void;
}) {
  const readiness = firstShiftReadiness(applicant);
  const days = daysInStage(applicant, today);
  const stamp = () => today;

  // Read from Joy's credential requirements, so hiring asks for exactly what
  // scheduling will later insist on.
  const role = roleFromApplication(applicant.roleApplied);
  const blockingKeys = documentsRequiredBeforeFirstShift(
    seedCredentialRequirements,
    role,
    applicant.drives,
  );
  const allDocs = [
    ...blockingKeys,
    ...documentsDueSoonAfterHire(seedCredentialRequirements, role, applicant.drives),
  ];

  const removeDoc = (key: string) => {
    const next = { ...applicant.documents };
    delete next[key];
    onChange({ ...applicant, documents: next });
  };

  // Received with an expiry, not just a tick. A CPR card with no expiry is not
  // a record of anything, and inventing the date when the person becomes an
  // employee would put fiction into their compliance clock on day one.
  const receiveDoc = (key: string, expires: string) => {
    onChange({
      ...applicant,
      documents: { ...applicant.documents, [key]: { issued: today, expires: expires || null } },
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
          {blockingKeys.length} of these stop a first shift; the rest are due but do not.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {allDocs.map((key) => {
            const record = applicant.documents[key];
            const have = Boolean(record);
            const blocking = blockingKeys.includes(key);
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
                  <span className={cn(!have && "text-muted-foreground")}>
                    {DOC_LABELS[key] ?? key}
                    {record?.expires && (
                      <span className="block text-xs text-muted-foreground">
                        Expires {record.expires}
                      </span>
                    )}
                  </span>
                </span>
                {have ? (
                  <Button variant="ghost" size="sm" onClick={() => removeDoc(key)}>
                    Remove
                  </Button>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="date"
                      aria-label={`${DOC_LABELS[key] ?? key} expiry date`}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      onChange={(e) => e.target.value && receiveDoc(key, e.target.value)}
                    />
                  </span>
                )}
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
              if (!check.allowed) {
                return (
                  <>
                    <Button className="w-full" disabled>
                      Complete onboarding — becomes an active employee
                    </Button>
                    <p className="mt-1.5 text-xs text-muted-foreground">{check.reason}</p>
                  </>
                );
              }
              return <HireForm applicant={applicant} today={today} onHire={onHire} />;
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

/**
 * The details an offer settles that the application cannot.
 *
 * Role, rate and hours are negotiated, not derived — guessing them would put a
 * number on somebody's pay record that nobody agreed to.
 */
function HireForm({
  applicant,
  today,
  onHire,
}: {
  applicant: Applicant;
  today: string;
  onHire: (applicant: Applicant, details: HireDetails) => void;
}) {
  const guessedRole = /LVN/i.test(applicant.roleApplied)
    ? "lvn"
    : /HHA/i.test(applicant.roleApplied)
      ? "hha"
      : /CNA/i.test(applicant.roleApplied)
        ? "cna"
        : "office";

  const [title, setTitle] = useState(
    guessedRole === "office" ? applicant.roleApplied : "Field caregiver",
  );
  const [role, setRole] = useState<HireDetails["role"]>(guessedRole as HireDetails["role"]);
  const [employmentType, setEmploymentType] = useState("Full-time · hourly");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [location, setLocation] = useState("Houston");
  const [startsOn, setStartsOn] = useState(today);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Employment details</p>
      <p className="text-xs text-muted-foreground">
        Set at the offer, not derived from the application. These go straight onto the employee
        record.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-title" className="text-xs">Job title</Label>
          <Input id="hire-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-role" className="text-xs">Role</Label>
          <select
            id="hire-role"
            value={role}
            onChange={(e) => setRole(e.target.value as HireDetails["role"])}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="cna">CNA</option>
            <option value="hha">HHA</option>
            <option value="lvn">LVN</option>
            <option value="office">Office</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-type" className="text-xs">Employment type</Label>
          <Input
            id="hire-type"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-location" className="text-xs">Work location</Label>
          <Input id="hire-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-rate" className="text-xs">Base rate / hour</Label>
          <Input
            id="hire-rate"
            type="number"
            step="0.25"
            placeholder="Leave blank if salaried"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hire-hours" className="text-xs">Weekly hours</Label>
          <Input
            id="hire-hours"
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="hire-start" className="text-xs">Start date</Label>
          <Input
            id="hire-start"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
      </div>

      <Button
        className="w-full"
        disabled={!title.trim() || !startsOn}
        onClick={() =>
          onHire(applicant, {
            title: title.trim(),
            role,
            employmentType,
            baseRate: rate === "" ? null : Number(rate),
            weeklyHours: hours === "" ? null : Number(hours),
            location,
            startsOn,
          })
        }
      >
        Complete onboarding — becomes an active employee
      </Button>
    </div>
  );
}
