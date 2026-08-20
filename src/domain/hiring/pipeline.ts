import { requirementApplies } from "@/domain/credentials/compliance";
import type { CredentialRequirement } from "@/domain/documents/types";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";

/**
 * The hiring and onboarding pipeline.
 *
 * Two tracks, following the approved Hiring mockup and §39. Applicants move
 * through hiring; once an offer is accepted they move through onboarding, and
 * only at the end of that do they become an active employee who can be given a
 * client. A person who is halfway through onboarding is not staff yet, and the
 * schedule must not offer them.
 *
 * SOURCE NOTE. `Joy_Health_Hiring_Screen_Roadmap.md` is named in the brief and
 * is not in the repository — this is built from the Hiring mockup and §39
 * instead, which is exactly the gap finding F8 describes. Karynn confirmed on
 * 18 Aug that the roadmap was named by the brief but never written, so this is
 * the source of truth now rather than a stand-in. One thing remains an
 * seven-day staleness threshold was confirmed. Which documents block a first
 * shift is no longer decided here at all — it comes from Joy's credential
 * requirements, so hiring and scheduling cannot disagree.
 */

export type HiringStage =
  | "applied"
  | "phone_screen"
  | "interview"
  | "documents"
  | "background"
  | "offer";

export const HIRING_STAGE_LABELS: Record<HiringStage, string> = {
  applied: "Applied",
  phone_screen: "Phone screen",
  interview: "Interview",
  documents: "Documents",
  background: "Background & references",
  offer: "Offer",
};

export const HIRING_ORDER: HiringStage[] = [
  "applied",
  "phone_screen",
  "interview",
  "documents",
  "background",
  "offer",
];

export type OnboardingStage =
  | "online_orientation"
  | "field_orientation"
  | "first_shift"
  | "week_1"
  | "week_2";

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  online_orientation: "Online orientation",
  field_orientation: "Field orientation",
  first_shift: "First shift",
  week_1: "Week 1 follow-up",
  week_2: "Week 2 follow-up",
};

export const ONBOARDING_ORDER: OnboardingStage[] = [
  "online_orientation",
  "field_orientation",
  "first_shift",
  "week_1",
  "week_2",
];

export type Track = "hiring" | "onboarding" | "hired" | "no_fit";

/** Why an applicant stopped. Recording the reason is the point of the track. */
export type NoFitReason =
  | "interview_no_show"
  | "background_not_clear"
  | "withdrew"
  | "not_a_fit"
  | "no_response";

export const NO_FIT_LABELS: Record<NoFitReason, string> = {
  interview_no_show: "Interview no-show",
  background_not_clear: "Background check not clear",
  withdrew: "Withdrew — accepted another offer",
  not_a_fit: "Not a fit for the role",
  no_response: "Stopped responding",
};

export interface DocumentRecord {
  /** ISO date the document was issued or signed. */
  issued: string;
  /** ISO date it lapses. Null for items that do not expire. */
  expires: string | null;
}

export interface Applicant {
  id: string;
  name: string;
  roleApplied: string;
  track: Track;
  stage: HiringStage;
  onboardingStage?: OnboardingStage | null;
  /** ISO date the applicant entered the current stage. */
  stageSince: string;
  appliedOn: string;
  source: string;
  recruiter: string | null;
  email: string;
  phone: string;
  availability: string;
  drives: boolean;
  noFitReason?: NoFitReason | null;
  /**
   * Documents supplied so far, keyed the same as the Employees credential
   * module so a hire converts without translation. Each carries its own dates,
   * because a CPR card without an expiry is not a record of anything — and
   * inventing the expiry at conversion time would put fiction into the
   * compliance clock on somebody's first day.
   */
  documents: Record<string, DocumentRecord>;
  /** Set once the offer is accepted. */
  offerAcceptedOn?: string | null;
}

/**
 * Which documents stop a first shift — read from Joy's credential requirements
 * rather than decided here.
 *
 * This used to be three hard-coded arrays. §6 of the documents spec forbids
 * that: requirements and their scheduling consequences must be configurable to
 * Joy policy and jurisdiction. Worse, hiring's list and the Employees module's
 * list were two separate opinions about the same question, which is exactly how
 * a caregiver ends up cleared by one screen and blocked by another.
 *
 * `blocksSchedulingWhenExpired` is the same flag scheduling reads. If a
 * credential stops somebody taking a shift on day 200, it stops them taking one
 * on day 1.
 */
