import type { UserRole } from "@/domain/consents/witness";

/**
 * Who is a registered nurse.
 *
 * KARYNN, 21 AUGUST: "Supervisory visits can only be done by an RN."
 *
 * That sentence looks like it needs a one-word change to a role check, and it
 * does not — which is why this file exists rather than a narrowed constant.
 *
 * The supervisory visit rule was `rn_clinical` or `ceo_admin`, copied from the
 * consent witness rule where Karynn had said an RN *or* the owner may take a
 * signature. Narrowing it to `rn_clinical` alone would have locked Karynn out
 * of the one task she personally does, because her user record says
 * `ceo_admin`. She is the owner AND the RN; `user_role` has no way to say both.
 *
 * That is the actual defect. `user_role` is a job function — what somebody does
 * at Joy, who they report to, what screens they open. Being a registered nurse
 * is a licence held by a person, granted by the Texas Board of Nursing, with an
 * expiry date and a number. Conflating them means Joy can express "the RN on
 * staff" and cannot express "the owner, who is also an RN", or "a second nurse
 * hired next year who is not the clinical manager", or "an RN whose licence
 * lapsed last month and must stop doing supervisory visits today".
 *
 * So the question a rule asks is never "is your role rn_clinical". It is "do
 * you hold a current RN licence", and that is a fact about a person.
 */

export interface RnLicence {
  /** As issued. Joy records it; nothing here validates the format. */
  number: string;
  state: string;
  /** ISO date. A lapsed licence is not a licence. */
  expiresOn: string;
}

export interface ClinicalIdentity {
  role: UserRole;
  /** Null for everybody who is not a nurse, which is most people. */
  rnLicence?: RnLicence | null;
}

/**
 * Does this person hold a current RN licence?
 *
 * `rn_clinical` alone is not enough and never was: it is the job title, and a
 * clinical manager whose licence expired last month still has the title. The
 * licence is the thing the state cares about, so it is the thing this asks for.
 */
export function isRegisteredNurse(
  person: ClinicalIdentity | null | undefined,
  asOf: string,
): boolean {
  const licence = person?.rnLicence;
  if (!licence) return false;
  return licence.expiresOn.slice(0, 10) >= asOf.slice(0, 10);
}

/**
 * Why not, said to the person rather than about them.
 *
 * A blocked screen that does not explain itself gets worked around, and the
 * expired case in particular needs saying out loud: somebody who did this work
 * last month and cannot today will assume the software is broken unless it
 * tells them otherwise.
 */
export function rnRefusal(person: ClinicalIdentity | null | undefined, asOf: string): string {
  if (isRegisteredNurse(person, asOf)) return "";
  if (!person) return "We cannot tell who you are, so this cannot be recorded from this session.";
  if (!person.rnLicence) {
    return "This has to be done by a registered nurse, and Joy has no RN licence on file for you.";
  }
  return `Your RN licence on file expired on ${person.rnLicence.expiresOn}. Joy cannot record this until it is renewed.`;
}
