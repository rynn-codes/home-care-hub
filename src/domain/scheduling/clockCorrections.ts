/**
 * Correcting a clock by hand — the EVV reason and action codes.
 *
 * Texas HHSC visit-maintenance codes, in the office's words. A manual clock
 * entry with no reason beside it looks the same as one somebody invented, so
 * every correction carries a reason, how the office knows the time, and a
 * note where the code asks for one. Action 17 marks the visit unverified and
 * holds it out of billing.
 */

export type ReasonGroup = "schedule" | "authorization" | "disaster" | "clock" | "data" | "other";

export const REASON_GROUP_LABELS: Record<ReasonGroup, string> = {
  schedule: "The visit ran differently",
  authorization: "Beyond what was agreed",
  disaster: "Weather or emergency",
  clock: "The clock itself",
  data: "Recorded against the wrong thing",
  other: "Something else",
};

export const REASON_GROUP_ORDER: ReasonGroup[] = ["clock", "schedule", "data", "authorization", "disaster", "other"];

export interface ReasonCode {
  code: string;
  label: string;
  plain: string;
  group: ReasonGroup;
  requiresNote?: boolean;
}

export const REASON_CODES: ReasonCode[] = [
  { code: "110A", label: "Service delivery differs from schedule", plain: "The visit ran differently from the schedule", group: "schedule" },
  { code: "110B", label: "Downward adjustment of billed hours", plain: "Fewer hours than scheduled", group: "schedule" },
  { code: "110C", label: "Fill-in caregiver", plain: "A fill-in caregiver worked it", group: "schedule" },
  { code: "110D", label: "Allowable overlapping visits — same household", plain: "Two clients in one household, one clock", group: "schedule" },
  { code: "120B", label: "Care delivered beyond the authorized hours", plain: "More hours than the family agreed", group: "authorization", requiresNote: true },
  { code: "130A", label: "Flood", plain: "Flood", group: "disaster" },
  { code: "130B", label: "Hurricane", plain: "Hurricane", group: "disaster" },
  { code: "130C", label: "Ice or snow storm", plain: "Ice or snow", group: "disaster" },
  { code: "130F", label: "Public health emergency", plain: "Public health emergency", group: "disaster" },
  { code: "210A", label: "Failure to clock in, clock out or both", plain: "Forgot to clock in or out", group: "clock" },
  { code: "210B", label: "Phone unavailable — dead, lost or broken", plain: "Phone dead, lost or broken", group: "clock" },
  { code: "210H", label: "Authorized care given out in the community", plain: "Out in the community with the client", group: "clock" },
  { code: "210I", label: "Emergency during the shift", plain: "Emergency during the shift", group: "clock", requiresNote: true },
  { code: "210J", label: "Joy was unavailable", plain: "Joy was down", group: "clock" },
  { code: "310B", label: "Wrong service selected", plain: "Wrong service picked", group: "data" },
  { code: "310C", label: "Clocked in under the wrong caregiver", plain: "Clocked in as the wrong caregiver", group: "data" },
  { code: "310D", label: "Clocked in against the wrong client", plain: "Clocked in for the wrong client", group: "data" },
  { code: "310E", label: "Clocked in or out at the wrong location", plain: "Clocked in or out somewhere else", group: "data", requiresNote: true },
  { code: "600", label: "Other", plain: "Something else", group: "other", requiresNote: true },
];

export interface ActionCode {
  code: string;
  label: string;
  stopsBilling?: boolean;
  requiresNote?: boolean;
}

export const ACTION_CODES: ActionCode[] = [
  { code: "10", label: "Confirmed with the client or family and documented" },
  { code: "11", label: "Supervisor approved the change" },
  { code: "14", label: "Timesheet received and signed by a supervisor" },
  { code: "15", label: "Visit rescheduled" },
  { code: "16", label: "Updated the client's address and documented" },
  { code: "17", label: "Unverified visit — this service cannot be billed", stopsBilling: true },
  { code: "18", label: "Services cancelled or suspended until further notice" },
  { code: "19", label: "Change to the recurring schedule" },
  { code: "21", label: "Other", requiresNote: true },
];

/** How the office knows the time — each maps to an action code. */
export interface ConfirmSource {
  value: string;
  label: string;
  actionCode: string;
  requiresNote?: boolean;
}

export const CONFIRM_SOURCES: ConfirmSource[] = [
  { value: "caregiver_call", label: "Phone call with the caregiver", actionCode: "10" },
  { value: "caregiver_text", label: "Text from the caregiver", actionCode: "10" },
  { value: "caregiver_app", label: "Caregiver confirmed it in Joy", actionCode: "10" },
  { value: "family", label: "Client or family confirmed it", actionCode: "10" },
  { value: "supervisor", label: "Supervisor approved the change", actionCode: "11" },
  { value: "timesheet", label: "Signed timesheet", actionCode: "14" },
  { value: "could_not_reach", label: "Could not reach anyone — unverified", actionCode: "17", requiresNote: true },
];

export function confirmSource(value: string): ConfirmSource | null {
  return CONFIRM_SOURCES.find((s) => s.value === value) ?? null;
}

export function reasonCode(code: string): ReasonCode | null {
  return REASON_CODES.find((r) => r.code === code) ?? null;
}

export function actionCode(code: string): ActionCode | null {
  return ACTION_CODES.find((a) => a.code === code) ?? null;
}

export function codeLabel(c: { code: string; label: string }): string {
  return `(${c.code}) ${c.label}`;
}

export interface CorrectionDraft {
  reasonCode: string;
  /** A confirm-source value or a raw action code. */
  actionCode: string;
  note: string;
}

export function validateCorrection(draft: CorrectionDraft): string | null {
  const reason = reasonCode(draft.reasonCode);
  if (!reason) return "Pick why the clock is missing.";
  const source = confirmSource(draft.actionCode);
  const action = actionCode(source ? source.actionCode : draft.actionCode);
  if (!action) return "Say how you know the time.";
  const note = draft.note.trim();
  if (reason.requiresNote && note === "") return `"${reason.plain}" needs a line saying what happened.`;
  if (source?.requiresNote && note === "") return `"${source.label}" needs a line saying who you tried.`;
  if (!source && action.requiresNote && note === "") return `"${action.label}" needs a line saying what was done.`;
  return null;
}

export function stopsBilling(actionOrSource: string): boolean {
  const source = confirmSource(actionOrSource);
  return actionCode(source ? source.actionCode : actionOrSource)?.stopsBilling === true;
}

/** "(210A) Failure to clock in… · Phone call with the caregiver". */
export function correctionSummary(draft: Pick<CorrectionDraft, "reasonCode" | "actionCode">): string {
  const reason = reasonCode(draft.reasonCode);
  const source = confirmSource(draft.actionCode);
  const action = actionCode(source ? source.actionCode : draft.actionCode);
  return [reason && codeLabel(reason), source ? source.label : action && codeLabel(action)].filter(Boolean).join(" · ");
}
