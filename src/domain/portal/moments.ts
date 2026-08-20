import type { ConsentDecision } from "@/domain/consents/registry";
import { clinicalTermIn, staffTermIn } from "@/domain/portal/familySafeText";

/**
 * Personal Touches — §13 to §17, and §29's step 14.
 *
 * §13 draws the line this whole file exists to hold:
 *
 *     Formal Visit Chart  ≠  Family Moment
 *
 * and then says it again as an instruction: "Do not publish raw chart notes
 * directly into the family portal."
 *
 * THE SEPARATION IS IN THE TYPES, NOT IN A COMMENT
 *
 * `draftMoment` takes the caregiver's answer to one question — "anything you'd
 * like the family to know about today?" — and nothing else. It has no parameter
 * for a `VisitRecord`, no parameter for a `ChartDraft`, and no import from
 * `charting.ts`. There is no way to derive a Moment from a chart because there
 * is nowhere to pass one in.
 *
 * That matters more than it looks. The tempting shortcut is obvious: the chart
 * is right there, it already describes the visit, and reusing it would save a
 * caregiver typing twice. It would also put "Medication reminder: completed"
 * and an incident note in front of a daughter, which is what §13 forbids. A
 * comment saying "don't do that" survives until the first sprint where somebody
 * is in a hurry. A missing parameter does not.
 *
 * WHAT A MOMENT IS
 *
 * A warm, approved, family-facing sentence about somebody's day. Not a clinical
 * record, not a status update, and — §16 — not a social feed: no likes, no
 * reactions, no counts, no public sharing. A care history somebody might read
 * on a Sunday.
 */

export type MomentState =
  /** The caregiver was asked and said no. Recorded, because "no" is an answer. */
  | "skipped"
  /** Written, not yet approved. */
  | "draft"
  /** Approved and visible to the family. */
  | "shared"
  /** Held back by the office. */
  | "withheld";

/**
 * Where the published wording came from.
 *
 * This is what decides who may approve it — see `requiresOfficeReview`.
 */
export type MomentOrigin =
  /** The caregiver's own words, published as written. */
  | "caregiver"
  /** A model drafted or rewrote the wording from what she said. */
  | "ai_drafted";

export interface Moment {
  id: string;
  /** §15: "remain linked to the visit that produced the update." */
  visitId: string;
  clientPersonId: string;
  /** What the caregiver actually wrote or dictated. Kept, always. */
  narrative: string;
  /** What the family reads. Equal to the narrative unless someone edited it. */
  body: string;
  state: MomentState;
  createdByPersonId: string;
  createdAt: string;
  approvedByPersonId: string | null;
  approvedAt: string | null;
  sharedAt: string | null;
  withheldReason: string | null;
  /** True when the body was changed from the caregiver's original words. */
  edited: boolean;
  origin: MomentOrigin;
}

/**
 * Whether the office must look at this before a family does.
 *
 * KARYNN'S RULE, 20 AUG. Asked whether caregivers should share directly or
 * whether the office should review first, she answered neither: "This will
 * depend on if AI is providing the moment based off of the caregiver's update."
 *
 * That is a better rule than the one it replaces, and it is the same
 * distinction §12 draws for charting. A caregiver publishing her own sentence
 * is a person saying something true about a visit she was at. A model rewriting
 * that sentence has introduced a step where a fact can change — the thing §15
 * forbids when it says never invent activities, mood, food, conversation or
 * events — and that step is exactly what a second pair of eyes is for.
 *
 * So the gate is provenance, not policy. Nobody has to remember to switch a
 * setting when drafting is connected: the day a model starts writing these,
 * they start needing review, because the origin says so.
 */
export function requiresOfficeReview(moment: Moment): boolean {
  return moment.origin === "ai_drafted";
}

// ------------------------------------------------------------ drafting --

/**
 * Turn the caregiver's answer into a Moment.
 *
 * Note the parameter list. See the file header for why it is this short.
 */
export function draftMoment(input: {
  id: string;
  visitId: string;
  clientPersonId: string;
  /** The caregiver's own words, and the only content input there is. */
  narrative: string;
  byPersonId: string | null;
  at: string;
  /** Defaults to the caregiver's own words, which is what Joy does today. */
  origin?: MomentOrigin;
}): Moment {
  if (!input.byPersonId) {
    throw new Error(
      "A Moment needs the caregiver who wrote it. §14: the system should preserve " +
        "who created, approved and shared it.",
    );
  }

  const narrative = input.narrative.trim();

  return {
    id: input.id,
    visitId: input.visitId,
    clientPersonId: input.clientPersonId,
    narrative,
    body: narrative,
    // Skipping is a first-class outcome. §14 offers [Skip] as a real option,
    // and a caregiver who had a quiet shift should not be nagged into
    // inventing something charming — which is exactly how §15's "never invent
    // activities, mood, food, conversation, or events" gets broken.
    state: narrative ? "draft" : "skipped",
    createdByPersonId: input.byPersonId,
    createdAt: input.at,
    approvedByPersonId: null,
    approvedAt: null,
    sharedAt: null,
    withheldReason: null,
    edited: false,
    origin: input.origin ?? "caregiver",
  };
}

// ------------------------------------------------------------ safety --

