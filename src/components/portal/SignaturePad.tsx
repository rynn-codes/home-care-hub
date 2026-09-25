import { useEffect, useRef, useState } from "react";

/**
 * A box to draw a signature in, with a finger or a mouse.
 *
 * Reports only whether something was drawn. The strokes live on the canvas
 * for the signer to see and are never serialised: the drawn mark is personal
 * data, and the browser's storage is not the place for it. A signing
 * provider would keep it with the stamped document.
 */
export function SignaturePad({ onChange, disabled = false }: { onChange: (drawn: boolean) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const scale = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    el.width = Math.round(rect.width * scale);
    el.height = Math.round(rect.height * scale);
    const ctx = el.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1B1B1F";
    }
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!drawn) {
      setDrawn(true);
      onChange(true);
    }
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const clear = () => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (el && ctx) ctx.clearRect(0, 0, el.width, el.height);
    setDrawn(false);
    onChange(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        role="img"
        aria-label="Signature box. Draw your signature here."
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="h-36 w-full touch-none rounded-2xl border border-border bg-surface"
        style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{drawn ? "Signed above." : "Sign in the box with your finger or mouse."}</span>
        <button type="button" onClick={clear} disabled={!drawn} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">
          Clear
        </button>
      </div>
    </div>
  );
}
