import type {
  CredentialVersion,
  EmployeeCredential,
  StoredDocument,
  VerificationStatus,
} from "@/domain/documents/types";

/**
 * Human confirmation, and what happens when a renewal arrives.
 *
 * Two rules from §30 shape every function here:
 *
 *   Rule 3 — AI must never silently verify a consequential credential. There is
 *   no code path below that reaches `verified` without a user id.
 *   Rule 7 — never delete credential history because a renewal arrived. The
 *   prior card and its evidence are archived, not replaced.
 *
 * Pure functions over records. Persistence is the adapter's job; these decide
 * what should be written, which is the part worth testing.
 */

export interface Correction {
  issuer?: string | null;
  credentialNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

export interface ConfirmInput {
  credential: EmployeeCredential;
  /** Only what the reviewer actually changed. */
  corrections?: Correction;
  verifiedByUserId: string;
  verifiedAt: string;
}

/**
 * A reviewer confirms what is on screen, with any corrections they made.
 *
 * Corrections are applied before the status changes, so `verified` always
 * describes the values a person actually looked at rather than the ones
 * extraction proposed.
 */
export function confirmCredential(input: ConfirmInput): EmployeeCredential {
  const { credential, corrections = {}, verifiedByUserId, verifiedAt } = input;

  if (!verifiedByUserId) {
    // Defensive, and the reason is the point: this is the single gate between
    // an extracted guess and a fact the agency will act on.
    throw new Error("A credential cannot be verified without the user who verified it.");
  }

  const applied: EmployeeCredential = {
    ...credential,
    issuer: corrections.issuer !== undefined ? corrections.issuer : credential.issuer,
    credentialNumber:
      corrections.credentialNumber !== undefined
        ? corrections.credentialNumber
        : credential.credentialNumber,
    issuedAt: corrections.issuedAt !== undefined ? corrections.issuedAt : credential.issuedAt,
    expiresAt: corrections.expiresAt !== undefined ? corrections.expiresAt : credential.expiresAt,
    verificationStatus: "verified",
    verifiedAt,
    verifiedByUserId,
    // Confidence described the extraction, not the confirmed fact. Keeping it
    // would invite somebody to treat a verified credential as 82% true.
    extractionConfidence: null,
  };

  return applied;
}

export function rejectCredential(
  credential: EmployeeCredential,
  verifiedByUserId: string,
  verifiedAt: string,
): EmployeeCredential {
  if (!verifiedByUserId) {
    throw new Error("A credential cannot be rejected without the user who rejected it.");
  }
  return {
    ...credential,
    verificationStatus: "rejected",
    status: "rejected",
    verifiedAt,
    verifiedByUserId,
  };
}

/** Which corrections a reviewer actually made, for the audit entry. */
export function correctionsMade(
  before: EmployeeCredential,
  corrections: Correction,
): Array<{ field: keyof Correction; from: string | null; to: string | null }> {
  const fields: Array<keyof Correction> = ["issuer", "credentialNumber", "issuedAt", "expiresAt"];
  return fields
    .filter((f) => corrections[f] !== undefined && corrections[f] !== before[f])
    .map((f) => ({ field: f, from: (before[f] ?? null) as string | null, to: (corrections[f] ?? null) as string | null }));
}

// --------------------------------------------------------------- renewals --

export type UploadIntent = "first" | "renewal" | "duplicate" | "replaces_rejected";

export interface RenewalAssessment {
  intent: UploadIntent;
  /** Shown to the reviewer so the choice is theirs, not the system's. */
  prompt: string;
  existing?: EmployeeCredential;
}

/**
 * What a newly uploaded document means for a credential that already exists.
 *
 * §24 says to ask rather than assume: an upload that looks like a renewal is
 * offered as one, and a human confirms. The one case worth deciding
 * automatically is a byte-identical re-upload, which is somebody pressing the
 * button twice rather than a new card.
 */
export function assessUpload(
  existing: EmployeeCredential | undefined,
  incoming: { expiresAt?: string | null; checksum: string },
  existingDocument: StoredDocument | undefined,
): RenewalAssessment {
  if (!existing) {
    return { intent: "first", prompt: "First document for this credential." };
  }

  if (existingDocument && existingDocument.checksum === incoming.checksum) {
    return {
      intent: "duplicate",
      prompt: "This is the same file that is already on record. Nothing has changed.",
      existing,
    };
  }

  if (existing.verificationStatus === "rejected") {
    return {
      intent: "replaces_rejected",
      prompt: "The document on record was rejected. This one replaces it.",
      existing,
    };
  }

  const currentExpiry = existing.expiresAt ?? null;
  const newExpiry = incoming.expiresAt ?? null;

  if (currentExpiry && newExpiry && newExpiry > currentExpiry) {
    return {
      intent: "renewal",
      prompt: `A ${existing.credentialType.replace(/_/g, " ")} already exists, expiring ${currentExpiry}. This one expires ${newExpiry}. Is this a renewal?`,
      existing,
    };
  }

  // Older or equal. Usually a re-scan of the card already on file, but it might
  // be an earlier certificate being filed late — so it is a question, not a
  // refusal.
  return {
    intent: "duplicate",
    prompt: `A ${existing.credentialType.replace(/_/g, " ")} already exists expiring ${currentExpiry ?? "with no expiry"}, which is not earlier than this one. Check this is not a re-upload.`,
    existing,
  };
}

export interface RenewalResult {
  current: EmployeeCredential;
  superseded: CredentialVersion;
}

/**
 * Apply a confirmed renewal.
 *
 * The standing card becomes a version row carrying its own evidence, and the
 * live record takes the new values. Nothing is deleted — §30 rule 7 — because
 * an auditor asks what was true in 2024, not only what is true today.
 *
 * The renewed credential returns to `needs_review`: a new card is a new
 * consequential fact, and inheriting the old one's verification would let an
 * unread document arrive pre-approved.
 */
export function applyRenewal(
  existing: EmployeeCredential,
  incoming: {
    issuer?: string | null;
    credentialNumber?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    documentId: string;
  },
  at: string,
): RenewalResult {
  const superseded: CredentialVersion = {
    id: `ver-${existing.id}-${at}`,
    employeeCredentialId: existing.id,
    documentId: existing.currentDocumentId ?? null,
    issuer: existing.issuer ?? null,
    credentialNumber: existing.credentialNumber ?? null,
    issuedAt: existing.issuedAt ?? null,
    expiresAt: existing.expiresAt ?? null,
    verificationStatus: existing.verificationStatus,
    verifiedAt: existing.verifiedAt ?? null,
    supersededAt: at,
    createdAt: at,
  };

  const current: EmployeeCredential = {
    ...existing,
    issuer: incoming.issuer ?? null,
    credentialNumber: incoming.credentialNumber ?? null,
    issuedAt: incoming.issuedAt ?? null,
    expiresAt: incoming.expiresAt ?? null,
    currentDocumentId: incoming.documentId,
    verificationStatus: "needs_review" as VerificationStatus,
    verifiedAt: null,
    verifiedByUserId: null,
    status: "pending_review",
  };

  return { current, superseded };
}
