import type { ClientInput } from "@/domain/clients/roster";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { EvvRecordLike } from "@/domain/audit/evv";
import type { ApprovedLocation } from "@/domain/scheduling/locations";
import type { ClientSchedule } from "@/domain/scheduling/clientSchedule";
import type { VisitExpense } from "@/domain/scheduling/expenses";
import type { AdmissionStage, AdmissionStatus } from "@/domain/admissions/stages";
import type { IntakeAnswers } from "@/domain/admissions/intake";

/**
 * The monitors: the things Joy checks every day and only speaks up about
 * when something is wrong.
 *
 * A monitor is a question with a name. It runs over the same records the
 * screens show and returns findings, each one a sentence a person can act
 * on, a reason it matters and one place to go. A finding is never an
 * action: Joy notices, a person decides.
 */
export type Severity = "blocking" | "due_soon" | "note";

export interface FindingSubject {
  kind: "client" | "employee" | "admission" | "shift";
  id: string;
  name: string;
}

export interface RawFinding {
  /** Stable across runs, so a finding can be remembered: `paperwork:<person>:<item>`. */
  key: string;
  subject: FindingSubject;
  severity: Severity;
  /** The one sentence: who, what, since when. */
  headline: string;
  /** Why it matters, in the agency's words. */
  because: string;
  next: { label: string; to: string };
}

export interface Finding extends RawFinding {
  monitorId: string;
  monitorName: string;
  /** When this run happened. */
  seenAt: string;
  /** When the finding was first noticed on this device. */
  firstSeen: string;
}

export interface MonitorAdmission {
  id: string;
  name: string;
  stage: AdmissionStage;
  status?: AdmissionStatus;
  overdue?: boolean;
  waitingSince?: string | null;
  answers?: IntakeAnswers;
}

export interface ClockAttemptLike {
  id: string;
  caregiverName: string;
  clientName?: string;
  action: "in" | "out";
  at: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  refused?: boolean;
}

export interface MonitorInputs {
  clients: ClientInput[];
  admissions: MonitorAdmission[];
  visits: Visit[];
  evvRecords: EvvRecordLike[];
  evvVisits: Visit[];
  clockAttempts: ClockAttemptLike[];
  approvedLocations: ApprovedLocation[];
  clientSchedules: ClientSchedule[];
  visitExpenses: Record<string, VisitExpense[]>;
  mileageRatePerMile: number;
  clientNames: Record<string, string>;
  /** ISO date. */
  today: string;
  /** Noon today, for anything that counts hours. */
  now: Date;
}

export interface Monitor {
  id: string;
  name: string;
  /** The question the monitor answers, for the Settings list. */
  question: string;
  cadence: "daily";
  run(inputs: MonitorInputs): RawFinding[];
}
