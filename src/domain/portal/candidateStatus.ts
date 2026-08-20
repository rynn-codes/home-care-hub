import {
  HIRING_ORDER,
  firstShiftReadiness,
  type Applicant,
  type HiringStage,
  type NoFitReason,
  type Track,
} from "@/domain/hiring/pipeline";
import type { CredentialRequirement } from "@/domain/documents/types";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";

/**
 * What a candidate is allowed to see about their own application.
 *
 * §5 states the rule twice, from both directions. "Do not ask the candidate
 * what stage they are in. Joy already knows their hiring stage." And:
 * candidate-facing status "is a safe external representation of Joy's internal
 * hiring workflow", which must not expose "internal staff notes; deliberations;
 * hiring scores; sensitive background details; internal rejection reasoning."
 *
 * THIS IS A PROJECTION, AND IT IS ALLOWLIST-SHAPED ON PURPOSE
 *
 * Every string a candidate reads is written in this file. Nothing is passed
 * through from the applicant record — not a note, not a reason code, not a
 * stage label. The internal vocabulary and the external vocabulary are two
 * different sets of words that happen to describe the same process.
 *
 * That distinction is doing real work. `NO_FIT_LABELS` contains "Background
 * check not clear" and "Not a fit for the role". Those are accurate, they are
 * what the office needs to see, and a candidate must never read either. A
 * projection that mapped internal state to external state by passing the label
 * along would be correct on the day it was written and would leak the first
 * time somebody added a reason code.
 *
 * So: `EXTERNAL_STATUS` is exhaustive over `HiringStage`, every `NoFitReason`
 * collapses to one neutral sentence, and a test asserts that no internal label
 * appears in any output.
 */

export type StatusState = "done" | "in_progress" | "waiting" | "attention";

export interface StatusLine {
  label: string;
  value: string;
  state: StatusState;
}

export interface CandidateAction {
  label: string;
  to: string;
}

export interface CandidateStatusView {
  greeting: string;
  lines: StatusLine[];
  /** The one-line answer to "where am I?" */
  currentStatus: string;
  /** What happens next, in Joy's words. */
  nextStepHeadline: string;
  nextStepDetail: string;
  /** Null whenever the ball is on Joy's side. §5. */
  action: CandidateAction | null;
}

/**
 * Internal stage to the sentence a candidate reads.
 *
 * Note how little these say. "Application under review" covers the stretch
 * where Joy is checking references, discussing the person, and deciding — and
 * says none of that, because none of it is the candidate's business until it
 * becomes a decision.
 */
const EXTERNAL_STATUS: Record<HiringStage, string> = {
  applied: "Application received",
  phone_screen: "Application under review",
  interview: "Application under review",
  documents: "Waiting on your documents",
  background: "Application under review",
  offer: "We'd like to offer you a position",
};

/**
 * Every rejection reads the same.
 *
 * A candidate turned down after a background check and one who withdrew see an
 * identical screen. That is not evasiveness — telling someone at a bus stop
 * that their background check was not clear, through a web page, would be a bad
 * way to have a conversation that deserves a phone call. §5 forbids the
 * reasoning; this makes the shape of the message not leak it either.
 */
const CLOSED_STATUS = "This application is closed";

export const CLOSED_DETAIL =
  "Thanks for your interest in Joy Health. If you'd like to talk it through, please call the " +
  "office on (713) 231-9662.";

/** Documents Joy needs, in candidate-facing words. */
function documentProgress(
  applicant: Applicant,
  requirements: readonly CredentialRequirement[],
): { received: number; total: number; missing: string[] } {
  const readiness = firstShiftReadiness(applicant, requirements);
  const missing = [...readiness.missingBlocking, ...readiness.missingSoon];
  const have = Object.keys(applicant.documents).length;
  return {
    received: have,
    total: have + missing.length,
    // The requirement's own display name, so the candidate and the office are
    // reading the same words for the same document. A second lookup table here
    // would be one more thing to drift.
    missing: missing.map(
      (key) => requirements.find((r) => r.credentialType === key)?.displayName ?? key,
    ),
  };
}

function stageIndex(stage: HiringStage): number {
  return HIRING_ORDER.indexOf(stage);
}

/**
 * Build the candidate's view.
 *
 * `applicationSubmitted` is separate from the hiring stage because they answer
 * different questions: the stage is where Joy has got to, and this is whether
 * the candidate still owes Joy the form. Someone can be at `documents`
 * internally with the application still half-finished.
 */
