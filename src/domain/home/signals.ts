import { openShifts, type Visit } from "@/domain/scheduling/conflicts";
import { complianceAlerts } from "@/domain/credentials/alerts";
import type { CredentialRequirement } from "@/domain/documents/types";
import { isStale, ONBOARDING_ORDER, type Applicant } from "@/domain/hiring/pipeline";
import { payrollRun, type TimeEntry, type VisitStub } from "@/domain/payroll/hours";
import { ageing, buildInvoice, type ClientBillingTerms } from "@/domain/billing/invoice";
import { buildPortalQueue, queueCounts } from "@/domain/portal/officeQueue";
import type { Moment } from "@/domain/portal/moments";
import type { Preference } from "@/domain/portal/preferences";
import type { Invitation } from "@/domain/hiring/invitation";
import type { RequestedDocument } from "@/domain/portal/familyPortal";
import { CLASSIFY_WITHIN_HOURS, incidentUrgency, type Incident } from "@/domain/incidents/incidents";
import { carePlanQueue, type CarePlan } from "@/domain/carePlan/plan";
import { supervisionQueue, type SupervisoryVisit } from "@/domain/supervision/supervision";

/**
 * The figures on Home, computed from the same engines the modules use.
 *
 * §25 requires Home to query the real domain rather than dashboard-specific
 * tables, and until now the priority strip did neither: it read six hardcoded
 * numbers out of `joySeed`. That is worse than it sounds. Home is the first
 * screen anybody sees, and a strip saying four open shifts while Scheduling
 * shows two is not a stale figure — it is Joy contradicting itself in the place
 * somebody forms their first opinion of whether it can be trusted.
 *
 * So every signal composes a function that already exists and is already tested
 * elsewhere. Nothing here decides anything: `openShifts`, `complianceAlerts`,
 * `payrollRun`, `buildInvoice` and `buildPortalQueue` are the same calls
 * Scheduling, Operations, Payroll, Billing and Portal activity make. A
 * disagreement between Home and a module would be a bug in one of those rather
 * than a difference of emphasis, which is what §27's one rule engine, many
 * views is for.
 */

export interface HomeSignal {
  key: string;
  label: string;
  /** A short string rather than a number — some of these are words. */
  value: string;
  to: string;
  /** Somebody at Joy must act. Drives the "needs you" marker. */
  urgent: boolean;
  detail?: string;
}

export interface HomeSignalInput {
  visits: readonly Visit[];
  applicants: readonly Applicant[];
  workforce: Parameters<typeof complianceAlerts>[0];
  requirements: readonly CredentialRequirement[];
  billingTerms: readonly ClientBillingTerms[];
  timeEntries: readonly TimeEntry[];
  payrollVisits: readonly VisitStub[];
  payrollPeople: ReadonlyArray<{ personId: string; name: string }>;

