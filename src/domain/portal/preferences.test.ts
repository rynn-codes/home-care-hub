import { describe, expect, it } from "vitest";
import {
  MAX_PREFERENCE_LENGTH,
  approvePreference,
  awaitingApproval,
  checkPreference,
  preferencesForVisit,
  proposePreference,
  retirePreference,
  type Preference,
} from "@/domain/portal/preferences";

function pref(over: Partial<Preference> = {}): Preference {
  return {
    ...proposePreference({
      id: "p1",
      clientPersonId: "c1",
      text: "Enjoys chess",
      byPersonId: "p-jamisha",
      source: "caregiver",
      at: "2026-08-20T10:00:00Z",
    }),
    ...over,
  };
}

describe("§17 — maintained, not inferred", () => {
  it("refuses a preference with no author", () => {
    // A row with no author is exactly the uncontrolled memory §17 rules out.
    expect(() =>
      proposePreference({
        id: "p1",
        clientPersonId: "c1",
        text: "Enjoys chess",
        byPersonId: null,
        source: "family",
        at: "t",
      }),
    ).toThrow(/needs whoever added it/);
  });

  it("records who added it, when, and where it came from", () => {
    const p = pref();
    expect(p.addedByPersonId).toBe("p-jamisha");
    expect(p.source).toBe("caregiver");
    expect(p.addedAt).toBe("2026-08-20T10:00:00Z");
  });

  it("holds a family or caregiver suggestion for the office", () => {
    expect(pref().state).toBe("proposed");
    expect(awaitingApproval([pref()])).toHaveLength(1);
  });

  it("takes the office's own entry as already approved", () => {
    const p = proposePreference({
      id: "p2",
      clientPersonId: "c1",
      text: "Coffee with one cream",
      byPersonId: "p-karynn",
      source: "office",
      at: "t",
    });
    expect(p.state).toBe("approved");
    expect(p.approvedByPersonId).toBe("p-karynn");
  });
});

describe("§17 — approved and non-sensitive", () => {
  it("keeps an unreviewed suggestion away from somebody at a front door", () => {
    // A caregiver reading it has no way to know it is unreviewed.
    expect(preferencesForVisit([pref()], "c1")).toEqual([]);
    expect(
      preferencesForVisit([approvePreference({ preference: pref(), byPersonId: "p-karynn", at: "t" })], "c1"),
    ).toEqual(["Enjoys chess"]);
  });

  it("refuses a care plan item dressed as a preference", () => {
    // Genuinely useful to a substitute, and it belongs where the RN maintains
    // it — not in a list a family reads as "things Dad likes".
    const check = checkPreference("Gets agitated in the evening");
    expect(check.ok).toBe(false);
    expect(check.problem).toBe("clinical_content");
  });

  it("says where the information belongs rather than only refusing", () => {
    // Whoever wrote it was trying to help a colleague.
    expect(checkPreference("Needs pureed food").detail).toContain("care plan");
  });

  it("refuses a paragraph, because a paragraph about care is a care plan", () => {
    const long = "a".repeat(MAX_PREFERENCE_LENGTH + 1);
    expect(checkPreference(long).problem).toBe("too_long");
  });

  it("lets an ordinary preference through", () => {
    for (const text of [
      "Enjoys chess",
      "Likes sitting on the porch after lunch",
      "Gospel music in the morning",
      "Coffee with one cream",
    ]) {
      expect(checkPreference(text).ok).toBe(true);
    }
  });

  it("does not let a bad one in through propose", () => {
    expect(() =>
      proposePreference({
        id: "p1",
        clientPersonId: "c1",
        text: "Wanders at night",
        byPersonId: "p1",
        source: "family",
        at: "t",
      }),
    ).toThrow(/care plan/);
  });
});

describe("retiring", () => {
  it("keeps the row rather than deleting it", () => {
    // Somebody acted on this last week and acted reasonably. Erasing it leaves
    // that looking like a mistake nobody can explain.
    const retired = retirePreference(pref(), "No longer true");
    expect(retired.state).toBe("retired");
    expect(retired.text).toBe("Enjoys chess");
    expect(retired.retiredReason).toBe("No longer true");
  });

  it("keeps a retired preference out of the pre-visit card", () => {
    expect(preferencesForVisit([retirePreference(pref(), "x")], "c1")).toEqual([]);
  });

  it("will not revive one, so the trail stays honest", () => {
    expect(() =>
      approvePreference({ preference: retirePreference(pref(), "x"), byPersonId: "p", at: "t" }),
    ).toThrow(/Add it again/);
  });
});

describe("scoping", () => {
  it("never shows one client's preferences on another's visit", () => {
    const approved = approvePreference({ preference: pref(), byPersonId: "p", at: "t" });
    expect(preferencesForVisit([approved], "someone-else")).toEqual([]);
  });
});
