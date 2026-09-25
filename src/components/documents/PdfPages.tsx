import { useEffect, useRef, useState } from "react";
import { renderPdf } from "@/lib/pdfRender";

/**
 * A PDF drawn page by page, for a file held in this session.
 *
 * Pages append as they are ready; a long file shows its first page at once.
 * If the file cannot be drawn the screen says so rather than sitting blank.
 */
export function PdfPages({ file }: { file: File }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ kind: "loading" } | { kind: "done"; pages: number } | { kind: "failed"; why: string }>({ kind: "loading" });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    setState({ kind: "loading" });
    const abort = new AbortController();
    // Pages fit the dialog they are drawn in, whatever its width.
    const width = Math.max(240, Math.floor(el.clientWidth) || 600);
    renderPdf(
      file,
      width,
      ({ canvas, index, total }) => {
        const wrap = document.createElement("figure");
        wrap.className = "m-0 overflow-hidden rounded-[8px] border border-[var(--hairline)] bg-white shadow-sm";
        wrap.setAttribute("aria-label", `Page ${index} of ${total}`);
        wrap.appendChild(canvas);
        el.appendChild(wrap);
      },
      abort.signal,
    )
      .then((pages) => {
        if (!abort.signal.aborted) setState({ kind: "done", pages });
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) setState({ kind: "failed", why: e instanceof Error ? e.message : "The file could not be read." });
      });
    return () => abort.abort();
  }, [file]);

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-3">
      {state.kind === "loading" && <p className="m-0 mb-2 text-[12px] text-muted-foreground">Drawing pages…</p>}
      {state.kind === "failed" && (
        <p role="alert" className="m-0 mb-2 text-[12.5px] text-[#B42318]">
          This PDF could not be drawn. {state.why}
        </p>
      )}
      {state.kind === "done" && (
        <p className="m-0 mb-2 text-[12px] text-muted-foreground">
          {state.pages === 1 ? "1 page" : `${state.pages} pages`}
        </p>
      )}
      <div ref={host} className="flex w-full flex-col items-center gap-3" />
    </div>
  );
}
