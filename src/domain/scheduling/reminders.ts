import type { Conflict, Visit } from "@/domain/scheduling/conflicts";
import { CLOCK_OUT_GRACE_HOURS } from "@/domain/scheduling/visitState";

/**
 * What Joy does around a visit's clock — the reminder ladders, the status
 * chips on the visit sheet and the "Joy activity" feed.
 *
 * NOTIFICATION_LINES_NEED_SPRUCE: every reminder here is SHOWN as scheduled.
 * Nothing is sent. Spruce is not wired, and the sheet says so.
 */
export const NOTIFICATION_LINES_NEED_SPRUCE = true;

/** Feet from the address within which a phone counts as "there". */
export const AT_ADDRESS_FEET = 200;

export function feetLabel(feet: number): string {
  if (feet < 1320) return `${feet} ft`;
  const miles = feet / 5280;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

const BEFORE_END_MINUTES = 5;
const BEFORE_START_MINUTES = 5;
export const DEFAULT_ESCALATE_AFTER_MINUTES = 15;

function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

const firstName = (name: string | null) => (name === null ? "The caregiver" : name.split(" ")[0]);

export interface Reminder {
  rung: string;
  to: "caregiver" | "office";
  at: string;
  text: string;
  /** Already reached, as of now. */
  due: boolean;
}

/** The clock-out ladder for a caregiver who is on shift. */
export function clockOutLadder(input: {
  visit: Visit;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  now: Date;
  feetFromClockIn?: number | null;
  leftAreaAt?: string | null;
}): Reminder[] {
  const { visit, clockedInAt, clockedOutAt, now } = input;
  if (!clockedInAt || clockedOutAt) return [];
  const end = new Date(visit.endsAt);
  if (Number.isNaN(end.getTime())) return [];
  const who = firstName(visit.caregiverName);
  const out: Reminder[] = [];
  const before = new Date(end.getTime() - BEFORE_END_MINUTES * 60_000);
  out.push({ rung: "before_end", to: "caregiver", at: stamp(before), text: `Reminded ${who} the shift ends in ${BEFORE_END_MINUTES} minutes`, due: now >= before });
  out.push({ rung: "at_end", to: "caregiver", at: stamp(end), text: `Reminded ${who} to clock out`, due: now >= end });
  const feet = input.feetFromClockIn ?? null;
  if (feet !== null && feet > AT_ADDRESS_FEET) {
    out.push({
      rung: "left_area",
      to: "caregiver",
      at: input.leftAreaAt ?? stamp(now),
      text: `${who} is ${feetLabel(feet)} from the clock-in location — reminded ${who} the shift is still open`,
      due: true,
    });
  }
  const office = new Date(end.getTime() + CLOCK_OUT_GRACE_HOURS * 3_600_000);
  out.push({
    rung: "office_must_close",
    to: "office",
    at: stamp(office),
    text: `No clock-out ${CLOCK_OUT_GRACE_HOURS} hours after the shift ended — the office has to call ${who} and record it`,
    due: now >= office,
  });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** The clock-in ladder for an assigned visit nobody has clocked into. */
export function clockInLadder(input: {
  visit: Visit;
  clockedInAt: string | null;
  now: Date;
  escalateAfterMinutes?: number;
  feetFromAddress?: number | null;
  arrivedAt?: string | null;
}): Reminder[] {
  const { visit, clockedInAt, now } = input;
  const escalate = input.escalateAfterMinutes ?? DEFAULT_ESCALATE_AFTER_MINUTES;
  if (clockedInAt || visit.caregiverName === null) return [];
  const start = new Date(visit.startsAt);
  if (Number.isNaN(start.getTime())) return [];
  const who = firstName(visit.caregiverName);
  const out: Reminder[] = [];
  const before = new Date(start.getTime() - BEFORE_START_MINUTES * 60_000);
  out.push({ rung: "before_start", to: "caregiver", at: stamp(before), text: `Reminded ${who} the shift starts in ${BEFORE_START_MINUTES} minutes`, due: now >= before });
  out.push({ rung: "at_start", to: "caregiver", at: stamp(start), text: `Reminded ${who} to clock in`, due: now >= start });
  const feet = input.feetFromAddress ?? null;
  if (feet !== null && feet <= AT_ADDRESS_FEET) {
    out.push({
      rung: "arrived",
      to: "caregiver",
      at: input.arrivedAt ?? stamp(now),
      text: `${who} is at the address and has not clocked in — reminded ${who} on arrival`,
      due: true,
    });
  }
  const office = new Date(start.getTime() + escalate * 60_000);
  out.push({
    rung: "office_must_check",
    to: "office",
    at: stamp(office),
    text:
      feet !== null && feet <= AT_ADDRESS_FEET
        ? `Still no clock-in ${escalate} minutes in, though ${who}'s phone is at the address`
        : `No clock-in ${escalate} minutes after the shift started — somebody has to call ${who} and check the client is not alone`,
    due: now >= office,
  });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function lateLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min late`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hr late` : `${h} hr ${m} min late`;
  }
  const days = Math.round(minutes / (60 * 24));
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

export function dueReminders(list: readonly Reminder[]): Reminder[] {
  return list.filter((r) => r.due);
}

export function nextReminder(list: readonly Reminder[]): Reminder | null {
  return list.find((r) => !r.due) ?? null;
}

const LATE_AFTER_MINUTES = 5;

export interface StatusChip {
  key: string;
  label: string;
  tone: "good" | "warn" | "bad" | "info" | "muted";
}

export function statusChips(input: {
  visit: Visit & { coverFor?: string };
  clockedInAt: string | null;
  clockedOutAt: string | null;
  conflicts: readonly Conflict[];
  joyWorking: boolean;
  now: Date;
}): StatusChip[] {
  const { visit, clockedInAt, clockedOutAt, conflicts, now } = input;
  const out: StatusChip[] = [];
  if (conflicts.some((c) => c.severity === "blocking")) out.push({ key: "conflict", label: "Conflict", tone: "bad" });
  else if (visit.caregiverName === null) out.push({ key: "open", label: visit.coverFor ? `Needs cover · ${visit.coverFor} off` : "Open shift", tone: "warn" });
  else out.push({ key: "confirmed", label: "Confirmed", tone: "good" });
  const start = new Date(visit.startsAt).getTime();
  const end = new Date(visit.endsAt).getTime();
  if (clockedOutAt) out.push({ key: "complete", label: "Clocked out", tone: "good" });
  else if (clockedInAt) {
    if (now.getTime() > end + CLOCK_OUT_GRACE_HOURS * 3_600_000) out.push({ key: "no_out", label: "No clock-out", tone: "bad" });
    else {
      const late = Math.round((new Date(clockedInAt).getTime() - start) / 60_000);
      out.push({ key: "in", label: late > LATE_AFTER_MINUTES ? `Clocked in ${late} min late` : "Clocked in", tone: "good" });
    }
  } else if (visit.caregiverName !== null && !Number.isNaN(start) && now.getTime() > start) {
    const late = Math.round((now.getTime() - start) / 60_000);
    if (late > LATE_AFTER_MINUTES) out.push({ key: "late", label: `Not clocked in · ${lateLabel(late)}`, tone: "bad" });
    else out.push({ key: "due", label: "Due to clock in", tone: "muted" });
  }
  if (input.joyWorking) out.push({ key: "joy", label: "Joy working", tone: "info" });
  return out;
}

export interface ActivityLine {
  at: string;
  text: string;
  lead?: boolean;
  timed?: boolean;
}

export function joyActivity(input: {
  visit: Visit;
  conflicts: readonly Conflict[];
  considered: number;
  eligible: number;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  reminders?: readonly Reminder[];
  now: Date;
}): ActivityLine[] {
  const { visit, conflicts, considered, eligible } = input;
  const out: ActivityLine[] = [];
  if (conflicts.length > 0) out.push({ at: visit.startsAt, text: `Detected ${conflicts[0].message}`, lead: true });
  if (visit.caregiverName === null || conflicts.length > 0) {
    if (considered > 0) {
      out.push({ at: visit.startsAt, text: `Checked ${considered} ${considered === 1 ? "caregiver" : "caregivers"} for this window` });
      out.push({ at: visit.startsAt, text: eligible === 0 ? "No eligible alternatives found" : `Found ${eligible} available ${eligible === 1 ? "alternative" : "alternatives"}` });
    }
    out.push({ at: visit.startsAt, text: "Escalated — reassignment needs your approval" });
  }
  if (visit.caregiverName !== null && input.clockedInAt === null) {
    const start = new Date(visit.startsAt).getTime();
    if (!Number.isNaN(start) && input.now.getTime() > start) out.push({ at: visit.startsAt, text: "Watching for a clock-in" });
  }
  if (input.clockedInAt) out.push({ at: input.clockedInAt, text: "Clock-in received", timed: true });
  for (const r of input.reminders ?? []) if (r.due) out.push({ at: r.at, text: r.text, timed: true });
  if (input.clockedOutAt) out.push({ at: input.clockedOutAt, text: "Clock-out received", timed: true });
  return out;
}

// ---------------------------------------------------------------------------
// Clock suggestions from the phone's location

const CORROBORATION_MINUTES = 15;
const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
const valid = (iso: string) => !Number.isNaN(new Date(iso).getTime());

export interface ClockSuggestion {
  at: string;
  basis: "scheduled_end_corroborated" | "last_ping" | "arrival_ping";
  because: string;
  endsEarly: boolean;
}

export function suggestClockOut(input: { scheduledEndsAt: string; clockedInAt: string; lastPing: { at: string; feet: number } | null; atAddressName: string }): ClockSuggestion | null {
  const { scheduledEndsAt, clockedInAt, lastPing, atAddressName } = input;
  if (!valid(scheduledEndsAt) || !valid(clockedInAt) || !lastPing || !valid(lastPing.at) || lastPing.feet > AT_ADDRESS_FEET) return null;
  if (new Date(lastPing.at).getTime() <= new Date(clockedInAt).getTime()) return null;
  const gap = minutesBetween(lastPing.at, scheduledEndsAt);
  if (Math.abs(gap) <= CORROBORATION_MINUTES) {
    return { at: scheduledEndsAt, basis: "scheduled_end_corroborated", because: `the scheduled end. The last GPS ping at ${atAddressName} was ${lastPing.at}.`, endsEarly: false };
  }
  if (gap > CORROBORATION_MINUTES) {
    return { at: lastPing.at, basis: "last_ping", because: `the last GPS ping at ${atAddressName}. The shift was scheduled to ${scheduledEndsAt}, so it appears to have ended early.`, endsEarly: true };
  }
  return { at: lastPing.at, basis: "last_ping", because: `the last GPS ping at ${atAddressName}, which is after the scheduled end — this shift ran over.`, endsEarly: false };
}

export function suggestClockIn(input: { scheduledStartsAt: string; arrival: { at: string; feet: number } | null; atAddressName: string }): ClockSuggestion | null {
  const { scheduledStartsAt, arrival, atAddressName } = input;
  if (!arrival || !valid(arrival.at) || !valid(scheduledStartsAt) || arrival.feet > AT_ADDRESS_FEET) return null;
  const late = minutesBetween(scheduledStartsAt, arrival.at);
  return {
    at: arrival.at,
    basis: "arrival_ping",
    because:
      late > 0
        ? `when your phone reached ${atAddressName} — ${feetLabel(arrival.feet)} away, ${late} min after the shift was due to start.`
        : `when your phone reached ${atAddressName}, ${feetLabel(arrival.feet)} away.`,
    endsEarly: false,
  };
}

/** A caregiver's answer to Joy's suggested time, waiting on the office. */
export interface ClockProposal {
  visitId: string;
  which: "in" | "out";
  suggestedAt: string;
  confirmedAt: string;
  confirmedBy: string;
  tookSuggestion: boolean;
  status: "awaiting_office" | "approved" | "declined";
  decidedBy?: string;
  decidedAt?: string;
}

export function proposalLine(p: ClockProposal, fmtTime: (iso: string) => string): string {
  const which = p.which === "in" ? "start" : "end";
  const who = p.confirmedBy.split(" ")[0];
  if (p.status === "awaiting_office") {
    return p.tookSuggestion
      ? `${who} confirmed Joy's suggested ${which}, ${fmtTime(p.confirmedAt)} — waiting on your approval`
      : `${who} gave a different ${which}, ${fmtTime(p.confirmedAt)} (Joy suggested ${fmtTime(p.suggestedAt)}) — waiting on your approval`;
  }
  if (p.status === "approved") return `${which === "start" ? "Start" : "End"} approved — ${fmtTime(p.confirmedAt)}`;
  return `${who}'s ${which} of ${fmtTime(p.confirmedAt)} was not approved`;
}
