import { describe, expect, it } from "vitest";
import { morningBrief } from "@/domain/home/brief";
import type { HomeSignal } from "@/domain/home/signals";

const signal = (label: string, urgent: boolean): HomeSignal => ({
  key: label,
  label,
  value: "1",
  to: "/",
  urgent,
});

describe("the morning brief", () => {
  it("reads like a colleague, not a dashboard", () => {
    const brief = morningBrief({
      visitsToday: 4,
      unassignedToday: 1,
      signals: [signal("Open shifts", true), signal("Payroll", true)],
      upcomingBillingWeek: "2026-09-05",
      today: "2026-08-24",
    });
    expect(brief).toBe(
      "4 visits today — 1 still needs a caregiver. Open shifts and payroll need you.",
    );
  });

  it("says a quiet day plainly, without padding", () => {
    const brief = morningBrief({
      visitsToday: 3,
      unassignedToday: 0,
      signals: [signal("Payroll", false)],
      upcomingBillingWeek: "2026-09-05",
      today: "2026-08-26",
    });
    expect(brief).toBe("3 visits today, all covered. Nothing needs you this morning.");
  });

  it("mentions the Saturday run only when it is near", () => {
    const near = morningBrief({
      visitsToday: 0,
      unassignedToday: 0,
      signals: [],
      upcomingBillingWeek: "2026-09-05", // run drafts Aug 29
      today: "2026-08-28",
    });
    expect(near).toContain("drafts in one day");

    const runDay = morningBrief({
      visitsToday: 0,
      unassignedToday: 0,
      signals: [],
      upcomingBillingWeek: "2026-09-05",
      today: "2026-08-29",
    });
    expect(runDay).toContain("drafts today");
  });
});
