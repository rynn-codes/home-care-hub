/**
 * Blank forms kept in this browser between visits.
 *
 * The session cache (lib/fileCache) forgets every file on refresh, which is
 * right for anything a family sent in. A blank agency form is different: it
 * holds no client's information, and a template is useless without its
 * pages. So the PDF behind a signing template is kept in IndexedDB — a real
 * store, not localStorage — keyed by the library document's id, and read
 * back into the session cache when the app starts.
 *
 * Only documents the office set up for signing go here. Nothing filled in
 * ever does: values live in the demo state, and the drawn mark nowhere.
 */
const DB = "joy.files.v1";
const STORE = "templates";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function keepTemplateFile(documentId: string, file: File): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ name: file.name, type: file.type, blob: file }, documentId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function forgetTemplateFile(documentId: string): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function allTemplateFiles(): Promise<Array<{ documentId: string; file: File }>> {
  const db = await open();
  if (!db) return [];
  return new Promise((resolve) => {
    const out: Array<{ documentId: string; file: File }> = [];
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      const v = cursor.value as { name: string; type: string; blob: Blob };
      out.push({ documentId: String(cursor.key), file: new File([v.blob], v.name, { type: v.type }) });
      cursor.continue();
    };
    req.onerror = () => resolve(out);
  });
}
