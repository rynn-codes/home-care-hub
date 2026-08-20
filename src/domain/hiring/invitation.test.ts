import { describe, expect, it } from "vitest";
import {
  canInvite,
  canInviteFamily,
  invitationState,
  invitationSummary,
  issueInvitation,
  redeemInvitation,
  resendInvitation,
  revokeInvitation,
  type Invitation,
} from "@/domain/hiring/invitation";

/** Applicants are fictional. Naming a real person as a Joy candidate is a
 *  disclosure they never agreed to. */

const T0 = "2026-08-20T09:00:00Z";
const PHONE = "+17135550100" as const;
const OTHER = "+17135550199" as const;
const USER = "u-karynn";

function invite(overrides: Partial<Invitation> = {}): Invitation {
  return {
    ...issueInvitation({
      id: "inv-1",
      subjectId: "a-1",
      phone: PHONE,
      token: "tok-a",
      byUserId: USER,
      asOf: T0,
    }),
    ...overrides,
  };
}

describe("canInvite", () => {
  it("refuses before the in-person interview", () => {
    // §2: GHL owns recruiting up to the interview. Joy takes ownership after.
    const r = canInvite({ stage: "phone_screen", phone: PHONE, existing: null, asOf: T0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/after the in-person interview/);
  });

  it("allows it once the interview has happened", () => {
    expect(canInvite({ stage: "interview", phone: PHONE, existing: null, asOf: T0 }).eligible).toBe(
      true,
    );
  });

  it("allows it for candidates already past the interview", () => {
    // Someone Joy started before the portal existed should still get one.
    for (const stage of ["documents", "background", "offer"] as const) {
      expect(canInvite({ stage, phone: PHONE, existing: null, asOf: T0 }).eligible).toBe(true);
    }
  });

  it("cannot invite without a number to send to", () => {
    const r = canInvite({ stage: "interview", phone: null, existing: null, asOf: T0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/No mobile number/);
  });

  it("points at resend rather than issuing a second live invitation", () => {
    const r = canInvite({ stage: "interview", phone: PHONE, existing: invite(), asOf: T0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/Resend it instead/);
  });

  it("allows a fresh invitation once the old one lapsed", () => {
    const r = canInvite({
      stage: "interview",
      phone: PHONE,
      existing: invite(),
      asOf: "2026-09-30T09:00:00Z",
    });
    expect(r.eligible).toBe(true);
  });
});

describe("issueInvitation", () => {
  it("refuses to record a decision nobody made", () => {
    expect(() =>
      issueInvitation({
        id: "inv-1",
        subjectId: "a-1",
        phone: PHONE,
        token: "tok-a",
        byUserId: null,
        asOf: T0,
      }),
    ).toThrow(/needs the user issuing it/);
  });

  it("gives the candidate a week and records who sent it", () => {
    const i = invite();
    expect(i.expiresAt).toBe("2026-08-27");
    expect(i.issuedByUserId).toBe(USER);
    expect(i.sends).toEqual([{ at: T0, byUserId: USER }]);
  });
});

describe("invitationState", () => {
  it("derives expiry rather than trusting the stored state", () => {
    // No cron job has to run for a lapsed invitation to stop working.
    const i = invite();
    expect(invitationState(i, "2026-08-27T23:00:00Z")).toBe("sent");
    expect(invitationState(i, "2026-08-28T00:00:00Z")).toBe("expired");
  });

  it("leaves an accepted invitation accepted however much time passes", () => {
    const i = invite({ state: "accepted", acceptedAt: T0 });
    expect(invitationState(i, "2027-01-01T00:00:00Z")).toBe("accepted");
  });
});

describe("resendInvitation", () => {
  it("kills the old link rather than adding a second live one", () => {
    const first = invite();
    const again = resendInvitation(first, { token: "tok-b", byUserId: USER, asOf: "2026-08-25T09:00:00Z" });

    expect(again.token).toBe("tok-b");
    expect(again.expiresAt).toBe("2026-09-01");
    expect(again.sends).toHaveLength(2);

    // The point of rotating: the first text is now useless. Presenting the old
    // token against the current invitation is refused.
    const stale = redeemInvitation({
      invitation: again,
      presentedToken: first.token,
      verifiedPhone: PHONE,
      asOf: "2026-08-25T09:00:00Z",
    });
    expect(stale.outcome).toBe("unknown");

    // And the new one works.
    const fresh = redeemInvitation({
      invitation: again,
      presentedToken: "tok-b",
      verifiedPhone: PHONE,
      asOf: "2026-08-25T09:00:00Z",
    });
    expect(fresh.outcome).toBe("accepted");
  });

  it("does not admit that a superseded token was ever real", () => {
    // "Expired" would confirm the invitation exists; the wording matches the
    // unknown-token reply exactly.
    const first = invite();
    const again = resendInvitation(first, { token: "tok-b", byUserId: USER, asOf: T0 });
    const stale = redeemInvitation({
      invitation: again,
      presentedToken: first.token,
      verifiedPhone: PHONE,
      asOf: T0,
    });
    const unknown = redeemInvitation({
      invitation: null,
      presentedToken: "anything",
      verifiedPhone: PHONE,
      asOf: T0,
    });
    expect(stale.message).toBe(unknown.message);
  });

  it("will not resend to someone who already used theirs", () => {
    const used = invite({ state: "accepted", acceptedAt: T0 });
    expect(() => resendInvitation(used, { token: "t", byUserId: USER, asOf: T0 })).toThrow(
      /already used/,
    );
  });

  it("will not quietly revive a withdrawn invitation", () => {
    const gone = revokeInvitation(invite(), { reason: "Took another job", asOf: T0 });
    expect(() => resendInvitation(gone, { token: "t", byUserId: USER, asOf: T0 })).toThrow(
      /Issue a new one/,
    );
  });
});

describe("redeemInvitation", () => {
  it("refuses a phone the candidate merely typed", () => {
    // The whole scheme collapses if an unverified number is accepted here.
    expect(() =>
      redeemInvitation({
        invitation: invite(),
        presentedToken: "tok-a",
        verifiedPhone: null,
        asOf: T0,
      }),
    ).toThrow(/already been verified server side/);
  });

  it("lets the invited candidate in", () => {
    const r = redeemInvitation({
      invitation: invite(),
      presentedToken: "tok-a",
      verifiedPhone: PHONE,
      asOf: T0,
    });
    expect(r.outcome).toBe("accepted");
    expect(r.invitation?.state).toBe("accepted");
    expect(r.invitation?.acceptedAt).toBe(T0);
  });

  it("stops a forwarded link at the phone check", () => {
    // The friend verified a real phone — their own. That is exactly why the
    // number has to match, and why the link alone grants nothing.
    const r = redeemInvitation({
      invitation: invite(),
      presentedToken: "tok-a",
      verifiedPhone: OTHER,
      asOf: T0,
    });
    expect(r.outcome).toBe("wrong_number");
    expect(r.message).toMatch(/different number/);
  });

  it("gives an unknown token the same answer as a lapsed one", () => {
    // A precise "no such invitation" would let someone probe for valid tokens.
    const unknown = redeemInvitation({
      invitation: null,
      presentedToken: "guessed",
      verifiedPhone: PHONE,
      asOf: T0,
    });
    expect(unknown.outcome).toBe("unknown");
    expect(unknown.message).toMatch(/not valid/);
    expect(unknown.message).toMatch(/713\) 231-9662/);
  });

  it("tells an expired candidate what to do without blaming them", () => {
    const r = redeemInvitation({
      invitation: invite(),
      presentedToken: "tok-a",
      verifiedPhone: PHONE,
      asOf: "2026-09-01T09:00:00Z",
    });
    expect(r.outcome).toBe("expired");
    expect(r.message).toMatch(/we'll send a new one/);
  });

  it("sends someone who already set up their portal to the sign-in", () => {
    const r = redeemInvitation({
      invitation: invite({ state: "accepted", acceptedAt: T0 }),
      presentedToken: "tok-a",
      verifiedPhone: PHONE,
      asOf: T0,
    });
    expect(r.outcome).toBe("already_used");
    expect(r.message).toMatch(/Sign in with your phone number/);
  });
});

describe("invitationSummary", () => {
  it("distinguishes never-invited from invited-and-ignored", () => {
    expect(invitationSummary(null, T0)).toBe("Not invited yet");
    expect(invitationSummary(invite(), T0)).toBe("Invited 2026-08-20, not opened");
  });

  it("says a resend happened, so nobody sends a fourth", () => {
    const again = resendInvitation(invite(), {
      token: "tok-b",
      byUserId: USER,
      asOf: "2026-08-25T09:00:00Z",
    });
    expect(invitationSummary(again, "2026-08-25T09:00:00Z")).toMatch(/resent 2026-08-25/);
  });

  it("records why an invitation was withdrawn", () => {
    const gone = revokeInvitation(invite(), { reason: "Took another job", asOf: T0 });
    expect(invitationSummary(gone, T0)).toMatch(/withdrawn — Took another job/);
  });
});

describe("§19 — inviting a family", () => {
  // The same lifecycle as a candidate, gated on a different decision. Two
  // copies of expiry and redemption would have drifted, and the half that
  // drifted would be the family half — nobody exercises it daily.
  const base = {
    assessmentComplete: true,
    movingForward: true,
    phone: "+17135550110",
    existing: null,
    asOf: "2026-08-20",
  };

  it("waits for the in-person assessment", () => {
    // Before it Joy has decided nothing, and a portal showing an admission
    // status Joy has not reached tells a worried family their father's care is
    // further along than it is.
    const check = canInviteFamily({ ...base, assessmentComplete: false });
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain("assessment has not been completed");
  });

  it("waits for Joy to decide, and does not call that a failure", () => {
    const check = canInviteFamily({ ...base, movingForward: false });
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain("has not decided to move forward");
  });

  it("needs a number to send to", () => {
    expect(canInviteFamily({ ...base, phone: null }).reason).toContain("No mobile number");
  });

  it("invites once both are true", () => {
    expect(canInviteFamily(base).eligible).toBe(true);
  });

  it("will not issue a second while one is open", () => {
    const open = issueInvitation({
      id: "i1",
      audience: "family",
      subjectId: "p-susan",
      clientPersonId: "p-marcus",
      phone: "+17135550110",
      token: "tok",
      byUserId: "u1",
      asOf: "2026-08-19",
    });
    expect(canInviteFamily({ ...base, existing: open }).reason).toContain("Resend it instead");
  });

  it("records whose care it concerns", () => {
    const invitation = issueInvitation({
      id: "i1",
      audience: "family",
      subjectId: "p-susan",
      clientPersonId: "p-marcus",
      phone: "+17135550110",
      token: "tok",
      byUserId: "u1",
      asOf: "2026-08-19",
    });
    // The person who holds the portal is not the person it is about.
    expect(invitation.subjectId).toBe("p-susan");
    expect(invitation.clientPersonId).toBe("p-marcus");
    expect(invitation.audience).toBe("family");
  });

  it("defaults to workforce, so existing callers are unchanged", () => {
    const invitation = issueInvitation({
      id: "i2",
      subjectId: "a-1",
      phone: "+17135550100",
      token: "tok",
      byUserId: "u1",
      asOf: "2026-08-19",
    });
    expect(invitation.audience).toBe("workforce");
    expect(invitation.clientPersonId).toBeNull();
  });

  it("expires on the same clock as a candidate's", () => {
    const invitation = issueInvitation({
      id: "i3",
      audience: "family",
      subjectId: "p-susan",
      clientPersonId: "p-marcus",
      phone: "+17135550110",
      token: "tok",
      byUserId: "u1",
      asOf: "2026-08-01",
    });
    expect(invitationState(invitation, "2026-08-20")).toBe("expired");
  });
});
