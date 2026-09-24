import type {
  CredentialRecord,
  EmployeeRole,
  EmployeeStatus,
} from "@/domain/employees/credentials";
import type { WorkAuthorizationBasis } from "@/domain/employees/workAuthorization";
import type { EmployeeProfile } from "@/domain/employees/profile";

/**
 * The Employees directory.
 *
 * Every caregiver and CNA is "PRN / Per Diem" — Karynn, 29 September: "every
 * employee that is a CNA/Caregiver is PRN/Per Diem." Nurses and the office
 * keep their own types.
 *
 * Pay rates and weekly hours are Karynn's own, given on 9 September with the
 * standing schedule: Chanel $15, Vanessa $17, Thylia $15, Bedjine $16, Glory
 * $15, Brandon $25, Daizha $25. Hours are what the schedule in
 * lib/schedulingSeed actually adds up to for each of them, so the directory
 * and the board cannot disagree about somebody's week.
 *
 *
 * STAFF NAMES ARE REAL — this is Joy Health's actual team, and unlike the
 * clients that is fine: being employed by a home care agency is not health
 * information about you. Every client referenced here is fictional, and the
 * two rules must not be confused. See the note in clientsSeed.ts.
 *
 * Credential dates are invented and chosen to exercise the states rather than
 * to look tidy: one lapsed, one inside the warning window, one never supplied,
 * one non-driver, one office role with no clinical requirements at all. A
 * directory where everything is green proves nothing about the screen.
 */
export interface SeedEmployee {
  id: string;
  name: string;
  title: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  location: string;
  hiredOn: string;
  employmentType: string;
  baseRate: number | null;
  weeklyHours: number | null;
  drives: boolean;
  /**
   * The medical record number, once somebody has issued one.
   *
   * Deliberately absent from every seeded record. Karynn's rule builds it from
   * the last four of a social security number, and these are Joy Health's real
   * team — an invented four digits committed to a file beside those words reads
   * as though they were somebody's actual number. The employee record asks for
   * the digits instead, computes the number once and keeps only the result.
   */
  mrNumber?: string | null;
  /**
   * How this person is entitled to work here.
   *
   * Optional because most records have never been asked — undefined is read
   * as "no expiry to watch", so a work permit is never invented for somebody
   * nobody has asked. See `domain/employees/workAuthorization`.
   */
  workAuthorization?: WorkAuthorizationBasis;
  phone: string | null;
  email: string | null;
  nextShift: string | null;
  /** Fictional clients, matching clientsSeed. */
  clients: string[];
  kin: string | null;
  kinLine: string | null;
  summary: string;
  records: Record<string, CredentialRecord>;
  /**
   * The editable half, pre-filled. Karynn, 29 September: "Add in mock data
   * for the rest on Chanel's profile so I can see what a full profile looks
   * like." Only Chanel carries one; everybody else's form opens from the seed
   * columns above. Addresses use 99xx street numbers and phones 555-01xx, so
   * nothing here can reach a real person.
   */
  profile?: Partial<EmployeeProfile>;
  /**
   * Employment details beyond the pay columns — mock, on Chanel's record only,
   * to Karynn's screenshots of 29 September. Gusto is not connected; these
   * are what the record would show once it is, not a reading from it.
   */
  employment?: EmploymentExtras;
  /**
   * The Roles tab, to Karynn's screenshot of 29 September. Mock on Chanel's
   * record only. The access rows describe what the role grants in the
   * database migrations; nothing here changes a grant.
   */
  roles?: RolesExtras;
}

export interface EmploymentExtras {
  /** What Gusto holds for this person. */
  gusto: {
    w4: "complete" | "pending" | "not_started";
    i9: "complete" | "pending" | "not_started";
    payrollSetup: "complete" | "pending" | "not_started";
    handbookSignedOn: string | null;
  };
  /** How they are paid, as Gusto has it. */
  payMethod: string;
  payCadence: string;
  timeAndAttendance: {
    clockMethod: string;
    lateArrivals90d: number;
    missedShifts90d: number;
  };
  reviews: {
    lastOn: string | null;
    lastRating: string | null;
    nextOn: string | null;
  };
}

export const GUSTO_STATE_LABELS: Record<EmploymentExtras["gusto"]["w4"], string> = {
  complete: "Complete",
  pending: "Pending",
  not_started: "Not started",
};