export function documentsRequiredBeforeFirstShift(
  requirements: readonly CredentialRequirement[],
  role: string,
  drives: boolean,
): string[] {
  return requirements
    .filter((r) => requirementApplies(r, { employeeId: "", role, drives }))
    .filter((r) => r.blocksSchedulingWhenExpired)
    .map((r) => r.credentialType);
}

export function documentsDueSoonAfterHire(
  requirements: readonly CredentialRequirement[],
  role: string,
  drives: boolean,
): string[] {
  return requirements
    .filter((r) => requirementApplies(r, { employeeId: "", role, drives }))
    .filter((r) => !r.blocksSchedulingWhenExpired)
    .map((r) => r.credentialType);
}

export interface FirstShiftReadiness {
  ready: boolean;
  /** Documents that must arrive before any client contact. */
  missingBlocking: string[];
  /** Documents that are due but do not stop a first shift. */
  missingSoon: string[];
}

/**
 * `requirements` defaults to Joy's configured set so existing call sites keep
 * working; pass a different set to evaluate against another policy.
 */
export function firstShiftReadiness(
  applicant: Applicant,
  requirements: readonly CredentialRequirement[] = seedCredentialRequirements,
): FirstShiftReadiness {
  const have = new Set(Object.keys(applicant.documents));
  const role = roleFromApplication(applicant.roleApplied);

  const blocking = documentsRequiredBeforeFirstShift(requirements, role, applicant.drives).filter(
    (key) => !have.has(key),
  );
  const soon = documentsDueSoonAfterHire(requirements, role, applicant.drives).filter(
    (key) => !have.has(key),
  );

  return { ready: blocking.length === 0, missingBlocking: blocking, missingSoon: soon };
}

/** The role a requirement set is keyed on, from the advertised position. */
export function roleFromApplication(roleApplied: string): string {
  if (/LVN/i.test(roleApplied)) return "lvn";
  if (/HHA/i.test(roleApplied)) return "hha";
  if (/CNA|caregiver/i.test(roleApplied)) return "cna";
  return "office";
}

export type TransitionCheck = { allowed: true; reason?: undefined } | { allowed: false; reason: string };

/**
 * Whether an applicant may move to the next hiring stage.
 *
 * The rule that matters: an offer cannot be made before the background check
 * has cleared. Everything else is sequence, which is a discipline; this one is
 * a liability.
 */
export function canAdvanceHiring(applicant: Applicant, to: HiringStage): TransitionCheck {
  if (applicant.track === "no_fit") {
    return { allowed: false, reason: "This applicant is closed. Reopen them before moving them on." };
  }
  if (applicant.track !== "hiring") {
    return { allowed: false, reason: "This applicant has already been hired." };
  }

  const from = HIRING_ORDER.indexOf(applicant.stage);
  const next = HIRING_ORDER.indexOf(to);

  if (next === from) return { allowed: false, reason: "Already at this stage." };
  if (next < from) return { allowed: true };
  if (next > from + 1) {
    return {
      allowed: false,
      reason: `Skips ${HIRING_STAGE_LABELS[HIRING_ORDER[from + 1]]}. Move one stage at a time so nothing is missed.`,
    };
  }

  if (to === "offer" && !applicant.documents.background_check) {
    return {
      allowed: false,
      reason: "The background check has not cleared. An offer cannot be made before it does.",
    };
  }

  return { allowed: true };
}

/**
 * Whether an applicant may move to the next onboarding stage.
 *
 * First shift is the gate. Everything before it is paperwork and instruction;
 * the first shift puts them in somebody's home.
 */
export function canAdvanceOnboarding(applicant: Applicant, to: OnboardingStage): TransitionCheck {
  if (applicant.track !== "onboarding") {
    return { allowed: false, reason: "This applicant is not in onboarding." };
  }

  const from = applicant.onboardingStage ? ONBOARDING_ORDER.indexOf(applicant.onboardingStage) : -1;
  const next = ONBOARDING_ORDER.indexOf(to);

  if (next < from) return { allowed: true };
  if (next > from + 1) {
    return {
      allowed: false,
      reason: `Skips ${ONBOARDING_STAGE_LABELS[ONBOARDING_ORDER[from + 1]]}.`,
    };
  }

  if (to === "first_shift") {
    const readiness = firstShiftReadiness(applicant);
    if (!readiness.ready) {
      return {
        allowed: false,
        reason: `Cannot go out on a shift yet — ${readiness.missingBlocking.length} document${readiness.missingBlocking.length === 1 ? "" : "s"} outstanding.`,
      };
    }
  }

  return { allowed: true };
}

