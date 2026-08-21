import { seedAdmissions, seedPeople, type SeedAdmission, type SeedPerson } from "@/lib/admissionsSeed";
import { seedAssessments, seedConsentSessions, seedIntakes } from "@/lib/admissionProgressSeed";
import { ASSESSMENT_QUESTIONS } from "@/domain/assessment/questions";
import type { UserRole } from "@/domain/consents/witness";
import type { RnLicence } from "@/domain/clinical/registeredNurse";
import type { HiredEmployee } from "@/domain/hiring/pipeline";
import type { Contact } from "@/domain/people/contacts";
import type { StoredAuditEntry } from "@/lib/demoAudit";

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
  /** The Joy representative who took the signature. §19 and the packet's own
   *  "JOY HEALTHCARE REPRESENTATIVE" line on almost every page. */
  witnessName?: string | null;
  witnessRole?: UserRole | null;
  signerRelationship: string | null;
  signedAt: string | null;
}

export interface DemoPreOnboarding {
  admissionId: string;
  paymentSetUp: boolean;
  carePlanApproved: boolean;
  /** Set when the office approves admission. A human decision, never Joy's. */
  approvedAt: string | null;
  approvedBy: string | null;
  startOfCareDate: string | null;
  activatedAt: string | null;
}

/**
 * Who is using the app. Stands in for the signed-in user until roles come from
 * `users.role` in the database — the signing rule needs to know a role, and
 * hardcoding "Admin" in the header made every session look like the owner.
 */
export interface DemoUser {
  name: string;
  role: UserRole;
  /**
   * The RN licence, if this person holds one.
   *
   * Separate from `role` on purpose. Karynn is the owner AND the registered
   * nurse, and `user_role` can only say one of those — which is why narrowing
   * the supervisory-visit rule to the `rn_clinical` role would have locked her
   * out of the task she personally does. See domain/clinical/registeredNurse.
   */
  rnLicence?: RnLicence | null;
}

export interface DemoState {
  admissions: SeedAdmission[];
  people: SeedPerson[];
  intakes: Record<string, DemoIntake>;
  currentUser: DemoUser;
  /** Caregiver assigned to a visit, keyed by visit id. Overrides the seed. */
  assignments: Record<string, string>;
  /** People hired through the app. Merged with the seed on the Employees screen. */
  newHires: HiredEmployee[];
  assessments: Record<string, DemoAssessment>;
  consentSessions: Record<string, DemoConsentSession>;
  preOnboarding: Record<string, DemoPreOnboarding>;
  scheduleEvents: DemoScheduleEvent[];
  communications: DemoCommunication[];
  domainEvents: DemoDomainEvent[];
  /**
   * Business contacts added through the app, newest first.
   *
   * Merged with `seedContacts` on the People screen rather than replacing it,
   * the same way `newHires` merges with the seeded workforce — so the cards
   * Karynn has already handed over stay put and anything typed in survives a
   * refresh.
   */
  contacts: Contact[];
  /**
   * Changes to contacts, by id.
   *
   * An override map rather than editing rows in place, because the seeded cards
   * are not rows — they live in `peopleSeed.ts` and cannot be mutated. Anything
   * that changes a contact goes through here, which is also what lets a
   * conversation be logged against a seeded contact.
   *
   * This started as `contactLog`, a map of one field. Editing needed the same
   * mechanism for every other field, and two override maps doing the same job
   * is one more than anybody should have to reason about.
   */
  contactEdits: Record<string, Partial<Contact>>;
  /** Contacts removed from the list. Seeded ones cannot be deleted outright. */
  deletedContactIds: string[];
  /**
   * Who did what, newest first.
   *
   * Written only through `recordAudit`, never appended to directly — the
   * writer's rules (actor validation, redaction) are the point, and a direct
   * push skips all of them.
   */
  auditEntries: StoredAuditEntry[];
}

function initial(): DemoState {
  return {
    admissions: seedAdmissions,
    people: seedPeople,
    // The intake and assessment each seeded admission's stage implies. Empty
    // maps meant the board said "assessment completed Aug 12" and the review
    // screen for the same record said nobody had been out yet.
    intakes: seedIntakes,
    currentUser: {
      name: "Karynn Verrett",
      role: "ceo_admin",
      // Placeholder number: the real licence number is Karynn's to enter, and a
      // made-up one in a committed file would look like a record.
      rnLicence: { number: "RN-PENDING", state: "TX", expiresOn: "2027-04-30" },
    },
    assignments: {},
    newHires: [],
    assessments: seedAssessments,
    consentSessions: seedConsentSessions,
    preOnboarding: {},
    scheduleEvents: [],
    communications: [],
    domainEvents: [],
    contacts: [],
    contactEdits: {},
    deletedContactIds: [],
    auditEntries: [],
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

/**
 * Question ids the packet marks as restricted — a social security number is the
 * one that matters. §28 puts these behind narrower access than the rest of the
 * record, and localStorage has no access control at all.
 */
const RESTRICTED_ANSWER_IDS = new Set(
  ASSESSMENT_QUESTIONS.filter((q) => q.restricted).map((q) => q.id),
);

/**
 * Drops restricted answers on the way to disk.
 *
 * The RN can still see what they typed for the rest of the visit — it stays in
 * React state — but it is gone on refresh and it is never written anywhere a
 * browser extension or a shared laptop can read it. Losing the value is the
 * correct trade: the number is on the paper packet, which is where it belongs
 * until there is a column policy to hold it.
 */
function withoutRestricted(state: DemoState): DemoState {
  const assessments: DemoState["assessments"] = {};
  for (const [id, assessment] of Object.entries(state.assessments)) {
    const answers = { ...assessment.answers };
    for (const key of RESTRICTED_ANSWER_IDS) delete answers[key];
    assessments[id] = { ...assessment, answers };
  }
  return { ...state, assessments };
}

export function saveDemoState(state: DemoState): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(withoutRestricted(state)));
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


/**
 * The consent session for a client, by the name shown on screen.
 *
 * Consent sessions are keyed by admission id, and neither the session nor the
 * person record carries a client name — the name lives on the admission. Two
 * screens had independently guessed at `session.clientName`, a field that has
 * never existed on `DemoConsentSession`, so both lookups silently returned
 * undefined: a client admitted during the demo showed no consents at all, and
 * Scheduling fell through to the seeded decision every time.
 *
 * Neither the build nor the tests caught it, because `strict: false` lets an
 * unknown property read as `undefined` at runtime and the comparison simply
 * never matched. `tsc --noEmit` did.
 *
 * One function so the two screens cannot drift apart again.
 */
export function consentSessionForClient(
  state: Pick<DemoState, "admissions" | "consentSessions">,
  clientName: string,
): DemoConsentSession | undefined {
  const admission = state.admissions.find((a) => a.name === clientName);
  return admission ? state.consentSessions[admission.id] : undefined;
}
