import { describe, expect, it } from "vitest";
import {
  ADMISSION_STAGES,
  allowedTransitions,
  canTransition,
  checkTransition,
  nextStage,
} from "@/domain/admissions/stages";
import { classifyAdmission } from "@/domain/admissions/classify";
import { buildWorkQueue, countNeedsYou } from "@/domain/workQueue";
import { findDuplicates, normalizePhone, scoreCandidate } from "@/domain/admissions/duplicateCheck";

describe("admission stages", () => {
  it("has the six stages plus closed, and no fifteen-column pipeline", () => {
    expect(ADMISSION_STAGES).toEqual([
      "new_referral",
      "phone_intake",
      "assessment",
      "pre_onboarding",
      "ready_for_admission",
      "admitted",
      "closed",
    ]);
  });

  it("walks the approved path in order", () => {
    expect(nextStage("new_referral")).toBe("phone_intake");
    expect(nextStage("phone_intake")).toBe("assessment");
    expect(nextStage("assessment")).toBe("pre_onboarding");
    expect(nextStage("pre_onboarding")).toBe("ready_for_admission");
    expect(nextStage("ready_for_admission")).toBe("admitted");
    expect(nextStage("admitted")).toBeNull();
  });

  // The failure that matters: admitting someone who was never assessed.
  it("refuses to skip intake or assessment", () => {
    expect(canTransition("new_referral", "admitted")).toBe(false);
    expect(canTransition("new_referral", "assessment")).toBe(false);
    expect(canTransition("phone_intake", "ready_for_admission")).toBe(false);

    const refusal = checkTransition("new_referral", "admitted");
    expect(refusal.allowed).toBe(false);
    if (!refusal.allowed) expect(refusal.reason).toContain("Phone Intake");
  });

  it("allows a correction backwards, because assessment can reveal a gap in intake", () => {
    expect(canTransition("assessment", "phone_intake")).toBe(true);
    expect(checkTransition("assessment", "phone_intake").allowed).toBe(true);
  });

  it("can close from any open stage, but only with a reason", () => {
    for (const stage of ["new_referral", "phone_intake", "assessment", "pre_onboarding"] as const) {
      expect(allowedTransitions(stage)).toContain("closed");
      expect(checkTransition(stage, "closed").allowed).toBe(false);
      expect(checkTransition(stage, "closed", { closeReason: "Chose another agency" }).allowed).toBe(
        true,
      );
    }
  });

  it("will not reopen a closed or admitted record by a stage change", () => {
    expect(allowedTransitions("closed")).toEqual([]);
    expect(allowedTransitions("admitted")).toEqual([]);

    const admitted = checkTransition("admitted", "pre_onboarding");
    expect(admitted.allowed).toBe(false);
    if (!admitted.allowed) expect(admitted.reason).toContain("People");
  });
});

describe("work queue classification", () => {
  it("puts a new referral with nothing booked in front of a person", () => {
    expect(classifyAdmission({ stage: "new_referral", status: "active" })).toBe("needs_you");
  });

  it("moves a record to waiting when someone outside the office holds the next move", () => {
    expect(
      classifyAdmission({
        stage: "pre_onboarding",
        status: "active",
        waitingOn: "family signature",
      }),
    ).toBe("waiting");
  });

  it("moves a record to moving forward once the next milestone is booked", () => {
    expect(
      classifyAdmission({
        stage: "assessment",
        status: "active",
        scheduledAt: "2026-08-17T10:30:00Z",
      }),
    ).toBe("moving_forward");
  });

  // Overdue must outrank a booking, or a missed assessment hides under
  // "Moving Forward" and nobody chases it.
  it("puts an overdue record in Needs You even when something is scheduled", () => {
    expect(
      classifyAdmission({
        stage: "assessment",
        status: "active",
        scheduledAt: "2026-08-10T10:30:00Z",
        overdue: true,
      }),
    ).toBe("needs_you");
  });

  it("treats on hold as waiting, not as action", () => {
    expect(classifyAdmission({ stage: "phone_intake", status: "on_hold" })).toBe("waiting");
  });

  it("builds all three sections even when some are empty", () => {
    const sections = buildWorkQueue(
      [
        { stage: "new_referral", status: "active" } as const,
        { stage: "new_referral", status: "active" } as const,
      ],
      classifyAdmission,
    );

    expect(sections.map((s) => s.group)).toEqual(["needs_you", "waiting", "moving_forward"]);
    expect(countNeedsYou(sections)).toBe(2);
    expect(sections[1].items).toEqual([]);
  });
});

