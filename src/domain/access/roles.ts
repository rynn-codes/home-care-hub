/**
 * Who may see which area of Joy, and who may change anything.
 *
 * Karynn, 30 August, the week of a survey: "I want to have a role for
 * auditor. Where they can have access but can only see certain things."
 * And 26 September: "Add the bookkeeper as a role that only sees Reports
 * and Billing."
 *
 * ── The roles, 1 October ─────────────────────────────────────────────────
 *
 * Admin/Owner sees everything. RN sees everything but the money. Operations
 * sees everything but the money and the RN's duties — and may be let into
 * some of the money from Settings → Roles, one area at a time. Finance sees
 * the money and the records it bills against. The auditor and the bookkeeper
 * get short allowlists. A screen added next month is invisible to a narrowed
 * role until somebody adds it here on purpose. Never invert this to a
 * blocklist. The owner can never be narrowed.
 *
 * ── None of this is security ─────────────────────────────────────────────
 *
 * It is UI scoping. Three doors have to agree — the sidebar filters rows, the
 * router refuses the path, and tab strips inside a granted screen check too —
 * and the provider replaces every mutation for a read-only role. Enforcement
 * belongs in the server's row policies; this module exists so those rules
 * have one place to mirror.
 */
import type { UserRole } from "@/domain/consents/witness";

export type Area =
  | "home"
  | "my_work"
  | "brain"
  | "hiring"
  | "admissions"
  | "clients"
  | "employees"
  | "people"
  | "scheduling"
  | "billing"
  | "payroll"
  | "reports"
  /** RN supervisory visits: a care record that lives under Reports, not a money report. */
  | "supervision"
  | "audit"
  | "incidents"
  | "documents"
  | "sops"
  | "settings";

/** What a licensure surveyor is shown. Everything else is invisible to them. */
export const AUDITOR_AREAS: readonly Area[] = ["clients", "employees", "incidents", "documents", "sops", "audit"];

/**
 * What the bookkeeper is shown: the money, and nothing about anybody's
 * care. Reports for the month's numbers and the lists to reconcile; Billing
 * to record payments and see what is owed. Client names appear on invoices
 * because a bookkeeper needs them; health information never does.
 */
export const BOOKKEEPER_AREAS: readonly Area[] = ["reports", "billing"];

export const ALL_AREAS: readonly Area[] = [
  "home", "my_work", "brain", "hiring", "admissions", "clients", "employees", "people", "scheduling", "billing", "payroll", "reports", "supervision", "audit", "incidents", "documents", "sops", "settings",
];

/** The money: what the RN never sees and Operations sees only when let in. */
export const FINANCE_AREAS: readonly Area[] = ["billing", "payroll", "reports"];

/** What Finance is shown: the money, and the records it bills and pays against. */
export const FINANCE_GRANT: readonly Area[] = ["home", "my_work", "brain", "billing", "payroll", "reports", "clients", "employees", "people", "documents"];

const EVERYTHING_BUT_MONEY: readonly Area[] = ALL_AREAS.filter((a) => !FINANCE_AREAS.includes(a));

/**
 * The finance areas Operations has been let into. Set from Settings → Roles
 * (lib/agencyStore keeps it with the agency settings) so the sidebar, the
 * router and the tab strips all read one answer.
 */
let operationsFinance: readonly Area[] = [];

export function configureOperationsFinance(areas: readonly Area[]) {
  operationsFinance = areas.filter((a) => FINANCE_AREAS.includes(a));
}

export function operationsFinanceAreas(): readonly Area[] {
  return operationsFinance;
}

const GRANTS: Record<UserRole, "all" | readonly Area[]> = {
  ceo_admin: "all",
  rn_clinical: EVERYTHING_BUT_MONEY,
  operations: EVERYTHING_BUT_MONEY,
  finance: FINANCE_GRANT,
  employee: "all",
  client_contact: "all",
  auditor: AUDITOR_AREAS,
  bookkeeper: BOOKKEEPER_AREAS,
};

export function canView(role: UserRole, area: Area): boolean {
  const grant = grantsFor(role);
  return grant === "all" || grant.includes(area);
}

