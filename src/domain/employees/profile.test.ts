import { describe, expect, it } from "vitest";
import {
  EMPLOYMENT_TYPES,
  ROSTER_HIDE_AFTER_DAYS,
  blankProfile,
  daysSince,
  defaultEmploymentType,
  isBilingual,
  mrNumberFrom,
  relationshipLabel,
  restingOffRoster,
  spokenLanguages,
  whyNotSaveEmployee,
} from "@/domain/employees/profile";

describe("adding and editing an employee", () => {
  const filled = () => ({ ...blankProfile(), firstName: "Brandon", lastName: "H" });

  it("needs a name and nothing else", () => {
    expect(whyNotSaveEmployee(filled())).toBeNull();
    expect(whyNotSaveEmployee({ ...filled(), firstName: " " })).toContain("first name");
    expect(whyNotSaveEmployee({ ...filled(), lastName: "" })).toContain("last name");
  });

  it("refuses a nonsense rate or week", () => {
    expect(whyNotSaveEmployee({ ...filled(), baseRate: -1 })).toContain("positive");
    expect(whyNotSaveEmployee({ ...filled(), weeklyHours: 200 })).toContain("0 and 168");
    expect(whyNotSaveEmployee({ ...filled(), baseRate: 18.5, weeklyHours: 40 })).toBeNull();
  });

  it("refuses an address that is not one", () => {
    expect(whyNotSaveEmployee({ ...filled(), email: "brandon" })).toContain("does not look right");
    expect(whyNotSaveEmployee({ ...filled(), email: "b@example.com" })).toBeNull();
  });
});

/*
 * The rule that must never soften: the digits are used and not kept. This
 * asserts the shape of what comes back, and every other test in the store
 * asserts that nothing containing the digits is ever written.
 */
describe("the MR number from a social security number", () => {
  it("is the two initials, the last four, and a zero", () => {
    expect(mrNumberFrom({ firstName: "Jane", lastName: "Smith", ssn: "123-45-6789" })).toBe("JS67890");
  });

  it("returns nothing at all from a half-typed number", () => {
    expect(mrNumberFrom({ firstName: "Jane", lastName: "Smith", ssn: "12" })).toBeNull();
    expect(mrNumberFrom({ firstName: "", lastName: "Smith", ssn: "123456789" })).toBeNull();
  });
});

describe("resting an inactive employee off the roster", () => {
  const TODAY = "2026-09-09";
  const inactive = (since: string | null) => ({ status: "inactive" as const, inactiveSince: since });

  it("counts the days since they went inactive", () => {
    expect(daysSince("2026-07-11", TODAY)).toBe(60);
    expect(daysSince(null, TODAY)).toBeNull();
  });

  it("keeps them on the roster inside the window", () => {
    expect(restingOffRoster(inactive("2026-08-20"), TODAY)).toBe(false);
  });

  it("rests them once the window has passed", () => {
    expect(restingOffRoster(inactive("2026-07-01"), TODAY)).toBe(true);
    expect(ROSTER_HIDE_AFTER_DAYS).toBe(60);
  });

  /* Nobody is hidden on a guess: no date means they stay until told. */
  it("keeps somebody whose last day nobody recorded", () => {
    expect(restingOffRoster(inactive(null), TODAY)).toBe(false);
  });

  it("never rests somebody who is still working", () => {
    expect(restingOffRoster({ status: "active", inactiveSince: "2020-01-01" }, TODAY)).toBe(false);
    expect(restingOffRoster({ status: "on_leave", inactiveSince: "2020-01-01" }, TODAY)).toBe(false);
  });
});

describe("employment type defaults", () => {
  it("starts field staff as PRN / Per Diem — Karynn, 29 September", () => {
    expect(defaultEmploymentType("caregiver")).toBe("PRN / Per Diem");
    expect(defaultEmploymentType("cna")).toBe("PRN / Per Diem");
  });

  it("leaves nurses and the office to be chosen", () => {
    expect(defaultEmploymentType("rn")).toBe("Part-time · hourly");
    expect(defaultEmploymentType("lvn")).toBe("Part-time · hourly");
    expect(defaultEmploymentType("office")).toBe("Part-time · hourly");
  });

  it("offers PRN / Per Diem first and has no bare Per Diem", () => {
    expect(EMPLOYMENT_TYPES[0]).toBe("PRN / Per Diem");
    expect(EMPLOYMENT_TYPES).not.toContain("Per Diem");
  });

  it("gives a blank profile — a caregiver — the field default", () => {
    expect(blankProfile().employmentType).toBe("PRN / Per Diem");
  });
});

describe("the profile has no home phone", () => {
  it("keeps one phone on a blank record", () => {
    const p = blankProfile() as unknown as Record<string, unknown>;
    expect(p.phoneMobile).toBe("");
    expect("phoneHome" in p).toBe(false);
  });
});

describe("languages", () => {
  it("is bilingual only with a second, different language", () => {
    expect(isBilingual({ preferredLanguage: "English", otherLanguages: [] })).toBe(false);
    expect(isBilingual({ preferredLanguage: "English", otherLanguages: ["english", " "] })).toBe(false);
    expect(isBilingual({ preferredLanguage: "English", otherLanguages: ["Spanish"] })).toBe(true);
  });

  it("lists the preferred language first without repeats", () => {
    expect(spokenLanguages({ preferredLanguage: "Spanish", otherLanguages: ["English", "spanish", "Creole"] })).toEqual([
      "Spanish",
      "English",
      "Creole",
    ]);
  });

  it("survives a record saved before the field existed", () => {
    expect(spokenLanguages({ preferredLanguage: "English", otherLanguages: undefined as unknown as string[] })).toEqual([
      "English",
    ]);
  });
});

describe("emergency contact relationship", () => {
  it("says who when the relationship is Other", () => {
    expect(relationshipLabel({ relationship: "Other", relationshipOther: "Neighbour" })).toBe("Other · Neighbour");
    expect(relationshipLabel({ relationship: "Other", relationshipOther: "" })).toBe("Other");
    expect(relationshipLabel({ relationship: "Spouse", relationshipOther: "ignored" })).toBe("Spouse");
  });
});
