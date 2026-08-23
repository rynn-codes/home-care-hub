import { describe, expect, it } from "vitest";
import {
  GHL_RECEIVED_EVENTS,
  GHL_SENT_EVENTS,
  effectOfGhlEvent,
  ghlStatusFor,
} from "@/domain/hiring/ghlEvents";
import type { Applicant } from "@/domain/hiring/pipeline";

function applicant(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "app-1",
    name: "Emily Rodriguez",
    roleApplied: "Caregiver",
    track: "hiring",
    stage: "documents",
    stageSince: "2026-08-20",
    appliedOn: "2026-08-10",
    source: "Indeed",
    recruiter: "GHL",
    email: "e@example.com",
    phone: "+17135550100",
    availability: "Weekdays",
    drives: true,
    documents: {},
    ...over,
  };
}

describe("the GHL vocabulary is the roadmap's, both directions", () => {
  it("receives the seven and sends the six", () => {
    expect(GHL_RECEIVED_EVENTS).toHaveLength(7);
    expect(GHL_SENT_EVENTS).toHaveLength(6);
    expect(GHL_RECEIVED_EVENTS).toContain("candidate_moving_forward");
    expect(GHL_SENT_EVENTS).toContain("hiring_closed");
  });

  it("a webhook is nobody's confirmation — effects are suggestions", () => {
    // "Human confirmation is required before consequential actions."
    const attended = effectOfGhlEvent("interview_attended");
    expect(attended.kind).toBe("suggest");

    const noShow = effectOfGhlEvent("interview_no_show");
    expect(noShow.kind).toBe("suggest");
    if (noShow.kind === "suggest") {
      // "No-shows must remain documented."
      expect(noShow.note).toContain("documented");
    }
  });

  it("Move Forward is the handoff, and only Move Forward", () => {
    expect(effectOfGhlEvent("candidate_moving_forward").kind).toBe("begin_joy_workflow");
    expect(effectOfGhlEvent("interview_scheduled").kind).toBe("document");
  });

  it("tells GHL one story per stage, so recruiter and office never disagree", () => {
    expect(ghlStatusFor(applicant({ stage: "documents" }))).toBe("documents_requested");
    expect(ghlStatusFor(applicant({ stage: "decision" }))).toBe("ready_for_offer");
    expect(ghlStatusFor(applicant({ track: "no_fit", noFitReason: "interview_no_show" }))).toBe(
      "hiring_closed",
    );
    expect(ghlStatusFor(applicant({ track: "onboarding", onboardingStage: "gusto_onboarding" }))).toBe(
      "offer_accepted",
    );
  });
});
