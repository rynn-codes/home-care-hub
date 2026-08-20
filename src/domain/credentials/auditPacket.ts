import type { AuditReadiness, RequirementOutcome } from "@/domain/credentials/compliance";
import {
  CREDENTIAL_STATUS_LABELS,
  FOLDER_LABELS,
  type DocumentFolder,
  type EmployeeCredential,
  type StoredDocument,
} from "@/domain/documents/types";

/**
 * Composing the personnel-file audit packet.
 *
 * §25: a generated packet must be reproducible from verified data, and must
 * never become the database. So this is a pure projection — (employee,
 * readiness, credentials, documents) in, packet structure out — with no state
 * of its own. Regenerate it a year later from the same records and you get the
 * same packet.
 *
 * What this deliberately does NOT do is render a PDF. The section order, the
 * cover contents, the credential summary and the per-document cover sheets are
 * all decided here and tested; turning that structure into pages is the
 * AuditPacketService port's job, and a toolchain the developer connects.
 *
 * §18 is the rule that shapes the tone: the packet emphasises verified facts and
 * original evidence, and AI confidence must not dominate it. Extraction
 * confidence appears nowhere below.
 */

export type PacketKind = "personnel_file" | "credential_packet" | "single_document";

export interface PacketEmployee {
  id: string;
  name: string;
  position: string;
  hiredOn: string | null;
  employmentStatus: string;
}

/** §15's cover sheet. What an auditor reads before turning a page. */
export interface PacketCover {
  title: string;
  employeeName: string;
  position: string;
  hireDate: string | null;
  employmentStatus: string;
  generatedAt: string;
  /** "11 of 12 requirements complete" */
  readinessLine: string;
  ready: boolean;
  needsAttention: string[];
  current: string[];
}

/** §16. Status carries text as well as colour, so it survives a mono printer. */
export interface CredentialSummaryRow {
  requirement: string;
  status: string;
  /** Expiry, or the completion date for things that do not expire. */
  expiresOrCompleted: string;
  verified: "Yes" | "No" | "—";
  /** A mark that reads without colour: ✓ current, ! expiring, ✗ expired. */
  mark: "✓" | "!" | "✗" | "–";
}

/** §17. The reusable Joy cover that precedes each original document. */
export interface DocumentCover {
  employeeName: string;
  position: string;
  documentName: string;
  folderName: string;
  hireDate: string | null;
  expirationDate: string | null;
  credentialStatus: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** §18's metadata, kept modest and auditor-facing. */
  uploadedAt: string | null;
  /** "Current" or "Prior" — a superseded card still belongs in the file. */
  standing: "Current" | "Prior";
  /** The evidence this cover introduces. Null when nothing was uploaded. */
  documentId: string | null;
}

export interface PacketSection {
  /** §15's ordering is the auditor's reading order, not ours to rearrange. */
  title: string;
  folder: DocumentFolder | null;
  covers: DocumentCover[];
  /** Shown when a section is required but empty — silence would read as fine. */
  note?: string;
}

export interface AuditPacket {
  kind: PacketKind;
  employeeId: string;
  cover: PacketCover;
  summary: CredentialSummaryRow[];
  /** §15 item 3: what the file is supposed to contain, ticked or not. */
  checklist: Array<{ requirement: string; present: boolean; status: string }>;
  sections: PacketSection[];
  /** §18. Enough provenance to answer "who said so, and when". */
  metadata: Record<string, string>;
}

const MARKS: Record<string, CredentialSummaryRow["mark"]> = {
  current: "✓",
  expiring: "!",
  expired: "✗",
  missing: "✗",
  rejected: "✗",
  pending_review: "!",
  not_applicable: "–",
};

