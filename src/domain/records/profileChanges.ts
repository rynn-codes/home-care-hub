import type { EmployeeProfile } from "@/domain/employees/profile";

/**
 * A change to somebody's profile that can still be taken back.
 *
 * Karynn, 29 September: "Can we also have a settings feature that allows
 * changed info to client or employee profile to stay for 72 hours in case we
 * need to undo a change. We still would keep an audited trail of info changed."
 *
 * ── Two records, not one ─────────────────────────────────────────────────
 *
 * The audit trail already says WHAT changed and WHO changed it, and it is
 * permanent — undoing a change writes another audit line rather than erasing
 * the first. This module is the other half: it keeps the record AS IT WAS,
 * long enough for a mistake to be noticed, so the undo can put it back
 * exactly instead of somebody retyping from memory.
 *
 * ── Only the latest change to a record can be undone ─────────────────────
 *
 * If Pamela's status was changed on Monday and her phone on Tuesday, undoing
 * Monday's change would also wipe Tuesday's, because "as it was" on Monday
 * had the old phone number too. So a record's earlier changes are shown as
 * superseded and only the newest offers Undo. Undo the newest and the one
 * before it becomes the newest, so a run of mistakes can still be unwound in
 * order — which is the order anybody would want.
 *
 * ── The window is a setting ───────────────────────────────────────────────
 *
 * Seventy-two hours is Karynn's number and the default. It lives in agency
 * settings, because how long a mistake takes to surface is something the
 * office learns, not something a source file knows. Changes past the window
 * are dropped from this list on the next read; the audit trail keeps them.
 */

export const DEFAULT_PROFILE_UNDO_HOURS = 72;

export type ProfileChangeKind = "employee" | "client";

export interface ProfileChange {
  id: string;
  kind: ProfileChangeKind;
  entityId: string;
  /** Whose record, in words, for the banner and the settings list. */
  name: string;
  /** "Profile" for the edit form, "Status" for the status control. */
  what: "profile" | "status";
  /** What was changed, in words — "Phone (mobile), Email" or "Active → On hold". */
  summary: string;
  /**
   * The stored value before the change, whatever shape the store holds for
   * this kind of record. `null` means there was no stored override — the
   * record read from its seed — and undoing removes the override.
   */
  before: unknown;
  changedAt: string;
  changedBy: string;
}

export function undoDeadline(change: Pick<ProfileChange, "changedAt">, hours: number): string {
  return new Date(new Date(change.changedAt).getTime() + hours * 3_600_000).toISOString();
}

export function withinUndoWindow(
  change: Pick<ProfileChange, "changedAt">,
  hours: number,
  now: string,
): boolean {
  return new Date(now).getTime() < new Date(undoDeadline(change, hours)).getTime();
}

/** Changes still inside the window, newest first. */
export function undoableChanges(changes: ProfileChange[], hours: number, now: string): ProfileChange[] {
  return changes
    .filter((c) => withinUndoWindow(c, hours, now))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

/**
 * The one change to this record that Undo would act on — the newest inside
 * the window — or null.
 */
export function latestUndoable(
  changes: ProfileChange[],
  kind: ProfileChangeKind,
  entityId: string,
  hours: number,
  now: string,
): ProfileChange | null {
  return (
    undoableChanges(changes, hours, now).find((c) => c.kind === kind && c.entityId === entityId) ?? null
  );
}

/** Whether this change is the newest for its record, so Undo applies to it. */
export function isLatestForRecord(changes: ProfileChange[], change: ProfileChange): boolean {
  return !changes.some(
    (c) => c.kind === change.kind && c.entityId === change.entityId && c.changedAt > change.changedAt,
  );
}

/* ── What changed, in words ───────────────────────────────────────────── */

/** The fields somebody can edit, in the form's words and the form's order. */
const FIELD_LABELS: Partial<Record<keyof EmployeeProfile, string>> = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  preferredName: "Preferred name",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  externalId: "External id",
  referralSource: "Referral source",
  referralSourceOther: "Referral source",
  role: "Role",
  title: "Title",
  status: "Status",
  location: "Base location",
  employmentType: "Employment type",
  disciplines: "Disciplines",
  staffLicense: "NPI or license #",
  migratoryStatus: "Migratory status",
  baseRate: "Pay rate",
  weeklyHours: "Agreed weekly hours",
  drives: "Drives clients",
  tags: "Tags",
  generalNotes: "General notes",
  preferredLanguage: "Preferred language",
  otherLanguages: "Other languages",
  applicationDate: "Application date",
  hiredOn: "Hire date",
  rehireDate: "Rehire date",
  jobDescriptionSignedOn: "Job description signed on",
  exclusionStatus: "Exclusion list",
  exclusionCheckedAt: "Exclusion list checked",
  phoneMobile: "Phone (mobile)",
  email: "Email",
  address: "Address",
  emergencyContacts: "Emergency contacts",
  mrNumber: "MR number",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Which fields differ between two profiles, as labels for the confirm step.
 *
 * Karynn, 29 September: "After any edits are made for changes to employee
 * profile or client profile, need a secondary confirm to ensure the change is
 * warranted on the right person." The confirm names the person and lists
 * these, so "Save changes to Bedjine C?" is answered by seeing what they are.
 * Labels come out once each and in the form's order, whichever fields moved.
 */
export function changedFieldLabels(before: EmployeeProfile, after: EmployeeProfile): string[] {
  const out: string[] = [];
  for (const key of Object.keys(FIELD_LABELS) as Array<keyof EmployeeProfile>) {
    if (same(before[key], after[key])) continue;
    const label = FIELD_LABELS[key];
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/** "Phone (mobile), Email" or "Phone (mobile), Email and 2 more". */
export function changeSummary(labels: string[], max = 3): string {
  if (labels.length === 0) return "No fields changed";
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} and ${labels.length - max} more`;
}
