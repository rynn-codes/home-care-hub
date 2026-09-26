/**
 * Who may see which area of Joy, and who may change anything.
 *
 * Karynn, 30 August, the week of a survey: "I want to have a role for
 * auditor. Where they can have access but can only see certain things."
 * And 26 September: "Add the bookkeeper as a role that only sees Reports
 * and Billing."
 *
 * ── Deny by default, for the roles that are narrowed ─────────────────────
 *
 * Every staff role is granted `"all"` — their access is unchanged, because a
 * permissions layer that narrows the owner on the day it ships gets switched
 * off. The auditor and the bookkeeper get allowlists. A screen added next
 * month is invisible to them until somebody adds it here on purpose. Never
 * invert this to a blocklist.
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

const GRANTS: Record<UserRole, "all" | readonly Area[]> = {
  ceo_admin: "all",
  intake_coordinator: "all",
  rn_clinical: "all",
  scheduler: "all",
  payroll: "all",
  billing: "all",
  hr: "all",
  employee: "all",
  client_contact: "all",
  auditor: AUDITOR_AREAS,
  bookkeeper: BOOKKEEPER_AREAS,
};

export function canView(role: UserRole, area: Area): boolean {
  const grant = GRANTS[role];
  return grant === "all" || grant.includes(area);
}

export function grantsFor(role: UserRole): "all" | readonly Area[] {
  return GRANTS[role];
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
  return first === "audit" ? "/reports/audit" : `/${first}`;
}
