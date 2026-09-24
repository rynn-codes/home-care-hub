import { OVERTIME_AFTER_HOURS, OVERTIME_MULTIPLIER, type CaregiverHours, type PayrollExceptionKind, type TimeEntry } from "@/domain/payroll/hours";

/**
 * The payroll roster's reading of each caregiver's week: what stands in the
 * way, what the overtime looks like against what was approved, and the day
 * by day hours the drawer shows. Joy hands hours to Gusto; the gross here
 * is Joy's own arithmetic for checking the week, never what is paid.
 */

export type PayrollStatus = "cleared" | "needs_review" | "missing_information" | "ot_approved" | "unexpected_ot" | "above_approved_ot";

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  cleared: "Cleared",
  needs_review: "Needs review",
  missing_information: "Missing information",
  ot_approved: "OT approved",
  unexpected_ot: "Unexpected OT",
  above_approved_ot: "Above approved OT",
};

export const PAYROLL_STATUS_PILL: Record<PayrollStatus, string> = {
  cleared: "bg-[var(--wash-strong)] text-muted-foreground",
  ot_approved: "bg-[#ECFDF3] text-[#027A48]",
  needs_review: "bg-[#FFFAEB] text-[#B54708]",
  above_approved_ot: "bg-[#FFFAEB] text-[#B54708]",
  unexpected_ot: "bg-[#FEF3F2] text-[#B42318]",
  missing_information: "bg-[#FEF3F2] text-[#B42318]",
};

/** "Certified Nursing Assistant" → "CNA"; a blank title is a caregiver. */
export function roleLabel(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (t === "") return "Caregiver";
  const n = t.toLowerCase();
  if (n.includes("certified nursing assistant") || /\bcna\b/.test(n)) return "CNA";
  if (n.includes("home health aide") || /\bhha\b/.test(n)) return "HHA";
  if (n.includes("registered nurse") || /\brn\b/.test(n)) return "RN";
  if (n.includes("caregiver") || n.includes("aide") || n.includes("attendant")) return "Caregiver";
  return t;
}

/** Regular at the rate, overtime at time and a half. Null without a rate. */
export function grossFor(input: { regularHours: number; overtimeHours: number; rate: number | null }): number | null {
  if (input.rate === null) return null;
  const gross = input.regularHours * input.rate + input.overtimeHours * input.rate * OVERTIME_MULTIPLIER;
  return Math.round(gross * 100) / 100;
}

/** Where a caregiver's week stands, and the one line that says why. */
export function payrollStatus(input: { hours: CaregiverHours; approvedOvertime: number }): { status: PayrollStatus; detail: string | null } {
  const blocking = input.hours.exceptions.find((e) => e.blocking);
  if (blocking) {
    return { status: blocking.kind === "documentation_gap" || blocking.kind === "visit_without_time" ? "missing_information" : "needs_review", detail: blocking.detail };
  }
  const first = input.hours.exceptions[0];
  if (first) return { status: "needs_review", detail: first.detail };
  const ot = input.hours.overtimeHours;
  if (ot <= 0) return { status: "cleared", detail: null };
  if (input.approvedOvertime <= 0) return { status: "unexpected_ot", detail: `${ot} hrs nobody approved in advance` };
  if (ot > input.approvedOvertime + 5e-3) return { status: "above_approved_ot", detail: `${ot} hrs worked against ${input.approvedOvertime} approved` };
  return { status: "ot_approved", detail: `${ot} hrs approved in advance` };
}

/** "3 hrs", "1 hr". */
export function hoursLabel(n: number): string {
  const h = Math.round(n * 100) / 100;
  return `${h} ${h <= 1 ? "hr" : "hrs"}`;
}

export interface OvertimeAsk {
  headline: string;
  detail: string;
  button: string;
  /** The hours nobody has put their name to yet. */
  variance: number;
}

