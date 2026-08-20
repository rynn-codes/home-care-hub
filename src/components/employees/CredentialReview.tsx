import { useMemo, useState } from "react";
import { FileText, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { confirmCredential, correctionsMade, rejectCredential } from "@/domain/credentials/verification";
import { validateExtraction, type FieldIssue } from "@/domain/documents/validation";
import type { ExtractedCredential } from "@/domain/documents/ports";
import type { CredentialRequirement, EmployeeCredential } from "@/domain/documents/types";

/**
 * Review a credential before it becomes a fact — §10's "AI drafts, humans
 * approve".
 *
 * Three things the spec is specific about, and each changes the screen:
 *
 *  - SURFACE THE UNCERTAIN FIELD, NOT A CONFIDENCE SCORE. "82% confident" is
 *    not actionable. "Joy was not sure which of these is the expiry" is, so
 *    every problem is rendered beside the input it belongs to.
 *  - OFFER THE CANDIDATES. Where the document plausibly says one of several
 *    things, the choices are buttons rather than something to retype.
 *  - THE ORIGINAL IS ALWAYS ONE CLICK AWAY. A reviewer confirming a date they
 *    cannot see is rubber-stamping, which is worse than no review at all.
 *
 * There is no "confirm all" here on purpose. Confirmation is per credential
 * because each one is a separate consequential fact.
 */

const FIELD_LABELS: Record<string, string> = {
  documentType: "Document type",
  employeeName: "Name on the document",
  employeeMatch: "Name on the document",
  issuer: "Issued by",
  issueDate: "Issue date",
  expirationDate: "Expiry date",
  credentialNumber: "Credential number",
};

interface Props {
  credential: EmployeeCredential;
  requirement: CredentialRequirement;
  extracted: ExtractedCredential | null;
  employeeName: string;
  today: string;
  currentUserId: string;
  onViewOriginal?: () => void;
  onConfirm: (credential: EmployeeCredential, changes: ReturnType<typeof correctionsMade>) => void;
  onReject: (credential: EmployeeCredential) => void;
}

function IssueLine({ issue }: { issue: FieldIssue }) {
  return (
    <p
      className={cn(
        "mt-1 text-xs",
        issue.severity === "blocking" ? "text-destructive" : "text-[hsl(var(--warning))]",
      )}
    >
      {issue.message}
    </p>
  );
}

export function CredentialReview({
  credential,
  requirement,
  extracted,
  employeeName,
  today,
  currentUserId,
  onViewOriginal,
  onConfirm,
  onReject,
}: Props) {
  const [issuer, setIssuer] = useState(credential.issuer ?? extracted?.issuer ?? "");
  const [number, setNumber] = useState(
    credential.credentialNumber ?? extracted?.credentialNumber ?? "",
  );
  const [issuedAt, setIssuedAt] = useState(credential.issuedAt ?? extracted?.issueDate ?? "");
  const [expiresAt, setExpiresAt] = useState(credential.expiresAt ?? extracted?.expirationDate ?? "");

  const validation = useMemo(
    () =>
      extracted
        ? validateExtraction(extracted, { requirement, employeeName, asOf: today })
        : null,
    [extracted, requirement, employeeName, today],
  );

  const issuesFor = (field: string) =>
    (validation?.issues ?? []).filter((i) => i.field === field);

  const blocking = (validation?.issues ?? []).filter((i) => i.severity === "blocking");

  // Extraction found nothing at all. Not a failure to hide — the document is
  // safe and a person simply keys it in.
  const nothingExtracted = extracted === null;

  const build = (): EmployeeCredential => ({
    ...credential,
    issuer: issuer.trim() || null,
    credentialNumber: number.trim() || null,
    issuedAt: issuedAt || null,
    expiresAt: expiresAt || null,
  });

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Review {requirement.displayName}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {nothingExtracted
              ? "Joy could not read this document. It is safe — key in what it says."
              : "Joy read the document. Check it against the original before confirming."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewOriginal} disabled={!onViewOriginal}>
          <FileText className="mr-1.5 h-4 w-4" />
          View original
        </Button>
      </div>

      {blocking.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
            This may not be the right document
          </p>
          <ul className="mt-2 space-y-1">
            {blocking.map((i) => (
              <li key={i.field + i.message} className="text-sm text-muted-foreground">
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-issuer" className="text-xs">{FIELD_LABELS.issuer}</Label>
          <Input id="cr-issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          {issuesFor("issuer").map((i) => (
            <IssueLine key={i.message} issue={i} />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-number" className="text-xs">{FIELD_LABELS.credentialNumber}</Label>
          <Input id="cr-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          {issuesFor("credentialNumber").map((i) => (
            <IssueLine key={i.message} issue={i} />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-issued" className="text-xs">{FIELD_LABELS.issueDate}</Label>
          <Input
            id="cr-issued"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
          {issuesFor("issueDate").map((i) => (
            <IssueLine key={i.message} issue={i} />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cr-expires" className="text-xs">{FIELD_LABELS.expirationDate}</Label>
          <Input
            id="cr-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          {issuesFor("expirationDate").map((i) => (
            <div key={i.message}>
              <IssueLine issue={i} />
              {/* §10's ambiguous-date case: offer the candidates rather than
                  making somebody retype a date they can see on screen. */}
              {i.candidates && i.candidates.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {i.candidates.map((c) => (
                    <Button
                      key={c}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setExpiresAt(c)}
                    >
                      Use {c}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {issuesFor("employeeMatch").length === 0 && extracted?.employeeName && (
        <p className="mt-4 text-xs text-muted-foreground">
          Document names {extracted.employeeName} · filed against {employeeName}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button
          disabled={!expiresAt && requirement.expirationRequired}
          onClick={() => {
            const next = build();
            const changes = correctionsMade(credential, {
              issuer: next.issuer,
              credentialNumber: next.credentialNumber,
              issuedAt: next.issuedAt,
              expiresAt: next.expiresAt,
            });
            onConfirm(
              confirmCredential({
                credential: next,
                verifiedByUserId: currentUserId,
                verifiedAt: new Date().toISOString(),
              }),
              changes,
            );
          }}
        >
          Confirm
        </Button>
        <Button
          variant="outline"
          onClick={() => onReject(rejectCredential(credential, currentUserId, new Date().toISOString()))}
        >
          Reject this document
        </Button>
      </div>

      {requirement.expirationRequired && !expiresAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          {requirement.displayName} needs an expiry date before it can be confirmed.
        </p>
      )}
    </section>
  );
}
