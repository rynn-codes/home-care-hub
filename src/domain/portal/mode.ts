import type { PortalAudience, PortalGrant, PortalIdentity } from "@/domain/portal/identity";

/**
 * Which hat someone is wearing, for the small number of people who have two.
 *
 * `0001_foundation.sql` opens by insisting that a daughter who is her father's
 * responsible party and later applies as a caregiver is ONE row in people. That
 * is the right call, and this file is the bill for it: one phone number now
 * unlocks two portals, and Joy has to know which one she is standing in.
 *
 * WHY THIS IS NOT A NAVIGATION PREFERENCE
 *
 * The mode decides what the audit log is able to say. When she opens a client
 * record in work mode, that is a staff access justified by her assignment to
 * that client. When she opens her father's record in care mode, that is a
 * family access justified by his authorization of her. Same person, same
 * screen, two entirely different legal justifications for the same read.
 *
 * A Joy that could not tell them apart would be unable to answer "why did this
 * employee view this record", which is the first question asked in any
 * investigation. So the mode is recorded on the access, not merely used to pick
 * a colour scheme.
 *
 * KARYNN'S DECISION, 20 AUG
 *
 * Ask once, then remember, with the mode named on every screen. She rejected
 * asking at every sign-in — the daily path is a caregiver checking her
 * schedule, and taxing that forever to serve a rare case is the wrong trade.
 *
 * That choice is only safe if the indicator is genuinely unmissable, so
 * `modeBanner` returns words rather than an icon, and `mustShowIndicator` is
 * true for the whole session for anyone holding two grants. A subtle badge here
 * would be the failure mode of the option she picked.
 */

/** What Joy remembers between sessions. Not a credential — grants are checked afresh. */
export interface RememberedMode {
  audience: PortalAudience;
  /** Which family grant, when someone is responsible party for two people. */
  subjectPersonId: string | null;
}

export type ModeOutcome =
  /** Only one grant. No mode to choose and nothing to show. */
  | "single"
  /** Two or more, and the remembered one still holds. Resume it, loudly. */
  | "resumed"
  /** Two or more and nothing usable remembered. Ask. */
  | "choose"
  /** Verified, but nothing open. */
  | "none";

export interface ModeResolution {
  outcome: ModeOutcome;
  grant: PortalGrant | null;
  /** Every active grant, for the picker and the switcher. */
  choices: PortalGrant[];
  /** The other grants this person could switch into. */
  alternatives: PortalGrant[];
  /** True whenever this person holds more than one active grant. */
  mustShowIndicator: boolean;
}

function sameGrant(grant: PortalGrant, remembered: RememberedMode): boolean {
  return (
    grant.audience === remembered.audience &&
    grant.subjectPersonId === remembered.subjectPersonId
  );
}

/**
 * Resolve a verified identity plus what Joy remembered into a mode.
 *
 * A remembered mode is deliberately re-checked against live grants rather than
 * trusted. Someone whose employment ended last week must not resume into work
 * mode because that is where they were last; the grant is gone, so the memory
 * is ignored and they are put where they still belong.
 */
export function resolveMode(
  identity: PortalIdentity,
  remembered: RememberedMode | null,
): ModeResolution {
  const active = identity.grants.filter((g) => g.active);

  if (active.length === 0) {
    return { outcome: "none", grant: null, choices: [], alternatives: [], mustShowIndicator: false };
  }

  if (active.length === 1) {
    return {
      outcome: "single",
      grant: active[0],
      choices: active,
      alternatives: [],
      mustShowIndicator: false,
    };
  }

  const resumed = remembered ? active.find((g) => sameGrant(g, remembered)) ?? null : null;

  return {
    outcome: resumed ? "resumed" : "choose",
    grant: resumed,
    choices: active,
    alternatives: resumed ? active.filter((g) => g !== resumed) : [],
    // True in both branches: someone who has just picked still needs telling
    // which one they picked.
    mustShowIndicator: true,
  };
}

