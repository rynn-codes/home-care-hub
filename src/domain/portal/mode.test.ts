import { describe, expect, it } from "vitest";
import {
  portalRoute,
  revocationSummary,
  revokeGrant,
  type PortalGrant,
  type PortalIdentity,
} from "@/domain/portal/identity";
import {
  accessBasis,
  modeBanner,
  recordPortalAccess,
  resolveMode,
  type RememberedMode,
} from "@/domain/portal/mode";

/**
 * Fictional throughout. Real client names never appear in this repository —
 * being a care recipient is health information about you.
 */

const WORK: PortalGrant = {
  audience: "workforce",
  personId: "p1",
  subjectPersonId: null,
  greetingName: "Jamisha",
  subjectName: null,
  state: "active",
  active: true,
};

const CARE: PortalGrant = {
  audience: "family",
  personId: "p1",
  subjectPersonId: "p9",
  greetingName: "Jamisha",
  subjectName: "Marcus",
  state: "active",
  active: true,
};

function identity(grants: PortalGrant[]): PortalIdentity {
  return { phone: "+17135550100", grants, verifiedAt: "2026-08-20T09:00:00Z" };
}

describe("resolveMode", () => {
  it("does not ask when there is only one hat to wear", () => {
    const r = resolveMode(identity([WORK]), null);
    expect(r.outcome).toBe("single");
    expect(r.grant).toBe(WORK);
    // Nothing to switch to, so nothing to label.
    expect(r.mustShowIndicator).toBe(false);
  });

  it("asks the first time someone holds two", () => {
    const r = resolveMode(identity([WORK, CARE]), null);
    expect(r.outcome).toBe("choose");
    expect(r.grant).toBeNull();
    expect(r.choices).toHaveLength(2);
  });

  it("resumes where they were, rather than asking again", () => {
    const remembered: RememberedMode = { audience: "workforce", subjectPersonId: null };
    const r = resolveMode(identity([WORK, CARE]), remembered);
    expect(r.outcome).toBe("resumed");
    expect(r.grant).toBe(WORK);
    expect(r.alternatives).toEqual([CARE]);
  });

  it("names the mode on every screen for anyone holding two", () => {
    // Karynn chose remember-and-resume over asking every time. That is only
    // safe if the indicator is unmissable, so it is on in both branches —
    // including immediately after they have just chosen.
    expect(resolveMode(identity([WORK, CARE]), null).mustShowIndicator).toBe(true);
    expect(
      resolveMode(identity([WORK, CARE]), { audience: "family", subjectPersonId: "p9" })
        .mustShowIndicator,
    ).toBe(true);
  });

  it("ignores a remembered mode whose grant has since been revoked", () => {
    // Someone whose employment ended must not resume into work mode just
    // because that is where they were last.
    const ended = { ...WORK, active: false };
    const r = resolveMode(identity([ended, CARE]), { audience: "workforce", subjectPersonId: null });
    expect(r.outcome).toBe("single");
    expect(r.grant).toBe(CARE);
  });

  it("tells the truth when a number verifies but unlocks nothing", () => {
    const r = resolveMode(identity([{ ...WORK, active: false }]), null);
    expect(r.outcome).toBe("none");
    expect(r.grant).toBeNull();
  });

  it("distinguishes two family grants by name, not by 'Care'", () => {
    expect(modeBanner(WORK)).toBe("Joy · My work");
    expect(modeBanner(CARE)).toBe("Joy · Marcus's care");
  });
});

describe("accessBasis", () => {
  const both = [WORK, CARE];

  it("records a staff read of an assigned client as staff", () => {
    expect(
      accessBasis({
        grant: WORK,
        recordSubjectPersonId: "p4",
        assignedClientIds: ["p4"],
        allGrants: both,
      }),
    ).toBe("staff_assignment");
  });

  it("records a family read of their own person as family", () => {
    expect(
      accessBasis({
        grant: CARE,
        recordSubjectPersonId: "p9",
        assignedClientIds: ["p4"],
        allGrants: both,
      }),
    ).toBe("family_authorization");
  });

  it("gives no basis for a client they are neither assigned to nor related to", () => {
    expect(
      accessBasis({
        grant: WORK,
        recordSubjectPersonId: "p7",
        assignedClientIds: ["p4"],
        allGrants: both,
      }),
    ).toBe("none");
  });

  it("notices when both bases hold at once", () => {
    // Karynn, 20 Aug: paid family caregivers are "not yet, but likely later".
    // Joy does not create this assignment today. When it does, the audit trail
    // already separates the caregiver from the daughter — a distinction that
    // is otherwise lost silently, because both reads look identical.
    expect(
      accessBasis({
        grant: WORK,
        recordSubjectPersonId: "p9",
        assignedClientIds: ["p9"],
        allGrants: both,
      }),
    ).toBe("dual");
  });

  it("reports the same basis from either mode", () => {
    // The basis is what Joy can justify; it does not change with the hat.
    const query = { recordSubjectPersonId: "p9", assignedClientIds: ["p9"], allGrants: both };
    expect(accessBasis({ ...query, grant: WORK })).toBe("dual");
    expect(accessBasis({ ...query, grant: CARE })).toBe("dual");
  });
});

