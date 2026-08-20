import { describe, expect, it } from "vitest";
import {
  approveMoment,
  checkMoment,
  draftMoment,
  editMoment,
  mayApprove,
  momentsTimeline,
  requiresOfficeReview,
  withholdMoment,
  type Moment,
} from "@/domain/portal/moments";

/** Clients are fictional throughout this repository. */
const CAREGIVER = { personId: "p-jamisha", isOffice: false };
const OFFICE = { personId: "p-karynn", isOffice: true };

function moment(over: Partial<Moment> = {}): Moment {
  return {
    ...draftMoment({
      id: "m1",
      visitId: "v1",
      clientPersonId: "c1",
      narrative: "She watched Family Feud and talked about her garden.",
      byPersonId: CAREGIVER.personId,
      at: "2026-08-20T13:10:00Z",
    }),
    ...over,
  };
}

describe("§13 — a Moment is not the chart", () => {
  it("takes the caregiver's answer and nothing else", () => {
    // The separation is in the signature: there is no parameter for a
    // VisitRecord or a ChartDraft, so there is nowhere to pass one in.
    const m = moment();
    expect(m.narrative).toBe("She watched Family Feud and talked about her garden.");
    expect(m.body).toBe(m.narrative);
  });

  it("refuses a Moment that reads like a chart line", () => {
    const check = checkMoment({
      body: "Bathing assistance completed. Medication reminder given.",
      disclosureConsent: "accept",
    });
    expect(check.ok).toBe(false);
    expect(check.problems[0].problem).toBe("clinical_content");
  });

  it("refuses an incident dressed up as a warm update", () => {
    // The specific failure worth preventing: a daughter learning her mother
    // fell, from a page headed "a little moment from today".
    const check = checkMoment({
      body: "She had a small fall in the hallway but she was cheerful afterwards.",
      disclosureConsent: "accept",
    });
    expect(check.ok).toBe(false);
    expect(check.problems.some((p) => p.problem === "clinical_content")).toBe(true);
  });

  it("keeps notes meant for the office out of the family portal", () => {
    const check = checkMoment({
      body: "Lovely afternoon. Please call the office about the care plan update.",
      disclosureConsent: "accept",
    });
    expect(check.problems.some((p) => p.problem === "staff_note")).toBe(true);
  });

  it("lets an ordinary warm update through", () => {
    expect(
      checkMoment({
        body: "She enjoyed watching Family Feud and spent time talking about her garden.",
        disclosureConsent: "accept",
      }).ok,
    ).toBe(true);
  });
});

describe("§15 — communication permissions", () => {
  it("will not share anything for a client who authorised nobody", () => {
    // The packet's disclosure list, p14. Karynn's own words: "Everyone else
    // gets nothing, including family." A Moment is a gentle disclosure and
    // still a disclosure.
    const check = checkMoment({ body: "A lovely afternoon in the garden.", disclosureConsent: "decline" });
    expect(check.ok).toBe(false);
    expect(check.problems[0].problem).toBe("not_authorised");
  });

  it("treats 'not applicable' the same as a decline", () => {
    const check = checkMoment({
      body: "A lovely afternoon in the garden.",
      disclosureConsent: "not_applicable",
    });
    expect(check.problems.some((p) => p.problem === "not_authorised")).toBe(true);
  });

  it("blocks approval outright, however carefully worded", () => {
    expect(() =>
      approveMoment({
        moment: moment(),
        approver: CAREGIVER,
        disclosureConsent: "decline",
        at: "2026-08-20T13:20:00Z",
      }),
    ).toThrow(/not authorised anyone/);
  });
});

describe("§14 — approval", () => {
  it("records who wrote it, who approved it and when it was shared", () => {
    const shared = approveMoment({
      moment: moment(),
      approver: CAREGIVER,
      disclosureConsent: "accept",
      at: "2026-08-20T13:20:00Z",
    });
    expect(shared.createdByPersonId).toBe("p-jamisha");
    expect(shared.approvedByPersonId).toBe("p-jamisha");
    expect(shared.sharedAt).toBe("2026-08-20T13:20:00Z");
    expect(shared.state).toBe("shared");
  });

  it("refuses a Moment with no author", () => {
    expect(() =>
      draftMoment({
        id: "m1",
        visitId: "v1",
        clientPersonId: "c1",
        narrative: "Anything",
        byPersonId: null,
        at: "t",
      }),
    ).toThrow(/needs the caregiver who wrote it/);
  });

  it("lets a caregiver publish her own words", () => {
    expect(mayApprove(CAREGIVER, moment())).toBe(true);
  });

  it("will not share the same Moment twice", () => {
    const shared = approveMoment({
      moment: moment(),
      approver: CAREGIVER,
      disclosureConsent: "accept",
      at: "t1",
    });
    expect(() =>
      approveMoment({ moment: shared, approver: CAREGIVER, disclosureConsent: "accept", at: "t2" }),
    ).toThrow(/already been shared/);
  });

  it("treats skipping as an answer rather than an empty draft", () => {
    // A caregiver who had a quiet shift must not be nagged into inventing
    // something charming — that is how §15's "never invent" gets broken.
    const skipped = moment({ narrative: "", body: "", state: "skipped" });
    expect(skipped.state).toBe("skipped");
    expect(() =>
      approveMoment({ moment: skipped, approver: CAREGIVER, disclosureConsent: "accept", at: "t" }),
    ).toThrow(/no Moment here/);
  });
});

