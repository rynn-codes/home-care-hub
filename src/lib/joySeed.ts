/**
 * Deterministic demo seed for the Home screen.
 *
 * STAFF NAMES ARE REAL — Joy Health's own team, supplied by the owner, so the
 * prototype reads like their agency.
 *
 * CLIENT NAMES ARE FICTIONAL, and must stay that way. The fact that a named
 * person receives home care is itself health information, and this file is
 * committed to git and written to localStorage. Section 32 specifies fictional
 * seed data; the client situations here follow it.
 *
 * This is demo seed, not production data. Section 32 is explicit that seed data
 * must never be mixed into production migrations. Every panel that reads from
 * here is a placeholder for a real domain query, and section 25 requires those
 * queries to hit the real domain once Sprint 0 lands — no dashboard-specific
 * tables are to be created to back these numbers.
 */

/**
 * The priority strip, restored to all six items.
 *
 * Dashboard v3 shipped only four of these, and only on the mobile frame. The
 * full set appears in v2 and in the Dashboard Revision Request.
 */
export interface AgendaEntry {
  id: string;
  time: string;
  client: string;
  service: string;
  assignee: string;
  note?: string;
  state: "in-progress" | "scheduled" | "unassigned";
}

export const todaysAgenda: AgendaEntry[] = [
  { id: "a1", time: "8:00 AM", client: "Lian Huang", service: "Personal Care", assignee: "Chanel P.", note: "clocked in 7:56 AM", state: "in-progress" },
  { id: "a2", time: "10:30 AM", client: "Marcus Bell", service: "Initial Assessment", assignee: "Kelsey Westley, RN", state: "scheduled" },
  { id: "a3", time: "12:00 PM", client: "Ruth Alvarez", service: "Companion Care", assignee: "Unassigned", note: "3 caregivers available", state: "unassigned" },
  { id: "a4", time: "2:00 PM", client: "Brandon", service: "Field Orientation", assignee: "Shadowing Chanel P.", state: "scheduled" },
  { id: "a5", time: "4:00 PM", client: "Edward Pham", service: "Live-In", assignee: "Vanessa", state: "scheduled" },
  { id: "a6", time: "6:30 PM", client: "Dolores Vance", service: "Evening Care", assignee: "Thylia", state: "scheduled" },
];

export interface CountRow {
  label: string;
  value: string;
  note?: string;
  to: string;
}

/**
 * Admissions stages, named per section 10. "New Referrals", not "New Leads" —
 * the Admissions mockup used sales vocabulary that the schema does not share.
 */
export const admissionsSummary: CountRow[] = [
  { label: "New Referrals", value: "6", to: "/admissions" },
  { label: "Phone Intakes", value: "4", note: "1 overdue", to: "/admissions" },
  { label: "Assessments Scheduled", value: "3", to: "/admissions" },
  { label: "Pre-Onboarding", value: "5", note: "docs pending", to: "/admissions" },
  { label: "Ready for Admission", value: "2", to: "/admissions" },
];

export const employeeTasks: CountRow[] = [
  { label: "Orientation", value: "3", to: "/operations/hiring" },
  { label: "Field Orientation", value: "2", to: "/operations/hiring" },
  { label: "Week One Follow-Ups", value: "4", to: "/operations/hiring" },
  { label: "Supervisor Visits", value: "5", note: "2 overdue", to: "/scheduling" },
  { label: "Annual Reviews", value: "2", to: "/employees" },
];

export interface ComplianceRow {
  label: string;
  status: string;
  state: "expired" | "due" | "current" | "pending";
}

export const compliance: ComplianceRow[] = [
  { label: "CPR Certification", status: "1 expired · 2 due", state: "expired" },
  { label: "TB Screening", status: "2 due Aug 14", state: "due" },
  { label: "Auto Insurance", status: "All current", state: "current" },
  { label: "Background Checks", status: "1 pending · Brandon", state: "pending" },
];

export interface ActivityEntry {
  id: string;
  actor: string;
  message: string;
  at: string;
}

export const recentActivity: ActivityEntry[] = [
  { id: "r1", actor: "John Segura", message: "Care plan signed for Lian Huang", at: "9:41 AM" },
  { id: "r2", actor: "Brandon", message: "Completed Gusto onboarding", at: "8:52 AM" },
  { id: "r3", actor: "Mercy Discharge Planning", message: "Referral received for R. Alvarez", at: "8:15 AM" },
  { id: "r4", actor: "Vanessa", message: "Released 12:00 PM shift to the open board", at: "7:38 AM" },
];

export interface Deadline {
  date: string;
  label: string;
  inDays: string;
}

export const upcomingDeadlines: Deadline[] = [
  { date: "Aug 10", label: "Payroll and invoicing", inDays: "in 3 days" },
  { date: "Aug 13", label: "Latest Gusto submission", inDays: "in 6 days" },
  { date: "Aug 14", label: "Payday", inDays: "in 7 days" },
  { date: "Aug 18", label: "Office orientation", inDays: "in 11 days" },
];

export interface JoyInsight {
  id: string;
  message: string;
  action: string;
}

/**
 * Joy proposes; a human decides. Every insight ends in an action the user takes,
 * never one Joy has already taken — section 26 puts scheduling and intake at
 * "propose change" and "draft only" authority.
 */
export const joyInsights: JoyInsight[] = [
  { id: "j1", message: "Ruth Alvarez's 12:00 PM shift matches 3 available caregivers by proximity and skills.", action: "Review matches" },
  { id: "j2", message: "All 4 billing exceptions share one cause: missing clock-out. Corrections drafted.", action: "View drafts" },
  { id: "j3", message: "Marcus Bell's intake is missing a medication list before the 10:30 assessment.", action: "Send request" },
];

/** Rotates daily so the greeting stays warm without becoming noise. */
export const motivationalLines = [
  "Small, thoughtful actions create exceptional care.",
  "The details you catch today are the trust you keep tomorrow.",
  "Good care is mostly good preparation.",
  "Every record you keep straight is a family that sleeps easier.",
  "Steady beats fast. Steady is also faster.",
];
