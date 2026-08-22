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
  paymentSetup: "ready",
  carePlanApproved: true,
  requestedDocuments: [],
  startOfCareDate: "2026-08-25",
  billingContactNamed: true,
  rateAgreed: true,
});

describe("admission readiness", () => {
  it("permits admission when everything is in place", () => {
    const check = checkAdmission(ready());
    expect(check.canAdmit).toBe(true);
    expect(check.reason).toBeNull();
  });

  it("names what is outstanding rather than just refusing", () => {
    const check = checkAdmission({ ...ready(), paymentSetup: "not_started" });
    expect(check.canAdmit).toBe(false);
    expect(check.outstanding.map((i) => i.key)).toContain("payment");
    expect(check.reason).toMatch(/not satisfied/);
  });

  it("holds §9.2's five payment states apart, not a boolean", () => {
    // "Not started" and "the card just expired" were both `false` once, and
    // they are opposite situations — one family has not begun, the other
    // finished and needs to be told something broke.
    const fresh = checkAdmission({ ...ready(), paymentSetup: "not_started" });
    const broken = checkAdmission({ ...ready(), paymentSetup: "needs_attention" });
    expect(fresh.items.find((i) => i.key === "payment")!.state).toBe("not_started");
    expect(broken.items.find((i) => i.key === "payment")!.state).toBe("needs_attention");
    expect(broken.canAdmit).toBe(false);
  });

  it("gates on the rate agreement — the first week must be priceable", () => {
    const check = checkAdmission({ ...ready(), rateAgreed: false });
    expect(check.canAdmit).toBe(false);
    expect(check.outstanding.map((i) => i.key)).toContain("rate");
  });

  it("gates on a billing contact — the invoice needs somewhere to go", () => {
    expect(checkAdmission({ ...ready(), billingContactNamed: false }).canAdmit).toBe(false);
  });

  it("counts requested documents only when some are outstanding", () => {
    const waiting = checkAdmission({
      ...ready(),
      requestedDocuments: [
        { label: "Medication list", outstanding: true },
        { label: "Insurance card", outstanding: false },
      ],
    });
    expect(waiting.canAdmit).toBe(false);
    expect(waiting.items.find((i) => i.key === "documents")!.detail).toContain("Medication list");

    const arrived = checkAdmission({
      ...ready(),
      requestedDocuments: [{ label: "Medication list", outstanding: false }],
    });
    expect(arrived.canAdmit).toBe(true);
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

describe("the documented exception", () => {
  // §4.2: ready_for_admission is computed from gates, never selected by hand
  // without an override reason and an audit entry. The override is data — a
  // reason, a name, a time — and the caller writes the audit entry.

  const override = { reason: "Family signs the packet at the first visit on Monday.", byUserId: "u-karynn", at: "2026-08-22T09:00:00Z" };

  it("lets a named reason carry admission past an unsatisfied gate", () => {
    const check = checkAdmission({ ...ready(), packetSigned: false, override });
    expect(check.canAdmit).toBe(true);
    expect(check.overridden).toBe(true);
    // The gate stays visible: an exception explains a decision, it does not
    // tidy one away.
    expect(check.items.find((i) => i.key === "signature")!.state).toBe("needs_action");
  });

  it("refuses an exception with no reason in it", () => {
    const blank = { ...override, reason: "   " };
    expect(checkAdmission({ ...ready(), packetSigned: false, override: blank }).canAdmit).toBe(false);
  });

  it("cannot step past a refused mandatory consent", () => {
    // A missing signature is a delay; a refused consent is a refusal of the
    // terms care is offered on. No exception admits somebody who said no.
    const decisions = { ...allAgreed(), invoicing: "decline" as const };
    const check = checkAdmission({ ...ready(), consentDecisions: decisions, override });
    expect(check.canAdmit).toBe(false);
    expect(check.reason).toMatch(/cannot be documented past a refused consent/);
  });

  it("changes nothing when every gate is already satisfied", () => {
    const check = checkAdmission({ ...ready(), override });
    expect(check.canAdmit).toBe(true);
    expect(check.overridden).toBe(false);
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
