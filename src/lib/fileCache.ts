import testAgreementUrl from "@/assets/test-agreement.pdf?url";
import { TEST_SIGNATURE_DOCUMENT } from "@/lib/documentsSeed";
import { allTemplateFiles } from "@/lib/fileStore";

/**
 * The files themselves, for this session only.
 *
 * The demo has no object storage, and a file must never go into
 * localStorage — so a file added in this session is held in memory against
 * its document id, and downloads while the tab is open. Reloading loses the
 * bytes and keeps the record, and Documents says so when asked for a copy.
 *
 * Two exceptions are read back in at start: the blank forms the office set
 * up for signing (lib/fileStore, IndexedDB) and the test agreement that
 * ships with the app.
 */
const files = new Map<string, File>();
const listeners = new Set<() => void>();

export function rememberFile(documentId: string, file: File) {
  files.set(documentId, file);
  for (const l of listeners) l();
}

export function recallFile(documentId: string): File | null {
  return files.get(documentId) ?? null;
}

export function forgetFile(documentId: string) {
  files.delete(documentId);
  for (const l of listeners) l();
}

export function copyFileHandle(from: string, to: string) {
  const f = files.get(from);
  if (f) files.set(to, f);
}

/** Called when a file arrives after the screen first drew. */
export function onFilesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let hydrated: Promise<void> | null = null;

/** Read the kept forms and the bundled test agreement into the session cache. Once. */
export function hydrateFiles(): Promise<void> {
  if (hydrated) return hydrated;
  hydrated = (async () => {
    try {
      const res = await fetch(testAgreementUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (!files.has(TEST_SIGNATURE_DOCUMENT.id)) rememberFile(TEST_SIGNATURE_DOCUMENT.id, new File([blob], TEST_SIGNATURE_DOCUMENT.name, { type: "application/pdf" }));
      }
    } catch {
      // The test agreement is a convenience; the app works without it.
    }
    for (const { documentId, file } of await allTemplateFiles()) if (!files.has(documentId)) rememberFile(documentId, file);
  })();
  return hydrated;
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
