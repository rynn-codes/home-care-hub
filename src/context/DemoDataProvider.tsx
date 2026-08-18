import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

interface DemoContextValue extends DemoState {
  addReferral: (admission: SeedAdmission, person: DemoState["people"][number]) => void;
  saveIntake: (admissionId: string, intake: Partial<DemoIntake>) => void;
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
  currentUser: DemoState["currentUser"];
  setCurrentUser: (user: DemoState["currentUser"]) => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => loadDemoState());

  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  const addReferral = useCallback<DemoContextValue["addReferral"]>((admission, person) => {
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
  }, []);

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
  }, []);

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
  }, []);

  const savePreOnboarding = useCallback<DemoContextValue["savePreOnboarding"]>((admissionId, patch) => {
    setState((s) => {
      const existing = s.preOnboarding[admissionId] ?? {
        admissionId,
        paymentSetUp: false,
        carePlanApproved: false,
        approvedAt: null,
        approvedBy: null,
        startOfCareDate: null,
        activatedAt: null,
      };
      return { ...s, preOnboarding: { ...s.preOnboarding, [admissionId]: { ...existing, ...patch } } };
    });
  }, []);

  const approveAdmission = useCallback<DemoContextValue["approveAdmission"]>((admissionId, approvedBy) => {
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
  }, []);

  const activateClient = useCallback<DemoContextValue["activateClient"]>((admissionId, startDate) => {
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
  }, []);

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

  const setCurrentUser = useCallback<DemoContextValue["setCurrentUser"]>((user) => {
    setState((s) => ({ ...s, currentUser: user }));
  }, []);

  const reset = useCallback(() => setState(resetDemoState()), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      addReferral,
      saveIntake,
      completeIntake,
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
    [state, addReferral, saveIntake, completeIntake, saveAssessment, saveConsents, savePreOnboarding, approveAdmission, activateClient, scheduleAssessment, retryCommunication, setCurrentUser, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoDataProvider");
  return ctx;
}
