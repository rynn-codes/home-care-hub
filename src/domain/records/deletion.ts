/**
 * What deleting a record means in Joy, and how long it can be undone.
 *
 * Karynn, 9 September: a client entered by mistake can be deleted, and waits
 * sixty days in the bin before it is final. Everything else waits thirty.
 *
 * Nothing is removed on the day. A deleted record goes to Settings → Deleted
 * items with who deleted it and why, and can be put back exactly as it was
 * until its recovery window closes. After that the purge is automatic and
 * final — the window is the whole of the second chance.
 *
 * Admitted clients are not deletable at all: once care has started their
 * file is a clinical record the agency has to keep, so it is discharged
 * rather than deleted.
 */

export type DeletableKind = "admission" | "contact" | "activity" | "document" | "sop" | "employee" | "client";

/** Days in the bin for most things. */
export const DEFAULT_RECOVERY_DAYS = 30;

/** The longer windows. An employee's or a client's file deserves more than a month of second thoughts. */
const RECOVERY_DAYS: Partial<Record<DeletableKind, number>> = { employee: 60, client: 60 };

export function recoveryDaysFor(kind: DeletableKind): number {
  return RECOVERY_DAYS[kind] ?? DEFAULT_RECOVERY_DAYS;
}

/** The word somebody types to confirm. Capitals, on purpose. */
export const CONFIRM_WORD = "DELETE";

export const KIND_LABELS: Record<DeletableKind, string> = {
  admission: "Admission record",
  contact: "Contact",
  activity: "Logged activity",
  document: "Document",
  sop: "Procedure",
  employee: "Employee",
  client: "Client",
};

export interface DeletedRecord<Payload = unknown> {
  id: string;
  kind: DeletableKind;
  /** What the bin shows — a name, a title. */
  label: string;
  /** The second line — "Employee record", "Admission · assessment". */
  sublabel: string;
  deletedAt: string;
  deletedBy: string;
  reason: string | null;
  /** Everything needed to put it back exactly as it was. */
  payload: Payload;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** The day this record goes for good. */
export function purgeDate(record: Pick<DeletedRecord, "deletedAt" | "kind">): string {
  const d = new Date(`${record.deletedAt.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + recoveryDaysFor(record.kind));
  return d.toISOString().slice(0, 10);
}

export function daysLeft(record: Pick<DeletedRecord, "deletedAt" | "kind">, now: string): number {
  return Math.max(0, recoveryDaysFor(record.kind) - daysBetween(record.deletedAt, now));
}

export function isExpired(record: Pick<DeletedRecord, "deletedAt" | "kind">, now: string): boolean {
  return daysBetween(record.deletedAt, now) >= recoveryDaysFor(record.kind);
}

/** What stays in the bin and what the automatic purge removes today. */
export function partitionExpired<T extends Pick<DeletedRecord, "deletedAt" | "kind">>(
  records: T[],
  now: string,
): { keep: T[]; purge: T[] } {
  const keep: T[] = [];
  const purge: T[] = [];
  for (const r of records) (isExpired(r, now) ? purge : keep).push(r);
  return { keep, purge };
}

export function daysLeftLabel(record: Pick<DeletedRecord, "deletedAt" | "kind">, now: string): string {
  const n = daysLeft(record, now);
  return n <= 0 ? "Being deleted permanently" : n === 1 ? "1 day left" : `${n} days left`;
}

export function confirmsDeletion(typed: string): boolean {
  return typed.trim() === CONFIRM_WORD;
}

/**
 * Why an admission cannot be deleted, or null when it can.
 *
 * An admitted client's record is kept, never destroyed. The stage check
 * catches a record admitted through the seed; `activated` catches one
 * admitted in the demo.
 */
export function whyNotDeletable(admission: { activated?: boolean; stage: string }): string | null {
  if (admission.activated || admission.stage === "admitted") {
    return "This person is an admitted client. Their record has to be kept — discharge them instead, which closes the file without destroying it.";
  }
  return null;
}

/** What goes with an admission, in words the confirm dialog lists. */
export function admissionConsequences(has: { hasIntake: boolean; hasAssessment: boolean; hasConsents: boolean }): string[] {
  const out = ["The lead and everything typed against it"];
  if (has.hasIntake) out.push("The phone intake and its answers");
  if (has.hasAssessment) out.push("The assessment and its answers");
  if (has.hasConsents) out.push("Any consent decisions and signatures taken");
  return out;
}

/** A record on its way to the bin, stamped now. */
export function binned<Payload>(input: {
  id: string;
  kind: DeletableKind;
  label: string;
  sublabel: string;
  by: string;
  reason?: string | null;
  payload: Payload;
  at?: string;
}): DeletedRecord<Payload> {
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    sublabel: input.sublabel,
    deletedAt: input.at ?? new Date().toISOString(),
    deletedBy: input.by,
    reason: input.reason ?? null,
    payload: input.payload,
  };
}
