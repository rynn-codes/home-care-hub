import type { E164 } from "@/domain/portal/phone";
import type { HiringStage, OnboardingStage } from "@/domain/hiring/pipeline";

/**
 * Who the portal is talking to, and what it should show them first.
 *
 * §30 is the whole product rule: "Joy knows who you are, knows where you are in
 * the process, and shows you the one thing you need next." This file is that
 * sentence as code. It is also the file that decides §29's "role routing".
 *
 * TWO AUDIENCES, NOT FIVE
 *
 * §6 and §7 are emphatic — "Do not create another onboarding account", "No new
 * account. No new employee app login." A candidate, an onboarding hire and a
 * caregiver of six years are the same identity in the same portal; what changes
 * is its state. Modelling them as three audiences would invite three login
 * screens and three sets of routing, which is the mistake those sections are
 * warning against. So there are two audiences — workforce and family — and a
 * state within each.
 *
 * ONE PERSON, MANY ROLES
 *
 * `0001_foundation.sql` opens by insisting a daughter who is her father's
 * responsible party and later applies as a caregiver is ONE row in people.
 * Phone login means that person now types one number and could land in either
 * portal. Joy does not guess: `resolvePortal` returns every grant it found and
 * the caller asks. Guessing would show a caregiver her father's care plan
 * because she happened to be on shift, or hide her father's schedule because
 * she happened to be staff.
 */

export type PortalAudience = "workforce" | "family";

export const AUDIENCE_LABELS: Record<PortalAudience, string> = {
  workforce: "My work at Joy",
  family: "My family member's care",
};

/**
 * Where a workforce portal user stands. §5, §6 and §7 in order.
 *
 * `invited` is the state §2 creates: Joy has decided, after the in-person
 * interview, to move this candidate forward, and nothing has been filled in
 * yet.
 */
export type WorkforceState =
  | "invited"
  | "application"
  | "documents"
  | "under_review"
  | "onboarding"
  | "active"
  | "closed";

/** Where a family portal user stands. §19, §20 and §23. */
export type FamilyState = "pre_admission" | "active" | "closed";

export type PortalState = WorkforceState | FamilyState;

/**
 * One person's right to one portal. A person may hold two.
 *
 * `personId` is the `people.id` this grant hangs off — the same row the admin
 * side reads, never a copy. §26: do not fork shared data.
 */
export interface PortalGrant {
  audience: PortalAudience;
  personId: string;
  /** Whose care this is, for a family grant. Null for workforce. */
  subjectPersonId: string | null;
  /** How the person is greeted. Preferred name if Joy has one. */
  greetingName: string;
  /** Whose care, by name, for disambiguating two family grants. */
  subjectName: string | null;
  state: PortalState;
  /** Revoked grants are kept so history survives; they never route anywhere. */
  active: boolean;
}

/** A verified phone plus everything it turned out to unlock. */
export interface PortalIdentity {
  phone: E164;
  grants: PortalGrant[];
  verifiedAt: string;
}

// ------------------------------------------------------------- resolution --

export type ResolutionOutcome = "one" | "choose" | "none";

export interface PortalResolution {
  outcome: ResolutionOutcome;
  /** Set only when exactly one active grant was found. */
  grant: PortalGrant | null;
  /** Every active grant, for the picker. */
  choices: PortalGrant[];
  route: string | null;
}

export function portalRoute(grant: PortalGrant): string {
  return grant.audience === "workforce" ? "/portal/work" : "/portal/care";
}

/**
 * Turn a verified phone into a destination, or into a question.
 *
 * `none` is a real outcome and not an error. A number can verify and grant
 * nothing: a candidate Joy decided against, a discharged client's daughter, a
 * former employee. They are told the truth — Joy has nothing open for them —
 * and given the office number, rather than being left on a spinner.
 */
export function resolvePortal(identity: PortalIdentity): PortalResolution {
  const active = identity.grants.filter((g) => g.active);

  if (active.length === 0) {
    return { outcome: "none", grant: null, choices: [], route: null };
  }
  if (active.length === 1) {
    return { outcome: "one", grant: active[0], choices: active, route: portalRoute(active[0]) };
  }
  return { outcome: "choose", grant: null, choices: active, route: null };
}

// -------------------------------------------------------------- next step --

/**
 * The one thing to do next, per §30 — plus the honest possibility that there
 * is nothing to do, which most days there will not be.
 *
 * `action` is null when the ball is on Joy's side. §5 is explicit that a
 * candidate under review should be told "We're reviewing your information",
 * not handed a button; a button implies the wait is their fault.
 */
