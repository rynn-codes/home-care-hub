import { describe, expect, it } from "vitest";
import {
  auditReadiness,
  evaluateRequirement,
  needsAttention,
  requirementApplies,
  schedulingEligibility,
  warningThresholdCrossed,
  type EmployeeContext,
} from "@/domain/credentials/compliance";
import type { CredentialRequirement, EmployeeCredential } from "@/domain/documents/types";

const ASOF = "2026-08-18";

function requirement(over: Partial<CredentialRequirement> = {}): CredentialRequirement {
  return {
    credentialType: "cpr_bls",
    displayName: "CPR/BLS",
    folderType: "credentials_licenses",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    blocksSchedulingWhenExpired: true,
    warningDays: [90, 60, 30, 14, 7],
    active: true,
    ...over,
  };
}

function credential(over: Partial<EmployeeCredential> = {}): EmployeeCredential {
  return {
    id: "cred-1",
    employeeId: "emp-1",
    credentialType: "cpr_bls",
    status: "current",
    expiresAt: "2027-06-01",
    verificationStatus: "verified",
    ...over,
  };
}

const caregiver: EmployeeContext = { employeeId: "emp-1", role: "cna", drives: true };

describe("requirements are data, not branches", () => {
  it("skips a driving requirement for somebody who does not drive", () => {
    const r = requirement({ credentialType: "auto_insurance", requiredForDriving: true });
    expect(requirementApplies(r, caregiver)).toBe(true);
    expect(requirementApplies(r, { ...caregiver, drives: false })).toBe(false);
  });

  it("applies a role-scoped requirement only to those roles", () => {
    const r = requirement({ requiredForRoles: ["cna", "hha"] });
    expect(requirementApplies(r, caregiver)).toBe(true);
    expect(requirementApplies(r, { ...caregiver, role: "office" })).toBe(false);
  });

  it("treats an empty role list as applying to everyone", () => {
    expect(requirementApplies(requirement({ requiredForRoles: [] }), { ...caregiver, role: "hr" })).toBe(true);
  });

  it("ignores a retired requirement entirely", () => {
    expect(requirementApplies(requirement({ active: false }), caregiver)).toBe(false);
  });
});

describe("warning points", () => {
  // §13 wants idempotent notifications, so the crossed point is returned rather
  // than a bare boolean — the caller remembers which one it already sent.
  it("returns the tightest point crossed, not merely that one was", () => {
    const r = requirement({ warningDays: [90, 60, 30, 14, 7] });
    expect(warningThresholdCrossed(r, 75)).toBe(90);
    expect(warningThresholdCrossed(r, 29)).toBe(30);
    expect(warningThresholdCrossed(r, 3)).toBe(7);
    expect(warningThresholdCrossed(r, 120)).toBeNull();
  });

  it("honours a requirement's own points rather than a global default", () => {
    expect(warningThresholdCrossed(requirement({ warningDays: [10] }), 40)).toBeNull();
    expect(warningThresholdCrossed(requirement({ warningDays: [10] }), 9)).toBe(10);
  });
});

describe("evaluating one requirement", () => {
  it("reports a credential nobody has supplied as missing, with an action", () => {
    const o = evaluateRequirement(requirement(), undefined, ASOF);
    expect(o.status).toBe("missing");
    expect(o.blocksScheduling).toBe(true);
    expect(o.action).toMatch(/^Request/);
  });

  // §10. Extracted is not verified, and must not count as compliant.
  it("does not count an unverified credential as current", () => {
    const o = evaluateRequirement(requirement(), credential({ verificationStatus: "ai_extracted" }), ASOF);
    expect(o.status).toBe("pending_review");
    expect(o.action).toMatch(/^Verify/);
  });

  it("counts an unverified credential as current when verification is not required", () => {
    const r = requirement({ verificationRequired: false });
    const o = evaluateRequirement(r, credential({ verificationStatus: "unverified" }), ASOF);
    expect(o.status).toBe("current");
  });

  it("treats a rejected credential as blocking, not merely pending", () => {
    const o = evaluateRequirement(requirement(), credential({ verificationStatus: "rejected" }), ASOF);
    expect(o.status).toBe("rejected");
    expect(o.blocksScheduling).toBe(true);
  });

  it("flags an expired credential with what to do about it", () => {
    const o = evaluateRequirement(requirement(), credential({ expiresAt: "2026-02-01" }), ASOF);
    expect(o.status).toBe("expired");
    expect(o.action).toMatch(/take them off the schedule/i);
  });

  it("warns inside the window and stays quiet outside it", () => {
    expect(evaluateRequirement(requirement(), credential({ expiresAt: "2026-09-01" }), ASOF).status).toBe("expiring");
    expect(evaluateRequirement(requirement(), credential({ expiresAt: "2027-06-01" }), ASOF).status).toBe("current");
  });

  // A card with no expiry is not a record of anything.
  it("treats a missing or unreadable expiry as missing, not current", () => {
    expect(evaluateRequirement(requirement(), credential({ expiresAt: null }), ASOF).status).toBe("missing");
    expect(evaluateRequirement(requirement(), credential({ expiresAt: "nonsense" }), ASOF).status).toBe("missing");
  });

  it("skips expiry entirely for a requirement that does not expire", () => {
    const r = requirement({ credentialType: "background_check", expirationRequired: false });
    const o = evaluateRequirement(r, credential({ expiresAt: null }), ASOF);
    expect(o.status).toBe("current");
  });
});

