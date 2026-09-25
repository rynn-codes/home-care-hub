/**
 * The boxes that go on a page for signing.
 *
 * A field is a rectangle on one page of a PDF, measured as fractions of the
 * page so it lands in the same place at any zoom, plus who fills it: Joy
 * (from the client's record), the signer, or the office. Positions are set
 * once on a template and copied onto every request made from it.
 */
export type FieldKind =
  | "client_name"
  | "dob"
  | "address"
  | "phone"
  | "mr_number"
  | "soc_date"
  | "date"
  | "text"
  | "checkbox"
  | "signature"
  | "initials"
  | "date_signed"
  | "agency_signature"
  | "agency_date";

/** Who is expected to put something in the box. */
export type FieldFill = "joy" | "signer" | "office" | "agency";

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  /** What the palette says under the name. */
  hint: string;
  defaultFill: FieldFill;
  /** Default size as fractions of page width and height (US Letter). */
  size: { w: number; h: number };
  /** Filled from the client's record when a request is made. */
  prefills: boolean;
}

export const FIELD_SPECS: Record<FieldKind, FieldSpec> = {
  client_name: { kind: "client_name", label: "Client name", hint: "From the record", defaultFill: "joy", size: { w: 0.32, h: 0.026 }, prefills: true },
  dob: { kind: "dob", label: "Date of birth", hint: "From the record", defaultFill: "joy", size: { w: 0.16, h: 0.026 }, prefills: true },
  address: { kind: "address", label: "Address", hint: "From the record", defaultFill: "joy", size: { w: 0.42, h: 0.026 }, prefills: true },
  phone: { kind: "phone", label: "Phone", hint: "From the record", defaultFill: "joy", size: { w: 0.18, h: 0.026 }, prefills: true },
  mr_number: { kind: "mr_number", label: "MR number", hint: "From the record", defaultFill: "joy", size: { w: 0.14, h: 0.026 }, prefills: true },
  soc_date: { kind: "soc_date", label: "Start of care", hint: "From the record", defaultFill: "joy", size: { w: 0.16, h: 0.026 }, prefills: true },
  date: { kind: "date", label: "Today's date", hint: "The day it is sent", defaultFill: "joy", size: { w: 0.16, h: 0.026 }, prefills: true },
  text: { kind: "text", label: "Text", hint: "Typed in", defaultFill: "office", size: { w: 0.24, h: 0.026 }, prefills: false },
  checkbox: { kind: "checkbox", label: "Checkbox", hint: "Tick or leave", defaultFill: "office", size: { w: 0.022, h: 0.017 }, prefills: false },
  signature: { kind: "signature", label: "Signature", hint: "The signer signs", defaultFill: "signer", size: { w: 0.3, h: 0.05 }, prefills: false },
  initials: { kind: "initials", label: "Initials", hint: "The signer initials", defaultFill: "signer", size: { w: 0.07, h: 0.03 }, prefills: false },
  date_signed: { kind: "date_signed", label: "Date signed", hint: "Filled when they sign", defaultFill: "signer", size: { w: 0.16, h: 0.026 }, prefills: false },
  agency_signature: { kind: "agency_signature", label: "Agency signature", hint: "You sign after they do", defaultFill: "agency", size: { w: 0.3, h: 0.05 }, prefills: false },
  agency_date: { kind: "agency_date", label: "Agency date", hint: "Filled when you sign", defaultFill: "agency", size: { w: 0.16, h: 0.026 }, prefills: false },
};

/** The palette order. */
export const FIELD_KINDS: readonly FieldKind[] = [
  "signature", "date_signed", "initials", "client_name", "dob", "address", "phone", "mr_number", "soc_date", "date", "text", "checkbox", "agency_signature", "agency_date",
];

export const FILL_LABELS: Record<FieldFill, string> = {
  joy: "Joy fills it in",
  signer: "The signer fills it in",
  office: "The office fills it in",
  agency: "Filled when the agency signs",
};

export interface TemplateField {
  id: string;
  kind: FieldKind;
  label: string;
  /** 1-based page number. */
  page: number;
  /** Top-left corner and size, as fractions of the page's width and height. */
  x: number;
  y: number;
  w: number;
  h: number;
  fill: FieldFill;
  required: boolean;
}

const MIN_W = 0.02;
const MIN_H = 0.012;

/** Keep a box on its page. */
export function clampField<T extends Pick<TemplateField, "x" | "y" | "w" | "h">>(field: T): T {
  const w = Math.min(1, Math.max(MIN_W, field.w));
  const h = Math.min(1, Math.max(MIN_H, field.h));
  const x = Math.min(1 - w, Math.max(0, field.x));
  const y = Math.min(1 - h, Math.max(0, field.y));
  return { ...field, x, y, w, h };
}

export function newField(input: { id: string; kind: FieldKind; page: number; x: number; y: number }): TemplateField {
  const spec = FIELD_SPECS[input.kind];
  return clampField({
    id: input.id,
    kind: input.kind,
    label: spec.label,
    page: input.page,
    x: input.x,
    y: input.y,
    w: spec.size.w,
    h: spec.size.h,
    fill: spec.defaultFill,
    required: input.kind === "signature" || input.kind === "agency_signature",
  });
}

/** A field a signer is asked to complete. */
export function isSignerField(field: Pick<TemplateField, "fill">): boolean {
  return field.fill === "signer";
}

/** A field the agency completes when it countersigns. */
export function isAgencyField(field: Pick<TemplateField, "fill">): boolean {
  return field.fill === "agency";
}

/** A box the signer's drawn mark goes in. */
export function isMarkField(field: Pick<TemplateField, "kind">): boolean {
  return field.kind === "signature" || field.kind === "agency_signature";
}
