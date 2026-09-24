import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * A client's recurring schedule and the agreement that describes it.
 *
 * The signed Acknowledgement and Agreement states a services-and-schedule
 * page. When the schedule Joy actually delivers drifts from it for longer
 * than a fortnight, an amendment is due — care carries on regardless, the
 * signed agreement stands, and Joy drafts the wording for a person to send.
 *
 * Revising a schedule ends the old one the day before the new one starts and
 * expands the new one into visits three months ahead (see `expandSchedule`).
 */

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface DayTimes {
  /** "HH:MM", 24-hour. */
  start: string;
  end: string;
}

export interface ClientSchedule {
  id: string;
  clientPersonId: string;
  clientName: string;
  caregiverName: string | null;
  /** Keyed by JS weekday (0 = Sunday). */
  days: Record<number, DayTimes>;
  startsOn: string;
  endsOn: string | null;
  setBy: string;
  setAt: string;
  reason: string;
  supersedesId: string | null;
  agreementSentAt: string | null;
  agreementSignedAt: string | null;
  /** True when Joy generates this schedule's visits rather than the seed carrying them. */
  expands?: boolean;
}

export function scheduledDays(schedule: Pick<ClientSchedule, "days">): number[] {
  return Object.keys(schedule.days).map(Number).filter((d) => schedule.days[d]).sort((a, b) => a - b);
}

