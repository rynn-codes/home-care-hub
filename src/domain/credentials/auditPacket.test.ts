import { describe, expect, it } from "vitest";
import { buildAuditPacket, packetHeadline, type PacketInput } from "@/domain/credentials/auditPacket";
import { auditReadiness } from "@/domain/credentials/compliance";
import type {
  CredentialRequirement,
  DocumentFolder,
  EmployeeCredential,
  StoredDocument,
} from "@/domain/documents/types";

const ASOF = "2026-08-18";

const requirements: CredentialRequirement[] = [
  {
    credentialType: "cpr",
    displayName: "CPR/BLS",
    folderType: "credentials_licenses",
    sensitivity: "clinical_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [60, 30],
    active: true,
  },
  {
    credentialType: "tb_test",
    displayName: "TB screening",
    folderType: "health_screening",
    sensitivity: "health_sensitive",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [60, 30],
    active: true,
  },
];

const FOLDERS: Record<string, DocumentFolder> = {
  cpr: "credentials_licenses",
  tb_test: "health_screening",
};

const document: StoredDocument = {
  id: "doc-cpr",
  organizationId: "org-1",
  ownerType: "employee",
  ownerId: "emp-1",
  documentType: "cpr",
  folderType: "credentials_licenses",
  sensitivity: "clinical_credential",
  storageKey: "k",
  originalFilename: "cpr.pdf",
  mimeType: "application/pdf",
  fileSize: 1,
  checksum: "sha256:a",
  processingState: "verified",
  uploadedByUserId: "u-1",
  uploadedAt: "2025-06-02T10:00:00.000Z",
};

function credentials(over: Partial<EmployeeCredential> = {}): EmployeeCredential[] {
  return [
    {
      id: "c1",
      employeeId: "emp-1",
      credentialType: "cpr",
      status: "current",
      expiresAt: "2027-06-01",
      issuedAt: "2025-06-01",
      verificationStatus: "verified",
      verifiedByUserId: "Karynn Verrett",
      verifiedAt: "2025-06-02T11:00:00.000Z",
      currentDocumentId: "doc-cpr",
      extractionConfidence: 0.82,
      ...over,
    },
  ];
}

function packet(over: Partial<PacketInput> = {}) {
  const creds = over.credentials ?? credentials();
  const readiness = auditReadiness(
    { employeeId: "emp-1", role: "cna", drives: false },
    requirements,
    creds,
    ASOF,
  );
  return buildAuditPacket({
    kind: "personnel_file",
    employee: {
      id: "emp-1",
      name: "Jamisha Harper",
      position: "CNA",
      hiredOn: "2024-10-07",
      employmentStatus: "Active",
    },
    readiness,
    credentials: creds,
    documents: [document],
    folderFor: (type) => FOLDERS[type] ?? "other",
    generatedAt: "2026-08-19",
    generatedByUserId: "Karynn Verrett",
    ...over,
  });
}

describe("the cover sheet", () => {
  // §15: let an auditor understand the file before flipping through every page.
  it("leads with readiness and names what is wrong", () => {
    const p = packet();
    expect(p.cover.readinessLine).toBe("1 of 2 requirements complete");
    expect(p.cover.ready).toBe(false);
    expect(p.cover.needsAttention[0]).toMatch(/TB screening — outstanding/);
    expect(p.cover.current).toEqual(["CPR/BLS"]);
  });

  it("says so plainly when the file is ready", () => {
    const full = [
      ...credentials(),
      {
        id: "c2",
        employeeId: "emp-1",
        credentialType: "tb_test",
        status: "current" as const,
        expiresAt: "2027-02-10",
        verificationStatus: "verified" as const,
      },
    ];
    const p = packet({ credentials: full });
    expect(p.cover.ready).toBe(true);
    expect(packetHeadline(p)).toBe("Audit ready — 2 of 2 requirements complete");
  });

  it("names the exception in the headline rather than a percentage", () => {
    expect(packetHeadline(packet())).toMatch(/^Not audit ready — TB screening/);
  });
});

