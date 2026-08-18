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

  // The UI once said "Fifteen things" over a list of sixteen. Counts belong to
  // the data, not to prose.
  it("has a stable count the UI can derive rather than restate", () => {
    expect(CONSENTS.length).toBe(25);
    expect(new Set(CONSENTS.map((c) => c.key)).size).toBe(CONSENTS.length);
  });

  // The registry was first written from a partial reading of the packet and
  // stopped at page 9, which silently dropped nine consents — the photograph
  // authorization and every records/privacy page among them. This test exists so
  // that cannot happen again quietly.
  it("covers the pages a partial reading missed", () => {
    const keys = CONSENTS.map((c) => c.key);
    for (const k of [
      "consent_for_care",
      "customer_rights",
      "documents_reviewed",
      "photograph",
      "disclose_medical_records",
      "obtain_release_medical_records",
      "disclosure_list",
      "hipaa_privacy",
      "bill_of_rights",
    ]) {
      expect(keys, `packet includes ${k}`).toContain(k);
    }
  });

  it("is stored in packet order, so the review walks front to back", () => {
    // First page number each entry cites. The RN turns pages; the list must not
    // make them jump backwards.
    const firstPage = (c: (typeof CONSENTS)[number]) => Number(c.pages.split(/[^0-9]/)[0]);
    const pages = CONSENTS.map(firstPage);
    expect(pages).toEqual([...pages].sort((a, b) => a - b));
    expect(pages[pages.length - 1]).toBe(26);
  });

  // Every consent claims a page. A page beyond the packet means the entry was
  // written from memory rather than from the document.
  it("cites page numbers that exist in a 26-page packet", () => {
    for (const c of CONSENTS) {
      for (const n of c.pages.match(/\d+/g) ?? []) {
        expect(Number(n), `${c.key} cites page ${n}`).toBeLessThanOrEqual(26);
      }
    }
  });

  // Ruled by Karynn on 18 Aug, reviewing the refusability table. The packet only
  // says Joy "may not be able to provide" services without them, and I had
  // hardened that into a hard stop that would have turned clients away.
  it("lets a client refuse the records authorizations and still be admitted", () => {
    const decisions: Record<string, "agree" | "decline"> = {};
    for (const c of CONSENTS) decisions[c.key] = "agree";
    decisions.disclose_medical_records = "decline";
    decisions.obtain_release_medical_records = "decline";

    const readiness = consentReadiness(decisions);
    expect(readiness.canSign).toBe(true);
    expect(readiness.blockingDeclines).toEqual([]);

    const consequences = declineConsequences(decisions).join(" ");
    expect(consequences).toMatch(/cannot request records/i);
    expect(consequences).toMatch(/cannot send their records/i);
  });

  // Exactly these six. Anything else becoming refusable is a decision, not a
  // tidy-up, and should fail here first.
  it("holds the refusable set to the six that were ruled on", () => {
    expect(CONSENTS.filter((c) => !c.mandatory).map((c) => c.key).sort()).toEqual([
      "advance_directive",
      "disclose_medical_records",
      "disclosure_list",
      "obtain_release_medical_records",
      "photograph",
      "transportation",
    ]);
  });

  // The packet says outright that refusing photographs does not affect care.
  it("treats the photograph authorization as refusable", () => {
    const photo = CONSENTS.find((c) => c.key === "photograph");
    expect(photo?.mandatory).toBe(false);
    expect(photo?.fullText).toContain("refusal will not affect my ability to obtain treatment");
  });

  // Karynn, 18 Aug: the deposit means the payment terms are not a surprise, and
  // she covers the sensitive-records page in depth without being prompted.
  it("does not tell the RN things she has corrected", () => {
    const invoicing = CONSENTS.find((c) => c.key === "invoicing");
    expect(invoicing?.watchFor).not.toMatch(/most surprised by later/i);
    expect(invoicing?.watchFor).toMatch(/deposit/i);

    const records = CONSENTS.find((c) => c.key === "disclose_medical_records");
    expect(records?.watchFor).not.toMatch(/HIV/);

    const folder = CONSENTS.find((c) => c.key === "consent_for_care");
    expect(folder?.watchFor).not.toMatch(/until the folder is physically/i);
  });

  // Clients get the office line. The printed page still carries a mobile
  // number, so the spoken script has to override the paper until it is redone.
  it("gives clients the office number, never a direct line", () => {
    const privacy = CONSENTS.find((c) => c.key === "hipaa_privacy");
    expect(privacy?.watchFor).toContain("713 231 9662");
    expect(privacy?.watchFor).not.toContain("713 857 8353");
    for (const c of CONSENTS) {
      expect(c.say, `${c.key} say line`).not.toContain("713 857 8353");
    }
  });

  it("carries the real transportation terms, not a placeholder", () => {
    const transport = CONSENTS.find((c) => c.key === "transportation");
    expect(transport?.fullText).toContain("$0.70 per mile");
    expect(transport?.fullText).toContain("does not provide commercial auto insurance");
  });

  // Declining these changes what the office and the caregiver may do. Recording
  // the refusal without telling anyone is the failure mode.
  it("carries a refused photograph consent and an empty disclosure list forward", () => {
    const photo = declineConsequences({ photograph: "decline" }).join(" ");
    expect(photo).toMatch(/no photographs/i);

    const list = declineConsequences({ disclosure_list: "not_applicable" }).join(" ");
    expect(list).toMatch(/must not discuss/i);
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
