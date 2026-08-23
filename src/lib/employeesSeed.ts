import type {
  CredentialRecord,
  EmployeeRole,
  EmployeeStatus,
} from "@/domain/employees/credentials";

/**
 * Deterministic demo seed for the Employees directory.
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
  phone: string;
  email: string;
  nextShift: string | null;
  /** Fictional clients, matching clientsSeed. */
  clients: string[];
  kin: string | null;
  kinLine: string | null;
  summary: string;
  records: Record<string, CredentialRecord>;
}

/** Everything current, as a base to vary from. */
const ok: Record<string, CredentialRecord> = {
  background_check: { issued: "2024-03-02", expires: "2027-03-02" },
  handbook: { issued: "2026-07-01", expires: "2027-07-01" },
  licence: { issued: "2023-01-15", expires: "2027-01-15" },
  cpr: { issued: "2025-06-01", expires: "2027-06-01" },
  tb_test: { issued: "2026-02-10", expires: "2027-02-10" },
  immunizations: { issued: "2026-02-10", expires: "2027-02-10" },
  annual_training: { issued: "2026-07-22", expires: "2027-07-22" },
  drivers_license: { issued: "2023-03-02", expires: "2027-03-02" },
  auto_insurance: { issued: "2026-01-01", expires: "2027-01-01" },
};

