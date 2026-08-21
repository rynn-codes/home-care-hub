/**
 * Scheduling conflict detection.
 *
 * §20 and §29 of the Scheduling Build Spec: conflict logic lives in a domain
 * service, not in calendar components. A drag-and-drop handler asks this
 * question; it does not answer it.
 *
 * Every conflict explains itself in words the scheduler can act on — §12 of the
 * spec requires the reason, not just a refusal. "This creates a conflict" with
 * no explanation is the same as no answer.
 */

export interface Visit {
  id: string;
  clientName: string;
  /**
   * The client's person id, used to find the care plan this visit is worked
   * under. Optional only because the older demo seeds predate the care plan;
   * a visit without one shows no task list rather than an improvised one.
   */
  clientPersonId?: string;
  service: string;
  /** Null when the shift is open — unassigned and needing coverage. */
  caregiverName: string | null;
  startsAt: string;
  endsAt: string;
  /** rn_assessment visits are the RN's, not a caregiver's. */
  eventType?: string;
  /**
   * Charge for this visit when Joy's default says not to, or the reverse.
   *
   * Karynn, 20 Aug: "RN admission is free unless noted otherwise." The note is
   * this field. An admission assessment is unbilled by default and the office
   * can mark one chargeable — a second assessment after a hospital stay, say —
   * without changing what every other assessment costs.
   *
   * Undefined means "use the default for this kind of visit", which is not the
   * same as false. See `isBillable`.
   */
  billableOverride?: boolean;
}

export type ConflictKind =
  | "caregiver_double_booked"
  | "client_double_booked"
  | "overtime_risk";

export interface Conflict {
  kind: ConflictKind;
  /** Plain language, naming who and when. */
  message: string;
  /** The visit already in the way, when there is one. */
  conflictsWith?: Visit;
  /** Overtime is a warning, not a refusal — a scheduler may accept the cost. */
  severity: "blocking" | "warning";
}

const HOURS = 3_600_000;

/** Weekly hours past which overtime is incurred. Standard US threshold. */
export const OVERTIME_THRESHOLD_HOURS = 40;

export function hoursOf(visit: Visit): number {
  return (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / HOURS;
}

function overlaps(a: Visit, b: Visit): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  // Touching end-to-start is not an overlap: a 12:00 finish and a 12:00 start
  // are back-to-back, which schedulers do deliberately.
  return aStart < bEnd && bStart < aEnd;
}

function timeRange(visit: Visit): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmt(visit.startsAt)}–${fmt(visit.endsAt)}`;
}

function sameWeek(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday-based
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return startOfWeek(da) === startOfWeek(db);
}

/**
 * Checks a proposed visit against everything already scheduled.
 *
 * `proposed` may be an existing visit being moved — it is excluded from the
 * comparison by id, so dragging a visit does not report it conflicting with
 * itself.
 */
export function findConflicts(proposed: Visit, existing: readonly Visit[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const others = existing.filter((v) => v.id !== proposed.id);

  if (proposed.caregiverName) {
    const clash = others.find(
      (v) => v.caregiverName === proposed.caregiverName && overlaps(proposed, v),
    );
    if (clash) {
      conflicts.push({
        kind: "caregiver_double_booked",
        severity: "blocking",
        message: `${proposed.caregiverName} is already with ${clash.clientName} from ${timeRange(clash)}.`,
        conflictsWith: clash,
      });
    }
  }

  const clientClash = others.find(
    (v) => v.clientName === proposed.clientName && overlaps(proposed, v),
  );
  if (clientClash) {
    conflicts.push({
      kind: "client_double_booked",
      severity: "blocking",
      message: `${proposed.clientName} already has ${clientClash.service} from ${timeRange(clientClash)}.`,
      conflictsWith: clientClash,
    });
  }

  // Overtime is a cost, not an error. The scheduler may knowingly accept it —
  // so it warns and explains rather than refusing.
  if (proposed.caregiverName) {
    const weekHours = others
      .filter((v) => v.caregiverName === proposed.caregiverName && sameWeek(v.startsAt, proposed.startsAt))
      .reduce((sum, v) => sum + hoursOf(v), 0);
    const total = weekHours + hoursOf(proposed);

    if (total > OVERTIME_THRESHOLD_HOURS) {
      conflicts.push({
        kind: "overtime_risk",
        severity: "warning",
        message: `This puts ${proposed.caregiverName} at ${total.toFixed(1)} hours this week — ${(
          total - OVERTIME_THRESHOLD_HOURS
        ).toFixed(1)} over the overtime threshold.`,
      });
    }
  }

  return conflicts;
}

export function isBlocked(conflicts: readonly Conflict[]): boolean {
  return conflicts.some((c) => c.severity === "blocking");
}

/** Open shifts are the scheduler's most time-sensitive work. */
export function openShifts(visits: readonly Visit[]): Visit[] {
  return visits.filter((v) => v.caregiverName === null);
}

/**
 * Every conflict currently on the board.
 *
 * Each pair is reported once — checking every visit against every other would
 * otherwise surface the same double-booking from both sides.
 */
export function scheduleConflicts(visits: readonly Visit[]): Conflict[] {
  const seen = new Set<string>();
  const found: Conflict[] = [];

  for (const visit of visits) {
    for (const conflict of findConflicts(visit, visits)) {
      if (!conflict.conflictsWith) continue;
      const pair = [visit.id, conflict.conflictsWith.id].sort().join("|");
      const key = `${conflict.kind}:${pair}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(conflict);
    }
  }

  return found;
}