export interface NextStep {
  headline: string;
  detail: string;
  action: { label: string; to: string } | null;
}

export interface WorkforceContext {
  state: WorkforceState;
  hiringStage: HiringStage | null;
  onboardingStage: OnboardingStage | null;
  /** Required documents still missing or expired. Names, not counts. */
  outstandingDocuments: string[];
  /** Visits scheduled for today, if any. */
  visitsToday: number;
  nextVisitLabel: string | null;
}

export function workforceNextStep(ctx: WorkforceContext): NextStep {
  switch (ctx.state) {
    case "invited":
      return {
        headline: "Start your application",
        detail: "It takes about ten minutes and saves as you go, so you can stop and come back.",
        action: { label: "Start application", to: "/portal/work/application" },
      };

    case "application":
      return {
        headline: "Finish your application",
        detail: "Your answers are saved. Pick up where you left off.",
        action: { label: "Continue application", to: "/portal/work/application" },
      };

    case "documents": {
      const [first] = ctx.outstandingDocuments;
      return {
        headline: first ? `Upload your ${first}` : "Upload your documents",
        detail:
          ctx.outstandingDocuments.length > 1
            ? `${ctx.outstandingDocuments.length} documents still to come. A clear photo is fine.`
            : "A clear photo from your phone is fine.",
        action: { label: "Upload document", to: "/portal/work/documents" },
      };
    }

    case "under_review":
      // §5: Joy holds the ball here, and says so.
      return {
        headline: "We're reviewing your information",
        detail: "Nothing is needed from you. We'll let you know as soon as something changes.",
        action: null,
      };

    case "onboarding": {
      const [first] = ctx.outstandingDocuments;
      if (first) {
        return {
          headline: `One credential still needs attention: ${first}`,
          detail: "This is the last thing between you and your first shift.",
          action: { label: "Complete next step", to: "/portal/work/documents" },
        };
      }
      return {
        headline: "You're almost ready",
        detail: "Your documents are in. The office will confirm your orientation date.",
        action: null,
      };
    }

    case "active":
      if (ctx.visitsToday > 0 && ctx.nextVisitLabel) {
        return {
          headline: ctx.nextVisitLabel,
          detail: "Start the visit when you arrive.",
          action: { label: "Start visit", to: "/portal/work/schedule" },
        };
      }
      if (ctx.outstandingDocuments.length > 0) {
        return {
          headline: `${ctx.outstandingDocuments[0]} needs renewing`,
          detail: "Renew it before it expires so your shifts are not interrupted.",
          action: { label: "Renew", to: "/portal/work/documents" },
        };
      }
      return {
        headline: "Nothing needs you right now",
        detail: "Your schedule is up to date.",
        action: null,
      };

    case "closed":
      return {
        headline: "This portal is closed",
        detail: "If you think that is wrong, call the office at (713) 231-9662.",
        action: null,
      };
  }
}

export interface FamilyContext {
  state: FamilyState;
  subjectName: string;
  /** Documents the office has asked this family for. §21. */
  requestedDocuments: string[];
  /** Consents and agreements waiting on a signature. §22. */
  awaitingSignature: string[];
  startOfCare: string | null;
  nextVisitLabel: string | null;
}

export function familyNextStep(ctx: FamilyContext): NextStep {
  if (ctx.state === "closed") {
    return {
      headline: "This portal is closed",
      detail: "If you think that is wrong, call the office at (713) 231-9662.",
      action: null,
    };
  }

  // A signature blocks care starting, so it comes before a document request.
  if (ctx.awaitingSignature.length > 0) {
    const [first] = ctx.awaitingSignature;
    return {
      headline: `${first} needs your signature`,
      detail: "Read it through — you can ask us anything before you sign.",
      action: { label: "Review & sign", to: "/portal/care/documents" },
    };
  }

  if (ctx.requestedDocuments.length > 0) {
    const [first] = ctx.requestedDocuments;
    return {
      headline: `Please upload ${ctx.subjectName}'s ${first}`,
      detail: "A photo of each page is fine.",
      action: { label: "Upload document", to: "/portal/care/documents" },
    };
  }

  if (ctx.state === "pre_admission") {
    return {
      headline: ctx.startOfCare
        ? `Care starts ${ctx.startOfCare}`
        : "We're getting everything ready",
      detail: "Nothing is needed from you right now.",
      action: null,
    };
  }

  return {
    headline: ctx.nextVisitLabel ?? "No visit scheduled today",
    detail: ctx.nextVisitLabel
      ? "You'll see a note here after the visit."
      : "Your next visits are on the schedule.",
    action: { label: "View schedule", to: "/portal/care/schedule" },
  };
}