describe("audit readiness", () => {
  const reqs = [
    requirement(),
    requirement({ credentialType: "tb_test", displayName: "TB screening" }),
    requirement({
      credentialType: "auto_insurance",
      displayName: "Auto insurance",
      requiredForDriving: true,
      blocksSchedulingWhenExpired: false,
    }),
  ];

  it("counts only the requirements that apply to this person", () => {
    const walker = auditReadiness({ ...caregiver, drives: false }, reqs, [], ASOF);
    expect(walker.required).toBe(2);
    const driver = auditReadiness(caregiver, reqs, [], ASOF);
    expect(driver.required).toBe(3);
  });

  it("is ready only when nothing is missing, expired, rejected or unreviewed", () => {
    const all = reqs.map((r) => credential({ credentialType: r.credentialType, id: r.credentialType }));
    const readiness = auditReadiness(caregiver, reqs, all, ASOF);
    expect(readiness.ready).toBe(true);
    expect(readiness.complete).toBe(3);
  });

  it("is not ready while something only awaits review", () => {
    const all = reqs.map((r) => credential({ credentialType: r.credentialType, id: r.credentialType }));
    all[0] = { ...all[0], verificationStatus: "ai_extracted" };
    const readiness = auditReadiness(caregiver, reqs, all, ASOF);
    expect(readiness.ready).toBe(false);
    expect(readiness.needsReview).toEqual(["cpr_bls"]);
  });

  it("matches the shape §27 specifies", () => {
    const readiness = auditReadiness(caregiver, reqs, [], ASOF);
    expect(Object.keys(readiness).sort()).toEqual(
      ["complete", "employeeId", "expired", "expiring", "missing", "needsReview", "outcomes", "ready", "required"].sort(),
    );
  });
});

describe("scheduling eligibility", () => {
  // §12: Scheduling consumes the answer; it does not form its own opinion.
  it("blocks only on requirements configured to block", () => {
    const reqs = [
      requirement({ credentialType: "handbook", displayName: "Handbook", blocksSchedulingWhenExpired: false }),
      requirement({ credentialType: "tb_test", displayName: "TB screening" }),
    ];
    const creds = [credential({ credentialType: "handbook", id: "h", expiresAt: "2026-01-01" })];

    const eligibility = schedulingEligibility(auditReadiness(caregiver, reqs, creds, ASOF));
    expect(eligibility.eligible).toBe(false);
    // Blocked by the missing TB test, not by the lapsed handbook.
    expect(eligibility.blockedBy.map((b) => b.credentialType)).toEqual(["tb_test"]);
    expect(eligibility.advisories.map((a) => a.credentialType)).toEqual(["handbook"]);
  });

  it("is eligible when every blocking requirement is satisfied", () => {
    const reqs = [requirement()];
    const eligibility = schedulingEligibility(
      auditReadiness(caregiver, reqs, [credential()], ASOF),
    );
    expect(eligibility.eligible).toBe(true);
  });
});

describe("the Needs You line", () => {
  // "3 compliance items" sends somebody hunting. Naming it is the answer.
  it("names the person and the specific thing", () => {
    const reqs = [requirement()];
    const creds = [credential({ expiresAt: "2026-08-23" })];
    const items = needsAttention("Chanel P", auditReadiness(caregiver, reqs, creds, ASOF));
    expect(items[0].label).toMatch(/^Chanel P — CPR\/BLS expires in 5 days/);
    expect(items[0].severity).toBe("warning");
  });

  it("marks a lapse that stops work as blocking", () => {
    const items = needsAttention(
      "Tanya Robinson",
      auditReadiness(caregiver, [requirement()], [credential({ expiresAt: "2026-01-01" })], ASOF),
    );
    expect(items[0].severity).toBe("blocking");
  });
});
