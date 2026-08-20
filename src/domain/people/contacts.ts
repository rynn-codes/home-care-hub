/**
 * People — Joy's contact list for everybody who is not a client or an employee.
 *
 * Karynn defined the scope herself, on 18 August: "People is our general
 * contact list for ancillary people, IE any contacts of the company that we
 * need to remember, follow-up with, business contacts, partners."
 *
 * WHY THIS IS NOT AN ADDRESS BOOK
 *
 * The most important people in it are the ones who send Joy clients. A skilled
 * nursing unit's social worker deciding where a patient goes after discharge is
 * making a referral decision, and `referral_source` in `0004` already has
 * `hospital_discharge` and `physician_referral` as values — so an admission can
 * point back at the person who caused it.
 *
 * That turns a list of names into something worth opening: who has sent Joy
 * work, and who has not heard from Joy in three months. A discharge planner who
 * referred two clients in the spring and has been silent since is not a stale
 * row, she is a relationship somebody stopped tending.
 *
 * ON REAL PEOPLE IN THIS FILE
 *
 * Clients are fictional throughout this repository and must stay so — being a
 * care recipient is health information about you. A business contact is a
 * different thing: this is a professional whose card exists to be handed to
 * exactly this kind of organisation, and their details are already in every
 * referral partner's file. The same reasoning that lets Joy's own staff appear
 * by name.
 */

export type ContactKind =
  /** Decides where a patient goes after a hospital or SNF stay. */
  | "discharge_planner"
  | "physician"
  | "case_manager"
  /**
   * Whose job is connecting their organisation's patients to services.
   *
   * Added when a VillageMD outreach specialist's card arrived and none of the
   * existing kinds fitted: not a clinician, not a case manager, and calling him
   * a "partner" would have dropped him out of the follow-up list — which is the
   * one thing about him that matters, since referrals are literally his role.
   */
  | "outreach"
  | "facility"
  | "vendor"
  | "partner"
  | "community"
  | "other";

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  discharge_planner: "Discharge planning",
  physician: "Physician",
  case_manager: "Case management",
  outreach: "Outreach",
  facility: "Facility",
  vendor: "Vendor",
  partner: "Partner",
  community: "Community",
  other: "Other",
};

/** Which kinds send Joy work, and are therefore worth staying in front of. */
export const REFERRING_KINDS: readonly ContactKind[] = [
  "discharge_planner",
  "physician",
  "case_manager",
  "outreach",
  "facility",
];

export interface Contact {
  id: string;
  name: string;
  /** Letters after the name — LCSW, RN, MD. Kept separate so lists can sort. */
  credentials: string | null;
  title: string | null;
  organization: string | null;
  /** The ward, unit or department. Often how you actually find somebody. */
  unit: string | null;
  kind: ContactKind;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** Anything worth remembering before you ring them. */
  notes: string | null;
  addedOn: string;
  /** ISO date Joy last spoke to them. Null when nobody has since adding them. */
  lastContactedOn: string | null;
  /** Admission ids that came from this person. */
  referrals: string[];
}

/**
 * How long a referring contact can go unheard-from before it is worth a call.
 *
 * A quarter, because that is roughly how often a discharge planner's caseload
 * turns over and how quickly an agency drops off their mental list. Shorter
 * would turn the screen into noise; longer and the relationship has already
 * gone cold.
 */
export const FOLLOW_UP_AFTER_DAYS = 90;

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000);
}

export function isReferrer(contact: Contact): boolean {
  return REFERRING_KINDS.includes(contact.kind) || contact.referrals.length > 0;
}

/**
 * Worth a call.
 *
 * Only referring contacts, and only once they have gone quiet. A vendor Joy has
 * not spoken to since March is not a problem; a discharge planner is.
 */
export function needsFollowUp(contact: Contact, asOf: string): boolean {
  if (!isReferrer(contact)) return false;
  const since = contact.lastContactedOn ?? contact.addedOn;
  return daysBetween(since, asOf) >= FOLLOW_UP_AFTER_DAYS;
}

/** The line under the name. Said the way somebody would say it out loud. */
export function contactLine(contact: Contact): string {
  return [contact.title, contact.unit, contact.organization].filter(Boolean).join(" · ");
}

export function displayName(contact: Contact): string {
  return contact.credentials ? `${contact.name}, ${contact.credentials}` : contact.name;
}

/**
 * What to say about this contact on the list.
 *
 * Referrals first, because that is the reason to care. Then silence, because
 * that is the reason to act.
 */
export function contactStanding(contact: Contact, asOf: string): string {
  const count = contact.referrals.length;
  const since = contact.lastContactedOn ?? contact.addedOn;
  const days = daysBetween(since, asOf);

  const referred =
    count === 0 ? null : `${count} ${count === 1 ? "referral" : "referrals"}`;

  const spoke = contact.lastContactedOn
    ? days === 0
      ? "spoke today"
      : days === 1
        ? "spoke yesterday"
        : days < FOLLOW_UP_AFTER_DAYS
          ? `spoke ${days} days ago`
          : `no contact in ${Math.floor(days / 30)} months`
    : "not spoken to yet";

  return [referred, spoke].filter(Boolean).join(" · ");
}

