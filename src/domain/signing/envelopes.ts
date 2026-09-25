import { isAgencyField, isMarkField, isSignerField, type TemplateField } from "./fields";
import type { SigningTemplate } from "./templates";

/**
 * A signing request: one document, one client, one signer, and everything
 * that happened to it.
 *
 * The shape follows what the office already knows from DocuSign, because it
 * is the shape a surveyor asks about: what was sent, to whom, when they saw
 * it, when they signed, who countersigned, and — when something went wrong —
 * why it was voided and what replaced it. A signed request is never edited.
 * It is voided with a reason, or corrected, which voids it and opens a fresh
 * copy that remembers where it came from.
 *
 * WHAT THIS IS NOT. No signing provider is connected: nothing is stamped
 * into a stored PDF, no certificate is produced, and nobody is texted or
 * emailed — Spruce is not wired, so Joy shows the message it would send and
 * the request appears in the family portal. The drawn mark is shown to the
 * signer and is not kept in the browser. Joy records the typed name, the
 * time, and which boxes were completed.
 */
export type EnvelopeStatus = "draft" | "sent" | "viewed" | "signed" | "completed" | "declined" | "voided";

export const STATUS_LABELS: Record<EnvelopeStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Opened",
  signed: "Signed",
  completed: "Completed",
  declined: "Declined",
  voided: "Voided",
};

export type SignerRole = "client" | "responsible_party";

/**
 * Text first, email as well. Text is what most families answer; email is
 * for the clients who do not keep a phone close. Either, both, or neither
 * (the portal alone) — the office decides per request.
 */
export interface Delivery {
  textTo: string | null;
  emailTo: string | null;
}

export type EnvelopeEventKind =
  | "created"
  | "edited"
  | "sent"
  | "resent"
  | "viewed"
  | "signed"
  | "declined"
  | "countersigned"
  | "completed"
  | "voided"
  | "corrected"
  | "copy_sent";

export interface EnvelopeEvent {
  at: string;
  by: string;
  kind: EnvelopeEventKind;
  note?: string;
}

export type FieldValue = string | boolean;

export interface Envelope {
  id: string;
  templateId: string | null;
  templateName: string | null;
  documentId: string;
  documentName: string;
  pages: number;
  /** A copy of the template's boxes at the time of sending; edits here never touch the template. */
  fields: TemplateField[];
  /** What is in each box, by field id. Signature boxes hold the typed name once signed. */
  values: Record<string, FieldValue>;
  clientPersonId: string;
  clientName: string;
  signerRole: SignerRole;
  signerName: string;
  textTo: string | null;
  emailTo: string | null;
  /** A note to the signer, shown word for word. Optional. */
  message: string;
  status: EnvelopeStatus;
  needsCountersign: boolean;
  createdAt: string;
  createdBy: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  /** True once the signer drew a mark. The mark itself is never stored. */
  markDrawn: boolean;
  declinedAt: string | null;
  declinedReason: string | null;
  countersignedAt: string | null;
  countersignedBy: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  correctedFromId: string | null;
  correctedToId: string | null;
  copySentAt: string | null;
  copySentTo: string | null;
  history: EnvelopeEvent[];
}

export const SIGNING_LIMITS =
  "No signing provider is connected. Nothing is stamped into a stored PDF and nobody is texted or emailed yet — Joy shows the message it would send, the request appears in the family portal, and Joy records who signed and when.";

/** What Joy can fill from a record. Blanks stay blank; nothing is guessed. */
export interface PrefillSource {
  name: string;
  dateOfBirth?: string | null;
  address?: string | null;
  phone?: string | null;
  mrNumber?: string | null;
  admissionDate?: string | null;
}

/** ISO date → "09/28/1943", the way a form expects it. */
export function formDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

