import { describe, expect, it } from "vitest";
import {
  HIRING_ORDER,
  toEmployee,
  documentsRequiredBeforeFirstShift,
  canAdvanceHiring,
  canAdvanceOnboarding,
  canBecomeActiveEmployee,
  daysInStage,
  firstShiftReadiness,
  isStale,
  type Applicant,
} from "@/domain/hiring/pipeline";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";

const TODAY = "2026-08-18";

/** Every document, all comfortably in date. */
const ALL_DOCS = docs([
  "background_check",
  "tb_test",
  "licence",
  "cpr",
  "handbook",
  "immunizations",
  "annual_training",
  "drivers_license",
  "auto_insurance",
]);

function docs(keys: readonly string[]): Applicant["documents"] {
  return Object.fromEntries(
    keys.map((k) => [k, { issued: "2026-07-01", expires: "2027-07-01" }]),
  );
}

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
    documents: {},
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
    const ready = applicant({ stage: "background", documents: docs(["licence"]) });
    const refusal = canAdvanceHiring(ready, "offer");
    expect(refusal.allowed).toBe(false);
    expect(refusal.reason).toMatch(/background check has not cleared/i);

    const cleared = applicant({ stage: "background", documents: docs(["background_check"]) });
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
    const a = applicant({ track: "onboarding", onboardingStage: "field_orientation", documents: {} });
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
      documents: docs(documentsRequiredBeforeFirstShift(seedCredentialRequirements, "cna", false)),
    });
    expect(firstShiftReadiness(a).ready).toBe(true);
    expect(canAdvanceOnboarding(a, "first_shift").allowed).toBe(true);
  });

  it("requires them from somebody who will", () => {
    // Everything a non-driver needs, which is short of what a driver needs.
    const a = applicant({ drives: true, documents: docs(documentsRequiredBeforeFirstShift(seedCredentialRequirements, "cna", false)) });
    const readiness = firstShiftReadiness(a);
    expect(readiness.ready).toBe(false);
    expect(readiness.missingBlocking).toContain("auto_insurance");
  });

  // A BEHAVIOUR CHANGE worth stating. Hiring used to block a first shift on the
  // signed handbook; Joy's credential requirements mark the handbook as not
  // blocking scheduling, and hiring now reads that same flag. So the handbook is
  // chased rather than a barrier.
  //
  // The consistency is the point: two different answers to "does the handbook
  // stop this person working" was the bug. If Karynn wants it to block, the fix
  // is one flag in credentialRequirementsSeed, and it then blocks everywhere.
  it("separates what blocks a shift from what is merely due", () => {
    const a = applicant({ drives: false, documents: docs(documentsRequiredBeforeFirstShift(seedCredentialRequirements, "cna", false)) });
    const readiness = firstShiftReadiness(a);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingSoon).toEqual(["handbook", "immunizations", "annual_training"]);
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
    const gaps = applicant({ track: "onboarding", onboardingStage: "week_2", documents: {} });
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

describe("becoming an employee", () => {
  const details = {
    title: "Field caregiver",
    role: "cna" as const,
    employmentType: "Full-time · hourly",
    baseRate: 19.5,
    weeklyHours: 36,
    location: "Houston · Memorial",
    startsOn: "2026-08-24",
  };

  // The paperwork chased for six weeks IS the compliance record. Re-keying it
  // would be wasteful and a chance to get it wrong; inventing expiry dates at
  // this boundary would put fiction into the clock on somebody's first day.
  it("carries the hiring documents across as credential records, dates intact", () => {
    const a = applicant({ track: "onboarding", onboardingStage: "week_2", documents: ALL_DOCS });
    const employee = toEmployee(a, details);
    expect(employee.records).toEqual(ALL_DOCS);
    expect(employee.records.cpr.expires).toBe("2027-07-01");
  });

  it("keeps the person's own details and takes the rest from the offer", () => {
    const a = applicant({ track: "onboarding", onboardingStage: "week_2", documents: ALL_DOCS });
    const employee = toEmployee(a, details);
    expect(employee.name).toBe(a.name);
    expect(employee.phone).toBe(a.phone);
    expect(employee.drives).toBe(a.drives);
    expect(employee.baseRate).toBe(19.5);
    expect(employee.hiredOn).toBe("2026-08-24");
    expect(employee.status).toBe("active");
  });

  it("starts with no clients and no shift booked", () => {
    const employee = toEmployee(
      applicant({ track: "onboarding", onboardingStage: "week_2", documents: ALL_DOCS }),
      details,
    );
    expect(employee.clients).toEqual([]);
    expect(employee.nextShift).toBeNull();
  });

  it("derives a stable employee id from the applicant", () => {
    const employee = toEmployee(applicant({ id: "app-ortega" }), details);
    expect(employee.id).toBe("emp-ortega");
  });
});
