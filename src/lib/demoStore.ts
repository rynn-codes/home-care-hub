import { seedAdmissions, seedPeople, type SeedAdmission, type SeedPerson } from "@/lib/admissionsSeed";
import { seedAssessments, seedConsentSessions, seedIntakes } from "@/lib/admissionProgressSeed";
import { ASSESSMENT_QUESTIONS } from "@/domain/assessment/questions";
import type { UserRole } from "@/domain/consents/witness";
import type { RnLicence } from "@/domain/clinical/registeredNurse";
import type { HiredEmployee } from "@/domain/hiring/pipeline";
import type { Contact } from "@/domain/people/contacts";
import type { StoredAuditEntry } from "@/lib/demoAudit";
import type { IssuedInvoice, Payment } from "@/domain/billing/receivables";
import type { PaymentSetupState } from "@/domain/billing/paymentSetup";
import type { PaymentMode } from "@/domain/billing/paymentAuthorization";
import type { Interaction } from "@/domain/records/activity";
import type { DeletedRecord } from "@/domain/records/deletion";
import { partitionExpired } from "@/domain/records/deletion";
import type { ProfileChange } from "@/domain/records/profileChanges";
import type { EmployeeProfile } from "@/domain/employees/profile";
import type { ClientStatusChange } from "@/domain/clients/roster";
import { seedInteractions } from "@/lib/activitySeed";
import type { LibraryDocument } from "@/domain/documents/library";
import { reconcileFolders } from "@/domain/documents/library";
import type { Sop } from "@/domain/sops/sops";
import { seedDocumentFolders, seedDocuments } from "@/lib/documentsSeed";
import { seedSops } from "@/lib/sopsSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { CoverDecision, TimeOff } from "@/domain/scheduling/timeOff";
import type { CoverageEvent, OvertimeApproval } from "@/domain/scheduling/coverage";
import type { Household } from "@/domain/billing/households";
import type { ClientSchedule } from "@/domain/scheduling/clientSchedule";
import type { ServiceShare } from "@/domain/scheduling/serviceMix";
import type { ApprovedLocation, ClockPlace } from "@/domain/scheduling/locations";
import type { ClockProposal } from "@/domain/scheduling/reminders";
import type { VisitChange } from "@/domain/scheduling/visitChanges";
import { purgeExpired as purgeExpiredExpenses, type VisitExpense } from "@/domain/scheduling/expenses";
import type { VisitPay } from "@/domain/scheduling/visitPay";
import type { SupervisoryVisit } from "@/domain/supervision/supervision";
import { seedSupervisoryVisits } from "@/lib/supervisionSeed";
import { seedApprovedLocations, seedClientSchedules, seedHouseholds, seedMileage, type VisitMileage } from "@/lib/schedulingExtrasSeed";

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
  /**
   * When the completed document — every clause, this client's answers — was
   * reviewed in its entirety before signing. Karynn's requirement, 22 August:
   * nobody signs a summary.
   */
  reviewedCompletedAt?: string | null;
  /**
   * The adopted signature and initials, kept so the signed packet can be
   * rendered as the document it is. Karynn, 24 August: "DocuSign-style
   * service. Nothing typed." — the signature is generated from the legal name
   * on record and adopted in the ceremony, never typed.
   */
  signatureText?: string | null;
  initials?: string | null;
  /** ESIGN Act consent — agreed to sign electronically, with a timestamp. */
  esignConsentAt?: string | null;
  /** When the generated signature and initials were adopted. */
  signatureAdoptedAt?: string | null;
  /** How the marks were made. The only method Joy offers is the ceremony. */
  signatureMethod?: "esign_adopted" | null;
  signedAt: string | null;
}

