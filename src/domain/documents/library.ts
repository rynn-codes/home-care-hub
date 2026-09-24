/**
 * The agency's document library — the files under Documents, their folders
 * and their tags. Not the credential documents on an employee's file; those
 * live in domain/documents/types and the compliance engine.
 */

export type DocumentKind = "pdf" | "docx" | "xlsx" | "image" | "other";
export type DocumentPermission = "everyone" | "admins";

export interface LibraryDocument {
  id: string;
  name: string;
  folder: string;
  kind: DocumentKind;
  /** Bytes. The demo keeps the number, never the file. */
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  permission: DocumentPermission;
}

export const DEFAULT_FOLDERS = ["Policies", "Compliance", "HR", "Onboarding", "Templates", "Finance", "Marketing"];

/** "Employee Handbook 2025.pdf" → "Employee Handbook 2025". */
export function displayName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 && fileName.length - dot <= 6 ? fileName.slice(0, dot) : fileName;
}

export function kindOf(fileName: string): DocumentKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "docx";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xlsx";
  if (["png", "jpg", "jpeg", "gif", "heic", "webp"].includes(ext)) return "image";
  return "other";
}

/** Tags are lower-case and single-spaced so "HIPAA" and "hipaa" are one tag. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return t.length ? t : null;
}

export function tagDocument(doc: LibraryDocument, raw: string): LibraryDocument {
  const tag = normalizeTag(raw);
  return !tag || doc.tags.includes(tag) ? doc : { ...doc, tags: [...doc.tags, tag] };
}

export function untagDocument(doc: LibraryDocument, tag: string): LibraryDocument {
  return { ...doc, tags: doc.tags.filter((t) => t !== tag) };
}

/** Every tag in use, most used first. */
export function tagsInUse(docs: readonly LibraryDocument[]): string[] {
  const counts = new Map<string, number>();
  for (const d of docs) for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export function filterDocuments(
  docs: readonly LibraryDocument[],
  by: { folder?: string | null; tag?: string | null; query?: string },
): LibraryDocument[] {
  const q = (by.query ?? "").trim().toLowerCase();
  return docs.filter(
    (d) =>
      (!by.folder || by.folder === "all" || d.folder === by.folder) &&
      (!by.tag || d.tags.includes(by.tag)) &&
      (!q || d.name.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q))),
  );
}

export function cleanFolderName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** The folder list, plus any folder a document names that the list has lost. */
export function reconcileFolders(folders: readonly string[], docs: readonly LibraryDocument[]): string[] {
  const out = folders.map(cleanFolderName).filter(Boolean);
  for (const d of docs) {
    if (d.folder && !out.some((f) => f.toLowerCase() === d.folder.toLowerCase())) out.push(d.folder);
  }
  return out;
}

export function countInFolder(docs: readonly LibraryDocument[], folder: string): number {
  return docs.filter((d) => d.folder === folder).length;
}

export function whyNotFolderName(input: { name: string; folders: readonly string[]; from?: string | null }): string | null {
  const name = cleanFolderName(input.name);
  if (!name) return "A folder needs a name.";
  if (name.length > 40) return "That name is too long for the rail.";
  if (input.from && name === input.from) return null;
  if (input.folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
    return `${name} already exists. Move the files into it instead.`;
  }
  return null;
}

export function whyNotDeleteFolder(input: { folders: readonly string[] }): string | null {
  return input.folders.length < 2 ? "Every file has to live somewhere, so the last folder stays." : null;
}

export function renameFolderOnDocuments(docs: readonly LibraryDocument[], from: string, to: string): LibraryDocument[] {
  const name = cleanFolderName(to);
  return docs.map((d) => (d.folder === from ? { ...d, folder: name } : d));
}

export function moveFolderDocuments(docs: readonly LibraryDocument[], from: string, to: string): LibraryDocument[] {
  return docs.map((d) => (d.folder === from ? { ...d, folder: to } : d));
}

export function whyNotUpload(file: { name: string; size: number }): string | null {
  if (!file.name.trim()) return "The file has no name.";
  if (file.size <= 0) return "The file is empty.";
  return null;
}
