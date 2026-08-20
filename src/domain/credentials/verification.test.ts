import { describe, expect, it } from "vitest";
import {
  applyRenewal,
  assessUpload,
  confirmCredential,
  correctionsMade,
  rejectCredential,
} from "@/domain/credentials/verification";
import {
  namesPlausiblyMatch,
  proposedVerificationStatus,
  validateExtraction,
} from "@/domain/documents/validation";
import type { ExtractedCredential } from "@/domain/documents/ports";
import type { CredentialRequirement, EmployeeCredential, StoredDocument } from "@/domain/documents/types";

const ASOF = "2026-08-18";

const requirement: CredentialRequirement = {
  credentialType: "cpr_bls",
  displayName: "CPR/BLS",
  folderType: "credentials_licenses",
  sensitivity: "general_credential",
  requiredForRoles: null,
  requiredForDriving: false,
  expirationRequired: true,
  verificationRequired: true,
  blocksSchedulingWhenExpired: true,
  warningDays: [90, 60, 30, 14, 7],
  active: true,
};

function extracted(over: Partial<ExtractedCredential> = {}): ExtractedCredential {
  return {
    documentType: "cpr_bls",
    employeeName: "Jamisha Harper",
    issuer: "American Heart Association",
    issueDate: "2025-05-25",
    expirationDate: "2027-05-31",
    credentialNumber: "AHA-123",
    fieldsNeedingReview: [],
    ...over,
  };
}

const context = { requirement, employeeName: "Jamisha Harper", asOf: ASOF };

function credential(over: Partial<EmployeeCredential> = {}): EmployeeCredential {
  return {
    id: "cred-1",
    employeeId: "emp-1",
    credentialType: "cpr_bls",
    status: "pending_review",
    issuer: "American Heart Association",
    issuedAt: "2025-05-25",
    expiresAt: "2027-05-31",
    verificationStatus: "ai_extracted",
    extractionConfidence: 0.82,
    currentDocumentId: "doc-1",
    ...over,
  };
}

describe("name matching", () => {
  // Loose on purpose: married names and middle initials differ legitimately.
  it("accepts the ordinary variations between a certificate and payroll", () => {
    expect(namesPlausiblyMatch("Jamisha Harper", "Jamisha R Harper")).toBe(true);
    expect(namesPlausiblyMatch("HARPER, JAMISHA", "Jamisha Harper")).toBe(true);
    expect(namesPlausiblyMatch("Jamisha Harper-Cole", "Jamisha Cole")).toBe(true);
  });

  // The case it exists for: somebody else's card on this person's file.
  it("catches a different person", () => {
    expect(namesPlausiblyMatch("Marcus Webb", "Jamisha Harper")).toBe(false);
  });
});

