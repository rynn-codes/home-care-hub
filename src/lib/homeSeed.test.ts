import { describe, expect, it } from "vitest";
import { HOME_JOY } from "./homeSeed";

/**
 * Karynn, 25 August: "All of these should be links to somewhere."
 *
 * A link to somewhere that does not exist is worse than no link — it looks
 * like it works until somebody clicks it. The e2e suite clicks every one of
 * these for real; this catches the typo before the browser has to.
 */
const ROUTES = [
  "/",
  "/brain",
  "/brain/my-work",
  "/brain/operations",
  "/operations",
  "/operations/hiring",
  "/operations/incidents",
  "/operations/audit",
  "/admissions",
  "/clients",
  "/clients/care-plans",
  "/clients/supervision",
  "/employees",
  "/people",
  "/scheduling",
  "/billing",
  "/payroll",
  "/documents",
  "/settings",
];

describe("Joy's column", () => {
  it("carries the four states, in the fixed order", () => {
    // CLAUDE.md: same words, same order, everywhere they appear. Needs you was
    // missing entirely until Karynn caught it — three states where the rule
    // says four, and the absent one was the only one that asks for a human.
    expect(HOME_JOY.map((g) => g.label)).toEqual(["Handled", "Working", "Waiting", "Needs you"]);
  });

  it("sends every single line somewhere", () => {
    for (const group of HOME_JOY) {
      expect(group.items.length, `${group.label} has no items`).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(item.to, `"${item.text}" goes nowhere`).toBeTruthy();
        expect(ROUTES, `"${item.text}" points at ${item.to}, which is not a route`).toContain(item.to);
      }
    }
  });

  it("keeps amber for the one state that owes a human something", () => {
    // The semantic rule: amber means a person still owes something. Handled is
    // done, Working is Joy's, Waiting is somebody else's — none of them may
    // wear it.
    const amber = HOME_JOY.filter((g) => g.tone.includes("B54708"));
    expect(amber.map((g) => g.label)).toEqual(["Needs you"]);
  });

  it("says what is waiting in one line, not four", () => {
    // Waiting is the state where the office can do nothing but wait. Naming
    // four people it cannot chase is four lines of noise.
    expect(HOME_JOY.find((g) => g.label === "Waiting")!.items).toHaveLength(1);
  });
});
