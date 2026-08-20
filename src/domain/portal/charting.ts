import { TASK_OUTCOME_LABELS, type CareTask, type VisitRecord } from "@/domain/portal/visit";

/**
 * The visit chart — §12, and §29's steps 9 and 10.
 *
 * §12 states the rule in six words: "AI drafts. The caregiver confirms the
 * official visit record." And then the constraint that makes it hard: "AI must
 * not invent missing clinical facts."
 *
 * HOW THAT RULE IS MADE ENFORCEABLE
 *
 * "Do not hallucinate" is not a property a program can check. So every line of
 * a chart carries a `source` saying where it came from, and a line whose source
 * cannot be traced is rejected before a caregiver ever sees it —
 * `validateDraft` does that, and `confirmChart` refuses to finalise a draft
 * that has not passed.
 *
 * There are three sources and they are ranked by how much trust they need:
 *
 *  - `recorded` — the caregiver already answered this in the structured form.
 *    "Bathing: standby assistance" because she tapped it. No language model is
 *    involved and none is needed.
 *  - `quoted` — her own words, unchanged, carried into the chart.
 *  - `drafted` — a model rewrote something. This is the only source that can
 *    be wrong, so it must name the span of her narrative it came from, and that
 *    span must actually appear in what she wrote.
 *
 * The result is that the majority of a Joy chart needs no model at all. Task
 * outcomes and the incident answer are already structured data; drafting them
 * would be inventing a risk where there was none. The model's job is narrow —
 * turning "she was tired but otherwise okay" into an observation line — and
 * that job is exactly where the citation requirement bites.
 */

export type ChartSourceKind = "recorded" | "quoted" | "drafted";

export interface ChartSource {
  kind: ChartSourceKind;
  /**
   * For `recorded`, the field id. For `quoted` and `drafted`, the text from the
   * caregiver's narrative this line rests on.
   */
  reference: string;
}

export interface ChartLine {
  /** "Bathing", "Observation", "Incident". */
  heading: string;
  body: string;
  source: ChartSource;
}

export interface ChartDraft {
  visitId: string;
  lines: ChartLine[];
  /** The caregiver's narrative, kept verbatim alongside the structured chart. */
  narrative: string;
  /** Set by `validateDraft`. `confirmChart` will not proceed without it. */
  validated: boolean;
}

export interface ConfirmedChart extends ChartDraft {
  confirmedByPersonId: string;
  confirmedAt: string;
  /** True when the caregiver changed a drafted line before confirming. */
  edited: boolean;
}

// ------------------------------------------------------ deterministic --

/**
 * How a task outcome reads in a chart.
 *
 * Kept separate from `TASK_OUTCOME_LABELS`, which is button text. "Client
 * declined" is right on a button and "Declined by client" is right in a
 * record, and collapsing the two would eventually put button language into a
 * clinical document.
 */
const OUTCOME_IN_CHART: Record<string, string> = {
  done: "Completed",
  declined: "Declined by client",
  not_needed: "Not required today",
};

/**
 * Build everything that can be built from what the caregiver already recorded.
 *
 * This is the part of §12's example chart that needs no model — bathing, meal,
 * medication reminder, incident. Producing it from structured answers rather
 * than from prose is not a limitation; it is the reason those lines cannot be
 * wrong.
 */
export function draftFromRecord(
  record: VisitRecord,
  tasks: readonly CareTask[],
  visitId: string,
): ChartDraft {
  const lines: ChartLine[] = [];

  for (const task of tasks) {
    const outcome = record.tasks[task.id];
    if (!outcome) continue;
    lines.push({
      heading: task.label,
      body: OUTCOME_IN_CHART[outcome] ?? TASK_OUTCOME_LABELS[outcome],
      source: { kind: "recorded", reference: task.id },
    });
  }

  if (record.incidentAnswered) {
    lines.push({
      heading: "Incident",
      body: record.incidentOccurred ? record.incidentDetail.trim() : "None reported",
      source: { kind: "recorded", reference: "incident" },
    });
  }

  return { visitId, lines, narrative: record.note.trim(), validated: false };
}

/**
 * Add the caregiver's own words as an observation, unchanged.
 *
 * The fallback when no drafting service is connected, and a perfectly good
 * chart on its own. A verbatim observation is less tidy than a drafted one and
 * strictly more trustworthy, which is the right way round for a clinical
 * record.
 */
export function withVerbatimObservation(draft: ChartDraft): ChartDraft {
  if (!draft.narrative) return draft;
  return {
    ...draft,
    lines: [
      ...draft.lines,
      {
        heading: "Observation",
        body: draft.narrative,
        source: { kind: "quoted", reference: draft.narrative },
      },
    ],
  };
}

// --------------------------------------------------------- validation --

export type DraftProblem =
  /** A drafted line cites text that is not in what the caregiver wrote. */
  | "uncited_claim"
  /** A quoted line does not match the narrative it claims to quote. */
  | "misquote"
  /** A line has no body. */
  | "empty";

