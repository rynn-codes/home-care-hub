import { CONSENTS, declineConsequences, type ConsentDecisions } from "@/domain/consents/registry";
import { addMonths, daysBetween, toDateOnly } from "@/domain/dates";

/**
 * The client record, assembled from what the admission produced.
 *
 * Admissions is the process; this is the record. §10 is explicit that becoming
 * a client does not create a second person — the existing people row gains a
 * client profile — so nothing here copies a name or a date of birth. It reads
 * the person and joins what the assessment and the signing session added.
 *
 * Shape follows the approved Clients mockup: a directory keyed on status,
 * payer and who is on the case, and a record with Profile / Activity /
 * Schedule / Docs / Services / Billing tabs.
 *
 * THE ONE ADDITION TO THE MOCKUP is the compliance clock. Three obligations in
 * the signing packet expire on their own, quietly, without anyone doing
 * anything wrong:
 *
 *   - Authorization to Disclose Medical Records (p12): "valid for one (1) year"
 *   - Authorization to Obtain & Release Records (p13): "expire ... twelve (12)
 *     months from the date of signature"
 *   - Annual supervision (p3): "all services will be supervised by Joy
 *     Healthcare Services, LLC annually"
 *
 * An agency that tracks what it signed but not when that signature stops being
 * good is out of compliance without ever being told. The mockup's Docs tab is
 * the right home for it — an authorization that expires is a document with a
 * date, not a new panel.
 */

export type ClientStatus = "active" | "on_hold" | "discharged";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  discharged: "Discharged",
};

export type ComplianceState = "ok" | "due_soon" | "overdue" | "missing";

export interface ComplianceItem {
  key: string;
  label: string;
  /** What expires, in the client's words rather than the packet's. */
  detail: string;
  state: ComplianceState;
  /** ISO date the obligation falls due. Null when nothing was ever signed. */
  dueOn: string | null;
  daysRemaining: number | null;
}

/** How far ahead a renewal starts asking for attention. */
export const DUE_SOON_DAYS = 60;

export interface ClientInput {
  personId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  location?: string | null;
  status?: ClientStatus;
  payer?: string | null;
  payerLine?: string | null;
  services?: string[];
  caregiver?: string | null;
  coordinator?: string | null;
  condition?: string | null;
  hoursPerWeek?: number | null;
  nextVisit?: string | null;
  lastActivity?: string | null;
  responsiblePartyName?: string | null;
  responsiblePartyLine?: string | null;
  /** Start of care. The clock on every annual obligation runs from here. */
  admissionDate?: string | null;
  /** When the consents packet was signed, if it was. */
  signedAt?: string | null;
  decisions?: ConsentDecisions;
}

