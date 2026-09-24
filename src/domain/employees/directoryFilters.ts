import type { ComplianceSummary } from "@/domain/credentials/compliance";

/**
 * The directory's compliance filter collapses four verdicts into three
 * buckets the office thinks in: who needs attention now, who is about to,
 * and who is fine.
 */
export type ComplianceFilter = "attention" | "expiring" | "current";

export const COMPLIANCE_FILTER_LABELS: Record<ComplianceFilter, string> = {
  attention: "Needs attention",
  expiring: "Expiring soon",
  current: "Current",
};

export function complianceBucket(verdict: ComplianceSummary["verdict"]): ComplianceFilter {
  if (verdict === "blocked" || verdict === "incomplete") return "attention";
  if (verdict === "expiring") return "expiring";
  return "current";
}
