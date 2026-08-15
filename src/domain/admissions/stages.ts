/**
 * Admission stages and the transitions between them.
 *
 * Section 50 requires explicit enums and state transitions, and domain logic
 * outside UI components. A stage change is a business rule, not something a
 * drag-and-drop handler decides — the Admissions spec says dragging between
 * stages must be validated where a stage has completion requirements.
 */

export const ADMISSION_STAGES = [
  "new_referral",
  "phone_intake",
  "assessment",
  "pre_onboarding",
  "ready_for_admission",
  "admitted",
  "closed",
] as const;

export type AdmissionStage = (typeof ADMISSION_STAGES)[number];

export type AdmissionStatus = "active" | "on_hold" | "closed";

export const STAGE_LABELS: Record<AdmissionStage, string> = {
  new_referral: "New Referral",
  phone_intake: "Phone Intake",
  assessment: "Assessment",
  pre_onboarding: "Pre-Onboarding",
  ready_for_admission: "Ready for Admission",
  admitted: "Admitted",
  closed: "Closed",
};

/**
 * The forward path. Any stage may also close — a referral can be declined or
 * lost at any point, and section 22 requires that record be kept, not deleted.
 *
 * Deliberately not a free-for-all: skipping from new_referral straight to
 * admitted would mean admitting someone with no intake and no assessment.
 */
const FORWARD: Record<AdmissionStage, AdmissionStage[]> = {
  new_referral: ["phone_intake"],
  phone_intake: ["assessment"],
  assessment: ["pre_onboarding"],
  pre_onboarding: ["ready_for_admission"],
  ready_for_admission: ["admitted"],
  admitted: [],
  closed: [],
};

/**
 * Stages a record may move back to. Going backwards is legitimate — an
 * assessment can reveal that intake was incomplete — but it is a correction,
 * and the audit log should show it as one.
 */
const BACKWARD: Record<AdmissionStage, AdmissionStage[]> = {
  new_referral: [],
  phone_intake: ["new_referral"],
  assessment: ["phone_intake"],
  pre_onboarding: ["assessment"],
  ready_for_admission: ["pre_onboarding"],
  admitted: [],
  closed: [],
};

export function nextStage(stage: AdmissionStage): AdmissionStage | null {
  return FORWARD[stage][0] ?? null;
}

export function allowedTransitions(stage: AdmissionStage): AdmissionStage[] {
  if (stage === "closed" || stage === "admitted") return [];
  return [...FORWARD[stage], ...BACKWARD[stage], "closed"];
}

export function canTransition(from: AdmissionStage, to: AdmissionStage): boolean {
  return allowedTransitions(from).includes(to);
}

export interface TransitionRefusal {
  allowed: false;
  reason: string;
}

export type TransitionCheck = { allowed: true } | TransitionRefusal;

/**
 * Validates a stage change and explains any refusal in words a user can act on.
 *
 * Section 43: never show a generic failure when a more useful state is known.
 */
export function checkTransition(
  from: AdmissionStage,
  to: AdmissionStage,
  options: { closeReason?: string | null } = {},
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: `This admission is already at ${STAGE_LABELS[to]}.` };
  }

  if (from === "closed") {
    return {
      allowed: false,
      reason: "This referral is closed. Reopen it before moving it to another stage.",
    };
  }

  if (from === "admitted") {
    return {
      allowed: false,
      reason:
        "This client has been admitted. Their record now lives under People, and care changes are made there.",
    };
  }

  if (to === "closed") {
    if (!options.closeReason?.trim()) {
      return {
        allowed: false,
        reason: "Closing a referral needs a reason, so the history stays useful.",
      };
    }
    return { allowed: true };
  }

  if (!canTransition(from, to)) {
    const next = nextStage(from);
    return {
      allowed: false,
      reason: next
        ? `${STAGE_LABELS[from]} moves to ${STAGE_LABELS[next]} next, not ${STAGE_LABELS[to]}.`
        : `${STAGE_LABELS[from]} cannot move to ${STAGE_LABELS[to]}.`,
    };
  }

  return { allowed: true };
}
