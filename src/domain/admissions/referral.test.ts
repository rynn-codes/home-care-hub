import { describe, expect, it } from "vitest";
import {
  emptyReferral,
  isReadyForDuplicateCheck,
  isReferralValid,
  toDuplicateQuery,
  validateReferral,
  type ReferralDraft,
} from "@/domain/admissions/referral";

const base: ReferralDraft = {
  ...emptyReferral,
  firstName: "Tammy",
  lastName: "Wilson",
  phone: "713-555-0101",
};

describe("referral validation", () => {
  it("accepts the minimum: a name and one way to reach someone", () => {
    expect(isReferralValid(base)).toBe(true);
  });

  it("requires a first and last name", () => {
    const errors = validateReferral({ ...base, firstName: "", lastName: "  " });
    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
  });

  // A referral nobody can call back is not a lighter record, it is a lost one.
  it("refuses a referral with no phone and no email", () => {
    const errors = validateReferral({ ...base, phone: "", email: "" });
    expect(errors.phone).toContain("follow up");
  });

  it("accepts email alone as the contact route", () => {
    expect(isReferralValid({ ...base, phone: "", email: "family@example.com" })).toBe(true);
  });

  it("accepts the contact's phone when the client has none of their own", () => {
    expect(
      isReferralValid({
        ...base,
        phone: "",
        contactIsSomeoneElse: true,
        contactName: "Susan Bell",
        contactRelationship: "Daughter",
        contactPhone: "713-555-0134",
      }),
    ).toBe(true);
  });

  // One of the brief's named Sprint 1 failure tests.
  it("rejects a malformed email", () => {
    for (const email of ["nope", "a@b", "a@b.c", "@example.com", "spaces @example.com"]) {
      expect(validateReferral({ ...base, email }).email, email).toBeDefined();
    }
    expect(validateReferral({ ...base, email: "susan.bell@example.com" }).email).toBeUndefined();
  });

  it("rejects a phone number missing its area code", () => {
    expect(validateReferral({ ...base, phone: "555-0101" }).phone).toContain("area code");
  });

  // The specific message must survive. Telling someone to "add a phone number"
  // when they just typed one is the generic-error failure mode section 43 bans.
  it("keeps the specific message when a contact detail is malformed", () => {
    expect(validateReferral({ ...base, phone: "555", email: "" }).phone).toContain("area code");
    expect(validateReferral({ ...base, phone: "", email: "nope" }).email).toContain("look right");
    expect(validateReferral({ ...base, phone: "", email: "" }).phone).toContain("follow up");
  });

  it("asks who called when the contact is someone else", () => {
    const errors = validateReferral({ ...base, contactIsSomeoneElse: true });
    expect(errors.contactName).toBeDefined();
    expect(errors.contactRelationship).toBeDefined();
  });

  // Choosing a contact method with no matching details is how a callback
  // quietly never happens.
  it("will not accept a contact method it has no details for", () => {
    expect(
      validateReferral({ ...base, bestContactMethod: "email", email: "" }).bestContactMethod,
    ).toContain("email address");

    expect(
      validateReferral({
        ...base,
        phone: "",
        email: "family@example.com",
        bestContactMethod: "text",
      }).bestContactMethod,
    ).toContain("phone number");
  });

  it("asks where an 'other' referral actually came from", () => {
    expect(
      validateReferral({ ...base, referralSource: "other" }).referralSourceDetail,
    ).toBeDefined();
    expect(
      validateReferral({
        ...base,
        referralSource: "other",
        referralSourceDetail: "Church group",
      }).referralSourceDetail,
    ).toBeUndefined();
  });

  it("does not ask for a full address — that belongs to assessment scheduling", () => {
    expect(Object.keys(emptyReferral)).not.toContain("addressLine1");
    expect(validateReferral({ ...base, serviceArea: "" }).serviceArea).toBeUndefined();
  });
});

describe("duplicate check readiness", () => {
  it("waits until there is enough name to be worth checking", () => {
    expect(isReadyForDuplicateCheck({ ...emptyReferral, firstName: "M", lastName: "" })).toBe(false);
    expect(isReadyForDuplicateCheck({ ...emptyReferral, firstName: "Ma", lastName: "B" })).toBe(
      false,
    );
    expect(isReadyForDuplicateCheck(base)).toBe(true);
  });

  it("uses the contact's phone and name when the client has none", () => {
    const query = toDuplicateQuery({
      ...base,
      phone: "",
      contactIsSomeoneElse: true,
      contactName: "Susan Bell",
      contactPhone: "713-555-0134",
    });
    expect(query.phone).toBe("713-555-0134");
    expect(query.responsiblePartyName).toBe("Susan Bell");
  });

  it("does not pass a contact name when the client is the caller", () => {
    expect(toDuplicateQuery(base).responsiblePartyName).toBeNull();
  });
});
