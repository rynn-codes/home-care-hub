import { useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { findDuplicates, type DuplicateCandidate } from "@/domain/admissions/duplicateCheck";
import {
  LEAD_SOURCES,
  RELATIONSHIPS,
  canSaveLead,
  emptyLead,
  leadDuplicateQuery,
  readyForDuplicateCheck,
  sourceHasOrganisation,
  type LeadCapture,
} from "@/domain/admissions/leadCapture";
import { formatPhoneInput, serviceAreaForZip } from "@/domain/admissions/serviceArea";
import { cn } from "@/lib/utils";

/**
 * New lead — the quick capture.
 *
 * Section 8 of the Admissions spec keeps this intentionally light: enough
 * to follow up, and no clinical packet. A name and one way to reach them
 * saves; everything else is optional and folds in as it is said on the
 * call. The full address, the date of birth and the clinical detail are
 * gathered later, at intake and the assessment.
 *
 * The duplicate check runs as the name is typed and surfaces a match before
 * the record is created, per section 10. It never merges and never blocks
 * outright — "Create new anyway" is always there — but a possible match is
 * put in front of the office before they make a second record.
 */
interface NewReferralDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPeople: readonly DuplicateCandidate[];
  /** Saves the lead and returns the new admission id. */
  onCreate: (lead: LeadCapture) => string;
  /** Save, then take the office straight into the intake call. */
  onStartIntake: (admissionId: string) => void;
  onOpenExisting: (personId: string) => void;
}

const FIELD =
  "h-[42px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-[13px] text-sm text-[var(--ink-strong)] outline-none transition-colors focus:border-[#C7C9F5] placeholder:text-[#C9C9D0]";

