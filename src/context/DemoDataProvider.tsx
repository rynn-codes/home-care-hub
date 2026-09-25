import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  loadDemoState,
  newId,
  resetDemoState,
  saveDemoState,
  type DemoCommunication,
  type DemoDomainEvent,
  type DemoAssessment,
  type DemoConsentSession,
  type DemoIntake,
  type DemoPreOnboarding,
  type DemoScheduleEvent,
  type DemoState,
} from "@/lib/demoStore";
import type { SeedAdmission } from "@/lib/admissionsSeed";
import type { Contact } from "@/domain/people/contacts";
import { seedContacts } from "@/lib/peopleSeed";
import { recordAudit } from "@/lib/demoAudit";
import type { AuditRecord } from "@/domain/audit/audit";
import { paymentRefusals, type Payment, type PaymentRefusal } from "@/domain/billing/receivables";
import { externalPaymentRecorded, invoiceApproved, invoiceIssued } from "@/domain/billing/financialAudit";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";
import { toast } from "sonner";
import { canWrite } from "@/domain/access/roles";
import { seedEmployees } from "@/lib/employeesSeed";
import { profileFromSeed } from "@/lib/employeeRoster";
import { EMPLOYEE_STATUS_LABELS, type EmployeeStatus } from "@/domain/employees/credentials";
import { fullName, type EmployeeProfile } from "@/domain/employees/profile";
import { changeSummary, changedFieldLabels, type ProfileChange } from "@/domain/records/profileChanges";
import { binned, type DeletedRecord } from "@/domain/records/deletion";
import { interactionFromDraft, type ActivityDraft, type ActivitySubject, type Interaction } from "@/domain/records/activity";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/domain/clients/roster";
import {
  cleanFolderName,
  moveFolderDocuments,
  renameFolderOnDocuments,
  tagDocument as tagDoc,

  untagDocument,
  type LibraryDocument,
} from "@/domain/documents/library";
import { declineRequest, newSignatureRequest, signRequest, type SignerRole } from "@/domain/documents/signatureRequests";
import { moveCategory, renameCategory, withNewVersion, type Sop } from "@/domain/sops/sops";
import type { DemoClockAttempt, DemoClockCorrection } from "@/lib/demoStore";
import { seedDocuments } from "@/lib/documentsSeed";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { TimeOff } from "@/domain/scheduling/timeOff";
import { unassignShift, type CoverageEvent } from "@/domain/scheduling/coverage";
import type { ApprovedLocation, ClockPlace } from "@/domain/scheduling/locations";
import type { ClockProposal } from "@/domain/scheduling/reminders";
import type { ServiceShare } from "@/domain/scheduling/serviceMix";
import type { VisitChange } from "@/domain/scheduling/visitChanges";
import { purgeExpired, type VisitExpense } from "@/domain/scheduling/expenses";
import type { VisitPay } from "@/domain/scheduling/visitPay";
import type { ClientSchedule, ScheduleRevision } from "@/domain/scheduling/clientSchedule";
import type { HouseholdBilling } from "@/domain/billing/households";
import type { SupervisoryVisit } from "@/domain/supervision/supervision";
import { bookSupervisoryVisit } from "@/domain/supervision/supervision";
import type { VisitMileage } from "@/lib/schedulingExtrasSeed";
import type { LtciEnrollment } from "@/domain/billing/ltci";
import type { PayerEdit, RateChange } from "@/domain/billing/payerSetup";
import type { DraftCharge } from "@/domain/billing/manualInvoice";
import { reducesInvoice, type RefundKind } from "@/domain/billing/invoiceActions";

/** What each kind of deleted record carries so it can be put back exactly. */
export type DeletedPayload =
  | { kind: "contact"; contact: Contact; edits: Partial<Contact> | null }
  | { kind: "activity"; interaction: Interaction }
  | { kind: "employee"; employeeId: string; edits: EmployeeProfile | null; added: EmployeeProfile | null }
  | { kind: "client"; clientPersonId: string }
  | { kind: "admission"; admission: SeedAdmission; person: DemoState["people"][number] | null; mrNumber: string | null }
  | { kind: "document"; document: LibraryDocument }
  | { kind: "sop"; sop: Sop };

/**
 * The demo's organization id.
 *
 * One constant rather than a literal at each call site: every audit entry
 * carries it, and a typo would put a record in an organization that does not
 * exist — invisible until somebody queried the trail and found it short.
 */
const DEMO_ORG = "org-joy-health";

interface DemoContextValue extends DemoState {
  addReferral: (admission: SeedAdmission, person: DemoState["people"][number]) => void;
  saveIntake: (admissionId: string, intake: Partial<DemoIntake>) => void;
  addContact: (contact: Contact) => void;
  editContact: (contactId: string, patch: Partial<Contact>) => void;
  deleteContact: (contactId: string) => void;
  restoreContact: (contact: Contact) => void;
  logContact: (contactId: string, on: string) => void;
  completeIntake: (admissionId: string) => void;
  saveAssessment: (admissionId: string, patch: Partial<DemoAssessment>) => void;
  saveConsents: (admissionId: string, patch: Partial<DemoConsentSession>) => void;
  savePreOnboarding: (admissionId: string, patch: Partial<DemoPreOnboarding>) => void;
  approveAdmission: (admissionId: string, approvedBy: string) => void;
  activateClient: (admissionId: string, startDate: string) => void;
  scheduleAssessment: (input: {
    admissionId: string;
    clientName: string;
    assessorName: string;
    startsAt: string;
    durationMinutes: number;
    address: string;
    notifyName: string;
    /** Simulates the provider failing, to exercise the retry path honestly. */
    simulateFailure?: boolean;
  }) => void;
  retryCommunication: (id: string) => void;
  assignments: DemoState["assignments"];
  newHires: DemoState["newHires"];
  hireEmployee: (employee: DemoState["newHires"][number]) => void;
  assignShift: (visitId: string, caregiverName: string) => void;
  /**
   * §7.4 rung 6 — record money that arrived outside Stripe: the cheque, the
   * cash, the bank transfer. Returns the refusals instead of recording when
   * something is wrong, so the form can say why in the domain's words.
   */
  recordExternalPayment: (payment: Payment) => PaymentRefusal[];
  /** §7.2 step 6: an authorized person approves a draft, with their name on it. */
  approveDraft: (key: string, summary: { total: number; lineCount: number; ratePlanVersionId: string | null }) => void;
  /**
   * §7.2 step 8's other half: an approved draft goes out. The JH- number is
   * assigned here, the family notification queues (§9.4's words — a thing
   * exists, no amount), and the invoice lands in Outstanding.
   */
  sendInvoice: (input: {
    key: string;
    clientPersonId: string;
    clientName: string;
    weekStart: string;
    weekEnd: string;
    total: number;
    lines?: Array<{ description: string; hours: number; rate: number | null; amount: number }>;
  }) => void;
  currentUser: DemoState["currentUser"];
  setCurrentUser: (user: DemoState["currentUser"]) => void;
  reset: () => void;

  /* ── Records: employees, clients, the bin, activity ─────────────────── */

  /**
   * Save an employee's profile. `id` null adds somebody; otherwise the edit
   * is laid over the seed (or replaces an added profile). Returns the id.
   * Every edit leaves a ProfileChange so it can be undone for the agency's
   * window, and an audit line that stays.
   */
  saveEmployee: (id: string | null, profile: EmployeeProfile) => string;
  setEmployeeStatus: (id: string, status: EmployeeStatus, name?: string) => void;
  undoProfileChange: (changeId: string) => void;
  deleteEmployee: (id: string, name: string, reason?: string | null) => void;
  deleteClient: (personId: string, name: string, reason?: string | null) => void;
  /** Bin an admission record that never became a client. The provider refuses an admitted one. */
  deleteAdmission: (admissionId: string, reason?: string | null) => void;
  restoreDeleted: (id: string) => void;
  purgeDeleted: (id: string) => void;
  logActivity: (input: { draft: ActivityDraft; subject: ActivitySubject }) => Interaction;
  deleteActivity: (id: string) => void;
  /** Opening a record is audited — a surveyor's session is the one that is not. */
  recordView: (entityType: string, entityId: string, label: string) => void;
  issueMrNumber: (entityId: string, number: string) => void;
  setClientStatus: (input: {
    clientPersonId: string;
    status: ClientStatus;
    note?: string | null;
    lastServiceOn?: string | null;
    name?: string;
  }) => void;

  /* ── Documents and SOPs ───────────────────────────────────────────────── */

  /** Adds the record and returns its id. The file itself is the caller's to keep (lib/fileCache). */
  uploadDocument: (doc: Omit<LibraryDocument, "id" | "uploadedAt" | "uploadedBy">) => string;
  tagDocument: (id: string, tag: string, remove?: boolean) => void;
  updateDocument: (id: string, patch: Partial<LibraryDocument>) => void;
  duplicateDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  addDocumentFolder: (name: string) => void;
  renameDocumentFolder: (from: string, to: string) => void;
  deleteDocumentFolder: (name: string, moveTo: string) => void;
  /** Ask a client or their responsible party to sign a library document. Returns the request id. */
  requestSignature: (input: { documentId: string; documentName: string; clientPersonId: string; clientName: string; signerRole: SignerRole; signerName: string; reason: string }) => string;
  /** The signer typed their name and drew a mark. The mark is not stored. */
  signSignatureRequest: (id: string, input: { typedName: string; markDrawn: boolean }) => void;
  declineSignatureRequest: (id: string, reason: string) => void;
  addSop: (input: { title: string; category: string; ownerName: string; content: string }) => string;
  updateSop: (id: string, patch: Partial<Pick<Sop, "title" | "category">>) => void;
  saveSopVersion: (id: string, content: string) => void;
  deleteSop: (id: string) => void;
  renameSopCategory: (from: string, to: string) => void;
  moveSopCategory: (from: string, to: string) => void;

  /* ── Scheduling ───────────────────────────────────────────────────────── */