export function prefillValues(fields: readonly TemplateField[], source: PrefillSource, today: string): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const f of fields) {
    if (f.fill !== "joy") {
      if (f.kind === "checkbox") values[f.id] = false;
      continue;
    }
    switch (f.kind) {
      case "client_name":
        values[f.id] = source.name;
        break;
      case "dob":
        values[f.id] = formDate(source.dateOfBirth);
        break;
      case "address":
        values[f.id] = source.address ?? "";
        break;
      case "phone":
        values[f.id] = source.phone ?? "";
        break;
      case "mr_number":
        values[f.id] = source.mrNumber ?? "";
        break;
      case "soc_date":
        values[f.id] = formDate(source.admissionDate);
        break;
      case "date":
        values[f.id] = formDate(today);
        break;
      case "checkbox":
        values[f.id] = false;
        break;
      default:
        values[f.id] = "";
    }
  }
  return values;
}

export function createEnvelope(input: {
  id: string;
  template: Pick<SigningTemplate, "id" | "name" | "documentId" | "documentName" | "pages" | "fields"> | null;
  document?: { id: string; name: string; pages: number; fields: TemplateField[] };
  clientPersonId: string;
  clientName: string;
  signerRole: SignerRole;
  signerName: string;
  prefill: PrefillSource;
  by: string;
  at: string;
}): Envelope {
  const src = input.template ?? (input.document ? { id: null, name: null, documentId: input.document.id, documentName: input.document.name, pages: input.document.pages, fields: input.document.fields } : null);
  if (!src) throw new Error("A request needs a template or a document.");
  const fields = src.fields.map((f) => ({ ...f }));
  return {
    id: input.id,
    templateId: src.id,
    templateName: src.name,
    documentId: src.documentId,
    documentName: src.documentName,
    pages: src.pages,
    fields,
    values: prefillValues(fields, input.prefill, input.at.slice(0, 10)),
    clientPersonId: input.clientPersonId,
    clientName: input.clientName,
    signerRole: input.signerRole,
    signerName: input.signerName,
    textTo: null,
    emailTo: null,
    message: "",
    status: "draft",
    needsCountersign: fields.some((f) => f.kind === "agency_signature"),
    createdAt: input.at,
    createdBy: input.by,
    sentAt: null,
    viewedAt: null,
    signedAt: null,
    signedName: null,
    markDrawn: false,
    declinedAt: null,
    declinedReason: null,
    countersignedAt: null,
    countersignedBy: null,
    completedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    correctedFromId: null,
    correctedToId: null,
    copySentAt: null,
    copySentTo: null,
    history: [{ at: input.at, by: input.by, kind: "created" }],
  };
}

function withEvent(env: Envelope, event: EnvelopeEvent): Envelope {
  return { ...env, history: [...env.history, event] };
}

/** Only an unsigned request can change. */
export function whyNotEdit(env: Pick<Envelope, "status">): string | null {
  if (env.status === "draft" || env.status === "sent" || env.status === "viewed") return null;
  if (env.status === "voided") return "This request was voided. Correct it to make a new one.";
  return "It has been signed, so it cannot be edited. Void it, or correct it to send a fresh copy.";
}

export function editEnvelope(
  env: Envelope,
  patch: Partial<Pick<Envelope, "fields" | "values" | "signerRole" | "signerName" | "message" | "textTo" | "emailTo">>,
  by: string,
  at: string,
): Envelope {
  const problem = whyNotEdit(env);
  if (problem) throw new Error(problem);
  const next = { ...env, ...patch };
  if (patch.fields) next.needsCountersign = patch.fields.some((f) => f.kind === "agency_signature");
  return withEvent(next, { at, by, kind: "edited" });
}

export function whyNotSend(env: Pick<Envelope, "status" | "fields" | "signerName" | "textTo" | "emailTo">): string | null {
  if (env.status !== "draft" && env.status !== "sent" && env.status !== "viewed") return "This request has already been answered.";
  if (!env.signerName.trim()) return "Say who signs.";
  if (!env.fields.some((f) => f.kind === "signature" && isSignerField(f))) return "There is no signature box for the signer.";
  if (env.textTo !== null && !env.textTo.trim()) return "Add the mobile number to text, or turn text off.";
  if (env.emailTo !== null && !env.emailTo.trim()) return "Add the email address, or turn email off.";
  if (env.emailTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.emailTo.trim())) return "That email address does not look right.";
  return null;
}

