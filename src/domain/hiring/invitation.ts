import type { E164 } from "@/domain/portal/phone";
import type { HiringStage } from "@/domain/hiring/pipeline";

/**
 * Inviting a candidate into Joy, after Joy has decided to move forward.
 *
 * §2 draws the boundary this file sits on: "GHL owns the recruiting process up
 * through the in-person interview. Joy does not need to house every early-stage
 * applicant." Only candidates Joy wants to move forward with receive the portal
 * link.
 *
 * So the invitation is not a notification about a record that already exists.
 * It is the moment the record starts existing. Before it, the candidate is
 * GHL's; after it, they are Joy's, with a portal, a state, and a compliance
 * clock waiting for them. That makes issuing one a decision worth recording
 * with a name against it, which is why `issueInvitation` will not accept a null
 * user.
 *
 * WHY THE LINK IS NOT A KEY
 *
 * A token in a text message is a bearer credential, and texts get forwarded,
 * screenshotted and left on lock screens. So the link does not grant anything
 * on its own: it names which invitation is being answered, and the phone OTP
 * proves who is answering. `redeemInvitation` requires both, and requires that
 * the verified phone match the number Joy sent to.
 *
 * The practical consequence is the one that matters — a candidate who forwards
 * their link to a friend has given them nothing. Getting this backwards is the
 * common way portal invitations leak, because a link alone feels like enough
 * when you are the one holding it.
 */

/** How long a candidate has to open the link before it stops working. */
export const INVITATION_VALID_DAYS = 7;

export type InvitationState =
  /** Issued and delivered, not yet opened. */
  | "sent"
  /** The candidate opened the link but has not verified a phone. */
  | "opened"
  /** Verified. The portal grant is live and the invitation is spent. */
  | "accepted"
  /** Ran out of time. Reissue rather than extend. */
  | "expired"
  /** Withdrawn by Joy. */
  | "revoked";

export interface Invitation {
  id: string;
  applicantId: string;
  /** Where it was sent. Redemption must match this. */
  phone: E164;
  /**
   * Opaque, single-use, rotated on every resend. Never a guessable id — a
   * sequential token would let anyone enumerate Joy's open candidates.
   */
  token: string;
  issuedByUserId: string;
  issuedAt: string;
  expiresAt: string;
  state: InvitationState;
  /** Each delivery attempt, so "did she ever get it?" has an answer. */
  sends: Array<{ at: string; byUserId: string }>;
  acceptedAt: string | null;
  revokedReason: string | null;
}

/**
 * A token with enough entropy that guessing is not a strategy.
 *
 * 128 bits from the platform CSPRNG, base36. `Math.random` would be the obvious
 * shortcut and is wrong here: it is seeded predictably and not designed to
 * resist anyone working backwards from earlier outputs, which is exactly what
 * an attacker holding one candidate's link would try.
 *
 * FOR WHOEVER WIRES THIS UP. Generate the token server side, not here. Joy's
 * browser producing the value that admits someone to a portal means a modified
 * client can choose it. This implementation exists so the prototype works and
 * so the shape is settled; it is not the one that should ship.
 */
export function newInvitationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------- issuing --

/**
 * Which stages may be invited.
 *
 * The in-person interview is the gate §2 names. `documents`, `background` and
 * `offer` are past it — a candidate who reached those without a portal is one
 * Joy started before the portal existed, and they should be able to get one.
 */
const INVITABLE_STAGES: readonly HiringStage[] = ["interview", "documents", "background", "offer"];

export interface InviteEligibility {
  eligible: boolean;
  reason: string | null;
}

