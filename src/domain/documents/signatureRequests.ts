/**
 * Asking a client or their responsible party to sign a document.
 *
 * The office picks a file in Documents and a client; the request appears on
 * the client's record and in the family portal, where the signer types their
 * name and draws a mark. Joy records who signed, when, and that a mark was
 * drawn.
 *
 * WHAT THIS IS NOT. No e-signature provider is connected, so nothing stamps
 * the PDF, nothing certifies the signature, and nobody is notified — Spruce
 * is not wired, and the request is seen when the family next opens the
 * portal. The drawn mark itself is shown back to the signer for confirmation
 * and is not kept in the browser: a signature is personal data, and
 * localStorage is unencrypted and readable by anything on the page. A signing
 * provider would hold it with the stamped document.
 */
export type SignatureStatus = "pending" | "signed" | "declined";

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  pending: "Pending",
  signed: "Signed",
  declined: "Declined",
};

export type SignerRole = "client" | "responsible_party";

export const SIGNER_ROLE_LABELS: Record<SignerRole, string> = {
  client: "the client",
  responsible_party: "the responsible party",
};

export interface SignatureRequest {
  id: string;
  documentId: string;
  documentName: string;
  clientPersonId: string;
  clientName: string;
  signerRole: SignerRole;
  /** Who is expected to sign — the client, or the responsible party by name. */
  signerName: string;
  /** Why Joy needs it, shown to the family word for word. Empty when the office gave none. */
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: SignatureStatus;
  /** Set when signed: the name typed, when, and that a mark was drawn. */
  signedName: string | null;
  signedAt: string | null;
  markDrawn: boolean;
  /** Set when declined. */
  declinedAt: string | null;
  declinedReason: string | null;
}

export const SIGNATURE_LIMITS =
  "No signing provider is connected. Nothing stamps the file and nobody is notified — the request shows in the family portal when they next open it, and Joy records who signed and when.";

/** The reason is optional — a signature on a named file explains itself more often than a paperwork request does. */
export function whyNotRequestSignature(input: { documentId: string | null; clientPersonId: string | null; reason: string }): string | null {
  if (!input.documentId) return "Choose a document to sign.";
  if (!input.clientPersonId) return "Choose whose signature this is for.";
  return null;
}

export function newSignatureRequest(input: {
  id: string;
  documentId: string;
  documentName: string;
  clientPersonId: string;
  clientName: string;
  signerRole: SignerRole;
  signerName: string;
  reason: string;
  requestedBy: string;
  at: string;
}): SignatureRequest {
  const problem = whyNotRequestSignature(input);
  if (problem) throw new Error(problem);
  return {
    id: input.id,
    documentId: input.documentId,
    documentName: input.documentName,
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    signerRole: input.signerRole,
    signerName: input.signerName,
    reason: input.reason.trim(),
    requestedBy: input.requestedBy,
    requestedAt: input.at,
    status: "pending",
    signedName: null,
    signedAt: null,
    markDrawn: false,
    declinedAt: null,
    declinedReason: null,
  };
}

/** Why a signature cannot be taken yet, in the signer's words. */
export function whyNotSign(input: { request: SignatureRequest; typedName: string; markDrawn: boolean }): string | null {
  if (input.request.status !== "pending") return "This has already been answered.";
  if (input.typedName.trim().length < 2) return "Type your full name.";
  if (!input.markDrawn) return "Draw your signature in the box.";
  return null;
}

export function signRequest(input: { request: SignatureRequest; typedName: string; markDrawn: boolean; at: string }): SignatureRequest {
  const problem = whyNotSign(input);
  if (problem) throw new Error(problem);
  return { ...input.request, status: "signed", signedName: input.typedName.trim(), signedAt: input.at, markDrawn: true };
}

export function declineRequest(input: { request: SignatureRequest; reason: string; at: string }): SignatureRequest {
  if (input.request.status !== "pending") throw new Error("This has already been answered.");
  return { ...input.request, status: "declined", declinedAt: input.at, declinedReason: input.reason.trim() || null };
}

export function requestsForClient(requests: readonly SignatureRequest[], clientPersonId: string): SignatureRequest[] {
  return requests.filter((r) => r.clientPersonId === clientPersonId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function requestsForDocument(requests: readonly SignatureRequest[], documentId: string): SignatureRequest[] {
  return requests.filter((r) => r.documentId === documentId);
}

/**
 * The requests a family grant can see.
 *
 * A family grant names its subject by the portal's own person id, which the
 * demo's client roster does not share — the portal was seeded before the
 * roster existed. Match on the id first, then on the client's first name, so
 * a request raised from the record reaches the portal that greets the same
 * person.
 */
export function requestsForFamily(requests: readonly SignatureRequest[], grant: { subjectPersonId: string | null; subjectName: string | null }): SignatureRequest[] {
  return requests
    .filter((r) => {
      if (grant.subjectPersonId && r.clientPersonId === grant.subjectPersonId) return true;
      const first = grant.subjectName?.trim().toLowerCase();
      return !!first && r.clientName.trim().toLowerCase().split(" ")[0] === first;
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** One line for the record: "Signed by Denise K · Sep 25, 3:40 PM". */
export function signatureLine(request: SignatureRequest, fmt: (iso: string) => string): string {
  switch (request.status) {
    case "signed":
      return `Signed by ${request.signedName} · ${fmt(request.signedAt ?? request.requestedAt)}`;
    case "declined":
      return `Declined ${fmt(request.declinedAt ?? request.requestedAt)}${request.declinedReason ? ` — ${request.declinedReason}` : ""}`;
    default:
      return `Waiting on ${request.signerName} · asked ${fmt(request.requestedAt)}`;
  }
}
