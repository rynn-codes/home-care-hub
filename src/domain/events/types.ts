/**
 * Domain events — the vocabulary and the record shape.
 *
 * Section 17 lists the events V1 expects. They are typed rather than free
 * strings so a typo in a producer is a compile error instead of an event no
 * handler ever sees.
 */

export const DOMAIN_EVENT_TYPES = [
  "referral.created",
  "intake.started",
  "intake.completed",
  "assessment.scheduled",
  "assessment.rescheduled",
  "assessment.cancelled",
  "assessment.started",
  "assessment.completed",
  "document.requested",
  "document.received",
  "agreement.sent",
  "agreement.signed",
  "care_plan.prepared",
  "care_plan.approved",
  "payment_setup.completed",
  "admission.ready",
  "admission.approved",
  "start_of_care.prepared",
  "client.activated",
  "schedule.updated",
  "candidate.stage_changed",
  "payroll.exception_resolved",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEventStatus = "pending" | "processing" | "processed" | "failed";

export interface DomainEvent {
  id: string;
  organizationId: string;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  status: DomainEventStatus;
  attempts: number;
  /**
   * Set by the producer for operations that must not double-fire. A
   * double-clicked Schedule button, a retried webhook and a resubmitted
   * signature all pass the same key, and the store's unique index does the rest.
   */
  idempotencyKey: string | null;
  createdAt: string;
  processedAt: string | null;
  lastError: string | null;
}

export interface NewDomainEvent {
  organizationId: string;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}

/**
 * Storage port.
 *
 * The outbox worker is written against this rather than against Supabase, so
 * the retry and failure behaviour can be tested without a database — which
 * matters, because those paths are the ones nobody exercises by hand.
 */
export interface DomainEventStore {
  /** Appends an event. Returns null when the idempotency key already exists. */
  append(event: NewDomainEvent): Promise<DomainEvent | null>;
  /** Claims events ready to run now, marking them processing. */
  claimDue(limit: number, now: Date): Promise<DomainEvent[]>;
  markProcessed(id: string, at: Date): Promise<void>;
  markFailed(id: string, error: string, attempts: number, retryAt: Date | null): Promise<void>;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;
