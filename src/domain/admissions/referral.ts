import type { DuplicateQuery } from "@/domain/admissions/duplicateCheck";

/**
 * The new-referral form's shape and rules.
 *
 * Section 8 of the Admissions Master Build Spec sets the boundary: capture
 * enough to follow up without making referral entry burdensome. The full
 * clinical and intake packet is explicitly NOT collected here — that is what
 * phone intake is for, and the client's full address waits until assessment
 * scheduling.
 *
 * Validation lives here rather than in the component so it can be tested, and
 * so the same rules can run on a server write later.
 */

export const REFERRAL_SOURCES = [
  { value: "phone_inquiry", label: "Phone inquiry" },
  { value: "web_form", label: "Web form" },
  { value: "marketing_crm", label: "Marketing / CRM" },
  { value: "hospital_discharge", label: "Hospital / discharge planner" },
  { value: "physician_referral", label: "Physician referral" },
  { value: "family_word_of_mouth", label: "Family / word of mouth" },
  { value: "client_self", label: "Client / self" },
  { value: "repeat_client", label: "Repeat client" },
  { value: "office_entry", label: "Office entry" },
  { value: "other", label: "Other" },
] as const;

// The agency's catalog is exactly three service lines (README business rule
// #2). "Companion", "dementia", "live-in" and "post-acute" are not service
// lines — they are, respectively, a Respite framing, a Personal Care client
// population, a schedule, and the Post-Surgical line's older name.
export const CARE_SERVICES = [
  { value: "personal_care", label: "Personal Care" },
  { value: "post_surgical", label: "Post-Surgical" },
  { value: "respite", label: "Respite" },
  { value: "other", label: "Other" },
] as const;

export const CONTACT_METHODS = [
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
] as const;

export const PAYMENT_SOURCES = [
  { value: "self_pay", label: "Self pay" },
  { value: "self_pay_ltc_insurance", label: "Self pay + LTC insurance" },
  { value: "not_sure_yet", label: "Not sure yet" },
  { value: "other", label: "Other" },
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]["value"];
export type CareService = (typeof CARE_SERVICES)[number]["value"];
export type ContactMethod = (typeof CONTACT_METHODS)[number]["value"];
export type PaymentSource = (typeof PAYMENT_SOURCES)[number]["value"];

export interface ReferralDraft {
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  /** False when the person calling is the prospective client themselves. */
  contactIsSomeoneElse: boolean;
  contactName: string;
  contactRelationship: string;
  contactPhone: string;
  referralSource: ReferralSource;
  referralSourceDetail: string;
  serviceRequested: CareService | "";
  serviceArea: string;
  bestContactMethod: ContactMethod | "";
  expectedPayer: PaymentSource | "";
  referralNote: string;
}

export const emptyReferral: ReferralDraft = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  contactIsSomeoneElse: false,
  contactName: "",
  contactRelationship: "",
  contactPhone: "",
  referralSource: "phone_inquiry",
  referralSourceDetail: "",
  serviceRequested: "",
  serviceArea: "",
  bestContactMethod: "",
  expectedPayer: "",
  referralNote: "",
};

export type ReferralErrors = Partial<Record<keyof ReferralDraft, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function digits(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Validates a referral draft.
 *
 * Deliberately permissive about everything except being able to call the person
 * back. A referral nobody can follow up on is not a lighter record, it is a
 * lost one — so the single hard rule beyond a name is one reachable contact.
 */
export function validateReferral(draft: ReferralDraft): ReferralErrors {
  const errors: ReferralErrors = {};

  if (!draft.firstName.trim()) errors.firstName = "First name is required.";
  if (!draft.lastName.trim()) errors.lastName = "Last name is required.";

  const hasPhone = digits(draft.phone).length >= 10;
  const hasContactPhone = digits(draft.contactPhone).length >= 10;
  const hasEmail = EMAIL.test(draft.email.trim());

  if (draft.phone.trim() && !hasPhone) {
    errors.phone = "That phone number looks short. Include the area code.";
  }

  if (draft.email.trim() && !hasEmail) {
    errors.email = "That email address doesn't look right.";
  }

  if (draft.contactPhone.trim() && !hasContactPhone) {
    errors.contactPhone = "That phone number looks short. Include the area code.";
  }

  // Only fall back to the generic prompt when the user has genuinely given us
  // nothing. If they typed a phone number badly, "that looks short" is the
  // useful message and must not be overwritten by "add a phone number" — they
  // plainly tried to.
  const attemptedContact =
    Boolean(draft.phone.trim()) || Boolean(draft.email.trim()) || Boolean(draft.contactPhone.trim());

  if (!hasPhone && !hasEmail && !hasContactPhone && !attemptedContact) {
    errors.phone = "Add a phone number or email so someone can follow up.";
  }

  if (draft.contactIsSomeoneElse) {
    if (!draft.contactName.trim()) {
      errors.contactName = "Who called? A name makes the callback possible.";
    }
    if (!draft.contactRelationship.trim()) {
      errors.contactRelationship = "How are they related to the client?";
    }
  }

  // Asking to be reached a way we have no details for is the kind of small gap
  // that turns into an unreturned call.
  if (draft.bestContactMethod === "email" && !hasEmail) {
    errors.bestContactMethod = "Add an email address, or choose another contact method.";
  }
  if ((draft.bestContactMethod === "phone" || draft.bestContactMethod === "text") &&
      !hasPhone && !hasContactPhone) {
    errors.bestContactMethod = "Add a phone number, or choose another contact method.";
  }

  if (draft.referralSource === "other" && !draft.referralSourceDetail.trim()) {
    errors.referralSourceDetail = "Say where this referral came from.";
  }

  return errors;
}

export function isReferralValid(draft: ReferralDraft): boolean {
  return Object.keys(validateReferral(draft)).length === 0;
}

/** Builds the duplicate-check query from whatever the user has typed so far. */
export function toDuplicateQuery(draft: ReferralDraft): DuplicateQuery {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    preferredName: draft.preferredName || null,
    phone: draft.phone || draft.contactPhone || null,
    email: draft.email || null,
    dateOfBirth: draft.dateOfBirth || null,
    responsiblePartyName: draft.contactIsSomeoneElse ? draft.contactName || null : null,
  };
}

/**
 * Enough of a name to be worth checking for duplicates.
 *
 * Running the check on every keystroke from the first letter would flag half
 * the client list while someone is still typing.
 */
export function isReadyForDuplicateCheck(draft: ReferralDraft): boolean {
  return draft.firstName.trim().length >= 2 && draft.lastName.trim().length >= 2;
}