export type MomentProblem =
  /** Reads like a chart line rather than a note to a family. */
  | "clinical_content"
  /** Names a member of staff in a way that is office business. */
  | "staff_note"
  /** Nothing to publish. */
  | "empty"
  /** The family is not authorised to receive anything about this client. */
  | "not_authorised";

export interface MomentCheck {
  ok: boolean;
  problems: Array<{ problem: MomentProblem; detail: string }>;
}


/**
 * Whether a Moment may be shared at all.
 *
 * §15 requires respecting "client/family communication permissions", and Joy
 * already records exactly that. The packet's `disclosure_list` consent (p14)
 * names who the agency may discuss this client's care with, and Karynn's own
 * summary of it is unambiguous: "Everyone else gets nothing, including family."
 *
 * A Moment is a disclosure. It is a gentle one, but it tells somebody that a
 * named person had a bath, ate breakfast and watched television at a particular
 * address — and if that client declined the disclosure list, nobody is entitled
 * to hear it. So the consent decision gates sharing, and does so before any
 * wording check, because no amount of careful phrasing makes an unauthorised
 * disclosure authorised.
 */
export function checkMoment(input: {
  body: string;
  disclosureConsent: ConsentDecision | undefined;
}): MomentCheck {
  const problems: MomentCheck["problems"] = [];
  const body = input.body.trim();
  const lower = body.toLowerCase();

  if (input.disclosureConsent === "decline" || input.disclosureConsent === "not_applicable") {
    problems.push({
      problem: "not_authorised",
      detail:
        "This client has not authorised anyone to receive information about their care, " +
        "so Moments cannot be shared for them.",
    });
  }

  if (!body) {
    problems.push({ problem: "empty", detail: "There is nothing to share." });
    return { ok: false, problems };
  }

  if (clinicalTermIn(lower)) {
    problems.push({
      problem: "clinical_content",
      detail:
        "This reads like part of the visit chart. Moments are the warm bit — the care " +
        "record stays in the chart where the office and the nurse can see it.",
    });
  }

  if (staffTermIn(lower)) {
    problems.push({
      problem: "staff_note",
      detail: "This looks like a note for the office rather than for the family.",
    });
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------- approval --

export interface Approver {
  personId: string;
  /** Whether this person holds an RN or admin role. */
  isOffice: boolean;
}

/**
 * May this person publish this Moment?
 *
 * Follows `requiresOfficeReview`, which follows the origin. A caregiver may
 * publish her own words; only the office may publish a model's.
 */
export function mayApprove(approver: Approver, moment: Moment): boolean {
  return requiresOfficeReview(moment) ? approver.isOffice : true;
}

/**
 * Approve and share.
 *
 * §14: "Do not publish an AI-generated Moment without the configured approval
 * step." So there is no path from draft to shared that does not pass here, and
 * this refuses anything `checkMoment` rejected.
 */
export function approveMoment(input: {
  moment: Moment;
  approver: Approver;
  disclosureConsent: ConsentDecision | undefined;
  at: string;
}): Moment {
  const { moment, approver, disclosureConsent, at } = input;

  if (moment.state === "shared") {
    throw new Error("This Moment has already been shared with the family.");
  }
  if (moment.state === "skipped") {
    throw new Error("There is no Moment here to share.");
  }
  if (!mayApprove(approver, moment)) {
    throw new Error(
      "This wording was drafted rather than written by the caregiver, so the office " +
        "checks it before the family sees it.",
    );
  }

  const check = checkMoment({ body: moment.body, disclosureConsent });
  if (!check.ok) {
    throw new Error(check.problems.map((p) => p.detail).join(" "));
  }

  return {
    ...moment,
    state: "shared",
    approvedByPersonId: approver.personId,
    approvedAt: at,
    sharedAt: at,
  };
}

/** Hold one back. The caregiver's words are kept either way. */
export function withholdMoment(moment: Moment, reason: string): Moment {
  return { ...moment, state: "withheld", withheldReason: reason };
}

/**
 * Edit before publishing — §15 requires it.
 *
 * The caregiver's original narrative is never overwritten. If a Moment is ever
 * questioned, "what did she actually write" has an answer, and the person who
 * changed it is not the person credited with writing it.
 */
export function editMoment(moment: Moment, body: string): Moment {
  const next = body.trim();
  return {
    ...moment,
    body: next,
    edited: next !== moment.narrative,
    // A person rewriting a drafted Moment has taken it back. The words are
    // hers now and the extra review no longer applies — which is the point of
    // gating on provenance rather than on who typed last.
    origin: next === moment.narrative ? moment.origin : "caregiver",
  };
}

// ---------------------------------------------------------- timeline --

export interface TimelineEntry {
  id: string;
  /** "Today", "Aug 17". */
  when: string;
  body: string;
}

/**
 * §16's family timeline.
 *
 * Only shared Moments, newest first. No counts, no reactions, no author name —
 * §16 asks for "a warm care history—not a social-media feed", and a byline
 * turns a note about somebody's mother into a post by somebody.
 */
export function momentsTimeline(moments: readonly Moment[], asOf: Date): TimelineEntry[] {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return moments
    .filter((m) => m.state === "shared" && m.sharedAt)
    .slice()
    .sort((a, b) => (b.sharedAt ?? "").localeCompare(a.sharedAt ?? ""))
    .map((m) => {
      const at = new Date(m.sharedAt!);
      return { id: m.id, when: sameDay(at, asOf) ? "Today" : fmt.format(at), body: m.body };
    });
}