  /** A visit added from Quick Add. */
  addShift: (visit: Visit) => void;
  /** Any event booked onto the one Joy schedule: an orientation, a supervisor visit, an office day. */
  addScheduleEvent: (event: DemoScheduleEvent) => void;
  requestTimeOff: (draft: { caregiverName: string; from: string; to: string; reason: string }) => TimeOff;
  cancelTimeOff: (id: string) => void;
  declineCover: (input: { visitId: string; confirmedWith: string; note: string | null }) => void;
  saveCoverageEvent: (event: CoverageEvent) => void;
  approveCoveragePlan: (id: string) => void;
  approveCoverageOvertime: (id: string, approval: { caregiverName: string; hours: number; weekStart: string; reason: string }) => void;
  reopenCoverageShift: (id: string, shiftId: string) => void;
  cancelCoverageEvent: (id: string) => void;
  approveOvertime: (approval: { caregiverName: string; hours: number; weekStart: string; reason: string }) => void;
  authorizeEarlyStart: (visitId: string, allowed: boolean) => void;
  recordClockAttempt: (attempt: DemoClockAttempt) => void;
  recordClock: (visitId: string, which: "in" | "out", at: string) => void;
  recordClockCorrection: (correction: DemoClockCorrection) => void;
  setClockPlace: (visitId: string, which: "in" | "out", place: ClockPlace) => void;
  proposeClock: (proposal: ClockProposal) => void;
  decideClockProposal: (key: string, approved: boolean, by: string) => void;
  setServiceMix: (clientPersonId: string, mix: ServiceShare[]) => void;
  confirmServiceMix: (clientPersonId: string, by: string) => void;
  recordVisitChange: (change: VisitChange) => void;
  addApprovedLocation: (location: ApprovedLocation) => void;
  decideLocation: (id: string, approve: boolean, by: string) => void;
  recordMileage: (mileage: VisitMileage) => void;
  /** Replaces the visit's items. Audit lines carry category and amount only — never a receipt or file name. */
  recordExpenses: (visitId: string, items: VisitExpense[], by: string) => void;
  recordVisitPay: (pay: VisitPay) => void;
  askForPhone: (caregiverName: string, by: string, at: string) => void;
  answerPhoneAsk: (caregiverName: string, phone: string, at: string) => void;
  reviseSchedule: (revision: ScheduleRevision) => void;
  addClientSchedule: (schedule: ClientSchedule) => void;
  sendScheduleAgreement: (scheduleId: string, by: string, at: string) => void;
  signScheduleAgreement: (scheduleId: string, by: string, at: string) => void;
  setHouseholdBilling: (householdId: string, billing: HouseholdBilling, note?: string | null) => void;
  setHouseholdRate: (householdId: string, rate: number | null, split: Record<string, number> | null) => void;
  pairHousehold: (input: { clientPersonId: string; clientName: string; partnerPersonId: string; partnerName: string; billing: HouseholdBilling }) => void;
  bookSupervision: (visit: SupervisoryVisit) => void;
  completeSupervision: (visit: SupervisoryVisit) => void;

  /* ── Billing: after the run ─────────────────────────────────────────── */

