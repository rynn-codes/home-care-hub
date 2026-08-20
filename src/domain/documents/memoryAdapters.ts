import type {
  AccessRequest,
  AuditPacketRequest,
  CredentialExtractionService,
  DocumentAccessService,
  DocumentClassificationService,
  DocumentProcessingService,
  DocumentStorageService,
  DocumentTextService,
  ExtractedCredential,
  ProcessingJob,
  UploadRequest,
} from "@/domain/documents/ports";
import type { DocumentEvent, DocumentSensitivity, ProcessingState } from "@/domain/documents/types";

/**
 * In-memory implementations of the document ports.
 *
 * These exist so the upload → classify → extract → verify → comply workflow can
 * be built and tested before S3, OCR or an extraction model are connected. They
 * are honest fakes, which is the only kind worth having:
 *
 *  - `MemoryDocumentStorage` keeps bytes in a Map and mints a fake signed URL
 *    that carries its own expiry, so code depending on short-lived access
 *    behaves the same way it will in production.
 *  - `NullTextService` and `NullExtractionService` return nothing rather than
 *    inventing an issuer or a date. §23: never fake processing success. A
 *    plausible-looking expiry date that nobody read off a document is worse
 *    than no date, because somebody will trust it.
 *
 * Replacing any of these is a one-line swap at the composition root.
 */

export class MemoryDocumentStorage implements DocumentStorageService {
  private readonly objects = new Map<string, UploadRequest>();
  private counter = 0;

  async put(request: UploadRequest): Promise<string> {
    this.counter += 1;
    // Shaped like a real key: tenant-scoped, opaque, no filename guessing.
    const key = `${request.organizationId}/${request.ownerType}/${request.ownerId}/${this.counter}-${request.checksum.slice(0, 12)}`;
    this.objects.set(key, request);
    return key;
  }

  async signedUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(storageKey)) {
      throw new Error(`No stored object for key ${storageKey}`);
    }
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `memory://${storageKey}?expires=${expiresAt}`;
  }

  async remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }

  /** Test helper. Not part of the port. */
  has(storageKey: string): boolean {
    return this.objects.has(storageKey);
  }
}

export class MemoryProcessingQueue implements DocumentProcessingService {
  private readonly states = new Map<string, ProcessingState>();
  readonly jobs: ProcessingJob[] = [];

  async enqueue(job: ProcessingJob): Promise<void> {
    this.jobs.push(job);
    this.states.set(job.documentId, "queued");
  }

  async state(documentId: string): Promise<ProcessingState> {
    return this.states.get(documentId) ?? "uploaded";
  }

  /** Test helper: move a job on without pretending work happened. */
  set(documentId: string, state: ProcessingState): void {
    this.states.set(documentId, state);
  }
}

/**
 * Reads nothing.
 *
 * A real implementation is Textract, Document AI or similar. Returning empty
 * text means classification and extraction both decline, which routes the
 * document to manual review — the correct behaviour when nothing could be read,
 * and the same path a genuine OCR failure takes.
 */
export class NullTextService implements DocumentTextService {
  async extractText(): Promise<string> {
    return "";
  }
}

/**
 * Classifies by filename only, and says so.
 *
 * Enough to route a document a human named sensibly; never enough to be trusted
 * on its own, which is why confidence is capped well below anything that would
 * skip review.
 */
export class FilenameClassificationService implements DocumentClassificationService {
  private static readonly HINTS: Array<[RegExp, string]> = [
    [/cpr|bls/i, "cpr_bls"],
    [/\btb\b|tuberc/i, "tb_test"],
    [/insur/i, "auto_insurance"],
    [/licen[cs]e|dl\b/i, "drivers_license"],
    [/background|criminal/i, "background_check"],
    [/cna|hha|lvn|certif/i, "licence"],
    [/handbook/i, "handbook"],
    [/immun|vacc/i, "immunizations"],
    [/train/i, "annual_training"],
  ];

  async classify(_text: string, filename: string) {
    for (const [pattern, documentType] of FilenameClassificationService.HINTS) {
      if (pattern.test(filename)) return { documentType, confidence: 0.4 };
    }
    return null;
  }
}

/**
 * Extracts nothing, deliberately.
 *
 * §30 rule 3: AI must never silently verify a consequential credential in V1.
 * The safest possible stand-in is one that proposes nothing at all, so every
 * credential reaches a human with empty fields rather than confident fiction.
 */
export class NullExtractionService implements CredentialExtractionService {
  async extract(): Promise<ExtractedCredential | null> {
    return null;
  }
}

/** §19's sensitivity rules, mirroring can_read_document_sensitivity in 0005. */
const READABLE_BY: Record<DocumentSensitivity, string[]> = {
  general_credential: ["ceo_admin", "rn_clinical", "hr", "scheduler"],
  clinical_credential: ["ceo_admin", "rn_clinical", "hr"],
  identity_sensitive: ["ceo_admin", "hr"],
  background_sensitive: ["ceo_admin", "hr"],
  payroll_sensitive: ["ceo_admin", "payroll"],
  health_sensitive: ["ceo_admin", "rn_clinical"],
};

export class MemoryDocumentAccess implements DocumentAccessService {
  readonly log: Array<{ documentId: string; userId: string; action: DocumentEvent; at: string }> = [];

  async mayView(request: AccessRequest): Promise<boolean> {
    if (request.document.organizationId !== request.organizationId) return false;
    return READABLE_BY[request.document.sensitivity].includes(request.userRole);
  }

  async recordAccess(documentId: string, userId: string, action: DocumentEvent): Promise<void> {
    // §20: the fact of access, never the contents.
    this.log.push({ documentId, userId, action, at: new Date().toISOString() });
  }
}

/**
 * Records that a packet was asked for without producing a PDF.
 *
 * Generating the real thing needs a PDF toolchain and the original evidence;
 * this keeps the call site and the audit event honest in the meantime.
 */
export class MemoryAuditPacketService {
  readonly requests: AuditPacketRequest[] = [];

  async generate(request: AuditPacketRequest) {
    this.requests.push(request);
    throw new Error(
      "Audit packet generation is not implemented. The workflow, permissions and audit event are in place; the PDF toolchain is the developer's to connect.",
    );
  }
}
