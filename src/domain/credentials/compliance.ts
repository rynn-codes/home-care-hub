import type {
  CredentialRequirement,
  CredentialStatus,
  EmployeeCredential,
} from "@/domain/documents/types";

/**
 * The compliance and expiration engine.
 *
 * §27 is explicit that this is domain logic rather than UI maths, and that the
 * same readiness result feeds the employee profile, Operations, Home, Hiring,
 * the audit packet and scheduling eligibility. One rule engine, many views —
 * so none of them can quietly develop its own opinion about whether somebody
 * is compliant.
 *
 * This replaces the hard-coded requirements in domain/employees/credentials.ts.
 * §6 says requirements and their scheduling consequences must be configurable
 * to Joy policy and jurisdiction; a `switch` on role was exactly the thing that
 * warned against. Requirements arrive as data now, from the table in
 * migration 0005.
 *
 * Every function takes `asOf` rather than reading the clock, so results are
 * testable and a report can be run as of any date — an auditor asks what was
 * true in March.
 */

export interface EmployeeContext {
  employeeId: string;
  role: string;
  drives: boolean;
}

export interface RequirementOutcome {
  credentialType: string;
  displayName: string;
  status: CredentialStatus;
  expiresAt: string | null;
  daysRemaining: number | null;
  /** The warning point this crossed, from the requirement's own list. */
  warningThreshold: number | null;
  /** Whether this specific lapse stops the person being scheduled. */
  blocksScheduling: boolean;
  /** Present when somebody must do something. */
  action: string | null;
}