export interface DemoPreOnboarding {
  admissionId: string;
  /**
   * §9.2's five states. COMPUTED from the facts below since the §16 panel
   * landed — the field remains for continuity and needs_attention overrides,
   * but the picker is gone: §4.2 wants readiness computed, not selected.
   */
  paymentSetup: PaymentSetupState;
  /** The §16 panel's facts. See paymentSetupFromFacts. */
  pricingReviewedAt?: string | null;
  paymentPreference?: PaymentMode | null;
  paymentMethodOnFile?: boolean;
  authorizationCapturedAt?: string | null;
  carePlanApproved: boolean;
  /** The office has recorded the agreed rate — §4.2's rate agreement gate. */
  rateAgreed: boolean;
  /**
   * §4.2's documented authorized exception: admission proceeding past an
   * unsatisfied gate, with a reason and a name. Audited when set.
   */
  gateOverride: { reason: string; by: string; at: string } | null;
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
  /**
   * Payments recorded through the app — §7.4 rung 6, the cheque on the desk.
   * Merged with `seedPayments` wherever a balance is computed, so the
   * Billing screen and the outstanding-invoices report read one list.
   */
  recordedPayments: Payment[];
  /**
   * Drafts from the Saturday run that somebody approved, keyed by
   * client:week:rateVersion. §7.2 step 6 — approval is a person's act, and
   * this is where the demo holds it.
   */
  approvedDrafts: Record<string, { by: string; at: string; sentAs?: string }>;
  /**
   * Invoices sent from the Saturday run — §7.2 step 8's other half. Each
   * carries the JH- number assigned at send. They merge with the seeds
   * everywhere balances are computed, so Outstanding and the reports agree.
   */
  issuedInvoices: IssuedInvoice[];
  /** The demo's stand-in for 0020's sequence. */
  nextInvoiceNumber: number;
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
  /**
   * MR numbers issued in the demo, keyed by person or employee id. The number
   * is stored; the digits it was made from never are. See domain/records/mrNumber.
   */
  mrNumbers: Record<string, string>;
  /** Profile and status changes still inside the undo window. See domain/records/profileChanges. */
  profileChanges: ProfileChange[];
  /** Calls, visits, meals and notes logged against any record. Seeded with a few. */
  interactions: Interaction[];
  /** The bin. Anything deleted waits here until its recovery window closes. */
  deletedRecords: DeletedRecord[];
  /** Edits to seeded employees, keyed by id — the seed is a file and cannot change. */
  employeeEdits: Record<string, EmployeeProfile>;
  /** People added on the Employees screen, newest first. */
  addedEmployees: Array<{ id: string; profile: EmployeeProfile }>;
  deletedEmployeeIds: string[];
  deletedClientIds: string[];
  /** Status set on a client record, over whatever the seed says. */
  clientStatuses: Record<string, ClientStatusChange>;
  /** The document library — records only; the files live in lib/fileCache for the session. */
  documents: LibraryDocument[];
  documentFolders: string[];
  sops: Sop[];

  /* ── Scheduling ─────────────────────────────────────────────────────── */

  /** Visits added on the board (Quick Add), beyond the seed and the recurring schedules. */
  shifts: Visit[];
  timeOff: TimeOff[];
  /** A family said no replacement is needed on a day time off opened. */
  coverDecisions: CoverDecision[];
  coverageEvents: CoverageEvent[];
  overtimeApprovals: OvertimeApproval[];
  /** Per-visit permission to be paid from an early clock-in. */
  earlyStarts: Record<string, boolean>;
  clockAttempts: DemoClockAttempt[];
  /** Clock-in and clock-out recorded through the app, by visit id. */
  clockEvents: Record<string, { inAt?: string | null; outAt?: string | null }>;
  clockCorrections: Record<string, DemoClockCorrection>;
  clockPlaces: Record<string, Partial<Record<"in" | "out", ClockPlace>>>;
  /** Caregiver answers to Joy's suggested times, keyed `${visitId}:${which}`. */
  clockProposals: Record<string, ClockProposal>;
  households: Household[];
  clientSchedules: ClientSchedule[];
  serviceMixes: Record<string, ServiceShare[]>;
  serviceMixConfirmed: Record<string, { by: string; at: string }>;
  approvedLocations: ApprovedLocation[];
  visitMileage: Record<string, VisitMileage>;
  visitChanges: VisitChange[];
  /** Expense items by visit id — receipt metadata only, never the image. */
  visitExpenses: Record<string, VisitExpense[]>;
  visitPay: Record<string, VisitPay>;
  /** The office asked a caregiver for her phone number through her Joy app. */
  phoneAsks: Record<string, { askedBy: string; askedAt: string; answeredAt: string | null }>;
  supervisoryVisits: SupervisoryVisit[];
}

