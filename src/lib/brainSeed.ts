import { billingWeekStart } from "@/domain/billing/run";

/**
 * Deterministic demo seed for The Brain — the home screen from the updated
 * design (docs/mockups/Joy Health The Brain.dc.html).
 *
 * ONE CAST, EVERYWHERE. The mock's illustrative people (Danielle Carter,
 * Sarah Johnson, Mrs. Davis, Mike Chen, Maya Patel…) are replaced by the demo's
 * unified cast: Joy Health's real staff (Chanel P, Bedjine Cupidon, Thylia,
 * Kelsey Westley RN, John Segura…) and the fictional clients every other
 * screen carries (Lian Huang, Dolores Vance, Susan Miller, Marcus Bell…).
 * The items themselves anchor to facts other screens already show — Bedjine's
 * CPR really is the one expiring, Dolores's records authorization really is
 * the lapsed one, Susan Miller really did ask about increased hours — so The
 * Brain can never contradict the module screens.
 *
 * CLIENT NAMES ARE FICTIONAL AND MUST STAY FICTIONAL — the same rule as every
 * other seed: a real client's name in a committed file is a disclosure.
 *
 * Dates are computed from the current Saturday–Friday agency week so the
 * screen reads live on any day the demo is opened.
 */

const sat = new Date(`${billingWeekStart(new Date().toISOString())}T12:00:00`);

