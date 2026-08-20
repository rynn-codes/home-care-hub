import type { E164 } from "@/domain/portal/phone";
import type { OtpChallenge } from "@/domain/portal/otp";
import type { PortalGrant, PortalIdentity } from "@/domain/portal/identity";

/**
 * The seams a developer connects to make the portal real.
 *
 * Same shape as `src/domain/documents/ports.ts`: Joy's side is fully specified,
 * the far side is deliberately absent. Karynn's instruction has been consistent
 * — "I am not expecting you to connect anything… I just need the code to have
 * all the right plumbing for the developer." These are the plumbing.
 *
 * A NOTE FOR WHOEVER WIRES THIS
 *
 * `OtpService` is the only port in Joy that must NOT have a browser
 * implementation. Verification decides who sees client health information, so
 * it runs on the server — a Supabase edge function or the developer's API —
 * and the browser only ever calls it. An adapter that does this work in React
 * has moved the front door inside the house.
 */

// ------------------------------------------------------------------- otp --

export interface OtpRequestResult {
  /** Identical for known and unknown numbers. See `evaluateRequest`. */
  message: string;
  accepted: boolean;
  retryAfterSeconds: number | null;
  /** Correlates the code screen with the challenge. Not a secret. */
  challengeId: string | null;
}

export interface OtpVerifyResult {
  verified: boolean;
  message: string;
  attemptsRemaining: number;
  /** Present only on success. */
  identity: PortalIdentity | null;
  /** The session the app then holds. Opaque; issued by the server. */
  sessionToken: string | null;
}

export interface OtpService {
  /**
   * Ask for a code. Never throws for an unknown number, and never says so.
   */
  request(phone: E164, asOf?: string): Promise<OtpRequestResult>;

  /**
   * Check a code. Runs server-side; the code never reaches Joy's client bundle.
   */
  verify(input: { challengeId: string; code: string; asOf?: string }): Promise<OtpVerifyResult>;

  /** For the server's own use — the outstanding challenge for a number. */
  pending?(phone: E164): Promise<OtpChallenge | null>;
}

/** Sending the message. Twilio, Supabase phone auth, or Spruce's own channel. */
export interface SmsSender {
  send(input: { to: E164; body: string }): Promise<{ delivered: boolean; providerId: string | null }>;
}

// -------------------------------------------------------------- directory --

/**
 * Who a phone number belongs to, and what it unlocks.
 *
 * The implementation reads `people`, `employee_profiles`, `client_profiles` and
 * `relationships` — the records the admin side already writes. §26: the portal
 * must not become a second copy of the workforce.
 */
export interface PortalDirectory {
  grantsForPhone(phone: E164): Promise<PortalGrant[]>;
  /** Used by §2's invitation: give this person a workforce portal. */
  grantWorkforceAccess(input: {
    personId: string;
    phone: E164;
    invitedByUserId: string;
  }): Promise<PortalGrant>;
  /** Used at §19's handoff: give a responsible party a family portal. */
  grantFamilyAccess(input: {
    personId: string;
    subjectPersonId: string;
    phone: E164;
    invitedByUserId: string;
  }): Promise<PortalGrant>;
  revoke(input: { grantId: string; revokedByUserId: string; reason: string }): Promise<void>;
}

/**
 * The session the portal holds after verification.
 *
 * Separate from `supabase.auth` on purpose: the admin shell's session is a
 * staff session, and a caregiver's portal session is not the same thing and
 * must not inherit its reach.
 */
export interface PortalSessionStore {
  current(): Promise<{ identity: PortalIdentity; grant: PortalGrant | null } | null>;
  /** Choosing between two grants, per `resolvePortal`'s "choose" outcome. */
  select(grantId: string): Promise<void>;
  clear(): Promise<void>;
}
