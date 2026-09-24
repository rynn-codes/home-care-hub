/**
 * Where a screen was opened from, carried in router state.
 *
 * A record opened from another record — a client from a caregiver's file, the
 * schedule from a client — shows that origin in its breadcrumb instead of the
 * directory, so Back means back to where you actually were. `reopen` lets the
 * origin screen restore a panel it had open.
 */
export interface CameFrom {
  label: string;
  to: string;
  reopen?: string;
}

export function cameFrom(from: CameFrom): { from: CameFrom } {
  return { from };
}

export function readCameFrom(state: unknown): CameFrom | null {
  const from = (state as { from?: CameFrom } | null)?.from;
  return from && typeof from.label === "string" && typeof from.to === "string" ? from : null;
}
