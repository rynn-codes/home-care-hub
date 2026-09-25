import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSource from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw";

/**
 * Draw a PDF's pages onto canvases, in the page.
 *
 * The browser's own PDF viewer cannot be used: the demo runs inside a
 * sandboxed frame that refuses plugins, so an <iframe> or <object> shows a
 * broken-document icon and nothing else. pdf.js draws each page as pixels
 * instead, which works anywhere a canvas does.
 *
 * The worker ships inside the bundle as source and starts from a blob URL,
 * so the single-file demo needs no second file and no network. Nothing is
 * uploaded anywhere: the bytes stay in this tab.
 *
 * The legacy build is used on purpose: the current one relies on Map
 * methods that shipped in browsers only in 2026, and the legacy build
 * carries the polyfill. Standard fonts are not bundled, so pdf.js logs one
 * failed fetch for them and draws with a system font instead — harmless.
 */
let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  pdfjs.GlobalWorkerOptions.workerSrc = url;
  workerReady = true;
}

export interface RenderedPage {
  index: number;
  total: number;
  canvas: HTMLCanvasElement;
}

/**
 * Render every page at the given CSS width. Calls `onPage` as each page is
 * ready so the first page shows before the last is drawn. Returns the page
 * count. The `signal` stops rendering when the dialog closes.
 */
export async function renderPdf(file: File, width: number, onPage: (page: RenderedPage) => void, signal?: AbortSignal): Promise<number> {
  ensureWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const total = doc.numPages;
    const ratio = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    for (let i = 1; i <= total; i++) {
      if (signal?.aborted) break;
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const viewport = page.getViewport({ scale: scale * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot draw pages.");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      if (signal?.aborted) break;
      onPage({ index: i, total, canvas });
    }
    return total;
  } finally {
    void task.destroy();
  }
}
