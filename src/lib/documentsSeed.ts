import { DEFAULT_FOLDERS, kindOf, type LibraryDocument, type DocumentPermission } from "@/domain/documents/library";

/**
 * The document library the demo starts with. Names, folders and tags only —
 * there are no files behind them, and the screen says so.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

const ROWS: Array<[string, string, string[], DocumentPermission]> = [
  ["Employee Handbook 2025.pdf", "Policies", ["handbook", "onboarding"], "everyone"],
  ["HIPAA Compliance Guide.pdf", "Compliance", ["hipaa", "survey"], "everyone"],
  ["Onboarding Checklist.docx", "Onboarding", ["onboarding"], "everyone"],
  ["W-2 Template.pdf", "HR", ["payroll", "template"], "admins"],
  ["Care Plan Template.docx", "Templates", ["template", "clinical"], "everyone"],
  ["Q1 Financials.xlsx", "Finance", ["finance"], "admins"],
  ["Brand Guidelines.pdf", "Marketing", ["brand"], "everyone"],
  ["Office Photo.jpg", "Marketing", ["brand"], "everyone"],
  ["Insurance Certificate.pdf", "Compliance", ["survey", "insurance"], "admins"],
  ["Caregiver Performance Reviews.xlsx", "HR", ["reviews"], "admins"],
  ["Emergency Contact List.docx", "HR", ["emergency"], "admins"],
  ["State License.pdf", "Compliance", ["survey", "licence"], "everyone"],
];

export const seedDocumentFolders: string[] = [...DEFAULT_FOLDERS];

/**
 * A stand-in file for trying the signature flow end to end. Named so nobody
 * mistakes it for a real agreement; there is no file behind it, like the rest.
 */
export const TEST_SIGNATURE_DOCUMENT: LibraryDocument = {
  id: "doc-test-signature",
  name: "TEST - Mock Service Agreement.pdf",
  folder: "Templates",
  kind: "pdf",
  size: 42_000,
  // Five minutes after the newest seeded file, so it sorts to the top.
  uploadedAt: (() => {
    const d = new Date();
    d.setHours(10, 5, 0, 0);
    return d.toISOString();
  })(),
  uploadedBy: "Karynn Verrett",
  tags: ["template"],
  permission: "everyone",
};

export const seedDocuments: LibraryDocument[] = [TEST_SIGNATURE_DOCUMENT, ...ROWS.map(rowToDocument)];

function rowToDocument([name, folder, tags, permission]: (typeof ROWS)[number], i: number): LibraryDocument {
  return {
  id: `doc-${i + 1}`,
  name,
  folder,
  kind: kindOf(name),
  size: 50_000 + i * 18_000,
  uploadedAt: daysAgo((i * 4) % 90),
  uploadedBy: i % 3 === 0 ? "Karynn Verrett" : "John Segura",
    tags,
    permission,
  };
}
