/**
 * Clocking out before the shift is worked.
 *
 * A shift is a number of hours the client is paying for. Starting late does
 * not shorten it — it moves the end. Clocking out with a good part of it
 * unworked is allowed, because nobody is held on the clock, but the caregiver
 * is told plainly how much is left so a short shift is a choice and not a
 * surprise on the invoice.
 */
export const SHORT_BY_MINUTES = 5;

const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);

/** When this shift is due to end, given when it actually started. */
export function shiftDueAt(input: { scheduledStartsAt: string; scheduledEndsAt: string; clockedInAt: string | null }): string | null {
  const start = new Date(input.scheduledStartsAt).getTime();
  const end = new Date(input.scheduledEndsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  if (!input.clockedInAt) return input.scheduledEndsAt;
  const started = new Date(input.clockedInAt).getTime();
  if (Number.isNaN(started) || started <= start) return input.scheduledEndsAt;
  const due = new Date(started + (end - start));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}:00`;
}

export interface ShortShiftCheck {
  lateBy: number;
  dueAt: string | null;
  shortBy: number;
  short: boolean;
}

export function shortShiftCheck(input: { scheduledStartsAt: string; scheduledEndsAt: string; clockedInAt: string | null; at: string }): ShortShiftCheck {
  const dueAt = shiftDueAt(input);
  const lateBy = input.clockedInAt === null ? 0 : Math.max(0, minutesBetween(input.scheduledStartsAt, input.clockedInAt));
  const shortBy = dueAt === null ? 0 : Math.max(0, minutesBetween(input.at, dueAt));
  return { lateBy, dueAt, shortBy, short: shortBy > SHORT_BY_MINUTES };
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** The warning above the clock-out button, or nothing when the shift is worked. */
export function shortShiftWarning(input: { check: ShortShiftCheck; fmt: (iso: string) => string }): string | null {
  const { check, fmt } = input;
  if (!check.short || check.dueAt === null) return null;
  const left = durationLabel(check.shortBy);
  return check.lateBy > 0
    ? `You started ${durationLabel(check.lateBy)} late, so this shift runs to ${fmt(check.dueAt)}. Clocking out now leaves ${left} of it unworked.`
    : `This shift runs to ${fmt(check.dueAt)}. Clocking out now leaves ${left} unworked.`;
}
