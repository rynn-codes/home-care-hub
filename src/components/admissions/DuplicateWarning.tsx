import { Button } from "@/components/ui/button";
import type { DuplicateMatch } from "@/domain/admissions/duplicateCheck";
import { STAGE_LABELS, type AdmissionStage } from "@/domain/admissions/stages";

interface DuplicateWarningProps {
  match: DuplicateMatch;
  onOpenExisting: (personId: string) => void;
  onContinueAsNew: () => void;
  dismissed: boolean;
}

/**
 * "Possible existing client or referral found."
 *
 * Section 10 of the Admissions Master Build Spec: show the likely match, and
 * offer Open Existing Record or Continue as New. The rule that shapes this
 * component is the section's last line — **do not silently merge records.**
 *
 * So it never merges, never auto-fills from the match, and never blocks. It
 * shows what it found and why, and lets a person decide. The reasons are listed
 * because "possible duplicate" with no evidence is not something anyone can
 * judge in the two seconds they will spend on it.
 */
export function DuplicateWarning({
  match,
  onOpenExisting,
  onContinueAsNew,
  dismissed,
}: DuplicateWarningProps) {
  const { candidate, reasons, strength } = match;
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ");
  const openStage = candidate.openAdmissionStage as AdmissionStage | null | undefined;

  if (dismissed) {
    return (
      <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
        Continuing as a new record. {name} stays untouched.
      </p>
    );
  }

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4"
    >
      <h3 className="text-sm font-semibold">
        {strength === "strong"
          ? "Possible existing record found"
          : "This might already be someone you know"}
      </h3>

      <div className="mt-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
        <p className="text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {openStage
            ? `Open admission · ${STAGE_LABELS[openStage] ?? openStage}`
            : "Existing person record"}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {reasons.map((reason) => (
            <li key={reason} className="text-xs text-muted-foreground">
              · {reason}
            </li>
          ))}
        </ul>
      </div>

      {openStage && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          Someone already has an open referral for this person. A second one cannot be
          created — continue in the existing record instead.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenExisting(candidate.personId)}>
          Open existing record
        </Button>
        <Button size="sm" variant="outline" onClick={onContinueAsNew} disabled={Boolean(openStage)}>
          Continue as new
        </Button>
      </div>
    </section>
  );
}