describe("duplicate check", () => {
  const marcus = {
    personId: "p1",
    firstName: "Marcus",
    lastName: "Bell",
    phone: "(713) 555-0134",
    email: "susan.bell@example.com",
    dateOfBirth: "1946-03-02",
    responsiblePartyName: "Susan Bell",
  };

  it("normalizes phone formatting and the US country code", () => {
    expect(normalizePhone("(713) 555-0134")).toBe("7135550134");
    expect(normalizePhone("+1 713 555 0134")).toBe("7135550134");
    expect(normalizePhone(null)).toBe("");
  });

  it("flags the same person entered twice as a strong match", () => {
    const result = findDuplicates(
      { firstName: "Marcus", lastName: "Bell", phone: "713-555-0134" },
      [marcus],
    );
    expect(result.shouldWarn).toBe(true);
    expect(result.best?.strength).toBe("strong");
    expect(result.best?.reasons).toContain("Same phone number");
  });

  it("matches a preferred name against a legal name", () => {
    const result = findDuplicates(
      { firstName: "Marc", lastName: "Bell", phone: "713-555-0134" },
      [marcus],
    );
    expect(result.best?.strength).toBe("strong");
  });

  // Families share a surname and a phone. Two different people in one household
  // must not collapse into one record.
  it("does not treat a different person at the same number as the same person", () => {
    const result = findDuplicates(
      { firstName: "Dolores", lastName: "Vance", phone: "713-555-0134" },
      [marcus],
    );
    expect(result.best).toBeNull();
    expect(result.shouldWarn).toBe(false);
  });

  // Two independent identifiers with a different surname is plausibly the same
  // person after a marriage or a name correction — surface it, but quietly.
  it("surfaces a name mismatch backed by two identifiers as possible", () => {
    const result = findDuplicates(
      {
        firstName: "Marcus",
        lastName: "Bellamy",
        phone: "713-555-0134",
        dateOfBirth: "1946-03-02",
      },
      [marcus],
    );
    expect(result.best?.strength).toBe("possible");
    expect(result.shouldWarn).toBe(false);
  });

  it("treats a common surname alone as possible, not strong", () => {
    const match = scoreCandidate({ firstName: "Marcus", lastName: "Bell" }, marcus);
    expect(match?.strength).toBe("possible");
  });

  it("returns nothing when there is no signal at all", () => {
    const result = findDuplicates(
      { firstName: "Tammy", lastName: "Wilson", phone: "281-555-0199" },
      [marcus],
    );
    expect(result.matches).toEqual([]);
    expect(result.shouldWarn).toBe(false);
  });

  // A second open referral for someone already in the pipeline is the exact
  // failure the spec asks Joy to catch.
  it("always warns when the person already has an open admission", () => {
    const result = findDuplicates({ firstName: "Marcus", lastName: "Bell" }, [
      { ...marcus, openAdmissionStage: "assessment" },
    ]);
    expect(result.shouldWarn).toBe(true);
  });

  it("ranks the best match first", () => {
    const weaker = { personId: "p2", firstName: "Marcus", lastName: "Bell" };
    const result = findDuplicates(
      { firstName: "Marcus", lastName: "Bell", phone: "713-555-0134" },
      [weaker, marcus],
    );
    expect(result.best?.candidate.personId).toBe("p1");
  });
});
