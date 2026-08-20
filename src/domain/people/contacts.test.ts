import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_AFTER_DAYS,
  contactLine,
  contactStanding,
  displayName,
  isReferrer,
  needsFollowUp,
  searchContacts,
  sortContacts,
  canSave,
  contactFromDraft,
  draftProblems,
  recordContact,
  EMPTY_DRAFT,
  type Contact,
  type ContactDraft,
} from "@/domain/people/contacts";

const TODAY = "2026-08-20";

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    name: "Bria Bonnette",
    credentials: "LCSW",
    title: "Social Worker II",
    organization: "Houston Methodist",
    unit: "Skilled Nursing Unit",
    kind: "discharge_planner",
    email: "bbonnette@houstonmethodist.org",
    phone: "(346) 453-6979",
    address: null,
    notes: null,
    addedOn: TODAY,
    lastContactedOn: TODAY,
    referrals: [],
    ...over,
  };
}

describe("how a contact reads", () => {
  it("puts the credentials after the name, the way it is said", () => {
    expect(displayName(contact())).toBe("Bria Bonnette, LCSW");
    expect(displayName(contact({ credentials: null }))).toBe("Bria Bonnette");
  });

  it("builds the line under the name from what is known", () => {
    expect(contactLine(contact())).toBe(
      "Social Worker II · Skilled Nursing Unit · Houston Methodist",
    );
    // A vendor with no unit should not read "Acme ·  · Acme".
    expect(contactLine(contact({ title: null, unit: null }))).toBe("Houston Methodist");
  });
});

describe("who is worth chasing", () => {
  it("counts an outreach specialist as a referrer", () => {
    // Connecting their organisation's patients to services is the job. Filing
    // him as a "partner" would drop him off the follow-up list, which is the
    // one thing about him that matters.
    expect(isReferrer(contact({ kind: "outreach", referrals: [] }))).toBe(true);
  });

  it("does not chase a broker manager on the referral clock", () => {
    // An insurance channel rather than a clinical one. Worth having when an
    // LTC insurance question comes up; not worth a quarterly call.
    const quiet = contact({ kind: "partner", lastContactedOn: "2026-01-01" });
    expect(needsFollowUp(quiet, TODAY)).toBe(false);
  });

  it("treats a discharge planner as a referrer before she has referred anybody", () => {
    // The point of recording her is what she might send, not what she has.
    expect(isReferrer(contact({ referrals: [] }))).toBe(true);
  });

  it("treats anybody who has referred as a referrer, whatever their kind", () => {
    expect(isReferrer(contact({ kind: "community", referrals: ["adm-1"] }))).toBe(true);
    expect(isReferrer(contact({ kind: "community", referrals: [] }))).toBe(false);
  });

  it("does not chase a vendor", () => {
    // A supplier Joy has not spoken to since March is not a problem.
    const quiet = contact({ kind: "vendor", lastContactedOn: "2026-01-01" });
    expect(needsFollowUp(quiet, TODAY)).toBe(false);
  });

  it("chases a referrer who has gone quiet", () => {
    const quiet = contact({ lastContactedOn: "2026-04-01" });
    expect(needsFollowUp(quiet, TODAY)).toBe(true);
  });

  it("leaves a recent conversation alone", () => {
    expect(needsFollowUp(contact({ lastContactedOn: "2026-08-01" }), TODAY)).toBe(false);
  });

  it("counts from when they were added if nobody has ever called", () => {
    // Somebody entered months ago and never rung is the case this exists for.
    const never = contact({ addedOn: "2026-01-01", lastContactedOn: null });
    expect(needsFollowUp(never, TODAY)).toBe(true);
  });

  it("gives a new contact the full window before nagging", () => {
    const fresh = contact({ addedOn: TODAY, lastContactedOn: null });
    expect(needsFollowUp(fresh, TODAY)).toBe(false);
    expect(FOLLOW_UP_AFTER_DAYS).toBe(90);
  });
});

describe("what the list says about somebody", () => {
  it("leads with referrals, because that is the reason to care", () => {
    expect(contactStanding(contact({ referrals: ["a", "b"] }), TODAY)).toContain("2 referrals");
  });

  it("says plainly when nobody has spoken to them", () => {
    expect(contactStanding(contact({ lastContactedOn: null }), TODAY)).toBe("not spoken to yet");
  });

  it("switches from days to months once it has been a while", () => {
    expect(contactStanding(contact({ lastContactedOn: "2026-08-18" }), TODAY)).toBe(
      "spoke 2 days ago",
    );
    expect(contactStanding(contact({ lastContactedOn: "2026-04-01" }), TODAY)).toContain(
      "no contact in 4 months",
    );
  });
});

