import type { Visit } from "@/domain/scheduling/conflicts";
import { timeRange } from "@/domain/portal/employeeHome";
import type { StatusLine } from "@/domain/portal/candidateStatus";

/**
 * The client and family portal — §18 to §24, and §29's steps 11 to 13.
 *
 * §18 lists the six questions it answers, and they are a family's questions
 * rather than an agency's: where are we in the process, what do we need to do,
 * who is coming and when, what changed, what documents are needed, and how is
 * Mom doing.
 *
 * WHAT A FAMILY MUST NOT SEE
 *
 * §24 is a list of exclusions — "internal staffing notes; scheduling conflicts;
 * candidate data; office deliberations" — and §20 adds the positive rule that
 * makes them work: "Joy determines status. The family does not manually tell
 * Joy where they are in the admission process."
 *
 * So this module is a projection in the same sense `candidateStatus` is. It
 * takes Joy's real records and returns a narrower, safe shape. In particular
 * `familySchedule` maps a visit to a family-facing state rather than passing
 * the visit through, because the office's schedule carries things a family
 * should not read: an unassigned shift means Joy is scrambling to cover it, and
 * a daughter reading "no caregiver assigned" on Sunday night will ring the
 * on-call phone about a visit that will in fact be covered on Monday morning.
 */

// -------------------------------------------------------- admission --

/**
 * §20's pre-admission checklist.
 *
 * The steps are Joy's, in the order they happen. A family reading down sees
 * what is done, what is in hand, and the one thing that is theirs.
 */
export interface AdmissionProgress {
  assessmentComplete: boolean;
  serviceAgreementSigned: boolean;
  paymentSetUp: boolean;
  carePlanState: "not_started" | "in_review" | "current";
  startOfCare: string | null;
  /** Documents the office has asked this family for. §21. */
  requestedDocuments: RequestedDocument[];
  /** Consents and agreements waiting on a signature. §22. */
  awaitingSignature: string[];
}

export type DocumentRequestState = "needed" | "received" | "under_review" | "accepted";

export const DOCUMENT_REQUEST_LABELS: Record<DocumentRequestState, string> = {
  needed: "Needed",
  received: "Received",
  under_review: "Under review",
  accepted: "Received",
};

export interface RequestedDocument {
  id: string;
  /** What the office asked for, in the family's words. */
  label: string;
  state: DocumentRequestState;
  /** Why Joy needs it. A family asked to find paperwork deserves a reason. */
  reason: string | null;
}

const CARE_PLAN_LABELS: Record<AdmissionProgress["carePlanState"], string> = {
  not_started: "Not started",
  in_review: "In review",
  current: "Current",
};

export function admissionLines(progress: AdmissionProgress): StatusLine[] {
  const outstanding = progress.requestedDocuments.filter((d) => d.state === "needed");

  return [
    {
      label: "Assessment",
      value: progress.assessmentComplete ? "Complete" : "Being scheduled",
      state: progress.assessmentComplete ? "done" : "in_progress",
    },
    {
      label: "Service agreement",
      value: progress.serviceAgreementSigned ? "Signed" : "Signature needed",
      state: progress.serviceAgreementSigned ? "done" : "attention",
    },
    {
      label: "Documents",
      value:
        progress.requestedDocuments.length === 0
          ? "Nothing needed"
          : outstanding.length === 0
            ? "All received"
            : `${outstanding.length} still needed`,
      state: outstanding.length === 0 ? "done" : "attention",
    },
    {
      label: "Payment setup",
      value: progress.paymentSetUp ? "Complete" : "To do",
      state: progress.paymentSetUp ? "done" : "attention",
    },
    {
      label: "Care plan",
      value: CARE_PLAN_LABELS[progress.carePlanState],
      state: progress.carePlanState === "current" ? "done" : "in_progress",
    },
    {
      label: "Start of care",
      // Never a guess. An unconfirmed start date invented for the sake of a
      // tidy row is the one line on this screen a family will plan around.
      value: progress.startOfCare ?? "To be confirmed",
      state: progress.startOfCare ? "done" : "waiting",
    },
  ];
}

export interface FamilyNext {
  headline: string;
  detail: string;
  action: { label: string; to: string } | null;
}

/**
 * The one thing next — §30, from the family's side.
 *
 * Ordered by what actually holds up care. A signature blocks admission; a
 * document request usually does not but is still theirs; everything else is
 * Joy's, and gets no button. §5's rule about not handing somebody a button for
 * a wait that is not their fault applies to families too.
 */
