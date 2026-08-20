import { describe, expect, it } from "vitest";
import { alertSummary, complianceAlerts, type WorkforceMember } from "@/domain/credentials/alerts";
import type { CredentialRequirement } from "@/domain/documents/types";

const ASOF = "2026-08-18";

const requirements: CredentialRequirement[] = [
  {
    credentialType: "cpr",
    displayName: "CPR certification",
    folderType: "credentials_licenses",
    sensitivity: "clinical_credential",
    requiredForRoles: ["cna"],
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    blocksSchedulingWhenExpired: true,
    warningDays: [60, 30],
    active: true,
  },
  {
    credentialType: "handbook",
    displayName: "Employee handbook",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    blocksSchedulingWhenExpired: false,
    warningDays: [30],
    active: true,
  },
];

function member(over: Partial<WorkforceMember> = {}): WorkforceMember {
  return {
    id: "e1",
    name: "Chanel P",
    role: "cna",
    drives: false,
    status: "active",
    records: {
      cpr: { issued: "2025-01-01", expires: "2027-01-01" },
      handbook: { issued: "2026-01-01", expires: "2027-01-01" },
    },
    ...over,
  };
}

describe("workforce alerts", () => {
  it("says nothing when everything is in date", () => {
    expect(complianceAlerts([member()], requirements, ASOF)).toEqual([]);
    expect(alertSummary([])).toBe("Everything is current");
  });

  it("names the person and the thing, in that order", () => {
    const lapsed = member({ records: { cpr: { issued: "2024-01-01", expires: "2026-01-01" }, handbook: { expires: "2027-01-01" } } });
    const [alert] = complianceAlerts([lapsed], requirements, ASOF);
    expect(alert.label).toMatch(/^Chanel P — CPR certification has lapsed/);
    expect(alert.severity).toBe("blocking");
  });

  // An alphabetical list of alerts is a list nobody triages.
  it("puts a lapse that stops work above one that merely needs chasing", () => {
    const blocked = member({ id: "e1", name: "Zoe Blocked", records: { cpr: { expires: "2026-01-01" }, handbook: { expires: "2027-01-01" } } });
    const chase = member({ id: "e2", name: "Abe Chase", role: "office", records: { handbook: { expires: "2026-09-01" } } });
    const order = complianceAlerts([chase, blocked], requirements, ASOF).map((a) => a.employeeName);
    expect(order[0]).toBe("Zoe Blocked");
  });

  it("puts the soonest deadline first within the same severity", () => {
    const soon = member({ id: "e1", name: "Soon", role: "office", records: { handbook: { expires: "2026-08-25" } } });
    const later = member({ id: "e2", name: "Later", role: "office", records: { handbook: { expires: "2026-09-10" } } });
    const order = complianceAlerts([later, soon], requirements, ASOF).map((a) => a.employeeName);
    expect(order).toEqual(["Soon", "Later"]);
  });

  // Chasing a lapsed CPR for somebody who left buries the live ones.
  it("ignores people who have left", () => {
    const gone = member({ status: "inactive", records: { cpr: { expires: "2020-01-01" } } });
    expect(complianceAlerts([gone], requirements, ASOF)).toEqual([]);
  });

  it("still chases somebody on leave, whose credentials must not quietly lapse", () => {
    const away = member({ status: "on_leave", records: { cpr: { expires: "2026-01-01" }, handbook: { expires: "2027-01-01" } } });
    expect(complianceAlerts([away], requirements, ASOF)).toHaveLength(1);
  });

  it("only asks each role for what applies to it", () => {
    const office = member({ role: "office", records: { handbook: { expires: "2027-01-01" } } });
    // No CPR alert: the requirement is scoped to CNAs.
    expect(complianceAlerts([office], requirements, ASOF)).toEqual([]);
  });
});

describe("the panel summary", () => {
  it("leads with people who cannot work, not with a total", () => {
    const blocked = member({ records: { cpr: { expires: "2026-01-01" }, handbook: { expires: "2026-09-01" } } });
    const alerts = complianceAlerts([blocked], requirements, ASOF);
    expect(alertSummary(alerts)).toBe("1 person cannot be scheduled");
  });

  it("counts chaseable items when nothing is blocking", () => {
    const chase = member({ role: "office", records: { handbook: { expires: "2026-09-01" } } });
    expect(alertSummary(complianceAlerts([chase], requirements, ASOF))).toBe("1 item needs chasing");
  });
});
