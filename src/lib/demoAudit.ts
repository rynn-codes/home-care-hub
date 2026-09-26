import {
  createAuditWriter,
  type AuditRecord,
  type AuditStore,
  type Actor,
} from "@/domain/audit/audit";

/**
 * The audit trail, wired up.
 *
 * The Audit screen has said since it was built that Joy records who did what in
 * code and has nothing behind it. `createAuditWriter` and its rules — the actor
 * validation, the redaction — have existed and been tested for as long, and
 * nothing in the application ever called them. Eleven consequential actions,
 * including approving an admission and capturing a signature, left no record of
 * who did them.
 *
 * EVERYTHING GOES THROUGH THE WRITER, never straight to the store. That is the
 * whole point of the shape: the writer refuses a misattributed actor loudly, it
 * redacts before anything is stored, and it returns a failure rather than
 * throwing into the caller's transaction. A convenience function that appended
 * directly would skip all three, and it is exactly the shortcut somebody takes
 * at five o'clock.
 *
 * This store is in memory and persists with the rest of the demo. The real one
 * is `SupabaseAuditStore`, which the developer swaps in — the writer is
 * constructed with a store, so that is a one-line change and nothing that calls
 * `recordAudit` moves.
 */

export interface StoredAuditEntry {
  id: string;
  at: string;
  actorType: Actor["type"];
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Captures the entry the writer produced, after redaction.
 *
 * Deliberately reads back what the WRITER passed down rather than what the
 * caller passed in. If redaction ever stopped working, a store that echoed the
 * caller's object would hide it — and the one thing this trail must never do is
 * carry a Social Security number.
 */
function capturingStore(): AuditStore & { taken: () => AuditRecord | null } {
  let last: AuditRecord | null = null;
  return {
    async append(entry) {
      last = entry;
    },
    taken() {
      const entry = last;
      last = null;
      return entry;
    },
  };
}

const store = capturingStore();
const writer = createAuditWriter(store);

let counter = 0;

export type AuditOutcome =
  | { ok: true; entry: StoredAuditEntry }
  | { ok: false; error: string };

/**
 * Record a consequential change.
 *
 * Returns the entry so a caller holding React state can put it somewhere. The
 * failure case returns rather than throws, per the writer's contract: losing an
 * audit entry is bad, and rolling back a completed assessment because the audit
 * write failed is worse.
 *
 * A misattributed actor still throws, and should. That is a programming error —
 * it puts a person's name on something they did not do — and it belongs in a
 * failing test rather than in the database.
 */
export function recordAudit(entry: AuditRecord, at: string): Promise<AuditOutcome> {
  // One at a time. The capturing store holds a single "last written" slot, so
  // two entries recorded in the same instant — a request created and sent in
  // one click — would otherwise race and one of them would come back empty.
  const run = chain.then(() => recordNow(entry, at));
  chain = run.then(() => undefined, () => undefined);
  return run;
}

let chain: Promise<void> = Promise.resolve();

async function recordNow(entry: AuditRecord, at: string): Promise<AuditOutcome> {
  const result = await writer.record(entry);
  // `in` rather than `!result.ok`: tsconfig has strictNullChecks off, and
  // TypeScript will not narrow a union by a boolean discriminant without it —
  // it keeps the `ok: true` arm in both branches, silently. This has already
  // shipped two bugs in this repository.
  if ("error" in result) return { ok: false, error: result.error };

  const written = store.taken();
  if (!written) {
    return { ok: false, error: "The audit store accepted the entry and returned nothing." };
  }

  counter += 1;
  return {
    ok: true,
    entry: {
      id: `aud-${counter}`,
      at,
      actorType: written.actor.type,
      actorUserId: written.actor.userId ?? null,
      actorLabel: written.actor.label ?? null,
      action: written.action,
      entityType: written.entityType,
      entityId: written.entityId ?? null,
      before: written.before ?? null,
      after: written.after ?? null,
      metadata: written.metadata ?? null,
    },
  };
}

/** One line for the trail, in the words somebody would use out loud. */
export const AUDIT_PHRASES: Record<string, string> = {
  "referral.created": "took a referral",
  "intake.corrected": "corrected the intake",
  "assessment.completed": "completed the assessment",
  "signature.captured": "took the signature",
  "admission.approved": "approved the admission",
  "admission.stage_changed": "moved the admission on",
  "client.activated": "started care",
  "schedule.changed": "changed the schedule",
  "candidate.stage_changed": "moved a candidate on",
  "employee.hired": "hired somebody",
  "payroll.approved": "approved payroll",
  "integration.retried": "retried an integration",
  "integration.failed": "recorded an integration failure",
  "invoice.submitted": "sent an invoice for approval",
  "invoice.approved": "approved an invoice",
  "invoice.issued": "sent an invoice",
  "invoice.adjusted": "adjusted an invoice",
  "invoice.written_off": "wrote an invoice off",
  "payment.recorded_external": "recorded a payment",
  "account.payer_changed": "changed who pays",
  "account.hold_placed": "paused billing on an account",
  "account.hold_lifted": "resumed billing on an account",
  "billing_run.created": "ran the week's billing",
  "admission.gate_overridden": "admitted past a gate, with a reason",
  "billing_contact.updated": "changed the billing contact",
  "payment_authorization.created": "captured a payment authorization",
  "payment_authorization.revoked": "recorded an authorization being withdrawn",
  "payment_preference.changed": "changed how a family pays",
  "payment_method.added": "saved a payment method",
  "payment_method.updated": "updated a payment method",
  "invoice.viewed": "a family opened their invoice",
  "payment.initiated": "started a payment",
  "payment.succeeded": "a payment went through",
  "payment.failed": "a payment failed",
  "refund.initiated": "started a refund",
  "refund.completed": "completed a refund",
  "employee.created": "added an employee",
  "employee.updated": "edited an employee's profile",
  "employee.status_changed": "changed an employee's status",
  "employee.change_undone": "undid a change to an employee",
  "employee.deleted": "deleted an employee record",
  "client.status_changed": "changed a client's status",
  "client.change_undone": "undid a change to a client",
  "client.deleted": "deleted a client record",
  "record.restored": "restored a deleted record",
  "record.purged": "removed a deleted record for good",
  "record.updated": "updated a record",
  "record.viewed": "opened a record",
  "activity.logged": "logged an activity",
  "activity.deleted": "deleted a logged activity",
  "contact.deleted": "removed a contact",
  "admission.deleted": "deleted an admission record",
  "document.uploaded": "added a document",
  "document.deleted": "deleted a document",
  "document.folder_created": "added a document folder",
  "document.folder_renamed": "renamed a document folder",
  "document.folder_deleted": "deleted a document folder",
  "sop.created": "added a procedure",
  "sop.revised": "saved a new version of a procedure",
  "sop.deleted": "deleted a procedure",
  "sop.category_renamed": "renamed a procedure category",
  "sop.category_emptied": "emptied a procedure category",
  "signing.template_saved": "set up a form for signing",
  "signing.template_deleted": "removed a signing template",
  "signing.request_created": "started a signing request",
  "signing.request_edited": "edited a signing request",
  "signing.request_sent": "sent a document to sign",
  "signing.request_viewed": "opened a document to sign",
  "signing.request_signed": "signed a document",
  "signing.request_declined": "declined to sign",
  "signing.request_countersigned": "countersigned a document",
  "signing.request_voided": "voided a signing request",
  "signing.request_corrected": "corrected a signing request",
  "signing.copy_sent": "sent a signed copy",
  "report.investor_sent": "sent the investor's monthly report",
};

export function auditPhrase(entry: StoredAuditEntry): string {
  return AUDIT_PHRASES[entry.action] ?? entry.action.replace(/[._]/g, " ");
}
