import type { UserRole } from "@/domain/consents/witness";
import { DEFAULT_TAG_PRESETS, type TagArea } from "@/domain/agency/tagPresets";
import { DEFAULT_PROFILE_UNDO_HOURS } from "@/domain/records/profileChanges";

/**
 * The agency's settings — what Settings → Agency shows and what the rest of
 * the app reads.
 *
 * The switch list mirrors the settings screen of the platform Karynn came
 * from, so nothing she is used to toggling has gone missing. Most of the
 * switches change what the prototype does; the three marked `notWired` are
 * kept so they can be seen, and the screen says they do nothing yet.
 */

export type SwitchGroup = "visits" | "notes" | "payroll" | "signatures" | "mobile" | "platform";

export interface AgencySwitch {
  key: string;
  label: string;
  group: SwitchGroup;
  default: boolean;
  /** Only meaningful while this other switch is on. */
  requires?: string;
  /** Shown, saved, and honestly labelled as doing nothing in the prototype. */
  notWired?: boolean;
}

export const EARLY_CLOCK_IN_GRACE_OPTIONS = [0, 2, 5, 10, 15] as const;
export const GEOFENCE_OPTIONS = [75, 150, 300, 800, 1609] as const;
export const MISSED_CLOCK_IN_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120] as const;

export const DEFAULT_EARLY_CLOCK_IN_GRACE_MINUTES = 5;
export const DEFAULT_GEOFENCE_METERS = 150;
export const DEFAULT_MISSED_CLOCK_IN_MINUTES = 15;
export const DEFAULT_MILEAGE_RATE = 0.7;

export const AGENCY_SWITCHES: readonly AgencySwitch[] = [
  { key: "using_evv", label: "Using EVV", group: "visits", default: true },
  { key: "reject_out_of_range", label: "Reject check-in/check-out if out of range", group: "visits", default: false },
  { key: "force_plan_of_care", label: "Force plan of care", group: "visits", default: true },
  { key: "force_tasks", label: "Force tasks", group: "visits", default: true },
  { key: "incomplete_on_conflict", label: "Incomplete visits when staff or patient hours conflict", group: "visits", default: true },
  { key: "no_incomplete_short_visits", label: "Do not incomplete short visits", group: "visits", default: true },
  { key: "visit_auto_rescheduling", label: "Visit auto-rescheduling", group: "visits", default: false },
  { key: "split_overnight", label: "Split overnight visits at midnight (off: a visit belongs to the day it starts)", group: "visits", default: false },
  { key: "send_skilled_visits", label: "Send skilled visits", group: "visits", default: false },
  { key: "using_team_clock", label: "Using team clock", group: "visits", default: false },
  { key: "allow_staff_scheduled_visits", label: "Allow scheduled visits or facility's visits by staff", group: "visits", default: false },
  { key: "incomplete_if_note_missing", label: "Incomplete visit if note is missing", group: "notes", default: true },
  { key: "incomplete_if_note_unverified", label: "Incomplete visit if note has not been submitted or verified", group: "notes", default: false },
  { key: "incomplete_skilled_without_form", label: "Incomplete skilled visit if no form has been completed", group: "notes", default: false },
  { key: "require_poc_information", label: "Require POC information", group: "notes", default: false },
  { key: "no_pay_over_scheduled", label: "Do not pay more than scheduled", group: "payroll", default: false },
  { key: "payroll_on_scheduled", label: "Allow payroll on scheduled time", group: "payroll", default: false },
  { key: "unverified_notes_excluded", label: "Visits without verified notes not included in payroll", group: "payroll", default: false },
  { key: "unround_private_duty_invoice", label: "Unround private duty invoice amount", group: "payroll", default: false },
  { key: "force_patient_signature", label: "Force patient signature", group: "signatures", default: false },
  { key: "require_signature_after_declining", label: "Require patient signature after declining", group: "signatures", default: false, requires: "force_patient_signature" },
  { key: "force_staff_signature", label: "Force staff signature", group: "signatures", default: false },
  { key: "patient_voice_signature", label: "Allow patient's voice signature", group: "signatures", default: false },
  { key: "collect_privacy_consents", label: "Allow collecting privacy and consents", group: "signatures", default: false },
  { key: "show_salary_on_mobile", label: "Display salary amount of completed visits on mobile app", group: "mobile", default: false },
  { key: "show_more_patient_info", label: "Display more patient information on mobile app", group: "mobile", default: false },
  { key: "hide_past_missed_visits", label: "Do not display past missed visits on the app", group: "mobile", default: false },
  { key: "auto_external_identifiers", label: "Auto-generate external identifiers for staff and patients", group: "platform", default: false },
  { key: "contract_by_offices", label: "Allow and enforce contract by offices", group: "platform", default: false, notWired: true },
  { key: "no_contractor_information", label: "Do not require the information of contractors", group: "platform", default: false },
  { key: "patients_list_extended", label: "Patients list extended", group: "platform", default: false },
  { key: "transmit_missed_visits", label: "Transmit missed visits to EVV aggregator", group: "platform", default: false, notWired: true },
  { key: "use_eligibility", label: "Use eligibility", group: "platform", default: false, notWired: true },
];

