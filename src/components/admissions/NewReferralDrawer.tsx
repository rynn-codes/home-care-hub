import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DuplicateWarning } from "@/components/admissions/DuplicateWarning";
import { findDuplicates, type DuplicateCandidate } from "@/domain/admissions/duplicateCheck";
import {
  CARE_SERVICES,
  CONTACT_METHODS,
  PAYMENT_SOURCES,
  REFERRAL_SOURCES,
  emptyReferral,
  isReadyForDuplicateCheck,
  toDuplicateQuery,
  validateReferral,
  type ReferralDraft,
} from "@/domain/admissions/referral";
import { cn } from "@/lib/utils";

interface NewReferralDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPeople: readonly DuplicateCandidate[];
  onCreate: (draft: ReferralDraft) => void;
  onOpenExisting: (personId: string) => void;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * New referral entry.
 *
 * Section 8 of the Admissions spec keeps this intentionally light: enough to
 * follow up, and no clinical packet. The client's full address is deliberately
 * absent — the source form rule moves that to assessment scheduling rather than
 * demanding it at the start of a call.
 *
 * The duplicate check runs as the name is typed and surfaces a match before the
 * record is created, per section 10.
 */
export function NewReferralDrawer({
  open,
  onOpenChange,
  existingPeople,
  onCreate,
  onOpenExisting,
}: NewReferralDrawerProps) {
  const [draft, setDraft] = useState<ReferralDraft>(emptyReferral);
  const [submitted, setSubmitted] = useState(false);
  const [dupeDismissed, setDupeDismissed] = useState(false);

  const set = <K extends keyof ReferralDraft>(key: K, value: ReferralDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "firstName" || key === "lastName" || key === "phone" || key === "email") {
      setDupeDismissed(false);
    }
  };

  const errors = validateReferral(draft);
  const showErrors = submitted;

  const duplicates = useMemo(() => {
    if (!isReadyForDuplicateCheck(draft)) return null;
    return findDuplicates(toDuplicateQuery(draft), existingPeople);
  }, [draft, existingPeople]);

  const blockingMatch =
    duplicates?.best && duplicates.best.candidate.openAdmissionStage && !dupeDismissed
      ? duplicates.best
      : null;

  const reset = () => {
    setDraft(emptyReferral);
    setSubmitted(false);
    setDupeDismissed(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || blockingMatch) return;
    onCreate(draft);
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New referral</SheetTitle>
          <SheetDescription>
            Just enough to follow up. Clinical details and the full address come later,
            during intake and assessment scheduling.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Who needs care
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="firstName" error={showErrors ? errors.firstName : undefined}>
                <Input
                  id="firstName"
                  value={draft.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  aria-invalid={showErrors && Boolean(errors.firstName)}
                />
              </Field>
              <Field label="Last name" htmlFor="lastName" error={showErrors ? errors.lastName : undefined}>
                <Input
                  id="lastName"
                  value={draft.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  aria-invalid={showErrors && Boolean(errors.lastName)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Preferred name" htmlFor="preferredName" hint="What they go by">
                <Input
                  id="preferredName"
                  value={draft.preferredName}
                  onChange={(e) => set("preferredName", e.target.value)}
                />
              </Field>
              <Field label="Date of birth" htmlFor="dateOfBirth" hint="Optional">
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={draft.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" htmlFor="phone" error={showErrors ? errors.phone : undefined}>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  aria-invalid={showErrors && Boolean(errors.phone)}
                />
              </Field>
              <Field label="Email" htmlFor="email" error={showErrors ? errors.email : undefined}>
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={showErrors && Boolean(errors.email)}
                />
              </Field>
            </div>
          </fieldset>

          {duplicates?.best && (
            <DuplicateWarning
              match={duplicates.best}
              dismissed={dupeDismissed}
              onOpenExisting={(personId) => {
                onOpenExisting(personId);
                onOpenChange(false);
              }}
              onContinueAsNew={() => setDupeDismissed(true)}
            />
          )}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Who we talk to
            </legend>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="contactIsSomeoneElse" className="text-sm font-normal">
                Someone else is the main contact
              </Label>
              <Switch
                id="contactIsSomeoneElse"
                checked={draft.contactIsSomeoneElse}
                onCheckedChange={(v) => set("contactIsSomeoneElse", v)}
              />
            </div>

            {draft.contactIsSomeoneElse && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Contact name"
                    htmlFor="contactName"
                    error={showErrors ? errors.contactName : undefined}
                  >
                    <Input
                      id="contactName"
                      value={draft.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      aria-invalid={showErrors && Boolean(errors.contactName)}
                    />
                  </Field>
                  <Field
                    label="Relationship"
                    htmlFor="contactRelationship"
                    error={showErrors ? errors.contactRelationship : undefined}
                    hint="Daughter, spouse, case manager…"
                  >
                    <Input
                      id="contactRelationship"
                      value={draft.contactRelationship}
                      onChange={(e) => set("contactRelationship", e.target.value)}
                      aria-invalid={showErrors && Boolean(errors.contactRelationship)}
                    />
                  </Field>
                </div>
                <Field
                  label="Contact phone"
                  htmlFor="contactPhone"
                  error={showErrors ? errors.contactPhone : undefined}
                >
                  <Input
                    id="contactPhone"
                    inputMode="tel"
                    value={draft.contactPhone}
                    onChange={(e) => set("contactPhone", e.target.value)}
                  />
                </Field>
              </>
            )}

            <Field
              label="Best way to reach them"
              htmlFor="bestContactMethod"
              error={showErrors ? errors.bestContactMethod : undefined}
            >
              <Select
                value={draft.bestContactMethod}
                onValueChange={(v) => set("bestContactMethod", v as ReferralDraft["bestContactMethod"])}
              >
                <SelectTrigger id="bestContactMethod">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              About the enquiry
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Where it came from" htmlFor="referralSource">
                <Select
                  value={draft.referralSource}
                  onValueChange={(v) => set("referralSource", v as ReferralDraft["referralSource"])}
                >
                  <SelectTrigger id="referralSource">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Service requested" htmlFor="serviceRequested">
                <Select
                  value={draft.serviceRequested}
                  onValueChange={(v) => set("serviceRequested", v as ReferralDraft["serviceRequested"])}
                >
                  <SelectTrigger id="serviceRequested">
                    <SelectValue placeholder="Not sure yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARE_SERVICES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {draft.referralSource === "other" && (
              <Field
                label="Where exactly?"
                htmlFor="referralSourceDetail"
                error={showErrors ? errors.referralSourceDetail : undefined}
              >
                <Input
                  id="referralSourceDetail"
                  value={draft.referralSourceDetail}
                  onChange={(e) => set("referralSourceDetail", e.target.value)}
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Area or ZIP" htmlFor="serviceArea" hint="Full address comes later">
                <Input
                  id="serviceArea"
                  value={draft.serviceArea}
                  onChange={(e) => set("serviceArea", e.target.value)}
                />
              </Field>
              <Field label="Expected payer" htmlFor="expectedPayer">
                <Select
                  value={draft.expectedPayer}
                  onValueChange={(v) => set("expectedPayer", v as ReferralDraft["expectedPayer"])}
                >
                  <SelectTrigger id="expectedPayer">
                    <SelectValue placeholder="Not sure yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_SOURCES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Short note" htmlFor="referralNote" hint="What did they say on the call?">
              <Textarea
                id="referralNote"
                rows={3}
                value={draft.referralNote}
                onChange={(e) => set("referralNote", e.target.value)}
              />
            </Field>
          </fieldset>

          {showErrors && Object.keys(errors).length > 0 && (
            <p role="alert" className="text-xs text-destructive">
              A few details need fixing before this can be saved. Nothing you typed is lost.
            </p>
          )}

          <div className={cn("flex flex-wrap gap-2 border-t border-border pt-4")}>
            <Button type="submit" disabled={Boolean(blockingMatch)}>
              Save and start intake
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
