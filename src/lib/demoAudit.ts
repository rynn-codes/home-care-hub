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
export async function recordAudit(entry: AuditRecord, at: string): Promise<AuditOutcome> {
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
};

export function auditPhrase(entry: StoredAuditEntry): string {
  return AUDIT_PHRASES[entry.action] ?? entry.action.replace(/[._]/g, " ");
}
