import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_QUESTIONS,
  PACKET_PAGE_LABELS,
  activeQuestions,
  canCompleteAssessment,
  missingRequired,
  packetCoverage,
  type AssessmentAnswers,
  type PacketPage,
} from "@/domain/assessment/questions";
import { CONSENTS, consentReadiness, declineConsequences } from "@/domain/consents/registry";

/** Answers every required question that is currently active. */
function completeAnswers(): AssessmentAnswers {
  const answers: AssessmentAnswers = {};
  // Two passes, because conditional questions appear once their trigger is set.
  for (let pass = 0; pass < 3; pass += 1) {
    for (const q of activeQuestions(answers)) {
      if (!q.required || answers[q.id] !== undefined) continue;
      answers[q.id] =
        q.kind === "multichoice"
          ? [q.options?.[0].value ?? "x"]
          : q.kind === "number"
            ? 165
            : q.kind === "thresholds"
              ? { bp_low: "70" }
              : q.kind === "choice"
                ? q.options?.[0].value
                : q.kind === "yes_no_copy"
                  ? "no"
                  : "captured";
    }
  }
  return answers;
}

describe("assessment covers the signing packet", () => {
  // The whole point of the module: the RN must not reach the end of the visit
  // and discover the packet cannot be completed.
  it("every packet page is either fed by a question or filled by signing", () => {
    const coverage = packetCoverage(completeAnswers());
    for (const page of coverage) {
      const fed = ASSESSMENT_QUESTIONS.some((q) => q.fills.includes(page.page));
      expect(fed || page.filledBySigning, `${page.label} has no source`).toBe(true);
    }
  });

  it("reports the packet complete once every required question is answered", () => {
    const coverage = packetCoverage(completeAnswers());
    const incomplete = coverage.filter((p) => !p.complete);
    expect(incomplete.map((p) => p.label)).toEqual([]);
  });

  it("names what is missing when the assessment has barely started", () => {
    const coverage = packetCoverage({});
    const incomplete = coverage.filter((p) => !p.complete);
    expect(incomplete.length).toBeGreaterThan(0);
    // The meter must be specific, not just "incomplete".
    expect(incomplete[0].missing.length).toBeGreaterThan(0);
    expect(incomplete[0].missing[0].question).toBeTruthy();
  });

  it("covers every page the packet defines", () => {
    const pages = Object.keys(PACKET_PAGE_LABELS) as PacketPage[];
    expect(pages).toContain("disaster_plan");
    expect(pages).toContain("emergency_care_plan");
    expect(pages).toContain("plan_interventions");
    expect(packetCoverage({}).map((p) => p.page).sort()).toEqual([...pages].sort());
  });

  // Weight and county exist only because the disaster plan needs them. They are
  // easy to drop as "not clinical", and then the hurricane form is unfillable.
  it("collects the disaster-plan fields the packet requires", () => {
    const ids = ASSESSMENT_QUESTIONS.filter((q) => q.fills.includes("disaster_plan")).map((q) => q.id);
    for (const id of ["weight", "county", "next_of_kin", "pharmacy", "evacuation_risk", "high_risk_factors"]) {
      expect(ids, `disaster plan needs ${id}`).toContain(id);
    }
  });
});

describe("conditional questions", () => {
  it("does not ask for limb detail unless a limitation calls for it", () => {
    const ids = activeQuestions({ functional_limitations: ["ambulation"] }).map((q) => q.id);
    expect(ids).not.toContain("limitation_detail");

    const withAmputation = activeQuestions({ functional_limitations: ["amputation"] }).map((q) => q.id);
    expect(withAmputation).toContain("limitation_detail");
  });

  it("asks about blood sugar only when diabetes is in the diagnoses", () => {
    expect(activeQuestions({ diagnoses: "CHF" }).map((q) => q.id)).not.toContain("blood_sugar");
    expect(activeQuestions({ diagnoses: "Type 2 diabetes" }).map((q) => q.id)).toContain("blood_sugar");
  });

  it("asks about oxygen when it is in the home or breathing is limited", () => {
    expect(activeQuestions({ dme: ["oxygen"] }).map((q) => q.id)).toContain("oxygen");
    expect(activeQuestions({ functional_limitations: ["dyspnea"] }).map((q) => q.id)).toContain("oxygen");
    expect(activeQuestions({}).map((q) => q.id)).not.toContain("oxygen");
  });

  it("blocks completion until required questions are answered", () => {
    expect(canCompleteAssessment({})).toBe(false);
    expect(missingRequired({}).length).toBeGreaterThan(0);
    expect(canCompleteAssessment(completeAnswers())).toBe(true);
  });
});

describe("consents", () => {
  it("covers the packet's consent items", () => {
    const keys = CONSENTS.map((c) => c.key);
    for (const k of ["services_and_schedule", "invoicing", "advance_directive", "non_solicitation_agreement", "emergency_care_plan", "disaster_plan"]) {
      expect(keys).toContain(k);
    }
  });

  it("carries the real document text, not a paraphrase", () => {
    const invoicing = CONSENTS.find((c) => c.key === "invoicing");
    expect(invoicing?.fullText).toContain("2.9%");
    expect(invoicing?.fullText).toContain("$100");
    const complaints = CONSENTS.find((c) => c.key === "complaints");
    expect(complaints?.fullText).toContain("1-800-458-9858");
  });

  // Finding F4. The approved design let a client mark all twelve "reviewed" and
  // never let them say no.
  it("requires a decision on every consent before signing, not agreement", () => {
    const decisions: Record<string, "agree"> = {};
    for (const c of CONSENTS) decisions[c.key] = "agree";
    expect(consentReadiness(decisions).canSign).toBe(true);

    const missingOne = { ...decisions };
    delete (missingOne as Record<string, unknown>)[CONSENTS[3].key];
    const readiness = consentReadiness(missingOne);
    expect(readiness.canSign).toBe(false);
    expect(readiness.undecided).toHaveLength(1);
  });

  it("lets a client decline an optional consent and still sign", () => {
    const decisions: Record<string, "agree" | "decline"> = {};
    for (const c of CONSENTS) decisions[c.key] = "agree";
    decisions.transportation = "decline";

    const readiness = consentReadiness(decisions);
    expect(readiness.canSign).toBe(true);
    expect(readiness.optionalDeclines.map((c) => c.key)).toContain("transportation");
  });

  it("stops signing when a mandatory consent is declined", () => {
    const decisions: Record<string, "agree" | "decline"> = {};
    for (const c of CONSENTS) decisions[c.key] = "agree";
    decisions.invoicing = "decline";

    const readiness = consentReadiness(decisions);
    expect(readiness.canSign).toBe(false);
    expect(readiness.blockingDeclines.map((c) => c.key)).toContain("invoicing");
  });

  // Federal law forbids requiring an advance directive as a condition of care.
  it("treats the advance directive as optional", () => {
    const ad = CONSENTS.find((c) => c.key === "advance_directive");
    expect(ad?.mandatory).toBe(false);
    expect(ad?.allowNotApplicable).toBe(true);
  });

  // Recording a refusal is only half the job — it has to reach the people whose
  // work changes because of it.
  it("carries a declined transport consent forward to scheduling", () => {
    const consequences = declineConsequences({ transportation: "decline" });
    expect(consequences.join(" ")).toMatch(/must not drive/i);
    expect(consequences.join(" ")).toMatch(/[Ss]cheduling/);
  });
});
