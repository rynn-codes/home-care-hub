import { describe, expect, it } from "vitest";
import {
  EMPLOYMENT_TYPES,
  blankProfile,
  defaultEmploymentType,
  isBilingual,
  relationshipLabel,
  spokenLanguages,
} from "./profile";

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
    const p = blankProfile() as Record<string, unknown>;
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