export function canInvite(input: {
  stage: HiringStage;
  phone: string | null;
  existing: Invitation | null;
  asOf: string;
}): InviteEligibility {
  if (!INVITABLE_STAGES.includes(input.stage)) {
    return {
      eligible: false,
      // Named plainly, because the answer is "do the interview", not "click
      // harder". §2 is a policy about when Joy takes ownership, not a bug.
      reason: "Joy invites a candidate after the in-person interview, not before.",
    };
  }

  if (!input.phone) {
    return { eligible: false, reason: "No mobile number on file to send the link to." };
  }

  const live = input.existing ? invitationState(input.existing, input.asOf) : null;

  if (live === "accepted") {
    return { eligible: false, reason: "This candidate already has a Joy portal." };
  }
  if (live === "sent" || live === "opened") {
    return { eligible: false, reason: "An invitation is already open. Resend it instead." };
  }

  return { eligible: true, reason: null };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface IssueInput {
  id: string;
  applicantId: string;
  phone: E164;
  token: string;
  byUserId: string | null;
  asOf: string;
}

/**
 * Create the invitation.
 *
 * The null check on `byUserId` mirrors `confirmCredential`: this is a decision
 * about a person's employment, and an audit trail that says "the system did it"
 * records nothing worth having.
 */
export function issueInvitation(input: IssueInput): Invitation {
  if (!input.byUserId) {
    throw new Error(
      "An invitation needs the user issuing it. Joy deciding to move a candidate " +
        "forward is a person's decision and the record should say whose.",
    );
  }

  return {
    id: input.id,
    applicantId: input.applicantId,
    phone: input.phone,
    token: input.token,
    issuedByUserId: input.byUserId,
    issuedAt: input.asOf,
    expiresAt: addDays(input.asOf, INVITATION_VALID_DAYS),
    state: "sent",
    sends: [{ at: input.asOf, byUserId: input.byUserId }],
    acceptedAt: null,
    revokedReason: null,
  };
}

/**
 * The state right now, which is not always the state on the record.
 *
 * Expiry is derived rather than written, so an invitation cannot sit in the
 * database claiming to be open three weeks after it lapsed because no job ever
 * ran. Same reasoning as the credential compliance clock.
 */
export function invitationState(invitation: Invitation, asOf: string): InvitationState {
  if (invitation.state === "accepted" || invitation.state === "revoked") return invitation.state;
  if (asOf.slice(0, 10) > invitation.expiresAt) return "expired";
  return invitation.state;
}

/**
 * Send it again, with a fresh token and a fresh clock.
 *
 * Rotating the token means an earlier text stops working. A candidate who lost
 * the first message is no worse off; a forwarded or screenshotted old link is
 * dead. Keeping the old token alive to be kind would quietly widen the number
 * of live keys every time the office was helpful.
 */
export function resendInvitation(
  invitation: Invitation,
  input: { token: string; byUserId: string | null; asOf: string },
): Invitation {
  if (!input.byUserId) {
    throw new Error("A resend needs the user sending it.");
  }

  const live = invitationState(invitation, input.asOf);
  if (live === "accepted") {
    throw new Error("This candidate has already used their invitation.");
  }
  if (live === "revoked") {
    throw new Error("This invitation was withdrawn. Issue a new one instead.");
  }

  return {
    ...invitation,
    token: input.token,
    state: "sent",
    expiresAt: addDays(input.asOf, INVITATION_VALID_DAYS),
    sends: [...invitation.sends, { at: input.asOf, byUserId: input.byUserId }],
  };
}

export function revokeInvitation(
  invitation: Invitation,
  input: { reason: string; asOf: string },
): Invitation {
  return { ...invitation, state: "revoked", revokedReason: input.reason };
}

// ----------------------------------------------------------- redeeming --

export type RedemptionOutcome =
  | "accepted"
  | "expired"
  | "revoked"
  | "already_used"
  | "wrong_number"
  | "unknown";

export interface Redemption {
  outcome: RedemptionOutcome;
  invitation: Invitation | null;
  message: string;
}

/**
 * Turn a link plus a verified phone into a portal grant, or refuse.
 *
 * `verifiedPhone` must come from an OTP that has already been checked server
 * side. Passing a phone the candidate merely typed would reduce this to the
 * bearer-token scheme the file header rejects.
 */
export function redeemInvitation(input: {
  invitation: Invitation | null;
  /**
   * The token from the link the candidate actually followed.
   *
   * Checked here rather than assumed to have been matched by the lookup. If
   * this were left to the caller, an implementation that fetched by applicant
   * id — the obvious thing to write — would accept a superseded token, and
   * rotating on resend would silently stop meaning anything. The rotation is
   * only a security property if something refuses the old value.
   */
  presentedToken: string;
  verifiedPhone: E164 | null;
  asOf: string;
}): Redemption {
  const { invitation, presentedToken, verifiedPhone, asOf } = input;

  if (!invitation) {
    // Deliberately vague. A precise "no such invitation" lets someone probe
    // for valid tokens; this reads the same as a lapsed one.
    return {
      outcome: "unknown",
      invitation: null,
      message: "This link is not valid. Call the office at (713) 231-9662 and we'll send a new one.",
    };
  }

  if (!verifiedPhone) {
    throw new Error(
      "redeemInvitation needs a phone that has already been verified server side. " +
        "A typed number proves nothing.",
    );
  }

  if (presentedToken !== invitation.token) {
    // A superseded link. Same wording as an unknown token — telling someone
    // their token is merely *stale* confirms the invitation exists.
    return {
      outcome: "unknown",
      invitation,
      message: "This link is not valid. Call the office at (713) 231-9662 and we'll send a new one.",
    };
  }

  const live = invitationState(invitation, asOf);

  if (live === "accepted") {
    return {
      outcome: "already_used",
      invitation,
      message: "You've already set up your Joy portal. Sign in with your phone number.",
    };
  }
  if (live === "revoked") {
    return {
      outcome: "revoked",
      invitation,
      message: "This link is no longer active. Call the office at (713) 231-9662.",
    };
  }
  if (live === "expired") {
    return {
      outcome: "expired",
      invitation,
      // Says what to do, and does not blame them for a week passing.
      message: "This link has expired. Call the office at (713) 231-9662 and we'll send a new one.",
    };
  }

  if (verifiedPhone !== invitation.phone) {
    // The forwarded-link case. The friend verified a real phone — their own —
    // and that is exactly why the number has to match.
    return {
      outcome: "wrong_number",
      invitation,
      message:
        "This link was sent to a different number. Sign in with the number Joy has on file, " +
        "or call the office at (713) 231-9662.",
    };
  }

  return {
    outcome: "accepted",
    invitation: { ...invitation, state: "accepted", acceptedAt: asOf },
    message: "You're in. Let's get your application started.",
  };
}

/** What the office sees next to a candidate. */
export function invitationSummary(invitation: Invitation | null, asOf: string): string {
  if (!invitation) return "Not invited yet";

  switch (invitationState(invitation, asOf)) {
    case "sent":
      return invitation.sends.length > 1
        ? `Invitation resent ${invitation.sends[invitation.sends.length - 1].at.slice(0, 10)}, not opened`
        : `Invited ${invitation.issuedAt.slice(0, 10)}, not opened`;
    case "opened":
      return "Link opened, phone not yet verified";
    case "accepted":
      return `Portal active since ${invitation.acceptedAt?.slice(0, 10) ?? "—"}`;
    case "expired":
      return `Invitation expired ${invitation.expiresAt}`;
    case "revoked":
      return `Invitation withdrawn — ${invitation.revokedReason ?? "no reason recorded"}`;
  }
}
