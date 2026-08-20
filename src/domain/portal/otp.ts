import type { E164 } from "@/domain/portal/phone";

/**
 * The one-time-code policy, as rules rather than as an implementation.
 *
 * §3 asks for phone OTP instead of a password. That is a kindness to a
 * caregiver standing in a parking lot, and it is also the entire front door to
 * client health information. The rules that keep it a door rather than a hole
 * are here, in one file, testable, so a developer wiring Twilio or Supabase
 * phone auth cannot accidentally leave one out.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 *
 * It does not generate codes and it does not compare them. Generation needs a
 * cryptographic random source and comparison must be constant-time against a
 * stored hash — both belong to the server, behind `OtpDeliveryService`. These
 * functions take `codeMatches` as an input they are told, never as something
 * they work out. A pure module that held the real code would be a pure module
 * that had to run on the client, which is the mistake this shape prevents.
 *
 * The verification decision must run on the server for the same reason. A
 * caller who can lie about `codeMatches` has already won; the point is that
 * nothing in the browser is ever in a position to.
 */

export const OTP_POLICY = {
  /** Digits in the code. Six is the length people expect from an SMS. */
  codeLength: 6,
  /** How long a code stays good. Long enough to switch apps and come back. */
  ttlSeconds: 10 * 60,
  /** Wrong codes tolerated before the challenge is burned. */
  maxAttempts: 5,
  /** Wait between resends, so the button cannot be used as an SMS cannon. */
  resendCooldownSeconds: 60,
  /** Codes requested per phone number per hour. */
  maxRequestsPerWindow: 5,
  requestWindowSeconds: 60 * 60,
} as const;

export type ChallengeStatus = "pending" | "verified" | "expired" | "locked" | "superseded";

/**
 * A single outstanding code. Persisted server-side; never sent to a browser.
 *
 * `codeHash` is present so the shape matches the row, and is never read here.
 */