export interface AuditReadiness {
  employeeId: string;
  required: number;
  complete: number;
  missing: string[];
  expired: string[];
  expiring: string[];
  needsReview: string[];
  /** §27's headline: is this file ready to be handed to an auditor? */
  ready: boolean;
  outcomes: RequirementOutcome[];
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Whether a requirement applies to this person at all.
 *
 * Asking an office coordinator for a TB test, or a non-driver for auto
 * insurance, produces a permanently incomplete file — and a file that is
 * always red is one everybody learns to ignore.
 */
export function requirementApplies(
  requirement: CredentialRequirement,
  employee: EmployeeContext,
): boolean {
  if (!requirement.active) return false;
  if (requirement.requiredForDriving && !employee.drives) return false;
  const roles = requirement.requiredForRoles;
  if (roles && roles.length > 0 && !roles.includes(employee.role)) return false;
  return true;
}

/**
 * The highest warning point this credential has crossed.
 *
 * Returned rather than merely compared, because §13 wants notifications to be
 * idempotent: the caller records which threshold it has already told somebody
 * about, so 30 days does not fire again every morning until it becomes 29.
 */
export function warningThresholdCrossed(
  requirement: CredentialRequirement,
  daysRemaining: number,
): number | null {
  const points = [...requirement.warningDays].sort((a, b) => a - b);
  for (const point of points) {
    if (daysRemaining <= point) return point;
  }
  return null;
}

export function evaluateRequirement(
  requirement: CredentialRequirement,
  credential: EmployeeCredential | undefined,
  asOf: string,
): RequirementOutcome {
  const base = {
    credentialType: requirement.credentialType,
    displayName: requirement.displayName,
    blocksScheduling: false,
    warningThreshold: null as number | null,
  };

  if (!credential) {
    return {
      ...base,
      status: "missing",
      expiresAt: null,
      daysRemaining: null,
      blocksScheduling: requirement.blocksSchedulingWhenExpired,
      action: `${requirement.displayName} is not on file — request it`,
    };
  }

  // §10. Something extracted but not confirmed is not evidence of anything yet,
  // and must not be counted as compliant.
  if (requirement.verificationRequired && credential.verificationStatus !== "verified") {
    const rejected = credential.verificationStatus === "rejected";
    return {
      ...base,
      status: rejected ? "rejected" : "pending_review",
      expiresAt: credential.expiresAt ?? null,
      daysRemaining: null,
      blocksScheduling: rejected && requirement.blocksSchedulingWhenExpired,
      action: rejected
        ? `${requirement.displayName} was rejected — a replacement is needed`
        : `${requirement.displayName} needs verifying`,
    };
  }

  if (!requirement.expirationRequired) {
    return { ...base, status: "current", expiresAt: null, daysRemaining: null, action: null };
  }

  if (!credential.expiresAt) {
    return {
      ...base,
      status: "missing",
      expiresAt: null,
      daysRemaining: null,
      blocksScheduling: requirement.blocksSchedulingWhenExpired,
      action: `${requirement.displayName} has no expiry date on file`,
    };
  }

  const daysRemaining = daysBetween(asOf, credential.expiresAt);
  if (daysRemaining === null) {
    return {
      ...base,
      status: "missing",
      expiresAt: credential.expiresAt,
      daysRemaining: null,
      blocksScheduling: requirement.blocksSchedulingWhenExpired,
      action: `${requirement.displayName} has an unreadable expiry date`,
    };
  }

  if (daysRemaining < 0) {
    return {
      ...base,
      status: "expired",
      expiresAt: credential.expiresAt,
      daysRemaining,
      blocksScheduling: requirement.blocksSchedulingWhenExpired,
      action: requirement.blocksSchedulingWhenExpired
        ? `${requirement.displayName} has lapsed — take them off the schedule until it is renewed`
        : `${requirement.displayName} has lapsed`,
    };
  }

  const threshold = warningThresholdCrossed(requirement, daysRemaining);
  if (threshold !== null) {
    return {
      ...base,
      status: "expiring",
      expiresAt: credential.expiresAt,
      daysRemaining,
      warningThreshold: threshold,
      action: `${requirement.displayName} expires in ${daysRemaining} days — request renewal`,
    };
  }

  return {
    ...base,
    status: "current",
    expiresAt: credential.expiresAt,
    daysRemaining,
    action: null,
  };
}

/**
 * §27's readiness result, in the shape the spec gives.
 *
 * Used unchanged by every view that asks. `ready` is deliberately strict:
 * anything missing, expired, rejected or awaiting review means the file is not
 * ready to hand to an auditor, because each of those is a question somebody
 * will ask and nobody can currently answer.
 */
export function auditReadiness(
  employee: EmployeeContext,
  requirements: readonly CredentialRequirement[],
  credentials: readonly EmployeeCredential[],
  asOf: string,
): AuditReadiness {
  const applicable = requirements.filter((r) => requirementApplies(r, employee));
  const byType = new Map(credentials.map((c) => [c.credentialType, c]));

  const outcomes = applicable.map((r) => evaluateRequirement(r, byType.get(r.credentialType), asOf));

  const pick = (status: CredentialStatus) =>
    outcomes.filter((o) => o.status === status).map((o) => o.credentialType);

  const missing = pick("missing");
  const expired = [...pick("expired"), ...pick("rejected")];
  const expiring = pick("expiring");
  const needsReview = pick("pending_review");

  return {
    employeeId: employee.employeeId,
    required: applicable.length,
    complete: outcomes.filter((o) => o.status === "current" || o.status === "expiring").length,
    missing,
    expired,
    expiring,
    needsReview,
    ready: missing.length === 0 && expired.length === 0 && needsReview.length === 0,
    outcomes,
  };
}

/**
 * §12: Scheduling consumes eligibility, it does not decide it.
 *
 * Only requirements whose own configuration says they block scheduling can stop
 * an assignment. An expired handbook acknowledgement is a real gap in the file
 * and is not a reason to leave a client without a caregiver — which of the two
 * a given credential is, is Joy's policy to set, not this function's to assume.
 */
export interface SchedulingEligibility {
  eligible: boolean;
  blockedBy: RequirementOutcome[];
  /** Gaps worth knowing about that do not stop the shift. */
  advisories: RequirementOutcome[];
}

export function schedulingEligibility(readiness: AuditReadiness): SchedulingEligibility {
  const blockedBy = readiness.outcomes.filter((o) => o.blocksScheduling);
  const advisories = readiness.outcomes.filter(
    (o) => !o.blocksScheduling && o.status !== "current",
  );
  return { eligible: blockedBy.length === 0, blockedBy, advisories };
}

/**
 * The Needs You line for Home and Operations (§12).
 *
 * Names the person and the specific thing, because "3 compliance items" sends
 * somebody hunting and "Chanel P — CPR expires in 7 days" is already the answer.
 */
export function needsAttention(
  employeeName: string,
  readiness: AuditReadiness,
): Array<{ label: string; severity: "blocking" | "warning" }> {
  return readiness.outcomes
    .filter((o) => o.action !== null)
    .map((o) => ({
      label: `${employeeName} — ${o.action}`,
      severity: o.blocksScheduling ? ("blocking" as const) : ("warning" as const),
    }));
}

export type ComplianceVerdict = "current" | "expiring" | "incomplete" | "blocked";

export interface ComplianceSummary {
  verdict: ComplianceVerdict;
  /** One line for a directory row, naming the problem rather than counting. */
  summary: string;
}

/**
 * The directory line.
 *
 * "2 items need attention" sends somebody hunting; "CPR certification expires
 * in 44 days" is already the answer. Ordered by how bad it is, so the worst
 * thing is the thing that gets said.
 */
export function complianceSummary(readiness: AuditReadiness): ComplianceSummary {
  const named = (type: string) =>
    readiness.outcomes.find((o) => o.credentialType === type)?.displayName ?? type;

  if (readiness.expired.length > 0) {
    const rest = readiness.expired.length - 1;
    return {
      verdict: "blocked",
      summary: `${named(readiness.expired[0])} expired${rest > 0 ? ` · ${rest} more lapsed` : ""}`,
    };
  }
  if (readiness.missing.length > 0) {
    const rest = readiness.missing.length - 1;
    return {
      verdict: "incomplete",
      summary: `${named(readiness.missing[0])} outstanding${rest > 0 ? ` · ${rest} more missing` : ""}`,
    };
  }
  if (readiness.needsReview.length > 0) {
    return {
      verdict: "incomplete",
      summary: `${named(readiness.needsReview[0])} awaiting review`,
    };
  }
  if (readiness.expiring.length > 0) {
    const outcome = readiness.outcomes.find((o) => o.credentialType === readiness.expiring[0]);
    return {
      verdict: "expiring",
      summary: `${outcome?.displayName} expires in ${outcome?.daysRemaining} days`,
    };
  }
  return { verdict: "current", summary: `All ${readiness.required} items current` };
}

/**
 * Whether somebody may be given a shift at all.
 *
 * Employment status and compliance are different questions with the same
 * answer: on leave is not a compliance failure, and a lapsed TB test is not an
 * absence, but either one means do not send them.
 */
export function canWorkShifts(readiness: AuditReadiness, employmentStatus: string): boolean {
  if (employmentStatus !== "active") return false;
  return schedulingEligibility(readiness).eligible;
}

/**
 * Whether somebody may drive a client.
 *
 * The other half of the client's transport consent (packet p11). Both must
 * hold before anyone gets in a car.
 */
export function canDriveClients(readiness: AuditReadiness, drives: boolean): boolean {
  if (!drives) return false;
  return ["drivers_license", "auto_insurance"].every((type) => {
    const outcome = readiness.outcomes.find((o) => o.credentialType === type);
    return outcome?.status === "current" || outcome?.status === "expiring";
  });
}
