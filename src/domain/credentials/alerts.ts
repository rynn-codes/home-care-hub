import { auditReadiness, needsAttention, type EmployeeContext } from "@/domain/credentials/compliance";
import { credentialsFromRecords, type SeedCredentialRecord } from "@/domain/credentials/fromSeed";
import type { CredentialRequirement } from "@/domain/documents/types";

/**
 * Compliance alerts across the whole workforce.
 *
 * §12: confirmed credential data must not remain trapped in the employee
 * profile. Home and Operations both ask this question, and §27 requires one
 * rule engine feeding every view — so this composes `auditReadiness` rather
 * than re-deriving anything, and any screen showing a different answer would be
 * a bug rather than a difference of opinion.
 *
 * Ordered by consequence: a lapse that stops somebody working outranks one that
 * merely needs chasing, and within each the soonest deadline comes first. An
 * alphabetical list of alerts is a list nobody triages.
 */

export interface WorkforceMember {
  id: string;
  name: string;
  role: string;
  drives: boolean;
  status: string;
  records: Record<string, SeedCredentialRecord | undefined>;
}

export interface ComplianceAlert {
  employeeId: string;
  employeeName: string;
  credentialType: string;
  /** Said the way it would be said out loud: person, then the thing. */
  label: string;
  severity: "blocking" | "warning";
  /** Null when nothing is on file to have a deadline. */
  dueOn: string | null;
  daysRemaining: number | null;
}

export function complianceAlerts(
  workforce: readonly WorkforceMember[],
  requirements: readonly CredentialRequirement[],
  asOf: string,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  for (const member of workforce) {
    // Somebody who has left is not a compliance problem. Chasing a lapsed CPR
    // for an inactive employee is noise that buries the live ones.
    if (member.status === "inactive") continue;

    const context: EmployeeContext = {
      employeeId: member.id,
      role: member.role,
      drives: member.drives,
    };
    const readiness = auditReadiness(
      context,
      requirements,
      credentialsFromRecords(member.id, member.records),
      asOf,
    );

    const lines = needsAttention(member.name, readiness);
    let i = 0;
    for (const outcome of readiness.outcomes) {
      if (outcome.action === null) continue;
      const line = lines[i];
      i += 1;
      alerts.push({
        employeeId: member.id,
        employeeName: member.name,
        credentialType: outcome.credentialType,
        label: line?.label ?? `${member.name} — ${outcome.action}`,
        severity: outcome.blocksScheduling ? "blocking" : "warning",
        dueOn: outcome.expiresAt,
        daysRemaining: outcome.daysRemaining,
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "blocking" ? -1 : 1;
    const left = a.daysRemaining ?? Number.NEGATIVE_INFINITY;
    const right = b.daysRemaining ?? Number.NEGATIVE_INFINITY;
    if (left !== right) return left - right;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

/** A one-line summary for a panel header. */
export function alertSummary(alerts: readonly ComplianceAlert[]): string {
  const blocking = alerts.filter((a) => a.severity === "blocking").length;
  if (alerts.length === 0) return "Everything is current";
  if (blocking === 0) {
    return `${alerts.length} ${alerts.length === 1 ? "item needs" : "items need"} chasing`;
  }
  return `${blocking} ${blocking === 1 ? "person cannot" : "people cannot"} be scheduled`;
}
