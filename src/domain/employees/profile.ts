import { mrNumber } from "@/domain/records/mrNumber";
import type { EmployeeRole, EmployeeStatus } from "@/domain/employees/credentials";

/**
 * An employee's own record — the fields the office actually fills in.
 *
 * Karynn, 9 September: "There is no place for me to edit an Employee's info or
 * manually add an employee. I have attached screenshots of info needed."
 *
 * The screenshots are of the system Joy Health uses today, and this is that
 * form's field list: personal details, the dates around hiring, the address,
 * contact information, disciplines, employment type and two emergency
 * contacts. Where her form and Joy already disagreed, hers wins — it is the
 * one her office fills in every week.
 *
 * ── The social security number is used and not kept ──────────────────────
 *
 * Her form has an SSN field and Joy has one rule about it, which does not
 * bend: the number is typed, the medical record number is computed from its
 * last four, and the digits are never stored. Not in the record, not in
 * localStorage, not in the audit trail. `mrNumberFrom` below is the whole of
 * the contact this application has with a social security number — it takes
 * the string, returns the MR number, and the caller keeps only that.
 *
 * That is why there is no `ssn` field on this interface. A field would be
 * filled in, and a filled-in field gets saved.
 *
 * ── Everything else is optional ──────────────────────────────────────────
 *
 * Only a name and a role are required. An office adding somebody at 7am with
 * a phone number and nothing else should not be stopped, and a form that
 * demands a county before it will save is a form people work around by typing
 * something false into it.
 */

/** The disciplines her form offers, in her form's order. */
export const DISCIPLINES = ["CNA", "Companionship", "Caregiver", "PCA", "Homemaker"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const EMPLOYMENT_TYPES = [
  "PRN / Per Diem",
  "Full-time · hourly",
  "Full-time · salaried",
  "Part-time · hourly",
  "Contract",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/**
 * What a new employee's employment type starts as, by role.
 *
 * Karynn, 29 September: "every employee that is a CNA/Caregiver is PRN/Per
 * Diem. You can automatically set it as that unless we manually change it."
 * Field staff are as-needed by default; the office and the nurses are not, so
 * they keep the older default and somebody picks. The form applies this when
 * the role changes and the type has not been touched by hand — see
 * EmployeeForm — so a deliberate choice is never overwritten.
 */
export const FIELD_ROLES: readonly EmployeeRole[] = ["caregiver", "cna"];

export function defaultEmploymentType(role: EmployeeRole): EmploymentType {
  return FIELD_ROLES.includes(role) ? "PRN / Per Diem" : "Part-time · hourly";
}

export const MIGRATORY_STATUSES = [
  "US Citizen",
  "Permanent Resident",
  "Work Permit",
  "Other",
] as const;

export const GENDERS = ["Female", "Male", "Other", "Prefer not to say"] as const;

export const REFERRAL_SOURCES = [
  "Indeed",
  "Referral",
  "Website",
  "Walk-in",
  "Other",
] as const;

export const RELATIONSHIPS = [
  "Spouse",
  "Parent",
  "Father",
  "Mother",
  "Sibling",
  "Child",
  "Friend",
  "Other",
] as const;

/** Her form's exclusion-list check — the OIG/state list, run periodically. */
export type ExclusionStatus = "cleared" | "flagged" | "not_checked";

export const EXCLUSION_LABELS: Record<ExclusionStatus, string> = {
  cleared: "Cleared",
  flagged: "Flagged — do not schedule",
  not_checked: "Not checked",
};

export interface EmergencyContact {
  name: string;
  address: string;
  phone: string;
  relationship: string;
  /**
   * Who they are when the relationship is "Other". Karynn, 29 September: "If
   * other is selected, need to fill in who." Older records saved before the
   * field existed read as an empty string.
   */
  relationshipOther?: string;
}

export function blankContact(): EmergencyContact {
  return { name: "", address: "", phone: "", relationship: "", relationshipOther: "" };
}

/** "Other · Neighbour" rather than a bare "Other". */
export function relationshipLabel(c: Pick<EmergencyContact, "relationship" | "relationshipOther">): string {
  if (c.relationship === "Other" && c.relationshipOther?.trim()) return `Other · ${c.relationshipOther.trim()}`;
  return c.relationship;
}

export interface EmployeeAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  county: string;
}

export function blankAddress(): EmployeeAddress {
  return { line1: "", line2: "", city: "", state: "", zip: "", county: "" };
}

/**
 * The editable half of an employee record.
 *
 * Deliberately separate from `SeedEmployee`, which also carries computed and
 * demo-only things (credential records, next shift, the client list). This is
 * what a person types.
 */
export interface EmployeeProfile {
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string | null;
  gender: string;
  externalId: string;
  referralSource: string;
  /** Free text when the source is "Other" — her form has exactly this. */
  referralSourceOther: string;
  role: EmployeeRole;
  title: string;
  status: EmployeeStatus;
  location: string;
  employmentType: string;
  disciplines: string[];
  /**
   * NPI or licence number. Her current system says "NPI or Medicaid id";
   * Karynn, 29 September: "take off medicaid ID. We don't take medicaid."
   */
  staffLicense: string;
  migratoryStatus: string;
  baseRate: number | null;
  weeklyHours: number | null;
  drives: boolean;
  tags: string[];
  generalNotes: string;
  preferredLanguage: string;
  /**
   * Every other language they can work in. Karynn, 29 September: "add if
   * [the employee] is bilingual." Kept as a list rather than a yes/no because
   * "bilingual" on a roster is only useful when it says which — a Spanish
   * speaker and a Vietnamese speaker are not interchangeable to a family. See
   * `isBilingual` and `spokenLanguages`.
   */
  otherLanguages: string[];

  /* Dates */
  applicationDate: string | null;
  hiredOn: string | null;
  rehireDate: string | null;
  jobDescriptionSignedOn: string | null;

  /* Exclusion list */
  exclusionStatus: ExclusionStatus;
  exclusionCheckedAt: string | null;

  /*
   * Contact. One phone. Karynn, 29 September: "No one really has home phones
   * anymore, so you can take home phone off." Records saved before that carry
   * a `phoneHome` key nothing reads any more.
   */
  phoneMobile: string;
  email: string;
  address: EmployeeAddress;
  emergencyContacts: EmergencyContact[];

  /** Issued once from the last four of a social security number. Never derived. */
  mrNumber: string | null;
}

export function blankProfile(): EmployeeProfile {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: null,
    gender: "",
    externalId: "",
    referralSource: "",
    referralSourceOther: "",
    role: "caregiver",
    title: "Field Caregiver",
    status: "onboarding",
    location: "Houston",
    employmentType: defaultEmploymentType("caregiver"),
    disciplines: [],
    staffLicense: "",
    migratoryStatus: "",
    baseRate: null,
    weeklyHours: null,
    drives: false,
    tags: [],
    generalNotes: "",
    preferredLanguage: "English",
    otherLanguages: [],
    applicationDate: null,
    hiredOn: null,
    rehireDate: null,
    jobDescriptionSignedOn: null,
    exclusionStatus: "not_checked",
    exclusionCheckedAt: null,
    phoneMobile: "",
    email: "",
    address: blankAddress(),
    emergencyContacts: [blankContact(), blankContact()],
    mrNumber: null,
  };
}

