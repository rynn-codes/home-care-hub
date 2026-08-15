import type { AdmissionStage, AdmissionStatus } from "@/domain/admissions/stages";

/**
 * Deterministic demo seed for the Admissions work queue.
 *
 * The people are the ones section 32 names, so the prototype demonstrates the
 * records the brief and the Golden Sprint 1 Demo describe — including Tammy
 * Wilson, whose New Referral is the demo's starting state.
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
    service: "Companion Care",
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
    service: "Live-In",
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
    meta: "Joan Robinson, RN · daughter Susan Bell is primary contact",
    action: "Open assessment",
    scheduledAt: "2026-08-17T10:30:00Z",
  },
  {
    id: "adm-evelyn",
    name: "Evelyn Carter",
    stage: "pre_onboarding",
    status: "active",
    service: "Dementia Care",
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
    service: "Respite Care",
    location: "Pearland",
    headline: "Intake started Aug 11 and never finished",
    meta: "Missing payment source and requested schedule",
    action: "Finish intake",
    overdue: true,
  },
];