describe("the credential summary", () => {
  // §16: status must read without colour, so it survives a mono printer.
  it("carries a mark as well as a word", () => {
    const rows = packet().summary;
    expect(rows.find((r) => r.requirement === "CPR/BLS")).toMatchObject({
      status: "Current",
      mark: "✓",
      verified: "Yes",
      expiresOrCompleted: "2027-06-01",
    });
    expect(rows.find((r) => r.requirement === "TB screening")).toMatchObject({
      status: "Outstanding",
      mark: "✗",
      verified: "—",
    });
  });

  it("marks an unverified credential as not verified", () => {
    const p = packet({ credentials: credentials({ verificationStatus: "ai_extracted" }) });
    expect(p.summary.find((r) => r.requirement === "CPR/BLS")?.verified).toBe("No");
  });
});

describe("document covers", () => {
  it("files each credential under its own section, in §15's order", () => {
    const titles = packet().sections.map((s) => s.title);
    expect(titles.slice(0, 4)).toEqual([
      "Credentials & licences",
      "Health & screening",
      "Driving",
      "Background",
    ]);
  });

  it("carries §17's fields on the cover that precedes the original", () => {
    const cover = packet()
      .sections.find((s) => s.title === "Credentials & licences")!
      .covers.find((c) => c.documentName === "CPR/BLS")!;

    expect(cover).toMatchObject({
      employeeName: "Jamisha Harper",
      position: "CNA",
      folderName: "Credentials & licences",
      hireDate: "2024-10-07",
      expirationDate: "2027-06-01",
      credentialStatus: "Current",
      verifiedBy: "Karynn Verrett",
      standing: "Current",
      documentId: "doc-cpr",
    });
  });

  // §18: the packet emphasises verified facts and original evidence.
  it("keeps extraction confidence out of the auditor-facing packet entirely", () => {
    const serialised = JSON.stringify(packet());
    expect(serialised).not.toContain("0.82");
    expect(serialised).not.toMatch(/confidence/i);
  });

  // An empty required section reads as "fine" unless it says otherwise.
  it("says a required section is empty rather than omitting it", () => {
    const driving = packet().sections.find((s) => s.title === "Driving")!;
    expect(driving.covers).toEqual([]);
    expect(driving.note).toMatch(/No documents filed/);
  });

  it("notes a requirement with no evidence behind it", () => {
    const tb = packet()
      .sections.find((s) => s.title === "Health & screening")!
      .covers.find((c) => c.documentName === "TB screening")!;
    expect(tb.documentId).toBeNull();
    expect(tb.credentialStatus).toBe("Outstanding");
  });
});

describe("the checklist", () => {
  // §15 item 3: what the file is supposed to contain, ticked or not.
  it("ticks what is held and leaves the rest visible", () => {
    expect(packet().checklist).toEqual([
      { requirement: "CPR/BLS", present: true, status: "Current" },
      { requirement: "TB screening", present: false, status: "Outstanding" },
    ]);
  });
});

describe("narrower exports", () => {
  it("narrows a single-document export to one piece of evidence", () => {
    const p = packet({ kind: "single_document", documentId: "doc-cpr" });
    const covers = p.sections.flatMap((s) => s.covers);
    expect(covers).toHaveLength(1);
    expect(covers[0].documentName).toBe("CPR/BLS");
    // And drops the sections that would otherwise print empty.
    expect(p.sections).toHaveLength(1);
  });

  it("keeps the same cover fields whichever export produced it", () => {
    const single = packet({ kind: "single_document", documentId: "doc-cpr" })
      .sections[0].covers[0];
    const full = packet()
      .sections.find((s) => s.title === "Credentials & licences")!.covers[0];
    expect(single).toEqual(full);
  });
});

describe("reproducibility", () => {
  // §25: the packet is never the database. Same records in, same packet out.
  it("produces an identical packet from identical records", () => {
    expect(JSON.stringify(packet())).toEqual(JSON.stringify(packet()));
  });

  it("records who generated it and when", () => {
    expect(packet().metadata).toMatchObject({
      "Generated at": "2026-08-19",
      "Generated by": "Karynn Verrett",
      "Audit ready": "No",
    });
  });
});
