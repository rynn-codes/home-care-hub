import { complianceAlerts } from "@/domain/credentials/alerts";
import type { CredentialRequirement } from "@/domain/documents/types";
import { annualIncidentLog } from "@/domain/incidents/annualLog";
import type { Incident } from "@/domain/incidents/incidents";
import { carePlanQueue, reviewOverdue, type CarePlan } from "@/domain/carePlan/plan";
import { supervisionQueue, type SupervisoryVisit } from "@/domain/supervision/supervision";
import { clientCompliance, type ClientInput } from "@/domain/clients/roster";

/**
 * Audit readiness — what a surveyor asks for, and whether Joy can show it.
 *
 * KARYNN, 21 AUGUST: "Is there a home for the audit portion? I feel like maybe
 * that is where the incident report log can go?"
 *
 * She is right, and asking the question found a gap. Joy could already build an
 * audit packet — but only for one employee at a time, reachable only from inside
 * that employee's record. So the thing an agency actually needs on the morning a
 * surveyor arrives, a single answer to "show me your files", did not exist
 * anywhere. You would have to know to open eleven employee records one at a time
 * and hope.
 *
 * This is that answer. Every line is a question somebody with a clipboard asks,
 * paired with what Joy can currently produce for it.
 *
 * TWO THINGS THIS FILE DELIBERATELY DOES NOT DO.
 *
 * It does not decide anything. Every count composes an engine that already
 * exists and is already tested — `complianceAlerts`, `carePlanQueue`,
 * `supervisionQueue`, `annualIncidentLog`, `clientCompliance`. A number here
 * that disagrees with the module it came from would be a bug in one of those,
 * not a difference of emphasis. That is §27 again, and it matters more here than
 * anywhere: a readiness screen that flatters is worse than none.
 *
 * And it does not claim to be the survey checklist. Texas licences home and
 * community support services agencies against a list Joy has, and this is not a
 * transcription of it. It is the subset Joy holds data for. `UNCOVERED` says so
 * out loud rather than letting a green screen imply completeness — which is the
 * specific way a readiness dashboard does harm.
 */

export type ReadinessState = "ready" | "gaps" | "not_held";

export interface ReadinessLine {
  key: string;
  /** The question, in the words somebody would actually ask it. */
  question: string;
  state: ReadinessState;
  /** What Joy can show, said plainly. */
  answer: string;
  /** Where to go and fix it, or look. */
  to: string;
  /** The specific things outstanding, when there are any. */
  gaps: string[];
}

/**
 * What a surveyor may ask for that Joy holds nothing on.
 *
 * Stated rather than omitted. A readiness screen listing six green lines, when
 * the real list has fifteen, tells somebody they are ready when they are not —
 * and it is the omissions, not the amber rows, that do that.
 */
export const UNCOVERED: readonly string[] = [
  "Emergency preparedness and disaster drills",
  "Infection control and hazardous waste disposal",
  "Client complaint log and its resolutions",
  "Governing body minutes and the annual agency evaluation",
  "In-service training hours per caregiver per year",
  "Client satisfaction surveys",
];

export interface SurveyReadinessInput {
  today: string;
  /** How many entries are on the trail. Zero means nothing calls the writer. */
  auditEntryCount: number;
  workforce: Parameters<typeof complianceAlerts>[0];
  requirements: readonly CredentialRequirement[];
  incidents: readonly Incident[];
  carePlans: readonly CarePlan[];
  servedClients: ReadonlyArray<{ personId: string; name: string; startOfCare: string }>;
  supervisoryVisits: readonly SupervisoryVisit[];
  /** The client roster, for the consents and records authorizations. */
  clients: readonly ClientInput[];
}

export interface SurveyReadiness {
  lines: ReadinessLine[];
  /** Lines with something outstanding. The number worth saying out loud. */
  withGaps: number;
  headline: string;
}

