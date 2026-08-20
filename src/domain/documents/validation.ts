import type { ExtractedCredential } from "@/domain/documents/ports";
import type { CredentialRequirement } from "@/domain/documents/types";

/**
 * Schema validation for what extraction proposed.
 *
 * §9 requires typed, validated structured output, and §10 requires the review
 * screen to surface *which field* is uncertain rather than an overall
 * confidence score. So validation here is field-level: every problem names the
 * field it belongs to, and the UI puts the message beside that input.
 *
 * The rule underneath all of it: a value that cannot be checked is escalated to
 * a human, never dropped and never silently accepted. §30 rule 3 forbids AI
 * quietly verifying a consequential credential, and an extracted date that
 * failed validation is exactly that kind of value.
 */

export type ValidationSeverity = "blocking" | "review";

export interface FieldIssue {
  /** The field this belongs beside on the review screen. */
  field: keyof ExtractedCredential | "employeeMatch";
  message: string;
  severity: ValidationSeverity;
  /** Offered when the document plausibly says one of several things. */
  candidates?: string[];
}

export interface ValidationResult {
  ok: boolean;
  issues: FieldIssue[];
  /** Fields a human must look at, whether flagged by the model or by us. */
  fieldsNeedingReview: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Do these two names plausibly describe the same person?
 *
 * Deliberately loose — married names, middle initials and hyphenation all
 * differ legitimately between a certificate and a payroll record. It exists to
 * catch the genuinely alarming case: somebody has uploaded another person's
 * card, which puts a credential on the wrong file and a caregiver in a home
 * they are not qualified for.
 */
export function namesPlausiblyMatch(a: string, b: string): boolean {
  const parts = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z\s-]/g, "")
      .split(/[\s-]+/)
      .filter((p) => p.length > 1);

  const left = parts(a);
  const right = parts(b);
  if (left.length === 0 || right.length === 0) return false;
  return left.some((p) => right.includes(p));
}

export interface ValidationContext {
  requirement: CredentialRequirement;
  /** The employee the document was filed against. */
  employeeName: string;
  /** Today, for sanity-checking dates. Passed in so this stays testable. */
  asOf: string;
}

export function validateExtraction(
  extracted: ExtractedCredential,
  context: ValidationContext,
): ValidationResult {
  const issues: FieldIssue[] = [];
  const { requirement, employeeName, asOf } = context;

  // --- the document is what we think it is -------------------------------
  if (extracted.documentType !== requirement.credentialType) {
    issues.push({
      field: "documentType",
      message: `This looks like a ${extracted.documentType.replace(/_/g, " ")}, not a ${requirement.displayName.toLowerCase()}. Filing it here would put the wrong evidence behind the credential.`,
      severity: "blocking",
    });
  }

  // --- it belongs to this person ------------------------------------------
  if (extracted.employeeName && !namesPlausiblyMatch(extracted.employeeName, employeeName)) {
    issues.push({
      field: "employeeMatch",
      message: `The document names ${extracted.employeeName}, but it is filed against ${employeeName}.`,
      severity: "blocking",
    });
  }
  if (!extracted.employeeName) {
    issues.push({
      field: "employeeName",
      message: "No name was read from the document — confirm it belongs to this person.",
      severity: "review",
    });
  }

  // --- the dates ----------------------------------------------------------
  const issued = extracted.issueDate ? parseDate(extracted.issueDate) : null;
  const expires = extracted.expirationDate ? parseDate(extracted.expirationDate) : null;

  if (extracted.issueDate && !issued) {
    issues.push({
      field: "issueDate",
      message: `"${extracted.issueDate}" is not a date Joy can read.`,
      severity: "review",
    });
  }
  if (extracted.expirationDate && !expires) {
    issues.push({
      field: "expirationDate",
      message: `"${extracted.expirationDate}" is not a date Joy can read.`,
      severity: "review",
    });
  }

  if (requirement.expirationRequired && !extracted.expirationDate) {
    issues.push({
      field: "expirationDate",
      message: `${requirement.displayName} needs an expiry date and none was found.`,
      severity: "review",
    });
  }

  if (issued && expires && expires.getTime() <= issued.getTime()) {
    // Almost always the two dates read the wrong way round.
    issues.push({
      field: "expirationDate",
      message: "The expiry is on or before the issue date. These may have been read the wrong way round.",
      severity: "blocking",
      candidates: [extracted.expirationDate!, extracted.issueDate!],
    });
  }

  const today = parseDate(asOf);
  if (issued && today && issued.getTime() > today.getTime()) {
    issues.push({
      field: "issueDate",
      message: "The issue date is in the future.",
      severity: "review",
    });
  }
  if (expires && today) {
    const yearsOut = (expires.getTime() - today.getTime()) / (365.25 * 86_400_000);
    // Nothing in a personnel file legitimately runs a decade out. A date this
    // far away is far more likely to be a misread year than a real one.
    if (yearsOut > 10) {
      issues.push({
        field: "expirationDate",
        message: "The expiry is more than ten years away, which usually means the year was misread.",
        severity: "review",
      });
    }
  }

  // --- what the model itself was unsure of --------------------------------
  for (const field of extracted.fieldsNeedingReview) {
    issues.push({
      field: field as FieldIssue["field"],
      message: "Joy was not confident about this one.",
      severity: "review",
    });
  }

  const fieldsNeedingReview = [...new Set(issues.map((i) => String(i.field)))];

  return {
    ok: issues.every((i) => i.severity !== "blocking"),
    issues,
    fieldsNeedingReview,
  };
}

/**
 * Where an extraction lands once validated.
 *
 * `needs_review` is the destination for everything in V1 — §30 rule 3 means
 * there is no path from here to `verified` that does not pass through a person.
 * The distinction that matters is between a document a human can sensibly
 * confirm and one that should be rejected outright, because filing somebody
 * else's CPR card is not a correction, it is a different document.
 */
export function proposedVerificationStatus(
  result: ValidationResult,
): "needs_review" | "rejected" {
  const wrongDocumentOrPerson = result.issues.some(
    (i) => i.severity === "blocking" && (i.field === "documentType" || i.field === "employeeMatch"),
  );
  return wrongDocumentOrPerson ? "rejected" : "needs_review";
}