describe("validating what extraction proposed", () => {
  it("passes a clean extraction", () => {
    const result = validateExtraction(extracted(), context);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("refuses a document that is a different credential type", () => {
    const result = validateExtraction(extracted({ documentType: "tb_test" }), context);
    expect(result.ok).toBe(false);
    expect(proposedVerificationStatus(result)).toBe("rejected");
  });

  it("refuses a card belonging to somebody else", () => {
    const result = validateExtraction(extracted({ employeeName: "Marcus Webb" }), context);
    expect(result.ok).toBe(false);
    expect(result.issues[0].field).toBe("employeeMatch");
    expect(proposedVerificationStatus(result)).toBe("rejected");
  });

  // Two dates the wrong way round is the commonest real misread.
  it("catches an expiry on or before the issue date and offers both dates", () => {
    const result = validateExtraction(
      extracted({ issueDate: "2027-05-31", expirationDate: "2025-05-25" }),
      context,
    );
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.field === "expirationDate");
    expect(issue?.message).toMatch(/wrong way round/);
    expect(issue?.candidates).toHaveLength(2);
  });

  it("flags an unreadable date rather than dropping it", () => {
    const result = validateExtraction(extracted({ expirationDate: "May 2027" }), context);
    expect(result.fieldsNeedingReview).toContain("expirationDate");
  });

  it("flags a missing expiry when the requirement needs one", () => {
    const result = validateExtraction(extracted({ expirationDate: null }), context);
    expect(result.issues.some((i) => i.message.match(/needs an expiry date/))).toBe(true);
  });

  it("flags a year that is almost certainly a misread", () => {
    const result = validateExtraction(extracted({ expirationDate: "2099-05-31" }), context);
    expect(result.issues.some((i) => i.message.match(/ten years/))).toBe(true);
  });

  // §10: surface the specific uncertain field, not one overall score.
  it("carries the model's own uncertainty through as named fields", () => {
    const result = validateExtraction(extracted({ fieldsNeedingReview: ["credentialNumber"] }), context);
    expect(result.fieldsNeedingReview).toContain("credentialNumber");
  });

  // Everything reaches a person in V1; the question is only whether it is
  // reviewable or should be thrown out.
  it("sends a merely uncertain extraction to review rather than rejecting it", () => {
    const result = validateExtraction(extracted({ expirationDate: "2099-05-31" }), context);
    expect(proposedVerificationStatus(result)).toBe("needs_review");
  });
});

describe("human confirmation", () => {
  // §30 rule 3. There is no path to verified that does not name a person.
  it("cannot verify without the user who verified it", () => {
    expect(() =>
      confirmCredential({ credential: credential(), verifiedByUserId: "", verifiedAt: ASOF }),
    ).toThrow(/without the user/i);
  });

  it("applies corrections before marking verified", () => {
    const confirmed = confirmCredential({
      credential: credential(),
      corrections: { expiresAt: "2027-06-30" },
      verifiedByUserId: "user-1",
      verifiedAt: "2026-08-18T10:00:00.000Z",
    });
    expect(confirmed.expiresAt).toBe("2027-06-30");
    expect(confirmed.verificationStatus).toBe("verified");
    expect(confirmed.verifiedByUserId).toBe("user-1");
  });

  // Keeping it would invite somebody to read a verified fact as 82% true.
  it("drops the extraction confidence once a human has confirmed", () => {
    const confirmed = confirmCredential({
      credential: credential(),
      verifiedByUserId: "user-1",
      verifiedAt: ASOF,
    });
    expect(confirmed.extractionConfidence).toBeNull();
  });

  it("records rejection with its author too", () => {
    const rejected = rejectCredential(credential(), "user-1", ASOF);
    expect(rejected.verificationStatus).toBe("rejected");
    expect(rejected.status).toBe("rejected");
    expect(() => rejectCredential(credential(), "", ASOF)).toThrow();
  });

  it("reports only the fields the reviewer actually changed", () => {
    const before = credential();
    const changes = correctionsMade(before, {
      expiresAt: "2027-06-30",
      issuer: "American Heart Association",
    });
    expect(changes).toEqual([
      { field: "expiresAt", from: "2027-05-31", to: "2027-06-30" },
    ]);
  });
});

describe("renewals and duplicates", () => {
  const doc: StoredDocument = {
    id: "doc-1",
    organizationId: "org-1",
    ownerType: "employee",
    ownerId: "emp-1",
    documentType: "cpr_bls",
    folderType: "credentials_licenses",
    sensitivity: "general_credential",
    storageKey: "k",
    originalFilename: "cpr.pdf",
    mimeType: "application/pdf",
    fileSize: 1,
    checksum: "sha256:aaa",
    processingState: "verified",
    uploadedByUserId: "u",
    uploadedAt: ASOF,
  };

  it("treats the first document as a first document", () => {
    expect(assessUpload(undefined, { checksum: "sha256:bbb" }, undefined).intent).toBe("first");
  });

  // Somebody pressing the button twice is not a new card.
  it("recognises a byte-identical re-upload", () => {
    const result = assessUpload(credential(), { checksum: "sha256:aaa" }, doc);
    expect(result.intent).toBe("duplicate");
    expect(result.prompt).toMatch(/same file/i);
  });

  // §24: offer it as a renewal and let a human confirm.
  it("offers a later expiry as a renewal, with both dates in the question", () => {
    const result = assessUpload(credential(), { expiresAt: "2029-05-31", checksum: "sha256:bbb" }, doc);
    expect(result.intent).toBe("renewal");
    expect(result.prompt).toContain("2027-05-31");
    expect(result.prompt).toContain("2029-05-31");
  });

  it("questions an earlier expiry rather than refusing it outright", () => {
    const result = assessUpload(credential(), { expiresAt: "2026-01-01", checksum: "sha256:bbb" }, doc);
    expect(result.intent).toBe("duplicate");
    expect(result.prompt).toMatch(/not earlier than this one/);
  });

  it("treats an upload after a rejection as a replacement", () => {
    const result = assessUpload(
      credential({ verificationStatus: "rejected" }),
      { expiresAt: "2029-05-31", checksum: "sha256:bbb" },
      doc,
    );
    expect(result.intent).toBe("replaces_rejected");
  });
});

describe("applying a renewal", () => {
  const existing = credential({ verificationStatus: "verified", verifiedAt: "2025-06-01" });
  const result = applyRenewal(
    existing,
    { issuer: "AHA", issuedAt: "2027-05-01", expiresAt: "2029-05-01", documentId: "doc-2" },
    "2027-05-02T09:00:00.000Z",
  );

  // §30 rule 7.
  it("archives the standing card instead of overwriting it", () => {
    expect(result.superseded.expiresAt).toBe("2027-05-31");
    expect(result.superseded.supersededAt).toBe("2027-05-02T09:00:00.000Z");
  });

  it("keeps the prior evidence attached to the prior version", () => {
    expect(result.superseded.documentId).toBe("doc-1");
  });

  it("moves the live record onto the new card and its new evidence", () => {
    expect(result.current.expiresAt).toBe("2029-05-01");
    expect(result.current.currentDocumentId).toBe("doc-2");
  });

  // A new card is a new consequential fact. Inheriting the old verification
  // would let an unread document arrive pre-approved.
  it("sends the renewed credential back for review rather than inheriting approval", () => {
    expect(result.current.verificationStatus).toBe("needs_review");
    expect(result.current.verifiedAt).toBeNull();
    expect(result.current.verifiedByUserId).toBeNull();
  });
});