describe("recordPortalAccess", () => {
  it("keeps the mode alongside the basis", () => {
    // The basis says what Joy could justify; the mode says which hat she
    // believed she was wearing. A dual access made in care mode is more
    // informative as a pair than either field alone.
    const entry = recordPortalAccess(
      {
        grant: CARE,
        recordSubjectPersonId: "p9",
        assignedClientIds: ["p9"],
        allGrants: [WORK, CARE],
      },
      "2026-08-20T09:05:00Z",
    );
    expect(entry).toEqual({
      personId: "p1",
      recordSubjectPersonId: "p9",
      mode: "family",
      basis: "dual",
      at: "2026-08-20T09:05:00Z",
    });
  });
});

describe("where a mismatched audience goes", () => {
  // The guard's rule, asserted on the data it reads. Somebody holding one
  // grant who lands on the other portal's URL has nothing to choose between,
  // so the picker would be a screen with one option — a dead end that looks
  // like a decision. They go back to their own portal instead.
  it("knows when somebody has a second portal to be offered", () => {
    const both = resolveMode(identity([WORK, CARE]), null);
    expect(both.choices.some((g) => g.audience === "family")).toBe(true);

    const onlyFamily = resolveMode(identity([CARE]), null);
    expect(onlyFamily.choices.some((g) => g.audience === "workforce")).toBe(false);
    expect(portalRoute(onlyFamily.grant!)).toBe("/portal/care");
  });
});

describe("revoking access", () => {
  const grant = (): PortalGrant => ({ ...WORK });

  it("needs the person doing it", () => {
    // Somebody will ring the office asking why their login stopped working.
    expect(() =>
      revokeGrant({ grant: grant(), reason: "employment_ended", byUserId: null, at: "2026-08-20" }),
    ).toThrow(/needs the user doing it/);
  });

  it("records who, when and why", () => {
    const revoked = revokeGrant({
      grant: grant(),
      reason: "employment_ended",
      byUserId: "u-karynn",
      at: "2026-08-20T09:00:00Z",
    });
    expect(revoked.active).toBe(false);
    expect(revoked.revokedByUserId).toBe("u-karynn");
    expect(revoked.revokedAt).toBe("2026-08-20T09:00:00Z");
    expect(revoked.revokedReason).toBe("They no longer work for Joy");
  });

  it("keeps the grant rather than deleting it", () => {
    // Somebody read a client's schedule for eight months. The record of why
    // they were allowed to should not vanish the day they stop.
    const revoked = revokeGrant({
      grant: { ...CARE },
      reason: "client_discharged",
      byUserId: "u-karynn",
      at: "2026-08-20",
    });
    expect(revoked.personId).toBe("p1");
    expect(revoked.subjectPersonId).toBe("p9");
    expect(revoked.subjectName).toBe("Marcus");
  });

  it("insists on a note when the reason is 'something else'", () => {
    expect(() =>
      revokeGrant({ grant: grant(), reason: "other", byUserId: "u1", at: "2026-08-20" }),
    ).toThrow(/Choose a reason, or write one/);

    const written = revokeGrant({
      grant: grant(),
      reason: "other",
      note: "Duplicate of an existing grant",
      byUserId: "u1",
      at: "2026-08-20",
    });
    expect(written.revokedReason).toBe("Duplicate of an existing grant");
  });

  it("refuses to revoke twice", () => {
    const once = revokeGrant({
      grant: grant(),
      reason: "employment_ended",
      byUserId: "u1",
      at: "2026-08-20",
    });
    expect(() =>
      revokeGrant({ grant: once, reason: "issued_in_error", byUserId: "u1", at: "2026-08-21" }),
    ).toThrow(/already been withdrawn/);
  });

  it("stops routing anywhere the moment it is revoked", () => {
    // The property that matters. resolveMode already filters on `active`, so
    // this asserts the two pieces agree rather than that either works alone.
    const revoked = revokeGrant({
      grant: grant(),
      reason: "employment_ended",
      byUserId: "u1",
      at: "2026-08-20",
    });
    expect(resolveMode(identity([revoked]), null).outcome).toBe("none");
  });

  it("leaves a second grant working", () => {
    // Somebody who stops working for Joy is still their father's responsible
    // party. Revoking one audience must not silently close the other.
    const revoked = revokeGrant({
      grant: grant(),
      reason: "employment_ended",
      byUserId: "u1",
      at: "2026-08-20",
    });
    const result = resolveMode(identity([revoked, CARE]), null);
    expect(result.outcome).toBe("single");
    expect(result.grant).toBe(CARE);
  });

  it("says what happened, for the office", () => {
    const revoked = revokeGrant({
      grant: grant(),
      reason: "client_discharged",
      byUserId: "u1",
      at: "2026-08-20T09:00:00Z",
    });
    expect(revocationSummary(revoked)).toBe(
      "Access withdrawn 2026-08-20 — This client has been discharged",
    );
    expect(revocationSummary(grant())).toBeNull();
  });
});
