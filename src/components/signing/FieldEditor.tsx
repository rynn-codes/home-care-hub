import { GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_KINDS, FIELD_SPECS, FILL_LABELS, type FieldFill, type FieldKind, type TemplateField } from "@/domain/signing/fields";
import { cn } from "@/lib/utils";

/**
 * The palette of boxes and the properties of the selected one.
 *
 * Shared by the template builder and by a single request, because the
 * office needs the same moves in both places: a template is set up once,
 * but any one request may need one more line for the family to fill in,
 * or a note typed by the office, without touching the template.
 */
export function FieldPalette({ onAdd, hint = "Drag onto the page, or click to add." }: { onAdd: (kind: FieldKind) => void; hint?: string }) {
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
      <h2 className="m-0 text-[13px] font-semibold">Boxes</h2>
      <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">{hint}</p>
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-1.5 p-0">
        {FIELD_KINDS.map((kind) => {
          const spec = FIELD_SPECS[kind];
          return (
            <li key={kind}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/joy-field", kind);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(kind)}
                className="flex w-full items-center gap-1.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-2 py-1.5 text-left text-[12px] hover:border-primary"
                title={spec.hint}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{spec.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FieldProperties({
  field,
  pages,
  onChange,
  onRemove,
}: {
  field: TemplateField | null;
  pages: number;
  onChange: (patch: Partial<Omit<TemplateField, "id">>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
      <h2 className="m-0 text-[13px] font-semibold">{field ? field.label : "Selected box"}</h2>
      {!field ? (
        <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Click a box on the page to change what it is called, who fills it, or whether it is required. Arrow keys nudge it; Delete removes it.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="fld-label" className="text-[12px] font-medium">Label</Label>
            <Input id="fld-label" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
            <p className="m-0 text-[11.5px] text-muted-foreground">The signer sees this as the prompt in the box.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fld-fill" className="text-[12px] font-medium">Who fills it</Label>
            <select id="fld-fill" value={field.fill} onChange={(e) => onChange({ fill: e.target.value as FieldFill })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]">
              {(Object.keys(FILL_LABELS) as FieldFill[]).map((fill) => (
                <option key={fill} value={fill}>{FILL_LABELS[fill]}</option>
              ))}
            </select>
          </div>
          {pages > 1 && (
            <div className="space-y-1">
              <Label htmlFor="fld-page" className="text-[12px] font-medium">Page</Label>
              <select id="fld-page" value={field.page} onChange={(e) => onChange({ page: Number(e.target.value) })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]">
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>Page {p}</option>
                ))}
              </select>
            </div>
          )}
          <label className={cn("flex items-center gap-2 text-[13px]", field.fill === "joy" && "opacity-60")}>
            <input type="checkbox" checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Required before signing
          </label>
          <button type="button" onClick={onRemove} className="text-[12.5px] text-[#B42318] underline-offset-4 hover:underline">
            Remove this box
          </button>
        </div>
      )}
    </section>
  );
}

let seq = 0;
/** A fresh id for a box placed by hand. */
export function nextFieldId(): string {
  return `f-${Date.now().toString(36)}-${(seq++).toString(36)}`;
}
