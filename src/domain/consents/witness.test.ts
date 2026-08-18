import { describe, expect, it } from "vitest";
import {
  WITNESS_ROLES,
  canWitnessSignature,
  witnessLine,
  witnessRefusal,
  type UserRole,
} from "@/domain/consents/witness";

describe("who may take a signature", () => {
  it("allows an RN and the Admin/Owner, and nobody else", () => {
    expect(canWitnessSignature("rn_clinical")).toBe(true);
    expect(canWitnessSignature("ceo_admin")).toBe(true);
    for (const role of [
      "intake_coordinator",
      "scheduler",
      "payroll",
      "billing",
      "hr",
      "employee",
      "client_contact",
    ] as UserRole[]) {
      expect(canWitnessSignature(role), `${role} must not witness`).toBe(false);
    }
  });

  // The rule is easy to widen by accident when a new role is added.
  it("keeps the witness list to exactly two roles", () => {
    expect([...WITNESS_ROLES].sort()).toEqual(["ceo_admin", "rn_clinical"]);
  });

  it("treats an unknown role as not permitted rather than as permitted", () => {
    expect(canWitnessSignature(null)).toBe(false);
    expect(canWitnessSignature(undefined)).toBe(false);
  });

  // A blocked screen that does not say why gets worked around.
  it("explains the refusal to the person, and says what they can still do", () => {
    const message = witnessRefusal("intake_coordinator");
    expect(message).toMatch(/RN or the Admin\/Owner/);
    expect(message).toMatch(/Intake coordinator/);
    expect(message).toMatch(/record their decisions/);
    expect(witnessRefusal("rn_clinical")).toBe("");
  });

  it("names the Joy representative on the record, not just a time", () => {
    expect(witnessLine({ name: "Kelsey Westley", role: "rn_clinical" })).toBe("Kelsey Westley · RN");
    expect(witnessLine(null)).toMatch(/No Joy representative/);
  });
});
