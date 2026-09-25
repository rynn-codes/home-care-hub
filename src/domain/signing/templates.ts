import { clampField, isSignerField, newField, type FieldKind, type TemplateField } from "./fields";

/**
 * A template: a PDF from the library with fields placed on it once.
 *
 * The office drags boxes onto the drawn page — where the client's name goes,
 * where they sign, where the agency countersigns — and saves. Every request
 * made from the template starts with those boxes and Joy's prefill. The PDF
 * itself stays in Documents; the template only remembers where things go.
 */
export interface SigningTemplate {
  id: string;
  name: string;
  /** The library document the pages come from. */
  documentId: string;
  documentName: string;
  pages: number;
  fields: TemplateField[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export function newTemplate(input: { id: string; name: string; documentId: string; documentName: string; pages: number; by: string; at: string }): SigningTemplate {
  return {
    id: input.id,
    name: input.name.trim(),
    documentId: input.documentId,
    documentName: input.documentName,
    pages: Math.max(1, input.pages),
    fields: [],
    createdAt: input.at,
    createdBy: input.by,
    updatedAt: input.at,
  };
}

export function addField(template: SigningTemplate, input: { id: string; kind: FieldKind; page: number; x: number; y: number }): SigningTemplate {
  const page = Math.min(template.pages, Math.max(1, input.page));
  return { ...template, fields: [...template.fields, newField({ ...input, page })] };
}

export function updateField(template: SigningTemplate, id: string, patch: Partial<Omit<TemplateField, "id">>): SigningTemplate {
  return { ...template, fields: template.fields.map((f) => (f.id === id ? clampField({ ...f, ...patch }) : f)) };
}

export function removeField(template: SigningTemplate, id: string): SigningTemplate {
  return { ...template, fields: template.fields.filter((f) => f.id !== id) };
}

/** Why the template cannot be saved yet, in the office's words. */
export function whyNotSaveTemplate(template: Pick<SigningTemplate, "name" | "fields">): string | null {
  if (template.name.trim().length < 2) return "Give the template a name.";
  if (!template.fields.some((f) => f.kind === "signature" && isSignerField(f))) return "Place at least one signature box for the signer.";
  return null;
}

/** Whether a request from this template will wait on the agency's signature after the client signs. */
export function templateNeedsCountersign(template: Pick<SigningTemplate, "fields">): boolean {
  return template.fields.some((f) => f.kind === "agency_signature");
}

/** Fields on one page, in reading order. */
export function fieldsOnPage(fields: readonly TemplateField[], page: number): TemplateField[] {
  return fields.filter((f) => f.page === page).sort((a, b) => a.y - b.y || a.x - b.x);
}