  /**
   * The portal's own inputs — but NOT its time entries or its clock.
   *
   * An earlier version took a whole `OfficeQueueInput`, which meant the caller
   * passed `timeEntries` twice and `asOf` twice. Two copies of the same fact is
   * two chances to disagree, and a module whose entire purpose is that Home and
   * the modules agree should not be the place that starts a divergence. The
   * queue is built below from the fields already here.
   */
  moments: readonly Moment[];
  preferences: readonly Preference[];
  invitations: readonly Invitation[];
  documentRequests: readonly RequestedDocument[];
  nameFor: (personId: string) => string;
  incidents: readonly Incident[];
  carePlans: readonly CarePlan[];
  supervisoryVisits: readonly SupervisoryVisit[];
  /**
   * The clients Joy is actually serving, for the care-plan and supervision
   * queues. `startOfCare` is what the annual supervision clock runs from.
   */
  servedClients: ReadonlyArray<{ personId: string; name: string; startOfCare: string }>;
  /** Monday of the current week, for billing. */
  weekStart: string;
  payPeriod: { start: string; end: string };
  today: string;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function homeSignals(input: HomeSignalInput): HomeSignal[] {
  const { today } = input;

  // Only shifts still to come. One that went uncovered last Tuesday is a fact
  // for a report, not something anybody can act on this morning.
  const open = openShifts(input.visits).filter((v) => v.startsAt.slice(0, 10) >= today);

  const alerts = complianceAlerts(input.workforce, input.requirements, today);
  const blocking = alerts.filter((a) => a.severity === "blocking").length;

  const orientations = input.applicants.filter(
    (a) =>
      a.track === "onboarding" &&
      a.onboardingStage != null &&
      ONBOARDING_ORDER.indexOf(a.onboardingStage) <= ONBOARDING_ORDER.indexOf("field_orientation"),
  ).length;

  const stale = input.applicants.filter((a) => isStale(a, today)).length;

  const run = payrollRun({
    period: input.payPeriod,
    people: input.payrollPeople,
    entries: input.timeEntries,
    visits: input.payrollVisits,
  });

  const invoices = input.billingTerms.map((terms) =>
    buildInvoice({ terms, visits: input.visits, weekStart: input.weekStart }),
  );
  const unpriced = invoices.filter((i) => i.state === "cannot_bill").length;
  const overdue = invoices.filter(
    (i) =>
      i.state !== "cannot_bill" &&
      ageing({ dueOn: i.dueOn, paid: false, total: i.total, asOf: today }).daysOverdue > 0,
  ).length;

  // An incident past a notification deadline is the most urgent thing Joy can
  // show, because the clock belongs to somebody outside the office.
  const openIncidents = input.incidents.filter((i) => i.state !== "closed");
  const lateIncidents = openIncidents.filter((i) => {
    const u = incidentUrgency(i, `${today}T23:59:59Z`);
    // The same threshold the Incidents screen reads, not a copy of the
    // number. A second literal here is how Home starts disagreeing with the
    // module it links to.
    return u.overdue.length > 0 || (u.unclassifiedFor ?? 0) >= CLASSIFY_WITHIN_HOURS;
  }).length;

  // A client receiving care under no written plan. There was no screen in Joy
  // that could tell you this was happening until the care plan module existed.
  const planRows = carePlanQueue({
    clients: input.servedClients,
    plans: input.carePlans,
    today,
  });
  const unplanned = planRows.filter((r) => r.reason === "no_plan").length;
  const planQueue = planRows.filter((r) => r.needsYou).length;

  const portal = queueCounts(
    buildPortalQueue({
      moments: input.moments,
      preferences: input.preferences,
      // The same entries payroll just read, by construction.
      timeEntries: input.timeEntries,
      invitations: input.invitations,
      documentRequests: input.documentRequests,
      nameFor: input.nameFor,
      asOf: today,
    }),
  );

  // The annual supervision the service agreement commits Joy to.
  //
  // This signal existed before the supervision module did, and read
  // `clientCompliance` over an input the live wiring passed as an empty array —
  // so it printed 0 whatever was true, and linked to a screen that could not
  // have done anything about it. It now reads the same queue the Supervisory
  // visits screen does. Overdue and due-soon only: a booked visit is on the
  // calendar and is nobody's problem this morning.
  const supervision = supervisionQueue({
    clients: input.servedClients.filter((c) => c.startOfCare),
    visits: input.supervisoryVisits,
    today,
  }).filter((row) => row.needsYou).length;

  return [
    {
      key: "incidents",
      label: "Incidents",
      value: String(openIncidents.length),
      to: "/operations/incidents",
      urgent: lateIncidents > 0,
      detail:
        lateIncidents > 0
          ? `${lateIncidents} past a deadline`
          : openIncidents.length > 0
            ? "Open, nothing overdue"
            : "Nothing open",
    },
    {
      key: "care-plans",
      label: "Care plans",
      value: String(planQueue),
      to: "/clients/care-plans",
      // Only an unwritten plan is urgent. A revision waiting a day is work;
      // somebody being cared for with nothing written down is a problem.
      urgent: unplanned > 0,
      detail:
        unplanned > 0
          ? `${unplanned} with no plan at all`
          : planQueue > 0
            ? "Waiting on a review"
            : "All current",
    },
    {
      key: "open-shifts",
      label: "Open shifts",
      value: String(open.length),
      to: "/scheduling",
      urgent: open.length > 0,
      detail: open.length > 0 ? "Nobody assigned yet" : "All covered",
    },
    {
      key: "compliance",
      label: "Stops work",
      value: String(blocking),
      to: "/operations",
      urgent: blocking > 0,
      detail:
        blocking > 0
          ? `${plural(blocking, "Caregiver", "Caregivers")} cannot be scheduled`
          : "Everyone is in date",
    },
    {
      key: "hiring",
      label: "In orientation",
      value: String(orientations),
      to: "/operations/hiring",
      // Orientation is progress, not a problem — unless somebody has stalled.
      urgent: stale > 0,
      detail:
        stale > 0
          ? `${stale} ${plural(stale, "applicant has", "applicants have")} not moved in a week`
          : undefined,
    },
    {
      key: "portal",
      label: "From the portals",
      value: String(portal.needsYou),
      to: "/operations/portal",
      urgent: portal.needsYou > 0,
      detail: portal.waiting > 0 ? `${portal.waiting} with a caregiver or family` : undefined,
    },
    {
      key: "payroll",
      label: "Payroll",
      value: run.ready ? "Ready" : String(run.blockedBy.length),
      to: "/payroll",
      urgent: !run.ready,
      detail: run.ready
        ? `${run.totalHours} hours`
        : `${plural(run.blockedBy.length, "Caregiver", "Caregivers")} to sort out`,
    },
    {
      key: "billing",
      label: "Billing",
      value: unpriced > 0 ? String(unpriced) : String(overdue),
      to: "/billing",
      urgent: unpriced > 0 || overdue > 0,
      detail:
        unpriced > 0
          ? `${plural(unpriced, "Invoice", "Invoices")} with no rate`
          : overdue > 0
            ? `${plural(overdue, "Invoice", "Invoices")} overdue`
            : "Nothing outstanding",
    },
    {
      key: "supervision",
      label: "Supervisory visits",
      value: String(supervision),
      to: "/clients/supervision",
      urgent: supervision > 0,
      detail: supervision > 0 ? "Due or overdue" : "All current",
    },
  ];
}

/**
 * The one line at the top — §30's rule applied to the office.
 *
 * Named rather than counted. "Three things need you" is a number; "open shifts
 * and payroll need you" is a morning somebody can start.
 */
export function homeHeadline(signals: readonly HomeSignal[]): string {
  const urgent = signals.filter((s) => s.urgent);
  if (urgent.length === 0) return "Nothing needs you this morning.";

  const names = urgent.map((s) => s.label.toLowerCase());
  if (names.length === 1) return `${names[0]} needs you.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} need you.`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} need you.`;
}
