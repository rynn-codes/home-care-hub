import { describe, expect, it } from "vitest";
import {
  INTAKE_QUESTIONS,
  activeQuestions,
  canCompleteIntake,
  displayAnswer,
  followUp,
  intakeProgress,
  missingRequired,
  type IntakeAnswers,
} from "@/domain/admissions/intake";

const TODAY = "2026-08-18";

/** Answers every required question on whichever branch is active. */
function complete(base: IntakeAnswers): IntakeAnswers {
  const answers: IntakeAnswers = { ...base };
  for (let pass = 0; pass < 2; pass += 1) {
    for (const q of activeQuestions(answers)) {
      if (!q.required || answers[q.id] !== undefined) continue;
      answers[q.id] =
        q.kind === "multichoice"
          ? [q.options?.[0].value ?? "x"]
          : q.kind === "weekdays"
            ? ["mon"]
            : q.kind === "number"
              ? 20
              : q.kind === "choice"
                ? q.options?.[0].value
                : "captured";
    }
  }
  return answers;
}

describe("the paper intake form is covered", () => {
  const ids = INTAKE_QUESTIONS.map((q) => q.id);

  // Fields that were missing until the form was reconciled on 18 Aug.
  it("asks everything the two-page form asks", () => {
    for (const id of [
      "caller_phone",
      "caller_email",
      "referral_source_heard",
      "care_need_details",
      "requested_hours_window",
      "consultation_scheduled",
      "consultation_location",
      "consultation_attendees",
      "no_consultation_reason",
      "followup_date",
      "preferred_contact_method",
    ]) {
      expect(ids, `form asks for ${id}`).toContain(id);
    }
  });

  // The form marks the address "collect when scheduling home visit", which is
  // also what §11 requires. It must not migrate to the top of the call.
  it("does not demand the street address before there is a visit to attach it to", () => {
    const early = INTAKE_QUESTIONS.slice(0, INTAKE_QUESTIONS.findIndex((q) => q.id === "consultation_scheduled"));
    expect(early.map((q) => q.id)).not.toContain("consultation_location");
  });
});

describe("the consultation branch", () => {
  it("asks about the visit when one was booked, and nothing about following up", () => {
    const ids = activeQuestions({ consultation_scheduled: "yes" }).map((q) => q.id);
    expect(ids).toContain("consultation_date");
    expect(ids).toContain("consultation_attendees");
    expect(ids).not.toContain("followup_date");
    expect(ids).not.toContain("no_consultation_reason");
  });

  it("asks how to follow up when no visit was booked, and nothing about the visit", () => {
    const ids = activeQuestions({ consultation_scheduled: "no" }).map((q) => q.id);
    expect(ids).toContain("followup_date");
    expect(ids).toContain("preferred_contact_method");
    expect(ids).not.toContain("consultation_date");
  });

  it("asks neither side until the question is answered", () => {
    const ids = activeQuestions({}).map((q) => q.id);
    expect(ids).not.toContain("consultation_date");
    expect(ids).not.toContain("followup_date");
  });

  // Counting against the whole list would strand an intake at "4 still needed"
  // for four questions on a branch nobody is being asked.
  it("counts progress against the branch in play, not the whole form", () => {
    const booked = complete({ consultation_scheduled: "yes" });
    expect(missingRequired(booked)).toEqual([]);
    expect(canCompleteIntake(booked)).toBe(true);

    const notBooked = complete({ consultation_scheduled: "no" });
    expect(canCompleteIntake(notBooked)).toBe(true);

    // The denominator is the branch, not the form. Four questions belonging to
    // the branch nobody is on must not sit in the total for ever.
    expect(intakeProgress(booked).total).toBe(activeQuestions(booked).length);
    expect(intakeProgress(booked).total).toBeLessThan(INTAKE_QUESTIONS.length);
  });

  it("will not complete while the branch it is on has gaps", () => {
    const answers = complete({ consultation_scheduled: "no" });
    delete answers.followup_date;
    expect(canCompleteIntake(answers)).toBe(false);
    expect(missingRequired(answers).map((q) => q.id)).toContain("followup_date");
  });
});

describe("follow-up state", () => {
  it("reports a booked visit rather than a follow-up", () => {
    const state = followUp({ consultation_scheduled: "yes", consultation_date: "2026-08-25" }, TODAY);
    expect(state.state).toBe("booked");
    expect(state.note).toMatch(/2026-08-25/);
  });

  it("escalates a follow-up date that has passed", () => {
    expect(followUp({ consultation_scheduled: "no", followup_date: "2026-08-01" }, TODAY).state).toBe(
      "overdue",
    );
  });

  it("separates due today from booked for later", () => {
    expect(followUp({ consultation_scheduled: "no", followup_date: TODAY }, TODAY).state).toBe("due");
    expect(followUp({ consultation_scheduled: "no", followup_date: "2026-09-01" }, TODAY).state).toBe(
      "scheduled",
    );
  });

  // A lead marked "not yet" with no date is worse than one left blank: it looks
  // handled, and nobody ever rings back.
  it("treats no visit and no follow-up date as already overdue", () => {
    const state = followUp({ consultation_scheduled: "no" }, TODAY);
    expect(state.state).toBe("overdue");
    expect(state.note).toMatch(/no follow-up date/i);
  });

  it("says nothing has been decided when the call has not reached that point", () => {
    expect(followUp({}, TODAY).state).toBe("none");
  });
});

describe("care need details", () => {
  it("reads back only the needs that got a detail", () => {
    const q = INTAKE_QUESTIONS.find((x) => x.id === "care_need_details")!;
    const shown = displayAnswer(q, { bathing: "Shower bench", dressing: "  ", mobility: "Walker" });
    expect(shown).toContain("Bathing: Shower bench");
    expect(shown).toContain("Mobility: Walker");
    expect(shown).not.toContain("Dressing");
  });

  it("does not count an object of blank lines as answered", () => {
    const q = INTAKE_QUESTIONS.find((x) => x.id === "care_need_details")!;
    expect(displayAnswer(q, { bathing: "", mobility: "   " })).toBe("Not captured");
  });
});
