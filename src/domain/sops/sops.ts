/**
 * Standard operating procedures, with their version history.
 *
 * A procedure is never edited in place: saving writes a new version with
 * who and when, and the old one stays readable. Categories are only where
 * procedures are filed — renaming or emptying one moves the procedures and
 * never deletes anything.
 */
export interface SopVersion {
  version: number;
  updatedAt: string;
  updatedBy: string;
  /** HTML from the editor. */
  content: string;
}

export interface Sop {
  id: string;
  title: string;
  category: string;
  ownerName: string;
  updatedAt: string;
  versions: SopVersion[];
}

export function latestVersion(sop: Sop): SopVersion {
  return sop.versions[sop.versions.length - 1];
}

/** Categories in first-seen order. */
export function categoriesOf(sops: readonly Sop[]): string[] {
  const out: string[] = [];
  for (const s of sops) if (!out.includes(s.category)) out.push(s.category);
  return out;
}

export function sopsIn(sops: readonly Sop[], category: string): Sop[] {
  return sops.filter((s) => s.category === category);
}

export function cleanCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function whyNotCategoryName(input: { from: string; to: string; categories: readonly string[] }): string | null {
  const to = cleanCategory(input.to);
  if (!to) return "A category needs a name.";
  if (to === input.from) return null;
  if (input.categories.some((c) => c.toLowerCase() === to.toLowerCase())) {
    return `${to} already exists. Move the procedures into it instead.`;
  }
  return null;
}

export function renameCategory(sops: readonly Sop[], from: string, to: string): Sop[] {
  const name = cleanCategory(to);
  return sops.map((s) => (s.category === from ? { ...s, category: name } : s));
}

export function moveCategory(sops: readonly Sop[], from: string, to: string): Sop[] {
  return sops.map((s) => (s.category === from ? { ...s, category: to } : s));
}

export function withNewVersion(sop: Sop, content: string, by: string, at: string): Sop {
  return {
    ...sop,
    updatedAt: at,
    versions: [...sop.versions, { version: latestVersion(sop).version + 1, updatedAt: at, updatedBy: by, content }],
  };
}

export function whyNotSopTitle(title: string): string | null {
  return title.trim() ? null : "A procedure needs a title.";
}

/** What a new procedure starts with: pasted text, a note about the file, or the skeleton. */
export function startingContent(input: { fileName: string | null; text: string | null }): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (input.text) {
    return input.text
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p.trim())}</p>`)
      .join("");
  }
  if (input.fileName) {
    return `<p><em>From ${esc(input.fileName)}. The prototype keeps the file's name; paste or type the procedure here.</em></p><h2>Purpose</h2><p></p><h2>Procedure</h2><ol><li></li></ol>`;
  }
  return "<h2>Purpose</h2><p></p><h2>Scope</h2><p></p><h2>Procedure</h2><ol><li></li></ol>";
}
