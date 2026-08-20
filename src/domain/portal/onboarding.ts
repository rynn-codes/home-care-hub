import {
  ONBOARDING_ORDER,
  firstShiftReadiness,
  type Applicant,
  type OnboardingStage,
} from "@/domain/hiring/pipeline";
import type { CredentialRequirement } from "@/domain/documents/types";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import type { StatusLine } from "@/domain/portal/candidateStatus";

/**
 * The portal after an offer is accepted — §6, and §29's step 6.
 *
 * §6 is emphatic: "Do not create another onboarding account/application after
 * the candidate advances. The existing Joy portal changes state." So this is
 * not a second module bolted alongside the candidate view; it produces the same
 * `StatusLine` shape the candidate screen already renders, and the same screen
 * shows it. What changes is which lines exist.
 *
 * GUSTO IS NOT REBUILT, AND NOT GUESSED AT EITHER
 *
 * §6: "Gusto should continue handling the HR/payroll workflows intentionally
 * assigned to Gusto rather than Joy rebuilding them." Joy therefore shows a
 * line for it and sends people there.
 *
 * The addendum's example shows that line reading "In Progress". Joy cannot
 * honestly say that today, because nothing is connected to Gusto — and a
 * hardcoded "In Progress" is a screen telling a new hire their W-4 is underway
 * when Joy has no idea. `GustoStatus` is therefore nullable, `null` renders as
 * a prompt to go and do it rather than a status, and the day the port is wired
 * the same line starts telling the truth without the screen changing.
 */

export type GustoStep = "not_started" | "in_progress" | "complete";

export const GUSTO_LABELS: Record<GustoStep, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export interface GustoStatus {
  step: GustoStep;
  /** Where to send them. Gusto owns the workflow; Joy owns the link. */
  url: string | null;
}

/**
 * Scheduled orientation, as Joy knows it.
 *
 * Both dates are nullable and mean different things when absent: a null
 * `onlineOrientation` is something the office has not booked yet, which is
 * Joy's job to fix, not the new hire's.
 */
export interface OrientationSchedule {
  onlineOrientation: string | null;
  fieldOrientation: string | null;
}

export interface OnboardingView {
  lines: StatusLine[];
  headline: string;
  detail: string;
  action: { label: string; to: string } | null;
}

function stageReached(applicant: Applicant, stage: OnboardingStage): boolean {
  const current = applicant.onboardingStage;
  if (!current) return false;
  return ONBOARDING_ORDER.indexOf(current) > ONBOARDING_ORDER.indexOf(stage);
}

/**
 * Build the onboarding view.
 *
 * The order of the lines follows §6's example, which is also the order things
 * actually happen in — a new hire reading down the list sees their own history
 * and then the thing in front of them.
 */
export function onboardingStatus(input: {
  applicant: Applicant;
  applicationSubmitted: boolean;
  gusto: GustoStatus | null;
  orientation: OrientationSchedule;
  requirements?: readonly CredentialRequirement[];
}): OnboardingView {
  const { applicant, applicationSubmitted, gusto, orientation } = input;
  const requirements = input.requirements ?? seedCredentialRequirements;

  const readiness = firstShiftReadiness(applicant, requirements);
  // Only what they can actually supply. Joy's own background check being
  // outstanding is not something to hand a new hire a button for.
  const theirs = [...readiness.missingBlocking, ...readiness.missingSoon].filter(
    (key) => requirements.find((r) => r.credentialType === key)?.suppliedBy !== "agency",
  );
  const held = Object.keys(applicant.documents).length;

  const lines: StatusLine[] = [
    {
      label: "Application",
      value: applicationSubmitted ? "Complete" : "Not finished",
      state: applicationSubmitted ? "done" : "attention",
    },
    { label: "Offer", value: "Accepted", state: "done" },
    {
      label: "Documents",
      value: theirs.length === 0 ? "All received" : `${held} of ${held + theirs.length} received`,
      state: theirs.length === 0 ? "done" : "attention",
    },
    {
      label: "Gusto HR setup",
      // The honest line. See the file header.
      value: gusto ? GUSTO_LABELS[gusto.step] : "Ready for you",
      state: gusto?.step === "complete" ? "done" : gusto ? "in_progress" : "waiting",
    },
    {
      label: "Orientation",
      value: orientation.onlineOrientation ?? "The office will confirm",
      state: stageReached(applicant, "online_orientation")
        ? "done"
        : orientation.onlineOrientation
          ? "in_progress"
          : "waiting",
    },
    {
      label: "Field orientation",
      value: orientation.fieldOrientation ?? "Not scheduled",
      state: stageReached(applicant, "field_orientation")
        ? "done"
        : orientation.fieldOrientation
          ? "in_progress"
          : "waiting",
    },
  ];

  // ---------------------------------------------------------- next step --
  // Ordered by what actually stops a first shift, not by the order of the
  // list above. A missing credential blocks; an unbooked orientation is the
  // office's to sort out.
  if (!applicationSubmitted) {
    return {
      lines,
      headline: "Finish your application",
      detail: "Your answers are saved. Pick up where you left off.",
      action: { label: "Continue application", to: "/portal/work/application" },
    };
  }

  if (theirs.length > 0) {
    const name = requirements.find((r) => r.credentialType === theirs[0])?.displayName ?? theirs[0];
    return {
      lines,
      headline:
        theirs.length === 1
          ? `One credential still needs attention: ${name}`
          : `${theirs.length} credentials still need attention`,
      detail:
        theirs.length === 1
          ? "This is the last thing between you and your first shift."
          : `Starting with your ${name}. A clear photo from your phone is fine.`,
      action: { label: "Complete next step", to: "/portal/work/documents" },
    };
  }

  if (!gusto || gusto.step !== "complete") {
    return {
      lines,
      headline: "Set up your payroll details",
      // Named plainly so nobody wonders why Joy is sending them elsewhere.
      detail:
        "Your W-4, I-9 and direct deposit are handled in Gusto. It takes about ten minutes and " +
        "you'll need a photo ID.",
      action: gusto?.url ? { label: "Open Gusto", to: gusto.url } : null,
    };
  }

  if (!orientation.onlineOrientation) {
    return {
      lines,
      headline: "You're almost ready",
      // Joy holds this one. No button — §5's rule, which does not stop
      // applying once somebody is hired.
      detail: "Everything is in. The office will confirm your orientation date.",
      action: null,
    };
  }

  return {
    lines,
    headline: `Orientation is ${orientation.onlineOrientation}`,
    detail: orientation.fieldOrientation
      ? `Field orientation follows on ${orientation.fieldOrientation}.`
      : "We'll confirm your field orientation after that.",
    action: null,
  };
}
