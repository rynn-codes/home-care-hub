import { describe, expect, it } from "vitest";
import {
  FilenameClassificationService,
  MemoryDocumentAccess,
  MemoryDocumentStorage,
  MemoryProcessingQueue,
  NullExtractionService,
  NullTextService,
} from "@/domain/documents/memoryAdapters";
import type { StoredDocument } from "@/domain/documents/types";

const upload = {
  organizationId: "org-1",
  ownerType: "employee" as const,
  ownerId: "emp-1",
  documentType: "cpr_bls",
  folderType: "credentials_licenses" as const,
  sensitivity: "general_credential" as const,
  originalFilename: "cpr-card.pdf",
  mimeType: "application/pdf",
  fileSize: 4242,
  checksum: "sha256:abcdef123456789",
  uploadedByUserId: "user-1",
};

function doc(over: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: "doc-1",
    organizationId: "org-1",
    ownerType: "employee",
    ownerId: "emp-1",
    documentType: "background_check",
    folderType: "background",
    sensitivity: "background_sensitive",
    storageKey: "org-1/employee/emp-1/1-abc",
    originalFilename: "background.pdf",
    mimeType: "application/pdf",
    fileSize: 100,
    checksum: "sha256:x",
    processingState: "verified",
    uploadedByUserId: "user-1",
    uploadedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("storage", () => {
  it("returns an opaque tenant-scoped key, not a URL", async () => {
    const key = await new MemoryDocumentStorage().put(upload);
    expect(key).toContain("org-1/employee/emp-1");
    expect(key).not.toMatch(/^https?:/);
    // §30 rule 6: the filename must not become a guessable public path.
    expect(key).not.toContain("cpr-card.pdf");
  });

  // §19's signed viewing: access is time-limited, so code depending on that
  // behaves the same way once S3 is behind it.
  it("mints a signed URL that carries its own expiry", async () => {
    const storage = new MemoryDocumentStorage();
    const key = await storage.put(upload);
    const url = await storage.signedUrl(key, 60);
    const expires = Number(new URL(url).searchParams.get("expires"));
    expect(expires).toBeGreaterThan(Date.now());
    expect(expires).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it("refuses to sign a key it does not hold", async () => {
    await expect(new MemoryDocumentStorage().signedUrl("nope", 60)).rejects.toThrow();
  });
});

describe("processing", () => {
  // §8: asynchronous. Uploading enqueues; it does not process inline.
  it("queues rather than processing inline", async () => {
    const queue = new MemoryProcessingQueue();
    await queue.enqueue({ documentId: "doc-1", storageKey: "k", mimeType: "application/pdf" });
    expect(queue.jobs).toHaveLength(1);
    expect(await queue.state("doc-1")).toBe("queued");
  });

  it("reports a document nobody has queued as merely uploaded", async () => {
    expect(await new MemoryProcessingQueue().state("unknown")).toBe("uploaded");
  });
});

describe("the null services decline rather than invent", () => {
  // §23: never fake processing success. A plausible expiry nobody read off a
  // document is worse than none, because somebody will trust it.
  it("extracts no text and proposes no credential", async () => {
    expect(await new NullTextService().extractText()).toBe("");
    expect(await new NullExtractionService().extract()).toBeNull();
  });

  it("classifies from a filename with confidence too low to skip review", async () => {
    const svc = new FilenameClassificationService();
    const cpr = await svc.classify("", "Jamal-CPR-card.pdf");
    expect(cpr?.documentType).toBe("cpr_bls");
    expect(cpr?.confidence).toBeLessThan(0.5);
    expect(await svc.classify("", "scan001.pdf")).toBeNull();
  });
});

describe("document access", () => {
  const access = new MemoryDocumentAccess();
  const base = { userId: "u", organizationId: "org-1" };

  // The rule this whole module exists for, mirrored from the RLS policy.
  it("gives a scheduler the general credential but not the background check", async () => {
    expect(
      await access.mayView({ ...base, userRole: "scheduler", document: doc({ sensitivity: "general_credential" }) }),
    ).toBe(true);
    expect(
      await access.mayView({ ...base, userRole: "scheduler", document: doc() }),
    ).toBe(false);
  });

  it("keeps a background check from an RN, who is clinical rather than HR", async () => {
    expect(await access.mayView({ ...base, userRole: "rn_clinical", document: doc() })).toBe(false);
    expect(await access.mayView({ ...base, userRole: "hr", document: doc() })).toBe(true);
  });

  it("refuses across organizations whatever the role", async () => {
    expect(
      await access.mayView({
        ...base,
        userRole: "ceo_admin",
        document: doc({ organizationId: "org-2", sensitivity: "general_credential" }),
      }),
    ).toBe(false);
  });

  it("records that a document was viewed, and nothing about its contents", async () => {
    await access.recordAccess("doc-1", "u", "document.viewed");
    const entry = access.log.at(-1)!;
    expect(entry).toMatchObject({ documentId: "doc-1", userId: "u", action: "document.viewed" });
    expect(Object.keys(entry)).toEqual(["documentId", "userId", "action", "at"]);
  });
});
