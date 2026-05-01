// Mock data for the home care dashboard prototype.
// Realistic enough to feel like a working app; in-memory only.

export type ID = string;

export type ClientStatus = "active" | "on-hold" | "discharged";
export type EmployeeStatus = "active" | "on-leave" | "inactive";
export type ShiftStatus = "scheduled" | "clocked-in" | "completed" | "missed" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type GoalStatus = "on-track" | "at-risk" | "off-track" | "done";

export interface Client {
  id: ID;
  name: string;
  status: ClientStatus;
  primaryCaregiverId?: ID;
  carePlan: string;
  hoursPerWeek: number;
  address: string;
  phone: string;
  email: string;
  dob: string;
  notes?: string;
}

export interface Employee {
  id: ID;
  name: string;
  role: "Caregiver" | "RN" | "LPN" | "Coordinator";
  status: EmployeeStatus;
  hoursThisWeek: number;
  email: string;
  phone: string;
  hireDate: string;
  credentials: { name: string; expires: string }[];
  assignedClientIds: ID[];
}

export interface Shift {
  id: ID;
  caregiverId: ID;
  clientId: ID;
  start: string; // ISO
  end: string;   // ISO
  status: ShiftStatus;
  notes?: string;
}

export interface Invoice {
  id: ID;
  number: string;
  clientId: ID;
  amount: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
}

export interface DocumentFile {
  id: ID;
  name: string;
  type: "pdf" | "docx" | "xlsx" | "image" | "other";
  folder: string;
  ownerId: ID;
  uploadedAt: string;
  size: number;
  permission: "everyone" | "admins" | "managers";
}

export interface Goal {
  id: ID;
  title: string;
  description: string;
  ownerId: ID;
  dueDate: string;
  status: GoalStatus;
  progress: number;
  milestones: { id: ID; title: string; done: boolean; due: string }[];
}

export interface SopVersion {
  version: number;
  updatedAt: string;
  updatedBy: ID;
  content: string;
}

export interface Sop {
  id: ID;
  title: string;
  category: string;
  ownerId: ID;
  updatedAt: string;
  versions: SopVersion[];
}

export interface ActivityItem {
  id: ID;
  kind: "client" | "shift" | "document" | "goal" | "sop";
  message: string;
  at: string;
}

export interface AlertItem {
  id: ID;
  severity: "warning" | "danger" | "info";
  title: string;
  detail: string;
  createdAt: string;
}

const uid = (() => { let i = 1; return () => `id_${i++}`; })();

const today = new Date();
const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const weekStart = new Date(dayStart);
weekStart.setDate(dayStart.getDate() - dayStart.getDay()); // Sunday

