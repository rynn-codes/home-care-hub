import { describe, expect, it } from "vitest";
import { clinicalTermIn, staffTermIn } from "@/domain/portal/familySafeText";

describe("the sentences a caregiver actually writes", () => {
  // REGRESSION. The first version matched bare substrings, so `med` fired
  // inside "seeMED in good spirits" and the check refused the most natural
  // sentence in the whole feature. A rule that rejects normal writing is not
  // cautious — people route around it by writing worse Moments, or stop.
  const ordinary = [
    "Marcus enjoyed a quiet afternoon and seemed in good spirits.",
    "She seemed tired but happy after lunch.",
    "He seemed pleased to see me.",
    "We talked about the lake house and she seemed to enjoy it.",
    "They watched Family Feud together all afternoon.",
    "She enjoyed gospel music while I made breakfast.",
    "He beat me at chess and made sure I knew it.",
    "We sat on the porch and looked through old photographs.",
  ];

  it("lets every one of them through", () => {
    for (const sentence of ordinary) {
      expect(clinicalTermIn(sentence)).toBeNull();
      expect(staffTermIn(sentence)).toBeNull();
    }
  });
});

describe("what it must still catch", () => {
  const clinical: Array<[string, string]> = [
    ["I gave her the medication at nine.", "medication"],
    ["Reminded him about his meds.", "med"],
    ["She had a small fall in the hallway.", "fall"],
    ["He fell getting out of the chair.", "fell"],
    ["Her blood pressure was a little high.", "blood pressure"],
    ["He was agitated in the evening.", "agitat"],
    ["She seemed confused about the date.", "confus"],
    ["An incident report has been filed.", "incident"],
    ["She refused care this morning.", "refused care"],
  ];

  it("catches each one", () => {
    for (const [sentence, term] of clinical) {
      expect(clinicalTermIn(sentence)).toBe(term);
    }
  });

  it("catches notes meant for the office", () => {
    expect(staffTermIn("Lovely day. Please call the office about the schedule.")).toBe(
      "call the office",
    );
  });
});

describe("word boundaries", () => {
  it("matches a stem at the start of a word", () => {
    // `diagnos` is a stem on purpose.
    expect(clinicalTermIn("Her diagnosis was explained to her.")).toBe("diagnos");
    expect(clinicalTermIn("He was diagnosed last spring.")).toBe("diagnos");
  });

  it("does not fire in the middle of an unrelated word", () => {
    expect(clinicalTermIn("The rainfall was heavy all afternoon.")).toBeNull();
    expect(clinicalTermIn("She seemed comfortable.")).toBeNull();
    expect(clinicalTermIn("We listened to the radio.")).toBeNull();
  });

  it("is not fooled by capitals", () => {
    expect(clinicalTermIn("MEDICATION given at nine.")).toBe("medication");
  });
});
