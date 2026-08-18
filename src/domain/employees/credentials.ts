/**
 * Employee credentials and what happens when they lapse.
 *
 * An agency's real exposure is not a missing form — it is a caregiver who went
 * out on a shift with an expired TB test or a lapsed CPR card. Nobody did
 * anything wrong; a date passed. So this works the same way the client
 * compliance clock does: requirements are derived, expiry is computed, and the
 * directory sorts by who needs attention rather than alphabetically.
 *
 * Requirements are role-dependent, following the approved Employees mockup:
 * office staff carry the background check and the handbook and nothing
 * clinical; a caregiver who does not drive is not asked for a licence or auto
 * insurance, and must not be given transport work.
 *
 * The driving rule is the one that reaches across modules. A client who
 * declined the transport consent must not be driven; a caregiver who does not
 * drive, or whose insurance has lapsed, cannot be the one driving. Both facts
 * have to reach scheduling or the rule is decorative.
 */

export type EmployeeRole = "cna" | "hha" | "lvn" | "office";

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  cna: "CNA",
  hha: "HHA",
  lvn: "LVN",
  office: "Office",
};

export type EmployeeStatus = "active" | "onboarding" | "on_leave" | "inactive";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  onboarding: "Onboarding",
  on_leave: "On leave",
  inactive: "Inactive",
};

/** Same vocabulary as the client compliance clock, deliberately. */
export type CredentialState = "current" | "expiring" | "expired" | "missing" | "not_applicable";

export interface CredentialRequirement {
  key: string;
  label: string;
  /** Annual items renew every year; the rest carry their own expiry. */
  cadence: "annual" | "dated" | "one_off";
}

export interface CredentialRecord {
  /** ISO date, or null when nothing has been supplied. */
  issued?: string | null;
  expires?: string | null;
}

export interface CredentialStatus extends CredentialRequirement {
  state: CredentialState;
  issued: string | null;
  expires: string | null;
  daysRemaining: number | null;
  /** What the office should do about it, when there is something to do. */
  action: string | null;
}

/** Warning window before a credential lapses. Matches the client clock. */
export const EXPIRING_SOON_DAYS = 60;

const BASE: CredentialRequirement[] = [
  { key: "background_check", label: "Background check", cadence: "dated" },
  { key: "handbook", label: "Employee handbook", cadence: "annual" },
];

const FIELD: CredentialRequirement[] = [
  { key: "cpr", label: "CPR certification", cadence: "dated" },
  { key: "tb_test", label: "TB test", cadence: "annual" },
  { key: "immunizations", label: "Immunizations", cadence: "annual" },
  { key: "annual_training", label: "Annual training", cadence: "annual" },
];

const DRIVING: CredentialRequirement[] = [
  { key: "drivers_license", label: "Driver's licence", cadence: "dated" },
  { key: "auto_insurance", label: "Auto insurance", cadence: "dated" },
];

const LICENCE: Record<Exclude<EmployeeRole, "office">, CredentialRequirement> = {
  cna: { key: "licence", label: "CNA licence", cadence: "dated" },
  hha: { key: "licence", label: "HHA certificate", cadence: "dated" },
  lvn: { key: "licence", label: "LVN licence", cadence: "dated" },
};

/**
 * What this person must hold, given their role and whether they drive.
 *
 * Asking an office coordinator for a TB test, or a non-driver for auto
 * insurance, produces a permanently red record that everyone learns to ignore —
 * which is worse than not tracking it.
 */
export function requiredCredentials(role: EmployeeRole, drives: boolean): CredentialRequirement[] {
  const out = [...BASE];
  if (role !== "office") {
    out.push(LICENCE[role], ...FIELD);
  }
  if (drives) out.push(...DRIVING);
  return out;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms =
    new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime() -
    new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function stateFor(expires: string | null, today: string): { state: CredentialState; days: number | null } {
  if (!expires) return { state: "missing", days: null };
  const parsed = new Date(`${expires.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { state: "missing", days: null };

  const days = daysBetween(today, expires);
  if (days < 0) return { state: "expired", days };
  if (days <= EXPIRING_SOON_DAYS) return { state: "expiring", days };
  return { state: "current", days };
}

export interface EmployeeCredentialInput {
  role: EmployeeRole;
  drives: boolean;
  records: Record<string, CredentialRecord | undefined>;
}

/**
 * Every credential this person needs, with its state as of `today`.
 *
 * `today` is a parameter rather than a call to `new Date()`, so this is testable
 * and a report can be run as of any date.
 */
export function credentialStatuses(input: EmployeeCredentialInput, today: string): CredentialStatus[] {
  return requiredCredentials(input.role, input.drives).map((req) => {
    const record = input.records[req.key];
    const { state, days } = stateFor(record?.expires ?? null, today);

    const action =
      state === "missing"
        ? `Request ${req.label.toLowerCase()}`
        : state === "expired"
          ? `${req.label} has lapsed — take them off the schedule until it is renewed`
          : state === "expiring"
            ? "Request renewal"
            : null;

    return {
      ...req,
      state,
      issued: record?.issued ?? null,
      expires: record?.expires ?? null,
      daysRemaining: days,
      action,
    };
  });
}

export type ComplianceVerdict = "current" | "expiring" | "incomplete" | "blocked";

export interface EmployeeCompliance {
  verdict: ComplianceVerdict;
  /** One line for the directory row, naming the problem rather than counting it. */
  summary: string;
  items: CredentialStatus[];
  /** Anything expired or missing. These stop the person working. */
  blocking: CredentialStatus[];
  expiring: CredentialStatus[];
}

export function employeeCompliance(
  input: EmployeeCredentialInput,
  today: string,
): EmployeeCompliance {
  const items = credentialStatuses(input, today);
  const expired = items.filter((i) => i.state === "expired");
  const missing = items.filter((i) => i.state === "missing");
  const expiring = items.filter((i) => i.state === "expiring");
  const blocking = [...expired, ...missing];

  const verdict: ComplianceVerdict =
    expired.length > 0 ? "blocked" : missing.length > 0 ? "incomplete" : expiring.length > 0 ? "expiring" : "current";

  // Naming the item beats counting them. "2 items need attention" sends someone
  // hunting; "CPR expired 12 Aug" is already the answer.
  const summary =
    expired.length > 0
      ? `${expired[0].label} expired${expired.length > 1 ? ` · ${expired.length - 1} more lapsed` : ""}`
      : missing.length > 0
        ? `${missing[0].label} outstanding${missing.length > 1 ? ` · ${missing.length - 1} more missing` : ""}`
        : expiring.length > 0
          ? `${expiring[0].label} expires in ${expiring[0].daysRemaining} days`
          : `All ${items.length} items current`;

  return { verdict, summary, items, blocking, expiring };
}

/**
 * Whether this person may be sent out on a shift at all.
 *
 * An expired credential is not paperwork — it is an insurance and licensing
 * problem the moment they walk into a client's home.
 */
export function canWorkShifts(compliance: EmployeeCompliance, status: EmployeeStatus): boolean {
  if (status !== "active") return false;
  return compliance.blocking.length === 0;
}

/**
 * Whether this person may drive a client.
 *
 * Needs the intent (they drive), the licence and the insurance. The client's
 * own transport consent is the other half of this, and lives in the consent
 * registry — both have to be true before anyone gets in a car.
 */
export function canDriveClients(input: EmployeeCredentialInput, today: string): boolean {
  if (!input.drives) return false;
  const items = credentialStatuses(input, today);
  return ["drivers_license", "auto_insurance"].every(
    (key) => items.find((i) => i.key === key)?.state === "current",
  );
}