export interface DraftValidation {
  ok: boolean;
  problems: Array<{ heading: string; problem: DraftProblem; detail: string }>;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check every line can account for itself.
 *
 * This is the enforcement point for "AI must not invent missing clinical
 * facts". A drafted line saying the client ate all of breakfast, when the
 * caregiver never mentioned breakfast, cites nothing and does not survive here.
 *
 * It is not a general-purpose hallucination detector and does not pretend to
 * be. What it guarantees is narrower and still worth having: no line reaches a
 * caregiver for confirmation unless it points at something she actually wrote
 * or something she actually tapped. A model that paraphrases her words can pass;
 * a model that adds a fact cannot, because there is no span to cite.
 */
export function validateDraft(draft: ChartDraft): DraftValidation {
  const haystack = normalise(draft.narrative);
  const problems: DraftValidation["problems"] = [];

  for (const line of draft.lines) {
    if (!line.body.trim()) {
      problems.push({ heading: line.heading, problem: "empty", detail: "No content." });
      continue;
    }

    if (line.source.kind === "recorded") continue;

    const cited = normalise(line.source.reference);

    if (!cited) {
      problems.push({
        heading: line.heading,
        problem: "uncited_claim",
        detail: "Nothing in the caregiver's own words supports this line.",
      });
      continue;
    }

    if (!haystack.includes(cited)) {
      problems.push({
        heading: line.heading,
        problem: line.source.kind === "quoted" ? "misquote" : "uncited_claim",
        detail: "The text this line cites does not appear in what the caregiver wrote.",
      });
      continue;
    }

    if (line.source.kind === "quoted" && normalise(line.body) !== cited) {
      problems.push({
        heading: line.heading,
        problem: "misquote",
        detail: "A quoted line must match the caregiver's words exactly.",
      });
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Validate and stamp, so `confirmChart` has something to check. */
export function markValidated(draft: ChartDraft): ChartDraft {
  return { ...draft, validated: validateDraft(draft).ok };
}

// ------------------------------------------------------- confirmation --

/**
 * The caregiver makes it official.
 *
 * Three refusals, all of them §12's sentence taken literally.
 *
 * A missing person id is refused for the same reason `confirmCredential`
 * refuses one: a clinical record whose author is "the system" is not a record
 * anybody can rely on, and if this ever reaches a subpoena the question will be
 * who attested to it.
 *
 * An unvalidated draft is refused because confirmation is the caregiver
 * accepting responsibility for the content, and she cannot do that for a line
 * that cites nothing.
 *
 * Confirming twice is refused because the chart is then already the official
 * record — changing it is an amendment, which is a different act with a
 * different audit trail.
 */
export function confirmChart(input: {
  draft: ChartDraft;
  personId: string | null;
  at: string;
  edited: boolean;
}): ConfirmedChart {
  const { draft, personId, at, edited } = input;

  if (!personId) {
    throw new Error(
      "A visit chart needs the caregiver confirming it. §12: the caregiver confirms " +
        "the official visit record, and a record attributed to nobody is not one.",
    );
  }

  if (!draft.validated) {
    const problems = validateDraft(draft).problems;
    throw new Error(
      "This draft has not passed validation and must not be confirmed: " +
        problems.map((p) => `${p.heading} — ${p.detail}`).join("; "),
    );
  }

  return { ...draft, confirmedByPersonId: personId, confirmedAt: at, edited };
}

/**
 * Editing a drafted line makes it the caregiver's own.
 *
 * Once she rewrites it, the model's citation no longer describes what the line
 * says — so the source becomes a quote of her edit, and validation is rerun
 * against the narrative. That is what stops an edit from smuggling past a check
 * the original line had to pass.
 */
export function editLine(draft: ChartDraft, heading: string, body: string): ChartDraft {
  return markValidated({
    ...draft,
    lines: draft.lines.map((line) =>
      line.heading === heading
        ? {
            ...line,
            body,
            // An edited line is hers now. It is checked as a quote against the
            // narrative, and if she wrote something new the narrative grows to
            // match — see `withNarrative`.
            source: { kind: "quoted", reference: body },
          }
        : line,
    ),
  });
}

/** Her edits become part of what she wrote, so quoting them is honest. */
export function withNarrative(draft: ChartDraft, narrative: string): ChartDraft {
  return markValidated({ ...draft, narrative: narrative.trim() });
}

/** §12's on-screen chart, as headings and bodies. */
export function chartLines(draft: ChartDraft): Array<{ heading: string; body: string; drafted: boolean }> {
  return draft.lines.map((line) => ({
    heading: line.heading,
    body: line.body,
    // Surfaced so the UI can mark what a model touched. A caregiver reviewing
    // should know which lines are hers and which are a suggestion.
    drafted: line.source.kind === "drafted",
  }));
}