  saveLtciEnrollment: (clientPersonId: string, patch: Omit<LtciEnrollment, "clientPersonId" | "clientName">) => void;
  savePayerSetup: (input: { clientPersonId: string; patch: PayerEdit; rate: number; currentRate: number | null; reason: string; effectiveFrom: string }) => void;
  saveDraftEdit: (input: { key: string; hours: number; rate: number | null; reason: string; charges: DraftCharge[]; method: "ach" | "card" }) => void;
  saveFirstPayment: (input: { clientPersonId: string; deposit: number; depositReason: string; technologyFee: number; startsOn: string }) => void;
  /** A correction to an issued invoice. The original amount stays on the record. */
  adjustInvoice: (input: { invoiceId: string; kind: "credit" | "debit"; amount: number; reason: string }) => void;
  /** Stops it counting as money owed; keeps its number and history. */
  voidInvoice: (input: { invoiceId: string; reason: string }) => void;
  /** Money back through Stripe. Care not delivered also brings the invoice down. */
  refundInvoice: (input: { invoiceId: string; amount: number; reason: string; kind: RefundKind; method: "ach" | "card" }) => void;
  /** The family is told again that an invoice exists; the figures wait in the portal. */
  resendInvoice: (input: { invoiceId: string; clientName: string }) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => loadDemoState());

  // Read at call time, not closed over. The audited callbacks are memoised with
  // an empty dependency list so they stay stable across renders; capturing the
  // user at mount would attribute every action for the rest of the session to
  // whoever was signed in first.
  const currentUserRef = useRef(state.currentUser);
  currentUserRef.current = state.currentUser;
  // Same pattern for the whole state, for callbacks that need to read more
  // than they change — recording a payment must see payments recorded a
  // moment ago without being rebuilt on every keystroke of state.
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Record who did something, and put it on the trail.
   *
   * Every audited action calls this rather than appending an entry itself. The
   * writer inside `recordAudit` refuses a misattributed actor, redacts before
   * anything is stored, and returns a failure rather than throwing into the
   * caller — a component that pushed an entry straight onto state would skip
   * all three.
   *
   * `currentUserRef` rather than `state.currentUser`: these callbacks are
   * memoised with an empty dependency list so they stay stable, and closing
   * over the user at mount would attribute every action for the rest of the
   * session to whoever was signed in first.
   */
  const audit = useCallback(
    (entry: Omit<AuditRecord, "organizationId" | "actor">, actor?: AuditRecord["actor"]) => {
      // Signed-in office user unless the caller says who actually did it — a
      // family member signing in the portal is not the office user who is
      // also signed in on this browser.
      const user = currentUserRef.current;
      void recordAudit(
        {
          ...entry,
          organizationId: DEMO_ORG,
          actor: actor ?? { type: "user", userId: user.name },
        },
        new Date().toISOString(),
      ).then((result) => {
        if (!("entry" in result)) {
          // Surfaced rather than swallowed. Losing an entry is a real problem
          // and the writer's contract is that the caller decides what to do
          // about it; deciding to ignore it silently is what makes a trail
          // untrustworthy without anybody noticing.
          console.error("Audit entry could not be written:", result.error);
          return;
        }
        setState((s) => ({ ...s, auditEntries: [result.entry, ...s.auditEntries] }));
      });
    },
    [],
  );


  // Said once. Photos on logged activity are the usual way to fill a device,
  // and the person needs to hear it before a refresh loses their afternoon.
  const warnedStorage = useRef(false);
  useEffect(() => {
    if (saveDemoState(state) || warnedStorage.current) return;
    warnedStorage.current = true;
    toast.error("This device is out of storage", {
      description:
        "Recent changes will not survive a refresh. Removing photos from a few logged activities is the quickest fix.",
      duration: 12_000,
    });
  }, [state]);

  const addContact = useCallback<DemoContextValue["addContact"]>((contact) => {
    setState((s) => ({ ...s, contacts: [contact, ...s.contacts] }));
  }, []);

  /**
   * Any change to a contact, by id.
   *
   * Goes through the override map rather than editing a row, so it works on
   * seeded contacts as well as added ones — a caller should not have to know
   * which list somebody came from in order to change their phone number.
   */
  const editContact = useCallback<DemoContextValue["editContact"]>((contactId, patch) => {
    setState((s) => ({
      ...s,
      contactEdits: { ...s.contactEdits, [contactId]: { ...s.contactEdits[contactId], ...patch } },
    }));
  }, []);

  /**
   * Remove a contact from the list.
   *
   * An id list rather than a filter, because a seeded contact cannot be removed
   * from `peopleSeed.ts` at runtime. Their edits are dropped at the same time —
   * keeping overrides for a contact nobody can see is how a resurrected row
   * comes back wearing changes nobody remembers making.
   */
  const deleteContact = useCallback<DemoContextValue["deleteContact"]>((contactId) => {
    setState((s) => {
      const { [contactId]: dropped, ...edits } = s.contactEdits;
      const base = s.contacts.find((c) => c.id === contactId) ?? seedContacts.find((c) => c.id === contactId);
      // Binned, not shredded: the card sits in Settings → Deleted items for
      // its recovery window, with the edits that were laid over it.
      const deletedRecords = base
        ? [
            binned({
              id: contactId,
              kind: "contact",
              label: base.name,
              sublabel: [base.title, base.organization].filter(Boolean).join(" · ") || "Contact",
              by: currentUserRef.current.name,
              reason: null,
              payload: { kind: "contact", contact: base, edits: dropped ?? null } satisfies DeletedPayload,
            }),
            ...s.deletedRecords,
          ]
        : s.deletedRecords;
      return {
        ...s,
        contacts: s.contacts.filter((c) => c.id !== contactId),
        contactEdits: edits,
        deletedContactIds: [...s.deletedContactIds, contactId],
        deletedRecords,
      };
    });
  }, []);

  /**
   * Put a deleted contact back.
   *
   * Undo rather than a confirmation dialog for the ordinary case. A prompt
   * before every delete taxes the intentional ones — somebody clearing out
   * duplicates hits it repeatedly — while doing nothing for the mis-click,
   * which is dismissed as reflexively as it was triggered. Being able to undo
   * costs nothing when the delete was meant.
   */
  const restoreContact = useCallback<DemoContextValue["restoreContact"]>((contact) => {
    setState((s) => {
      // A seeded contact comes back simply by no longer being hidden. One typed
      // into the app was removed from the list and has to be put back, or it
      // would un-hide a row that no longer exists.
      const seeded = seedContacts.some((c) => c.id === contact.id);

      return {
        ...s,
        deletedContactIds: s.deletedContactIds.filter((id) => id !== contact.id),
        contacts: seeded ? s.contacts : [contact, ...s.contacts],
      };
    });
  }, []);

  /** Recording a conversation is one field's worth of edit. */
  const logContact = useCallback<DemoContextValue["logContact"]>(
    (contactId, on) => editContact(contactId, { lastContactedOn: on.slice(0, 10) }),
    [editContact],
  );

  const addReferral = useCallback<DemoContextValue["addReferral"]>((admission, person) => {
    audit({
      action: "referral.created",
      entityType: "admission",
      entityId: admission.id,
      after: { name: admission.name, service: admission.service },
    });

    setState((s) => ({
      ...s,
      admissions: [admission, ...s.admissions],
      people: [person, ...s.people],
      domainEvents: [
        {
          id: newId("evt"),
          eventType: "referral.created",
          aggregateType: "admission",
          aggregateId: admission.id,
          status: "processed",
          createdAt: new Date().toISOString(),
        },
        ...s.domainEvents,
      ],
    }));
  }, [audit]);

  const saveIntake = useCallback<DemoContextValue["saveIntake"]>((admissionId, patch) => {
    setState((s) => {
      const existing = s.intakes[admissionId] ?? {
        admissionId,
        answers: {},
        visited: [],
        completedAt: null,
        startedAt: new Date().toISOString(),
      };
      return {
        ...s,
        intakes: { ...s.intakes, [admissionId]: { ...existing, ...patch } },
      };
    });
  }, []);

  const completeIntake = useCallback<DemoContextValue["completeIntake"]>((admissionId) => {
    audit({
      action: "intake.corrected",
      entityType: "admission",
      entityId: admissionId,
      metadata: { note: "Phone intake completed" },
    });

    setState((s) => {
      const intake = s.intakes[admissionId];
      if (!intake) return s;
      return {
        ...s,
        intakes: {
          ...s.intakes,
          [admissionId]: { ...intake, completedAt: new Date().toISOString() },
        },
        // Intake completing moves the admission forward. The stage rules in
        // domain/admissions/stages.ts govern which transition is legal.
        admissions: s.admissions.map((a) =>
          a.id === admissionId
            ? {
                ...a,
                stage: "assessment" as const,
                headline: "Intake complete — assessment not scheduled yet",
                meta: "Ready to schedule the RN visit",
                action: "Schedule assessment",
                overdue: false,
              }
            : a,
        ),
        domainEvents: [
          {
            id: newId("evt"),
            eventType: "intake.completed",
            aggregateType: "admission",
            aggregateId: admissionId,
            status: "processed",
            createdAt: new Date().toISOString(),
          },
          ...s.domainEvents,
        ],
      };
    });
  }, [audit]);

  const saveAssessment = useCallback<DemoContextValue["saveAssessment"]>((admissionId, patch) => {
    setState((s) => {
      const existing = s.assessments[admissionId] ?? {
        admissionId,
        answers: {},
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      return { ...s, assessments: { ...s.assessments, [admissionId]: { ...existing, ...patch } } };
    });
  }, []);

  const saveConsents = useCallback<DemoContextValue["saveConsents"]>((admissionId, patch) => {
    // Only the signature itself, not every keystroke of the review. The trail is
    // a record of consequential acts; auditing each Agree/Decline toggle as it
    // is clicked would bury the one entry that matters under two hundred that
    // do not.
    //
    // The signature data is not passed and would be redacted if it were —
    // `signature` and `initials` are on the writer's redaction list. An audit
    // entry records that a thing happened and by whom; it is not a second copy
    // of the signed document.
    if (patch.signedAt) {
      audit({
        action: "signature.captured",
        entityType: "consent_session",
        entityId: admissionId,
        after: {
          signerName: patch.signerName ?? null,
          witnessName: patch.witnessName ?? null,
          witnessRole: patch.witnessRole ?? null,
        },
      });
    }

    setState((s) => {
      const existing = s.consentSessions[admissionId] ?? {
        admissionId,
        decisions: {},
        signerName: null,
        signerRelationship: null,
        signedAt: null,
      };
      const session = { ...existing, ...patch };

      // Signing the packet is what moves the admission on — the assessment is
      // not finished until the client has actually agreed to something.
      const admissions = patch.signedAt
        ? s.admissions.map((a) =>
            a.id === admissionId
              ? {
                  ...a,
                  stage: "pre_onboarding" as const,
                  headline: "Packet signed — ready for the office to review",
                  meta: `Signed by ${session.signerName ?? "the client"}`,
                  action: "Review for admission",
                  scheduledAt: null,
                }
              : a,
          )
        : s.admissions;

      const domainEvents = patch.signedAt
        ? [
            {
              id: newId("evt"),
              eventType: "agreement.signed",
              aggregateType: "admission",
              aggregateId: admissionId,
              status: "processed" as const,
              createdAt: new Date().toISOString(),
            },
            ...s.domainEvents,
          ]
        : s.domainEvents;

      return {
        ...s,
        consentSessions: { ...s.consentSessions, [admissionId]: session },
        admissions,
        domainEvents,
      };
    });
  }, [audit]);

  const savePreOnboarding = useCallback<DemoContextValue["savePreOnboarding"]>((admissionId, patch) => {
    // §4.2: the documented exception is never silent. The entry carries the
    // reason and whose name is on it, in the same breath as the save.
    if (patch.gateOverride) {
      audit({
        action: "admission.gate_overridden",
        entityType: "admission",
        entityId: admissionId,
        after: { reason: patch.gateOverride.reason, by: patch.gateOverride.by },
      });
    }
    setState((s) => {
      const existing = s.preOnboarding[admissionId] ?? {
        admissionId,
        paymentSetup: "not_started",
        rateAgreed: false,
        gateOverride: null,
        carePlanApproved: false,
        approvedAt: null,
        approvedBy: null,
        startOfCareDate: null,
        activatedAt: null,
      };
      return { ...s, preOnboarding: { ...s.preOnboarding, [admissionId]: { ...existing, ...patch } } };
    });
  }, [audit]);

  const approveAdmission = useCallback<DemoContextValue["approveAdmission"]>((admissionId, approvedBy) => {
    // §26 keeps admissions at "prepare summary" authority: Joy assembles the
    // picture and a human admits. The approver's name is already on the record;
    // this puts the act itself on the trail, which is a different question —
    // "who decided" versus "who was named as deciding".
    audit({
      action: "admission.approved",
      entityType: "admission",
      entityId: admissionId,
      after: { approvedBy },
    });

    setState((s) => {
      const existing = s.preOnboarding[admissionId];
      if (!existing) return s;
      return {
        ...s,
        preOnboarding: {
          ...s.preOnboarding,
          [admissionId]: { ...existing, approvedAt: new Date().toISOString(), approvedBy },
        },
        admissions: s.admissions.map((a) =>
          a.id === admissionId
            ? {
                ...a,
                stage: "ready_for_admission" as const,
                headline: "Approved — ready for admission",
                meta: `Approved by ${approvedBy}`,
                action: "Prepare start of care",
              }
            : a,
        ),
        domainEvents: [
          {
            id: newId("evt"),
            eventType: "admission.approved",
            aggregateType: "admission",
            aggregateId: admissionId,
            status: "processed" as const,
            createdAt: new Date().toISOString(),
          },
          ...s.domainEvents,
        ],
      };
    });
  }, [audit]);

  const activateClient = useCallback<DemoContextValue["activateClient"]>((admissionId, startDate) => {
    audit({
      action: "client.activated",
      entityType: "admission",
      entityId: admissionId,
      after: { startOfCare: startDate },
    });

    setState((s) => {
      const admission = s.admissions.find((a) => a.id === admissionId);
      if (!admission) return s;

      // THE RULE, from section 10: admission does NOT create a second person.
      // The existing people row gains a client profile. Nothing is copied.
      const people = s.people.map((p) =>
        `${p.firstName} ${p.lastName}` === admission.name
          ? { ...p, openAdmissionStage: null, clientStatus: "active" as const, admissionDate: startDate }
          : p,
      );

      // Starting care starts the supervisory clock: the RN's first visit is
      // booked for ninety days out, so nobody has to remember to book it.
      const person = s.people.find((p) => `${p.firstName} ${p.lastName}` === admission.name);
      const due = new Date(`${startDate.slice(0, 10)}T12:00:00`);
      due.setDate(due.getDate() + 90);
      const supervisory = person && !s.supervisoryVisits.some((v) => v.clientPersonId === person.personId && !v.completedAt)
        ? [
            ...s.supervisoryVisits,
            bookSupervisoryVisit({
              id: newId("sv"),
              clientPersonId: person.personId,
              clientName: admission.name,
              scheduledFor: due.toISOString().slice(0, 10),
              assignedToUserId: "u-karynn",
            }),
          ]
        : s.supervisoryVisits;

      return {
        ...s,
        people,
        supervisoryVisits: supervisory,
        preOnboarding: {
          ...s.preOnboarding,
          [admissionId]: {
            ...s.preOnboarding[admissionId],
            startOfCareDate: startDate,
            activatedAt: new Date().toISOString(),
          },
        },
        admissions: s.admissions.map((a) =>
          a.id === admissionId
            ? {
                ...a,
                stage: "admitted" as const,
                status: "closed" as const,
                headline: `Active client — care starts ${new Date(startDate).toLocaleDateString([], { month: "short", day: "numeric" })}`,
                meta: "Record now lives under People",
                action: "Open client record",
              }
            : a,
        ),
        domainEvents: [
          {
            id: newId("evt"),
            eventType: "client.activated",
            aggregateType: "admission",
            aggregateId: admissionId,
            status: "processed" as const,
            createdAt: new Date().toISOString(),
          },
          {
            id: newId("evt"),
            eventType: "start_of_care.prepared",
            aggregateType: "admission",
            aggregateId: admissionId,
            status: "processed" as const,
            createdAt: new Date().toISOString(),
          },
          ...s.domainEvents,
        ],
      };
    });
  }, [audit]);

  const scheduleAssessment = useCallback<DemoContextValue["scheduleAssessment"]>((input) => {
    setState((s) => {
      const eventId = newId("sch");
      const now = new Date().toISOString();

      const scheduleEvent: DemoScheduleEvent = {
        id: eventId,
        eventType: "rn_assessment",
        admissionId: input.admissionId,
        clientName: input.clientName,
        assessorName: input.assessorName,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        address: input.address,
        createdAt: now,
      };

      // The notification is queued, never sent inline. A failure here must not
      // undo the booking — that is the whole point of the outbox pattern, and
      // the demo models it rather than pretending messages always arrive.
      const communication: DemoCommunication = {
        id: newId("comm"),
        entityType: "schedule_event",
        entityId: eventId,
        recipientName: input.notifyName,
        channel: "sms",
        provider: "spruce",
        templateKey: "assessment_scheduled",
        status: input.simulateFailure ? "failed" : "queued",
        providerMessageId: null,
        errorMessage: input.simulateFailure ? "Spruce is not connected in this environment." : null,
        createdAt: now,
        sentAt: null,
      };

      const domainEvent: DemoDomainEvent = {
        id: newId("evt"),
        eventType: "assessment.scheduled",
        aggregateType: "admission",
        aggregateId: input.admissionId,
        status: "processed",
        createdAt: now,
      };

      return {
        ...s,
        scheduleEvents: [scheduleEvent, ...s.scheduleEvents],
        communications: [communication, ...s.communications],
        domainEvents: [domainEvent, ...s.domainEvents],
        admissions: s.admissions.map((a) =>
          a.id === input.admissionId
            ? {
                ...a,
                stage: "assessment" as const,
                headline: `RN assessment booked for ${new Date(input.startsAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`,
                meta: `${input.assessorName} · ${input.address}`,
                action: "Open assessment",
                scheduledAt: input.startsAt,
                overdue: false,
              }
            : a,
        ),
      };
    });
  }, []);

  const retryCommunication = useCallback<DemoContextValue["retryCommunication"]>((id) => {
    setState((s) => ({
      ...s,
      communications: s.communications.map((c) =>
        c.id === id && c.status === "failed"
          ? { ...c, status: "queued", errorMessage: null }
          : c,
      ),
    }));
  }, []);

  const assignShift = useCallback<DemoContextValue["assignShift"]>((visitId, caregiverName) => {
    audit({
      action: "schedule.changed",
      entityType: "visit",
      entityId: visitId,
      after: { caregiverName },
    });

    setState((s) => ({
      ...s,
      assignments: { ...s.assignments, [visitId]: caregiverName },
      domainEvents: [
        {
          id: newId("evt"),
          eventType: "shift.assigned",
          aggregateType: "visit",
          aggregateId: visitId,
          status: "processed",
          createdAt: new Date().toISOString(),
        },
        ...s.domainEvents,
      ],
    }));
  }, [audit]);

  const recordExternalPayment = useCallback<DemoContextValue["recordExternalPayment"]>(
    (payment) => {
      // The same checks the receivables engine applies everywhere else. The
      // caller shows the refusals; nothing is recorded on a refusal.
      const state = stateRef.current;
      const all = [...seedPayments, ...state.recordedPayments];
      const invoice = seedIssuedInvoices.find((i) => i.id === payment.invoiceId);
      const refusals = paymentRefusals({
        invoice,
        payments: all.filter((p) => p.invoiceId === payment.invoiceId),
        amount: payment.amount,
        receivedOn: payment.receivedOn,
        asOf: new Date().toISOString().slice(0, 10),
      });
      if (refusals.length > 0) return refusals;

      const remaining = invoice
        ? invoice.total -
          all
            .filter((p) => p.invoiceId === payment.invoiceId)
            .reduce((t, p) => t + p.amount, 0) -
          payment.amount
        : 0;

      audit(
        externalPaymentRecorded({
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount,
          method: payment.method,
          receivedOn: payment.receivedOn,
          reference: payment.reference,
          balanceAfter: Math.round(remaining * 100) / 100,
        }),
      );

      setState((s) => ({ ...s, recordedPayments: [payment, ...s.recordedPayments] }));
      return [];
    },
    [audit],
  );

  const approveDraft = useCallback<DemoContextValue["approveDraft"]>((key, summary) => {
    audit(
      invoiceApproved({
        invoiceId: key,
        total: summary.total,
        lineCount: summary.lineCount,
        ratePlanVersionId: summary.ratePlanVersionId,
      }),
    );
    setState((s) => ({
      ...s,
      approvedDrafts: {
        ...s.approvedDrafts,
        [key]: { by: currentUserRef.current.name, at: new Date().toISOString() },
      },
    }));
  }, [audit]);

  const sendInvoice = useCallback<DemoContextValue["sendInvoice"]>((input) => {
    const state = stateRef.current;
    const number = `JH-${state.nextInvoiceNumber}`;
    const today = new Date().toISOString().slice(0, 10);
    const dueOn = (() => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + 1); // due within one calendar day, per the packet
      return d.toISOString().slice(0, 10);
    })();

    audit(
      invoiceIssued({ invoiceId: number, total: input.total, dueOn }),
    );

    setState((s) => ({
      ...s,
      nextInvoiceNumber: s.nextInvoiceNumber + 1,
      issuedInvoices: [
        {
          id: `inv-${number}`,
          invoiceNumber: number,
          clientPersonId: input.clientPersonId,
          clientName: input.clientName,
          weekStart: input.weekStart,
          weekEnd: input.weekEnd,
          total: input.total,
          lines: input.lines,
          issuedOn: today,
          dueOn,
          writtenOffOn: null,
          writtenOffReason: null,
        },
        ...s.issuedInvoices,
      ],
      // §9.4: the text says an invoice exists; the portal holds the figures.
      communications: [
        {
          id: newId("comm"),
          entityType: "invoice",
          entityId: number,
          recipientName: input.clientName,
          channel: "sms" as const,
          provider: "spruce",
          templateKey: "invoice_notification",
          status: "queued" as const,
          providerMessageId: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          sentAt: null,
        },
        ...s.communications,
      ],
      domainEvents: [
        {
          id: newId("evt"),
          eventType: "invoice.issued",
          aggregateType: "invoice",
          aggregateId: number,
          status: "pending" as const,
          createdAt: new Date().toISOString(),
        },
        ...s.domainEvents,
      ],
      // The sent draft is done; keep the approval record, mark it sent by
      // pointing at the number.
      approvedDrafts: {
        ...s.approvedDrafts,
        [input.key]: { ...s.approvedDrafts[input.key], sentAs: number },
      },
    }));
  }, [audit]);

  const hireEmployee = useCallback<DemoContextValue["hireEmployee"]>((employee) => {
    audit({
      action: "employee.hired",
      entityType: "employee",
      entityId: employee.id,
      after: { name: employee.name },
    });

    setState((s) => ({
      ...s,
      // Replace rather than append, so completing onboarding twice cannot
      // produce two of the same person.
      newHires: [...s.newHires.filter((e) => e.id !== employee.id), employee],
      domainEvents: [
        {
          id: newId("evt"),
          eventType: "employee.hired",
          aggregateType: "employee",
          aggregateId: employee.id,
          status: "processed",
          createdAt: new Date().toISOString(),
        },
        ...s.domainEvents,
      ],
    }));
  }, [audit]);

  const setCurrentUser = useCallback<DemoContextValue["setCurrentUser"]>((user) => {
    setState((s) => ({ ...s, currentUser: user }));
  }, []);

  const reset = useCallback(() => setState(resetDemoState()), []);

  /* ── Employees ────────────────────────────────────────────────────────── */

  const saveEmployee = useCallback<DemoContextValue["saveEmployee"]>((id, profile) => {
    const employeeId = id ?? newId("emp");
    audit({
      action: id ? "employee.updated" : "employee.created",
      entityType: "employee",
      entityId: employeeId,
      after: { name: fullName(profile), role: profile.role, status: profile.status },
    });
    setState((s) => {
      const isAdded = s.addedEmployees.some((a) => a.id === employeeId);
      const stored: EmployeeProfile | null = isAdded
        ? (s.addedEmployees.find((a) => a.id === employeeId)?.profile ?? null)
        : (s.employeeEdits[employeeId] ?? null);
      const seed = seedEmployees.find((e) => e.id === employeeId);
      const before = stored ?? (seed ? profileFromSeed(seed) : null);
      const labels = before ? changedFieldLabels(before, profile) : [];
      const change: ProfileChange | null = id
        ? {
            id: newId("chg"),
            kind: "employee",
            entityId: employeeId,
            name: fullName(profile),
            what: "profile",
            summary: before ? changeSummary(labels) : "Profile filled in",
            before: stored,
            changedAt: new Date().toISOString(),
            changedBy: currentUserRef.current.name,
          }
        : null;
      // Nothing moved: no change record, no override written.
      if (change && before && labels.length === 0) return s;
      const profileChanges = change ? [change, ...s.profileChanges] : s.profileChanges;
      if (!id || isAdded) {
        return {
          ...s,
          profileChanges,
          addedEmployees: isAdded
            ? s.addedEmployees.map((a) => (a.id === employeeId ? { id: employeeId, profile } : a))
            : [{ id: employeeId, profile }, ...s.addedEmployees],
        };
      }
      return { ...s, profileChanges, employeeEdits: { ...s.employeeEdits, [employeeId]: profile } };
    });
    return employeeId;
  }, [audit]);

  const setEmployeeStatus = useCallback<DemoContextValue["setEmployeeStatus"]>((id, status, name) => {
    audit({ action: "employee.status_changed", entityType: "employee", entityId: id, after: { status } });
    setState((s) => {
      const added = s.addedEmployees.find((a) => a.id === id);
      const stored: EmployeeProfile | null = added ? added.profile : (s.employeeEdits[id] ?? null);
      const from: EmployeeStatus | undefined = added
        ? added.profile.status
        : (s.employeeEdits[id]?.status ?? seedEmployees.find((e) => e.id === id)?.status);
      if (from === status) return s;
      const change: ProfileChange = {
        id: newId("chg"),
        kind: "employee",
        entityId: id,
        name: name ?? (stored ? fullName(stored) : id),
        what: "status",
        summary: `${from ? EMPLOYEE_STATUS_LABELS[from] : "Status"} → ${EMPLOYEE_STATUS_LABELS[status]}`,
        before: stored,
        changedAt: new Date().toISOString(),
        changedBy: currentUserRef.current.name,
      };
      const profileChanges = [change, ...s.profileChanges];
      if (added) {
        return {
          ...s,
          profileChanges,
          addedEmployees: s.addedEmployees.map((a) => (a.id === id ? { ...a, profile: { ...a.profile, status } } : a)),
        };
      }
      const seed = seedEmployees.find((e) => e.id === id);
      const base = s.employeeEdits[id] ?? (seed ? profileFromSeed(seed) : null);
      if (!base) return s;
      return { ...s, profileChanges, employeeEdits: { ...s.employeeEdits, [id]: { ...base, status } } };
    });
  }, [audit]);

  const undoProfileChange = useCallback<DemoContextValue["undoProfileChange"]>((changeId) => {
    const change = stateRef.current.profileChanges.find((c) => c.id === changeId);
    if (!change) return;
    audit({
      action: change.kind === "employee" ? "employee.change_undone" : "client.change_undone",
      entityType: change.kind,
      entityId: change.entityId,
      before: { what: change.what, summary: change.summary, changedAt: change.changedAt, changedBy: change.changedBy },
    });
    setState((s) => {
      const profileChanges = s.profileChanges.filter((c) => c.id !== changeId);
      if (change.kind === "client") {
        const clientStatuses = { ...s.clientStatuses };
        if (change.before) clientStatuses[change.entityId] = change.before as DemoState["clientStatuses"][string];
        else delete clientStatuses[change.entityId];
        return { ...s, profileChanges, clientStatuses };
      }
      if (s.addedEmployees.find((a) => a.id === change.entityId)) {
        return change.before
          ? {
              ...s,
              profileChanges,
              addedEmployees: s.addedEmployees.map((a) =>
                a.id === change.entityId ? { ...a, profile: change.before as EmployeeProfile } : a,
              ),
            }
          : { ...s, profileChanges };
      }
      const employeeEdits = { ...s.employeeEdits };
      if (change.before) employeeEdits[change.entityId] = change.before as EmployeeProfile;
      else delete employeeEdits[change.entityId];
      return { ...s, profileChanges, employeeEdits };
    });
  }, [audit]);

  const deleteEmployee = useCallback<DemoContextValue["deleteEmployee"]>((id, name, reason) => {
    audit({ action: "employee.deleted", entityType: "employee", entityId: id, after: { reason: reason ?? null } });
    setState((s) => {
      const added = s.addedEmployees.find((a) => a.id === id);
      const edits = s.employeeEdits[id] ?? null;
      const payload: DeletedPayload = { kind: "employee", employeeId: id, edits, added: added?.profile ?? null };
      return {
        ...s,
        deletedEmployeeIds: [...new Set([...s.deletedEmployeeIds, id])],
        deletedRecords: [
          binned({ id, kind: "employee", label: name, sublabel: "Employee record", by: currentUserRef.current.name, reason, payload }),
          ...s.deletedRecords,
        ],
      };
    });
  }, [audit]);

  const deleteClient = useCallback<DemoContextValue["deleteClient"]>((personId, name, reason) => {
    audit({ action: "client.deleted", entityType: "client", entityId: personId, after: { reason: reason ?? null } });
    setState((s) => ({
      ...s,
      deletedClientIds: [...new Set([...s.deletedClientIds, personId])],
      deletedRecords: [
        binned({
          id: personId,
          kind: "client",
          label: name,
          sublabel: "Client record",
          by: currentUserRef.current.name,
          reason,
          payload: { kind: "client", clientPersonId: personId } satisfies DeletedPayload,
        }),
        ...s.deletedRecords,
      ],
    }));
  }, [audit]);

  const deleteAdmission = useCallback<DemoContextValue["deleteAdmission"]>((admissionId, reason) => {
    setState((s) => {
      const admission = s.admissions.find((a) => a.id === admissionId);
      if (!admission) return s;
      // Texas retention: a record that became a client is kept, not binned.
      if (admission.stage === "admitted" || s.preOnboarding[admissionId]?.activatedAt) return s;
      // The person row was made with the referral and goes with it. Matched
      // by name, which is how the admission and the person are joined
      // everywhere else in the demo (consentSessionForClient).
      const person = s.people.find((p) => `${p.firstName} ${p.lastName}` === admission.name && !p.clientStatus) ?? null;
      const mrNumber = s.mrNumbers[admissionId] ?? null;
      const { [admissionId]: _mr, ...mrNumbers } = s.mrNumbers;
      const payload: DeletedPayload = { kind: "admission", admission, person, mrNumber };
      return {
        ...s,
        admissions: s.admissions.filter((a) => a.id !== admissionId),
        people: person ? s.people.filter((p) => p.personId !== person.personId) : s.people,
        mrNumbers,
        deletedRecords: [
          binned({
            id: admissionId,
            kind: "admission",
            label: admission.name,
            sublabel: `Admission · ${admission.stage.replace(/_/g, " ")}`,
            by: currentUserRef.current.name,
            reason,
            payload,
          }),
          ...s.deletedRecords,
        ],
      };
    });
    audit({ action: "admission.deleted", entityType: "admission", entityId: admissionId, after: { reason: reason ?? null } });
  }, [audit]);

  const restoreDeleted = useCallback<DemoContextValue["restoreDeleted"]>((id) => {
    setState((s) => {
      const record = s.deletedRecords.find((r) => r.id === id) as DeletedRecord<DeletedPayload> | undefined;
      if (!record) return s;
      const deletedRecords = s.deletedRecords.filter((r) => r.id !== id);
      const p = record.payload;
      if (p.kind === "contact") {
        const seeded = seedContacts.some((c) => c.id === id);
        return {
          ...s,
          deletedRecords,
          deletedContactIds: s.deletedContactIds.filter((x) => x !== id),
          contacts: seeded ? s.contacts : [p.contact, ...s.contacts],
          contactEdits: p.edits ? { ...s.contactEdits, [id]: p.edits } : s.contactEdits,
        };
      }
      if (p.kind === "employee") {
        return {
          ...s,
          deletedRecords,
          deletedEmployeeIds: s.deletedEmployeeIds.filter((x) => x !== p.employeeId),
          employeeEdits: p.edits ? { ...s.employeeEdits, [p.employeeId]: p.edits } : s.employeeEdits,
          addedEmployees:
            p.added && !s.addedEmployees.some((a) => a.id === p.employeeId)
              ? [{ id: p.employeeId, profile: p.added }, ...s.addedEmployees]
              : s.addedEmployees,
        };
      }
      if (p.kind === "client") {
        return { ...s, deletedRecords, deletedClientIds: s.deletedClientIds.filter((x) => x !== p.clientPersonId) };
      }
      if (p.kind === "activity") {
        return { ...s, deletedRecords, interactions: [p.interaction, ...s.interactions] };
      }
      if (p.kind === "admission") {
        return {
          ...s,
          deletedRecords,
          admissions: [p.admission, ...s.admissions],
          people: p.person ? [p.person, ...s.people] : s.people,
          mrNumbers: p.mrNumber ? { ...s.mrNumbers, [id]: p.mrNumber } : s.mrNumbers,
        };
      }
      if (p.kind === "document") return { ...s, deletedRecords, documents: [p.document, ...s.documents] };
      if (p.kind === "sop") return { ...s, deletedRecords, sops: [p.sop, ...s.sops] };
      return { ...s, deletedRecords };
    });
    audit({ action: "record.restored", entityType: "deleted_record", entityId: id });
  }, [audit]);

  const purgeDeleted = useCallback<DemoContextValue["purgeDeleted"]>((id) => {
    audit({ action: "record.purged", entityType: "deleted_record", entityId: id });
    setState((s) => ({ ...s, deletedRecords: s.deletedRecords.filter((r) => r.id !== id) }));
  }, [audit]);

  /* ── Activity ─────────────────────────────────────────────────────────── */

  const logActivity = useCallback<DemoContextValue["logActivity"]>(({ draft, subject }) => {
    const interaction = interactionFromDraft({
      draft,
      id: newId("act"),
      subject,
      loggedBy: stateRef.current.currentUser.name,
    });
    // The channel and the source, never the notes: an audit line says an
    // activity was logged, not what somebody's mother said on the phone.
    audit({
      action: "activity.logged",
      entityType: subject.kind,
      entityId: subject.id,
      after: { at: interaction.at, channel: interaction.channel, source: interaction.source },
    });
    setState((s) => ({ ...s, interactions: [interaction, ...s.interactions] }));
    if (subject.kind === "contact" && interaction.channel !== "note") {
      editContact(subject.id, { lastContactedOn: interaction.at.slice(0, 10) });
    }
    return interaction;
  }, [audit, editContact]);

  const deleteActivity = useCallback<DemoContextValue["deleteActivity"]>((id) => {
    audit({ action: "activity.deleted", entityType: "activity", entityId: id });
    setState((s) => {
      const interaction = s.interactions.find((i) => i.id === id);
      return {
        ...s,
        interactions: s.interactions.filter((i) => i.id !== id),
        deletedRecords: interaction
          ? [
              binned({
                id,
                kind: "activity",
                label: interaction.summary || "Logged activity",
                sublabel: new Date(interaction.at).toLocaleDateString([], { month: "long", day: "numeric" }),
                by: currentUserRef.current.name,
                payload: { kind: "activity", interaction } satisfies DeletedPayload,
              }),
              ...s.deletedRecords,
            ]
          : s.deletedRecords,
      };
    });
  }, [audit]);

  const recordView = useCallback<DemoContextValue["recordView"]>((entityType, entityId, label) => {
    // Staff opening a record is routine; a surveyor opening one is the thing
    // the agency would want on the trail. Only the read-only session is logged.
    if (canWrite(stateRef.current.currentUser.role)) return;
    audit({ action: "record.viewed", entityType, entityId, after: { label } });
  }, [audit]);

  const issueMrNumber = useCallback<DemoContextValue["issueMrNumber"]>((entityId, number) => {
    audit({ action: "record.updated", entityType: "person", entityId, after: { mrNumber: number } });
    setState((s) => ({ ...s, mrNumbers: { ...s.mrNumbers, [entityId]: number } }));
  }, [audit]);

  const setClientStatus = useCallback<DemoContextValue["setClientStatus"]>((input) => {
    audit({
      action: "client.status_changed",
      entityType: "client",
      entityId: input.clientPersonId,
      after: { status: input.status, lastServiceOn: input.lastServiceOn ?? null },
    });
    setState((s) => {
      const before = s.clientStatuses[input.clientPersonId] ?? null;
      const now = new Date().toISOString();
      const change: ProfileChange = {
        id: newId("chg"),
        kind: "client",
        entityId: input.clientPersonId,
        name: input.name ?? input.clientPersonId,
        what: "status",
        summary: `${before ? CLIENT_STATUS_LABELS[before.status] : "Status"} → ${CLIENT_STATUS_LABELS[input.status]}`,
        before,
        changedAt: now,
        changedBy: currentUserRef.current.name,
      };
      return {
        ...s,
        profileChanges: [change, ...s.profileChanges],
        clientStatuses: {
          ...s.clientStatuses,
          [input.clientPersonId]: {
            status: input.status,
            changedAt: now,
            changedBy: currentUserRef.current.name,
            note: input.note?.trim() || null,
            lastServiceOn: input.status === "discharged" ? (input.lastServiceOn ?? null) : null,
          },
        },
      };
    });
  }, [audit]);

  /* ── Documents ────────────────────────────────────────────────────────── */

  const uploadDocument = useCallback<DemoContextValue["uploadDocument"]>((doc) => {
    const id = newId("doc");
    audit({ action: "document.uploaded", entityType: "document", entityId: id, after: { name: doc.name, folder: doc.folder } });
    setState((s) => ({
      ...s,
      documents: [{ ...doc, id, uploadedAt: new Date().toISOString(), uploadedBy: currentUserRef.current.name }, ...s.documents],
    }));
    return id;
  }, [audit]);

  const requestSignature = useCallback<DemoContextValue["requestSignature"]>((input) => {
    const id = newId("sig");
    const request = newSignatureRequest({ ...input, id, requestedBy: currentUserRef.current.name, at: new Date().toISOString() });
    audit({ action: "signature.requested", entityType: "signature_request", entityId: id, after: { documentId: input.documentId, clientPersonId: input.clientPersonId, signerRole: input.signerRole } });
    setState((s) => ({ ...s, signatureRequests: [request, ...s.signatureRequests] }));
    return id;
  }, [audit]);

  const signSignatureRequest = useCallback<DemoContextValue["signSignatureRequest"]>((id, input) => {
    const current = stateRef.current.signatureRequests.find((r) => r.id === id);
    if (!current) return;
    const signed = signRequest({ request: current, typedName: input.typedName, markDrawn: input.markDrawn, at: new Date().toISOString() });
    audit(
      { action: "signature.signed", entityType: "signature_request", entityId: id, before: { status: current.status }, after: { status: "signed", signedName: signed.signedName, markDrawn: true } },
      { type: "user", userId: signed.signedName ?? current.signerName },
    );
    setState((s) => ({ ...s, signatureRequests: s.signatureRequests.map((r) => (r.id === id ? signed : r)) }));
  }, [audit]);

  const declineSignatureRequest = useCallback<DemoContextValue["declineSignatureRequest"]>((id, reason) => {
    const current = stateRef.current.signatureRequests.find((r) => r.id === id);
    if (!current) return;
    const declined = declineRequest({ request: current, reason, at: new Date().toISOString() });
    audit({ action: "signature.declined", entityType: "signature_request", entityId: id, before: { status: current.status }, after: { status: "declined" } }, { type: "user", userId: current.signerName });
    setState((s) => ({ ...s, signatureRequests: s.signatureRequests.map((r) => (r.id === id ? declined : r)) }));
  }, [audit]);

  const tagDocument = useCallback<DemoContextValue["tagDocument"]>((id, tag, remove) => {
    setState((s) => ({ ...s, documents: s.documents.map((d) => (d.id === id ? (remove ? untagDocument(d, tag) : tagDoc(d, tag)) : d)) }));
  }, []);

  const updateDocument = useCallback<DemoContextValue["updateDocument"]>((id, patch) => {
    setState((s) => ({ ...s, documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }, []);

  const duplicateDocument = useCallback<DemoContextValue["duplicateDocument"]>((id) => {
    setState((s) => {
      const doc = s.documents.find((d) => d.id === id);
      if (!doc) return s;
      const dot = doc.name.lastIndexOf(".");
      const name = dot > 0 ? `${doc.name.slice(0, dot)} (copy)${doc.name.slice(dot)}` : `${doc.name} (copy)`;
      const copy: LibraryDocument = { ...doc, id: newId("doc"), name, uploadedAt: new Date().toISOString(), uploadedBy: currentUserRef.current.name };
      return { ...s, documents: [copy, ...s.documents] };
    });
  }, []);

  const deleteDocument = useCallback<DemoContextValue["deleteDocument"]>((id) => {
    audit({ action: "document.deleted", entityType: "document", entityId: id });
    setState((s) => {
      const doc = s.documents.find((d) => d.id === id);
      if (!doc) return s;
      const seeded = seedDocuments.some((d) => d.id === id);
      return {
        ...s,
        documents: s.documents.filter((d) => d.id !== id),
        retiredSeedDocumentIds: seeded && !s.retiredSeedDocumentIds.includes(id) ? [...s.retiredSeedDocumentIds, id] : s.retiredSeedDocumentIds,
        deletedRecords: [
          binned({
            id,
            kind: "document",
            label: doc.name,
            sublabel: `${doc.folder}${doc.tags.length ? ` · ${doc.tags.join(", ")}` : ""}`,
            by: currentUserRef.current.name,
            payload: { kind: "document", document: doc } satisfies DeletedPayload,
          }),
          ...s.deletedRecords,
        ],
      };
    });
  }, [audit]);

  const addDocumentFolder = useCallback<DemoContextValue["addDocumentFolder"]>((raw) => {
    const name = cleanFolderName(raw);
    if (!name) return;
    audit({ action: "document.folder_created", entityType: "document_folder", entityId: name });
    setState((s) =>
      s.documentFolders.some((f) => f.toLowerCase() === name.toLowerCase()) ? s : { ...s, documentFolders: [...s.documentFolders, name] },
    );
  }, [audit]);

  const renameDocumentFolder = useCallback<DemoContextValue["renameDocumentFolder"]>((from, to) => {
    const name = cleanFolderName(to);
    if (!name || name === from) return;
    audit({ action: "document.folder_renamed", entityType: "document_folder", entityId: from, after: { name } });
    setState((s) => ({
      ...s,
      documentFolders: s.documentFolders.map((f) => (f === from ? name : f)),
      documents: renameFolderOnDocuments(s.documents, from, name),
    }));
  }, [audit]);

  const deleteDocumentFolder = useCallback<DemoContextValue["deleteDocumentFolder"]>((name, moveTo) => {
    audit({ action: "document.folder_deleted", entityType: "document_folder", entityId: name, after: { movedTo: moveTo } });
    setState((s) => {
      // Every file has to live somewhere, so the last folder stays.
      if (s.documentFolders.length < 2) return s;
      const target = s.documentFolders.find((f) => f === moveTo && f !== name) ?? s.documentFolders.find((f) => f !== name);
      if (!target) return s;
      return {
        ...s,
        documentFolders: s.documentFolders.filter((f) => f !== name),
        documents: moveFolderDocuments(s.documents, name, target),
      };
    });
  }, [audit]);

  /* ── SOPs ─────────────────────────────────────────────────────────────── */

  const addSop = useCallback<DemoContextValue["addSop"]>((input) => {
    const id = newId("sop");
    const now = new Date().toISOString();
    audit({ action: "sop.created", entityType: "sop", entityId: id, after: { title: input.title, category: input.category } });
    setState((s) => ({
      ...s,
      sops: [
        {
          id,
          title: input.title,
          category: input.category,
          ownerName: input.ownerName,
          updatedAt: now,
          versions: [{ version: 1, updatedAt: now, updatedBy: input.ownerName, content: input.content }],
        },
        ...s.sops,
      ],
    }));
    return id;
  }, [audit]);

  const updateSop = useCallback<DemoContextValue["updateSop"]>((id, patch) => {
    setState((s) => ({ ...s, sops: s.sops.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }, []);

  const saveSopVersion = useCallback<DemoContextValue["saveSopVersion"]>((id, content) => {
    const now = new Date().toISOString();
    const by = currentUserRef.current.name;
    audit({ action: "sop.revised", entityType: "sop", entityId: id });
    setState((s) => ({ ...s, sops: s.sops.map((x) => (x.id === id ? withNewVersion(x, content, by, now) : x)) }));
  }, [audit]);

  const deleteSop = useCallback<DemoContextValue["deleteSop"]>((id) => {
    audit({ action: "sop.deleted", entityType: "sop", entityId: id });
    setState((s) => {
      const sop = s.sops.find((x) => x.id === id);
      if (!sop) return s;
      return {
        ...s,
        sops: s.sops.filter((x) => x.id !== id),
        deletedRecords: [
          binned({
            id,
            kind: "sop",
            label: sop.title,
            sublabel: `${sop.category} · v${sop.versions.length}`,
            by: currentUserRef.current.name,
            payload: { kind: "sop", sop } satisfies DeletedPayload,
          }),
          ...s.deletedRecords,
        ],
      };
    });
  }, [audit]);

  const renameSopCategory = useCallback<DemoContextValue["renameSopCategory"]>((from, to) => {
    audit({ action: "sop.category_renamed", entityType: "sop_category", entityId: from, after: { name: to } });
    setState((s) => ({ ...s, sops: renameCategory(s.sops, from, to) }));
  }, [audit]);

  const moveSopCategory = useCallback<DemoContextValue["moveSopCategory"]>((from, to) => {
    audit({ action: "sop.category_emptied", entityType: "sop_category", entityId: from, after: { movedTo: to } });
    setState((s) => ({ ...s, sops: moveCategory(s.sops, from, to) }));
  }, [audit]);

  /* ── Scheduling ─────────────────────────────────────────────────────── */

  const addShift = useCallback<DemoContextValue["addShift"]>((visit) => {
    audit({ action: "shift.created", entityType: "visit", entityId: visit.id, after: { clientName: visit.clientName, startsAt: visit.startsAt, caregiverName: visit.caregiverName } });
    setState((s) => ({ ...s, shifts: [...s.shifts, visit] }));
  }, [audit]);

  const addScheduleEvent = useCallback<DemoContextValue["addScheduleEvent"]>((event) => {
    audit({ action: `schedule.${event.eventType}.added`, entityType: "schedule_event", entityId: event.id, after: { clientName: event.clientName, startsAt: event.startsAt } });
    setState((s) => ({ ...s, scheduleEvents: [event, ...s.scheduleEvents] }));
  }, [audit]);

  const requestTimeOff = useCallback<DemoContextValue["requestTimeOff"]>((draft) => {
    const off: TimeOff = {
      id: newId("off"),
      caregiverName: draft.caregiverName,
      from: draft.from,
      to: draft.to,
      reason: draft.reason.trim() || null,
      requestedAt: new Date().toISOString(),
      recordedBy: currentUserRef.current.name,
    };
    audit({ action: "time_off.requested", entityType: "employee", entityId: off.caregiverName, after: { from: off.from, to: off.to } });
    setState((s) => ({ ...s, timeOff: [...s.timeOff, off] }));
    return off;
  }, [audit]);

  const cancelTimeOff = useCallback<DemoContextValue["cancelTimeOff"]>((id) => {
    const off = stateRef.current.timeOff.find((o) => o.id === id);
    if (off) audit({ action: "time_off.cancelled", entityType: "employee", entityId: off.caregiverName, before: { from: off.from, to: off.to } });
    setState((s) => {
      const gone = s.timeOff.find((o) => o.id === id);
      // The decisions taken on the days it opened go with it.
      const opened = new Set(
        gone
          ? s.coverDecisions.filter((d) => {
              const v = [...s.shifts].find((x) => x.id === d.visitId);
              return v ? v.caregiverName === gone.caregiverName : false;
            }).map((d) => d.visitId)
          : [],
      );
      return { ...s, timeOff: s.timeOff.filter((o) => o.id !== id), coverDecisions: s.coverDecisions.filter((d) => !opened.has(d.visitId)) };
    });
  }, [audit]);

  const declineCover = useCallback<DemoContextValue["declineCover"]>(({ visitId, confirmedWith, note }) => {
    audit({ action: "cover.declined", entityType: "visit", entityId: visitId, after: { confirmedWith } });
    setState((s) => ({
      ...s,
      coverDecisions: [
        ...s.coverDecisions.filter((d) => d.visitId !== visitId),
        { visitId, confirmedWith: confirmedWith.trim(), note, recordedBy: currentUserRef.current.name, recordedAt: new Date().toISOString() },
      ],
    }));
  }, [audit]);

  const saveCoverageEvent = useCallback<DemoContextValue["saveCoverageEvent"]>((event) => {
    audit({ action: "coverage.plan_saved", entityType: "coverage_event", entityId: event.id, after: { clientName: event.clientName, shifts: event.shifts.length } });
    setState((s) => ({
      ...s,
      coverageEvents: s.coverageEvents.some((e) => e.id === event.id) ? s.coverageEvents.map((e) => (e.id === event.id ? event : e)) : [...s.coverageEvents, event],
    }));
  }, [audit]);

  const approveCoveragePlan = useCallback<DemoContextValue["approveCoveragePlan"]>((id) => {
    audit({ action: "coverage.plan_approved", entityType: "coverage_event", entityId: id });
    setState((s) => ({
      ...s,
      coverageEvents: s.coverageEvents.map((e) => (e.id === id ? { ...e, approvedAt: new Date().toISOString(), approvedBy: currentUserRef.current.name } : e)),
    }));
  }, [audit]);

  const approveCoverageOvertime = useCallback<DemoContextValue["approveCoverageOvertime"]>((id, approval) => {
    audit({ action: "coverage.overtime_approved", entityType: "coverage_event", entityId: id, after: { caregiverName: approval.caregiverName, hours: approval.hours, weekStart: approval.weekStart } });
    setState((s) => ({
      ...s,
      coverageEvents: s.coverageEvents.map((e) =>
        e.id === id
          ? { ...e, overtimeApprovals: [...e.overtimeApprovals, { ...approval, approvedBy: currentUserRef.current.name, approvedAt: new Date().toISOString() }] }
          : e,
      ),
    }));
  }, [audit]);

  const reopenCoverageShift = useCallback<DemoContextValue["reopenCoverageShift"]>((id, shiftId) => {
    audit({ action: "coverage.shift_reopened", entityType: "coverage_event", entityId: id, after: { shiftId } });
    setState((s) => ({ ...s, coverageEvents: s.coverageEvents.map((e) => (e.id === id ? unassignShift(e, shiftId) : e)) }));
  }, [audit]);

  const cancelCoverageEvent = useCallback<DemoContextValue["cancelCoverageEvent"]>((id) => {
    audit({ action: "coverage.cancelled", entityType: "coverage_event", entityId: id });
    setState((s) => ({ ...s, coverageEvents: s.coverageEvents.map((e) => (e.id === id ? { ...e, cancelledAt: new Date().toISOString() } : e)) }));
  }, [audit]);

  const approveOvertime = useCallback<DemoContextValue["approveOvertime"]>((approval) => {
    audit({ action: "overtime.approved", entityType: "employee", entityId: approval.caregiverName, after: { hours: approval.hours, weekStart: approval.weekStart } });
    setState((s) => ({
      ...s,
      overtimeApprovals: [...s.overtimeApprovals, { ...approval, approvedBy: currentUserRef.current.name, approvedAt: new Date().toISOString() }],
    }));
  }, [audit]);

  const authorizeEarlyStart = useCallback<DemoContextValue["authorizeEarlyStart"]>((visitId, allowed) => {
    audit({ action: allowed ? "visit.early_start_authorized" : "visit.early_start_withdrawn", entityType: "visit", entityId: visitId });
    setState((s) => ({ ...s, earlyStarts: { ...s.earlyStarts, [visitId]: allowed } }));
  }, [audit]);

  const recordClockAttempt = useCallback<DemoContextValue["recordClockAttempt"]>((attempt) => {
    setState((s) => ({ ...s, clockAttempts: [...s.clockAttempts, attempt] }));
  }, []);

  const recordClock = useCallback<DemoContextValue["recordClock"]>((visitId, which, at) => {
    audit({ action: which === "in" ? "visit.clocked_in" : "visit.clocked_out", entityType: "visit", entityId: visitId, after: { at } });
    setState((s) => ({
      ...s,
      clockEvents: { ...s.clockEvents, [visitId]: { ...s.clockEvents[visitId], [which === "in" ? "inAt" : "outAt"]: at } },
    }));
  }, [audit]);

  const recordClockCorrection = useCallback<DemoContextValue["recordClockCorrection"]>((correction) => {
    audit({
      action: "visit.clock_corrected",
      entityType: "visit",
      entityId: correction.visitId,
      after: { reasonCode: correction.reasonCode, actionCode: correction.actionCode, clockedInAt: correction.clockedInAt, clockedOutAt: correction.clockedOutAt },
    });
    setState((s) => ({
      ...s,
      clockCorrections: { ...s.clockCorrections, [correction.visitId]: correction },
      clockEvents: {
        ...s.clockEvents,
        [correction.visitId]: {
          inAt: correction.clockedInAt ?? s.clockEvents[correction.visitId]?.inAt ?? null,
          outAt: correction.clockedOutAt ?? s.clockEvents[correction.visitId]?.outAt ?? null,
        },
      },
    }));
  }, [audit]);

  const setClockPlace = useCallback<DemoContextValue["setClockPlace"]>((visitId, which, place) => {
    setState((s) => ({ ...s, clockPlaces: { ...s.clockPlaces, [visitId]: { ...s.clockPlaces[visitId], [which]: place } } }));
  }, []);

  const proposeClock = useCallback<DemoContextValue["proposeClock"]>((proposal) => {
    setState((s) => ({ ...s, clockProposals: { ...s.clockProposals, [`${proposal.visitId}:${proposal.which}`]: proposal } }));
  }, []);

  const decideClockProposal = useCallback<DemoContextValue["decideClockProposal"]>((key, approved, by) => {
    const proposal = stateRef.current.clockProposals[key];
    if (!proposal) return;
    audit({ action: approved ? "visit.clock_proposal_approved" : "visit.clock_proposal_declined", entityType: "visit", entityId: proposal.visitId, after: { which: proposal.which, at: proposal.confirmedAt } });
    setState((s) => {
      const p = s.clockProposals[key];
      if (!p) return s;
      const decided: ClockProposal = { ...p, status: approved ? "approved" : "declined", decidedBy: by, decidedAt: new Date().toISOString() };
      return {
        ...s,
        clockProposals: { ...s.clockProposals, [key]: decided },
        clockEvents: approved
          ? { ...s.clockEvents, [p.visitId]: { ...s.clockEvents[p.visitId], [p.which === "in" ? "inAt" : "outAt"]: p.confirmedAt } }
          : s.clockEvents,
      };
    });
  }, [audit]);

  const setServiceMix = useCallback<DemoContextValue["setServiceMix"]>((clientPersonId, mix) => {
    audit({ action: "care_plan.service_mix_changed", entityType: "client", entityId: clientPersonId, after: { mix: mix.map((m) => `${m.percent}% ${m.service}`).join(", ") } });
    setState((s) => {
      const { [clientPersonId]: _dropped, ...confirmed } = s.serviceMixConfirmed;
      void _dropped;
      return { ...s, serviceMixes: { ...s.serviceMixes, [clientPersonId]: mix }, serviceMixConfirmed: confirmed };
    });
  }, [audit]);

  const confirmServiceMix = useCallback<DemoContextValue["confirmServiceMix"]>((clientPersonId, by) => {
    audit({ action: "care_plan.service_mix_confirmed", entityType: "client", entityId: clientPersonId });
    setState((s) => ({ ...s, serviceMixConfirmed: { ...s.serviceMixConfirmed, [clientPersonId]: { by, at: new Date().toISOString() } } }));
  }, [audit]);

  const recordVisitChange = useCallback<DemoContextValue["recordVisitChange"]>((change) => {
    setState((s) => ({ ...s, visitChanges: [...s.visitChanges, change] }));
  }, []);

  const addApprovedLocation = useCallback<DemoContextValue["addApprovedLocation"]>((location) => {
    audit({ action: "location.proposed", entityType: "client", entityId: location.clientPersonId, after: { label: location.label } });
    setState((s) => ({ ...s, approvedLocations: [...s.approvedLocations, location] }));
  }, [audit]);

  const decideLocation = useCallback<DemoContextValue["decideLocation"]>((id, approve, by) => {
    const loc = stateRef.current.approvedLocations.find((l) => l.id === id);
    if (loc) audit({ action: approve ? "location.approved" : "location.declined", entityType: "client", entityId: loc.clientPersonId, after: { label: loc.label } });
    setState((s) => ({
      ...s,
      approvedLocations: approve
        ? s.approvedLocations.map((l) => (l.id === id ? { ...l, status: "approved" as const, decidedBy: by, decidedOn: new Date().toISOString() } : l))
        : s.approvedLocations.filter((l) => l.id !== id),
    }));
  }, [audit]);

  const recordMileage = useCallback<DemoContextValue["recordMileage"]>((mileage) => {
    audit({ action: "visit.mileage_recorded", entityType: "visit", entityId: mileage.visitId, after: { actualMiles: mileage.actualMiles } });
    setState((s) => ({ ...s, visitMileage: { ...s.visitMileage, [mileage.visitId]: mileage } }));
  }, [audit]);

  const recordExpenses = useCallback<DemoContextValue["recordExpenses"]>((visitId, items, by) => {
    const before = stateRef.current.visitExpenses[visitId] ?? [];
    const now = new Date();
    // Category and amount only. A receipt's file name can carry a person's
    // name or a pharmacy's, and the trail is read by more people than the visit.
    const line = (e: VisitExpense) => `${e.category}:${e.amount}`;
    for (const e of items) {
      const prev = before.find((x) => x.id === e.id);
      if (!prev) audit({ action: "visit.expenses_recorded", entityType: "visit", entityId: visitId, after: { item: line(e) } });
      else if (!prev.deletedAt && e.deletedAt) audit({ action: "visit.expense_deleted", entityType: "visit", entityId: visitId, before: { item: line(e) } });
      else if (prev.deletedAt && !e.deletedAt) audit({ action: "visit.expense_restored", entityType: "visit", entityId: visitId, after: { item: line(e) } });
      else if (!prev.reviewedAt && e.reviewedAt) audit({ action: "visit.expense_reviewed", entityType: "visit", entityId: visitId, after: { item: line(e), by } });
    }
    setState((s) => ({ ...s, visitExpenses: { ...s.visitExpenses, [visitId]: purgeExpired(items, now) } }));
  }, [audit]);

  const recordVisitPay = useCallback<DemoContextValue["recordVisitPay"]>((pay) => {
    audit({ action: "visit.pay_set", entityType: "visit", entityId: pay.visitId, after: { rate: pay.rate, rateKind: pay.rateKind, onCall: pay.onCall, payNextDay: pay.payNextDay } });
    setState((s) => ({ ...s, visitPay: { ...s.visitPay, [pay.visitId]: pay } }));
  }, [audit]);

  const askForPhone = useCallback<DemoContextValue["askForPhone"]>((caregiverName, by, at) => {
    audit({ action: "employee.phone_asked", entityType: "employee", entityId: caregiverName });
    setState((s) => ({ ...s, phoneAsks: { ...s.phoneAsks, [caregiverName]: { askedBy: by, askedAt: at, answeredAt: null } } }));
  }, [audit]);

  const answerPhoneAsk = useCallback<DemoContextValue["answerPhoneAsk"]>((caregiverName, phone, at) => {
    // The number goes on the record, never on the trail.
    audit({ action: "employee.phone_given", entityType: "employee", entityId: caregiverName });
    setState((s) => {
      const employee = seedEmployees.find((e) => e.name === caregiverName);
      if (!employee) return s;
      const existing = s.employeeEdits[employee.id] ?? profileFromSeed(employee);
      return {
        ...s,
        employeeEdits: { ...s.employeeEdits, [employee.id]: { ...existing, phoneMobile: phone } },
        phoneAsks: { ...s.phoneAsks, [caregiverName]: { ...(s.phoneAsks[caregiverName] ?? { askedBy: "", askedAt: at }), answeredAt: at } },
      };
    });
  }, [audit]);

  const reviseSchedule = useCallback<DemoContextValue["reviseSchedule"]>(({ ended, started }) => {
    audit({ action: "schedule.changed", entityType: "client", entityId: started.clientPersonId, before: { scheduleId: ended.id }, after: { scheduleId: started.id, startsOn: started.startsOn } });
    setState((s) => ({ ...s, clientSchedules: [...s.clientSchedules.map((x) => (x.id === ended.id ? ended : x)), started] }));
  }, [audit]);

  const addClientSchedule = useCallback<DemoContextValue["addClientSchedule"]>((schedule) => {
    audit({ action: "schedule.created", entityType: "client", entityId: schedule.clientPersonId, after: { scheduleId: schedule.id, startsOn: schedule.startsOn } });
    setState((s) => ({ ...s, clientSchedules: [...s.clientSchedules, schedule] }));
  }, [audit]);

  const sendScheduleAgreement = useCallback<DemoContextValue["sendScheduleAgreement"]>((scheduleId, by, at) => {
    audit({ action: "schedule.agreement_sent", entityType: "client_schedule", entityId: scheduleId, after: { by } });
    setState((s) => ({ ...s, clientSchedules: s.clientSchedules.map((x) => (x.id === scheduleId ? { ...x, agreementSentAt: at } : x)) }));
  }, [audit]);

  const signScheduleAgreement = useCallback<DemoContextValue["signScheduleAgreement"]>((scheduleId, by, at) => {
    audit({ action: "schedule.agreement_signed", entityType: "client_schedule", entityId: scheduleId, after: { by } });
    setState((s) => ({ ...s, clientSchedules: s.clientSchedules.map((x) => (x.id === scheduleId ? { ...x, agreementSignedAt: at, agreementSentAt: x.agreementSentAt ?? at } : x)) }));
  }, [audit]);

  const setHouseholdBilling = useCallback<DemoContextValue["setHouseholdBilling"]>((householdId, billing, note) => {
    audit({ action: "household.billing_changed", entityType: "household", entityId: householdId, after: { billing } });
    setState((s) => ({ ...s, households: s.households.map((h) => (h.id === householdId ? { ...h, billing, note: note ?? h.note ?? null } : h)) }));
  }, [audit]);

  const setHouseholdRate = useCallback<DemoContextValue["setHouseholdRate"]>((householdId, rate, split) => {
    audit({ action: "household.rate_set", entityType: "household", entityId: householdId, after: { rate } });
    setState((s) => ({ ...s, households: s.households.map((h) => (h.id === householdId ? { ...h, householdRate: rate, split } : h)) }));
  }, [audit]);

  const pairHousehold = useCallback<DemoContextValue["pairHousehold"]>((input) => {
    const id = newId("hh");
    audit({ action: "household.paired", entityType: "household", entityId: id, after: { members: [input.clientName, input.partnerName], billing: input.billing } });
    setState((s) => ({
      ...s,
      households: [
        ...s.households.filter((h) => !h.members.some((m) => m.personId === input.clientPersonId || m.personId === input.partnerPersonId)),
        {
          id,
          label: `${input.clientName} and ${input.partnerName}`,
          primaryPersonId: input.clientPersonId,
          members: [
            { personId: input.clientPersonId, name: input.clientName },
            { personId: input.partnerPersonId, name: input.partnerName },
          ],
          billing: input.billing,
        },
      ],
    }));
  }, [audit]);

  const bookSupervision = useCallback<DemoContextValue["bookSupervision"]>((visit) => {
    audit({ action: "supervision.booked", entityType: "client", entityId: visit.clientPersonId, after: { scheduledFor: visit.scheduledFor } });
    setState((s) => ({ ...s, supervisoryVisits: [...s.supervisoryVisits.filter((v) => v.id !== visit.id), visit] }));
  }, [audit]);

  const completeSupervision = useCallback<DemoContextValue["completeSupervision"]>((visit) => {
    audit({ action: "supervision.completed", entityType: "client", entityId: visit.clientPersonId, after: { completedAt: visit.completedAt } });
    setState((s) => ({ ...s, supervisoryVisits: s.supervisoryVisits.map((v) => (v.id === visit.id ? visit : v)) }));
  }, [audit]);

  const saveLtciEnrollment = useCallback<DemoContextValue["saveLtciEnrollment"]>((clientPersonId, patch) => {
    audit({ action: "ltci.enrollment_changed", entityType: "client", entityId: clientPersonId, after: { ...patch } });
    setState((s) => ({
      ...s,
      ltciEnrollments: s.ltciEnrollments.map((e) => (e.clientPersonId === clientPersonId ? { ...e, ...patch } : e)),
    }));
  }, [audit]);

  const seededTotal = (invoiceId: string) => seedIssuedInvoices.find((i) => i.id === invoiceId)?.total ?? null;

  const adjustInvoice = useCallback<DemoContextValue["adjustInvoice"]>(({ invoiceId, kind, amount, reason }) => {
    const delta = kind === "debit" ? amount : -amount;
    audit({ action: "invoice.adjusted", entityType: "invoice", entityId: invoiceId, after: { kind, amount, reason } });
    const adjustment = { id: newId("adj"), invoiceId, kind, amount, reason, createdByUserId: currentUserRef.current.name, createdAt: new Date().toISOString() };
    setState((s) => {
      if (s.issuedInvoices.find((i) => i.id === invoiceId)) {
        return {
          ...s,
          issuedInvoices: s.issuedInvoices.map((i) =>
            i.id === invoiceId ? { ...i, total: Math.round((i.total + delta) * 100) / 100, adjustments: [...(i.adjustments ?? []), adjustment] } : i,
          ),
        };
      }
      const edit = s.invoiceEdits[invoiceId] ?? {};
      const total = edit.total ?? seededTotal(invoiceId);
      return {
        ...s,
        invoiceEdits: {
          ...s.invoiceEdits,
          [invoiceId]: { ...edit, total: total === null ? undefined : Math.round((total + delta) * 100) / 100, adjustments: [...(edit.adjustments ?? []), adjustment] },
        },
      };
    });
  }, [audit]);

  const voidInvoice = useCallback<DemoContextValue["voidInvoice"]>(({ invoiceId, reason }) => {
    audit({ action: "invoice.voided", entityType: "invoice", entityId: invoiceId, after: { reason } });
    const today = new Date().toISOString().slice(0, 10);
    setState((s) =>
      s.issuedInvoices.some((i) => i.id === invoiceId)
        ? { ...s, issuedInvoices: s.issuedInvoices.map((i) => (i.id === invoiceId ? { ...i, writtenOffOn: today, writtenOffReason: reason } : i)) }
        : { ...s, invoiceEdits: { ...s.invoiceEdits, [invoiceId]: { ...(s.invoiceEdits[invoiceId] ?? {}), writtenOffOn: today, writtenOffReason: reason } } },
    );
  }, [audit]);

  const refundInvoice = useCallback<DemoContextValue["refundInvoice"]>(({ invoiceId, amount, reason, kind, method }) => {
    audit({ action: "invoice.refunded", entityType: "invoice", entityId: invoiceId, after: { amount, reason, kind, method } });
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const adjustment = { id: newId("adj"), invoiceId, kind: "credit" as const, amount, reason, createdByUserId: currentUserRef.current.name, createdAt: now.toISOString(), origin: "refund" as const };
    const payment: Payment = { id: newId("pay"), invoiceId, amount: -amount, receivedOn: today, method, reference: "Refund" };
    const refund = { id: newId("ref"), invoiceId, amount, reason, kind, on: today, issuedByUserId: currentUserRef.current.name };
    setState((s) => {
      const next = { ...s, recordedPayments: [payment, ...s.recordedPayments], refunds: [refund, ...s.refunds] };
      if (!reducesInvoice(kind)) return next;
      if (s.issuedInvoices.find((i) => i.id === invoiceId)) {
        return {
          ...next,
          issuedInvoices: s.issuedInvoices.map((i) =>
            i.id === invoiceId ? { ...i, total: Math.round((i.total - amount) * 100) / 100, adjustments: [...(i.adjustments ?? []), adjustment] } : i,
          ),
        };
      }
      const edit = s.invoiceEdits[invoiceId] ?? {};
      const total = edit.total ?? seededTotal(invoiceId);
      return {
        ...next,
        invoiceEdits: {
          ...s.invoiceEdits,
          [invoiceId]: { ...edit, total: total === null ? undefined : Math.round((total - amount) * 100) / 100, adjustments: [...(edit.adjustments ?? []), adjustment] },
        },
      };
    });
  }, [audit]);

  const resendInvoice = useCallback<DemoContextValue["resendInvoice"]>(({ invoiceId, clientName }) => {
    audit({ action: "invoice.resent", entityType: "invoice", entityId: invoiceId, after: { clientName } });
    setState((s) => ({
      ...s,
      // §9.4 again: the text says an invoice exists; the portal holds the figures.
      communications: [
        {
          id: newId("comm"),
          entityType: "invoice",
          entityId: invoiceId,
          recipientName: clientName,
          channel: "sms" as const,
          provider: "spruce",
          templateKey: "invoice_notification",
          status: "queued" as const,
          providerMessageId: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          sentAt: null,
        },
        ...s.communications,
      ],
    }));
  }, [audit]);

  const savePayerSetup = useCallback<DemoContextValue["savePayerSetup"]>(({ clientPersonId, patch, rate, currentRate, reason, effectiveFrom }) => {
    audit({ action: "payer.setup.changed", entityType: "client", entityId: clientPersonId, after: { ...patch, rate, reason } });
    const change: RateChange | null =
      rate > 0 && rate !== currentRate
        ? { id: newId("rate"), clientPersonId, from: currentRate, to: rate, reason: reason.trim(), effectiveFrom, recordedAt: new Date().toISOString(), recordedByUserId: currentUserRef.current.name }
        : null;
    setState((s) => ({
      ...s,
      payerEdits: { ...s.payerEdits, [clientPersonId]: { ...(s.payerEdits[clientPersonId] ?? {}), ...patch } },
      rateChanges: change ? [change, ...s.rateChanges] : s.rateChanges,
    }));
  }, [audit]);

  const saveDraftEdit = useCallback<DemoContextValue["saveDraftEdit"]>(({ key, hours, rate, reason, charges, method }) => {
    audit({ action: "invoice.draft.edited", entityType: "invoice", entityId: key, after: { hours, rate, reason, charges: charges.length, method } });
    const edit = { hours, ...(rate === null ? {} : { rate }), reason, charges, method, editedByUserId: currentUserRef.current.name, editedAt: new Date().toISOString() };
    setState((s) => ({ ...s, draftEdits: { ...s.draftEdits, [key]: edit } }));
  }, [audit]);

  const saveFirstPayment = useCallback<DemoContextValue["saveFirstPayment"]>(({ clientPersonId, deposit, depositReason, technologyFee, startsOn }) => {
    audit({ action: "invoice.first_payment.raised", entityType: "client", entityId: clientPersonId, after: { deposit, depositReason, technologyFee, startsOn } });
    setState((s) => ({
      ...s,
      firstPayments: { ...s.firstPayments, [clientPersonId]: { on: new Date().toISOString().slice(0, 10), deposit, depositReason, technologyFee, startsOn } },
    }));
  }, [audit]);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      saveLtciEnrollment,
      savePayerSetup,
      saveDraftEdit,
      saveFirstPayment,
      adjustInvoice,
      voidInvoice,
      refundInvoice,
      resendInvoice,
      addShift,
      addScheduleEvent,
      requestTimeOff,
      cancelTimeOff,
      declineCover,
      saveCoverageEvent,
      approveCoveragePlan,
      approveCoverageOvertime,
      reopenCoverageShift,
      cancelCoverageEvent,
      approveOvertime,
      authorizeEarlyStart,
      recordClockAttempt,
      recordClock,
      recordClockCorrection,
      setClockPlace,
      proposeClock,
      decideClockProposal,
      setServiceMix,
      confirmServiceMix,
      recordVisitChange,
      addApprovedLocation,
      decideLocation,
      recordMileage,
      recordExpenses,
      recordVisitPay,
      askForPhone,
      answerPhoneAsk,
      reviseSchedule,
      addClientSchedule,
      sendScheduleAgreement,
      signScheduleAgreement,
      setHouseholdBilling,
      setHouseholdRate,
      pairHousehold,
      bookSupervision,
      completeSupervision,
      addReferral,
      addContact,
      editContact,
      deleteContact,
      restoreContact,
      logContact,
      saveIntake,
      completeIntake,
      assignments: state.assignments,
      newHires: state.newHires,
      hireEmployee,
      assignShift,
      recordExternalPayment,
      approveDraft,
      sendInvoice,
      currentUser: state.currentUser,
      setCurrentUser,
      saveAssessment,
      saveConsents,
      savePreOnboarding,
      approveAdmission,
      activateClient,
      scheduleAssessment,
      retryCommunication,
      reset,
      saveEmployee,
      setEmployeeStatus,
      undoProfileChange,
      deleteEmployee,
      deleteClient,
      deleteAdmission,
      restoreDeleted,
      purgeDeleted,
      logActivity,
      deleteActivity,
      recordView,
      issueMrNumber,
      setClientStatus,
      uploadDocument,
      tagDocument,
      updateDocument,
      duplicateDocument,
      deleteDocument,
      addDocumentFolder,
      renameDocumentFolder,
      deleteDocumentFolder,
      requestSignature,
      signSignatureRequest,
      declineSignatureRequest,
      addSop,
      updateSop,
      saveSopVersion,
      deleteSop,
      renameSopCategory,
      moveSopCategory,
    }),
    [state, addReferral, addContact, editContact, deleteContact, restoreContact, logContact, saveIntake, completeIntake, saveAssessment, saveConsents, savePreOnboarding, approveAdmission, activateClient, scheduleAssessment, retryCommunication, assignShift, hireEmployee, recordExternalPayment, approveDraft, sendInvoice, setCurrentUser, reset, saveEmployee, setEmployeeStatus, undoProfileChange, deleteEmployee, deleteClient, deleteAdmission, restoreDeleted, purgeDeleted, logActivity, deleteActivity, recordView, issueMrNumber, setClientStatus, uploadDocument, tagDocument, updateDocument, duplicateDocument, deleteDocument, addDocumentFolder, renameDocumentFolder, deleteDocumentFolder, requestSignature, signSignatureRequest, declineSignatureRequest, addSop, updateSop, saveSopVersion, deleteSop, renameSopCategory, moveSopCategory, addShift, addScheduleEvent, requestTimeOff, cancelTimeOff, declineCover, saveCoverageEvent, approveCoveragePlan, approveCoverageOvertime, reopenCoverageShift, cancelCoverageEvent, approveOvertime, authorizeEarlyStart, recordClockAttempt, recordClock, recordClockCorrection, setClockPlace, proposeClock, decideClockProposal, setServiceMix, confirmServiceMix, recordVisitChange, addApprovedLocation, decideLocation, recordMileage, recordExpenses, recordVisitPay, askForPhone, answerPhoneAsk, reviseSchedule, addClientSchedule, sendScheduleAgreement, signScheduleAgreement, setHouseholdBilling, setHouseholdRate, pairHousehold, bookSupervision, completeSupervision, saveLtciEnrollment, savePayerSetup, saveDraftEdit, saveFirstPayment, adjustInvoice, voidInvoice, refundInvoice, resendInvoice],
  );

  /**
   * The third door (see domain/access/roles): a read-only role gets a value
   * whose every mutation is replaced by a toast. Switching user and recording
   * a view are the two things a surveyor's session still does.
   */
  const readOnly = !canWrite(state.currentUser.role);
  const guarded = useMemo<DemoContextValue>(() => {
    if (!readOnly) return value;
    const refuse = (name: string) => () => {
      toast("Read-only survey session", { description: "Nothing can be changed while signed in as an auditor." });
      console.warn(`[access] ${name} refused: role is read-only`);
    };
    const allowed = new Set(["setCurrentUser", "recordView"]);
    const out: Record<string, unknown> = { ...value };
    for (const [key, member] of Object.entries(out)) {
      if (typeof member === "function" && !allowed.has(key)) out[key] = refuse(key);
    }
    return out as unknown as DemoContextValue;
  }, [value, readOnly]);

  return <DemoContext.Provider value={guarded}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoDataProvider");
  return ctx;
}