describe("the directory", () => {
  it("puts whoever needs chasing at the top, then sorts by name", () => {
    const list = [
      contact({ id: "z", name: "Zoe Adams", lastContactedOn: TODAY }),
      contact({ id: "a", name: "Adam Zieler", lastContactedOn: TODAY }),
      contact({ id: "q", name: "Quiet Referrer", lastContactedOn: "2026-01-01" }),
    ];
    expect(sortContacts(list, TODAY).map((c) => c.id)).toEqual(["q", "a", "z"]);
  });

  it("searches the fields somebody would actually type", () => {
    // Every field of the second contact has to differ, including the email —
    // the first version left it as bbonnette@houstonmethodist.org, so a search
    // for "methodist" correctly matched both and the fixture was the bug.
    const list = [
      contact(),
      contact({
        id: "c2",
        name: "Someone Else",
        organization: "Elsewhere",
        unit: null,
        email: "someone@elsewhere.example",
      }),
    ];
    expect(searchContacts(list, "methodist").map((c) => c.id)).toEqual(["c1"]);
    expect(searchContacts(list, "skilled nursing").map((c) => c.id)).toEqual(["c1"]);
    expect(searchContacts(list, "").length).toBe(2);
  });

});


describe("adding a contact", () => {
  const draft = (over: Partial<ContactDraft> = {}): ContactDraft => ({
    ...EMPTY_DRAFT,
    name: "Kerwin Jones",
    email: "kjones11@villagemd.com",
    ...over,
  });

  it("insists on a name", () => {
    expect(draftProblems(draft({ name: "" }))).toContain("no_name");
    expect(canSave(draft({ name: "" }))).toBe(false);
  });

  it("insists on some way to reach them", () => {
    // A row with a name and no email or phone is a note, not a contact, and it
    // sits in the list looking like something Joy can act on.
    expect(draftProblems(draft({ email: "", phone: "" }))).toContain("no_way_to_reach");
    expect(canSave(draft({ email: "", phone: "(346) 589-6432" }))).toBe(true);
  });

  it("accepts everything else being blank", () => {
    // Cards vary. A form that demands completeness gets abandoned halfway,
    // which loses the contact entirely.
    expect(canSave(draft())).toBe(true);
  });

  it("catches an obviously wrong email without being clever about it", () => {
    expect(draftProblems(draft({ email: "kjones11" }))).toContain("bad_email");
    // A stricter pattern rejects real addresses; the cost of a typo here is a
    // bounced email, not a broken record.
    expect(draftProblems(draft({ email: "k.jones+home@village-md.co.uk" }))).toEqual([]);
  });

  it("turns blanks into nulls rather than empty strings", () => {
    // An empty string renders as a gap where a field should be; null renders
    // as nothing at all, which is what "the card did not say" looks like.
    const contact = contactFromDraft({ draft: draft(), id: "c9", today: TODAY });
    expect(contact.credentials).toBeNull();
    expect(contact.unit).toBeNull();
    expect(contact.address).toBeNull();
  });

  it("counts today as the day they were spoken to", () => {
    // Somebody typing in a card was almost always handed it that day. Leaving
    // it null puts a brand-new contact on the follow-up list in ninety days
    // having never been rung, which is true and useless.
    const contact = contactFromDraft({ draft: draft(), id: "c9", today: TODAY });
    expect(contact.lastContactedOn).toBe(TODAY);
    expect(needsFollowUp(contact, TODAY)).toBe(false);
  });

  it("keeps the kind the person chose", () => {
    const contact = contactFromDraft({ draft: draft({ kind: "outreach" }), id: "c9", today: TODAY });
    expect(contact.kind).toBe("outreach");
    expect(isReferrer(contact)).toBe(true);
  });
});

describe("recording a conversation", () => {
  it("resets the follow-up clock", () => {
    // Without this every contact turns amber after three months and the list
    // becomes noise somebody learns to ignore.
    const stale = contact({ lastContactedOn: "2026-01-01" });
    expect(needsFollowUp(stale, TODAY)).toBe(true);
    expect(needsFollowUp(recordContact(stale, TODAY), TODAY)).toBe(false);
  });

  it("takes the date only, whatever it is given", () => {
    expect(recordContact(contact(), "2026-08-20T14:32:00Z").lastContactedOn).toBe("2026-08-20");
  });
});
