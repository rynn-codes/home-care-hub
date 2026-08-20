/**
 * The vocabulary for employee documents and credentials.
 *
 * Source: Joy_Health_Employee_Documents_Credentials_Audit_Spec.md, §5, §6, §19,
 * §23. Kept in exact step with supabase/migrations/0005 — the enums here and the
 * Postgres types there are the same words, so a value never has to be
 * translated on its way between the database and a screen. When one changes,
 * both change.
 */

export type DocumentOwnerType =
  | "employee"
  | "client"
  | "candidate"
  | "admission"
  | "assessment"
  | "organization";

/** §11's personnel-file taxonomy. */
export type DocumentFolder =
  | "employee_application"
  | "credentials_licenses"
  | "health_screening"
  | "driving"
  | "background"
  | "training"
  | "orientation"
  | "employment"
  | "other";

export const FOLDER_LABELS: Record<DocumentFolder, string> = {
  employee_application: "Employee application",
  credentials_licenses: "Credentials & licences",
  health_screening: "Health & screening",
  driving: "Driving",
  background: "Background",
  training: "Training",
  orientation: "Orientation",
  employment: "Employment",
  other: "Other",
};

/**
 * §19. How closely held the document is.
 *
 * This exists so the question "may this person open this file?" can be answered
 * without knowing which screen is asking. A scheduler needs an eligibility
 * answer; that is not the same permission as reading the background check the
 * answer was derived from.
 */
export type DocumentSensitivity =
  | "general_credential"
  | "clinical_credential"
  | "identity_sensitive"
  | "background_sensitive"
  | "payroll_sensitive"
  | "health_sensitive";

/** §23. `superseded` matters: a renewed document steps back, it is not deleted. */
export type ProcessingState =
  | "uploaded"
  | "queued"
  | "processing"
  | "needs_review"
  | "verified"
  | "failed"
  | "superseded";

export type CredentialStatus =
  | "current"
  | "expiring"
  | "expired"
  | "missing"
  | "pending_review"
  | "rejected"
  | "not_applicable";

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  current: "Current",
  expiring: "Expiring soon",
  expired: "Expired",
  missing: "Outstanding",
  pending_review: "Awaiting review",
  rejected: "Rejected",
  not_applicable: "Not applicable",
};

/**
 * §10: AI drafts, humans approve.
 *
 * `ai_extracted` is deliberately not `verified`, and the distance between them
 * is the entire point of this type. V1 must not let extraction silently become
 * a verified credential.
 */
export type VerificationStatus =
  | "unverified"
  | "ai_extracted"
  | "needs_review"
  | "verified"
  | "rejected";

export interface StoredDocument {
  id: string;
  organizationId: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentType: string;
  folderType: DocumentFolder;
  sensitivity: DocumentSensitivity;
  /** A key into private storage. Never a URL — §30 rule 6. */
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  /** Used to spot a duplicate re-upload before it becomes a second credential. */
  checksum: string;
  processingState: ProcessingState;
  processingError?: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
  supersededAt?: string | null;
}

/** §6. What a role must hold, expressed as data rather than as a branch. */
export interface CredentialRequirement {
  credentialType: string;
  displayName: string;
  folderType: DocumentFolder;
  sensitivity: DocumentSensitivity;
  /** Null or empty means every role. */
  requiredForRoles?: string[] | null;
  requiredForDriving: boolean;
  expirationRequired: boolean;
  verificationRequired: boolean;
  /**
   * Who produces this document.
   *
   * `employee` is theirs to find — a CPR card, a driver's licence, a TB result
   * from their own clinic. `agency` is Joy's to run or issue: a background
   * check, the training Joy delivers.
   *
   * The distinction exists because the portal asks candidates to upload things.
   * Without it the upload list is drawn straight from "what is required", and a
   * caregiver is invited to photograph her own background check — a document
   * she has never seen and cannot obtain. Requirements already drive
   * scheduling, hiring and the audit packet, so this belongs with them rather
   * than in a list the portal keeps privately.
   */
  suppliedBy: "employee" | "agency";
  /** Whether an expiry stops this person being scheduled. */
  blocksSchedulingWhenExpired: boolean;
  /** §13's warning points, in days before expiry, largest first. */
  warningDays: number[];
  active: boolean;
}

export interface EmployeeCredential {
  id: string;
  employeeId: string;
  credentialType: string;
  status: CredentialStatus;
  issuer?: string | null;
  credentialNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt?: string | null;
  verifiedByUserId?: string | null;
  currentDocumentId?: string | null;
  /** Kept for triage. §18 keeps it out of the auditor-facing packet. */
  extractionConfidence?: number | null;
}

/** §5. A superseded credential and the evidence that stood behind it. */
export interface CredentialVersion {
  id: string;
  employeeCredentialId: string;
  documentId?: string | null;
  issuer?: string | null;
  credentialNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt?: string | null;
  supersededAt?: string | null;
  createdAt: string;
}

/**
 * §20. The events worth keeping.
 *
 * Named as strings the audit log already understands, so these ride the
 * existing outbox rather than inventing a parallel one.
 */
export const DOCUMENT_EVENTS = [
  "document.uploaded",
  "document.viewed",
  "document.classified",
  "credential.extracted",
  "credential.corrected",
  "credential.verified",
  "credential.expired",
  "credential.renewed",
  "document.superseded",
  "audit_packet.generated",
] as const;

export type DocumentEvent = (typeof DOCUMENT_EVENTS)[number];
