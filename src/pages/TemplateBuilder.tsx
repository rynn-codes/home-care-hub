import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { PagesWithFields, useDocumentFile } from "@/components/signing/PagesWithFields";
import { FieldPalette, FieldProperties, nextFieldId } from "@/components/signing/FieldEditor";
import { useDemo } from "@/context/DemoDataProvider";
import { displayName } from "@/domain/documents/library";
import type { FieldKind } from "@/domain/signing/fields";
import { addField, newTemplate, removeField, updateField, whyNotSaveTemplate, type SigningTemplate } from "@/domain/signing/templates";
import { keepTemplateFile } from "@/lib/fileStore";
import { pdfPageCount } from "@/lib/pdfRender";
import { cn } from "@/lib/utils";

/**
 * Place boxes on a form once.
 *
 * Drag a box from the palette onto the page, or click it to add it to the
 * first page and drag it into place. Each box says who fills it: Joy from
 * the record, the signer, the office, or the agency when it countersigns.
 * Save keeps the boxes with the form; the PDF stays in Documents.
 */
export default function TemplateBuilder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { documents, signingTemplates, saveSigningTemplate, currentUser } = useDemo();

  const existing = id && id !== "new" ? signingTemplates.find((t) => t.id === id) ?? null : null;
  const docId = existing?.documentId ?? params.get("doc");
  const document = documents.find((d) => d.id === docId) ?? null;
  const file = useDocumentFile(docId);

  const [template, setTemplate] = useState<SigningTemplate | null>(existing);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (existing) setTemplate(existing);
    else if (document) setTemplate((t) => t ?? newTemplate({ id: `tpl-${Date.now().toString(36)}`, name: displayName(document.name), documentId: document.id, documentName: document.name, pages: 1, by: currentUser.name, at: new Date().toISOString() }));
  }, [existing, document, currentUser.name]);

  useEffect(() => {
    if (!file) return;
    pdfPageCount(file)
      .then((pages) => setTemplate((t) => (t && t.pages !== pages ? { ...t, pages } : t)))
      .catch(() => undefined);
  }, [file]);

  const problem = template ? whyNotSaveTemplate(template) : "Choose a form.";
  const current = useMemo(() => template?.fields.find((f) => f.id === selected) ?? null, [template, selected]);

  const add = (kind: FieldKind, page = 1, x = 0.1, y = 0.1) => {
    if (!template) return;
    const n = template.fields.filter((f) => f.page === page).length;
    const id = nextFieldId();
    setTemplate(addField(template, { id, kind, page, x, y: y === 0.1 ? Math.min(0.9, 0.1 + n * 0.035) : y }));
    setSelected(id);
  };

  const save = (thenUse: boolean) => {
    if (!template || problem) return;
    if (file) void keepTemplateFile(template.documentId, file);
    saveSigningTemplate(template);
    toast.success(`${template.name} saved`, { description: `${template.fields.length} boxes on ${template.pages === 1 ? "one page" : `${template.pages} pages`}.` });
    navigate(thenUse ? `/documents/signing/new?template=${encodeURIComponent(template.id)}` : "/documents/signing");
  };

  if (!document && !existing) {
    return (
      <>
        <PageHeader parents={[{ label: "Documents", to: "/documents" }, { label: "Signing", to: "/documents/signing" }]} title="Set up a form" />
        <p className="text-[13.5px] text-muted-foreground">That document is not in the library. Pick a PDF from Signing → New template.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        parents={[{ label: "Documents", to: "/documents" }, { label: "Signing", to: "/documents/signing" }]}
        title={existing ? "Edit boxes" : "Set up for signing"}
        description={template ? `${displayName(template.documentName)} — drag a box from the palette onto the page, then drag it into place.` : ""}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/documents/signing")}>Cancel</Button>
            <Button variant="outline" disabled={!!problem} title={problem ?? undefined} onClick={() => save(false)}>
              <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Save
            </Button>
            <Button disabled={!!problem} title={problem ?? undefined} onClick={() => save(true)}>
              Save and send
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {template && (
            <PagesWithFields
              file={file}
              pages={template.pages}
              fields={template.fields}
              mode="edit"
              selectedId={selected}
              onSelect={setSelected}
              onChange={(fid, patch) => setTemplate((t) => (t ? updateField(t, fid, patch) : t))}
              onRemove={(fid) => {
                setTemplate((t) => (t ? removeField(t, fid) : t));
                setSelected((s) => (s === fid ? null : s));
              }}
              onDropKind={({ kind, page, x, y }) => add(kind as FieldKind, page, x, y)}
            />
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
            <Label htmlFor="tpl-name" className="text-[12px] font-medium">Template name</Label>
            <Input id="tpl-name" value={template?.name ?? ""} onChange={(e) => setTemplate((t) => (t ? { ...t, name: e.target.value } : t))} className="mt-1" />
          </section>

          <FieldPalette onAdd={(kind) => add(kind)} />

          <FieldProperties
            field={current}
            pages={template?.pages ?? 1}
            onChange={(patch) => current && setTemplate((t) => (t ? updateField(t, current.id, patch) : t))}
            onRemove={() => {
              if (!current) return;
              setTemplate((t) => (t ? removeField(t, current.id) : t));
              setSelected(null);
            }}
          />

          {template && template.fields.length > 0 && (
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[13px] font-semibold">On this form</h2>
              <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[12.5px]">
                {template.fields.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => setSelected(f.id)} className={cn("flex w-full justify-between gap-2 rounded-[6px] px-2 py-1 text-left hover:bg-[var(--wash)]", selected === f.id && "bg-[var(--wash-strong)]")}>
                      <span className="truncate">{f.label}</span>
                      <span className="shrink-0 text-muted-foreground">{f.fill === "joy" ? "Joy" : f.fill === "signer" ? "Signer" : f.fill === "agency" ? "Agency" : "Office"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
