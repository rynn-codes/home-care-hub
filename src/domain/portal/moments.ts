import type { ConsentDecision } from "@/domain/consents/registry";

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
 * Words that mean this belongs in the chart, not the family portal.
 *
 * Deliberately blunt. It will occasionally stop something harmless — "she had a
 * fall of leaves in the garden" would trip on `fall` — and that is the right
 * way for it to fail, because a caregiver can rephrase in four seconds and the
 * alternative failure is an incident report arriving as a warm update.
 */
const CLINICAL_TERMS = [
  "medication",
  "med ",
  "dose",
  "diagnos",
  "incident",
  "fall",
  "fell",
  "wound",
  "catheter",
  "incontinen",
  "bowel",
  "toilet",
  "blood pressure",
  "vitals",
  "bathing assistance",
  "transfer assist",
  "hospice",
  "dementia",
  "refused care",
  "declined care",
];

/** Phrasing that is a note to the office, not to a family. */
const STAFF_TERMS = [
  "supervisor",
  "call the office",
  "let the office know",
  "needs review",
  "care plan update",
  "family is difficult",
  "per my notes",
];

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

  const clinical = CLINICAL_TERMS.find((term) => lower.includes(term));
  if (clinical) {
    problems.push({
      problem: "clinical_content",
      detail:
        "This reads like part of the visit chart. Moments are the warm bit — the care " +
        "record stays in the chart where the office and the nurse can see it.",
    });
  }

  const staff = STAFF_TERMS.find((term) => lower.includes(term));
  if (staff) {
    problems.push({
      problem: "staff_note",
      detail: "This looks like a note for the office rather than for the family.",
    });
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------- approval --

/**
 * Who signs a Moment off before a family sees it.
 *
 * §14's flow shows the caregiver tapping [Approve & Share] herself, so that is
 * the default. `office` routes every Moment to the RN or admin first.
 *
 * FLAGGED FOR KARYNN. She has been consistently careful about what reaches a
 * family — she is the only one who takes a client's signature, and she reviews
 * the consents in person. Caregiver self-approval is what the addendum
 * describes and it is faster; office approval means nothing reaches a daughter
 * without a second pair of eyes, at the cost of somebody having to read them.
 * This is a one-line change either way.
 */
export type MomentApprovalPolicy = "caregiver" | "office";

export const DEFAULT_APPROVAL_POLICY: MomentApprovalPolicy = "caregiver";

export interface Approver {
  personId: string;
  /** Whether this person holds an RN or admin role. */
  isOffice: boolean;
}

export function mayApprove(approver: Approver, policy: MomentApprovalPolicy): boolean {
  return policy === "caregiver" ? true : approver.isOffice;
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
  policy?: MomentApprovalPolicy;
  disclosureConsent: ConsentDecision | undefined;
  at: string;
}): Moment {
  const { moment, approver, disclosureConsent, at } = input;
  const policy = input.policy ?? DEFAULT_APPROVAL_POLICY;

  if (moment.state === "shared") {
    throw new Error("This Moment has already been shared with the family.");
  }
  if (moment.state === "skipped") {
    throw new Error("There is no Moment here to share.");
  }
  if (!mayApprove(approver, policy)) {
    throw new Error("Moments are reviewed by the office before the family sees them.");
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
  return { ...moment, body: body.trim(), edited: body.trim() !== moment.narrative };
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

// ------------------------------------------------------- preferences --

/**
 * §17's "Getting to Know Me".
 *
 * "These are deliberately maintained personal preferences, not uncontrolled AI
 * memory." So a preference is a row somebody added on purpose, with a name
 * against it — never something inferred from Moments or charts. Nothing in this
 * file writes one.
 */
export interface Preference {
  id: string;
  clientPersonId: string;
  text: string;
  addedByPersonId: string;
  addedAt: string;
  /** Preferences are shown to caregivers before a visit, so they are approved. */
  approved: boolean;
}

/** What a caregiver sees before a visit. Approved only. */
export function visiblePreferences(preferences: readonly Preference[]): string[] {
  return preferences.filter((p) => p.approved).map((p) => p.text);
}