function iso(d: Date) { return d.toISOString(); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addHours(d: Date, n: number) { const x = new Date(d); x.setHours(x.getHours() + n); return x; }
function setTime(d: Date, h: number, m = 0) { const x = new Date(d); x.setHours(h, m, 0, 0); return x; }

const employees: Employee[] = [
  ["Maya Patel", "RN"], ["Jordan Lee", "Caregiver"], ["Sofia Ramirez", "Caregiver"],
  ["Daniel Kim", "Caregiver"], ["Aisha Bello", "LPN"], ["Liam O'Connor", "Caregiver"],
  ["Priya Singh", "Caregiver"], ["Marcus Chen", "Coordinator"], ["Elena Rossi", "Caregiver"],
  ["Noah Williams", "Caregiver"], ["Hana Suzuki", "RN"], ["Diego Martinez", "Caregiver"],
  ["Grace Olusanya", "LPN"], ["Tomás Herrera", "Caregiver"], ["Isabelle Dubois", "Caregiver"],
].map(([name, role], i) => ({
  id: uid(),
  name: name as string,
  role: role as Employee["role"],
  status: i === 4 ? "on-leave" : "active",
  hoursThisWeek: 18 + ((i * 7) % 24),
  email: (name as string).toLowerCase().replace(/[^a-z]+/g, ".") + "@homecare.co",
  phone: `555-01${(20 + i).toString().padStart(2, "0")}`,
  hireDate: iso(addDays(today, -300 - i * 40)),
  credentials: [
    { name: "CPR", expires: iso(addDays(today, 30 + ((i * 13) % 200) - 50)) },
    { name: "First Aid", expires: iso(addDays(today, 90 + ((i * 17) % 250))) },
  ],
  assignedClientIds: [],
}));

const clientNames = [
  "Eleanor Whitfield", "Harold Stein", "Margaret O'Hara", "Walter Nakamura",
  "Beatrice Coleman", "Frank Delgado", "Doris Kapoor", "Arthur Brennan",
  "Vivian Cho", "Stanley Park", "Ruth Abernathy", "George Mwangi",
  "Helen Petrov", "Samuel Greene", "Joyce Tanaka", "Edwin Foster",
  "Mildred Sanchez", "Roy Bauer", "Pearl Jackson", "Norman Wells",
  "Iris Thompson", "Clarence Fox", "Estelle Romano", "Henry Müller",
  "Nora Bryant",
];

const clients: Client[] = clientNames.map((name, i) => ({
  id: uid(),
  name,
  status: i % 11 === 0 ? "on-hold" : i % 17 === 0 ? "discharged" : "active",
  primaryCaregiverId: employees[i % employees.length].id,
  carePlan: ["Standard Care", "Memory Care", "Post-Op Recovery", "Companion Care", "Skilled Nursing"][i % 5],
  hoursPerWeek: 8 + ((i * 5) % 40),
  address: `${100 + i * 7} ${["Maple", "Oak", "Cedar", "Pine", "Birch"][i % 5]} St, Springfield`,
  phone: `555-02${(10 + i).toString().padStart(2, "0")}`,
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
  dob: iso(addDays(today, -365 * (65 + (i % 25)))),
  notes: "",
}));

// Assign clients to caregivers
clients.forEach((c) => {
  if (c.primaryCaregiverId) {
    const e = employees.find((x) => x.id === c.primaryCaregiverId);
    if (e) e.assignedClientIds.push(c.id);
  }
});

// Shifts: ~80 across the current week
const shifts: Shift[] = [];
for (let day = 0; day < 7; day++) {
  for (let s = 0; s < 12; s++) {
    const date = addDays(weekStart, day);
    const startHour = [7, 9, 11, 13, 15, 17][s % 6];
    const start = setTime(date, startHour);
    const end = addHours(start, 2 + (s % 3));
    const cg = employees[(day * 3 + s) % employees.length];
    const cl = clients[(day * 5 + s * 2) % clients.length];
    let status: ShiftStatus = "scheduled";
    if (date < dayStart) status = s % 9 === 0 ? "missed" : "completed";
    else if (date.getTime() === dayStart.getTime() && start < today) {
      status = today < end ? "clocked-in" : (s % 11 === 0 ? "missed" : "completed");
    }
    shifts.push({
      id: uid(),
      caregiverId: cg.id,
      clientId: cl.id,
      start: iso(start),
      end: iso(end),
      status,
    });
  }
}

const invoices: Invoice[] = clients.slice(0, 12).map((c, i) => ({
  id: uid(),
  number: `INV-${2025}-${(100 + i).toString().padStart(4, "0")}`,
  clientId: c.id,
  amount: 800 + ((i * 137) % 4000),
  status: (["paid", "sent", "draft", "overdue", "paid", "sent"] as InvoiceStatus[])[i % 6],
  periodStart: iso(addDays(today, -30)),
  periodEnd: iso(addDays(today, -1)),
  issuedAt: iso(addDays(today, -((i * 3) % 25))),
}));

const documents: DocumentFile[] = [
  ["Employee Handbook 2025.pdf", "Policies", "pdf"],
  ["HIPAA Compliance Guide.pdf", "Compliance", "pdf"],
  ["Onboarding Checklist.docx", "Onboarding", "docx"],
  ["W-2 Template.pdf", "HR", "pdf"],
  ["Care Plan Template.docx", "Templates", "docx"],
  ["Q1 Financials.xlsx", "Finance", "xlsx"],
  ["Brand Guidelines.pdf", "Marketing", "pdf"],
  ["Office Photo.jpg", "Marketing", "image"],
  ["Insurance Certificate.pdf", "Compliance", "pdf"],
  ["Caregiver Performance Reviews.xlsx", "HR", "xlsx"],
  ["Emergency Contact List.docx", "HR", "docx"],
  ["State License.pdf", "Compliance", "pdf"],
].map(([name, folder, type], i) => ({
  id: uid(),
  name: name as string,
  folder: folder as string,
  type: type as DocumentFile["type"],
  ownerId: employees[i % employees.length].id,
  uploadedAt: iso(addDays(today, -((i * 4) % 90))),
  size: 50_000 + i * 18_000,
  permission: (["everyone", "admins", "managers", "everyone"] as const)[i % 4],
}));

const goals: Goal[] = [
  ["Reach 100 active clients", 78],
  ["Reduce missed shifts by 50%", 62],
  ["Onboard 10 new caregivers in Q2", 40],
  ["Achieve 95% billing on time", 88],
  ["Launch caregiver mobile app", 25],
  ["Complete annual HIPAA training", 95],
  ["Reduce overtime by 20%", 55],
  ["Improve client NPS to 70", 45],
].map(([title, progress], i) => {
  const status: GoalStatus = progress >= 90 ? "done" : progress >= 60 ? "on-track" : progress >= 40 ? "at-risk" : "off-track";
  return {
    id: uid(),
    title: title as string,
    description: "Strategic goal aligned with quarterly objectives.",
    ownerId: employees[i % employees.length].id,
    dueDate: iso(addDays(today, 30 + i * 15)),
    status,
    progress: progress as number,
    milestones: [
      { id: uid(), title: "Define plan", done: true, due: iso(addDays(today, -20)) },
      { id: uid(), title: "Kick off with team", done: progress > 30, due: iso(addDays(today, -5)) },
      { id: uid(), title: "Mid-point review", done: progress > 60, due: iso(addDays(today, 15)) },
      { id: uid(), title: "Final delivery", done: progress >= 100, due: iso(addDays(today, 45)) },
    ],
  };
});

const sopCategories = ["Onboarding", "Care Procedures", "Compliance", "Emergency", "Billing", "HR"];
const sopTitles: [string, string][] = [
  ["New Caregiver Orientation", "Onboarding"],
  ["Client Intake Process", "Onboarding"],
  ["Hand Hygiene Protocol", "Care Procedures"],
  ["Medication Reminders", "Care Procedures"],
  ["Fall Prevention", "Care Procedures"],
  ["Wound Care Basics", "Care Procedures"],
  ["HIPAA Privacy Rules", "Compliance"],
  ["Background Check Procedure", "Compliance"],
  ["Incident Reporting", "Compliance"],
  ["Fire Emergency Response", "Emergency"],
  ["Medical Emergency Protocol", "Emergency"],
  ["Severe Weather Plan", "Emergency"],
  ["Invoice Generation", "Billing"],
  ["Insurance Claim Submission", "Billing"],
  ["Time Off Request Process", "HR"],
  ["Performance Review Cycle", "HR"],
  ["Disciplinary Process", "HR"],
  ["End of Shift Documentation", "Care Procedures"],
  ["Client Discharge Process", "Onboarding"],
  ["Caregiver Termination", "HR"],
];

const sops: Sop[] = sopTitles.map(([title, category], i) => ({
  id: uid(),
  title,
  category,
  ownerId: employees[i % employees.length].id,
  updatedAt: iso(addDays(today, -((i * 6) % 120))),
  versions: [
    {
      version: 1,
      updatedAt: iso(addDays(today, -((i * 6) % 120) - 30)),
      updatedBy: employees[i % employees.length].id,
      content: `<h2>Purpose</h2><p>This SOP outlines the standard procedure for ${title.toLowerCase()}.</p><h2>Scope</h2><p>Applies to all staff in the ${category} domain.</p><h2>Procedure</h2><ol><li>Identify the situation requiring action.</li><li>Follow company-approved checklist.</li><li>Document the action in the client record.</li><li>Notify supervisor if escalation is required.</li></ol><h2>References</h2><p>See related policies in the Documents section.</p>`,
    },
    {
      version: 2,
      updatedAt: iso(addDays(today, -((i * 6) % 120))),
      updatedBy: employees[(i + 1) % employees.length].id,
      content: `<h2>Purpose</h2><p>This SOP outlines the standard procedure for ${title.toLowerCase()}, updated for 2025 compliance.</p><h2>Scope</h2><p>Applies to all staff in the ${category} domain.</p><h2>Procedure</h2><ol><li>Identify the situation requiring action.</li><li>Follow the updated 2025 company-approved checklist.</li><li>Document the action in the client record within 24 hours.</li><li>Notify supervisor and on-call manager if escalation is required.</li></ol><h2>References</h2><p>See related policies in the Documents section and the Compliance handbook.</p>`,
    },
  ],
}));

const activity: ActivityItem[] = [
  { id: uid(), kind: "client", message: "New client Eleanor Whitfield admitted", at: iso(addHours(today, -1)) },
  { id: uid(), kind: "shift", message: "Jordan Lee completed shift with Harold Stein", at: iso(addHours(today, -2)) },
  { id: uid(), kind: "document", message: "Maya Patel uploaded Care Plan Template.docx", at: iso(addHours(today, -4)) },
  { id: uid(), kind: "goal", message: "Goal 'Reduce overtime by 20%' updated to 55%", at: iso(addHours(today, -7)) },
  { id: uid(), kind: "sop", message: "SOP 'Fall Prevention' was revised", at: iso(addHours(today, -10)) },
  { id: uid(), kind: "shift", message: "Sofia Ramirez clocked in for Margaret O'Hara", at: iso(addHours(today, -12)) },
  { id: uid(), kind: "client", message: "Doris Kapoor moved to On Hold", at: iso(addHours(today, -20)) },
];

const alerts: AlertItem[] = [
  { id: uid(), severity: "danger", title: "Missed clock-in", detail: "Liam O'Connor missed 9:00 AM shift with Walter Nakamura", createdAt: iso(addHours(today, -1)) },
  { id: uid(), severity: "warning", title: "Credential expiring", detail: "Aisha Bello's CPR cert expires in 12 days", createdAt: iso(addHours(today, -3)) },
  { id: uid(), severity: "warning", title: "Unassigned shift", detail: "Tomorrow 2:00 PM — Beatrice Coleman has no caregiver", createdAt: iso(addHours(today, -5)) },
  { id: uid(), severity: "info", title: "Care plan renewal", detail: "Frank Delgado's care plan expires in 7 days", createdAt: iso(addHours(today, -8)) },
  { id: uid(), severity: "warning", title: "Overtime risk", detail: "Maya Patel will exceed 40h this week", createdAt: iso(addHours(today, -12)) },
];

export const mockDB = {
  clients,
  employees,
  shifts,
  invoices,
  documents,
  goals,
  sops,
  activity,
  alerts,
};

export type MockDB = typeof mockDB;
