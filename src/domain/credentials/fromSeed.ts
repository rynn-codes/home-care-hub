import type { EmployeeCredential, VerificationStatus } from "@/domain/documents/types";

/**
 * Adapts the prototype's employee seed into the credential records the
 * compliance engine reads.
 *
 * The seed holds `records: { key: { issued, expires } }`, which is what the
 * hiring flow produces and what localStorage carries. The engine expects
 * `EmployeeCredential[]`. This is the seam between the two, and it exists so
 * the engine never learns about the prototype's storage shape — when the
 * database is connected, this file is what gets deleted, not the engine.
 */

export interface SeedCredentialRecord {
  issued?: string | null;
  expires?: string | null;
  issuer?: string | null;
  credentialNumber?: string | null;
  /** Absent in the seed, which predates verification. See below. */
  verificationStatus?: VerificationStatus;
}

export function credentialsFromRecords(
  employeeId: string,
  records: Record<string, SeedCredentialRecord | undefined>,
): EmployeeCredential[] {
  return Object.entries(records)
    .filter(([, record]) => record !== undefined)
    .map(([credentialType, record]) => ({
      id: `${employeeId}:${credentialType}`,
      employeeId,
      credentialType,
      status: "current",
      issuer: record?.issuer ?? null,
      credentialNumber: record?.credentialNumber ?? null,
      issuedAt: record?.issued ?? null,
      expiresAt: record?.expires ?? null,
      // The seed predates the verification model, and everything in it was
      // entered by hand by a person rather than extracted. Treating it as
      // verified is therefore accurate, not a shortcut — a document that
      // arrives through the upload pipeline starts at `needs_review` instead.
      verificationStatus: record?.verificationStatus ?? "verified",
      verifiedAt: null,
      verifiedByUserId: null,
      currentDocumentId: null,
    }));
}
