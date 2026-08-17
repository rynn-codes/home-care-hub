import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadDemoState,
  newId,
  resetDemoState,
  saveDemoState,
  type DemoCommunication,
  type DemoDomainEvent,
  type DemoIntake,
  type DemoScheduleEvent,
  type DemoState,
} from "@/lib/demoStore";
import type { SeedAdmission } from "@/lib/admissionsSeed";

interface DemoContextValue extends DemoState {
  addReferral: (admission: SeedAdmission, person: DemoState["people"][number]) => void;
  saveIntake: (admissionId: string, intake: Partial<DemoIntake>) => void;
  completeIntake: (admissionId: string) => void;
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

  const reset = useCallback(() => setState(resetDemoState()), []);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      addReferral,
      saveIntake,
      completeIntake,
      scheduleAssessment,
      retryCommunication,
      reset,
    }),
    [state, addReferral, saveIntake, completeIntake, scheduleAssessment, retryCommunication, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoDataProvider");
  return ctx;
}
