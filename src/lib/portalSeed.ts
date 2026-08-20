import type { E164 } from "@/domain/portal/phone";
import type { PortalGrant } from "@/domain/portal/identity";

/**
 * Demo portal grants.
 *
 * Clients are fictional, as everywhere in this repository — being a care
 * recipient is health information about you, and a seed file is not the place
 * for it. Caregiver names here are fictional too, because a grant ties a name
 * to a phone number, and inventing a number for a real member of staff would
 * be worse than inventing both.
 *
 * The third number is the one worth keeping: one person holding two grants, so
 * the mode picker and the audit basis have something real to exercise. That is
 * the case `0001_foundation.sql` opens by insisting on — a daughter who is her
 * father's responsible party and later applies as a caregiver.
 */

export const seedPortalGrants: Array<PortalGrant & { id: string; phone: E164 }> = [
  // A caregiver mid-onboarding. Lands on the workforce portal.
  {
    id: "grant_1",
    phone: "+17135550100",
    audience: "workforce",
    personId: "p-jamisha",
    subjectPersonId: null,
    greetingName: "Jamisha",
    subjectName: null,
    state: "onboarding",
    active: true,
  },

  // A responsible party before start of care. Lands on the family portal.
  {
    id: "grant_2",
    phone: "+17135550110",
    audience: "family",
    personId: "p-susan",
    subjectPersonId: "p-marcus",
    greetingName: "Susan",
    subjectName: "Marcus",
    state: "pre_admission",
    active: true,
  },

  // Both, on one number. This is the case the mode picker exists for.
  {
    id: "grant_3",
    phone: "+17135550120",
    audience: "workforce",
    personId: "p-renee",
    subjectPersonId: null,
    greetingName: "Renee",
    subjectName: null,
    state: "active",
    active: true,
  },
  {
    id: "grant_4",
    phone: "+17135550120",
    audience: "family",
    personId: "p-renee",
    subjectPersonId: "p-albert",
    greetingName: "Renee",
    subjectName: "Albert",
    state: "active",
    active: true,
  },

  // A candidate Joy decided against.
  //
  // Worth being precise about what this number does, because it is not what
  // you would guess: it never receives a code at all. `evaluateRequest` treats
  // "no active grant" as unknown, so nothing is sent — and that is correct. If
  // Joy texted codes to former candidates but not to strangers, then getting a
  // code would itself confirm a past relationship with the agency, which is
  // the same enumeration leak in a narrower form.
  //
  // So `PortalClosed` is not reached from here. It exists for the grant that
  // is revoked between the code going out and the code being entered, and for
  // anyone holding only grants that lapse while they are signed in.
  {
    id: "grant_5",
    phone: "+17135550130",
    audience: "workforce",
    personId: "p-closed",
    subjectPersonId: null,
    greetingName: "",
    subjectName: null,
    state: "closed",
    active: false,
  },
];
