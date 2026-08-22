/**
 * Audit writing.
 *
 * Section 27. The rule that shapes this module is that an audit entry records
 * who did something, and "who" is not always a person — AI, background jobs and
 * integrations all act, and must be attributable as themselves rather than
 * borrowing whichever user happened to be signed in.
 */

export type ActorType = "user" | "ai" | "system" | "integration";

export interface Actor {
  type: ActorType;
  /** Required for a user actor; must be absent for the others. */
  userId?: string | null;
  /** For ai/system/integration: which one. */
  label?: string | null;
}

export interface AuditRecord {
  organizationId: string;
  actor: Actor;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditStore {
  append(entry: AuditRecord): Promise<void>;
}

/** Consequential actions worth auditing, per section 27. */
export const AUDITED_ACTIONS = [
  "intake.corrected",
  "assessment.completed",
  "signature.captured",
  "admission.approved",
  "schedule.changed",
  "candidate.stage_changed",
  "payroll.approved",
  "integration.retried",
  "integration.failed",
  "referral.created",
  "admission.stage_changed",
  // The financial actions — §7 and §13 of the billing specification. Every
  // change to what a family owes carries a name; see billing/financialAudit.ts
  // for the builders that shape these entries.
  "invoice.submitted",
  "invoice.approved",
  "invoice.issued",
  "invoice.adjusted",
  "invoice.written_off",
  "payment.recorded_external",
  "account.payer_changed",
  "account.hold_placed",
  "account.hold_lifted",
  "billing_run.created",
  // §4.2: admission proceeding past an unsatisfied gate, with a reason.
  "admission.gate_overridden",
  // Addendum §15's vocabulary. Where the addendum and the earlier list name
  // the same act differently, the earlier name stands and the mapping is:
  // invoice.finalized ≈ invoice.approved, invoice.sent ≈ invoice.issued,
  // invoice.created ≈ billing_run.created (drafts are born in runs).
  "billing_contact.updated",
  "payment_authorization.created",
  "payment_authorization.revoked",
  "payment_preference.changed",
  "payment_method.added",
  "payment_method.updated",
  "invoice.viewed",
  "payment.initiated",
  "payment.succeeded",
  "payment.failed",
  "refund.initiated",
  "refund.completed",
] as const;

export class AuditError extends Error {}

/**
 * Fields that must never be copied into an audit payload.
 *
 * Section 28 requires PHI and sensitive data to be redacted from logs, and
 * section 27 says not to log raw document content unnecessarily. An audit entry
 * records that a thing changed and by whom — it is not a second copy of the
 * record, and a Social Security number does not belong in it.
 */
const REDACTED_KEYS = [
  "ssn",
  "social_security_number",
  "socialSecurityNumber",
  "password",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "signature",
  "signature_data",
  "initials",
  "document_content",
  "documentContent",
];

export function redact(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (REDACTED_KEYS.some((r) => r.toLowerCase() === key.toLowerCase())) {
      out[key] = "[redacted]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[key] = redact(v as Record<string, unknown>);
    } else {
      out[key] = v;
    }
  }
  return out;
}

export function validateActor(actor: Actor): void {
  if (actor.type === "user" && !actor.userId) {
    throw new AuditError(
      "A user action must record which user. Use actor type 'system' for unattended work.",
    );
  }
  if (actor.type !== "user" && actor.userId) {
    throw new AuditError(
      `An actor of type '${actor.type}' must not carry a user id — it would misattribute the action to a person.`,
    );
  }
}

export function createAuditWriter(store: AuditStore) {
  return {
    /**
     * Records a consequential change.
     *
     * Never throws into the caller's business transaction on a store failure:
     * losing an audit entry is bad, but rolling back a completed assessment
     * because the audit write failed is worse. The failure is surfaced by the
     * returned result so it can be alerted on.
     */
    async record(entry: AuditRecord): Promise<{ ok: true } | { ok: false; error: string }> {
      // Deliberately allowed to throw. A store failure is an operational
      // problem to report, but a misattributed actor is a programming error —
      // it would put a person's name on something they did not do, and should
      // fail loudly in tests rather than being written and returned as ok.
      validateActor(entry.actor);

      try {
        await store.append({
          ...entry,
          before: redact(entry.before),
          after: redact(entry.after),
          metadata: redact(entry.metadata),
        });
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Audit entry could not be written",
        };
      }
    },
  };
}

export type AuditWriter = ReturnType<typeof createAuditWriter>;
