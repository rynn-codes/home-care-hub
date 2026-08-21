import type { WorkQueueGroup } from "@/domain/workQueue";
import type { AdmissionStage, AdmissionStatus } from "@/domain/admissions/stages";

export interface ClassifiableAdmission {
  stage: AdmissionStage;
  status: AdmissionStatus;
  /** Set when Joy is waiting on someone outside the office. */
  waitingOn?: string | null;
  /** Set when the next milestone is already booked. */
  scheduledAt?: string | Date | null;
  /** Set when something is past due and needs a person today. */
  overdue?: boolean;
}

/**
 * Decides which work-queue section an admission belongs in.
 *
 * The rule is about who holds the next move, not about which stage the record
 * has reached — that is the distinction section 8 is drawing, and it is why a
 * stage column and a work queue are not the same view of the same data.
 */
export function classifyAdmission(admission: ClassifiableAdmission): WorkQueueGroup {
  // A closed referral is history. It appears only under an explicit filter,
  // but it must land somewhere rather than throw.
  if (admission.status === "closed" || admission.stage === "closed") {
    return "moving_forward";
  }

  // Overdue always outranks everything else. Something past due is the clearest
  // possible case of "a Joy Health user must act".
  if (admission.overdue) return "needs_you";

  // On hold means a person decided to pause this. That is waiting, not action.
  if (admission.status === "on_hold") return "waiting";

  if (admission.waitingOn) return "waiting";

  if (admission.scheduledAt) return "moving_forward";

  switch (admission.stage) {
    // A new referral with nothing booked is someone who called and has not been
    // called back. That is the most time-sensitive item in the module.
    case "new_referral":
      return "needs_you";

    // Intake started and not finished, with nobody being waited on, means the
    // office simply has not completed it.
    case "phone_intake":
      return "needs_you";

    // An assessment with no date booked needs scheduling.
    case "assessment":
      return "needs_you";

    // Pre-onboarding without a named blocker means documents or a care plan are
    // sitting with the office.
    case "pre_onboarding":
      return "needs_you";

    // Ready for admission is a decision waiting to be made by a human here.
    case "ready_for_admission":
      return "needs_you";

    case "admitted":
      return "moving_forward";

    default:
      return "waiting";
  }
}

/**
 * Has Joy decided to move forward with this admission?
 *
 * §19's gate for sending a family their portal link, and the reason it is a
 * function rather than a condition inside a screen: the same question is asked
 * on the admission review and on the client record, and two copies of it would
 * eventually answer differently.
 *
 * Moving forward means the record has advanced PAST the assessment and is still
 * live. Not "the assessment is complete" — a completed assessment sitting in the
 * assessment stage is Joy still thinking. And an admission on hold has not been
 * declined, but it is not moving either; sending a portal link to a family in
 * that state tells them their father's care is further along than it is, which
 * is precisely what §19's gate exists to prevent.
 */
export function admissionIsMovingForward(input: {
  stage: AdmissionStage;
  status: AdmissionStatus;
}): boolean {
  if (input.status !== "active") return false;
  return (
    input.stage === "pre_onboarding" ||
    input.stage === "ready_for_admission" ||
    input.stage === "admitted"
  );
}
