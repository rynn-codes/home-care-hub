import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_AFTER_DAYS,
  byOrganization,
  contactLine,
  contactStanding,
  displayName,
  isReferrer,
  needsFollowUp,
  searchContacts,
  sortContacts,
  type Contact,
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

  it("groups by organization, because that is how referrals arrive", () => {
    const list = [contact(), contact({ id: "c2", organization: null })];
    expect(byOrganization(list).map(([org]) => org)).toEqual([
      "Houston Methodist",
      "No organization",
    ]);
  });
});