function Field({
  label,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  optional?: boolean;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-[#8A8A92]">
        {label}
        {optional && <span className="ml-1 text-[#C9C9D0]">optional</span>}
      </span>
      {children}
    </label>
  );
}

export function NewReferralDrawer({
  open,
  onOpenChange,
  existingPeople,
  onCreate,
  onStartIntake,
  onOpenExisting,
}: NewReferralDrawerProps) {
  const [lead, setLead] = useState<LeadCapture>(emptyLead);
  const [dupeDismissed, setDupeDismissed] = useState(false);

  const set = <K extends keyof LeadCapture>(key: K, value: LeadCapture[K]) => {
    setLead((d) => ({ ...d, [key]: value }));
    if (key === "contactName" || key === "personNeedingCare" || key === "phone" || key === "email") {
      setDupeDismissed(false);
    }
  };

  const match = useMemo(
    () => (readyForDuplicateCheck(lead) ? findDuplicates(leadDuplicateQuery(lead), existingPeople).best ?? null : null),
    [lead, existingPeople],
  );
  const area = serviceAreaForZip(lead.zip);
  const canSave = canSaveLead(lead);
  const showMatch = !!match && !dupeDismissed;

  const reset = () => {
    setLead(emptyLead);
    setDupeDismissed(false);
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };
  const save = (thenStartIntake: boolean) => {
    if (!canSave) return;
    const id = onCreate(lead);
    if (thenStartIntake) onStartIntake(id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[86vh] w-full max-w-[540px] flex-col gap-0 overflow-hidden rounded-[18px] p-0">
        <DialogHeader className="space-y-0 border-b border-[var(--hairline-soft)] px-6 pb-[18px] pt-[22px] text-left">
          <DialogTitle className="text-[19px] font-semibold tracking-[-.02em] text-[var(--ink-strong)]">New lead</DialogTitle>
          <DialogDescription className="pt-1.5 text-[13px] leading-[1.5] text-[var(--ink-body)]">
            Capture a referral in a few seconds. Joy will queue the intake call.
          </DialogDescription>
        </DialogHeader>

        <form
          id="new-lead-form"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-2">
            <Field label="Who are you talking to?" htmlFor="lead-contact-name">
              <input
                id="lead-contact-name"
                type="text"
                value={lead.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Best phone number" htmlFor="lead-phone">
              <input
                id="lead-phone"
                type="text"
                inputMode="tel"
                value={lead.phone}
                onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
                placeholder="(000) 000-0000"
                className={FIELD}
              />
            </Field>
          </div>
          <p className="-mt-2.5 m-0 text-[11.5px] text-[#9B9BA3]">
            A name and either a phone number or an email is enough to save.
          </p>

          {showMatch && match && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#FCE8B6] bg-[#FFFAEB] px-3.5 py-[13px]">
              <span className="text-[12.5px] font-medium text-[#93370D]">Possible existing record</span>
              <span className="text-[12.5px] leading-[1.45] text-[#B54708]">
                {[
                  [match.candidate.firstName, match.candidate.lastName].filter(Boolean).join(" "),
                  match.candidate.phone,
                  match.candidate.openAdmissionStage,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenExisting(match.candidate.personId);
                    close();
                  }}
                  className="h-[30px] rounded-[9px] border border-[#FCE8B6] bg-[var(--paper)] px-3 text-xs text-[#B54708] transition-colors hover:bg-[#FFFAEB]"
                >
                  Use this record
                </button>
                <button
                  type="button"
                  onClick={() => setDupeDismissed(true)}
                  className="h-[30px] rounded-[9px] px-2.5 text-xs text-[#93370D] transition-colors hover:bg-[#FDF3D8]"
                >
                  Create new anyway
                </button>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-2">
            <Field label="Person needing care" optional htmlFor="lead-person">
              <input
                id="lead-person"
                type="text"
                value={lead.personNeedingCare}
                onChange={(e) => set("personNeedingCare", e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Relationship" optional htmlFor="lead-relationship">
              <select
                id="lead-relationship"
                value={lead.relationship}
                onChange={(e) => set("relationship", e.target.value)}
                className={cn(FIELD, "cursor-pointer px-[11px]")}
              >
                <option value="">Not said</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {lead.relationship === "Other" && (
            <Field label="Relationship — please specify" htmlFor="lead-relationship-other">
              <input
                id="lead-relationship-other"
                type="text"
                value={lead.relationshipOther}
                onChange={(e) => set("relationshipOther", e.target.value)}
                placeholder="Neighbour, family friend, guardian…"
                className={FIELD}
                autoFocus
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-2">
            <Field label="Email" optional htmlFor="lead-email">
              <input
                id="lead-email"
                type="email"
                value={lead.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="name@example.com"
                className={FIELD}
              />
            </Field>
            <Field label="ZIP code" optional htmlFor="lead-zip">
              <input
                id="lead-zip"
                type="text"
                inputMode="numeric"
                value={lead.zip}
                onChange={(e) => set("zip", e.target.value)}
                className={FIELD}
              />
              {area.status !== "unknown" && (
                <span
                  className={cn(
                    "text-[11.5px] leading-[1.45]",
                    area.status === "out_of_state" ? "text-[#C2410C]" : "text-[#15803D]",
                  )}
                >
                  {area.status !== "out_of_state" && <span aria-hidden="true">✓ </span>}
                  {area.text}
                </span>
              )}
            </Field>
          </div>

          <Field label="Referral source" htmlFor="lead-source">
            <select
              id="lead-source"
              value={lead.source}
              onChange={(e) => set("source", e.target.value)}
              className={cn(FIELD, "cursor-pointer px-[11px]")}
            >
              <option value="">Not said</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          {lead.source === "Other" && (
            <Field label="Referral source — please specify" htmlFor="lead-source-other">
              <input
                id="lead-source-other"
                type="text"
                value={lead.sourceOther}
                onChange={(e) => set("sourceOther", e.target.value)}
                placeholder="Church group, senior centre, radio spot…"
                className={FIELD}
                autoFocus
              />
            </Field>
          )}
          {sourceHasOrganisation(lead.source) && (
            <div className="grid grid-cols-1 gap-[11px] sm:grid-cols-2">
              <Field label="Organization" optional htmlFor="lead-org">
                <input
                  id="lead-org"
                  type="text"
                  value={lead.org}
                  onChange={(e) => set("org", e.target.value)}
                  placeholder="Memorial Hermann"
                  className={FIELD}
                />
              </Field>
              <Field label="Referrer" optional htmlFor="lead-referrer">
                <input
                  id="lead-referrer"
                  type="text"
                  value={lead.referrer}
                  onChange={(e) => set("referrer", e.target.value)}
                  placeholder="Name and number"
                  className={FIELD}
                />
              </Field>
            </div>
          )}

          <Field label="Note" optional htmlFor="lead-note">
            <textarea
              id="lead-note"
              value={lead.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Anything the team should know before the first call"
              className="min-h-16 resize-y rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-[13px] py-3 text-sm leading-[1.55] text-[var(--ink-strong)] outline-none transition-colors focus:border-[#C7C9F5] placeholder:text-[#C9C9D0]"
            />
          </Field>
        </form>

        <div className="flex items-center gap-2.5 border-t border-[var(--hairline-soft)] bg-[var(--paper-sunken)] px-6 py-4">
          <button
            type="submit"
            form="new-lead-form"
            disabled={!canSave}
            className={cn(
              "h-10 rounded-[10px] px-[18px] text-[13.5px] font-medium transition-colors",
              canSave ? "cursor-pointer bg-primary text-white hover:bg-[#2A1BD1]" : "cursor-not-allowed bg-[var(--wash-strong)] text-[#B9B9C1]",
            )}
          >
            Save lead
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save(true)}
            className={cn(
              "h-10 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-[15px] text-[13.5px] transition-colors",
              canSave
                ? "cursor-pointer text-[var(--ink-body)] hover:bg-[var(--wash-strong)] hover:text-[var(--ink-strong)]"
                : "cursor-not-allowed text-[#B9B9C1]",
            )}
          >
            Save &amp; start intake
          </button>
          <button
            type="button"
            onClick={close}
            className="ml-auto p-1 text-[13px] text-[#9B9BA3] transition-colors hover:text-[var(--ink-body)]"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
