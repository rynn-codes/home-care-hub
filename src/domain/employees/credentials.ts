/**
 * Employee role and status vocabulary.
 *
 * WHAT USED TO BE HERE: a hard-coded set of credential requirements, decided by
 * a switch on role, plus its own expiry maths. §6 of the documents spec is
 * explicit that requirements and their scheduling consequences must be
 * configurable to Joy policy and jurisdiction, and a switch statement is exactly
 * what that forbids. That logic now lives in domain/credentials/compliance.ts
 * and reads requirements as data; this file keeps only the words.
 *
 * Two engines deciding whether somebody is compliant is worse than either one,
 * so the old one is gone rather than deprecated.
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

/** A document on file, as the prototype seed and the hiring flow record it. */
export interface CredentialRecord {
  issued?: string | null;
  expires?: string | null;
}
