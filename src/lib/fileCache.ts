/**
 * The files themselves, for this session only.
 *
 * The demo has no object storage, and a file must never go into
 * localStorage — so a file added in this session is held in memory against
 * its document id, and downloads while the tab is open. Reloading loses the
 * bytes and keeps the record, and Documents says so when asked for a copy.
 */
const files = new Map<string, File>();

export function rememberFile(documentId: string, file: File) {
  files.set(documentId, file);
}

export function recallFile(documentId: string): File | null {
  return files.get(documentId) ?? null;
}

export function copyFileHandle(from: string, to: string) {
  const f = files.get(from);
  if (f) files.set(to, f);
}

export function downloadFile(file: File, name: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