export interface RolesExtras {
  badges: string[];
  access: Array<{ label: string; detail: string; level: string; tone: "on" | "partial" | "off" }>;
  assignments: Array<{ client: string; kind: "Primary" | "Backup"; hoursPerWeek: number }>;
  skills: Array<{ name: string; status: "Verified" | "Approved" | "Pending" }>;
  preferences: { preferredShifts: string; maxWeeklyHours: number; travelRadiusMiles: number };
}

/** Everything current, as a base to vary from. */
const ok: Record<string, CredentialRecord> = {
  background_check: { issued: "2026-03-02", expires: "2027-03-02" },
  handbook: { issued: "2026-07-01", expires: "2027-07-01" },
  licence: { issued: "2023-01-15", expires: "2027-01-15" },
  cpr: { issued: "2025-06-01", expires: "2027-06-01" },
  tb_test: { issued: "2026-02-10", expires: "2027-02-10" },
  immunizations: { issued: "2026-02-10", expires: "2027-02-10" },
  annual_training: { issued: "2026-07-22", expires: "2027-07-22" },
  drivers_license: { issued: "2023-03-02", expires: "2027-03-02" },
  auto_insurance: { issued: "2026-01-01", expires: "2027-01-01" },
  /*
   * Added 9 September with the requirements themselves. Dated so the file
   * reads current rather than instantly red — a directory where every record
   * turns amber the day a requirement is added teaches people to ignore it.
   *
   * The background check now expires, per Karynn: it is dated a year out from
   * its last run rather than left open-ended.
   */
  i9: { issued: "2024-03-02", expires: null },
  social_security_card: { issued: "2024-03-02", expires: null },
  supervisory_visit_90: { issued: "2026-08-15", expires: "2026-11-13" },
  supervisory_visit_annual: { issued: "2026-03-02", expires: "2027-03-02" },
  education_hours: { issued: "2026-07-22", expires: "2027-07-22" },
};