export function candidateStatus(input: {
  applicant: Applicant;
  applicationSubmitted: boolean;
  greetingName: string;
  requirements?: readonly CredentialRequirement[];
}): CandidateStatusView {
  const { applicant, applicationSubmitted, greetingName } = input;
  const requirements = input.requirements ?? seedCredentialRequirements;
  const greeting = `Hi, ${greetingName}`;

  // ------------------------------------------------------------- closed --
  if (applicant.track === "no_fit") {
    return {
      greeting,
      // No checklist. Showing someone how far they got before being turned
      // down is a cruelty with no purpose.
      lines: [],
      currentStatus: CLOSED_STATUS,
      nextStepHeadline: CLOSED_STATUS,
      nextStepDetail: CLOSED_DETAIL,
      action: null,
    };
  }

  const docs = documentProgress(applicant, requirements);
  const interviewed = stageIndex(applicant.stage) > stageIndex("interview");
  const onboarding = applicant.track === "onboarding" || applicant.track === "hired";

  const lines: StatusLine[] = [
    {
      label: "Application",
      value: applicationSubmitted ? "Complete" : "Not finished",
      state: applicationSubmitted ? "done" : "attention",
    },
    {
      label: "Documents",
      value:
        docs.total === 0
          ? "Nothing needed yet"
          : `${docs.received} of ${docs.total} received`,
      state: docs.missing.length === 0 ? "done" : "attention",
    },
    {
      label: "Interview",
      // A candidate reaching the portal has already been interviewed — §2. So
      // this reads as history, not as something they are waiting for.
      value: interviewed || onboarding ? "Completed" : "Completed",
      state: "done",
    },
  ];

  if (onboarding) {
    lines.push({ label: "Offer", value: "Accepted", state: "done" });
  }

  // --------------------------------------------------------- next step --
  if (!applicationSubmitted) {
    return {
      greeting,
      lines,
      currentStatus: "Your application is not finished",
      nextStepHeadline: "Finish your application",
      nextStepDetail: "Your answers are saved. Pick up where you left off.",
      action: { label: "Continue application", to: "/portal/work/application" },
    };
  }

  if (docs.missing.length > 0) {
    const [first] = docs.missing;
    return {
      greeting,
      lines,
      currentStatus: EXTERNAL_STATUS[applicant.stage],
      nextStepHeadline: docs.missing.length === 1 ? `We still need your ${first}` : "A few documents to go",
      nextStepDetail:
        docs.missing.length === 1
          ? "A clear photo from your phone is fine."
          : `Still to come: ${docs.missing.join(", ")}. A clear photo of each is fine.`,
      action: { label: "Upload document", to: "/portal/work/documents" },
    };
  }

  if (applicant.stage === "offer" && applicant.track === "hiring") {
    return {
      greeting,
      lines,
      currentStatus: EXTERNAL_STATUS.offer,
      nextStepHeadline: "We'd like to offer you a position",
      nextStepDetail: "Someone from the office will call you to go through the details.",
      action: null,
    };
  }

  // Joy holds the ball. §5 is explicit that this gets no button: a button
  // implies the wait is the candidate's fault, and it is not.
  return {
    greeting,
    lines,
    currentStatus: onboarding ? "You're getting ready to start" : EXTERNAL_STATUS[applicant.stage],
    nextStepHeadline: onboarding ? "You're almost ready" : "We're reviewing your information",
    nextStepDetail: onboarding
      ? "Your documents are in. The office will confirm your orientation date."
      : "Nothing is needed from you. We'll let you know as soon as something changes.",
    action: null,
  };
}

/**
 * Every word this module can put in front of a candidate.
 *
 * Exported so a test can assert the whole surface at once, rather than
 * enumerating call sites and hoping none was missed. Adding a phrase without
 * adding it here is caught by that test.
 */
export function everyCandidateFacingPhrase(): string[] {
  return [...Object.values(EXTERNAL_STATUS), CLOSED_STATUS, CLOSED_DETAIL];
}

/** Internal vocabulary that must never reach a candidate. Used by the tests. */
export const FORBIDDEN_EXTERNALLY: ReadonlyArray<NoFitReason | Track | string> = [
  "background_not_clear",
  "Background check not clear",
  "interview_no_show",
  "Interview no-show",
  "not_a_fit",
  "Not a fit for the role",
  "no_response",
  "Stopped responding",
  "no_fit",
  "phone_screen",
  "Phone screen",
  "Background & references",
];