/** Whether onboarding is finished and this person becomes an active employee. */
export function canBecomeActiveEmployee(applicant: Applicant): TransitionCheck {
  if (applicant.track !== "onboarding") {
    return { allowed: false, reason: "This applicant is not in onboarding." };
  }
  if (applicant.onboardingStage !== "week_2") {
    return {
      allowed: false,
      reason: "Onboarding is not finished. The week 2 follow-up is the last step.",
    };
  }
  const readiness = firstShiftReadiness(applicant);
  if (!readiness.ready) {
    return { allowed: false, reason: "Documents are still outstanding." };
  }
  return { allowed: true };
}

/**
 * How long this applicant has been sitting where they are.
 *
 * A pipeline's real failure is not a wrong decision, it is no decision — good
 * applicants take another job while their record sits at "Applied".
 */
export function daysInStage(applicant: Applicant, today: string): number {
  const ms =
    new Date(`${today.slice(0, 10)}T00:00:00Z`).getTime() -
    new Date(`${applicant.stageSince.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * A week in the same stage, on an applicant who is still open.
 *
 * Karynn confirmed seven days on 18 Aug. Worth being precise about what this
 * measures, because it is a proxy rather than the real thing: the clock runs
 * from entering the current STAGE, so it catches records that are not moving,
 * not people who have not been contacted. Ringing somebody who then says "let
 * me think" does not reset it, and moving somebody a stage without ringing them
 * does. Replacing stageSince with a lastContactedAt would fix that; ruled on 18
 * Aug to leave it until the pipeline has been used in anger and it is clear
 * whether the proxy actually misleads.
 */
export const STALE_AFTER_DAYS = 7;

export function isStale(applicant: Applicant, today: string): boolean {
  if (applicant.track === "no_fit" || applicant.track === "hired") return false;
  return daysInStage(applicant, today) >= STALE_AFTER_DAYS;
}

/**
 * The employee record a completed onboarding produces.
 *
 * Deliberately the shape the Employees module already reads, so becoming staff
 * is a conversion rather than a re-entry. The documents collected during hiring
 * become the credential records: the paperwork chased for six weeks IS the
 * compliance record, and re-keying it would be both wasteful and a chance to
 * get it wrong.
 */
export interface HireDetails {
  /** Chosen at the offer, not derivable from the application. */
  title: string;
  role: "cna" | "hha" | "lvn" | "office";
  employmentType: string;
  /** Null for salaried staff. */
  baseRate: number | null;
  weeklyHours: number | null;
  location: string;
  startsOn: string;
}

export interface HiredEmployee {
  id: string;
  name: string;
  title: string;
  role: HireDetails["role"];
  status: "active";
  location: string;
  hiredOn: string;
  employmentType: string;
  baseRate: number | null;
  weeklyHours: number | null;
  drives: boolean;
  phone: string;
  email: string;
  nextShift: null;
  clients: never[];
  kin: null;
  kinLine: null;
  summary: string;
  records: Record<string, DocumentRecord>;
}

export function toEmployee(applicant: Applicant, details: HireDetails): HiredEmployee {
  return {
    id: `emp-${applicant.id.replace(/^app-/, "")}`,
    name: applicant.name,
    title: details.title,
    role: details.role,
    status: "active",
    location: details.location,
    hiredOn: details.startsOn,
    employmentType: details.employmentType,
    baseRate: details.baseRate,
    weeklyHours: details.weeklyHours,
    drives: applicant.drives,
    phone: applicant.phone,
    email: applicant.email,
    nextShift: null,
    clients: [],
    kin: null,
    kinLine: null,
    summary: `Completed onboarding on ${details.startsOn}. Applied ${applicant.appliedOn} via ${applicant.source}.`,
    // Straight across. No dates are invented at this boundary.
    records: { ...applicant.documents },
  };
}
