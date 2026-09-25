import { useEffect, useRef, useState } from "react";
import { openPdf } from "@/lib/pdfRender";

/**
 * One drawn page of a PDF, sized to its container, with room above it for
 * the boxes that go on top. Reports its rendered size so the field layer can
 * place boxes by fraction.
 */
export function PageCanvas({
  file,
  page,
  onSize,
  children,
  className,
}: {
  file: File;
  page: number;
  onSize?: (size: { width: number; height: number }) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const width = Math.max(240, Math.floor(el.clientWidth) || 600);
    openPdf(file)
      .then((doc) => doc.render(page, width))
      .then((canvas) => {
        if (cancelled) return;
        el.replaceChildren(canvas);
        const s = { width, height: Number.parseFloat(canvas.style.height) };
        setSize(s);
        onSize?.(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "The page could not be drawn.");
      });
    return () => {
      cancelled = true;
    };
    // onSize is a callback prop; re-rendering for a new function identity would redraw the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, page]);

  return (
    <div className={className} style={{ position: "relative", width: "100%" }}>
      <div ref={host} className="w-full overflow-hidden rounded-[8px] border border-[var(--hairline)] bg-white shadow-sm" style={size ? { height: size.height } : { minHeight: 320 }} />
      {error && (
        <p role="alert" className="m-0 mt-2 text-[12.5px] text-[#B42318]">
          This page could not be drawn. {error}
        </p>
      )}
      {size && (
        <div className="absolute left-0 top-0" style={{ width: size.width, height: size.height }}>
          {children}
        </div>
      )}
    </div>
  );
}
