import type {
  CredentialRequirement,
  CredentialVersion,
  DocumentEvent,
  DocumentSensitivity,
  EmployeeCredential,
  ProcessingState,
  StoredDocument,
  VerificationStatus,
} from "@/domain/documents/types";

/**
 * The service boundaries from §22, as ports.
 *
 * Every one of these is a seam a developer wires to a real vendor — S3, an OCR
 * service, an extraction model — without touching a screen or a rule. Joy's
 * side of each boundary is fully specified here; the far side is deliberately
 * absent, because §22 says vendor-specific implementations sit behind adapters
 * and the spec is emphatic that AI must not become the document repository.
 *
 * The in-memory implementations in `memoryAdapters.ts` exist so the workflow can
 * be built and tested end to end before any of that is connected. They are
 * honest fakes: they do not pretend to OCR anything, and
 * `NullExtractionService` returns nothing rather than inventing a date, because
 * §23 says never to fake processing success.
 */

// ---------------------------------------------------------------- storage --

export interface UploadRequest {
  organizationId: string;
  ownerType: StoredDocument["ownerType"];
  ownerId: string;
  documentType: string;
  folderType: StoredDocument["folderType"];
  sensitivity: DocumentSensitivity;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  uploadedByUserId: string | null;
  /** The bytes. Never persisted by Joy — handed straight to storage. */
  content?: Blob | ArrayBuffer;
}

/**
 * Private object storage. §19: block public access, encrypt at rest, no
 * permanent public URLs.
 */
export interface DocumentStorageService {
  /** Returns the storage key. The caller records it; it is not a URL. */
  put(request: UploadRequest): Promise<string>;
  /**
   * A short-lived signed URL, minted only after a permission check. §19's
   * secure-viewing flow. Expiry is in seconds.
   */
  signedUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
  remove(storageKey: string): Promise<void>;
}

// ------------------------------------------------------------- processing --

export interface ProcessingJob {
  documentId: string;
  storageKey: string;
  mimeType: string;
}

/**
 * §8: asynchronous, and a failure must never destroy the uploaded file.
 * Implementations enqueue; they do not process inline.
 */
export interface DocumentProcessingService {
  enqueue(job: ProcessingJob): Promise<void>;
  state(documentId: string): Promise<ProcessingState>;
}

/** OCR or equivalent. Returns text; understanding it is somebody else's job. */
export interface DocumentTextService {
  extractText(job: ProcessingJob): Promise<string>;
}

/** §21: what document is this? Built once, reused for every type. */
export interface DocumentClassificationService {
  classify(text: string, filename: string): Promise<{ documentType: string; confidence: number } | null>;
}

// ------------------------------------------------------------ extraction --

/**
 * §9's typed output. Consequential values are never parsed out of an
 * unstructured paragraph.
 */
export interface ExtractedCredential {
  documentType: string;
  employeeName?: string | null;
  issuer?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  credentialNumber?: string | null;
  /**
   * Fields the model is not confident about. §10 surfaces these individually
   * rather than showing one overall confidence score, because "which date is
   * the expiry?" is answerable and "72% confident" is not.
   */
  fieldsNeedingReview: string[];
  confidence?: number | null;
}

export interface CredentialExtractionService {
  /** Null when nothing usable was found. Never a guess. */
  extract(text: string, documentType: string): Promise<ExtractedCredential | null>;
}

// ---------------------------------------------------------- verification --

export interface VerificationDecision {
  credentialId: string;
  verifiedByUserId: string;
  status: Extract<VerificationStatus, "verified" | "rejected">;
  /** Corrections the human made to what was extracted. */
  corrections?: Partial<
    Pick<EmployeeCredential, "issuer" | "credentialNumber" | "issuedAt" | "expiresAt">
  >;
  note?: string;
}

/**
 * §10: AI drafts, humans approve.
 *
 * There is deliberately no method here that lets extraction mark its own work
 * verified. The only route to `verified` takes a user id.
 */
export interface CredentialVerificationService {
  pending(organizationId: string): Promise<EmployeeCredential[]>;
  decide(decision: VerificationDecision): Promise<EmployeeCredential>;
  /** §24. Supersede rather than overwrite; history survives. */
  renew(credentialId: string, replacement: Partial<EmployeeCredential>, documentId: string): Promise<{
    current: EmployeeCredential;
    superseded: CredentialVersion;
  }>;
}

// ------------------------------------------------------------ compliance --

/**
 * §27: one rule engine, many views. Employee profile, Operations, Home,
 * Hiring, the audit packet and Scheduling all ask this, so none of them can
 * drift into having its own opinion.
 */
export interface ComplianceService {
  requirements(organizationId: string): Promise<CredentialRequirement[]>;
  credentialsFor(employeeId: string): Promise<EmployeeCredential[]>;
  recalculate(employeeId: string, asOf: string): Promise<void>;
}

// ----------------------------------------------------------------- access --

export interface AccessRequest {
  userId: string;
  userRole: string;
  organizationId: string;
  document: StoredDocument;
}

/**
 * §19's permission check, separated from the storage that mints the URL so the
 * two cannot be accidentally collapsed into one call that always says yes.
 */
export interface DocumentAccessService {
  mayView(request: AccessRequest): Promise<boolean>;
  /** Records the view. §20 — but never the document's contents. */
  recordAccess(documentId: string, userId: string, action: DocumentEvent): Promise<void>;
}

// ------------------------------------------------------------ audit packet --

export type AuditPacketKind = "personnel_file" | "credential_packet" | "single_document";

export interface AuditPacketRequest {
  kind: AuditPacketKind;
  employeeId: string;
  requestedByUserId: string;
  /** For single_document. */
  documentId?: string;
  generatedAt: string;
}

/**
 * §25: generated artifacts are reproducible from verified data. The packet is
 * never the database.
 */
export interface AuditPacketService {
  generate(request: AuditPacketRequest): Promise<{ storageKey: string; pageCount: number }>;
}