export const seedEmployees: SeedEmployee[] = [
  {
    id: "emp-chanel",
    name: "Chanel P",
    title: "Field caregiver",
    role: "cna",
    status: "active",
    location: "Houston · Memorial",
    hiredOn: "2023-03-02",
    employmentType: "Full-time · hourly",
    baseRate: 19.5,
    weeklyHours: 38,
    drives: true,
    phone: "(713) 555-0126",
    email: "chanel@joyhealthcare.example",
    nextShift: "Tue, Aug 19 · 7:00 AM",
    clients: ["Lian Huang"],
    kin: "Robert P",
    kinLine: "Husband · (713) 555-0127",
    summary:
      "Longest-serving field caregiver and the primary on the Huang case, with room in her week before overtime.",
    records: { ...ok },
  },
  {
    id: "emp-bedjine",
    name: "Bedjine Cupidon",
    title: "Field caregiver",
    role: "hha",
    status: "active",
    location: "Katy",
    hiredOn: "2024-08-14",
    employmentType: "Part-time · hourly",
    baseRate: 17.75,
    weeklyHours: 25,
    drives: true,
    phone: "(281) 555-0111",
    email: "bedjine@joyhealthcare.example",
    nextShift: "Today · 9:00 AM",
    clients: ["Ruth Alvarez"],
    kin: "Dana Cupidon",
    kinLine: "Sister · (281) 555-0112",
    summary:
      "Relief caregiver on the Alvarez case, logging orientation checks every visit. CPR renewal is the only open item.",
    // Inside the warning window.
    records: { ...ok, cpr: { issued: "2024-10-01", expires: "2026-10-01" } },
  },
  {
    id: "emp-heather",
    name: "Heather Gonzales",
    title: "Field caregiver",
    role: "cna",
    status: "active",
    location: "Houston · Heights",
    hiredOn: "2024-06-09",
    employmentType: "Full-time · hourly",
    baseRate: 19.0,
    weeklyHours: 36,
    // Does not drive. Assignments have to stay inside the Heights, and she can
    // never be the caregiver on a transport request.
    drives: false,
    phone: "(713) 555-0134",
    email: "heather@joyhealthcare.example",
    nextShift: "Wed, Aug 20 · 8:00 AM",
    clients: ["Evelyn Carter"],
    kin: "Marcus Gonzales",
    kinLine: "Brother · (713) 555-0135",
    summary:
      "Consistent weekday caregiver on the Carter dementia case, where the family asked for minimal substitution. Does not drive.",
    records: { ...ok },
  },
  {
    id: "emp-tanya",
    name: "Tanya Robinson",
    title: "Field caregiver",
    role: "hha",
    status: "active",
    location: "Pearland",
    hiredOn: "2023-11-06",
    employmentType: "Full-time · hourly",
    baseRate: 18.25,
    weeklyHours: 40,
    drives: true,
    phone: "(346) 555-0148",
    email: "tanya@joyhealthcare.example",
    nextShift: "Thu, Aug 20 · 10:00 AM",
    clients: ["Susan Miller"],
    kin: "Alvin Robinson",
    kinLine: "Husband · (346) 555-0149",
    summary:
      "At the 40-hour threshold this week. Any additional shift crosses into overtime and bills at time and a half.",
    // Lapsed. This is the record the directory must surface first.
    records: { ...ok, tb_test: { issued: "2025-02-10", expires: "2026-02-10" } },
  },
  {
    id: "emp-vanessa",
    name: "Vanessa",
    title: "Field caregiver",
    role: "hha",
    status: "active",
    location: "Pearland",
    hiredOn: "2025-04-21",
    employmentType: "Part-time · hourly",
    baseRate: 17.5,
    weeklyHours: 12,
    drives: true,
    phone: "(346) 555-0177",
    email: "vanessa@joyhealthcare.example",
    nextShift: "Thu, Aug 20 · 10:00 AM",
    clients: ["Edward Pham", "Susan Miller"],
    kin: null,
    kinLine: null,
    summary: "Live-in coverage on the Pham case with Thursday evenings for Susan Miller.",
    records: { ...ok },
  },
  {
    id: "emp-emone",
    name: "Emone",
    title: "Field caregiver",
    role: "cna",
    status: "onboarding",
    location: "Houston · Southwest",
    hiredOn: "2026-07-28",
    employmentType: "Full-time · hourly",
    baseRate: 19.0,
    weeklyHours: null,
    drives: true,
    phone: "(832) 555-0163",
    email: "emone@joyhealthcare.example",
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary:
      "Came out of the July hiring cycle and is at field orientation. Not on a case yet — TB documentation is still outstanding.",
    // Never supplied. Onboarding, so this is expected rather than alarming.
    records: (() => {
      const r = { ...ok };
      delete (r as Record<string, unknown>).tb_test;
      return r;
    })(),
  },
  {
    id: "emp-thylia",
    name: "Thylia",
    title: "Field caregiver",
    role: "hha",
    // Active, because the schedule board has her on the Vance evening case —
    // she used to be this seed's on-leave example while the board and the
    // dashboard agenda both showed her working, which is the one-cast rule
    // broken from the other side.
    status: "active",
    location: "Houston · Memorial",
    hiredOn: "2024-02-19",
    employmentType: "Full-time · hourly",
    baseRate: 18.0,
    weeklyHours: 20,
    drives: true,
    phone: "(713) 555-0158",
    email: "thylia@joyhealthcare.example",
    nextShift: "Tue · 6:30 PM",
    clients: ["Dolores Vance"],
    kin: null,
    kinLine: null,
    summary:
      "Evening caregiver on the Vance case, four nights a week. Covered the Huang substitution on Aug 2.",
    records: { ...ok },
  },
  {
    id: "emp-kelsey",
    name: "Kelsey Westley",
    title: "Registered nurse",
    role: "lvn",
    status: "active",
    location: "Houston",
    hiredOn: "2023-05-15",
    employmentType: "Full-time · salaried",
    baseRate: null,
    weeklyHours: 40,
    drives: true,
    phone: "(713) 555-0102",
    email: "kelsey@joyhealthcare.example",
    nextShift: "Mon, Aug 17 · 10:30 AM",
    clients: ["Evelyn Carter", "Dolores Vance"],
    kin: null,
    kinLine: null,
    summary:
      "Runs assessments and supervisory visits, and is one of only two people who can take a client's signature on the consents packet.",
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
    phone: "(713) 555-0104",
    email: "john@joyhealthcare.example",
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary:
      "Owns the schedule board and the intake pipeline. Office role — no field credentials beyond the background check and handbook.",
    records: { ...ok },
  },
];

/** Activity feed. Demo only — the real one is built from the audit log (§27). */
export const seedEmployeeActivity: Record<string, Array<{ label: string; when: string; tone: string }>> = {
  "emp-bedjine": [
    { label: "Visit completed — Ruth Alvarez, 12:00 PM to 6:00 PM", when: "Aug 12 · 6:05 PM", tone: "done" },
    { label: "CPR renewal requested", when: "Aug 12 · 8:05 AM", tone: "warn" },
  ],
  "emp-tanya": [
    { label: "TB test lapsed — removed from open shifts", when: "Feb 10 · 12:00 AM", tone: "bad" },
    { label: "Reached 40 hours this week", when: "Aug 15 · 6:00 PM", tone: "warn" },
  ],
  "emp-emone": [
    { label: "Field orientation scheduled", when: "Aug 14 · 10:00 AM", tone: "prog" },
    { label: "TB documentation requested", when: "Jul 29 · 9:15 AM", tone: "warn" },
  ],
};
