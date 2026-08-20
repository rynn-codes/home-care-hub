import { auditReadiness, schedulingEligibility } from "@/domain/credentials/compliance";
import type { EmployeeStatus } from "@/domain/employees/credentials";
import type { CredentialRequirement, EmployeeCredential } from "@/domain/documents/types";
import {
  OVERTIME_THRESHOLD_HOURS,
  findConflicts,
  hoursOf,
  type Visit,
} from "@/domain/scheduling/conflicts";

/**
 * Whether a particular caregiver can take a particular shift.
 *
 * This is where the rules built elsewhere finally meet. Until now the
 * credential clock and the client's transport consent were each true in their
 * own module and enforced nowhere: assignment is the moment both actually bite,
 * because it is the moment a named person is sent to a named client's house.
 *
 * Four sources feed one answer:
 *
 *   1. The schedule    — double-booking, and the 40-hour overtime threshold.
 *   2. Credentials     — §28 and the Employees module. Expired stops the shift.
 *   3. Transport       — the client's consent (packet p11) AND the caregiver's
 *                        licence and insurance. Both must hold.
 *   4. Employment      — on leave or onboarding is not available.
 *
 * The distinction that matters throughout is blocking versus warning. Overtime
 * costs money and a scheduler may knowingly accept it. An expired TB test is
 * not a cost, it is a person who must not enter a client's home, and no amount
 * of accepting makes it fine.
 */

export type AssignmentIssueKind =
  | "not_employed"
  | "credential_blocked"
  | "credential_expires_before_shift"
  | "double_booked"
  | "client_double_booked"
  | "overtime"
  | "cannot_drive"
  | "client_declined_transport";

export interface AssignmentIssue {
  kind: AssignmentIssueKind;
  message: string;
  severity: "blocking" | "warning";
}

export interface Candidate {
  employeeId: string;
  name: string;
  role: string;
  drives: boolean;
  status: EmployeeStatus;
  /** Credentials as the compliance engine reads them. */
  credentials: EmployeeCredential[];
  /** Hours already scheduled this week, before this shift. */
  weeklyHours: number;
}

export interface AssignmentContext {
  /** Policy, read as data. §6 — never a switch on role. */
  requirements: readonly CredentialRequirement[];
  visit: Visit;
  /** Everything already on the schedule, including other caregivers' work. */
  existing: readonly Visit[];
  today: string;
  /** True when the plan of care has this visit including transport or escort. */
  requiresDriving?: boolean;
  /**
   * Whether the client agreed to the non-medical transport consent. Undefined
   * means nobody has asked yet, which is not the same as a refusal.
   */
  clientAgreedToTransport?: boolean;
}

export interface AssignmentAssessment {
  employeeId: string;
  name: string;
  issues: AssignmentIssue[];
  blocking: AssignmentIssue[];
  warnings: AssignmentIssue[];
  canAssign: boolean;
  /** Hours this shift would take them to, for the overtime warning. */
  projectedWeeklyHours: number;
}

/** The shift's own date, which is what credentials must still be valid on. */
function shiftDate(visit: Visit): string {
  return visit.startsAt.slice(0, 10);
}