export function grantsFor(role: UserRole): "all" | readonly Area[] {
  const grant = GRANTS[role];
  if (role === "operations" && grant !== "all") return [...grant, ...operationsFinance.filter((a) => !grant.includes(a))];
  return grant;
}

/**
 * The RN's duties as a job function: completing an assessment, signing a
 * plan of care. Operations records and schedules; it does not do these.
 * Supervisory visits and witnessing a signature have their own, stricter
 * rules (a current RN licence; domain/clinical/registeredNurse) and are not
 * loosened by this.
 */
export function canDoClinical(role: UserRole): boolean {
  return role === "ceo_admin" || role === "rn_clinical";
}

export function clinicalRefusal(role: UserRole): string {
  return canDoClinical(role) ? "" : `This is the RN's to complete. Your role is ${AREA_ROLE_LABEL(role)}, so you can gather and record; the RN signs it off.`;
}

function AREA_ROLE_LABEL(role: UserRole): string {
  return { ceo_admin: "Admin / Owner", rn_clinical: "RN", operations: "Operations", finance: "Finance", employee: "Caregiver", client_contact: "Client contact", auditor: "Auditor", bookkeeper: "Bookkeeper" }[role];
}

/** Whether this session may change anything at all. */
export function canWrite(role: UserRole): boolean {
  return role !== "auditor";
}

/** Why a session is read-only, in words for the header, or null. */
export function readOnlyReason(role: UserRole): string | null {
  return canWrite(role) ? null : "This is a read-only survey session. Nothing on this screen can be changed.";
}

/**
 * Marketing is its own gate. Gifts can be logged on a client or employee
 * record, so hiding the People screen does not hide the gift — handing a
 * surveyor a list of lunches bought for discharge planners invites a question
 * that has nothing to do with the care under review.
 */
export function canSeeMarketing(role: UserRole): boolean {
  return canView(role, "people");
}

export function whyNotArea(role: UserRole, area: Area): string {
  if (canView(role, area)) return "";
  return role === "auditor"
    ? `${AREA_LABELS[area]} is not part of this survey session. Ask the agency's administrator if you need it.`
    : `${AREA_LABELS[area]} is not part of your role. Ask the agency's administrator if you need it.`;
}

export const AREA_LABELS: Record<Area, string> = {
  home: "Home",
  my_work: "My Work",
  brain: "The Brain",
  hiring: "Hiring",
  admissions: "Admissions",
  clients: "Clients",
  employees: "Employees",
  people: "People",
  scheduling: "Scheduling",
  billing: "Billing",
  payroll: "Payroll",
  reports: "Reports",
  supervision: "Supervision",
  audit: "Audit log",
  incidents: "Incidents",
  documents: "Documents",
  sops: "SOPs",
  settings: "Settings",
};

/** Longest prefix wins, so /reports/audit is audit rather than reports. */
const PATH_AREAS: ReadonlyArray<[string, Area]> = [
  ["/reports/audit", "audit"],
  ["/reports/incidents", "incidents"],
  ["/reports/supervision", "supervision"],
  ["/reports/investor", "reports"],
  ["/clients", "clients"],
  ["/employees", "employees"],
  ["/people", "people"],
  ["/admissions", "admissions"],
  ["/hiring", "hiring"],
  ["/scheduling", "scheduling"],
  ["/billing", "billing"],
  ["/payroll", "payroll"],
  ["/reports", "reports"],
  ["/incidents", "incidents"],
  ["/documents", "documents"],
  ["/sops", "sops"],
  ["/settings", "settings"],
  ["/brain/my-work", "my_work"],
  ["/brain", "brain"],
];

export function areaForPath(pathname: string): Area | null {
  if (pathname === "/") return "home";
  const hit = [...PATH_AREAS]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}

/** Where a session lands after sign-in: Home if allowed, else its first area. */
export function landingFor(role: UserRole): string {
  if (canView(role, "home")) return "/";
  const grant = grantsFor(role);
  if (grant === "all") return "/";
  const first = grant[0];
  return first === "audit" ? "/reports/audit" : first === "supervision" ? "/reports/supervision" : first === "my_work" ? "/brain/my-work" : `/${first}`;
}