/** ISO date N days after the current agency week's Saturday. */
export function agencyDay(offset: number): string {
  const d = new Date(sat);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const AGENCY_WEEK = { start: agencyDay(0), end: agencyDay(6) };

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

export const weekLabel = `${shortDate(AGENCY_WEEK.start)} – ${shortDate(AGENCY_WEEK.end)}`;

// ------------------------------------------------------- Joy Operations --

export interface BrainAudit {
  title: string;
  subtitle: string;
  status: string;
  why: string;
  timeline: Array<[string, string]>;
  channel: string;
  next: string;
  sources: string[];
  cta: string;
  href: string;
}

export interface BrainWorking {
  title: string;
  area: string;
  summary: string;
  next: string;
  updated: string;
  cta: string;
  href: string;
  audit: BrainAudit;
}

export const brainWorking: BrainWorking[] = [
  {
    title: "Background check · Brandon",
    area: "Hiring / onboarding",
    summary: "Joy checked provider status at 8:04 AM. Status remains processing.",
    next: "Joy will check again tomorrow morning.",
    updated: "8:04 AM",
    cta: "View candidate",
    href: "/operations/hiring",
    audit: {
      title: "Background check",
      subtitle: "Brandon · onboarding",
      status: "Waiting on provider response",
      why: "A background check must clear before Brandon can be scheduled. The provider has not returned a result within the expected 48-hour window.",
      timeline: [
        [shortDate(agencyDay(-2)), "Check submitted to provider"],
        ["8:04 AM", "Status polled — still processing"],
        ["8:05 AM", "Hiring record updated"],
      ],
      channel: "Provider API",
      next: `Joy polls again tomorrow at 8:00 AM and escalates to hiring on ${shortDate(agencyDay(4))}.`,
      sources: ["Candidate record · Brandon", "Background check request"],
      cta: "Open candidate",
      href: "/operations/hiring",
    },
  },
  {
    title: "Missing clock-out · Chanel P",
    area: "Payroll / timekeeping",
    summary: "Joy identified a missing clock-out from Saturday's Huang shift. Caregiver contacted at 7:48 AM.",
    next: "Second follow-up at 10:00 AM if unresolved.",
    updated: "7:48 AM",
    cta: "View shift",
    href: "/payroll",
    audit: {
      title: "Missing clock-out",
      subtitle: "Chanel P · Huang shift",
      status: "Waiting for caregiver correction",
      why: "Saturday's shift contains a clock-in but no clock-out. A payroll rule flagged the record at 7:42 AM.",
      timeline: [
        ["7:42 AM", "Missing clock-out detected"],
        ["7:43 AM", "Shift and caregiver record checked"],
        ["7:48 AM", "Caregiver reminder queued"],
        ["7:48 AM", "Status changed to Waiting"],
      ],
      channel: "Spruce · not wired yet",
      next: "Second follow-up at 10:00 AM if no response. Escalate to payroll review at 2:00 PM.",
      sources: [`Shift · ${shortDate(agencyDay(0))}`, "Timecard record", "Employee profile · Chanel P"],
      cta: "Open payroll",
      href: "/payroll",
    },
  },
  {
    title: "Payroll corrections",
    area: `Payroll · ${weekLabel}`,
    summary: "Two corrected timecards are outstanding. Joy queued reminders this morning.",
    next: "Escalate at 2:00 PM if unresolved.",
    updated: "7:42 AM",
    cta: "View payroll",
    href: "/payroll",
    audit: {
      title: "Payroll corrections",
      subtitle: `Payroll · ${weekLabel}`,
      status: "Two corrections outstanding",
      why: `Payroll closes ${shortDate(agencyDay(2))}. Two timecards fall outside the expected hour range for their scheduled shifts.`,
      timeline: [
        ["7:38 AM", "Payroll pre-check run"],
        ["7:42 AM", "Reminders queued for 2 caregivers"],
      ],
      channel: "Spruce · not wired yet",
      next: "Escalate to payroll review at 2:00 PM if corrections are not received.",
      sources: [`Payroll cycle ${weekLabel}`, "Two flagged timecards"],
      cta: "Open payroll",
      href: "/payroll",
    },
  },
];

export const brainHandled: Array<{ title: string; meta: string; time: string }> = [
  { title: "CPR renewal reminder sent", meta: "Bedjine Cupidon · expires Oct 1", time: "8:12 AM" },
  { title: "Records authorization renewal request sent", meta: "Dolores Vance · lapsed Feb 1", time: "7:58 AM" },
  { title: "Schedule confirmation sent", meta: "Brandon · field orientation 2:00 PM", time: "7:42 AM" },
  { title: "Medication list request sent", meta: "Marcus Bell · before the 10:30 assessment", time: "7:31 AM" },
  { title: "Shift confirmations sent to 6 caregivers", meta: `Week of ${shortDate(AGENCY_WEEK.start)}`, time: "7:14 AM" },
  { title: "Referral acknowledged to Mercy Discharge Planning", meta: "Ruth Alvarez · admissions", time: "6:58 AM" },
];

export const brainWaiting: Array<{ title: string; state: string; next: string; cta: string; href: string }> = [
  {
    title: "CPR renewal · Bedjine Cupidon",
    state: "Requested Aug 12 · reminder sent today",
    next: `Waiting on document upload · next follow-up ${shortDate(agencyDay(3))}`,
    cta: "View credential",
    href: "/employees",
  },
  {
    title: "Records authorization · Dolores Vance",
    state: "Renewal request resent this morning",
    next: "Waiting on the family · next follow-up tomorrow",
    cta: "View client",
    href: "/clients",
  },
  {
    title: "Background check · Brandon",
    state: `Submitted ${shortDate(agencyDay(-2))} · polled today`,
    next: `Waiting on provider · escalates ${shortDate(agencyDay(4))}`,
    cta: "View candidate",
    href: "/operations/hiring",
  },
  {
    title: "Family signature · Evelyn Carter",
    state: "Packet sent Aug 13 · reminder sent Aug 14",
    next: "Waiting on the family · Joy follows up again tomorrow",
    cta: "View admission",
    href: "/admissions",
  },
];

/**
 * The one decision waiting on a human. Deliberately not a rate change — the
 * mock's "18.00 → $19.50/hr" would put a client rate on screen, and rates are
 * e-mailed privately and never stored (the same recorded rule that keeps them
 * off Billing's Payers tab). Susan Miller's hours request is a real fact the
 * roster already shows ("Asked about increased hours · Aug 21").
 */
export const brainNeedsYou = {
  title: "Hours increase · Susan Miller",
  subject: "12 → 16 hrs / week, requested by the family Aug 21",
  detail:
    "Joy drafted the schedule change — one added Thursday afternoon shift, coverable by Vanessa — and the billing impact from the agreement. The workflow paused at the approval boundary.",
  recommends: "Joy recommends: approve, based on the family's documented request.",
  href: "/clients",
};

// ------------------------------------------------------------- Calendar --

export interface BrainEvent {
  date: string; // ISO
  title: string;
  meta: string;
  cat: "Agency" | "Payroll" | "Billing" | "People";
  icon: string;
}

export const brainEvents: BrainEvent[] = [
  { date: agencyDay(2), title: "Payroll closes", meta: `Week of ${shortDate(AGENCY_WEEK.start)}`, cat: "Payroll", icon: "💵" },
  { date: agencyDay(2), title: "Approved invoices go out", meta: "The Monday send", cat: "Billing", icon: "📄" },
  { date: agencyDay(3), title: "Payroll processing", meta: "Gusto submission", cat: "Payroll", icon: "💵" },
  { date: agencyDay(2), title: "RN assessment · Marcus Bell", meta: "10:30 AM · Kelsey Westley, RN", cat: "Agency", icon: "🩺" },
  { date: agencyDay(4), title: "Thylia's birthday", meta: "Caregiver since 2023", cat: "People", icon: "🎂" },
  { date: agencyDay(7), title: "Saturday billing run", meta: "Drafts next week's invoices", cat: "Billing", icon: "📄" },
  { date: agencyDay(9), title: "Bedjine's work anniversary", meta: "2 years with Joy Health", cat: "People", icon: "🎉" },
  { date: agencyDay(11), title: "Monthly leadership review", meta: "10:00 AM · office", cat: "Agency", icon: "📅" },
];

// -------------------------------------------------------------- My Work --

export interface MyEvent {
  time: string;
  duration: string;
  title: string;
  meta: string;
  joyNote: string;
  tag: string;
  done: boolean;
  /** Opens the prepared-conference drawer. */
  drawer?: boolean;
}

export const myEvents: MyEvent[] = [
  {
    time: "9:00 AM",
    duration: "30 min",
    title: "Weekly leadership sync",
    meta: "Office",
    joyNote: "Notes captured by Joy",
    tag: "Completed",
    done: true,
  },
  {
    time: "2:00 PM",
    duration: "45 min",
    title: "Dolores Vance's family care conference",
    meta: "With Kelsey Westley, RN · client home",
    joyNote: "Family confirmed · care plan prepared",
    tag: "Open client",
    done: false,
    drawer: true,
  },
  {
    time: "4:00 PM",
    duration: "1 hr",
    title: "Field orientation · Brandon",
    meta: "Shadowing Chanel P",
    joyNote: "Documents ready",
    tag: "Orientation",
    done: false,
  },
];

export const myTomorrow: Array<{ time: string; label: string }> = [
  { time: "9:30 AM", label: "Payroll review" },
  { time: "1:00 PM", label: "Supervisory visit · Edward Pham" },
];

export interface MyNeed {
  title: string;
  subject: string;
  joyNote: string;
  due: string;
  cta: string;
  href: string;
}

export const myNeeds: MyNeed[] = [
  {
    title: "Approve hours increase",
    subject: "Susan Miller · 12 → 16 hrs / week",
    joyNote: "Joy drafted the schedule change and the billing impact.",
    due: "Due today",
    cta: "Review & approve →",
    href: "/clients",
  },
  {
    title: "Final payroll approval",
    subject: `Payroll · ${weekLabel}`,
    joyNote: "2 timecard corrections chased by Joy. Payroll is ready for review.",
    due: `Closes ${shortDate(agencyDay(2))}`,
    cta: "Review payroll →",
    href: "/payroll",
  },
];

// ------------------------------------------------------------- Activity --

export interface BrainActivity {
  time: string;
  title: string;
  meta: string;
  cat: "Clients" | "Employees" | "Payroll" | "Billing" | "Joy";
  cta: string;
  href: string;
}

export const brainActivity: BrainActivity[] = [
  { time: "8:12 AM", title: "Joy sent Bedjine Cupidon's CPR reminder", meta: "Joy · employees", cat: "Joy", cta: "View employee", href: "/employees" },
  { time: "7:58 AM", title: "Dolores Vance's records authorization request was resent", meta: "Joy · clients", cat: "Joy", cta: "View client", href: "/clients" },
  { time: "7:42 AM", title: "Payroll reminders queued for 2 caregivers", meta: "Joy · payroll", cat: "Payroll", cta: "View payroll", href: "/payroll" },
  { time: "Yesterday", title: "Brandon completed Gusto onboarding", meta: "Candidate · hiring", cat: "Employees", cta: "View candidate", href: "/operations/hiring" },
  { time: "Yesterday", title: "Ruth Alvarez's Wednesday shift reopened — caregiver call-out", meta: "Scheduler · scheduling", cat: "Employees", cta: "View schedule", href: "/scheduling" },
  { time: "Friday", title: "Incident classified for Dolores Vance — family notified", meta: "Kelsey Westley · incidents", cat: "Clients", cta: "View incident", href: "/operations/incidents" },
  { time: "Friday", title: `Invoice batch approved for ${shortDate(agencyDay(-7))} – ${shortDate(agencyDay(-1))}`, meta: "Karynn Verrett · billing", cat: "Billing", cta: "View billing", href: "/billing" },
];