export function assessAssignment(candidate: Candidate, ctx: AssignmentContext): AssignmentAssessment {
  const issues: AssignmentIssue[] = [];
  const context = { employeeId: candidate.employeeId, role: candidate.role, drives: candidate.drives };

  // --- 4. Employment status -------------------------------------------------
  if (candidate.status !== "active") {
    issues.push({
      kind: "not_employed",
      message:
        candidate.status === "on_leave"
          ? `${candidate.name} is on leave`
          : candidate.status === "onboarding"
            ? `${candidate.name} is still onboarding and not yet on cases`
            : `${candidate.name} is not an active employee`,
      severity: "blocking",
    });
  }

  // --- 2. Credentials -------------------------------------------------------
  // §12: Scheduling consumes eligibility, it does not decide it. Which
  // credentials block is the requirement's own configuration to state.
  const today = auditReadiness(context, ctx.requirements, candidate.credentials, ctx.today);
  const eligibility = schedulingEligibility(today);
  for (const item of eligibility.blockedBy) {
    issues.push({
      kind: "credential_blocked",
      message: `${item.displayName} is ${item.status === "expired" ? "expired" : item.status === "rejected" ? "rejected" : "outstanding"}`,
      severity: "blocking",
    });
  }

  // A credential valid today but expired by the shift date is the one a human
  // scheduler misses: the record looks green when they book it, and the person
  // is uncovered on the day.
  const onTheDay = auditReadiness(context, ctx.requirements, candidate.credentials, shiftDate(ctx.visit));
  for (const item of schedulingEligibility(onTheDay).blockedBy) {
    const alreadyFlagged = eligibility.blockedBy.some((b) => b.credentialType === item.credentialType);
    if (alreadyFlagged) continue;
    if (item.status === "expired") {
      issues.push({
        kind: "credential_expires_before_shift",
        message: `${item.displayName} expires on ${item.expiresAt}, before this shift`,
        severity: "blocking",
      });
    }
  }

  // --- 1. The schedule ------------------------------------------------------
  const proposed: Visit = { ...ctx.visit, caregiverName: candidate.name };
  for (const conflict of findConflicts(proposed, ctx.existing)) {
    if (conflict.kind === "caregiver_double_booked") {
      issues.push({ kind: "double_booked", message: conflict.message, severity: "blocking" });
    } else if (conflict.kind === "client_double_booked") {
      issues.push({ kind: "client_double_booked", message: conflict.message, severity: "blocking" });
    }
  }

  const projectedWeeklyHours = candidate.weeklyHours + hoursOf(ctx.visit);
  if (projectedWeeklyHours > OVERTIME_THRESHOLD_HOURS) {
    const over = projectedWeeklyHours - OVERTIME_THRESHOLD_HOURS;
    issues.push({
      kind: "overtime",
      // A cost, not a refusal. The scheduler may know exactly what they are doing.
      message: `Takes ${candidate.name} to ${projectedWeeklyHours} hours — ${over} over the threshold, billed at time and a half`,
      severity: "warning",
    });
  }

  // --- 3. Transport ---------------------------------------------------------
  if (ctx.requiresDriving) {
    if (ctx.clientAgreedToTransport === false) {
      issues.push({
        kind: "client_declined_transport",
        message: `${ctx.visit.clientName} declined the transport consent — nobody may drive them`,
        severity: "blocking",
      });
    }
    if (!candidate.drives) {
      issues.push({
        kind: "cannot_drive",
        message: `${candidate.name} does not drive`,
        severity: "blocking",
      });
    } else {
      const driving = onTheDay.outcomes.filter((i) =>
        ["drivers_license", "auto_insurance"].includes(i.credentialType),
      );
      for (const item of driving) {
        if (item.status !== "current" && item.status !== "expiring") {
          issues.push({
            kind: "cannot_drive",
            message: `${candidate.name}'s ${item.displayName.toLowerCase()} is not current`,
            severity: "blocking",
          });
        }
      }
    }
  }

  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    employeeId: candidate.employeeId,
    name: candidate.name,
    issues,
    blocking,
    warnings,
    canAssign: blocking.length === 0,
    projectedWeeklyHours,
  };
}

/**
 * Everyone who could take this shift, best first.
 *
 * Ordered by whether they can take it at all, then by how much slack they have
 * before overtime — spreading hours rather than pushing the same person over
 * forty every week. People who cannot take it stay in the list with the reason
 * attached, because "why isn't Heather offered?" is a question the screen
 * should answer rather than provoke.
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  ctx: AssignmentContext,
): AssignmentAssessment[] {
  return candidates
    .map((c) => ({ candidate: c, assessment: assessAssignment(c, ctx) }))
    .sort((a, b) => {
      if (a.assessment.canAssign !== b.assessment.canAssign) return a.assessment.canAssign ? -1 : 1;
      if (a.assessment.warnings.length !== b.assessment.warnings.length) {
        return a.assessment.warnings.length - b.assessment.warnings.length;
      }
      if (a.assessment.projectedWeeklyHours !== b.assessment.projectedWeeklyHours) {
        return a.assessment.projectedWeeklyHours - b.assessment.projectedWeeklyHours;
      }
      return a.candidate.name.localeCompare(b.candidate.name);
    })
    .map((x) => x.assessment);
}