export interface OtpChallenge {
  id: string;
  phone: E164;
  codeHash: string;
  status: ChallengeStatus;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

// --------------------------------------------------------------- requesting --

export type RequestDenial = "cooldown" | "rate_limited";

/**
 * What the server should do about a request for a code.
 *
 * `deliver` is the thing worth staring at. Joy answers an unknown number
 * exactly as it answers a known one — same words, same timing budget, same
 * consumed quota — and simply does not send the message. Anything else turns
 * the login screen into a tool for asking "does Joy Health have a client at
 * this number?", which is a disclosure about a person's health before anyone
 * has logged in at all.
 *
 * So: `accepted` is not a statement that an account exists. It is a statement
 * that if one exists, a code is on its way.
 */
export interface RequestDecision {
  accepted: boolean;
  /** Send an SMS. False for an unknown number, and for every denial. */
  deliver: boolean;
  denial: RequestDenial | null;
  /** Seconds until another request would be accepted, when known. */
  retryAfterSeconds: number | null;
  /** What the person is told. Identical whether or not the number is known. */
  message: string;
}

const SENT_MESSAGE = "If that number is on file, we just texted you a 6-digit code.";

export interface RequestContext {
  /** Whether Joy has a portal identity for this number. Never revealed. */
  known: boolean;
  /** Codes already requested for this number inside the current window. */
  requestsInWindow: number;
  /** When the last code went out, if one has. */
  lastRequestedAt: string | null;
  asOf: string;
}

export function evaluateRequest(ctx: RequestContext): RequestDecision {
  const now = Date.parse(ctx.asOf);

  if (ctx.lastRequestedAt) {
    const since = (now - Date.parse(ctx.lastRequestedAt)) / 1000;
    if (since < OTP_POLICY.resendCooldownSeconds) {
      const wait = Math.ceil(OTP_POLICY.resendCooldownSeconds - since);
      return {
        accepted: false,
        deliver: false,
        denial: "cooldown",
        retryAfterSeconds: wait,
        message: `Wait ${wait} second${wait === 1 ? "" : "s"} before asking for another code.`,
      };
    }
  }

  if (ctx.requestsInWindow >= OTP_POLICY.maxRequestsPerWindow) {
    return {
      accepted: false,
      deliver: false,
      denial: "rate_limited",
      retryAfterSeconds: null,
      message: "Too many codes requested. Try again later, or call the office at (713) 231-9662.",
    };
  }

  return {
    accepted: true,
    // The only place the answer differs — and it differs in what Joy does,
    // never in what Joy says.
    deliver: ctx.known,
    denial: null,
    retryAfterSeconds: null,
    message: SENT_MESSAGE,
  };
}

/** When a code issued now stops being good. */
export function expiryFor(issuedAt: string): string {
  return new Date(Date.parse(issuedAt) + OTP_POLICY.ttlSeconds * 1000).toISOString();
}

// -------------------------------------------------------------- verifying --

export type VerifyOutcome =
  | "verified"
  | "wrong_code"
  | "expired"
  | "locked"
  | "already_used"
  | "no_challenge";

export interface VerifyDecision {
  outcome: VerifyOutcome;
  /** The challenge as it should now be stored. Null when there was none. */
  challenge: OtpChallenge | null;
  attemptsRemaining: number;
  message: string;
}

/**
 * Decide a verification attempt and return the challenge's next state.
 *
 * Returning the next state rather than mutating keeps the rule and the write
 * separate: the caller persists what comes back, and a test can assert on the
 * transition without a database.
 */
export function evaluateVerification(input: {
  challenge: OtpChallenge | null;
  codeMatches: boolean;
  asOf: string;
}): VerifyDecision {
  const { challenge, codeMatches, asOf } = input;

  if (!challenge) {
    return {
      outcome: "no_challenge",
      challenge: null,
      attemptsRemaining: 0,
      message: "That code has expired. Ask for a new one.",
    };
  }

  if (challenge.status === "verified") {
    return {
      outcome: "already_used",
      challenge,
      attemptsRemaining: 0,
      message: "That code has already been used. Ask for a new one.",
    };
  }

  if (challenge.status === "locked") {
    return {
      outcome: "locked",
      challenge,
      attemptsRemaining: 0,
      message: "Too many wrong codes. Ask for a new one.",
    };
  }

  // Expiry is checked before the code, so a correct-but-late code is refused
  // for being late rather than silently accepted.
  if (challenge.status === "superseded" || Date.parse(asOf) >= Date.parse(challenge.expiresAt)) {
    return {
      outcome: "expired",
      challenge: { ...challenge, status: "expired" },
      attemptsRemaining: 0,
      message: "That code has expired. Ask for a new one.",
    };
  }

  const attempts = challenge.attempts + 1;

  if (codeMatches) {
    return {
      outcome: "verified",
      challenge: { ...challenge, status: "verified", attempts, verifiedAt: asOf },
      attemptsRemaining: 0,
      message: "",
    };
  }

  // The attempt is counted whether or not it burns the challenge, so a wrong
  // code always costs something.
  if (attempts >= OTP_POLICY.maxAttempts) {
    return {
      outcome: "locked",
      challenge: { ...challenge, status: "locked", attempts },
      attemptsRemaining: 0,
      message: "Too many wrong codes. Ask for a new one.",
    };
  }

  const remaining = OTP_POLICY.maxAttempts - attempts;
  return {
    outcome: "wrong_code",
    challenge: { ...challenge, attempts },
    attemptsRemaining: remaining,
    // Counting down out loud is deliberate: someone mistyping their own code
    // should know the lockout is coming before it arrives.
    message:
      remaining === 1
        ? "That code is not right. One more try before you need a new code."
        : `That code is not right. ${remaining} tries left.`,
  };
}

/** Seconds left on a pending challenge, for the "resend" countdown. */
export function secondsUntilExpiry(challenge: OtpChallenge, asOf: string): number {
  return Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - Date.parse(asOf)) / 1000));
}