export const SWITCH_GROUP_LABELS: Record<SwitchGroup, string> = {
  visits: "Visits and the clock",
  notes: "Notes and documentation",
  payroll: "Payroll and invoicing",
  signatures: "Signatures and consents",
  mobile: "The caregiver's app",
  platform: "Platform and external systems",
};

export const SWITCH_GROUPS: readonly SwitchGroup[] = ["visits", "notes", "payroll", "signatures", "mobile", "platform"];

export type CalendarStart = "sun_sat" | "mon_sun";
export const CALENDAR_START_LABELS: Record<CalendarStart, string> = { sun_sat: "Sun – Sat", mon_sun: "Mon – Sun" };

export type PlanOfCareSource = "joy" | "uploaded";
export const PLAN_OF_CARE_LABELS: Record<PlanOfCareSource, string> = {
  joy: "Joy plan of care",
  uploaded: "Uploaded signed PDF",
};

export interface AgencyProfile {
  name: string;
  state: string;
  city: string;
  zip: string;
  zip9: string;
  address: string;
  phone: string;
  contactPhone: string;
  fax: string;
  email: string;
  hrEmail: string;
  ein: string;
  npi: string;
  taxonomyCode: string;
  providerMedicareId: string;
  providerMedicaidId: string;
  twilioPhone: string;
  apiKey: string;
}

export interface NotificationSettings {
  beforeStart: boolean;
  beforeStartMinutes: number;
  beforeEnd: boolean;
  beforeEndMinutes: number;
}

export interface AgencySettings {
  profile: AgencyProfile;
  calendarStart: CalendarStart;
  planOfCare: PlanOfCareSource;
  earlyClockInGraceMinutes: number;
  geofenceMeters: number;
  missedClockInEscalationMinutes: number;
  mileageRatePerMile: number;
  /** How long a profile or status change can be undone. */
  profileUndoHours: number;
  tagPresets: Record<TagArea, string[]>;
  /** Who sees margins on a shift. */
  profitVisibleTo: UserRole[];
  switches: Record<string, boolean>;
  notifications: NotificationSettings;
}

/** The roles margins are shown to by default. */
export const DEFAULT_PROFIT_ROLES: readonly UserRole[] = ["ceo_admin", "billing", "payroll"];
/** The roles the setting can be granted to at all. Field staff and families never see margins. */
export const PROFIT_ROLE_CHOICES: readonly UserRole[] = [
  "ceo_admin",
  "scheduler",
  "billing",
  "payroll",
  "hr",
  "intake_coordinator",
  "rn_clinical",
];

export function canSeeProfit(role: UserRole, visibleTo: readonly UserRole[]): boolean {
  if (role === "auditor" || role === "employee" || role === "client_contact") return false;
  return visibleTo.includes(role);
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  profile: {
    name: "Joy Healthcare Services, LLC",
    state: "Texas, TX",
    city: "Houston",
    zip: "77056",
    zip9: "770565784",
    address: "2700 Post Oak Blvd #22-151",
    phone: "7132319662",
    contactPhone: "3372786896",
    fax: "",
    email: "info@gojoyhealth.com",
    hrEmail: "hr@gojoyhealth.com",
    ein: "931800076",
    npi: "1891479820",
    taxonomyCode: "",
    providerMedicareId: "",
    providerMedicaidId: "",
    twilioPhone: "",
    apiKey: "",
  },
  calendarStart: "sun_sat",
  planOfCare: "joy",
  earlyClockInGraceMinutes: DEFAULT_EARLY_CLOCK_IN_GRACE_MINUTES,
  geofenceMeters: DEFAULT_GEOFENCE_METERS,
  missedClockInEscalationMinutes: DEFAULT_MISSED_CLOCK_IN_MINUTES,
  mileageRatePerMile: DEFAULT_MILEAGE_RATE,
  profileUndoHours: DEFAULT_PROFILE_UNDO_HOURS,
  tagPresets: {
    employees: [...DEFAULT_TAG_PRESETS.employees],
    documents: [...DEFAULT_TAG_PRESETS.documents],
  },
  profitVisibleTo: [...DEFAULT_PROFIT_ROLES],
  switches: Object.fromEntries(AGENCY_SWITCHES.map((s) => [s.key, s.default])),
  notifications: { beforeStart: true, beforeStartMinutes: 60, beforeEnd: true, beforeEndMinutes: 15 },
};

/** Metres, in the words an office in Houston uses: feet under a quarter mile, miles above. */
export function describeDistance(meters: number): string {
  const feet = meters * 3.28084;
  if (feet < 1320) return `${Math.round(feet / 10) * 10} feet`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles`;
}

/** A switch that depends on another is only live while that one is on. */
export function switchEnabled(sw: AgencySwitch, switches: Record<string, boolean>): boolean {
  return !sw.requires || switches[sw.requires] === true;
}

export function requiresLabel(sw: AgencySwitch): string | null {
  if (!sw.requires) return null;
  const parent = AGENCY_SWITCHES.find((s) => s.key === sw.requires);
  return parent ? parent.label : null;
}
