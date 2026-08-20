import { describe, expect, it } from "vitest";
import {
  APPLICATION_FIELDS,
  AWAITING_LEGAL_REVIEW,
  DEFERRED_SENSITIVE,
  INITIAL_AUTOSAVE,
  activeFields,
  applicationProgress,
  autosaveMessage,
  canSubmit,
  fieldsForStep,
  hasUnsavedWork,
  markDirty,
  markFailed,
  markSaved,
  markSaving,
  nextStep,
  prefillApplication,
  previousStep,
  questionSteps,
  resumeStep,
  reviewRows,
  stepComplete,
  toEmployeeFields,
  type ApplicationAnswers,
} from "@/domain/portal/application";

const FACTS = {
  name: "Jamisha Harper",
  phone: "+17135550100" as const,
  email: "jamisha@example.com",
  roleApplied: "Caregiver",
};

describe("prefillApplication", () => {
  it("does not ask a candidate their own name the day after the interview", () => {
    const a = prefillApplication(FACTS);
    expect(a.legal_name).toBe("Jamisha Harper");
    expect(a.phone).toBe("+17135550100");
    expect(a.role_applied).toBe("Caregiver");
  });

  it("leaves email alone when the invitation had none", () => {
    const a = prefillApplication({ ...FACTS, email: null });
    expect(a.email).toBeUndefined();
  });
});

describe("deferred sensitive fields", () => {
  it("describes the SSN but never puts it on screen", () => {
    // Karynn, 15 Aug: the SSN needs HIPAA-grade storage Joy does not have.
    // Collecting it into the demo store would be worse than not having it.
    expect(DEFERRED_SENSITIVE).toContain("ssn");
    expect(APPLICATION_FIELDS.some((f) => f.id === "ssn")).toBe(true);
    expect(activeFields({}).some((f) => f.id === "ssn")).toBe(false);
  });

  it("cannot be blocked from submission by a field it never showed", () => {
    // The trap: ssn is required, so a naive canSubmit would refuse forever.
    const answers = completeAnswers();
    expect(canSubmit(answers).ok).toBe(true);
  });

  it("keeps the legal-review list derived, so it cannot drift", () => {
    expect(AWAITING_LEGAL_REVIEW).toContain("convictions");
    expect(AWAITING_LEGAL_REVIEW).toContain("signature");
    for (const id of AWAITING_LEGAL_REVIEW) {
      expect(APPLICATION_FIELDS.find((f) => f.id === id)?.needsLegalReview).toBe(true);
    }
  });
});

describe("conditional questions", () => {
  it("asks about insurance only of people who will drive clients", () => {
    expect(fieldsForStep("availability", { drives_clients: "no" }).some((f) => f.id === "auto_insurance")).toBe(
      false,
    );
    expect(
      fieldsForStep("availability", { drives_clients: "yes" }).some((f) => f.id === "auto_insurance"),
    ).toBe(true);
  });

  it("only asks for detail when there is something to explain", () => {
    expect(fieldsForStep("references", { convictions: "no" }).some((f) => f.id === "convictions_detail")).toBe(
      false,
    );
    expect(
      fieldsForStep("references", { convictions: "yes" }).some((f) => f.id === "convictions_detail"),
    ).toBe(true);
  });
});

describe("progress", () => {
  it("does not count screens with nothing to fill in", () => {
    // A bar that moves on the welcome screen is measuring nothing.
    expect(questionSteps({})).not.toContain("welcome");
    expect(questionSteps({})).not.toContain("review");
  });

  it("reports zero before anything is typed", () => {
    const p = applicationProgress("personal", {});
    expect(p.answered).toBe(0);
    expect(p.percent).toBe(0);
  });

  it("reaches a hundred only when every required answer is in", () => {
    const p = applicationProgress("review", completeAnswers());
    expect(p.percent).toBe(100);
  });

  it("counts a newly revealed question against the total", () => {
    // Saying yes to driving adds a required question; progress must not
    // stay at the percentage it had before the question existed.
    const base = { ...completeAnswers(), drives_clients: "yes", auto_insurance: undefined };
    expect(applicationProgress("availability", base).percent).toBeLessThan(100);
  });
});

describe("navigation", () => {
  it("drops a returning candidate at the first thing they have not done", () => {
    const partial = prefillApplication(FACTS);
    expect(resumeStep(partial)).toBe("personal");
  });

  it("sends a finished candidate to review, not back round the loop", () => {
    expect(resumeStep(completeAnswers())).toBe("review");
  });

  it("walks forward and back through the same sequence", () => {
    expect(nextStep("welcome", {})).toBe("personal");
    expect(previousStep("personal", {})).toBe("welcome");
    expect(nextStep("attestation", {})).toBeNull();
    expect(previousStep("welcome", {})).toBeNull();
  });
});

