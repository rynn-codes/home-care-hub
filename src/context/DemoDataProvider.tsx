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
import { externalPaymentRecorded } from "@/domain/billing/financialAudit";
import { seedIssuedInvoices, seedPayments } from "@/lib/receivablesSeed";

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
  currentUser: DemoState["currentUser"];
  setCurrentUser: (user: DemoState["currentUser"]) => void;
  reset: () => void;
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
    (entry: Omit<AuditRecord, "organizationId" | "actor">) => {
      const user = currentUserRef.current;
      void recordAudit(
        {
          ...entry,
          organizationId: DEMO_ORG,
          actor: { type: "user", userId: user.name },
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


  useEffect(() => {
    saveDemoState(state);
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
      const { [contactId]: _dropped, ...edits } = s.contactEdits;
      return {
        ...s,
        contacts: s.contacts.filter((c) => c.id !== contactId),
        contactEdits: edits,
        deletedContactIds: [...s.deletedContactIds, contactId],
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

      return {
        ...s,
        people,
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

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
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
    }),
    [state, addReferral, addContact, editContact, deleteContact, restoreContact, logContact, saveIntake, completeIntake, saveAssessment, saveConsents, savePreOnboarding, approveAdmission, activateClient, scheduleAssessment, retryCommunication, assignShift, hireEmployee, recordExternalPayment, setCurrentUser, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoDataProvider");
  return ctx;
}