export interface ClientRecord {
  personId: string;
  name: string;
  /** What the client is called, which is not always their legal first name. */
  preferredName: string;
  initials: string;
  age: number | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  location: string;
  status: ClientStatus;
  statusLabel: string;
  payer: string;
  payerLine: string | null;
  services: string[];
  caregiver: string | null;
  coordinator: string | null;
  condition: string | null;
  hoursPerWeek: number | null;
  nextVisit: string | null;
  lastActivity: string | null;
  responsiblePartyName: string | null;
  responsiblePartyLine: string | null;
  admissionDate: string | null;
  signedAt: string | null;
  decisions: ConsentDecisions;
  /** Refusals that change what a caregiver may do. */
  restrictions: string[];
  compliance: ComplianceItem[];
  /** Compliance items overdue or never signed — the directory badge. */
  needsAttention: ComplianceItem[];
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ageOn(dateOfBirth: string | null | undefined, today: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function expiryItem(
  key: string,
  label: string,
  detail: string,
  signedOn: string | null,
  months: number,
  today: string,
): ComplianceItem {
  const dueOn = signedOn ? addMonths(signedOn, months) : null;
  // An unparseable date is treated as nothing on file rather than throwing. A
  // client record must still render when one field is malformed.
  if (!dueOn) {
    return { key, label, detail, state: "missing", dueOn: null, daysRemaining: null };
  }
  const daysRemaining = daysBetween(today, dueOn);
  const state: ComplianceState =
    daysRemaining < 0 ? "overdue" : daysRemaining <= DUE_SOON_DAYS ? "due_soon" : "ok";
  return { key, label, detail, state, dueOn, daysRemaining };
}

/**
 * What is expiring on this client, and when.
 *
 * `today` is a parameter rather than a call to `new Date()` so the result is
 * testable and so a report can be run as of any date.
 */
export function clientCompliance(input: ClientInput, today: string): ComplianceItem[] {
  const signed = input.signedAt ? toDateOnly(input.signedAt) : null;
  const startOfCare = input.admissionDate ? toDateOnly(input.admissionDate) : signed;

  const items: ComplianceItem[] = [
    expiryItem(
      "disclose_records",
      "Authorization to disclose records",
      "Lets their doctors, hospitals and pharmacy send us records. Valid one year from signature.",
      signed,
      12,
      today,
    ),
    expiryItem(
      "release_records",
      "Authorization to obtain & release records",
      "Lets us send their records out. Expires twelve months from signature whether or not it is used.",
      signed,
      12,
      today,
    ),
    expiryItem(
      "annual_supervision",
      "Annual supervisory visit",
      "The agreement commits us to supervising services annually. Due a year from start of care.",
      startOfCare,
      12,
      today,
    ),
  ];

  // Only surface an authorization the client actually agreed to. A refused one
  // is a recorded decision, not an overdue task, and nagging about it would
  // pressure someone into going back for a different answer.
  return items.filter((item) => {
    if (item.key === "disclose_records") return input.decisions?.disclose_medical_records !== "decline";
    if (item.key === "release_records") return input.decisions?.obtain_release_medical_records !== "decline";
    return true;
  });
}

export function buildClientRecord(input: ClientInput, today: string): ClientRecord {
  const decisions = input.decisions ?? {};
  const name = `${input.firstName} ${input.lastName}`;
  const status = input.status ?? "active";
  // A discharged client's authorizations lapsing is not a task for anyone.
  const compliance = status === "discharged" ? [] : clientCompliance(input, today);

  return {
    personId: input.personId,
    name,
    preferredName: input.preferredName || input.firstName,
    initials: initialsOf(name),
    age: ageOn(input.dateOfBirth, today),
    dateOfBirth: input.dateOfBirth ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    location: input.location ?? "Houston",
    status,
    statusLabel: CLIENT_STATUS_LABELS[status],
    payer: input.payer ?? "Private Pay",
    payerLine: input.payerLine ?? null,
    services: input.services ?? [],
    caregiver: input.caregiver ?? null,
    coordinator: input.coordinator ?? null,
    condition: input.condition ?? null,
    hoursPerWeek: input.hoursPerWeek ?? null,
    nextVisit: input.nextVisit ?? null,
    lastActivity: input.lastActivity ?? null,
    responsiblePartyName: input.responsiblePartyName ?? null,
    responsiblePartyLine: input.responsiblePartyLine ?? null,
    admissionDate: input.admissionDate ?? null,
    signedAt: input.signedAt ?? null,
    decisions,
    restrictions: declineConsequences(decisions),
    compliance,
    needsAttention: compliance.filter((c) => c.state === "overdue" || c.state === "missing"),
  };
}

/** Consents this client refused or marked not applicable, for the Docs tab. */
export function refusedConsents(decisions: ConsentDecisions) {
  return CONSENTS.filter((c) => {
    const d = decisions[c.key];
    return d === "decline" || d === "not_applicable";
  });
}

/**
 * The directory, ordered so the clients who need something come first.
 *
 * Same principle as the admissions work queue in §8: sort by who holds the next
 * move, not alphabetically. An alphabetical directory hides the one person
 * whose records authorization lapsed last week behind twenty who are fine.
 */
export function sortRoster(clients: ClientRecord[]): ClientRecord[] {
  const rank = (c: ClientRecord) => {
    if (c.status === "discharged") return 3;
    if (c.needsAttention.length > 0) return 0;
    if (c.compliance.some((i) => i.state === "due_soon")) return 1;
    return 2;
  };
  return [...clients].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function searchRoster(clients: ClientRecord[], query: string): ClientRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) =>
    [c.name, c.preferredName, c.location, c.payer, c.caregiver ?? "", ...c.services]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