export function surveyReadiness(input: SurveyReadinessInput): SurveyReadiness {
  const year = Number(input.today.slice(0, 4));

  // ------------------------------------------------------ personnel files --
  const blocking = complianceAlerts(input.workforce, input.requirements, input.today).filter(
    (a) => a.severity === "blocking",
  );
  const peopleWithGaps = [...new Set(blocking.map((a) => a.employeeName))];

  // --------------------------------------------------------- care plans --
  const planRows = carePlanQueue({
    clients: input.servedClients,
    plans: input.carePlans,
    today: input.today,
  });
  const unplanned = planRows.filter((r) => r.reason === "no_plan");
  const staleReviews = input.carePlans.filter((p) => reviewOverdue(p, input.today));

  // -------------------------------------------------------- supervision --
  const supervisionDue = supervisionQueue({
    clients: input.servedClients.filter((c) => c.startOfCare),
    visits: input.supervisoryVisits,
    today: input.today,
  }).filter((r) => r.needsYou);

  // ---------------------------------------------------------- incidents --
  const log = annualIncidentLog({ incidents: input.incidents, year });
  const incidentGaps: string[] = [];
  if (log.neverClassified > 0) incidentGaps.push(`${log.neverClassified} never classified`);
  if (log.withMissedNotifications > 0) {
    incidentGaps.push(`${log.withMissedNotifications} where somebody was never told`);
  }
  if (log.withLateNotifications > 0) {
    incidentGaps.push(`${log.withLateNotifications} notified late`);
  }
  const rnMissed = log.rnVisitsRequired - log.rnVisitsOnTime;
  if (rnMissed > 0) incidentGaps.push(`${rnMissed} without the RN visit on time`);

  // ------------------------------------------------------- client files --
  const clientGaps = input.clients
    .map((client) => ({
      name: `${client.firstName} ${client.lastName}`,
      items: clientCompliance(client, input.today).filter(
        (i) => i.state === "overdue" || i.state === "missing",
      ),
    }))
    .filter((c) => c.items.length > 0);

  const lines: ReadinessLine[] = [
    {
      key: "personnel",
      question: "Show me the personnel file for each caregiver.",
      state: peopleWithGaps.length === 0 ? "ready" : "gaps",
      answer:
        peopleWithGaps.length === 0
          ? "Every file has its required credentials current."
          : `${peopleWithGaps.length} ${peopleWithGaps.length === 1 ? "file has" : "files have"} something blocking.`,
      to: "/employees",
      gaps: peopleWithGaps,
    },
    {
      key: "incidents",
      question: "Show me your incident log for the year.",
      state: log.total === 0 ? "ready" : incidentGaps.length === 0 ? "ready" : "gaps",
      answer:
        log.total === 0
          ? `Nothing reported in ${year}.`
          : `${log.total} reported in ${year}` +
            (incidentGaps.length === 0 ? ", every obligation met on time." : "."),
      to: "/operations/incidents/annual",
      gaps: incidentGaps,
    },
    {
      key: "care_plans",
      question: "Show me the plan of care for each client.",
      state: unplanned.length === 0 && staleReviews.length === 0 ? "ready" : "gaps",
      answer:
        unplanned.length === 0 && staleReviews.length === 0
          ? "Every client being served has a current, reviewed plan."
          : "Some clients are being served without a current plan.",
      to: "/clients/care-plans",
      gaps: [
        ...unplanned.map((r) => `${r.clientName} — no plan at all`),
        ...staleReviews.map((p) => `${p.clientName} — plan not reviewed in over a year`),
      ],
    },
    {
      key: "supervision",
      question: "Show me that services are supervised annually.",
      state: supervisionDue.length === 0 ? "ready" : "gaps",
      answer:
        supervisionDue.length === 0
          ? "Every client's supervisory visit is current or booked."
          : `${supervisionDue.length} due or overdue.`,
      to: "/clients/supervision",
      gaps: supervisionDue.map((r) => `${r.clientName} — ${r.dueOn}`),
    },
    {
      key: "client_files",
      question: "Show me the signed consents and authorizations for each client.",
      state: clientGaps.length === 0 ? "ready" : "gaps",
      answer:
        clientGaps.length === 0
          ? "Every client's authorizations are on file and current."
          : `${clientGaps.length} ${clientGaps.length === 1 ? "client has" : "clients have"} something expired or missing.`,
      to: "/clients",
      gaps: clientGaps.map((c) => `${c.name} — ${c.items.map((i) => i.label).join(", ")}`),
    },
    {
      key: "audit_trail",
      question: "Show me who changed this record, and when.",
      // The writer is now called at Joy's consequential write points, so the
      // trail exists — but it is written to an in-memory store that lives in
      // the browser, because no migrations have been applied to any project.
      // That is a real trail for the demo and not one a surveyor could be shown,
      // and the difference is worth keeping on the screen: this is the line
      // somebody would otherwise rely on without checking.
      state: "not_held",
      answer:
        input.auditEntryCount > 0
          ? `${input.auditEntryCount} ${input.auditEntryCount === 1 ? "entry" : "entries"} recorded this session, in the browser. Nothing is persisted — the migrations have not been applied to a Supabase project.`
          : "Nothing recorded yet this session. Consequential actions write to the trail as they happen; nothing is persisted until the migrations are applied.",
      to: "/settings",
      gaps: ["Migrations 0001–0013 have not been applied to the Supabase project"],
    },
  ];

  const withGaps = lines.filter((l) => l.state !== "ready").length;

  return {
    lines,
    withGaps,
    headline:
      withGaps === 0
        ? "Everything Joy holds data for is ready to show."
        : `${withGaps} of ${lines.length} would not survive a question this morning.`,
  };
}
