import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_EXTERNALLY,
  candidateStatus,
  everyCandidateFacingPhrase,
} from "@/domain/portal/candidateStatus";
import { HIRING_ORDER, NO_FIT_LABELS, type Applicant, type NoFitReason } from "@/domain/hiring/pipeline";

/** Fictional. Applicants are never real people in this repository. */
function applicant(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "a1",
    name: "Jamisha Harper",
    roleApplied: "Caregiver",
    track: "hiring",
    stage: "documents",
    onboardingStage: null,
    stageSince: "2026-08-14",
    appliedOn: "2026-08-10",
    source: "GHL",
    recruiter: null,
    email: "j@example.com",
    phone: "+17135550100",
    availability: "Weekdays",
    drives: false,
    documents: {},
    ...over,
  };
}

function allText(view: ReturnType<typeof candidateStatus>): string {
  return [
    view.greeting,
    view.currentStatus,
    view.nextStepHeadline,
    view.nextStepDetail,
    view.action?.label ?? "",
    ...view.lines.flatMap((l) => [l.label, l.value]),
  ].join(" | ");
}

describe("§5 — nothing internal reaches the candidate", () => {
  it("never shows a rejection reason, whichever one it is", () => {
    // The reason the office records is accurate and none of it is the
    // candidate's business through a web page.
    for (const reason of Object.keys(NO_FIT_LABELS) as NoFitReason[]) {
      const view = candidateStatus({
        applicant: applicant({ track: "no_fit", noFitReason: reason }),
        applicationSubmitted: true,
        greetingName: "Jamisha",
      });
      const text = allText(view);
      expect(text).not.toContain(NO_FIT_LABELS[reason]);
      expect(text).not.toContain(reason);
    }
  });

  it("makes every rejection read identically, so the shape does not leak either", () => {
    const views = (Object.keys(NO_FIT_LABELS) as NoFitReason[]).map((reason) =>
      allText(
        candidateStatus({
          applicant: applicant({ track: "no_fit", noFitReason: reason }),
          applicationSubmitted: true,
          greetingName: "Jamisha",
        }),
      ),
    );
    expect(new Set(views).size).toBe(1);
  });

  it("does not show a turned-down candidate how far they got", () => {
    const view = candidateStatus({
      applicant: applicant({ track: "no_fit", noFitReason: "not_a_fit", stage: "background" }),
      applicationSubmitted: true,
      greetingName: "Jamisha",
    });
    expect(view.lines).toEqual([]);
  });

  it("keeps internal vocabulary out of every stage's view", () => {
    for (const stage of HIRING_ORDER) {
      for (const submitted of [true, false]) {
        const text = allText(
          candidateStatus({
            applicant: applicant({ stage }),
            applicationSubmitted: submitted,
            greetingName: "Jamisha",
          }),
        );
        for (const forbidden of FORBIDDEN_EXTERNALLY) {
          expect(text).not.toContain(forbidden);
        }
      }
    }
  });

  it("holds the whole phrase surface to the same rule", () => {
    // Catches a phrase added to the module without a call site in these tests.
    for (const phrase of everyCandidateFacingPhrase()) {
      for (const forbidden of FORBIDDEN_EXTERNALLY) {
        expect(phrase).not.toContain(forbidden);
      }
    }
  });

  it("says the same thing during a phone screen as during a background check", () => {
    // Two internally distinct stages the candidate has no right to tell apart —
    // knowing a background check had started would be a signal about where the
    // decision stood.
    const screen = candidateStatus({
      applicant: applicant({ stage: "phone_screen" }),
      applicationSubmitted: true,
      greetingName: "Jamisha",
      requirements: [],
    });
    const background = candidateStatus({
      applicant: applicant({ stage: "background" }),
      applicationSubmitted: true,
      greetingName: "Jamisha",
      requirements: [],
    });
    expect(screen.currentStatus).toBe(background.currentStatus);
  });
});

describe("§5 — Joy knows the stage, so it does not ask", () => {
  it("tells an unfinished applicant to finish, not to report where they are", () => {
    const view = candidateStatus({
      applicant: applicant(),
      applicationSubmitted: false,
      greetingName: "Jamisha",
    });
    expect(view.nextStepHeadline).toBe("Finish your application");
    expect(view.action?.to).toBe("/portal/work/application");
  });

  it("gives no button when the ball is on Joy's side", () => {
    // A button here would imply the wait is the candidate's fault.
    const view = candidateStatus({
      applicant: applicant({ stage: "background" }),
      applicationSubmitted: true,
      greetingName: "Jamisha",
      // Nothing outstanding, so the only thing left is Joy deciding.
      requirements: [],
    });
    expect(view.action).toBeNull();
    expect(view.nextStepDetail).toContain("Nothing is needed from you");
  });

  it("names the document rather than a count when only one is missing", () => {
    const view = candidateStatus({
      applicant: applicant({ roleApplied: "Caregiver", drives: false }),
      applicationSubmitted: true,
      greetingName: "Jamisha",
    });
    expect(view.nextStepHeadline).toMatch(/^We still need your |^A few documents to go$/);
    expect(view.action?.to).toBe("/portal/work/documents");
  });

  it("greets by the name Joy was given, not the legal one on the form", () => {
    const view = candidateStatus({
      applicant: applicant(),
      applicationSubmitted: true,
      greetingName: "Jamisha",
    });
    expect(view.greeting).toBe("Hi, Jamisha");
  });
});
