/**
 * Clocking in before the shift.
 *
 * A caregiver who arrives early is not refused — she is clocked in, and her
 * paid time starts at the shift, less the agency's grace. The office can
 * authorise an early start for a particular visit, in which case the clock
 * counts from the tap. Either way the verdict says out loud when the time
 * counts from, because a caregiver who reads "clocked in 8:40" and is paid
 * from 8:55 has been told something untrue.
 */
export const DEFAULT_GRACE_MINUTES = 5;

const MINUTE = 60_000;

export type EarlyVerdict = "on_time" | "late" | "within_grace" | "authorized_early" | "held";

export interface EarlyClockIn {
  verdict: EarlyVerdict;
  tappedAt: string;
  /** When paid time starts. The tap, unless the clock was held to the grace line. */
  countsFrom: string;
  earlyByMinutes: number;
  heldMinutes: number;
  message: string;
}

function localIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** "1 minute", "12 minutes", "1.5 hours". */
export function minutesLabel(minutes: number): string {
  if (minutes === 1) return "1 minute";
  if (minutes < 90) return `${minutes} minutes`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} hours`;
}

export function earlyClockIn(input: { scheduledStart: string; tappedAt: string; graceMinutes?: number; authorizedEarly?: boolean }): EarlyClockIn {
  const grace = input.graceMinutes ?? DEFAULT_GRACE_MINUTES;
  const start = new Date(input.scheduledStart).getTime();
  const tapped = new Date(input.tappedAt).getTime();
  const earlyBy = Math.max(0, Math.floor((start - tapped) / MINUTE));
  const base = { tappedAt: input.tappedAt, countsFrom: input.tappedAt, earlyByMinutes: earlyBy, heldMinutes: 0 };

  if (earlyBy === 0) {
    return { ...base, verdict: tapped > start ? "late" : "on_time", message: `Clocked in at ${clock(input.tappedAt)}.` };
  }
  if (earlyBy <= grace) {
    return { ...base, verdict: "within_grace", message: `Clocked in at ${clock(input.tappedAt)}, ${minutesLabel(earlyBy)} early.` };
  }
  if (input.authorizedEarly) {
    return { ...base, verdict: "authorized_early", message: `Clocked in at ${clock(input.tappedAt)}. The office authorized an early start, so your time starts now.` };
  }
  const countsFromMs = start - grace * MINUTE;
  const countsFrom = localIso(countsFromMs);
  return {
    ...base,
    verdict: "held",
    countsFrom,
    heldMinutes: Math.max(0, Math.round((countsFromMs - tapped) / MINUTE)),
    message: `You're ${minutesLabel(earlyBy)} early. You're clocked in — your time starts at ${clock(countsFrom)}, ${minutesLabel(grace)} before the shift.`,
  };
}
