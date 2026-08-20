import { evaluateRequest, evaluateVerification, expiryFor, OTP_POLICY, type OtpChallenge } from "@/domain/portal/otp";
import type { E164 } from "@/domain/portal/phone";
import type { PortalGrant, PortalIdentity } from "@/domain/portal/identity";
import type {
  HrOnboardingService,
  OtpRequestResult,
  OtpService,
  OtpVerifyResult,
  PortalDirectory,
  SmsRouter,
  SmsSender,
} from "@/domain/portal/ports";
import type { GustoStatus } from "@/domain/portal/onboarding";
import type { ChartDraftingService, DictationService } from "@/domain/portal/ports";
import { draftFromRecord, withVerbatimObservation, markValidated } from "@/domain/portal/charting";
import type { CareTask, VisitRecord } from "@/domain/portal/visit";
import {
  composeMessage,
  looksLikeItLeaksDetail,
  SMS_ROUTING,
  type MessageInputs,
  type MessagePurpose,
  type OutboundMessage,
  type SmsCarrier,
} from "@/domain/portal/messaging";

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
  readonly outbox: Array<OutboundMessage & { at: string }> = [];

  constructor(readonly carrier: SmsCarrier = "transactional") {}

  async send(message: OutboundMessage) {
    this.outbox.push({ ...message, at: new Date().toISOString() });
    // providerId is null, not a plausible-looking fake id. A null here is a
    // developer noticing nothing is connected; a fake id is one not noticing.
    return { delivered: false, providerId: null };
  }
}

/**
 * Routes by purpose across a set of carriers.
 *
 * Refusing an unregistered carrier rather than silently falling back is the
 * point: a Joy that quietly sent a family's care notification down whichever
 * number happened to be configured would be exactly the failure the routing
 * table exists to prevent.
 */
export class MemorySmsRouter implements SmsRouter {
  constructor(private readonly senders: Partial<Record<SmsCarrier, SmsSender>>) {}

  async deliver(input: { purpose: MessagePurpose; to: E164; inputs?: MessageInputs }) {
    const carrier = SMS_ROUTING[input.purpose];
    const sender = this.senders[carrier];

    if (!sender) {
      throw new Error(
        `No sender registered for ${carrier}, which carries ${input.purpose}. ` +
          `Register one rather than falling back — the routing table is a privacy decision.`,
      );
    }

    const message = composeMessage(input.purpose, input.to, input.inputs);

    // Belt and braces. Templates are fixed, but a future one could be careless.
    if (looksLikeItLeaksDetail(message.body)) {
      throw new Error(
        `Refusing to send ${input.purpose}: the body names clinical detail. ` +
          `Per §25 the text says something changed; the portal holds what.`,
      );
    }

    const result = await sender.send(message);
    return { ...result, carrier };
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
      // Which number the code comes from follows who they are, so it arrives
      // from a thread they recognize. Someone holding both grants recognizes
      // either, so workforce wins the tie by being the one they see daily.
      const purpose: MessagePurpose = grants.some((g) => g.active && g.audience === "workforce")
        ? "login_code_workforce"
        : "login_code_family";
      await this.sms.send(composeMessage(purpose, phone, { code }));
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

/**
 * No payroll provider is connected.
 *
 * Returns null rather than a plausible "in_progress", for the same reason
 * `MemorySmsSender` reports `delivered: false`: a fake status here would show a
 * new hire that their W-4 was underway, and the first person to find out
 * otherwise would be them, on payday.
 */
export class NullHrOnboardingService implements HrOnboardingService {
  // The parameter is named and unused on purpose: the signature is the port's,
  // so swapping a real adapter in is a drop-in rather than a signature change.
  async status(_employeeRef: string): Promise<GustoStatus | null> {
    return null;
  }

  async onboardingUrl(_employeeRef: string): Promise<string | null> {
    return null;
  }
}

/**
 * Charting with no model connected.
 *
 * This is not a stub that returns null — it produces a real, complete,
 * confirmable chart. Everything §12's example shows except the observation
 * line comes from what the caregiver already tapped, and the observation is her
 * own words unchanged.
 *
 * Worth being clear about what that means: Joy's charting works today, without
 * AI. The model would make the observation line tidier. It would not make the
 * chart possible, and a design that waited for it would have been a design that
 * put a language model on the critical path of a clinical record for the sake
 * of prose.
 */
export class VerbatimChartDraftingService implements ChartDraftingService {
  async draft(input: { record: VisitRecord; tasks: readonly CareTask[]; visitId: string }) {
    return markValidated(
      withVerbatimObservation(draftFromRecord(input.record, input.tasks, input.visitId)),
    );
  }
}

/**
 * No speech to text.
 *
 * Returns null rather than an empty string, so the UI can tell "she said
 * nothing" from "nothing is listening" and say the second one out loud.
 */
export class NullDictationService implements DictationService {
  async transcribe(): Promise<{ text: string; confidence: number } | null> {
    return null;
  }
}
