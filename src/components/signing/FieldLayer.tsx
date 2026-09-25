import { useRef } from "react";
import { X } from "lucide-react";
import { clampField, isMarkField, type FieldFill, type TemplateField } from "@/domain/signing/fields";
import type { FieldValue } from "@/domain/signing/envelopes";
import { cn } from "@/lib/utils";

/**
 * The boxes on top of a drawn page.
 *
 * Three ways to use it. "edit" is the template builder: boxes drag, resize
 * and select. "fill" is a request being completed: the boxes somebody may
 * type into become inputs, the rest show their values. "view" shows values
 * only. Positions are fractions of the page, so the same boxes land in the
 * same places whatever the zoom.
 */
export type LayerMode = "edit" | "fill" | "view";

const TONE: Record<FieldFill, string> = {
  joy: "border-[#1407A2]/50 bg-[#1407A2]/[0.07]",
  signer: "border-[#B54708]/60 bg-[#FFFAEB]/80",
  office: "border-[#475467]/50 bg-[#F2F4F7]/70",
  agency: "border-[#6941C6]/50 bg-[#F4F3FF]/80",
};

export function FieldLayer({
  fields,
  page,
  size,
  mode,
  values = {},
  canFill,
  onValue,
  selectedId = null,
  onSelect,
  onChange,
  onRemove,
  currentId = null,
}: {
  fields: readonly TemplateField[];
  page: number;
  size: { width: number; height: number };
  mode: LayerMode;
  values?: Record<string, FieldValue>;
  /** In fill mode: which boxes this person may type into. */
  canFill?: (field: TemplateField) => boolean;
  onValue?: (id: string, value: FieldValue) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<Pick<TemplateField, "x" | "y" | "w" | "h">>) => void;
  onRemove?: (id: string) => void;
  /** In fill mode: the box the guided walk is on. */
  currentId?: string | null;
}) {
  const drag = useRef<{ id: string; kind: "move" | "resize"; startX: number; startY: number; field: TemplateField } | null>(null);

  const px = (f: TemplateField) => ({ left: f.x * size.width, top: f.y * size.height, width: f.w * size.width, height: f.h * size.height });

  const onPointerDown = (e: React.PointerEvent, f: TemplateField, kind: "move" | "resize") => {
    if (mode !== "edit") return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: f.id, kind, startX: e.clientX, startY: e.clientY, field: f };
    onSelect?.(f.id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / size.width;
    const dy = (e.clientY - d.startY) / size.height;
    const next = d.kind === "move" ? clampField({ ...d.field, x: d.field.x + dx, y: d.field.y + dy }) : clampField({ ...d.field, w: d.field.w + dx, h: d.field.h + dy });
    onChange?.(d.id, { x: next.x, y: next.y, w: next.w, h: next.h });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current && (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent, f: TemplateField) => {
    if (mode !== "edit") return;
    const step = e.shiftKey ? 0.02 : 0.004;
    const moves: Record<string, Partial<TemplateField>> = {
      ArrowLeft: { x: f.x - step },
      ArrowRight: { x: f.x + step },
      ArrowUp: { y: f.y - step },
      ArrowDown: { y: f.y + step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      const next = clampField({ ...f, ...moves[e.key] });
      onChange?.(f.id, { x: next.x, y: next.y, w: next.w, h: next.h });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove?.(f.id);
    }
  };

  return (
    <div className="absolute inset-0" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={() => mode === "edit" && onSelect?.(null)}>
      {fields
        .filter((f) => f.page === page)
        .map((f) => {
          const box = px(f);
          const fontSize = Math.max(9, Math.min(15, box.height * 0.62));
          const value = values[f.id];
          const fillable = mode === "fill" && !!canFill?.(f);
          const selected = mode === "edit" && selectedId === f.id;
          const current = mode === "fill" && currentId === f.id;
          const mark = isMarkField(f);
          const signedName = typeof value === "string" && value.trim() ? value : null;
          return (
            <div
              key={f.id}
              id={`field-${f.id}`}
              data-field-kind={f.kind}
              role={mode === "edit" ? "button" : undefined}
              tabIndex={mode === "edit" ? 0 : -1}
              aria-label={mode === "edit" ? `${f.label} box` : undefined}
              onPointerDown={(e) => onPointerDown(e, f, "move")}
              onKeyDown={(e) => onKeyDown(e, f)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute rounded-[3px] border transition-shadow",
                TONE[f.fill],
                mode === "edit" && "cursor-move select-none",
                selected && "ring-2 ring-[#1407A2] ring-offset-1",
                current && "ring-2 ring-[#B54708] ring-offset-1",
                mode === "view" && "border-transparent bg-transparent",
              )}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height, fontSize }}
            >
              {mode === "edit" && (
                <>
                  <span className="pointer-events-none absolute -top-[15px] left-0 whitespace-nowrap rounded-sm bg-[var(--ink)] px-1 text-[9px] font-medium leading-[14px] text-white" style={{ fontSize: 9 }}>
                    {f.label}
                  </span>
                  {selected && (
                    <>
                      <button type="button" aria-label={`Remove ${f.label}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemove?.(f.id); }} className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#B42318] text-white">
                        <X className="h-2.5 w-2.5" aria-hidden="true" />
                      </button>
                      <span onPointerDown={(e) => onPointerDown(e, f, "resize")} className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-[#1407A2]" aria-hidden="true" />
                    </>
                  )}
                </>
              )}

              {mode !== "edit" && f.kind === "checkbox" && (
                fillable ? (
                  <input type="checkbox" aria-label={f.label} checked={value === true} onChange={(e) => onValue?.(f.id, e.target.checked)} className="absolute inset-0 h-full w-full cursor-pointer accent-[#1407A2]" />
                ) : (
                  value === true && <span className="absolute inset-0 flex items-center justify-center font-bold leading-none text-[var(--ink)]" style={{ fontSize: Math.max(10, box.height * 0.9) }}>✓</span>
                )
              )}

              {mode !== "edit" && mark && (
                signedName ? (
                  <span className="absolute inset-0 flex items-center px-1 italic text-[var(--ink)]" style={{ fontFamily: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive", fontSize: Math.max(12, box.height * 0.55) }}>
                    {signedName}
                  </span>
                ) : fillable ? (
                  <span className="absolute inset-0 flex items-center px-1 text-[#B54708]" style={{ fontSize: Math.max(10, Math.min(13, box.height * 0.4)) }}>
                    Sign here
                  </span>
                ) : null
              )}

              {mode !== "edit" && !mark && f.kind !== "checkbox" && (
                fillable ? (
                  <input
                    type="text"
                    aria-label={f.label}
                    value={typeof value === "string" ? value : ""}
                    placeholder={f.label}
                    onChange={(e) => onValue?.(f.id, e.target.value)}
                    className="absolute inset-0 h-full w-full bg-transparent px-1 text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:bg-white/70"
                    style={{ fontSize }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap px-1 text-[var(--ink)]">{typeof value === "string" ? value : ""}</span>
                )
              )}
            </div>
          );
        })}
    </div>
  );
}
