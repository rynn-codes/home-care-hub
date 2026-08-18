import { describe, expect, it } from "vitest";
import {
  canDriveClients,
  canWorkShifts,
  credentialStatuses,
  employeeCompliance,
  requiredCredentials,
  type EmployeeCredentialInput,
} from "@/domain/employees/credentials";

const TODAY = "2026-08-18";

const current = (key: string) => ({ [key]: { issued: "2026-01-01", expires: "2027-01-01" } });

function allCurrent(input: Omit<EmployeeCredentialInput, "records">): EmployeeCredentialInput {
  const records: EmployeeCredentialInput["records"] = {};
  for (const req of requiredCredentials(input.role, input.drives)) {
    Object.assign(records, current(req.key));
  }
  return { ...input, records };
}

describe("what each role must hold", () => {
  // A permanently red record is one everyone learns to ignore.
  it("does not ask office staff for clinical credentials", () => {
    const keys = requiredCredentials("office", false).map((r) => r.key);
    expect(keys).toEqual(["background_check", "handbook"]);
    expect(keys).not.toContain("tb_test");
    expect(keys).not.toContain("cpr");
  });

  it("asks a field caregiver for the clinical set", () => {
    const keys = requiredCredentials("cna", false).map((r) => r.key);
    for (const k of ["cpr", "tb_test", "immunizations", "annual_training", "licence"]) {
      expect(keys, `field caregiver needs ${k}`).toContain(k);
    }
  });

  it("names the licence after the role rather than calling everything a licence", () => {
    const label = (role: "cna" | "hha" | "lvn") =>
      requiredCredentials(role, false).find((r) => r.key === "licence")?.label;
    expect(label("cna")).toBe("CNA licence");
    expect(label("hha")).toBe("HHA certificate");
    expect(label("lvn")).toBe("LVN licence");
  });

  it("only asks for a licence and insurance from someone who drives", () => {
    expect(requiredCredentials("cna", false).map((r) => r.key)).not.toContain("auto_insurance");
    expect(requiredCredentials("cna", true).map((r) => r.key)).toContain("auto_insurance");
    expect(requiredCredentials("cna", true).map((r) => r.key)).toContain("drivers_license");
  });
});

describe("expiry", () => {
  it("warns before a credential lapses, not on the day", () => {
    const input = allCurrent({ role: "hha", drives: false });
    input.records.cpr = { issued: "2024-10-01", expires: "2026-10-01" };
    const cpr = credentialStatuses(input, TODAY).find((i) => i.key === "cpr");
    expect(cpr?.state).toBe("expiring");
    expect(cpr?.action).toBe("Request renewal");
  });

  it("treats a lapsed credential as a reason to come off the schedule", () => {
    const input = allCurrent({ role: "hha", drives: false });
    input.records.tb_test = { issued: "2024-02-10", expires: "2026-02-10" };
    const tb = credentialStatuses(input, TODAY).find((i) => i.key === "tb_test");
    expect(tb?.state).toBe("expired");
    expect(tb?.action).toMatch(/take them off the schedule/i);
  });

  it("reports a credential never supplied as missing, not expired", () => {
    const input = allCurrent({ role: "cna", drives: false });
    delete input.records.tb_test;
    const tb = credentialStatuses(input, TODAY).find((i) => i.key === "tb_test");
    expect(tb?.state).toBe("missing");
    expect(tb?.action).toMatch(/^Request/);
  });

  it("survives an unparseable date rather than crashing the record", () => {
    const input = allCurrent({ role: "cna", drives: false });
    input.records.cpr = { issued: "x", expires: "not a date" };
    expect(credentialStatuses(input, TODAY).find((i) => i.key === "cpr")?.state).toBe("missing");
  });
});

describe("the directory line", () => {
  // "2 items need attention" sends someone hunting. Naming it is the answer.
  it("names the problem rather than counting problems", () => {
    const input = allCurrent({ role: "hha", drives: false });
    input.records.cpr = { issued: "2024-10-01", expires: "2026-10-01" };
    expect(employeeCompliance(input, TODAY).summary).toMatch(/CPR certification expires in \d+ days/);
  });

  it("says everything is current when it is, with the count", () => {
    const c = employeeCompliance(allCurrent({ role: "office", drives: false }), TODAY);
    expect(c.verdict).toBe("current");
    expect(c.summary).toBe("All 2 items current");
  });

  it("ranks an expiry behind an outright lapse", () => {
    const input = allCurrent({ role: "cna", drives: false });
    input.records.cpr = { issued: "2024-10-01", expires: "2026-10-01" };
    input.records.tb_test = { issued: "2024-02-10", expires: "2026-02-10" };
    const c = employeeCompliance(input, TODAY);
    expect(c.verdict).toBe("blocked");
    expect(c.summary).toMatch(/TB test expired/);
  });
});

describe("who can be sent out", () => {
  it("keeps someone with a lapsed credential off shifts", () => {
    const input = allCurrent({ role: "cna", drives: false });
    input.records.cpr = { issued: "2023-01-01", expires: "2025-01-01" };
    expect(canWorkShifts(employeeCompliance(input, TODAY), "active")).toBe(false);
  });

  it("keeps someone on leave off shifts even when their papers are perfect", () => {
    const c = employeeCompliance(allCurrent({ role: "cna", drives: false }), TODAY);
    expect(canWorkShifts(c, "active")).toBe(true);
    expect(canWorkShifts(c, "on_leave")).toBe(false);
    expect(canWorkShifts(c, "onboarding")).toBe(false);
  });

  // The other half of the client's transport consent. Both must be true.
  it("only lets someone drive with the intent, the licence and the insurance", () => {
    expect(canDriveClients(allCurrent({ role: "cna", drives: true }), TODAY)).toBe(true);
    expect(canDriveClients(allCurrent({ role: "cna", drives: false }), TODAY)).toBe(false);

    const lapsed = allCurrent({ role: "cna", drives: true });
    lapsed.records.auto_insurance = { issued: "2024-01-01", expires: "2025-01-01" };
    expect(canDriveClients(lapsed, TODAY)).toBe(false);
  });
});
