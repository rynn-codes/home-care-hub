import type { AdmissionStage, AdmissionStatus } from "@/domain/admissions/stages";

/**
 * Deterministic demo seed for the Admissions work queue.
 *
 * The people are the ones section 32 names, so the prototype demonstrates the
 * records the brief and the Golden Sprint 1 Demo describe — including Tammy
 * Wilson, whose New Referral is the demo's starting state.
 *
 * Staff names are Joy Health's real team; every client here is fictional and
 * must stay fictional. See the note in joySeed.ts.
 *
 * Demo seed only. Section 32 forbids mixing this into production migrations,
 * and section 25 requires these views to query the real domain once the
 * migrations are applied.
 */
export interface SeedAdmission {
  id: string;
  name: string;
  stage: AdmissionStage;
  status: AdmissionStatus;
  service: string;
  location: string;
  /** The one line that says why this record is on screen. */
  headline: string;
  meta: string;
  /** The action a user would take next. */
  action: string;
  waitingOn?: string | null;
  scheduledAt?: string | null;
  overdue?: boolean;
}

export const seedAdmissions: SeedAdmission[] = [
  {
    id: "adm-tammy",
    name: "Tammy Wilson",
    stage: "new_referral",
    status: "active",
    service: "Personal Care",
    location: "Houston",
    headline: "New referral — no one has called back yet",
    meta: "Daughter is primary contact · received today, 9:14 AM",
    action: "Start intake",
  },
  {
    id: "adm-ruth",
    name: "Ruth Alvarez",
    stage: "new_referral",
    status: "active",
    service: "Respite",
    location: "Houston",
    headline: "Referral from Mercy Discharge Planning",
    meta: "Received today, 8:15 AM",
    action: "Start intake",
  },
  {
    id: "adm-susan-m",
    name: "Susan Miller",
    stage: "pre_onboarding",
    status: "active",
    service: "Personal Care",
    location: "Bellaire",
    headline: "Agreement ready for your review",
    meta: "Assessment completed Aug 12",
    action: "Review agreement",
  },
  {
    id: "adm-robert",
    name: "Robert Green",
    stage: "ready_for_admission",
    status: "active",
    service: "Personal Care",
    location: "Sugar Land",
    headline: "Ready for admission — start of care targeted for Monday",
    meta: "Care plan approved · payment set up",
    action: "Prepare start of care",
  },
  {
    id: "adm-marcus",
    name: "Marcus Bell",
    stage: "assessment",
    status: "active",
    service: "Personal Care",
    location: "Houston · 77004",
    headline: "RN assessment booked for Aug 17, 10:30 AM",
    meta: "Kelsey Westley, RN · Daughter Susan Bell is primary contact",
    action: "Open assessment",
    scheduledAt: "2026-08-17T10:30:00Z",
  },
  {
    id: "adm-evelyn",
    name: "Evelyn Carter",
    stage: "pre_onboarding",
    status: "active",
    service: "Personal Care",
    location: "Katy",
    headline: "Waiting on family signature",
    meta: "Packet sent Aug 13 · reminder sent Aug 14",
    action: "Send reminder",
    waitingOn: "family signature",
  },
  {
    id: "adm-harold",
    name: "Harold Nguyen",
    stage: "phone_intake",
    status: "active",
    service: "Respite",
    location: "Pearland",
    headline: "Intake started Aug 11 and never finished",
    meta: "Missing payment source and requested schedule",
    action: "Finish intake",
    overdue: true,
  },
];

/**
 * The people behind the seeded admissions.
 *
 * Every admission points at a person, so every seeded admission appears here —
 * otherwise the duplicate check would miss a record that is visibly sitting in
 * the queue, and entering "Tammy Wilson" would quietly create a second referral
 * for someone who already has one.
 */
export interface SeedPerson {
  personId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  responsiblePartyName?: string | null;
  openAdmissionStage?: string | null;
  /** Set when this person becomes a client. The person row is never duplicated. */
  clientStatus?: "active" | null;
  admissionDate?: string | null;
}

export const seedPeople: SeedPerson[] = [
  {
    personId: "per-tammy",
    firstName: "Tammy",
    lastName: "Wilson",
    phone: "(713) 555-0142",
    email: null,
    dateOfBirth: null,
    responsiblePartyName: "Denise Wilson",
    openAdmissionStage: "new_referral",
  },
  {
    personId: "per-ruth",
    firstName: "Ruth",
    lastName: "Alvarez",
    phone: "(832) 555-0119",
    email: null,
    dateOfBirth: "1941-09-08",
    responsiblePartyName: null,
    openAdmissionStage: "new_referral",
  },
  {
    personId: "per-susan-m",
    firstName: "Susan",
    lastName: "Miller",
    phone: "(713) 555-0163",
    email: "s.miller@example.com",
    dateOfBirth: "1948-01-30",
    responsiblePartyName: "Paul Miller",
    openAdmissionStage: "pre_onboarding",
  },
  {
    personId: "per-robert",
    firstName: "Robert",
    lastName: "Green",
    phone: "(281) 555-0104",
    email: null,
    dateOfBirth: "1937-05-19",
    responsiblePartyName: "Angela Green",
    openAdmissionStage: "ready_for_admission",
  },
  {
    personId: "per-marcus",
    firstName: "Marcus",
    lastName: "Bell",
    phone: "(713) 555-0134",
    email: "susan.bell@example.com",
    dateOfBirth: "1946-03-02",
    responsiblePartyName: "Susan Bell",
    openAdmissionStage: "assessment",
  },
  {
    personId: "per-evelyn",
    firstName: "Evelyn",
    lastName: "Carter",
    phone: "(281) 555-0177",
    email: null,
    dateOfBirth: "1939-11-20",
    responsiblePartyName: "Grace Carter",
    openAdmissionStage: "pre_onboarding",
  },
  {
    personId: "per-harold",
    firstName: "Harold",
    lastName: "Nguyen",
    phone: "(713) 555-0195",
    email: null,
    dateOfBirth: "1950-02-11",
    responsiblePartyName: "Mai Nguyen",
    openAdmissionStage: "phone_intake",
  },
  {
    // No open admission — a past client, so a fresh enquiry is legitimate and
    // should surface the history without blocking.
    personId: "per-lian",
    firstName: "Lian",
    lastName: "Huang",
    phone: "(713) 555-0188",
    email: "family.huang@example.com",
    dateOfBirth: "1944-06-14",
    responsiblePartyName: "Johnathan Huang",
    openAdmissionStage: null,
  },
];
