import type { AuditRecord, AuditStore } from "@/domain/audit/audit";

/**
 * The Postgres audit store.
 *
 * The Audit screen has a line on it saying Joy records who did what in code and
 * has no database behind it. This is the adapter that closes it — the last
 * `AuditStore` implementation was in-memory, which meant every audit entry the
 * app wrote was discarded on the next page load.
 *
 * TYPED AGAINST A MINIMAL CLIENT SHAPE, not against `SupabaseClient`. Two
 * reasons. The generated `Database` type does not know about tables from
 * migrations that have not been applied to the project yet, so importing it
 * would make this file fail to compile for a reason that has nothing to do with
 * this file. And a narrow structural type is testable: the contract tests below
 * pass a fake, which is how the retry and failure paths get exercised at all.
 *
 * The developer wires this by passing the real client:
 *
 *   const audit = createAuditWriter(new SupabaseAuditStore(supabase));
 */

export interface InsertableTable {
  insert(rows: Record<string, unknown>[]): Promise<{ error: { message: string } | null }>;
}

export interface MinimalSupabase {
  from(table: string): InsertableTable;
}

/**
 * Maps a domain record onto the columns in 0002.
 *
 * Written out rather than spread, so a rename in either direction is a compile
 * error rather than a column that silently stops being written. An audit trail
 * that quietly loses a field is worse than one that fails loudly.
 */
export function auditRow(entry: AuditRecord): Record<string, unknown> {
  return {
    organization_id: entry.organizationId,
    actor_type: entry.actor.type,
    // Null for ai/system/integration — `validateActor` has already refused any
    // combination where this would misattribute an action to a person, and the
    // table's own check constraint refuses it again.
    actor_user_id: entry.actor.userId ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before_json: entry.before ?? null,
    after_json: entry.after ?? null,
    // The actor's label — "outbox worker", "chart drafting" — is the only place
    // a non-user actor says which one it was, so it goes in the metadata rather
    // than being dropped.
    metadata_json:
      entry.actor.label && entry.actor.type !== "user"
        ? { ...(entry.metadata ?? {}), actor_label: entry.actor.label }
        : entry.metadata ?? null,
  };
}

export class SupabaseAuditStore implements AuditStore {
  constructor(private readonly client: MinimalSupabase) {}

  /**
   * Throws on failure, deliberately.
   *
   * `createAuditWriter` catches it and returns `{ ok: false }` rather than
   * letting it into the caller's transaction — losing an audit entry is bad,
   * rolling back a completed assessment because the audit write failed is
   * worse. The decision belongs there, in one place, not in every adapter.
   */
  async append(entry: AuditRecord): Promise<void> {
    const { error } = await this.client.from("audit_entries").insert([auditRow(entry)]);
    if (error) {
      throw new Error(`Audit entry could not be written: ${error.message}`);
    }
  }
}