/** §15's section order. Fixed, because an auditor expects the same file twice. */
const SECTION_ORDER: Array<{ title: string; folders: DocumentFolder[] }> = [
  { title: "Credentials & licences", folders: ["credentials_licenses"] },
  { title: "Health & screening", folders: ["health_screening"] },
  { title: "Driving", folders: ["driving"] },
  { title: "Background", folders: ["background"] },
  { title: "Employment & hiring", folders: ["employee_application", "employment"] },
  { title: "Training & orientation", folders: ["training", "orientation"] },
  { title: "Other personnel documents", folders: ["other"] },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function buildCover(
  employee: PacketEmployee,
  readiness: AuditReadiness,
  generatedAt: string,
): PacketCover {
  const needsAttention = readiness.outcomes
    .filter((o) => o.action !== null)
    .map((o) => `${o.displayName} — ${CREDENTIAL_STATUS_LABELS[o.status].toLowerCase()}`);

  const current = readiness.outcomes
    .filter((o) => o.status === "current")
    .map((o) => o.displayName);

  return {
    title: "PERSONNEL FILE AUDIT",
    employeeName: employee.name,
    position: employee.position,
    hireDate: employee.hiredOn,
    employmentStatus: employee.employmentStatus,
    generatedAt,
    readinessLine: `${readiness.complete} of ${readiness.required} requirements complete`,
    ready: readiness.ready,
    needsAttention,
    current,
  };
}

export function buildSummary(
  readiness: AuditReadiness,
  credentials: readonly EmployeeCredential[],
): CredentialSummaryRow[] {
  const byType = new Map(credentials.map((c) => [c.credentialType, c]));

  return readiness.outcomes.map((outcome) => {
    const credential = byType.get(outcome.credentialType);
    return {
      requirement: outcome.displayName,
      status: CREDENTIAL_STATUS_LABELS[outcome.status],
      expiresOrCompleted: formatDate(outcome.expiresAt ?? credential?.issuedAt),
      verified:
        credential === undefined
          ? "—"
          : credential.verificationStatus === "verified"
            ? "Yes"
            : "No",
      mark: MARKS[outcome.status] ?? "–",
    };
  });
}

function coverFor(
  employee: PacketEmployee,
  outcome: RequirementOutcome,
  credential: EmployeeCredential | undefined,
  document: StoredDocument | undefined,
  folder: DocumentFolder,
  standing: DocumentCover["standing"] = "Current",
): DocumentCover {
  return {
    employeeName: employee.name,
    position: employee.position,
    documentName: outcome.displayName,
    folderName: FOLDER_LABELS[folder],
    hireDate: employee.hiredOn,
    expirationDate: outcome.expiresAt,
    credentialStatus: CREDENTIAL_STATUS_LABELS[outcome.status],
    verifiedBy: credential?.verifiedByUserId ?? null,
    verifiedAt: credential?.verifiedAt ?? null,
    uploadedAt: document?.uploadedAt ?? null,
    standing,
    documentId: document?.id ?? null,
  };
}

export interface PacketInput {
  kind: PacketKind;
  employee: PacketEmployee;
  readiness: AuditReadiness;
  credentials: readonly EmployeeCredential[];
  documents: readonly StoredDocument[];
  /** Which folder each requirement files under. */
  folderFor: (credentialType: string) => DocumentFolder;
  generatedAt: string;
  generatedByUserId: string;
  /** For a single-document export. */
  documentId?: string;
}

export function buildAuditPacket(input: PacketInput): AuditPacket {
  const { employee, readiness, credentials, documents, folderFor, generatedAt } = input;

  const credentialByType = new Map(credentials.map((c) => [c.credentialType, c]));
  const documentById = new Map(documents.map((d) => [d.id, d]));

  const sections: PacketSection[] = SECTION_ORDER.map(({ title, folders }) => {
    const covers: DocumentCover[] = [];

    for (const outcome of readiness.outcomes) {
      const folder = folderFor(outcome.credentialType);
      if (!folders.includes(folder)) continue;

      const credential = credentialByType.get(outcome.credentialType);
      const document = credential?.currentDocumentId
        ? documentById.get(credential.currentDocumentId)
        : undefined;

      // A single-document export narrows to one piece of evidence, but keeps
      // the same cover so the page is filed identically either way.
      if (input.kind === "single_document" && document?.id !== input.documentId) continue;

      covers.push(coverFor(employee, outcome, credential, document, folder));
    }

    return {
      title,
      folder: folders[0],
      covers,
      // An empty required section must say so. Silence reads as "fine".
      note: covers.length === 0 ? "No documents filed in this section." : undefined,
    };
  }).filter((section) => input.kind !== "single_document" || section.covers.length > 0);

  const checklist = readiness.outcomes.map((o) => ({
    requirement: o.displayName,
    present: o.status === "current" || o.status === "expiring",
    status: CREDENTIAL_STATUS_LABELS[o.status],
  }));

  return {
    kind: input.kind,
    employeeId: employee.id,
    cover: buildCover(employee, readiness, generatedAt),
    summary:
      input.kind === "single_document"
        ? buildSummary(readiness, credentials).filter((row) =>
            sections.some((s) => s.covers.some((c) => c.documentName === row.requirement)),
          )
        : buildSummary(readiness, credentials),
    checklist,
    sections,
    metadata: {
      "Generated at": generatedAt,
      "Generated by": input.generatedByUserId,
      "Employee": employee.name,
      "Requirements": String(readiness.required),
      "Complete": String(readiness.complete),
      "Audit ready": readiness.ready ? "Yes" : "No",
    },
  };
}

/**
 * §27's readiness, said in one line for a packet header or a listing.
 *
 * Names what is wrong rather than only that something is, because an auditor
 * asked "is this file ready?" wants the exception, not a percentage.
 */
export function packetHeadline(packet: AuditPacket): string {
  if (packet.cover.ready) return `Audit ready — ${packet.cover.readinessLine}`;
  const first = packet.cover.needsAttention[0];
  const rest = packet.cover.needsAttention.length - 1;
  return `Not audit ready — ${first}${rest > 0 ? ` and ${rest} more` : ""}`;
}