/**
 * The words in the header. Not an icon, and not just "Work" — the family side
 * names the person, because "Care" alone does not distinguish a mother from a
 * father when someone is responsible party for both.
 */
export function modeBanner(grant: PortalGrant): string {
  if (grant.audience === "workforce") return "Joy · My work";
  return grant.subjectName ? `Joy · ${grant.subjectName}'s care` : "Joy · Family";
}

// ----------------------------------------------------------------- audit --

/**
 * Why this person was allowed to read this record.
 *
 * Recorded on the access itself. `dual` is the interesting one — see below.
 */
export type AccessBasis =
  /** Staff, reading a client they are assigned to. */
  | "staff_assignment"
  /** Family, reading the person whose care they are responsible for. */
  | "family_authorization"
  /** Both bases hold at once. Legitimate, and worth knowing about. */
  | "dual"
  /** Neither. The read should not happen. */
  | "none";

export interface AccessQuery {
  grant: PortalGrant;
  /** The person whose record is being read. */
  recordSubjectPersonId: string;
  /** Clients this person is assigned to as staff, if any. */
  assignedClientIds: readonly string[];
  /** Every active grant they hold, so an overlap is visible from either mode. */
  allGrants: readonly PortalGrant[];
}

/**
 * Decide the basis for one read.
 *
 * ON PAID FAMILY CAREGIVERS
 *
 * Karynn's answer on 20 Aug was "not yet, but likely later" — Joy does not
 * currently schedule a caregiver onto a client they are related to, but it is
 * common in home care, particularly on Medicaid programs, and she expects to
 * get there.
 *
 * So this neither permits nor forbids it. It *notices* it: when both bases hold
 * for the same record, the basis is `dual` rather than whichever mode the
 * person happened to be in. Nothing in the product changes today, because Joy
 * never creates that assignment. On the day it does, the audit trail already
 * distinguishes "the caregiver assigned to this client" from "the daughter",
 * which is precisely the distinction that would otherwise be lost — and lost
 * silently, since both reads look identical from the outside.
 *
 * Building it now costs one branch. Retrofitting it means re-interpreting a
 * back catalogue of accesses whose basis was never recorded.
 */
export function accessBasis(query: AccessQuery): AccessBasis {
  const { recordSubjectPersonId, assignedClientIds, allGrants } = query;

  const staff =
    assignedClientIds.includes(recordSubjectPersonId) &&
    allGrants.some((g) => g.active && g.audience === "workforce");

  const family = allGrants.some(
    (g) => g.active && g.audience === "family" && g.subjectPersonId === recordSubjectPersonId,
  );

  if (staff && family) return "dual";
  if (staff) return "staff_assignment";
  if (family) return "family_authorization";
  return "none";
}

export const ACCESS_BASIS_LABELS: Record<AccessBasis, string> = {
  staff_assignment: "Staff — assigned to this client",
  family_authorization: "Family — authorized by this client",
  dual: "Both — assigned caregiver and authorized family member",
  none: "No basis on record",
};

/**
 * What the audit entry records for a portal read.
 *
 * The mode is kept alongside the basis on purpose. The basis says what Joy
 * could justify; the mode says which hat the person believed they were wearing.
 * When those disagree — a `dual` access made in care mode, say — the pair is
 * more informative than either alone, and reducing them to one field early
 * would throw that away.
 */
export interface PortalAccessRecord {
  personId: string;
  recordSubjectPersonId: string;
  mode: PortalAudience;
  basis: AccessBasis;
  at: string;
}

export function recordPortalAccess(query: AccessQuery, at: string): PortalAccessRecord {
  return {
    personId: query.grant.personId,
    recordSubjectPersonId: query.recordSubjectPersonId,
    mode: query.grant.audience,
    basis: accessBasis(query),
    at,
  };
}
