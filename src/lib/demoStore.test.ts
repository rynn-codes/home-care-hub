import { beforeEach, describe, expect, it } from "vitest";
import { loadDemoState, resetDemoState, saveDemoState } from "@/lib/demoStore";
import { ASSESSMENT_QUESTIONS } from "@/domain/assessment/questions";

describe("restricted answers", () => {
  beforeEach(() => {
    resetDemoState();
  });

  // A social security number in localStorage is a real leak, not a demo
  // shortcut: it is unencrypted, unscoped, and survives the visit.
  it("never writes a restricted answer to storage", () => {
    const state = loadDemoState();
    state.assessments["adm-1"] = {
      admissionId: "adm-1",
      answers: { ssn: "123-45-6789", county: "Harris" },
      completedAt: null,
      startedAt: new Date().toISOString(),
    };

    saveDemoState(state);

    expect(window.localStorage.getItem("joy.demo.v1")).not.toContain("123-45-6789");
    expect(loadDemoState().assessments["adm-1"].answers.ssn).toBeUndefined();
    // Everything else still round-trips.
    expect(loadDemoState().assessments["adm-1"].answers.county).toBe("Harris");
  });

  it("keeps the in-memory state intact so the RN does not lose what they typed", () => {
    const state = loadDemoState();
    state.assessments["adm-1"] = {
      admissionId: "adm-1",
      answers: { ssn: "123-45-6789" },
      completedAt: null,
      startedAt: new Date().toISOString(),
    };

    saveDemoState(state);

    expect(state.assessments["adm-1"].answers.ssn).toBe("123-45-6789");
  });

  it("marks the social security number as the restricted field", () => {
    const restricted = ASSESSMENT_QUESTIONS.filter((q) => q.restricted).map((q) => q.id);
    expect(restricted).toContain("ssn");
  });
});
