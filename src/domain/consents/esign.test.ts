import { describe, expect, it } from "vitest";
import {
  EMPTY_CEREMONY,
  ceremonyRefusals,
  deriveInitials,
} from "@/domain/consents/esign";

/**
 * Karynn, 24 August: "DocuSign-style service. Nothing typed." The ceremony is
 * consent → adopt → apply, and every gate refuses with a sentence.
 */

describe("derived initials", () => {
  it("takes the first letter of each name part, uppercased", () => {
    expect(deriveInitials("Johnathan Huang")).toBe("JH");
    expect(deriveInitials("Marta de la Vance")).toBe("MDLV");
  });

  it("handles hyphenated names and stray spaces", () => {
    expect(deriveInitials("  Mary-Beth  Alvarez ")).toBe("MBA");
  });

  it("caps at four marks — an initials block, not a monogram poster", () => {
    expect(deriveInitials("A B C D E F")).toBe("ABCD");
  });

  it("is empty when there is no name to derive from", () => {
    expect(deriveInitials("")).toBe("");
    expect(deriveInitials("   ")).toBe("");
  });
});

describe("the ceremony gates", () => {
  const signer = { legalName: "Wilhelmina Vandermeer", relationship: "Daughter" };

  it("refuses everything at the start, in order", () => {
    expect(ceremonyRefusals(signer, EMPTY_CEREMONY)).toEqual(["not_consented", "not_adopted"]);
  });

  it("refuses a signer with no legal name on record — nothing to generate from", () => {
    expect(ceremonyRefusals({ legalName: " ", relationship: "Self" }, EMPTY_CEREMONY)).toContain(
      "no_signer_name",
    );
  });

  it("consent alone is not adoption", () => {
    expect(
      ceremonyRefusals(signer, { ...EMPTY_CEREMONY, consentedAt: "2026-08-24T10:00:00Z" }),
    ).toEqual(["not_adopted"]);
  });

  it("clears once consented and adopted", () => {
    expect(
      ceremonyRefusals(signer, {
        consentedAt: "2026-08-24T10:00:00Z",
        adoptedAt: "2026-08-24T10:01:00Z",
        signedAt: null,
      }),
    ).toEqual([]);
  });
});
