import { firstShiftReadiness, type Applicant } from "@/domain/hiring/pipeline";
import type { CredentialRequirement } from "@/domain/documents/types";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";

/**
 * What a candidate is asked to upload, and how it is going.
 *
 * §21 says it for the client portal and it applies here too: "Use the
 * already-established Joy secure document architecture rather than building a
 * second upload system." So this file computes *which* documents to ask for and
 * *what state each is in* — and does no uploading. The bytes go through
 * `DocumentStorageService`, the review through `CredentialVerificationService`,
 * both already defined in `domain/documents/ports.ts`.
 *
 * The list itself comes from `firstShiftReadiness`, which reads Joy's
 * credential requirements. A hardcoded list here would be a second answer to
 * "what does a caregiver need?", and the day the two disagreed the candidate
 * would be chasing a document nobody wanted while the office chased one she was
 * never asked for.
 */

export type UploadState =
  /** Joy is asking for it and nothing has arrived. */
  | "needed"
  /** Uploaded, waiting for a person to check it. */
  | "in_review"
  /** Checked and accepted. */
  | "accepted"
  /** Checked and sent back. The candidate is told what to do, not why it failed. */
  | "resend"
  /** On file and in date. Nothing to do. */
  | "on_file";

export interface UploadItem {
  credentialType: string;
  /** The requirement's own words, so office and candidate read the same name. */
  displayName: string;
  state: UploadState;
  /** Shown under the name. Never a verifier's note. */
  hint: string;
  /** Whether this one is standing between them and a first shift. */
  blocking: boolean;
}

export const UPLOAD_STATE_LABELS: Record<UploadState, string> = {
  needed: "Needed",
  in_review: "Checking",
  accepted: "Received",
  resend: "Please send again",
  on_file: "On file",
};

/**
 * Why a document came back, in candidate-facing words.
 *
 * `proposedVerificationStatus` can reject for a wrong document type or a wrong
 * person, and the office needs that precision. A candidate needs to know what
 * to do next. "This looks like a different document" is actionable; the
 * internal reason code is not, and repeating a verifier's note would put a
 * staff member's private assessment on somebody's phone.
 */
const RESEND_HINTS: Record<string, string> = {
  wrong_document: "This looked like a different document. Please send the right one.",
  wrong_person: "The name on this did not match your record. Please check and send again.",
  unreadable: "We could not read this one. A clearer photo should do it.",
  expired: "This one has expired. Please send a current version.",
};

export const DEFAULT_RESEND_HINT = "Please send this one again.";

export function resendHint(reason: string | null): string {
  return (reason && RESEND_HINTS[reason]) || DEFAULT_RESEND_HINT;
}

export interface UploadStatusInput {
  applicant: Applicant;
  /** Documents already sent through the portal, by credential type. */
  submitted?: Record<string, { state: UploadState; reason?: string | null }>;
  requirements?: readonly CredentialRequirement[];
}

/**
 * The upload list, ordered so the blocking ones come first.
 *
 * Ordering by urgency rather than alphabetically is the whole point of the
 * screen. Somebody with six documents to find will do the first two; those two
 * should be the ones stopping them working.
 */
export function uploadList(input: UploadStatusInput): UploadItem[] {
  const requirements = input.requirements ?? seedCredentialRequirements;
  const submitted = input.submitted ?? {};
  const readiness = firstShiftReadiness(input.applicant, requirements);

  const blocking = new Set(readiness.missingBlocking);
  const soon = new Set(readiness.missingSoon);
  const onFile = Object.keys(input.applicant.documents);

  const items: UploadItem[] = [];

  for (const key of [...readiness.missingBlocking, ...readiness.missingSoon]) {
    const requirement = requirements.find((r) => r.credentialType === key);

    // Joy runs the background check and delivers its own training. Asking a
    // candidate to photograph either is asking for a document she has never
    // seen, and the support call that follows is Joy's to answer.
    //
    // It stays missing on the office's screens — this only decides whether it
    // is *her* problem, not whether it is a problem.
    if (requirement?.suppliedBy === "agency") continue;

    const sent = submitted[key];
    const state: UploadState = sent?.state ?? "needed";

    items.push({
      credentialType: key,
      displayName: requirement?.displayName ?? key,
      state,
      hint:
        state === "resend"
          ? resendHint(sent?.reason ?? null)
          : state === "in_review"
            ? "We're checking this now. Nothing more to do."
            : state === "accepted"
              ? "Received, thank you."
              : blocking.has(key)
                ? "Needed before your first shift."
                : "Needed soon after you start.",
      blocking: blocking.has(key),
    });
  }

  for (const key of onFile) {
    if (blocking.has(key) || soon.has(key)) continue;
    const requirement = requirements.find((r) => r.credentialType === key);
    if (requirement?.suppliedBy === "agency") continue;
    items.push({
      credentialType: key,
      displayName: requirement?.displayName ?? key,
      state: "on_file",
      hint: "Received, thank you.",
      blocking: false,
    });
  }

  // Blocking first, then anything still wanted, then what is settled.
  const rank = (i: UploadItem) =>
    i.state === "on_file" || i.state === "accepted" ? 2 : i.blocking ? 0 : 1;
  return items.sort((a, b) => rank(a) - rank(b));
}

/** One line for the top of the screen. */
export function uploadSummary(items: UploadItem[]): string {
  const outstanding = items.filter((i) => i.state === "needed" || i.state === "resend");
  if (items.length === 0) return "Nothing needed right now.";
  if (outstanding.length === 0) {
    return items.some((i) => i.state === "in_review")
      ? "Everything is in — we're checking the last few."
      : "Everything is in. Thank you.";
  }
  const blocking = outstanding.filter((i) => i.blocking).length;
  if (blocking > 0) {
    return blocking === 1
      ? "One document is needed before your first shift."
      : `${blocking} documents are needed before your first shift.`;
  }
  return outstanding.length === 1
    ? "One more document to send."
    : `${outstanding.length} more documents to send.`;
}

/**
 * What the file picker should accept.
 *
 * Photographs, because that is what a phone produces and §21's whole premise is
 * that people send what they have. PDFs because that is what a clinic emails.
 */
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/heic", "application/pdf"];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadRejection = "too_large" | "wrong_type" | null;

/**
 * Check a file before it is sent.
 *
 * Client side only, and therefore advisory: the server must repeat both checks,
 * because anything enforced solely in a browser is enforced by the honour
 * system. Doing it here as well saves somebody on a phone connection uploading
 * twelve megabytes before being told no.
 */
export function checkUpload(file: { type: string; size: number }): {
  ok: boolean;
  rejection: UploadRejection;
  message: string | null;
} {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
    return {
      ok: false,
      rejection: "wrong_type",
      message: "Please send a photo or a PDF.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      rejection: "too_large",
      message: "That file is too big. A photo taken on your phone should be fine.",
    };
  }
  return { ok: true, rejection: null, message: null };
}
