import { describe, expect, it } from "vitest";
import { declineRequest, newSignatureRequest, requestsForFamily, signRequest, signatureLine, whyNotRequestSignature, whyNotSign } from "./signatureRequests";

const request = () =>
  newSignatureRequest({
    id: "sig-1",
    documentId: "doc-1",
    documentName: "Plan of Care.pdf",
    clientPersonId: "c-pamela",
    clientName: "Pamela P",
    signerRole: "responsible_party",
    signerName: "Marta P",
    reason: "The care plan needs a signature before care starts.",
    requestedBy: "Karynn Verrett",
    at: "2026-09-25T10:00:00.000Z",
  });

describe("requesting a signature", () => {
  it("needs a document, a client and a reason the family will read", () => {
    expect(whyNotRequestSignature({ documentId: null, clientPersonId: "c-pamela", reason: "Because." })).toMatch(/document/);
    expect(whyNotRequestSignature({ documentId: "doc-1", clientPersonId: null, reason: "Because." })).toMatch(/whose/);
    expect(whyNotRequestSignature({ documentId: "doc-1", clientPersonId: "c-pamela", reason: "Hi" })).toMatch(/why/);
    expect(whyNotRequestSignature({ documentId: "doc-1", clientPersonId: "c-pamela", reason: "Needed before care starts." })).toBeNull();
  });

  it("starts pending, with nothing signed", () => {
    const r = request();
    expect(r.status).toBe("pending");
    expect(r.signedName).toBeNull();
    expect(r.markDrawn).toBe(false);
  });
});

describe("signing", () => {
  it("wants a typed name and a drawn mark", () => {
    expect(whyNotSign({ request: request(), typedName: "", markDrawn: true })).toMatch(/name/);
    expect(whyNotSign({ request: request(), typedName: "Marta P", markDrawn: false })).toMatch(/Draw/);
    expect(whyNotSign({ request: request(), typedName: "Marta P", markDrawn: true })).toBeNull();
  });

  it("records who, when and that a mark was drawn — never the mark itself", () => {
    const signed = signRequest({ request: request(), typedName: " Marta P ", markDrawn: true, at: "2026-09-25T15:40:00.000Z" });
    expect(signed.status).toBe("signed");
    expect(signed.signedName).toBe("Marta P");
    expect(signed.signedAt).toBe("2026-09-25T15:40:00.000Z");
    expect(signed.markDrawn).toBe(true);
    expect(Object.keys(signed)).not.toContain("mark");
  });

  it("cannot be signed twice, or after declining", () => {
    const signed = signRequest({ request: request(), typedName: "Marta P", markDrawn: true, at: "2026-09-25T15:40:00.000Z" });
    expect(() => signRequest({ request: signed, typedName: "Marta P", markDrawn: true, at: "2026-09-26T09:00:00.000Z" })).toThrow(/already/);
    const declined = declineRequest({ request: request(), reason: "I want to read it first", at: "2026-09-25T15:40:00.000Z" });
    expect(declined.status).toBe("declined");
    expect(() => signRequest({ request: declined, typedName: "Marta P", markDrawn: true, at: "2026-09-26T09:00:00.000Z" })).toThrow(/already/);
  });

  it("says on the record what happened", () => {
    const fmt = (iso: string) => iso.slice(0, 10);
    expect(signatureLine(request(), fmt)).toBe("Waiting on Marta P · asked 2026-09-25");
    const signed = signRequest({ request: request(), typedName: "Marta P", markDrawn: true, at: "2026-09-25T15:40:00.000Z" });
    expect(signatureLine(signed, fmt)).toBe("Signed by Marta P · 2026-09-25");
    const declined = declineRequest({ request: request(), reason: "Wrong document", at: "2026-09-25T15:40:00.000Z" });
    expect(signatureLine(declined, fmt)).toBe("Declined 2026-09-25 — Wrong document");
  });
});

describe("the family portal", () => {
  it("finds the request by the portal's own id or by first name", () => {
    const r = newSignatureRequest({ ...request(), id: "sig-2", clientPersonId: "c-jessie", clientName: "Jessie C", at: "2026-09-25T10:00:00.000Z" });
    expect(requestsForFamily([r], { subjectPersonId: "p-marcus", subjectName: "Jessie" })).toHaveLength(1);
    expect(requestsForFamily([r], { subjectPersonId: "c-jessie", subjectName: null })).toHaveLength(1);
    expect(requestsForFamily([r], { subjectPersonId: "p-albert", subjectName: "Albert" })).toHaveLength(0);
  });
});
