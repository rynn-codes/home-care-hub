import { describe, expect, it } from "vitest";
import { assessAssignment, rankCandidates, type Candidate, type AssignmentContext } from "@/domain/scheduling/assignment";
import type { Visit } from "@/domain/scheduling/conflicts";
import { requiredCredentials, type CredentialRecord } from "@/domain/employees/credentials";

const TODAY = "2026-08-18";

const VISIT: Visit = {
  id: "v-new",
  clientName: "Odessa Arceneaux",
  service: "Personal Care",
  caregiverName: null,
  startsAt: "2026-08-20T09:00:00.000Z",
  endsAt: "2026-08-20T13:00:00.000Z",
};

function records(role: Candidate["role"], drives: boolean): Record<string, CredentialRecord> {
  const out: Record<string, CredentialRecord> = {};
  for (const req of requiredCredentials(role, drives)) {
    out[req.key] = { issued: "2026-01-01", expires: "2027-01-01" };
  }
  return out;
}

function candidate(over: Partial<Candidate> = {}): Candidate {
  const role = over.role ?? "cna";
  const drives = over.drives ?? true;
  return {
    employeeId: "e1",
    name: "Chanel P",
    role,
    drives,
    status: "active",
    weeklyHours: 20,
    records: records(role, drives),
    ...over,
  };
}

const ctx = (over: Partial<AssignmentContext> = {}): AssignmentContext => ({
  visit: VISIT,
  existing: [],
  today: TODAY,
  ...over,
});

describe("credentials at assignment", () => {
  it("assigns someone whose papers are in order", () => {
    const a = assessAssignment(candidate(), ctx());
    expect(a.canAssign).toBe(true);
    expect(a.blocking).toEqual([]);
  });

  it("refuses someone with an expired credential", () => {
    const c = candidate();
    c.records.tb_test = { issued: "2025-02-10", expires: "2026-02-10" };
    const a = assessAssignment(c, ctx());
    expect(a.canAssign).toBe(false);
    expect(a.blocking[0].kind).toBe("credential_blocked");
  });

  // The one a human scheduler misses: green when booked, uncovered on the day.
  it("refuses a credential that is valid today but expires before the shift", () => {
    const c = candidate();
    c.records.cpr = { issued: "2024-08-19", expires: "2026-08-19" };
    const a = assessAssignment(c, ctx());
    expect(a.canAssign).toBe(false);
    expect(a.blocking.map((b) => b.kind)).toContain("credential_expires_before_shift");
    expect(a.blocking.find((b) => b.kind === "credential_expires_before_shift")?.message).toMatch(
      /before this shift/,
    );
  });

  it("does not report the same lapse twice", () => {
    const c = candidate();
    c.records.tb_test = { issued: "2024-02-10", expires: "2025-02-10" };
    const a = assessAssignment(c, ctx());
    expect(a.blocking.filter((b) => b.message.includes("TB test"))).toHaveLength(1);
  });

  it("refuses someone on leave or still onboarding", () => {
    expect(assessAssignment(candidate({ status: "on_leave" }), ctx()).canAssign).toBe(false);
    expect(assessAssignment(candidate({ status: "onboarding" }), ctx()).canAssign).toBe(false);
    expect(assessAssignment(candidate({ status: "on_leave" }), ctx()).blocking[0].message).toMatch(
      /on leave/,
    );
  });
});

describe("the schedule", () => {
  it("refuses a caregiver already booked at that hour", () => {
    const clash: Visit = { ...VISIT, id: "v-old", clientName: "Wendell Hollis", caregiverName: "Chanel P" };
    const a = assessAssignment(candidate(), ctx({ existing: [clash] }));
    expect(a.canAssign).toBe(false);
    expect(a.blocking.map((b) => b.kind)).toContain("double_booked");
  });

  // Overtime is a cost the scheduler may knowingly accept. It must not block.
  it("warns about overtime without refusing the assignment", () => {
    const a = assessAssignment(candidate({ weeklyHours: 38 }), ctx());
    expect(a.canAssign).toBe(true);
    expect(a.warnings.map((w) => w.kind)).toContain("overtime");
    expect(a.warnings[0].message).toMatch(/time and a half/);
    expect(a.projectedWeeklyHours).toBe(42);
  });

  it("does not warn when the shift fits inside the threshold", () => {
    expect(assessAssignment(candidate({ weeklyHours: 20 }), ctx()).warnings).toEqual([]);
  });
});

describe("transport", () => {
  const driving = ctx({ requiresDriving: true, clientAgreedToTransport: true });

  it("allows a driver with a current licence and insurance", () => {
    expect(assessAssignment(candidate(), driving).canAssign).toBe(true);
  });

  it("refuses a caregiver who does not drive", () => {
    const a = assessAssignment(candidate({ drives: false }), driving);
    expect(a.canAssign).toBe(false);
    expect(a.blocking.map((b) => b.kind)).toContain("cannot_drive");
  });

  it("refuses a driver whose insurance has lapsed", () => {
    const c = candidate();
    c.records.auto_insurance = { issued: "2024-01-01", expires: "2025-01-01" };
    const a = assessAssignment(c, driving);
    expect(a.canAssign).toBe(false);
    expect(a.blocking.some((b) => /insurance/i.test(b.message))).toBe(true);
  });

  // The client's refusal has to reach the moment somebody is put in a car.
  it("refuses everyone when the client declined the transport consent", () => {
    const a = assessAssignment(candidate(), ctx({ requiresDriving: true, clientAgreedToTransport: false }));
    expect(a.canAssign).toBe(false);
    expect(a.blocking.map((b) => b.kind)).toContain("client_declined_transport");
    expect(a.blocking.find((b) => b.kind === "client_declined_transport")?.message).toMatch(
      /nobody may drive them/,
    );
  });

  it("ignores driving entirely when the visit does not involve it", () => {
    expect(assessAssignment(candidate({ drives: false }), ctx()).canAssign).toBe(true);
  });

  // Nobody having asked is not the same as a refusal.
  it("does not treat an unasked transport consent as a refusal", () => {
    const a = assessAssignment(candidate(), ctx({ requiresDriving: true }));
    expect(a.blocking.map((b) => b.kind)).not.toContain("client_declined_transport");
  });
});

describe("ranking", () => {
  it("puts people who can take it above people who cannot", () => {
    const blocked = candidate({ employeeId: "e2", name: "Aaron Blocked", status: "on_leave" });
    const free = candidate({ employeeId: "e3", name: "Zoe Free" });
    expect(rankCandidates([blocked, free], ctx()).map((a) => a.name)).toEqual([
      "Zoe Free",
      "Aaron Blocked",
    ]);
  });

  // Spread the hours rather than pushing the same person over forty each week.
  it("prefers the caregiver with more slack before overtime", () => {
    const busy = candidate({ employeeId: "e2", name: "Busy", weeklyHours: 36 });
    const quiet = candidate({ employeeId: "e3", name: "Quiet", weeklyHours: 8 });
    expect(rankCandidates([busy, quiet], ctx()).map((a) => a.name)).toEqual(["Quiet", "Busy"]);
  });

  // "Why isn't Heather offered?" is a question the screen should answer.
  it("keeps blocked people in the list with their reason attached", () => {
    const ranked = rankCandidates([candidate({ status: "on_leave" })], ctx());
    expect(ranked).toHaveLength(1);
    expect(ranked[0].blocking[0].message).toMatch(/on leave/);
  });
});
