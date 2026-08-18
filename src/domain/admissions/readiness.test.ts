import { describe, expect, it } from "vitest";
import { checkAdmission, startOfCareRestrictions, type AdmissionInputs } from "@/domain/admissions/readiness";
import { CONSENTS } from "@/domain/consents/registry";

const allAgreed = () => {
  const d: Record<string, "agree"> = {};
  for (const c of CONSENTS) d[c.key] = "agree";
  return d;
};

const ready = (): AdmissionInputs => ({
  intakeComplete: true,
  assessmentComplete: true,
  consentDecisions: allAgreed(),
  packetSigned: true,
  paymentSetUp: true,
  carePlanApproved: true,
});

describe("admission readiness", () => {
  it("permits admission when everything is in place", () => {
    const check = checkAdmission(ready());
    expect(check.canAdmit).toBe(true);
    expect(check.reason).toBeNull();
  });

  it("names what is outstanding rather than just refusing", () => {
    const check = checkAdmission({ ...ready(), paymentSetUp: false });
    expect(check.canAdmit).toBe(false);
    expect(check.outstanding.map((i) => i.key)).toContain("payment");
    expect(check.reason).toMatch(/outstanding/);
  });

  // A declined mandatory consent is a different thing from a missing document.
  // One ends the admission; the other delays it. Saying so is the point.
  it("distinguishes a blocking decline from an outstanding item", () => {
    const decisions = { ...allAgreed(), invoicing: "decline" as const };
    const check = checkAdmission({ ...ready(), consentDecisions: decisions });

    expect(check.canAdmit).toBe(false);
    expect(check.blocked).toHaveLength(1);
    expect(check.reason).toMatch(/ends the admission/);
  });

  it("does not block on an optional consent being declined", () => {
    const decisions = { ...allAgreed(), transportation: "decline" as const };
    expect(checkAdmission({ ...ready(), consentDecisions: decisions }).canAdmit).toBe(true);
  });

  it("blocks while consent decisions are incomplete", () => {
    const partial = { ...allAgreed() };
    delete (partial as Record<string, unknown>).complaints;
    const check = checkAdmission({ ...ready(), consentDecisions: partial });
    expect(check.canAdmit).toBe(false);
  });
});

describe("start of care", () => {
  // The caregiver arriving on day one needs to know what was refused. A decline
  // recorded in a packet nobody reads is not a control.
  it("turns declined optional consents into caregiver restrictions", () => {
    const decisions = { ...allAgreed(), transportation: "decline" as const };
    const restrictions = startOfCareRestrictions(decisions);
    expect(restrictions.join(" ")).toMatch(/Driving them places/);
    expect(restrictions.join(" ")).toMatch(/must not/i);
  });

  it("lists nothing when the client agreed to everything", () => {
    expect(startOfCareRestrictions(allAgreed())).toEqual([]);
  });
});