describe("stepComplete", () => {
  it("will not let a step pass with a required answer missing", () => {
    expect(stepComplete("personal", prefillApplication(FACTS))).toBe(false);
  });

  it("passes once the questions actually shown are answered", () => {
    const answers = {
      ...prefillApplication(FACTS),
      date_of_birth: "1988-04-12",
      work_authorized: "yes",
    };
    expect(stepComplete("personal", answers)).toBe(true);
  });
});

describe("autosave", () => {
  it("says nothing until something is typed", () => {
    expect(autosaveMessage(INITIAL_AUTOSAVE)).toBe("");
  });

  it("keeps the dirty list when a save fails", () => {
    // The bug this prevents: clearing it means the next successful save
    // writes only what changed after the outage, silently dropping the rest.
    const s = markFailed(markSaving(markDirty(markDirty(INITIAL_AUTOSAVE, "a"), "b")));
    expect(s.unsavedFieldIds).toEqual(["a", "b"]);
    expect(hasUnsavedWork(s)).toBe(true);
  });

  it("does not claim Saved because it tried", () => {
    const s = markFailed(markSaving(markDirty(INITIAL_AUTOSAVE, "a")));
    expect(autosaveMessage(s)).toMatch(/has not saved yet/);
    expect(autosaveMessage(s)).not.toMatch(/^Saved/);
  });

  it("clears the dirty list only on a real save", () => {
    const s = markSaved(markSaving(markDirty(INITIAL_AUTOSAVE, "a")), "2026-08-20T09:00:00Z");
    expect(s.unsavedFieldIds).toEqual([]);
    expect(s.lastSavedAt).toBe("2026-08-20T09:00:00Z");
    expect(hasUnsavedWork(s)).toBe(false);
  });

  it("counts attempts so a retry loop is visible", () => {
    let s = markSaving(markDirty(INITIAL_AUTOSAVE, "a"));
    s = markSaving(markFailed(s));
    expect(s.attempts).toBe(2);
    expect(markSaved(s, "x").attempts).toBe(0);
  });

  it("does not list one field twice when it is edited repeatedly", () => {
    const s = markDirty(markDirty(INITIAL_AUTOSAVE, "a"), "a");
    expect(s.unsavedFieldIds).toEqual(["a"]);
  });
});

describe("review and mapping", () => {
  it("shows every answered question, with labels not raw values", () => {
    const rows = reviewRows(completeAnswers());
    const drives = rows.find((r) => r.fieldId === "drives_clients");
    expect(drives?.answer).toBe("Yes");
  });

  it("keeps the signature off the review list", () => {
    expect(reviewRows(completeAnswers()).some((r) => r.step === "attestation")).toBe(false);
  });

  it("turns the application into employee fields, not a PDF to re-key", () => {
    const mapped = toEmployeeFields(completeAnswers());
    expect(mapped.legalName).toBe("Jamisha Harper");
    expect(mapped.phone).toBe("+17135550100");
    // Yes/no becomes a boolean here, so the compliance rules do not have to
    // know the application's vocabulary.
    expect(mapped.drives).toBe(true);
    expect(mapped.hasAutoInsurance).toBe(true);
  });

  it("omits what was never answered rather than writing empty strings", () => {
    const mapped = toEmployeeFields(prefillApplication(FACTS));
    expect(mapped.dateOfBirth).toBeUndefined();
    expect("emergencyContact" in mapped).toBe(false);
  });
});

describe("canSubmit", () => {
  it("names what is missing, so the candidate is not hunting", () => {
    const r = canSubmit(prefillApplication(FACTS));
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("Date of birth");
  });
});

function completeAnswers(): ApplicationAnswers {
  return {
    ...prefillApplication(FACTS),
    date_of_birth: "1988-04-12",
    work_authorized: "yes",
    address: "123 Example St, Houston TX 77002",
    emergency_contact: "A relative · 713-555-0180",
    years_experience: 6,
    employers: [{ name: "An agency", from: "2020", to: "2026", reason: "Relocating" }],
    days_available: ["mon", "tue", "wed", "thu", "fri"],
    hours_wanted: 40,
    shift_preference: ["mornings", "afternoons"],
    reliable_transport: "yes",
    drives_clients: "yes",
    auto_insurance: "yes",
    drivers_license: "yes",
    references: [{ name: "A supervisor", where: "An agency", phone: "713-555-0181" }],
    convictions: "no",
    attestation: "yes",
    signature: "Jamisha Harper",
  };
}
