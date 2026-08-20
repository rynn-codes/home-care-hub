import type { WorkQueueGroup } from "@/domain/workQueue";
import { requiresOfficeReview, type Moment } from "@/domain/portal/moments";
import { awaitingApproval, type Preference } from "@/domain/portal/preferences";
import { invitationState, type Invitation } from "@/domain/hiring/invitation";
import type { TimeEntry } from "@/domain/payroll/hours";
import type { RequestedDocument } from "@/domain/portal/familyPortal";

/**
 * The office's view of everything the portals produced.
 *
 * The gap this closes was real and quietly serious: caregivers and families
 * could write into Joy — Moments, time entries, uploaded documents, preference
 * suggestions — and nobody at the office had a screen showing any of it. Work
 * arriving somewhere nobody looks is the same as work not arriving.
 *
 * It uses Joy's existing Needs You / Waiting / Moving Forward grouping rather
 * than a fourth list idiom, per §8's convergence goal. The grouping rule is the
 * one that already runs through Admissions and Hiring: sort by who holds the
 * next move.
 *
 *   Needs You      — somebody at Joy must act. A drafted Moment nobody has
 *                    approved, a clock-out with documentation outstanding.
 *   Waiting        — the ball is with a caregiver or a family. An invitation
 *                    sent and not opened, a document requested and not sent.
 *   Moving Forward — done, and here so the screen shows activity rather than
 *                    only problems.
 */

export type PortalWorkKind =
  | "moment_review"
  | "preference_review"
  | "clock_exception"
  | "document_requested"
  | "invitation_unopened"
  | "invitation_expired"
  | "moment_shared";

export interface PortalWorkItem {
  id: string;
  kind: PortalWorkKind;
  group: WorkQueueGroup;
  /** Said the way somebody would say it out loud. */
  headline: string;
  detail: string;
  /** Who or what it concerns, for the secondary line. */
  subject: string | null;
  /** Where the office goes to deal with it. Null when there is nowhere yet. */
  to: string | null;
  /** ISO. Drives ordering — oldest first, because it has waited longest. */
  since: string;
}

export interface OfficeQueueInput {
  moments: readonly Moment[];
  preferences: readonly Preference[];
  timeEntries: readonly TimeEntry[];
  invitations: readonly Invitation[];
  documentRequests: readonly RequestedDocument[];
  /** Person id to display name, so this module holds no name lookup of its own. */
  nameFor: (personId: string) => string;
  asOf: string;
}

export function buildPortalQueue(input: OfficeQueueInput): PortalWorkItem[] {
  const items: PortalWorkItem[] = [];
  const { nameFor, asOf } = input;

  // ------------------------------------------------------- needs you --

  // Karynn's rule, 20 Aug: only a Moment whose wording a model produced needs
  // the office. Her own caregivers' words go straight out.
  for (const moment of input.moments) {
    if (moment.state !== "draft" || !requiresOfficeReview(moment)) continue;
    items.push({
      id: `moment-${moment.id}`,
      kind: "moment_review",
      group: "needs_you",
      headline: "A drafted moment is waiting for you",
      detail: moment.body,
      subject: nameFor(moment.createdByPersonId),
      to: "/operations/portal",
      since: moment.createdAt,
    });
  }

  for (const preference of awaitingApproval(input.preferences)) {
    items.push({
      id: `pref-${preference.id}`,
      kind: "preference_review",
      group: "needs_you",
      headline: `Suggested: "${preference.text}"`,
      detail:
        preference.source === "family"
          ? "Suggested by the family. Caregivers see it once you approve."
          : "Suggested by a caregiver. Caregivers see it once you approve.",
      subject: nameFor(preference.addedByPersonId),
      to: "/operations/portal",
      since: preference.addedAt,
    });
  }

  // §11's exception. The caregiver has been paid for the hours — payroll
  // treats this as non-blocking — so what is left is the office chasing the
  // documentation, which is this item.
  for (const entry of input.timeEntries) {
    if (!entry.exceptionReason) continue;
    items.push({
      id: `clock-${entry.id}`,
      kind: "clock_exception",
      group: "needs_you",
      headline: "A visit was closed with paperwork outstanding",
      detail: entry.exceptionReason,
      subject: nameFor(entry.caregiverPersonId),
      to: "/operations/portal",
      since: entry.clockedOutAt ?? entry.clockedInAt,
    });
  }

  for (const invitation of input.invitations) {
    if (invitationState(invitation, asOf) !== "expired") continue;
    items.push({
      id: `inv-exp-${invitation.id}`,
      kind: "invitation_expired",
      group: "needs_you",
      headline: "A candidate's invitation expired before they used it",
      detail: "Reissue it, or close them out.",
      subject: null,
      to: "/operations/hiring",
      since: invitation.expiresAt,
    });
  }

  // --------------------------------------------------------- waiting --

  for (const invitation of input.invitations) {
    if (invitationState(invitation, asOf) !== "sent") continue;
    items.push({
      id: `inv-${invitation.id}`,
      kind: "invitation_unopened",
      group: "waiting",
      headline: "A candidate has not opened their invitation",
      detail:
        invitation.sends.length > 1
          ? `Sent ${invitation.sends.length} times. Worth a phone call.`
          : "Sent once. Give it a day before chasing.",
      subject: null,
      to: "/operations/hiring",
      since: invitation.issuedAt,
    });
  }

  for (const request of input.documentRequests) {
    if (request.state !== "needed") continue;
    items.push({
      id: `doc-${request.id}`,
      kind: "document_requested",
      group: "waiting",
      headline: `Waiting on ${request.label.toLowerCase()}`,
      detail: request.reason ?? "Requested from the family.",
      subject: null,
      to: "/operations/portal",
      // Requests carry no timestamp yet — see the note in RequestedDocument.
      since: asOf,
    });
  }

  // -------------------------------------------------- moving forward --

  // Shared Moments are here so the screen shows the portals working, not only
  // the places they need help. A queue that only ever lists problems trains
  // people to read it as a complaint.
  for (const moment of input.moments) {
    if (moment.state !== "shared" || !moment.sharedAt) continue;
    items.push({
      id: `shared-${moment.id}`,
      kind: "moment_shared",
      group: "moving_forward",
      headline: "A moment reached the family",
      detail: moment.body,
      subject: nameFor(moment.createdByPersonId),
      to: null,
      since: moment.sharedAt,
    });
  }

  // Oldest first inside each group: whatever has waited longest is the thing
  // most likely to have been forgotten.
  return items.sort((a, b) => a.since.localeCompare(b.since));
}

export interface PortalQueueCounts {
  needsYou: number;
  waiting: number;
  movingForward: number;
}

export function queueCounts(items: readonly PortalWorkItem[]): PortalQueueCounts {
  return {
    needsYou: items.filter((i) => i.group === "needs_you").length,
    waiting: items.filter((i) => i.group === "waiting").length,
    movingForward: items.filter((i) => i.group === "moving_forward").length,
  };
}

/** One line for Operations, and for Home. */
export function portalQueueSummary(items: readonly PortalWorkItem[]): string {
  const counts = queueCounts(items);

  if (counts.needsYou === 0) {
    return counts.waiting === 0
      ? "Nothing from the portals needs you."
      : `Nothing needs you. ${counts.waiting} ${counts.waiting === 1 ? "thing is" : "things are"} with a caregiver or family.`;
  }

  return counts.needsYou === 1
    ? "One thing from the portals needs you."
    : `${counts.needsYou} things from the portals need you.`;
}