/** What the drawer asks when overtime was worked beyond what was approved. */
export function overtimeAsk(input: { actualOvertime: number; approvedOvertime: number; approvedBy: string | null; approvedAt: string | null }): OvertimeAsk | null {
  const actual = Math.round(input.actualOvertime * 100) / 100;
  if (actual <= 0) return null;
  const approved = Math.max(0, Math.round(input.approvedOvertime * 100) / 100);
  const variance = Math.round((actual - approved) * 100) / 100;
  if (variance <= 0) return null;
  const headline = `${actual} overtime hours`;
  if (approved <= 0) {
    return {
      headline,
      detail: `${hoursLabel(actual)} worked with nothing approved in advance. Approving records that somebody looked and agreed — the hours are being paid either way.`,
      button: `Approve ${hoursLabel(actual)} overtime`,
      variance,
    };
  }
  const who = input.approvedBy && input.approvedAt ? ` on ${input.approvedAt} by ${input.approvedBy}` : input.approvedBy ? ` by ${input.approvedBy}` : "";
  return { headline, detail: `${hoursLabel(variance)} above the ${hoursLabel(approved)} approved during scheduling${who}.`, button: `Approve ${hoursLabel(variance)} above approved OT`, variance };
}

export interface DayHours {
  on: string;
  /** Null when nothing was clocked that day. */
  hours: number | null;
}

/** Clocked hours per day across a period, from the closed entries. */
export function dailyHours(input: { entries: readonly TimeEntry[]; caregiverPersonId: string; start: string; end: string }): DayHours[] {
  const byDay = new Map<string, number>();
  for (const e of input.entries) {
    if (e.caregiverPersonId !== input.caregiverPersonId || !e.clockedOutAt) continue;
    const day = e.clockedInAt.slice(0, 10);
    if (day < input.start || day > input.end) continue;
    const hours = (new Date(e.clockedOutAt).getTime() - new Date(e.clockedInAt).getTime()) / 36e5;
    byDay.set(day, Math.round(((byDay.get(day) ?? 0) + hours) * 100) / 100);
  }
  const out: DayHours[] = [];
  const d = new Date(`${input.start}T12:00:00`);
  const end = new Date(`${input.end}T12:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  while (d <= end && out.length < 31) {
    const on = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({ on, hours: byDay.get(on) ?? null });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** The days on which the running total crossed the overtime line. */
export function overtimeDays(input: { days: readonly DayHours[]; after?: number }): string[] {
  const line = input.after ?? OVERTIME_AFTER_HOURS;
  let running = 0;
  const out: string[] = [];
  for (const day of input.days) {
    if (day.hours === null) continue;
    running += day.hours;
    if (running > line + 5e-3) out.push(day.on);
  }
  return out;
}

export type ExceptionCategory = "Time & clock" | "Verification" | "Documentation" | "Overtime";
export const EXCEPTION_TABS: ReadonlyArray<"All" | ExceptionCategory> = ["All", "Time & clock", "Verification", "Documentation", "Overtime"];

export function categoryOf(kind: PayrollExceptionKind): ExceptionCategory {
  return kind === "awaiting_verification" ? "Verification" : kind === "documentation_gap" ? "Documentation" : "Time & clock";
}

export const EXCEPTION_LABELS: Record<PayrollExceptionKind, string> = {
  open_entry: "Still on the clock",
  visit_without_time: "Visit with no time",
  implausible_length: "Implausible shift length",
  awaiting_verification: "Review unfinished",
  documentation_gap: "Documentation gap",
};

/** What actually clears each exception — the drawer says it instead of faking a button. */
export const CLEARS_WHEN: Record<PayrollExceptionKind, string> = {
  open_entry: "This clears when the caregiver clocks out, or the office records the clock-out she missed.",
  visit_without_time: "This clears when somebody who knows what happened approves hours for the visit — the verified-unit review the database migrations carry.",
  implausible_length: "This clears when the clock-out is corrected to the real end of the shift.",
  awaiting_verification: "This clears when the review that was started is finished and the hours are approved.",
  documentation_gap: "This does not hold up pay. It clears when the outstanding documentation is filed.",
};
