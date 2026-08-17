import { seedAdmissions, seedPeople, type SeedAdmission, type SeedPerson } from "@/lib/admissionsSeed";

/**
 * Demo persistence, backed by localStorage.
 *
 * PROTOTYPE ONLY. This exists so a demo survives a page refresh — add a
 * referral, reload, and it is still there. It is deliberately shaped like the
 * real thing (one collection per table, ids that look like ids) so replacing it
 * with the Supabase repositories is a swap rather than a rewrite, but nothing
 * here is a substitute for the schema in supabase/migrations.
 *
 * Everything it stores is fictional seed. No real client data belongs in
 * localStorage — it is unencrypted, unscoped and readable by anything running
 * on the page.
 */

const KEY = "joy.demo.v1";

export interface DemoIntake {
  admissionId: string;
  /** Answers keyed by question id. */
  answers: Record<string, unknown>;
  /** Question ids the user has moved past. */
  visited: string[];
  completedAt: string | null;
  startedAt: string;
}

export interface DemoScheduleEvent {
  id: string;
  eventType: "rn_assessment" | "client_visit" | "orientation" | "field_orientation" | "supervisor_visit" | "internal_event";
  admissionId: string | null;
  clientName: string;
  assessorName: string;
  startsAt: string;
  durationMinutes: number;
  address: string;
  createdAt: string;
}

export interface DemoCommunication {
  id: string;
  entityType: string;
  entityId: string;
  recipientName: string;
  channel: "sms" | "email";
  provider: string;
  templateKey: string;
  status: "queued" | "sent" | "failed" | "cancelled";
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface DemoDomainEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string | null;
  status: "pending" | "processed" | "failed";
  createdAt: string;
}

export interface DemoAssessment {
  admissionId: string;
  answers: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
}

export interface DemoConsentSession {
  admissionId: string;
  /**
   * One decision per consent key. Mirrors ConsentDecision in
   * domain/consents/registry — kept as a literal union rather than `string` so
   * a stored blob cannot widen the type the signing screen relies on.
   */
  decisions: Record<string, "agree" | "decline" | "not_applicable" | undefined>;
  signerName: string | null;
  signerRelationship: string | null;
  signedAt: string | null;
}

export interface DemoState {
  admissions: SeedAdmission[];
  people: SeedPerson[];
  intakes: Record<string, DemoIntake>;
  assessments: Record<string, DemoAssessment>;
  consentSessions: Record<string, DemoConsentSession>;
  scheduleEvents: DemoScheduleEvent[];
  communications: DemoCommunication[];
  domainEvents: DemoDomainEvent[];
}

function initial(): DemoState {
  return {
    admissions: seedAdmissions,
    people: seedPeople,
    intakes: {},
    assessments: {},
    consentSessions: {},
    scheduleEvents: [],
    communications: [],
    domainEvents: [],
  };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDemoState(): DemoState {
  const raw = storage()?.getItem(KEY);
  if (!raw) return initial();
  try {
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    // Merge over a fresh baseline so a stored blob written by an older build
    // cannot leave a required collection undefined and crash a screen.
    return { ...initial(), ...parsed };
  } catch {
    return initial();
  }
}

export function saveDemoState(state: DemoState): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    // A full or unavailable storage must never break the workflow.
  }
}

export function resetDemoState(): DemoState {
  storage()?.removeItem(KEY);
  return initial();
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