export interface DemoClockAttempt {
  id: string;
  visitId: string;
  caregiverName: string;
  action: "in" | "out";
  at: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  verdict: string;
  officeLine: string | null;
}

export interface DemoClockCorrection {
  visitId: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  reasonCode: string;
  actionCode: string;
  note: string;
  by: string;
  at: string;
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
    recordedPayments: [],
    approvedDrafts: {},
    issuedInvoices: [],
    nextInvoiceNumber: 10430,
    contacts: [],
    contactEdits: {},
    deletedContactIds: [],
    auditEntries: [],
    mrNumbers: {},
    profileChanges: [],
    interactions: [...seedInteractions],
    deletedRecords: [],
    employeeEdits: {},
    addedEmployees: [],
    deletedEmployeeIds: [],
    deletedClientIds: [],
    clientStatuses: {},
    documents: [...seedDocuments],
    documentFolders: [...seedDocumentFolders],
    sops: [...seedSops],
    shifts: [],
    timeOff: [],
    coverDecisions: [],
    coverageEvents: [],
    overtimeApprovals: [],
    earlyStarts: {},
    clockAttempts: [],
    clockEvents: {},
    clockCorrections: {},
    clockPlaces: {},
    clockProposals: {},
    households: [...seedHouseholds],
    clientSchedules: [...seedClientSchedules],
    serviceMixes: {},
    serviceMixConfirmed: {},
    approvedLocations: [...seedApprovedLocations],
    visitMileage: Object.fromEntries(seedMileage.map((m) => [m.visitId, m])),
    visitChanges: [],
    visitExpenses: {},
    visitPay: {},
    phoneAsks: {},
    supervisoryVisits: [...seedSupervisoryVisits],
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
    const merged = { ...initial(), ...parsed };
    // A blob from before §9.2 landed carries `paymentSetUp: boolean`. Map it
    // rather than dropping it — the office ticked that box on purpose.
    for (const [key, pre] of Object.entries(merged.preOnboarding)) {
      const legacy = pre as DemoPreOnboarding & { paymentSetUp?: boolean };
      merged.preOnboarding[key] = {
        ...legacy,
        paymentSetup:
          legacy.paymentSetup ?? (legacy.paymentSetUp ? "complete" : "not_started"),
        rateAgreed: legacy.rateAgreed ?? false,
        gateOverride: legacy.gateOverride ?? null,
      };
    }
    // The bin empties itself: anything past its recovery window goes on load.
    merged.deletedRecords = partitionExpired(merged.deletedRecords ?? [], new Date().toISOString()).keep;
    // A folder a document names is a folder, whatever the list says.
    merged.documentFolders = reconcileFolders(merged.documentFolders ?? [], merged.documents ?? []);
    // Seeded activity added since this blob was written joins the list; nothing
    // somebody logged is touched.
    const have = new Set((merged.interactions ?? []).map((i) => i.id));
    merged.interactions = [
      ...(merged.interactions ?? []),
      ...seedInteractions.filter((i) => !have.has(i.id)),
    ];
    // A blob from before the admissions queue carried `waitingSince` reads
    // the seed's, so the waiting badges do not all start today.
    merged.admissions = (merged.admissions ?? []).map((a) => {
      if (a.waitingSince !== undefined) return a;
      const seeded = seedAdmissions.find((x) => x.id === a.id);
      return seeded ? { ...a, waitingSince: seeded.waitingSince } : a;
    });
    // Expense items past their thirty days go too.
    const now = new Date();
    merged.visitExpenses = Object.fromEntries(
      Object.entries(merged.visitExpenses ?? {}).map(([id, items]) => [id, purgeExpiredExpenses(items ?? [], now)]),
    );
    return merged;
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

/** Returns false when the device is out of storage, so the provider can say so. */
export function saveDemoState(state: DemoState): boolean {
  try {
    storage()?.setItem(KEY, JSON.stringify(withoutRestricted(state)));
    return true;
  } catch {
    // A full or unavailable storage must never break the workflow.
    return false;
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