describe("Karynn's rule — review depends on who wrote the wording", () => {
  // 20 Aug, asked whether caregivers should share directly or the office should
  // review: "This will depend on if AI is providing the moment based off of the
  // caregiver's update."
  const drafted = () => moment({ origin: "ai_drafted" });

  it("lets a caregiver share her own sentence without a queue", () => {
    expect(requiresOfficeReview(moment())).toBe(false);
    expect(() =>
      approveMoment({ moment: moment(), approver: CAREGIVER, disclosureConsent: "accept", at: "t" }),
    ).not.toThrow();
  });

  it("sends a drafted one to the office first", () => {
    // A model rewriting her sentence introduces a step where a fact can
    // change, which is what the second pair of eyes is for.
    expect(requiresOfficeReview(drafted())).toBe(true);
    expect(() =>
      approveMoment({ moment: drafted(), approver: CAREGIVER, disclosureConsent: "accept", at: "t" }),
    ).toThrow(/drafted rather than written/);
  });

  it("lets the office publish a drafted one", () => {
    const shared = approveMoment({
      moment: drafted(),
      approver: OFFICE,
      disclosureConsent: "accept",
      at: "t",
    });
    expect(shared.state).toBe("shared");
    expect(shared.approvedByPersonId).toBe("p-karynn");
  });

  it("hands it back to the caregiver once she rewrites it herself", () => {
    // Gating on provenance rather than on who typed last is what makes this
    // work: she has taken the words back, so the extra review lapses.
    const rewritten = editMoment(drafted(), "She watched her programme and we talked about the garden.");
    expect(rewritten.origin).toBe("caregiver");
    expect(mayApprove(CAREGIVER, rewritten)).toBe(true);
  });

  it("needs nobody to remember a setting when drafting is connected", () => {
    // The gate is the origin. The day a model starts writing these, they start
    // needing review, because the data says so.
    expect(requiresOfficeReview(moment({ origin: "ai_drafted" }))).toBe(true);
    expect(requiresOfficeReview(moment({ origin: "caregiver" }))).toBe(false);
  });
});

describe("editing", () => {
  it("never overwrites what the caregiver actually wrote", () => {
    // If a Moment is questioned, "what did she write" must have an answer, and
    // whoever changed it is not the person credited with writing it.
    const edited = editMoment(moment(), "Evelyn enjoyed Family Feud and talked about her garden.");
    expect(edited.narrative).toBe("She watched Family Feud and talked about her garden.");
    expect(edited.edited).toBe(true);
  });

  it("does not flag an edit that changed nothing", () => {
    const m = moment();
    expect(editMoment(m, m.narrative).edited).toBe(false);
  });

  it("checks the edit, not the original", () => {
    const edited = editMoment(moment(), "She was given her medication on time.");
    expect(() =>
      approveMoment({ moment: edited, approver: CAREGIVER, disclosureConsent: "accept", at: "t" }),
    ).toThrow(/visit chart/);
  });
});

describe("§16 — a care history, not a feed", () => {
  const asOf = new Date("2026-08-20T18:00:00Z");

  function shared(id: string, at: string, body: string): Moment {
    return moment({ id, state: "shared", sharedAt: at, body });
  }

  it("shows only what was actually shared", () => {
    const entries = momentsTimeline(
      [
        shared("a", "2026-08-20T13:00:00Z", "Today's moment"),
        moment({ id: "b", state: "draft" }),
        withholdMoment(moment({ id: "c" }), "Office review"),
      ],
      asOf,
    );
    expect(entries.map((e) => e.id)).toEqual(["a"]);
  });

  it("puts the most recent first", () => {
    const entries = momentsTimeline(
      [
        shared("old", "2026-08-15T13:00:00Z", "Older"),
        shared("new", "2026-08-20T13:00:00Z", "Newer"),
      ],
      asOf,
    );
    expect(entries.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("says Today rather than a date, for today", () => {
    expect(momentsTimeline([shared("a", "2026-08-20T13:00:00Z", "x")], asOf)[0].when).toBe("Today");
    expect(momentsTimeline([shared("a", "2026-08-15T13:00:00Z", "x")], asOf)[0].when).toBe("Aug 15");
  });

  it("carries no author, no counts and nothing to react to", () => {
    // A byline turns a note about somebody's mother into a post by somebody.
    const entry = momentsTimeline([shared("a", "2026-08-20T13:00:00Z", "x")], asOf)[0];
    expect(Object.keys(entry).sort()).toEqual(["body", "id", "when"]);
  });
});

