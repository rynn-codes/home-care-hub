import type { E164 } from "@/domain/portal/phone";
import type { MessagePurpose } from "@/domain/portal/messaging";

/**
 * What happens when the office changes something — §25, §26, and §29's step 16.
 *
 * §25 states the operating principle: "Joy Portal = persistent source of truth.
 * Spruce = notification/communication channel." And then, plainly: "Important
 * status information should not live only in a text thread."
 *
 * §25 also gives the order, and the order is the design:
 *
 *   1. update the official schedule
 *   2. update the employee portal
 *   3. update the client/family portal
 *   4. create the appropriate audit/event record
 *   5. trigger the configured Spruce notification
 *
 * THE NOTIFICATION IS LAST AND IT IS ALLOWED TO FAIL
 *
 * Steps 1 to 4 are one unit of work. Step 5 is not part of it. A text message
 * that does not send must never roll back a schedule change — the visit really
 * did move, the portals really do say so, and retrying the text is a different
 * problem from re-doing the change.
 *
 * The failure this prevents is specific and bad. If the notification were
 * inside the transaction, a carrier outage would mean the office's schedule
 * edit silently did not happen, while the person who made it watched a spinner
 * and assumed it had. Joy would then be wrong about a visit, which is worse in
 * every direction than a family finding out an hour late.
 *
 * So `planEffects` returns the portal-and-audit work and the notification as
 * separate things, and `notificationFailed` is a recorded outcome rather than
 * an exception. §26's "connected workflow" is a sequence, not an atom.
 */

export type ChangeKind =
  | "visit_scheduled"
  | "visit_rescheduled"
  | "visit_cancelled"
  | "caregiver_assigned"
  | "caregiver_changed"
  | "document_requested"
  | "start_of_care_set";

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  visit_scheduled: "Visit scheduled",
  visit_rescheduled: "Visit rescheduled",
  visit_cancelled: "Visit cancelled",
  caregiver_assigned: "Caregiver assigned",
  caregiver_changed: "Caregiver changed",
  document_requested: "Document requested",
  start_of_care_set: "Start of care confirmed",
};

export interface Recipient {
  personId: string;
  phone: E164;
  audience: "workforce" | "family";
  firstName: string | null;
}

export interface OfficeChange {
  kind: ChangeKind;
  /** The visit this is about, when it is about one. */
  visitId: string | null;
  clientPersonId: string;
  clientFirstName: string;
  /** Who should be told. */
  recipients: readonly Recipient[];
  byUserId: string;
  at: string;
}

// ------------------------------------------------------------ effects --

/** A portal that must reflect the change. Step 2 and 3. */
export interface PortalRefresh {
  audience: "workforce" | "family";
  personId: string;
}

/** Step 4. Append-only, and written whether or not anyone is texted. */
export interface ChangeEvent {
  kind: ChangeKind;
  visitId: string | null;
  clientPersonId: string;
  byUserId: string;
  at: string;
  notifiedPersonIds: string[];
}

/** Step 5, as an instruction rather than an action. */
export interface PlannedNotification {
  personId: string;
  to: E164;
  purpose: MessagePurpose;
  firstName: string | null;
  clientFirstName: string;
}

export interface EffectPlan {
  refreshes: PortalRefresh[];
  event: ChangeEvent;
  notifications: PlannedNotification[];
}

/**
 * Which purpose tells this person about this change.
 *
 * A caregiver hears about her own schedule; a family hears about their person's
 * care. The two are different messages down different numbers, which is what
 * `SMS_ROUTING` already encodes — so this decides the purpose and stays out of
 * the carrier's business.
 */
function purposeFor(recipient: Recipient): MessagePurpose {
  return recipient.audience === "workforce" ? "shift_notification" : "care_notification";
}

/**
 * Everything a change causes, computed before anything is done.
 *
 * Returning a plan rather than performing the work is what lets the caller run
 * steps 1 to 4 as one unit and step 5 outside it. It also makes the whole
 * fan-out testable without a database or a carrier.
 */
export function planEffects(change: OfficeChange): EffectPlan {
  const notifications: PlannedNotification[] = change.recipients.map((recipient) => ({
    personId: recipient.personId,
    to: recipient.phone,
    purpose: purposeFor(recipient),
    firstName: recipient.firstName,
    clientFirstName: change.clientFirstName,
  }));

  return {
    refreshes: change.recipients.map((r) => ({ audience: r.audience, personId: r.personId })),
    event: {
      kind: change.kind,
      visitId: change.visitId,
      clientPersonId: change.clientPersonId,
      byUserId: change.byUserId,
      at: change.at,
      // Recorded as who Joy intended to tell. Whether the text arrived is a
      // separate fact — see `recordDelivery`.
      notifiedPersonIds: notifications.map((n) => n.personId),
    },
    notifications,
  };
}

// ----------------------------------------------------------- delivery --

export type DeliveryOutcome = "delivered" | "failed" | "not_attempted";

export interface DeliveryRecord {
  personId: string;
  purpose: MessagePurpose;
  outcome: DeliveryOutcome;
  at: string;
  /** Present on failure, for the office to chase. */
  detail: string | null;
}

/**
 * What the office needs to know when a text did not go.
 *
 * §25's principle cuts both ways. Because the portal is the source of truth,
 * a failed notification is not a lost update — the family will see the change
 * next time they open Joy. But somebody should still be told, because "we
 * texted you" is what the office will assume when the family says nobody told
 * them.
 */
export function undeliveredSummary(records: readonly DeliveryRecord[]): string | null {
  const failed = records.filter((r) => r.outcome === "failed");
  if (failed.length === 0) return null;

  return failed.length === 1
    ? "One notification did not send. The change is live in the portal; the text is not."
    : `${failed.length} notifications did not send. The changes are live in the portal; the texts are not.`;
}

export function recordDelivery(input: {
  notification: PlannedNotification;
  delivered: boolean;
  at: string;
  detail?: string | null;
}): DeliveryRecord {
  return {
    personId: input.notification.personId,
    purpose: input.notification.purpose,
    outcome: input.delivered ? "delivered" : "failed",
    at: input.at,
    detail: input.delivered ? null : (input.detail ?? "The message could not be sent."),
  };
}

/**
 * Whether the change itself stands, given how the notifications went.
 *
 * Always true, and it is a function rather than a constant so the answer has
 * somewhere to be stated and tested. §25's whole point is that the record does
 * not depend on the message.
 */
export function changeStandsDespite(_records: readonly DeliveryRecord[]): boolean {
  return true;
}