export function sendEnvelope(env: Envelope, by: string, at: string): Envelope {
  const problem = whyNotSend(env);
  if (problem) throw new Error(problem);
  const resend = env.status !== "draft";
  return withEvent({ ...env, status: "sent", sentAt: at, viewedAt: resend ? null : env.viewedAt }, { at, by, kind: resend ? "resent" : "sent", note: deliveryLine(env) });
}

/** "By text to (713) 555-0110 and email to g@example.com" — or that it only shows in the portal. */
export function deliveryLine(env: Pick<Envelope, "textTo" | "emailTo">): string {
  const parts: string[] = [];
  if (env.textTo?.trim()) parts.push(`text to ${env.textTo.trim()}`);
  if (env.emailTo?.trim()) parts.push(`email to ${env.emailTo.trim()}`);
  return parts.length ? `By ${parts.join(" and ")}` : "In the family portal only";
}

/** Text first when a number is on file; email as well when one is. */
export function defaultDelivery(source: { phone?: string | null; email?: string | null }): Delivery {
  return { textTo: source.phone?.trim() || null, emailTo: source.email?.trim() || null };
}

/** The text Joy would send. Shown, never sent, until Spruce is wired. */
export function deliveryMessage(env: Pick<Envelope, "signerName" | "documentName" | "clientName" | "message">, agencyName: string): string {
  const first = env.signerName.split(" ")[0] || env.signerName;
  const doc = env.documentName.replace(/\.[a-z0-9]{2,5}$/i, "");
  const note = env.message.trim() ? ` ${env.message.trim()}` : "";
  return `${agencyName}: Hi ${first}, ${doc} for ${env.clientName} is ready for your signature.${note} Open your family portal to read and sign it.`;
}

/** The email Joy would send: a subject and a body, plainer and longer than the text. */
export function deliveryEmail(env: Pick<Envelope, "signerName" | "documentName" | "clientName" | "message">, agencyName: string, officePhone: string): { subject: string; body: string } {
  const first = env.signerName.split(" ")[0] || env.signerName;
  const doc = env.documentName.replace(/\.[a-z0-9]{2,5}$/i, "");
  const note = env.message.trim() ? `\n\n${env.message.trim()}` : "";
  return {
    subject: `${doc} for ${env.clientName} — ready for your signature`,
    body: `Hi ${first},\n\n${doc} for ${env.clientName} is ready for you to read and sign. Open your family portal, go to Documents, and tap Sign. It takes about a minute.${note}\n\nIf you would rather sign on paper, call us at ${officePhone} and we will bring a copy.\n\n${agencyName}`,
  };
}

export function markViewed(env: Envelope, at: string): Envelope {
  if (env.status !== "sent") return env;
  return withEvent({ ...env, status: "viewed", viewedAt: at }, { at, by: env.signerName, kind: "viewed" });
}

