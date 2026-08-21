import { describe, expect, it } from "vitest";
import { seedAssessments, seedConsentSessions, seedIntakes } from "@/lib/admissionProgressSeed";
import { seedAdmissions } from "@/lib/admissionsSeed";
import { canCompleteAssessment, missingRequired } from "@/domain/assessment/questions";
import { canCompleteIntake } from "@/domain/admissions/intake";
import { admissionIsMovingForward } from "@/domain/admissions/classify";
import { canInviteFamily } from "@/domain/hiring/invitation";
import { canWitnessSignature } from "@/domain/consents/witness";

const PAST_ASSESSMENT = ["pre_onboarding", "ready_for_admission", "admitted"];

describe("the seeded admissions agree with their own stage", () => {
  // The defect this file was written for: the board said "Pre-Onboarding ·
  // assessment completed Aug 12" and the review screen for the same record said
  // nobody had been out yet. One fact in two places, and the screen a person
  // actually opens was the wrong one.

  it("gives every admission past the assessment a complete one", () => {
    for (const admission of seedAdmissions.filter((a) => PAST_ASSESSMENT.includes(a.stage))) {
      const seeded = seedAssessments[admission.id];
      expect(seeded, `${admission.name} is at ${admission.stage} with no assessment`).toBeDefined();

      const missing = missingRequired(seeded.answers).map((q) => q.id);
      expect(missing, `${admission.name}: unanswered required questions`).toEqual([]);
      expect(canCompleteAssessment(seeded.answers)).toBe(true);
    }
  });

  it("gives every admission past intake a complete one", () => {
    for (const admission of seedAdmissions.filter((a) => a.stage !== "new_referral" && a.stage !== "phone_intake")) {
      const seeded = seedIntakes[admission.id];
      expect(seeded, `${admission.name} has no intake`).toBeDefined();
      expect(canCompleteIntake(seeded.answers)).toBe(true);
    }
  });

  it("leaves an admission that has not got there yet alone", () => {
    // A new referral with a completed assessment would be a worse demo than an
    // empty one: it would make the gates look like decoration.
    for (const admission of seedAdmissions.filter((a) => a.stage === "new_referral")) {
      expect(seedAssessments[admission.id]).toBeUndefined();
      expect(seedIntakes[admission.id]).toBeUndefined();
    }
  });

  it("opens §19's family-portal gate for exactly the admissions that have earned it", () => {
    for (const admission of seedAdmissions) {
      const answers = seedAssessments[admission.id]?.answers ?? {};
      const phone = seedIntakes[admission.id]?.answers.caller_phone;

      const check = canInviteFamily({
        assessmentComplete: canCompleteAssessment(answers),
        movingForward: admissionIsMovingForward(admission),
        phone: typeof phone === "string" ? phone : null,
        existing: null,
        asOf: "2026-08-21",
      });

      // Moving forward and assessed means the link can go out; anything else
      // gets a sentence saying which gate is closed, never a bare refusal.
      const shouldBeOpen =
        PAST_ASSESSMENT.includes(admission.stage) && admission.status === "active";
      expect(check.eligible, `${admission.name} (${admission.stage}/${admission.status})`).toBe(
        shouldBeOpen,
      );
      if (!check.eligible) expect(check.reason).toBeTruthy();
    }
  });
});

describe("a signed packet where the stage claims one", () => {
  it("signs for ready-for-admission and admitted, and nobody else", () => {
    for (const admission of seedAdmissions) {
      const signed = Boolean(seedConsentSessions[admission.id]?.signedAt);
      const shouldBeSigned =
        admission.stage === "ready_for_admission" || admission.stage === "admitted";
      expect(signed, `${admission.name} at ${admission.stage}`).toBe(shouldBeSigned);
    }
  });

  it("leaves the two waiting on a signature waiting", () => {
    // Susan's headline is "agreement ready for your review" and Evelyn's is
    // "waiting on family signature". Seeding a signature over those would erase
    // the one state the signing flow exists for.
    for (const admission of seedAdmissions.filter((a) => a.stage === "pre_onboarding")) {
      expect(seedConsentSessions[admission.id]).toBeUndefined();
    }
  });

  it("is witnessed by somebody allowed to take a signature", () => {
    // The packet's own rule: an RN or the owner, nobody else.
    for (const session of Object.values(seedConsentSessions)) {
      expect(
        canWitnessSignature(session.witnessRole),
        `${session.witnessName} may take a signature`,
      ).toBe(true);
    }
  });

  it("carries a real refusal, so the client record has something to show", () => {
    // A packet where everything was agreed proves nothing about the screens
    // that exist to carry a refusal to a caregiver.
    for (const session of Object.values(seedConsentSessions)) {
      expect(Object.values(session.decisions)).toContain("decline");
    }
  });
});
