import { clinicalTermIn, staffTermIn } from "@/domain/portal/familySafeText";

/**
 * "Getting to know me" — §17, and §29's step 15.
 *
 * §17's sentence is the whole specification: "These are deliberately maintained
 * personal preferences, not uncontrolled AI memory."
 *
 * Both halves matter.
 *
 * MAINTAINED means every preference is a row somebody put there on purpose,
 * with a name against it and a date. Nothing in this module derives a
 * preference from a Moment, a chart or a visit note — there is no function that
 * takes any of those, for the same reason `draftMoment` has no chart parameter.
 * A system that quietly learned "Dad doesn't like Tuesdays" from three cancelled
 * visits would be inferring a fact about a person and presenting it as
 * something the family told us.
 *
 * NOT AI MEMORY also means a preference can be wrong and must be removable.
 * People change; a preference recorded in March may be untrue by September, and
 * the person best placed to say so is the family. So `retirePreference` keeps
 * the row and marks it, rather than deleting it — the caregiver who acted on it
 * last week acted reasonably, and the record should still show why.
 *
 * WHY THEY ARE SCREENED
 *
 * §17 says "approved, non-sensitive". The tempting misuse is obvious: "gets
 * agitated in the evening" is genuinely useful to a substitute caregiver, and
 * it is a care plan item, not a preference. Putting it here would route
 * clinical information around the RN who maintains the care plan and into a
 * list a family reads as "things Dad likes". `checkPreference` refuses it and
 * says where it belongs.
 */

export type PreferenceState = "proposed" | "approved" | "retired";

export interface Preference {
  id: string;
  clientPersonId: string;
  text: string;
  state: PreferenceState;
  /** Who put it there. A preference with no author is AI memory. */
  addedByPersonId: string;
  addedAt: string;
  approvedByPersonId: string | null;
  approvedAt: string | null;
  retiredReason: string | null;
  /** Families can add these about their own person. §17. */
  source: "office" | "family" | "caregiver";
}

export type PreferenceProblem = "clinical_content" | "staff_note" | "empty" | "too_long";

export interface PreferenceCheck {
  ok: boolean;
  problem: PreferenceProblem | null;
  detail: string | null;
}

/**
 * A preference is one line on a card a caregiver reads in a doorway.
 *
 * The limit is not arbitrary tidiness: anything longer is a paragraph about
 * somebody's care, and a paragraph about somebody's care is a care plan.
 */
export const MAX_PREFERENCE_LENGTH = 120;

export function checkPreference(text: string): PreferenceCheck {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, problem: "empty", detail: "There's nothing here yet." };
  }

  if (trimmed.length > MAX_PREFERENCE_LENGTH) {
    return {
      ok: false,
      problem: "too_long",
      detail: "Keep it to one line — this is read in a doorway, not studied.",
    };
  }

  if (clinicalTermIn(trimmed)) {
    return {
      ok: false,
      problem: "clinical_content",
      // Says where it belongs rather than just refusing. Whoever wrote this was
      // trying to help a colleague, and the information is worth having — in
      // the care plan, where the nurse maintains it.
      detail:
        "This belongs in the care plan rather than here — our nurse keeps that, and " +
        "caregivers see it before a visit.",
    };
  }

  if (staffTermIn(trimmed)) {
    return {
      ok: false,
      problem: "staff_note",
      detail: "This reads like a note for the office rather than something about them.",
    };
  }

  return { ok: true, problem: null, detail: null };
}

export function proposePreference(input: {
  id: string;
  clientPersonId: string;
  text: string;
  byPersonId: string | null;
  source: Preference["source"];
  at: string;
}): Preference {
  if (!input.byPersonId) {
    throw new Error(
      "A preference needs whoever added it. §17: these are deliberately maintained, " +
        "and a row with no author is exactly the uncontrolled memory it rules out.",
    );
  }

  const check = checkPreference(input.text);
  if (!check.ok) throw new Error(check.detail ?? "This cannot be added.");

  return {
    id: input.id,
    clientPersonId: input.clientPersonId,
    text: input.text.trim(),
    // Anything a family or caregiver adds waits for the office. Anything the
    // office adds is already theirs.
    state: input.source === "office" ? "approved" : "proposed",
    addedByPersonId: input.byPersonId,
    addedAt: input.at,
    approvedByPersonId: input.source === "office" ? input.byPersonId : null,
    approvedAt: input.source === "office" ? input.at : null,
    retiredReason: null,
    source: input.source,
  };
}

export function approvePreference(input: {
  preference: Preference;
  byPersonId: string | null;
  at: string;
}): Preference {
  if (!input.byPersonId) throw new Error("An approval needs the person approving it.");
  if (input.preference.state === "retired") {
    throw new Error("This preference was retired. Add it again rather than reviving it.");
  }

  return {
    ...input.preference,
    state: "approved",
    approvedByPersonId: input.byPersonId,
    approvedAt: input.at,
  };
}

/**
 * Take one out of circulation.
 *
 * Kept rather than deleted. Somebody acted on this last week and acted
 * reasonably; a record that erases the instruction leaves that looking like a
 * mistake nobody can explain.
 */
export function retirePreference(preference: Preference, reason: string): Preference {
  return { ...preference, state: "retired", retiredReason: reason };
}

/**
 * What a caregiver sees before a visit — §17's actual purpose.
 *
 * "This can help a substitute caregiver create a more familiar experience." So
 * approved only: a proposal nobody has looked at yet must not reach somebody
 * standing at a front door, because they have no way to know it is unreviewed.
 */
export function preferencesForVisit(preferences: readonly Preference[], clientPersonId: string): string[] {
  return preferences
    .filter((p) => p.clientPersonId === clientPersonId && p.state === "approved")
    .map((p) => p.text);
}

/** What the office reviews. */
export function awaitingApproval(preferences: readonly Preference[]): Preference[] {
  return preferences.filter((p) => p.state === "proposed");
}
