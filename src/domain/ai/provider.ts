/**
 * The AI provider abstraction — the Product Bible's own principle, verbatim:
 * "OpenAI is the primary AI provider with a provider abstraction layer."
 *
 * This port IS the abstraction layer. The named primary is OpenAI; the seam
 * exists so that fact is configuration, not architecture — an adapter
 * implements this interface against OpenAI (or any provider) server-side, and
 * nothing else in Joy knows or cares which model answered.
 *
 * THE CONSTITUTIONAL RULE TRAVELS WITH THE PORT: "AI drafts. Humans approve."
 * Note what the interface cannot express — an AI output that takes effect.
 * Every response is a Draft with a confidence, and a draft becomes real only
 * when a person accepts it through the same paths their own typing would take.
 * This is already how the rest of Joy treats machine suggestions (billing
 * runs suggest, GHL events suggest, background reviews never self-resolve);
 * the port makes it structural for AI as well.
 *
 * The purposes are Joy's actual AI uses from the specs, as data — a new use
 * is a new purpose here first, so "where does Joy use AI" stays a one-file
 * answer for the §10 vendor review.
 */

export const AI_PURPOSES = [
  /** §16-adjacent: drafting an intake summary from a call transcript. */
  "intake_draft",
  /** The AI-guided assessment: section drafts with confidence scoring. */
  "assessment_section_draft",
  /** A Moment drafted from a caregiver's visit note (family-facing, reviewed). */
  "moment_draft",
  /** Talk-to-Joy answers over operational data. Summaries, never decisions. */
  "operational_summary",
] as const;

export type AiPurpose = (typeof AI_PURPOSES)[number];

export interface AiDraftRequest {
  purpose: AiPurpose;
  /** The material the draft is made from. The caller minimises it — nothing
   * reaches a provider that the §10 review has not approved for that purpose. */
  input: string;
  /** Plain-language instruction for this call, versioned by the caller. */
  instruction: string;
}

export interface AiDraft {
  /** The draft. A human accepts, edits, or discards it — it never acts. */
  text: string;
  /**
   * The Bible's confidence scoring, 0–1. Adapters that cannot produce a real
   * figure return null rather than inventing one — a made-up confidence is
   * worse than none, because somebody will sort by it.
   */
  confidence: number | null;
  /** Which provider and model answered, for the audit trail. */
  provider: string;
}

export interface AiProvider {
  draft(request: AiDraftRequest): Promise<AiDraft>;
}

/**
 * The provider when none is configured. Refuses loudly — §41's rule: a flag
 * being off means the feature is absent and says so, never that a mock
 * quietly stands in. A null provider that returned plausible drafts would be
 * the exact fake success that rule exists to prevent.
 */
export class NullAiProvider implements AiProvider {
  async draft(request: AiDraftRequest): Promise<AiDraft> {
    throw new Error(
      `No AI provider is configured, so nothing can draft ${request.purpose}. ` +
        "The screens work without one — AI drafts are an assist, never a dependency.",
    );
  }
}