/** The boxes the signer must complete, in reading order. */
export function signerFields(env: Pick<Envelope, "fields">): TemplateField[] {
  return env.fields.filter(isSignerField).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

export function agencyFields(env: Pick<Envelope, "fields">): TemplateField[] {
  return env.fields.filter(isAgencyField).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

/** Why the signer cannot finish yet, in their words. */
export function whyNotSign(env: Pick<Envelope, "status" | "fields">, input: { typedName: string; markDrawn: boolean; values: Record<string, FieldValue> }): string | null {
  if (env.status !== "sent" && env.status !== "viewed") return "This has already been answered.";
  if (input.typedName.trim().length < 2) return "Type your full name.";
  if (!input.markDrawn) return "Sign in the box.";
  for (const f of signerFields(env)) {
    if (!f.required || isMarkField(f) || f.kind === "date_signed") continue;
    const v = input.values[f.id];
    if (f.kind === "checkbox") continue;
    if (f.kind === "initials" && (typeof v !== "string" || v.trim().length < 1)) return "Add your initials where marked.";
    if (typeof v !== "string" || !v.trim()) return `Fill in ${f.label.toLowerCase()}.`;
  }
  return null;
}

export function signEnvelope(env: Envelope, input: { typedName: string; markDrawn: boolean; values: Record<string, FieldValue> }, at: string): Envelope {
  const problem = whyNotSign(env, input);
  if (problem) throw new Error(problem);
  const typed = input.typedName.trim();
  const values = { ...env.values };
  for (const f of signerFields(env)) {
    if (f.kind === "signature") values[f.id] = typed;
    else if (f.kind === "date_signed") values[f.id] = formDate(at.slice(0, 10));
    else if (f.id in input.values) values[f.id] = input.values[f.id];
  }
  const signed = withEvent({ ...env, status: "signed", signedAt: at, signedName: typed, markDrawn: true, values }, { at, by: typed, kind: "signed" });
  return signed.needsCountersign ? signed : withEvent({ ...signed, status: "completed", completedAt: at }, { at, by: typed, kind: "completed" });
}

export function declineEnvelope(env: Envelope, reason: string, at: string): Envelope {
  if (env.status !== "sent" && env.status !== "viewed") throw new Error("This has already been answered.");
  const note = reason.trim() || null;
  return withEvent({ ...env, status: "declined", declinedAt: at, declinedReason: note }, { at, by: env.signerName, kind: "declined", note: note ?? undefined });
}

export function whyNotCountersign(env: Pick<Envelope, "status" | "needsCountersign">, input: { typedName: string; markDrawn: boolean }): string | null {
  if (env.status !== "signed") return env.status === "completed" ? "This is already complete." : "The signer has not signed yet.";
  if (!env.needsCountersign) return "This request has no agency signature box.";
  if (input.typedName.trim().length < 2) return "Type your full name.";
  if (!input.markDrawn) return "Sign in the box.";
  return null;
}

export function countersignEnvelope(env: Envelope, input: { typedName: string; markDrawn: boolean }, by: string, at: string): Envelope {
  const problem = whyNotCountersign(env, input);
  if (problem) throw new Error(problem);
  const typed = input.typedName.trim();
  const values = { ...env.values };
  for (const f of agencyFields(env)) {
    if (f.kind === "agency_signature") values[f.id] = typed;
    else if (f.kind === "agency_date") values[f.id] = formDate(at.slice(0, 10));
  }
  const counter = withEvent({ ...env, countersignedAt: at, countersignedBy: by, values }, { at, by, kind: "countersigned" });
  return withEvent({ ...counter, status: "completed", completedAt: at }, { at, by, kind: "completed" });
}

export function whyNotVoid(env: Pick<Envelope, "status">, reason: string): string | null {
  if (env.status === "voided") return "Already voided.";
  if (reason.trim().length < 3) return "Say why. The reason stays on the record.";
  return null;
}

export function voidEnvelope(env: Envelope, reason: string, by: string, at: string): Envelope {
  const problem = whyNotVoid(env, reason);
  if (problem) throw new Error(problem);
  return withEvent({ ...env, status: "voided", voidedAt: at, voidedBy: by, voidReason: reason.trim() }, { at, by, kind: "voided", note: reason.trim() });
}

/**
 * Correct: void this one and open a fresh draft with the same boxes and
 * values, minus anything signed. Both remember each other.
 */
export function correctEnvelope(env: Envelope, input: { newId: string; reason: string; by: string; at: string }): { voided: Envelope; draft: Envelope } {
  const voided = withEvent(voidEnvelope(env, input.reason, input.by, input.at), { at: input.at, by: input.by, kind: "corrected", note: `Replaced by a corrected copy` });
  const values: Record<string, FieldValue> = {};
  for (const f of env.fields) {
    if (isMarkField(f) || f.kind === "date_signed" || f.kind === "agency_date") continue;
    if (f.id in env.values) values[f.id] = env.values[f.id];
  }
  const draft: Envelope = {
    ...env,
    id: input.newId,
    values,
    status: "draft",
    createdAt: input.at,
    createdBy: input.by,
    sentAt: null,
    viewedAt: null,
    signedAt: null,
    signedName: null,
    markDrawn: false,
    declinedAt: null,
    declinedReason: null,
    countersignedAt: null,
    countersignedBy: null,
    completedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    correctedFromId: env.id,
    correctedToId: null,
    copySentAt: null,
    copySentTo: null,
    history: [{ at: input.at, by: input.by, kind: "created", note: `Corrected from an earlier request: ${input.reason.trim()}` }],
  };
  return { voided: { ...voided, correctedToId: input.newId }, draft };
}

export function whyNotSendCopy(env: Pick<Envelope, "status">, to: string): string | null {
  if (env.status !== "completed") return "A copy goes out once the request is complete.";
  if (!to.trim()) return "Say where to send it.";
  return null;
}

export function recordCopySent(env: Envelope, to: string, by: string, at: string): Envelope {
  const problem = whyNotSendCopy(env, to);
  if (problem) throw new Error(problem);
  return withEvent({ ...env, copySentAt: at, copySentTo: to.trim() }, { at, by, kind: "copy_sent", note: to.trim() });
}

/** Waiting on the agency: signed by the client, not yet countersigned. */
export function waitingOnAgency(env: Pick<Envelope, "status" | "needsCountersign">): boolean {
  return env.status === "signed" && env.needsCountersign;
}

/** Still with the signer. */
export function waitingOnSigner(env: Pick<Envelope, "status">): boolean {
  return env.status === "sent" || env.status === "viewed";
}

export function envelopesForClient(envelopes: readonly Envelope[], clientPersonId: string): Envelope[] {
  return envelopes.filter((e) => e.clientPersonId === clientPersonId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The requests a family grant can see. A grant names its subject by the
 * portal's own person id, which the client roster does not share, so match
 * on the id first and then on the client's first name.
 */
export function envelopesForFamily(envelopes: readonly Envelope[], grant: { subjectPersonId: string | null; subjectName: string | null }): Envelope[] {
  return envelopes
    .filter((e) => e.status !== "draft" && e.status !== "voided")
    .filter((e) => {
      if (grant.subjectPersonId && e.clientPersonId === grant.subjectPersonId) return true;
      const first = grant.subjectName?.trim().toLowerCase();
      return !!first && e.clientName.trim().toLowerCase().split(" ")[0] === first;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One line for a list: "Signed by Jessie C · Sep 25, 3:40 PM". */
export function envelopeLine(env: Envelope, fmt: (iso: string) => string): string {
  switch (env.status) {
    case "draft":
      return `Draft · started ${fmt(env.createdAt)}`;
    case "sent":
      return `Sent ${fmt(env.sentAt ?? env.createdAt)} · ${deliveryLine(env)}`;
    case "viewed":
      return `Opened ${fmt(env.viewedAt ?? env.sentAt ?? env.createdAt)} · waiting on ${env.signerName}`;
    case "signed":
      return `Signed by ${env.signedName} · ${fmt(env.signedAt ?? env.createdAt)}${env.needsCountersign ? " · waiting on the agency" : ""}`;
    case "completed":
      return env.countersignedAt ? `Signed by ${env.signedName}, countersigned by ${env.countersignedBy} · ${fmt(env.completedAt ?? env.createdAt)}` : `Signed by ${env.signedName} · ${fmt(env.completedAt ?? env.createdAt)}`;
    case "declined":
      return `Declined ${fmt(env.declinedAt ?? env.createdAt)}${env.declinedReason ? ` — ${env.declinedReason}` : ""}`;
    case "voided":
      return `Voided ${fmt(env.voidedAt ?? env.createdAt)} — ${env.voidReason ?? ""}${env.correctedToId ? " · replaced" : ""}`;
  }
}

/** Days a sent request has waited, for Joy to notice. */
export function daysWaiting(env: Pick<Envelope, "sentAt" | "createdAt">, today: string): number {
  const from = (env.sentAt ?? env.createdAt).slice(0, 10);
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
}