export function hoursOfDay(times: DayTimes): number {
  const [sh, sm] = times.start.split(":").map(Number);
  const [eh, em] = times.end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

export function weeklyHours(schedule: Pick<ClientSchedule, "days">): number {
  const total = scheduledDays(schedule).reduce((sum, d) => sum + hoursOfDay(schedule.days[d]), 0);
  return Math.round(total * 100) / 100;
}

/** "9:00 AM" from "09:00". */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function dayList(days: readonly number[]): string {
  const names = days.map((d) => DAY_NAMES[d]);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Mon, Wed and Fri · 9:00 AM – 1:00 PM · 12 hrs a week". */
export function describeSchedule(schedule: Pick<ClientSchedule, "days">): string {
  const days = scheduledDays(schedule);
  if (days.length === 0) return "No days set";
  const first = schedule.days[days[0]];
  const same = days.every((d) => schedule.days[d].start === first.start && schedule.days[d].end === first.end);
  const hours = weeklyHours(schedule);
  return same
    ? `${dayList(days)} · ${clockLabel(first.start)} – ${clockLabel(first.end)} · ${hours} hrs a week`
    : `${dayList(days)} · times vary by day · ${hours} hrs a week`;
}

export function sameSchedule(a: Pick<ClientSchedule, "days">, b: Pick<ClientSchedule, "days">): boolean {
  const da = scheduledDays(a);
  const db = scheduledDays(b);
  if (da.length !== db.length) return false;
  return da.every((d, i) => db[i] === d && a.days[d].start === b.days[d].start && a.days[d].end === b.days[d].end);
}

export function dateOnlyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dateOnlyOf(d);
}

export function scheduleOnDate(schedules: readonly ClientSchedule[], clientPersonId: string, date: string): ClientSchedule | null {
  return (
    schedules
      .filter((s) => s.clientPersonId === clientPersonId)
      .filter((s) => s.startsOn <= date && (s.endsOn === null || s.endsOn >= date))
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ?? null
  );
}

export function currentSchedule(schedules: readonly ClientSchedule[], clientPersonId: string, now: Date): ClientSchedule | null {
  return scheduleOnDate(schedules, clientPersonId, dateOnlyOf(now));
}

export function scheduleHistory(schedules: readonly ClientSchedule[], clientPersonId: string): ClientSchedule[] {
  return schedules.filter((s) => s.clientPersonId === clientPersonId).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export interface ScheduleRevision {
  ended: ClientSchedule;
  started: ClientSchedule;
}

export function reviseSchedule(input: {
  current: ClientSchedule;
  days: Record<number, DayTimes>;
  caregiverName: string | null;
  effectiveFrom: string;
  by: string;
  at: string;
  reason: string;
  id?: string;
}): ScheduleRevision {
  const { current, days, caregiverName, effectiveFrom, by, at, reason } = input;
  return {
    ended: { ...current, endsOn: dayBefore(effectiveFrom) },
    started: {
      id: input.id ?? `sch-${current.clientPersonId}-${effectiveFrom}`,
      clientPersonId: current.clientPersonId,
      clientName: current.clientName,
      caregiverName,
      days,
      startsOn: effectiveFrom,
      endsOn: null,
      setBy: by,
      setAt: at,
      reason,
      supersedesId: current.id,
      agreementSentAt: null,
      agreementSignedAt: null,
      expands: true,
    },
  };
}

export function scheduleDiff(before: Pick<ClientSchedule, "days">, after: Pick<ClientSchedule, "days">) {
  const b = new Set(scheduledDays(before));
  const a = new Set(scheduledDays(after));
  return {
    added: [...a].filter((d) => !b.has(d)).sort((x, y) => x - y),
    removed: [...b].filter((d) => !a.has(d)).sort((x, y) => x - y),
    retimed: [...a]
      .filter((d) => b.has(d) && (before.days[d].start !== after.days[d].start || before.days[d].end !== after.days[d].end))
      .sort((x, y) => x - y),
    hoursBefore: weeklyHours(before),
    hoursAfter: weeklyHours(after),
  };
}

// ---------------------------------------------------------------------------
// The agreement

/** Days a changed schedule may run before the agreement needs updating. */
export const AGREEMENT_GRACE_DAYS = 14;
/** Days after sending before Joy suggests a call. */
export const AGREEMENT_CHASE_AFTER_DAYS = 3;

export function daysSinceDate(date: string, now: Date): number {
  const from = new Date(`${date}T12:00:00`);
  if (Number.isNaN(from.getTime())) return 0;
  const to = new Date(now);
  to.setHours(12, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type AgreementStateKind = "no_schedule" | "settled" | "within_grace" | "needs_agreement";

export interface AgreementState {
  state: AgreementStateKind;
  current: ClientSchedule | null;
  lastAgreed: ClientSchedule | null;
  daysInForce: number;
  daysOfGraceLeft: number;
  asOf: Date;
}

export function agreementState(input: { schedules: readonly ClientSchedule[]; clientPersonId: string; now: Date }): AgreementState {
  const history = scheduleHistory(input.schedules, input.clientPersonId);
  const today = dateOnlyOf(input.now);
  const current = history.find((s) => s.startsOn <= today && (s.endsOn === null || s.endsOn >= today)) ?? null;
  const lastAgreed = history.find((s) => s.agreementSignedAt !== null) ?? null;
  if (!current) return { state: "no_schedule", current: null, lastAgreed, daysInForce: 0, daysOfGraceLeft: 0, asOf: input.now };
  const inForce = Math.max(0, daysSinceDate(current.startsOn, input.now));
  const graceLeft = Math.max(0, AGREEMENT_GRACE_DAYS - inForce);
  if (current.agreementSignedAt !== null || (lastAgreed && sameSchedule(current, lastAgreed))) {
    return { state: "settled", current, lastAgreed, daysInForce: inForce, daysOfGraceLeft: 0, asOf: input.now };
  }
  if (inForce <= AGREEMENT_GRACE_DAYS) {
    return { state: "within_grace", current, lastAgreed, daysInForce: inForce, daysOfGraceLeft: graceLeft, asOf: input.now };
  }
  return { state: "needs_agreement", current, lastAgreed, daysInForce: inForce, daysOfGraceLeft: 0, asOf: input.now };
}

export function agreementMessage(state: AgreementState): string {
  const { current, daysInForce, daysOfGraceLeft, asOf } = state;
  if (!current) return "No schedule on record.";
  switch (state.state) {
    case "settled":
      return "The signed agreement matches the schedule being delivered.";
    case "needs_agreement": {
      if (current.agreementSentAt) {
        const ago = daysSinceDate(current.agreementSentAt.slice(0, 10), asOf);
        return ago >= AGREEMENT_CHASE_AFTER_DAYS
          ? `Sent to ${current.clientName} ${ago} days ago and not back yet. Worth a call.`
          : `Sent to ${current.clientName} ${ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}. Care carries on either way.`;
      }
      return `This schedule has been running ${daysInForce} days. The agreement on file describes a different one.`;
    }
    case "within_grace":
      return daysOfGraceLeft === 1
        ? "Changed yesterday. If it is still this way tomorrow, the agreement needs updating."
        : `Changed ${daysInForce === 0 ? "today" : `${daysInForce} days ago`}. ${daysOfGraceLeft} days before an updated agreement is needed.`;
    default:
      return "No schedule on record.";
  }
}

export function amendmentText(input: { schedule: ClientSchedule; previous: ClientSchedule | null; services: readonly string[]; hourlyRate: number | null }): string {
  const { schedule, previous, services, hourlyRate } = input;
  const days = scheduledDays(schedule);
  const hours = weeklyHours(schedule);
  const lines = days.map((d) => `  ${dayList([d])}: ${clockLabel(schedule.days[d].start)} – ${clockLabel(schedule.days[d].end)}`);
  return [
    "AMENDMENT TO THE ACKNOWLEDGEMENT AND AGREEMENT — SERVICES AND SCHEDULE",
    "",
    `Client: ${schedule.clientName}`,
    `Effective: ${schedule.startsOn}`,
    "",
    "This amendment replaces the services and schedule stated in the agreement",
    "previously signed by the undersigned. All other terms of that agreement,",
    "including payment, cancellation, overtime and holiday terms, are unchanged",
    "and remain in force.",
    "",
    "Joy Healthcare Services, LLC. agrees to provide the following services:",
    `  ${services.join(", ")}`,
    "",
    "on the following days, at the following times:",
    ...lines,
    "",
    `Total weekly hours: ${hours}`,
    hourlyRate === null ? "Hourly rate: as stated in the agreement on file." : `Hourly rate: $${hourlyRate.toFixed(2)} per hour.`,
    "",
    previous
      ? `This replaces the schedule in force from ${previous.startsOn}${previous.endsOn ? ` to ${previous.endsOn}` : ""}: ${dayList(scheduledDays(previous))}, ${weeklyHours(previous)} hours a week.`
      : "No previous schedule is on record for this client.",
    "",
    "The undersigned acknowledges that the hours stated above are a commitment",
    "and not a maximum, and that invoicing follows the agreement on file.",
  ].join("\n");
}

export const AMENDMENT_NEEDS_ESIGN = true;

export function amendmentDisclaimer(): string {
  return "Drafted by Joy for review. Nothing has been sent and nothing has been signed — no e-signature provider is connected in this prototype.";
}

// ---------------------------------------------------------------------------
// Expansion into visits

/** How far ahead Joy keeps a recurring schedule booked. */
export const EXPANSION_DAYS = 91;

export function expansionHorizon(from: string | Date): string {
  const d = new Date(typeof from === "string" ? `${from}T12:00:00` : from);
  d.setDate(d.getDate() + EXPANSION_DAYS);
  return dateOnlyOf(d);
}

export function seriesVisitId(scheduleId: string, date: string): string {
  return `sch-${scheduleId}-${date}`;
}

export function scheduledDates(schedule: ClientSchedule, range: { from: string; to: string }): string[] {
  const from = schedule.startsOn > range.from ? schedule.startsOn : range.from;
  const to = schedule.endsOn && schedule.endsOn < range.to ? schedule.endsOn : range.to;
  if (to < from) return [];
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (schedule.days[cursor.getDay()]) out.push(dateOnlyOf(cursor));
  }
  return out;
}

export function expandSchedule(schedule: ClientSchedule, range: { from: string; to: string }, service = "Personal Care"): Array<Visit & { seriesId: string }> {
  return scheduledDates(schedule, range).map((date) => {
    const times = schedule.days[new Date(`${date}T12:00:00`).getDay()];
    return {
      id: seriesVisitId(schedule.id, date),
      clientName: schedule.clientName,
      clientPersonId: schedule.clientPersonId,
      service,
      caregiverName: schedule.caregiverName,
      startsAt: `${date}T${times.start}:00`,
      endsAt: `${date}T${times.end}:00`,
      seriesId: schedule.id,
    };
  });
}

/**
 * Drop the seed's standing visits that a revised schedule has replaced: a
 * seeded visit on or after the new schedule's start, at the old schedule's
 * time for that weekday, is the old pattern and comes off the board.
 */
export function withoutSuperseded<V extends Visit & { seriesId?: string }>(visits: readonly V[], schedules: readonly ClientSchedule[]): V[] {
  const revisions = schedules
    .filter((s) => s.expands && s.supersedesId)
    .map((s) => ({ started: s, ended: schedules.find((x) => x.id === s.supersedesId) ?? null }))
    .filter((r): r is { started: ClientSchedule; ended: ClientSchedule } => r.ended !== null);
  if (revisions.length === 0) return [...visits];
  return visits.filter((v) => {
    if ((v.seriesId && schedules.some((s) => s.id === v.seriesId && s.expands)) || v.eventType) return true;
    const date = v.startsAt.slice(0, 10);
    const start = new Date(v.startsAt);
    const hhmm = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    return !revisions.some(({ started, ended }) => {
      if (v.clientName !== started.clientName || date < started.startsOn) return false;
      const old = ended.days[start.getDay()];
      return !!old && old.start === hhmm;
    });
  });
}

/** Every expanding schedule's visits, from its start to three months past today. */
export function expandAll(schedules: readonly ClientSchedule[], today: string): Array<Visit & { seriesId: string }> {
  const horizon = expansionHorizon(today);
  return schedules.filter((s) => s.expands).flatMap((s) => expandSchedule(s, { from: s.startsOn, to: horizon }));
}

export function expansionSummary(input: { count: number; firstDay: string; lastDay: string; endsOn: string | null }): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const n = `${input.count} ${input.count === 1 ? "shift" : "shifts"}`;
  return input.endsOn
    ? `${n}, ${fmt(input.firstDay)} to ${fmt(input.endsOn)}.`
    : `${n} through ${fmt(input.lastDay)} — Joy keeps the next 3 months booked from here on.`;
}

/** How a single visit compares with the rest of its series. */
export function seriesPattern(visit: Visit & { seriesId?: string }, all: readonly (Visit & { seriesId?: string })[]) {
  if (!visit.seriesId) return null;
  const others = all.filter((v) => v.seriesId === visit.seriesId && v.id !== visit.id);
  if (others.length === 0) return null;
  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const hours = (v: Visit) => (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime()) / 3_600_000;
  const counts = new Map<string, number>();
  for (const o of others) {
    const key = `${hhmm(o.startsAt)}|${hours(o)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let usual = "";
  let best = 0;
  for (const [key, n] of counts) {
    if (n > best) {
      usual = key;
      best = n;
    }
  }
  const [usualStart, usualHours] = usual.split("|");
  const mine = `${hhmm(visit.startsAt)}|${hours(visit)}`;
  return { usualHours: Number(usualHours), usualStart, differs: mine !== usual, against: others.length };
}

export function seriesPatternLine(pattern: NonNullable<ReturnType<typeof seriesPattern>>, visit: Visit, fmtTime: (hhmm: string) => string): string {
  const hours = (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / 3_600_000;
  const d = new Date(visit.startsAt);
  const mine = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return pattern.differs
    ? `Usually ${fmtTime(pattern.usualStart)} for ${pattern.usualHours} hrs — this one is ${fmtTime(mine)} for ${hours} hrs`
    : "Matches the recurring schedule";
}
