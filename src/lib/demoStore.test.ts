import { beforeEach, describe, expect, it } from "vitest";
import { loadDemoState, resetDemoState, saveDemoState } from "@/lib/demoStore";
import { ASSESSMENT_QUESTIONS } from "@/domain/assessment/questions";
import { TEST_SIGNATURE_DOCUMENT } from "@/lib/documentsSeed";

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

describe("seeded documents", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("starts with the test document for trying signatures, named as a test", () => {
    const doc = loadDemoState().documents.find((d) => d.id === TEST_SIGNATURE_DOCUMENT.id);
    expect(doc?.name).toMatch(/^TEST/);
  });

  it("adds a seed document to a browser that saved its state before the seed existed", () => {
    const state = loadDemoState();
    state.documents = state.documents.filter((d) => d.id !== TEST_SIGNATURE_DOCUMENT.id);
    saveDemoState(state);

    expect(loadDemoState().documents.map((d) => d.id)).toContain(TEST_SIGNATURE_DOCUMENT.id);
  });

  it("does not bring back a seed document the office deleted", () => {
    const state = loadDemoState();
    state.documents = state.documents.filter((d) => d.id !== TEST_SIGNATURE_DOCUMENT.id);
    state.retiredSeedDocumentIds = [TEST_SIGNATURE_DOCUMENT.id];
    saveDemoState(state);

    expect(loadDemoState().documents.map((d) => d.id)).not.toContain(TEST_SIGNATURE_DOCUMENT.id);
  });
});
