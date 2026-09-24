/**
 * How somebody is entitled to work here, and whether that entitlement lapses.
 *
 * Karynn's rule — a work permit for non-citizens — is right in intent and
 * needed one correction: a lawful permanent resident has no work permit and
 * never will, so asking for one asks for a document that cannot exist.
 * "Not a US citizen" is three answers, not one.
 *
 * The rule Joy enforces is "the right to work expires", which does the right
 * thing for all three. It rides on the credential engine
 * (`requiredForWorkAuthorization` on a requirement) rather than a second
 * mechanism, so an expired permit blocks scheduling exactly like an expired TB
 * test — and stays off a citizen's file, because a permanently red file is one
 * nobody reads.
 */

export type WorkAuthorizationBasis = "citizen" | "permanent_resident" | "work_permit";

export const WORK_AUTHORIZATION_LABELS: Record<WorkAuthorizationBasis, string> = {
  citizen: "U.S. citizen or national",
  permanent_resident: "Lawful permanent resident",
  work_permit: "Authorized to work with a permit",
};

export const WORK_AUTHORIZATION_OPTIONS = (Object.keys(WORK_AUTHORIZATION_LABELS) as WorkAuthorizationBasis[]).map(
  (value) => ({ value, label: WORK_AUTHORIZATION_LABELS[value] }),
);

/**
 * Whether this person's right to work has an expiry Joy must watch.
 *
 * Undefined — nobody has asked — reads as "no expiry to watch", so a work
 * permit is never invented for somebody who was never asked.
 */
export function authorizationExpires(basis: WorkAuthorizationBasis | undefined | null): boolean {
  return basis === "work_permit";
}
