import { evaluateRequest, evaluateVerification, expiryFor, OTP_POLICY, type OtpChallenge } from "@/domain/portal/otp";
import type { E164 } from "@/domain/portal/phone";
import type { PortalGrant, PortalIdentity } from "@/domain/portal/identity";
import type { OtpRequestResult, OtpService, OtpVerifyResult, PortalDirectory, SmsSender } from "@/domain/portal/ports";

/**
 * Honest fakes, so the portal can be built and tested before Twilio exists.
 *
 * Same rule as `documents/memoryAdapters.ts`: never fake success. These do the
 * real policy — cooldowns, lockouts, enumeration resistance — because that is
 * the part worth testing. What they do not do is send anything, and they say so
 * rather than reporting a delivered message that never left the building.
 */

// ------------------------------------------------------------------- sms --

/** Records what would have been sent. Nothing leaves. */
export class MemorySmsSender implements SmsSender {
  readonly outbox: Array<{ to: E164; body: string; at: string }> = [];

  async send(input: { to: E164; body: string }) {
    this.outbox.push({ ...input, at: new Date().toISOString() });
    // providerId is null, not a plausible-looking fake id. A null here is a
    // developer noticing nothing is connected; a fake id is one not noticing.
    return { delivered: false, providerId: null };
  }
}

// ------------------------------------------------------------------- otp --

let counter = 0;
const nextId = () => `chal_${++counter}`;

/**
 * An in-memory OTP service.
 *
 * The code is stored in the clear here because there is nothing to protect in a
 * test double and a fake hash would misrepresent what production must do. The
 * real adapter stores a salted hash and compares in constant time; the port's
 * doc comment says so, and this class does not pretend otherwise.
 */
export class MemoryOtpService implements OtpService {
  private challenges = new Map<string, OtpChallenge & { code: string }>();
  private requests = new Map<E164, string[]>();

  constructor(
    private readonly directory: PortalDirectory,
    private readonly sms: SmsSender,
    /** Fixed in tests so an assertion can know the code. */
    private readonly generateCode: () => string = () =>
      String(Math.floor(Math.random() * 10 ** OTP_POLICY.codeLength)).padStart(
        OTP_POLICY.codeLength,
        "0",
      ),
  ) {}

  async request(phone: E164, asOf = new Date().toISOString()): Promise<OtpRequestResult> {
    const history = this.requests.get(phone) ?? [];
    const windowStart = Date.parse(asOf) - OTP_POLICY.requestWindowSeconds * 1000;
    const inWindow = history.filter((t) => Date.parse(t) >= windowStart);

    const grants = await this.directory.grantsForPhone(phone);

    const decision = evaluateRequest({
      known: grants.some((g) => g.active),
      requestsInWindow: inWindow.length,
      lastRequestedAt: inWindow.at(-1) ?? null,
      asOf,
    });

    if (!decision.accepted) {
      return {
        message: decision.message,
        accepted: false,
        retryAfterSeconds: decision.retryAfterSeconds,
        challengeId: null,
      };
    }

    // The quota is consumed by an unknown number too. If it were not, the rate
    // at which Joy accepts requests would itself answer "is this number known?"
    this.requests.set(phone, [...inWindow, asOf]);

    // A new code supersedes any code still outstanding, so an old SMS cannot be
    // used after a resend.
    for (const [id, c] of this.challenges) {
      if (c.phone === phone && c.status === "pending") {
        this.challenges.set(id, { ...c, status: "superseded" });
      }
    }

    const id = nextId();
    const code = this.generateCode();
    this.challenges.set(id, {
      id,
      phone,
      code,
      codeHash: `unhashed:${code}`,
      status: "pending",
      attempts: 0,
      createdAt: asOf,
      expiresAt: expiryFor(asOf),
      verifiedAt: null,
    });

    if (decision.deliver) {
      await this.sms.send({
        to: phone,
        body: `${code} is your Joy Health code. It expires in 10 minutes.`,
      });
    }

    // challengeId is returned for an unknown number too — otherwise its absence
    // would be the tell that the message was suppressed.
    return {
      message: decision.message,
      accepted: true,
      retryAfterSeconds: null,
      challengeId: id,
    };
  }

  async verify(input: { challengeId: string; code: string; asOf?: string }): Promise<OtpVerifyResult> {
    const asOf = input.asOf ?? new Date().toISOString();
    const stored = this.challenges.get(input.challengeId) ?? null;

    const decision = evaluateVerification({
      challenge: stored,
      codeMatches: stored != null && stored.code === input.code,
      asOf,
    });

    if (decision.challenge && stored) {
      this.challenges.set(stored.id, { ...stored, ...decision.challenge });
    }

    if (decision.outcome !== "verified" || !stored) {
      return {
        verified: false,
        message: decision.message,
        attemptsRemaining: decision.attemptsRemaining,
        identity: null,
        sessionToken: null,
      };
    }

    const identity: PortalIdentity = {
      phone: stored.phone,
      grants: await this.directory.grantsForPhone(stored.phone),
      verifiedAt: asOf,
    };

    return {
      verified: true,
      message: "",
      attemptsRemaining: 0,
      identity,
      // No token. A fake one would be a real security decision made by a test
      // double; the server issues this.
      sessionToken: null,
    };
  }

  async pending(phone: E164): Promise<OtpChallenge | null> {
    for (const c of this.challenges.values()) {
      if (c.phone === phone && c.status === "pending") return c;
    }
    return null;
  }
}

// ------------------------------------------------------------- directory --

/** A directory backed by a fixed list, for seeds and tests. */
export class MemoryPortalDirectory implements PortalDirectory {
  private grants: Array<PortalGrant & { id: string }> = [];

  constructor(seed: Array<PortalGrant & { id: string; phone: E164 }> = []) {
    this.byPhone = new Map();
    for (const g of seed) {
      this.grants.push(g);
      this.byPhone.set(g.id, g.phone);
    }
  }

  private byPhone: Map<string, E164>;

  async grantsForPhone(phone: E164): Promise<PortalGrant[]> {
    return this.grants.filter((g) => this.byPhone.get(g.id) === phone);
  }

  async grantWorkforceAccess(input: { personId: string; phone: E164; invitedByUserId: string }) {
    const grant: PortalGrant & { id: string } = {
      id: `grant_${this.grants.length + 1}`,
      audience: "workforce",
      personId: input.personId,
      subjectPersonId: null,
      greetingName: "",
      subjectName: null,
      state: "invited",
      active: true,
    };
    this.grants.push(grant);
    this.byPhone.set(grant.id, input.phone);
    return grant;
  }

  async grantFamilyAccess(input: {
    personId: string;
    subjectPersonId: string;
    phone: E164;
    invitedByUserId: string;
  }) {
    const grant: PortalGrant & { id: string } = {
      id: `grant_${this.grants.length + 1}`,
      audience: "family",
      personId: input.personId,
      subjectPersonId: input.subjectPersonId,
      greetingName: "",
      subjectName: null,
      state: "pre_admission",
      active: true,
    };
    this.grants.push(grant);
    this.byPhone.set(grant.id, input.phone);
    return grant;
  }

  async revoke(input: { grantId: string }) {
    this.grants = this.grants.map((g) => (g.id === input.grantId ? { ...g, active: false } : g));
  }
}
