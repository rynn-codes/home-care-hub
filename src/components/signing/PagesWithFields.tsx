import { useEffect, useState } from "react";
import { PageCanvas } from "@/components/signing/PageCanvas";
import { FieldLayer, type LayerMode } from "@/components/signing/FieldLayer";
import type { TemplateField } from "@/domain/signing/fields";
import type { FieldValue } from "@/domain/signing/envelopes";
import { onFilesChanged, recallFile } from "@/lib/fileCache";

/** The file behind a document, re-read when one arrives after first paint. */
export function useDocumentFile(documentId: string | null): File | null {
  const [file, setFile] = useState<File | null>(() => (documentId ? recallFile(documentId) : null));
  useEffect(() => {
    setFile(documentId ? recallFile(documentId) : null);
    return onFilesChanged(() => setFile(documentId ? recallFile(documentId) : null));
  }, [documentId]);
  return file;
}

/**
 * Every page of a document with its boxes on top. Without a file — the
 * prototype keeps uploaded files only for the session, and blank forms set
 * up for signing in this browser — it says so instead of drawing nothing.
 */
export function PagesWithFields({
  file,
  pages,
  fields,
  mode,
  values,
  canFill,
  onValue,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  currentId,
  onDropKind,
}: {
  file: File | null;
  pages: number;
  fields: readonly TemplateField[];
  mode: LayerMode;
  values?: Record<string, FieldValue>;
  canFill?: (field: TemplateField) => boolean;
  onValue?: (id: string, value: FieldValue) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<Pick<TemplateField, "x" | "y" | "w" | "h">>) => void;
  onRemove?: (id: string) => void;
  currentId?: string | null;
  /** In edit mode: a palette item dragged onto a page lands here, as fractions. */
  onDropKind?: (input: { kind: string; page: number; x: number; y: number }) => void;
}) {
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({});

  if (!file) {
    return (
      <div className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-6 text-[13px] leading-[1.55] text-muted-foreground">
        <p className="m-0 font-medium text-[var(--ink-body)]">No copy of this form in this browser.</p>
        <p className="m-0 mt-1">
          The prototype keeps a form's pages in the browser it was set up in, and file storage is not connected yet. The boxes and what was put in them are still on the record below.
        </p>
        <ul className="m-0 mt-3 list-none space-y-1 p-0">
          {fields.map((f) => (
            <li key={f.id} className="flex justify-between gap-3">
              <span>{f.label}</span>
              <span className="text-[var(--ink)]">{typeof values?.[f.id] === "boolean" ? (values[f.id] ? "Ticked" : "—") : (values?.[f.id] as string) || "—"}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: pages }, (_, i) => i + 1).map((page) => (
        <div
          key={page}
          onDragOver={(e) => {
            if (mode === "edit" && onDropKind) e.preventDefault();
          }}
          onDrop={(e) => {
            if (mode !== "edit" || !onDropKind) return;
            e.preventDefault();
            const kind = e.dataTransfer.getData("text/joy-field");
            const size = sizes[page];
            if (!kind || !size) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onDropKind({ kind, page, x: (e.clientX - rect.left) / size.width, y: (e.clientY - rect.top) / size.height });
          }}
        >
          {pages > 1 && <p className="m-0 mb-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Page {page} of {pages}</p>}
          <PageCanvas file={file} page={page} onSize={(s) => setSizes((prev) => (prev[page]?.width === s.width && prev[page]?.height === s.height ? prev : { ...prev, [page]: s }))}>
            {sizes[page] && (
              <FieldLayer
                fields={fields}
                page={page}
                size={sizes[page]}
                mode={mode}
                values={values}
                canFill={canFill}
                onValue={onValue}
                selectedId={selectedId}
                onSelect={onSelect}
                onChange={onChange}
                onRemove={onRemove}
                currentId={currentId}
              />
            )}
          </PageCanvas>
        </div>
      ))}
    </div>
  );
}
