import { describe, expect, it } from "vitest";
import {
  HIRING_ORDER,
  REQUIRED_BEFORE_FIRST_SHIFT,
  canAdvanceHiring,
  canAdvanceOnboarding,
  canBecomeActiveEmployee,
  daysInStage,
  firstShiftReadiness,
  isStale,
  type Applicant,
} from "@/domain/hiring/pipeline";

const TODAY = "2026-08-18";

const ALL_DOCS = [
  "background_check",
  "tb_test",
  "licence",
  "cpr",
  "handbook",
  "immunizations",
  "annual_training",
  "drivers_license",
  "auto_insurance",
];

function applicant(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "a1",
    name: "Marisol Ortega",
    roleApplied: "Caregiver — CNA",
    track: "hiring",
    stage: "applied",
    stageSince: "2026-08-16",
    appliedOn: "2026-08-03",
    source: "Indeed",
    recruiter: "John Segura",
    email: "m.ortega@example.com",
    phone: "(713) 555-0142",
    availability: "Weekdays, mornings",
    drives: true,
    documents: [],
    ...over,
  };
}

describe("hiring stages", () => {
  it("moves one stage at a time so nothing is skipped", () => {
    expect(canAdvanceHiring(applicant(), "phone_screen").allowed).toBe(true);
    const skip = canAdvanceHiring(applicant(), "interview");
    expect(skip.allowed).toBe(false);
    expect(skip.reason).toMatch(/Skips Phone screen/);
  });

  it("allows going back a stage without complaint", () => {
    expect(canAdvanceHiring(applicant({ stage: "interview" }), "phone_screen").allowed).toBe(true);
  });

  // Sequence is discipline. This one is liability.
  it("refuses an offer before the background check has cleared", () => {
    const ready = applicant({ stage: "background", documents: ["licence"] });
    const refusal = canAdvanceHiring(ready, "offer");
    expect(refusal.allowed).toBe(false);
    expect(refusal.reason).toMatch(/background check has not cleared/i);

    const cleared = applicant({ stage: "background", documents: ["background_check"] });
    expect(canAdvanceHiring(cleared, "offer").allowed).toBe(true);
  });

  it("will not move a closed applicant without reopening them", () => {
    const closed = applicant({ track: "no_fit", noFitReason: "interview_no_show" });
    const check = canAdvanceHiring(closed, "phone_screen");
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/closed/i);
  });

  it("covers every stage the mockup shows", () => {
    expect(HIRING_ORDER).toEqual([
      "applied",
      "phone_screen",
      "interview",
      "documents",
      "background",
      "offer",
    ]);
  });
});

describe("the first-shift gate", () => {
  it("blocks a first shift until the required documents are in", () => {
    const a = applicant({ track: "onboarding", onboardingStage: "field_orientation", documents: [] });
    const check = canAdvanceOnboarding(a, "first_shift");
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/documents outstanding/i);
  });

  it("lets a fully documented driver go out", () => {
    const a = applicant({
      track: "onboarding",
      onboardingStage: "field_orientation",
      documents: ALL_DOCS,
    });
    expect(canAdvanceOnboarding(a, "first_shift").allowed).toBe(true);
  });

  // A non-driver must not be held up for a licence they will never use.
  it("does not require driving documents from somebody who will not drive", () => {
    const a = applicant({
      drives: false,
      track: "onboarding",
      onboardingStage: "field_orientation",
      documents: [...REQUIRED_BEFORE_FIRST_SHIFT],
    });
    expect(firstShiftReadiness(a).ready).toBe(true);
    expect(canAdvanceOnboarding(a, "first_shift").allowed).toBe(true);
  });

  it("requires them from somebody who will", () => {
    const a = applicant({ drives: true, documents: [...REQUIRED_BEFORE_FIRST_SHIFT] });
    const readiness = firstShiftReadiness(a);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingBlocking).toContain("auto_insurance");
  });

  // Immunisations and training are real but do not stop a first shift.
  it("separates what blocks a shift from what is merely due", () => {
    const a = applicant({ drives: false, documents: [...REQUIRED_BEFORE_FIRST_SHIFT] });
    const readiness = firstShiftReadiness(a);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingSoon).toEqual(["immunizations", "annual_training"]);
  });
});

describe("becoming an active employee", () => {
  it("waits for the last follow-up", () => {
    const midway = applicant({
      track: "onboarding",
      onboardingStage: "first_shift",
      documents: ALL_DOCS,
    });
    expect(canBecomeActiveEmployee(midway).allowed).toBe(false);
    expect(canBecomeActiveEmployee(midway).reason).toMatch(/week 2/i);
  });

  it("completes when onboarding is finished and the documents are in", () => {
    const done = applicant({ track: "onboarding", onboardingStage: "week_2", documents: ALL_DOCS });
    expect(canBecomeActiveEmployee(done).allowed).toBe(true);
  });

  it("refuses to complete with documents still outstanding", () => {
    const gaps = applicant({ track: "onboarding", onboardingStage: "week_2", documents: [] });
    expect(canBecomeActiveEmployee(gaps).allowed).toBe(false);
  });
});

describe("staleness", () => {
  // A pipeline's real failure is not a wrong decision, it is no decision.
  it("counts days sitting in the current stage", () => {
    expect(daysInStage(applicant({ stageSince: "2026-08-11" }), TODAY)).toBe(7);
    expect(daysInStage(applicant({ stageSince: "2026-08-18" }), TODAY)).toBe(0);
  });

  it("flags an applicant who has not moved in a week", () => {
    expect(isStale(applicant({ stageSince: "2026-08-11" }), TODAY)).toBe(true);
    expect(isStale(applicant({ stageSince: "2026-08-16" }), TODAY)).toBe(false);
  });

  it("does not chase closed or hired people", () => {
    expect(isStale(applicant({ stageSince: "2026-01-01", track: "no_fit" }), TODAY)).toBe(false);
    expect(isStale(applicant({ stageSince: "2026-01-01", track: "hired" }), TODAY)).toBe(false);
  });
});