export function familyNext(progress: AdmissionProgress, subjectName: string): FamilyNext {
  if (progress.awaitingSignature.length > 0) {
    const [first] = progress.awaitingSignature;
    return {
      headline: `${first} needs your signature`,
      detail: "Read it through — you can ask us anything before you sign.",
      action: { label: "Review & sign", to: "/portal/care/documents" },
    };
  }

  const needed = progress.requestedDocuments.filter((d) => d.state === "needed");
  if (needed.length > 0) {
    const [first] = needed;
    return {
      headline: `Please upload ${subjectName}'s ${first.label.toLowerCase()}`,
      detail: first.reason ?? "A photo of each page is fine.",
      action: { label: "Upload document", to: "/portal/care/documents" },
    };
  }

  if (progress.carePlanState === "in_review") {
    return {
      headline: "We're finishing the care plan",
      detail: progress.startOfCare
        ? `Nothing is needed from you. Care starts ${progress.startOfCare}.`
        : "Nothing is needed from you. We'll confirm the start date shortly.",
      action: null,
    };
  }

  return {
    headline: progress.startOfCare ? `Care starts ${progress.startOfCare}` : "We're getting ready",
    detail: "Nothing is needed from you right now.",
    action: null,
  };
}

// --------------------------------------------------------- schedule --

/** §24's family-facing visit states. */
export type FamilyVisitState =
  | "scheduled"
  | "caregiver_assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export const FAMILY_VISIT_LABELS: Record<FamilyVisitState, string> = {
  scheduled: "Scheduled",
  caregiver_assigned: "Caregiver assigned",
  in_progress: "Visit in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface FamilyVisit {
  id: string;
  when: string;
  timeRange: string;
  service: string;
  /** Null until somebody is assigned. Never "unassigned" in so many words. */
  caregiverName: string | null;
  state: FamilyVisitState;
}

export interface FamilyScheduleOptions {
  /** §24: "only if Joy chooses to expose it". Off by default. */
  showInProgress?: boolean;
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/**
 * The family's view of Joy's schedule.
 *
 * Reads the same `Visit` the office and the caregiver read — §9's rule holds on
 * this side too. What differs is the projection.
 *
 * The important line is the state for an unassigned visit: `scheduled`, with a
 * null caregiver and no explanation. Not "unassigned", not "seeking cover", not
 * a warning colour. The visit is booked and Joy will staff it; a family reading
 * that Joy has nobody is reading an internal staffing note, which §24 forbids,
 * and would ring the on-call phone about a gap that closes on Monday morning.
 */
export function familySchedule(input: {
  visits: readonly Visit[];
  clientName: string;
  asOf: Date;
  inProgressVisitIds?: readonly string[];
  completedVisitIds?: readonly string[];
  options?: FamilyScheduleOptions;
}): FamilyVisit[] {
  const { visits, clientName, asOf } = input;
  const inProgress = new Set(input.inProgressVisitIds ?? []);
  const completed = new Set(input.completedVisitIds ?? []);
  const showInProgress = input.options?.showInProgress ?? false;

  return visits
    .filter((v) => v.clientName === clientName)
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((visit) => {
      let state: FamilyVisitState;

      if (completed.has(visit.id)) {
        state = "completed";
      } else if (inProgress.has(visit.id) && showInProgress) {
        state = "in_progress";
      } else if (inProgress.has(visit.id)) {
        // Joy has chosen not to expose live visits. It still must not read as
        // merely scheduled once it has happened — so it reads as assigned.
        state = "caregiver_assigned";
      } else if (new Date(visit.endsAt) < asOf) {
        state = "completed";
      } else {
        state = visit.caregiverName ? "caregiver_assigned" : "scheduled";
      }

      return {
        id: visit.id,
        when: DAY.format(new Date(visit.startsAt)),
        timeRange: timeRange(visit),
        service: visit.service,
        caregiverName: visit.caregiverName,
        state,
      };
    });
}

/**
 * Who is looking after this client — §23's care team.
 *
 * Built from assigned visits, so it is always the people actually coming. A
 * separately maintained list would drift, and the first a family would know is
 * a stranger at the door.
 */
export interface CareTeamMember {
  name: string;
  role: string;
  /** How many of this client's visits they cover. Drives "primary". */
  visits: number;
}

export function careTeam(visits: readonly Visit[], clientName: string): CareTeamMember[] {
  const counts = new Map<string, number>();

  for (const visit of visits) {
    if (visit.clientName !== clientName || !visit.caregiverName) continue;
    counts.set(visit.caregiverName, (counts.get(visit.caregiverName) ?? 0) + 1);
  }

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return ordered.map(([name, visits], i) => ({
    name,
    role: i === 0 ? "Primary caregiver" : "Caregiver",
    visits,
  }));
}
