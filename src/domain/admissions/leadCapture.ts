import type { DuplicateQuery } from "@/domain/admissions/duplicateCheck";

/**
 * The quick lead — what the office types while the phone is still ringing.
 *
 * The earlier referral form asked for first name, last name, best contact
 * method and payer before it would save. Karynn's office does not have that
 * on the first call; it has whoever rang and a number to ring back. So the
 * capture is: who are you talking to, and how do we reach them. Everything
 * else is optional and folds in as it is said.
 *
 * "Person needing care" is separate from the caller because most first calls
 * come from a daughter or a discharge planner, not the client. When it is
 * empty the caller is the client.
 */
export interface LeadCapture {
  contactName: string;
  phone: string;
  email: string;
  zip: string;
  personNeedingCare: string;
  relationship: string;
  relationshipOther: string;
  source: string;
  sourceOther: string;
  /** Where the referral came from, when the source is an organisation. */
  org: string;
  referrer: string;
  note: string;
}

export const RELATIONSHIPS = [
  "Self",
  "Daughter / son",
  "Spouse",
  "Sibling",
  "Power of attorney",
  "Case manager",
  "Other",
] as const;

export const LEAD_SOURCES = [
  "Case manager",
  "Community / networking",
  "Existing client or family",
  "Facility",
  "Hospital",
  "Physician / provider",
  "Professional referral",
  "Social worker",
  "Website",
  "Other",
] as const;

/** Sources that come from an organisation, so the form asks which one and who. */
export const ORGANISATION_SOURCES: readonly string[] = [
  "Hospital",
  "Case manager",
  "Social worker",
  "Physician / provider",
  "Facility",
  "Professional referral",
];

export const emptyLead: LeadCapture = {
  contactName: "",
  phone: "",
  email: "",
  zip: "",
  personNeedingCare: "",
  relationship: "",
  relationshipOther: "",
  source: "",
  sourceOther: "",
  org: "",
  referrer: "",
  note: "",
};

/** A name and one way to reach them. Nothing else is required to save. */
export function canSaveLead(lead: LeadCapture): boolean {
  return lead.contactName.trim().length > 0 && (lead.phone.trim().length > 0 || lead.email.trim().length > 0);
}

export function sourceHasOrganisation(source: string): boolean {
  return ORGANISATION_SOURCES.includes(source);
}

export function sourceLabel(lead: LeadCapture): string {
  const other = lead.sourceOther.trim();
  return lead.source === "Other" && other ? `Other — ${other}` : lead.source;
}

/** The queue row's third line: source and note, or "Just added". */
export function leadMeta(lead: LeadCapture): string {
  const parts = [sourceLabel(lead), lead.note.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Just added";
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts.length === 0
    ? { firstName: "", lastName: "" }
    : { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Whose record this becomes: the person needing care, or the caller when nobody else is named. */
export function careRecipientName(lead: LeadCapture): string {
  return lead.personNeedingCare.trim() || lead.contactName.trim();
}

export function leadDuplicateQuery(lead: LeadCapture): DuplicateQuery {
  const { firstName, lastName } = splitName(careRecipientName(lead));
  const someoneElse = lead.personNeedingCare.trim().length > 0;
  return {
    firstName,
    lastName,
    phone: lead.phone || null,
    email: lead.email || null,
    responsiblePartyName: (someoneElse && lead.contactName.trim()) || null,
  };
}

/** Enough typed to be worth checking against the people we already know. */
export function readyForDuplicateCheck(lead: LeadCapture): boolean {
  const name = careRecipientName(lead);
  const digits = lead.phone.replace(/\D/g, "");
  return name.trim().length > 2 || digits.length >= 7;
}