export const seedEmployees: SeedEmployee[] = [
  {
    id: "emp-chanel",
    name: "Chanel P",
    title: "Field Caregiver",
    role: "caregiver",
    status: "active",
    location: "Houston · Memorial",
    hiredOn: "2023-03-02",
    employmentType: "PRN / Per Diem",
    baseRate: 15,
    weeklyHours: 37.5,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Tue, Aug 19 · 7:00 AM",
    /* Pamela P is who the schedule board actually has her with, weekdays. */
    clients: ["Pamela P", "Marilyn K"],
    /* Mock, per Karynn 29 September. 555-01xx numbers reach nobody. */
    kin: "Denise P",
    kinLine: "Sister · (713) 555-0158",
    summary:
      "Chanel is the agency's longest-serving field caregiver, with Joy since March 2023, primary on Pamela P and backup for Marilyn K. Credentials are all current and she carries 37.5 hours a week without overtime.",
    records: { ...ok },
    profile: {
      middleName: "Marie",
      preferredName: "Chanel",
      dateOfBirth: "1991-08-14",
      gender: "Female",
      externalId: "JH-0007",
      referralSource: "Referral",
      migratoryStatus: "US Citizen",
      disciplines: ["Caregiver", "Companionship"],
      staffLicense: "TX-CG-482913",
      tags: ["Weekends", "Dementia experience", "Own car"],
      preferredLanguage: "English",
      otherLanguages: ["Spanish"],
      applicationDate: "2023-02-14",
      jobDescriptionSignedOn: "2023-03-02",
      exclusionStatus: "cleared",
      exclusionCheckedAt: "2026-07-01",
      phoneMobile: "(713) 555-0142",
      email: "chanel.p@example.com",
      address: {
        line1: "9912 Westheimer Rd",
        line2: "Apt 214",
        city: "Houston",
        state: "TX",
        zip: "77063",
        county: "Harris",
      },
      emergencyContacts: [
        { name: "Denise P", address: "9930 Richmond Ave, Houston, TX 77042", phone: "(713) 555-0158", relationship: "Sibling", relationshipOther: "" },
        { name: "Marcus T", address: "", phone: "(281) 555-0173", relationship: "Other", relationshipOther: "Neighbour" },
      ],
      generalNotes: "Prefers weekday mornings. Comfortable with dementia clients; has done two hospice cases.",
    },
    employment: {
      gusto: { w4: "complete", i9: "complete", payrollSetup: "complete", handbookSignedOn: "2026-07-01" },
      payMethod: "Direct deposit",
      payCadence: "Biweekly",
      timeAndAttendance: { clockMethod: "Mobile · GPS", lateArrivals90d: 1, missedShifts90d: 0 },
      reviews: { lastOn: "2026-03-02", lastRating: "Meets", nextOn: "2027-03-02" },
    },
    roles: {
      badges: ["Caregiver", "Field Caregiver", "Transportation approved"],
      access: [
        { label: "App access", detail: "Caregiver mobile app", level: "Standard", tone: "on" },
        { label: "Client records", detail: "Assigned clients only", level: "Assigned", tone: "on" },
        { label: "Schedule editing", detail: "View and claim open shifts", level: "Limited", tone: "partial" },
        { label: "Billing & payroll", detail: "No access", level: "None", tone: "off" },
      ],
      assignments: [
        { client: "Pamela P", kind: "Primary", hoursPerWeek: 37.5 },
        { client: "Marilyn K", kind: "Backup", hoursPerWeek: 8 },
      ],
      skills: [
        { name: "Transfers & mobility", status: "Verified" },
        { name: "Dementia care", status: "Verified" },
        { name: "Medication reminders", status: "Verified" },
        { name: "Meal preparation", status: "Verified" },
        { name: "Hoyer lift", status: "Verified" },
        { name: "Transportation", status: "Approved" },
      ],
      preferences: { preferredShifts: "Weekday mornings", maxWeeklyHours: 40, travelRadiusMiles: 20 },
    },
  },
  {
    id: "emp-bedjine",
    name: "Bedjine C",
    title: "Certified Nursing Assistant",
    role: "cna",
    status: "active",
    location: "Katy",
    hiredOn: "2024-08-14",
    employmentType: "PRN / Per Diem",
    baseRate: 16,
    weeklyHours: 24,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Today · 9:00 AM",
    clients: ["Robert H"],
    kin: null,
    kinLine: null,
    summary: "",
    /*
     * The one caregiver on a work permit, and it expires inside the warning
     * window on purpose. A rule that is implemented and never visible in the
     * demo is a rule nobody can check — this is what puts "Work permit expires
     * in N days" on the record and on Paperwork Watch.
     */
    workAuthorization: "work_permit",
    records: {
      ...ok,
      // Inside the warning window.
      cpr: { issued: "2024-10-01", expires: "2026-10-01" },
      work_authorization: { issued: "2024-12-02", expires: "2026-12-02" },
    },
  },
  {
    id: "emp-glory",
    name: "Glory O",
    title: "Certified Nursing Assistant",
    role: "cna",
    status: "active",
    location: "Houston · Heights",
    hiredOn: "2024-06-09",
    employmentType: "PRN / Per Diem",
    baseRate: 15,
    weeklyHours: 32,
    // Does not drive. Assignments have to stay inside the Heights, and she can
    // never be the caregiver on a transport request.
    drives: false,
    phone: null,
    email: null,
    nextShift: "Wed, Aug 20 · 8:00 AM",
    clients: ["Robert H"],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    id: "emp-tanya",
    name: "Tanya R",
    title: "Certified Nursing Assistant",
    role: "cna",
    status: "active",
    location: "Pearland",
    hiredOn: "2023-11-06",
    employmentType: "PRN / Per Diem",
    baseRate: 18.25,
    weeklyHours: 40,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Thu, Aug 20 · 10:00 AM",
    clients: ["Vince W"],
    kin: null,
    kinLine: null,
    summary: "",
    // Lapsed. This is the record the directory must surface first.
    records: { ...ok, tb_test: { issued: "2025-02-10", expires: "2026-02-10" } },
  },
  {
    id: "emp-vanessa",
    name: "Vanessa J",
    title: "Field Caregiver",
    role: "caregiver",
    status: "active",
    location: "Pearland",
    hiredOn: "2025-04-21",
    employmentType: "PRN / Per Diem",
    baseRate: 17,
    weeklyHours: 40,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Thu, Aug 20 · 10:00 AM",
    clients: ["Jessie C", "Vince W"],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    id: "emp-brandon",
    name: "Brandon H",
    title: "Field Caregiver",
    role: "caregiver",
    status: "onboarding",
    location: "Houston · Southwest",
    hiredOn: "2026-07-28",
    employmentType: "PRN / Per Diem",
    baseRate: 25,
    weeklyHours: 20,
    drives: true,
    phone: null,
    email: null,
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary: "",
    // Never supplied. Onboarding, so this is expected rather than alarming.
    records: (() => {
      const r = { ...ok };
      delete (r as Record<string, unknown>).tb_test;
      return r;
    })(),
  },
  {
    id: "emp-thylia",
    name: "Thylia B",
    title: "Certified Nursing Assistant",
    role: "cna",
    // Active, because the schedule board has her on the evening case.
    status: "active",
    location: "Houston · Memorial",
    hiredOn: "2024-02-19",
    employmentType: "PRN / Per Diem",
    baseRate: 15,
    weeklyHours: 24,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Tue · 6:30 PM",
    clients: ["Pamela P"],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    id: "emp-daizha",
    name: "Daizha S",
    title: "Certified Nursing Assistant",
    role: "cna",
    status: "active",
    location: "Houston",
    hiredOn: "2025-06-02",
    employmentType: "PRN / Per Diem",
    baseRate: 25,
    weeklyHours: 36,
    drives: true,
    phone: null,
    email: null,
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    /*
     * Karynn is the owner AND the nurse. `user_role` says ceo_admin; the RN
     * licence is what lets her do supervisory visits. See SECURITY_NOTES on 0011.
     */
    id: "emp-karynn",
    name: "Karynn V",
    title: "Owner · RN · Administrator",
    role: "rn",
    status: "active",
    location: "Houston",
    hiredOn: "2022-01-03",
    employmentType: "Full-time · salaried",
    baseRate: null,
    weeklyHours: 40,
    drives: true,
    phone: null,
    email: null,
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    id: "emp-kelsey",
    name: "Kelsey Westley",
    title: "Registered Nurse",
    role: "rn",
    status: "active",
    location: "Houston",
    hiredOn: "2023-05-15",
    employmentType: "Full-time · salaried",
    baseRate: null,
    weeklyHours: 40,
    drives: true,
    phone: null,
    email: null,
    nextShift: "Mon, Aug 17 · 10:30 AM",
    clients: ["Robert H", "Pamela P"],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
  {
    id: "emp-john",
    name: "John Segura",
    title: "Operations · client and employee advisor",
    role: "office",
    status: "active",
    location: "Houston",
    hiredOn: "2024-01-08",
    employmentType: "Full-time · salaried",
    baseRate: null,
    weeklyHours: 40,
    drives: false,
    phone: null,
    email: null,
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },
];

/** An ISO instant `days` ago at a wall-clock time, so seeded activity merges with logged activity. */
function staffActivityAt(days: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** System events on a staff record. ISO instants, so they merge with logged activity. */
export const seedEmployeeActivity: Record<string, Array<{ label: string; at: string; tone: string }>> = {
  /* Mock, per Karynn 29 September, to her Activity screenshot. */
  "emp-chanel": [
    { label: "Shift completed — Pamela P, 10:30 AM to 6:00 PM", at: staffActivityAt(1, "18:04"), tone: "done" },
    { label: "Clocked in from client home (GPS verified)", at: staffActivityAt(1, "10:28"), tone: "prog" },
    { label: "CPR certification uploaded", at: staffActivityAt(5, "09:18"), tone: "done" },
    { label: "Picked up open shift — Marilyn K", at: staffActivityAt(7, "16:22"), tone: "prog" },
    { label: "Annual training completed — infection control", at: staffActivityAt(61, "11:40"), tone: "done" },
    { label: "Employee handbook re-signed", at: staffActivityAt(82, "08:05"), tone: "done" },
    { label: "Hired — onboarding completed", at: "2023-03-02T15:00:00.000Z", tone: "done" },
  ],
  "emp-bedjine": [
    { label: "Visit completed — Robert H, 12:00 PM to 6:00 PM", at: staffActivityAt(18, "18:05"), tone: "done" },
    { label: "CPR renewal requested", at: staffActivityAt(18, "08:05"), tone: "warn" },
  ],
  "emp-tanya": [
    { label: "TB test lapsed — removed from open shifts", at: staffActivityAt(201, "00:00"), tone: "bad" },
    { label: "Reached 40 hours this week", at: staffActivityAt(15, "18:00"), tone: "warn" },
  ],
  "emp-brandon": [
    { label: "Field orientation scheduled", at: staffActivityAt(16, "10:00"), tone: "prog" },
    { label: "TB documentation requested", at: staffActivityAt(32, "09:15"), tone: "warn" },
  ],
};
