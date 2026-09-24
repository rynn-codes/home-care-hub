import { describe, expect, it } from "vitest";
import { lastFour, mrNumber, mrNumberTaken, whyNoMrNumber } from "./mrNumber";

describe("the MR number", () => {
  it("is the two initials, the last four, and a zero", () => {
    expect(mrNumber({ firstName: "Jane", lastName: "Smith", ssn: "123-45-6789" })).toBe("JS67890");
  });

  it("accepts the last four alone, as a form that never asks for the whole number", () => {
    expect(mrNumber({ firstName: "jane", lastName: "smith", ssn: "6789" })).toBe("JS67890");
  });

  it("refuses a half-typed number rather than producing a wrong one", () => {
    expect(mrNumber({ firstName: "Jane", lastName: "Smith", ssn: "12" })).toBeNull();
    expect(mrNumber({ firstName: "", lastName: "Smith", ssn: "123456789" })).toBeNull();
    expect(lastFour("123-45-678")).toBeNull();
  });

  it("reports a collision in any case", () => {
    expect(mrNumberTaken("JS67890", ["js67890"])).toBe(true);
    expect(mrNumberTaken("JS67890", [null, "JS67891"])).toBe(false);
  });

  it("says what is missing", () => {
    expect(whyNoMrNumber({ firstName: "", lastName: "S", ssn: "6789" })).toMatch(/first and a last name/);
    expect(whyNoMrNumber({ firstName: "J", lastName: "S", ssn: "" })).toMatch(/last four/);
    expect(whyNoMrNumber({ firstName: "J", lastName: "S", ssn: "6789" })).toBeNull();
  });
});