export function fullName(p: Pick<EmployeeProfile, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Every language on the record, preferred first, without repeats or blanks. */
export function spokenLanguages(
  p: Pick<EmployeeProfile, "preferredLanguage" | "otherLanguages">,
): string[] {
  const out: string[] = [];
  for (const raw of [p.preferredLanguage, ...(p.otherLanguages ?? [])]) {
    const l = raw.trim();
    if (l && !out.some((x) => x.toLowerCase() === l.toLowerCase())) out.push(l);
  }
  return out;
}

export function isBilingual(p: Pick<EmployeeProfile, "preferredLanguage" | "otherLanguages">): boolean {
  return spokenLanguages(p).length >= 2;
}

/**
 * The MR number for this person, from a social security number that is not
 * kept.
 *
 * The only place in the application that touches an SSN. Returns null for
 * anything that is not a usable number, so a half-typed field produces no
 * number rather than a wrong one.
 */
export function mrNumberFrom(input: {
  firstName: string;
  lastName: string;
  ssn: string;
}): string | null {
  return mrNumber({
    firstName: input.firstName,
    lastName: input.lastName,
    ssn: input.ssn,
  });
}

/** Why this record cannot be saved, or null. */
export function whyNotSaveEmployee(p: EmployeeProfile): string | null {
  if (!p.firstName.trim()) return "A first name is needed.";
  if (!p.lastName.trim()) return "A last name is needed.";
  if (p.baseRate !== null && (Number.isNaN(p.baseRate) || p.baseRate < 0)) {
    return "The pay rate has to be a positive number.";
  }
  if (p.weeklyHours !== null && (p.weeklyHours < 0 || p.weeklyHours > 168)) {
    return "Weekly hours have to be between 0 and 168.";
  }
  if (p.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
    return "That email address does not look right.";
  }
  return null;
}

/**
 * Whether an inactive employee should still be on the main roster.
 *
 * Karynn, 9 September: "In order to not have the roster ridiculously long as
 * we grow, how can we keep the inactive employees after maybe 60 days off of
 * the main roster? What are your thoughts?"
 *
 * ── The thinking ─────────────────────────────────────────────────────────
 *
 * The roster is a working list — who can I send, who is off, who needs
 * paperwork. Somebody who left in March answers none of those questions, and
 * every row of them makes the answers slower to find.
 *
 * What must NOT happen is losing them. A personnel file is kept for years
 * after somebody leaves, and a surveyor asking for a 2024 caregiver's TB test
 * is a normal Tuesday. So this is a default view, never a deletion: they stay
 * in the directory behind the Inactive filter, they stay in search, and their
 * file is untouched.
 *
 * Sixty days is her number and it is a good one — long enough that a
 * seasonal returner is still to hand, short enough that a year's leavers
 * never accumulate on the screen.
 *
 * The countdown runs from the last day they were active rather than from a
 * flag somebody sets, so nobody has to remember to do anything for it to work.
 */
export const ROSTER_HIDE_AFTER_DAYS = 60;

export function daysSince(iso: string | null | undefined, today: string): number | null {
  if (!iso) return null;
  const from = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  const to = new Date(`${today.slice(0, 10)}T12:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86_400_000);
}

export function restingOffRoster(
  employee: { status: EmployeeStatus; inactiveSince?: string | null },
  today: string,
  afterDays = ROSTER_HIDE_AFTER_DAYS,
): boolean {
  if (employee.status !== "inactive") return false;
  const days = daysSince(employee.inactiveSince, today);
  // No date recorded means nobody knows when they left, and guessing "long
  // ago" would hide somebody who left yesterday. They stay until told.
  if (days === null) return false;
  return days >= afterDays;
}