export function sortContacts(contacts: readonly Contact[], asOf: string): Contact[] {
  return contacts.slice().sort((a, b) => {
    // Whoever needs chasing comes first; the rest alphabetically, because a
    // contact list is something people scan by name.
    const chase = Number(needsFollowUp(b, asOf)) - Number(needsFollowUp(a, asOf));
    if (chase !== 0) return chase;
    return a.name.localeCompare(b.name);
  });
}

export function searchContacts(contacts: readonly Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...contacts];

  return contacts.filter((c) =>
    [c.name, c.organization, c.unit, c.title, c.email, c.notes]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );
}



// ------------------------------------------------------------- writing --

export interface ContactDraft {
  name: string;
  credentials: string;
  title: string;
  organization: string;
  unit: string;
  kind: ContactKind;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export const EMPTY_DRAFT: ContactDraft = {
  name: "",
  credentials: "",
  title: "",
  organization: "",
  kind: "discharge_planner",
  unit: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

export type DraftProblem = "no_name" | "no_way_to_reach" | "bad_email";

export const DRAFT_MESSAGES: Record<DraftProblem, string> = {
  no_name: "A name, at least.",
  no_way_to_reach: "An email or a phone number — otherwise there is no contact to keep.",
  bad_email: "That email address does not look right.",
};

/**
 * What a contact must have before it is worth saving.
 *
 * Only three things, and the middle one is the point: a row with a name and no
 * way to reach the person is a note, not a contact, and it will sit in the list
 * looking like something Joy can act on. Everything else on the card is
 * optional because business cards vary and half-entering somebody beats not
 * entering them.
 */
export function draftProblems(draft: ContactDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];

  if (draft.name.trim().length < 2) problems.push("no_name");
  if (!draft.email.trim() && !draft.phone.trim()) problems.push("no_way_to_reach");

  // Deliberately loose. A stricter pattern rejects real addresses, and the
  // cost of a typo here is a bounced email, not a broken record.
  if (draft.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) {
    problems.push("bad_email");
  }

  return problems;
}

export function canSave(draft: ContactDraft): boolean {
  return draftProblems(draft).length === 0;
}

function trimmed(value: string): string | null {
  const next = value.trim();
  return next.length > 0 ? next : null;
}

/**
 * Turn a filled-in form into a contact.
 *
 * `lastContactedOn` is set to today, because the moment somebody types a card
 * in is almost always the day they were handed it. Leaving it null would put a
 * brand-new contact straight onto the follow-up list in ninety days having
 * never been spoken to, which is technically true and useless.
 */
export function contactFromDraft(input: {
  draft: ContactDraft;
  id: string;
  today: string;
}): Contact {
  const { draft } = input;

  return {
    id: input.id,
    name: draft.name.trim(),
    credentials: trimmed(draft.credentials),
    title: trimmed(draft.title),
    organization: trimmed(draft.organization),
    unit: trimmed(draft.unit),
    kind: draft.kind,
    email: trimmed(draft.email),
    phone: trimmed(draft.phone),
    address: trimmed(draft.address),
    notes: trimmed(draft.notes),
    addedOn: input.today,
    lastContactedOn: input.today,
    referrals: [],
  };
}

/**
 * Record that somebody spoke to them.
 *
 * Without this the follow-up clock is a countdown nobody can reset, so every
 * contact turns amber after three months and the list becomes noise somebody
 * learns to ignore — which is worse than not flagging at all.
 */
export function recordContact(contact: Contact, on: string): Contact {
  return { ...contact, lastContactedOn: on.slice(0, 10) };
}

/** Fill the form from an existing contact, for editing. */
export function draftFromContact(contact: Contact): ContactDraft {
  return {
    name: contact.name,
    credentials: contact.credentials ?? "",
    title: contact.title ?? "",
    organization: contact.organization ?? "",
    unit: contact.unit ?? "",
    kind: contact.kind,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    notes: contact.notes ?? "",
  };
}

/**
 * Apply an edited form back onto a contact.
 *
 * Everything the form owns is replaced, including with nulls — clearing a field
 * has to mean clearing it, or somebody who deletes a wrong phone number finds
 * it still there. What the form does not own is preserved: when they were
 * added, when they were last spoken to, and which admissions came from them.
 */
export function applyDraft(contact: Contact, draft: ContactDraft): Contact {
  return {
    ...contact,
    name: draft.name.trim(),
    credentials: trimmed(draft.credentials),
    title: trimmed(draft.title),
    organization: trimmed(draft.organization),
    unit: trimmed(draft.unit),
    kind: draft.kind,
    email: trimmed(draft.email),
    phone: trimmed(draft.phone),
    address: trimmed(draft.address),
    notes: trimmed(draft.notes),
  };
}

/**
 * What deleting this contact would cost.
 *
 * A business card list is not a clinical record and somebody should be able to
 * remove a duplicate without ceremony. But a contact carrying referrals is
 * carrying the only record of where those admissions came from, and losing that
 * quietly is how an agency stops knowing which relationships actually work.
 *
 * So: no friction for an ordinary contact, one sentence of warning for one that
 * has sent Joy work.
 */
export function deletionWarning(contact: Contact): string | null {
  if (contact.referrals.length === 0) return null;
  const n = contact.referrals.length;
  return `${contact.name} is recorded as the source of ${n} ${n === 1 ? "admission" : "admissions"}. Removing them loses that.`;
}
