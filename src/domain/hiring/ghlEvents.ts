import type { Applicant } from "@/domain/hiring/pipeline";

/**
 * The GHL ↔ Joy event vocabulary — the roadmap's list, held as data.
 *
 * "GHL and Joy should communicate through API/webhook events where practical.
 * The exact integration architecture can be finalized during development, but
 * the UI must be designed assuming statuses can synchronize." This module is
 * the contract that assumption rests on: the events Joy RECEIVES (GHL owns
 * recruiting through the in-person interview), the events Joy SENDS back, and
 * what each received event means for the pipeline — as a suggestion to a
 * person, never an act.
 *
 * The boundary rule travels with the vocabulary: Joy's active workflow begins
 * at the human Move Forward decision. Everything before it arrives here as
 * HISTORY to document — the roadmap is explicit that no-shows must remain
 * documented — not as candidates for the workspace.
 */

export const GHL_RECEIVED_EVENTS = [
  "interview_offered",
  "interview_scheduled",
  "interview_confirmed",
  "interview_cancelled",
  "interview_no_show",
  "interview_attended",
  "candidate_moving_forward",
] as const;

export type GhlReceivedEvent = (typeof GHL_RECEIVED_EVENTS)[number];

export const GHL_SENT_EVENTS = [
  "documents_requested",
  "documents_complete",
  "candidate_declined",
  "ready_for_offer",
  "offer_accepted",
  "hiring_closed",
] as const;

export type GhlSentEvent = (typeof GHL_SENT_EVENTS)[number];

export const GHL_EVENT_LABELS: Record<GhlReceivedEvent | GhlSentEvent, string> = {
  interview_offered: "Interview offered",
  interview_scheduled: "Interview scheduled",
  interview_confirmed: "Interview confirmed",
  interview_cancelled: "Interview cancelled",
  interview_no_show: "Interview no-show",
  interview_attended: "Interview attended",
  candidate_moving_forward: "Candidate moving forward",
  documents_requested: "Documents requested",
  documents_complete: "Documents complete",
  candidate_declined: "Candidate declined",
  ready_for_offer: "Ready for offer",
  offer_accepted: "Offer accepted",
  hiring_closed: "Hiring closed",
};

export type GhlEventEffect =
  /** Record it on the candidate's history. Nothing moves. */
  | { kind: "document"; note: string }
  /** Suggest a pipeline action for a person to confirm. */
  | { kind: "suggest"; action: string; note: string }
  /** The handoff moment: a human said Move Forward in GHL. */
  | { kind: "begin_joy_workflow"; note: string };

/**
 * What one received event means for Joy.
 *
 * Deliberately returns suggestions, not mutations — "human confirmation is
 * required before consequential actions" is the roadmap's own rule, and a
 * webhook is nobody's confirmation.
 */
export function effectOfGhlEvent(event: GhlReceivedEvent): GhlEventEffect {
  switch (event) {
    case "interview_offered":
    case "interview_scheduled":
    case "interview_confirmed":
      return { kind: "document", note: GHL_EVENT_LABELS[event] };
    case "interview_cancelled":
      return { kind: "document", note: "Interview cancelled — GHL keeps the reschedule." };
    case "interview_attended":
      return {
        kind: "suggest",
        action: "Consider Move Forward",
        note: "They came. The Move Forward decision is a person's, made in Joy.",
      };
    case "interview_no_show":
      return {
        kind: "suggest",
        action: "Record no-show",
        note: "No-shows must remain documented — the record is retained, with an optional note, and the status syncs back to GHL.",
      };
    case "candidate_moving_forward":
      return {
        kind: "begin_joy_workflow",
        note: "The handoff: portal invitation, phone OTP, the Joy application. Everything before this stays GHL's.",
      };
  }
}

/**
 * The status Joy reports back to GHL for where an applicant stands, so the
 * recruiter's system and the office's never tell a candidate two stories.
 */
export function ghlStatusFor(applicant: Applicant): GhlSentEvent | null {
  if (applicant.track === "no_fit") return "hiring_closed";
  if (applicant.track === "hired") return "offer_accepted";
  if (applicant.track === "onboarding") return "offer_accepted";
  switch (applicant.stage) {
    case "documents":
      return "documents_requested";
    case "background":
      return "documents_complete";
    case "decision":
      return "ready_for_offer";
    case "offer":
      return "ready_for_offer";
    default:
      return null;
  }
}
