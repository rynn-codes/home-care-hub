import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizePhone, samePhone } from "@/domain/portal/phone";
import {
  evaluateRequest,
  evaluateVerification,
  expiryFor,
  OTP_POLICY,
  type OtpChallenge,
} from "@/domain/portal/otp";
import {
  familyNextStep,
  resolvePortal,
  workforceNextStep,
  grantAllows,
  grantAllowsAfterCareEnds,
  actionsAfterCareEnds,
  portalAfterDeath,
  type PortalGrant,
} from "@/domain/portal/identity";
import {
  MemoryOtpService,
  MemoryPortalDirectory,
  MemorySmsRouter,
  MemorySmsSender,
} from "@/domain/portal/memoryAdapters";
import {
  composeMessage,
  looksLikeItLeaksDetail,
  requiresBusinessAssociateAgreement,
  SMS_ROUTING,
  type MessagePurpose,
} from "@/domain/portal/messaging";

const T0 = "2026-08-20T09:00:00.000Z";
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();

// -------------------------------------------------------------- phone ----

describe("normalizePhone", () => {
  it("accepts every way the office has typed Joy's own number", () => {
    for (const written of [
      "713-231-9662",
      "(713) 231-9662",
      "7132319662",
      "1 713 231 9662",
      "+1 (713) 231-9662",
      "713.231.9662",
      "tel:+17132319662",
    ]) {
      expect(normalizePhone(written)).toEqual({ ok: true, e164: "+17132319662" });
    }
  });

  it("names the problem rather than failing silently", () => {
    expect(normalizePhone("")).toEqual({ ok: false, problem: "empty" });
    expect(normalizePhone("713231")).toEqual({ ok: false, problem: "too_short" });
    expect(normalizePhone("71323196621")).toEqual({ ok: false, problem: "too_long" });
    expect(normalizePhone("+44 20 7946 0958")).toEqual({ ok: false, problem: "not_north_american" });
  });

  it("rejects service codes and impossible area codes", () => {
    expect(normalizePhone("911-231-9662").ok).toBe(false);
    expect(normalizePhone("013-231-9662").ok).toBe(false);
    // Exchange may not start 0 or 1 either.
    expect(normalizePhone("713-131-9662").ok).toBe(false);
  });

  it("formats and masks", () => {
    expect(formatPhone("+17132319662")).toBe("(713) 231-9662");
    expect(maskPhone("+17132319662")).toBe("(•••) •••-9662");
  });

  it("matches two differently typed numbers as the same line", () => {
    expect(samePhone("(713) 231-9662", "7132319662")).toBe(true);
    expect(samePhone("(713) 231-9662", "7132319663")).toBe(false);
    expect(samePhone(null, "7132319662")).toBe(false);
  });
});

// ---------------------------------------------------------------- otp ----

describe("evaluateRequest", () => {
  const base = { requestsInWindow: 0, lastRequestedAt: null, asOf: T0 };

  it("says exactly the same thing to a known and an unknown number", () => {
    const known = evaluateRequest({ ...base, known: true });
    const unknown = evaluateRequest({ ...base, known: false });

    expect(known.message).toBe(unknown.message);
    expect(known.accepted).toBe(unknown.accepted);
    expect(known.denial).toBe(unknown.denial);
    // The only difference is what Joy does, not what Joy says.
    expect(known.deliver).toBe(true);
    expect(unknown.deliver).toBe(false);
  });

  it("holds the resend button for a minute", () => {
    const d = evaluateRequest({ ...base, known: true, lastRequestedAt: at(-30) });
    expect(d.denial).toBe("cooldown");
    expect(d.retryAfterSeconds).toBe(30);
    expect(d.deliver).toBe(false);
  });

  it("lets a resend through once the cooldown has passed", () => {
    const d = evaluateRequest({ ...base, known: true, lastRequestedAt: at(-61) });
    expect(d.accepted).toBe(true);
  });

  it("stops an SMS cannon after five in an hour", () => {
    const d = evaluateRequest({
      ...base,
      known: true,
      requestsInWindow: OTP_POLICY.maxRequestsPerWindow,
      lastRequestedAt: at(-3000),
    });
    expect(d.denial).toBe("rate_limited");
    expect(d.message).toContain("713) 231-9662");
  });
});

function challenge(over: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    id: "chal_1",
    phone: "+17132319662",
    codeHash: "unhashed:123456",
    status: "pending",
    attempts: 0,
    createdAt: T0,
    expiresAt: expiryFor(T0),
    verifiedAt: null,
    ...over,
  };
}

describe("evaluateVerification", () => {
  it("verifies a right code and records when", () => {
    const d = evaluateVerification({ challenge: challenge(), codeMatches: true, asOf: at(30) });
    expect(d.outcome).toBe("verified");
    expect(d.challenge?.status).toBe("verified");
    expect(d.challenge?.verifiedAt).toBe(at(30));
  });

  it("counts down out loud before locking", () => {
    let c = challenge();
    const seen: string[] = [];
    for (let i = 0; i < OTP_POLICY.maxAttempts; i++) {
      const d = evaluateVerification({ challenge: c, codeMatches: false, asOf: at(10) });
      seen.push(d.outcome);
      c = d.challenge!;
    }
    expect(seen).toEqual(["wrong_code", "wrong_code", "wrong_code", "wrong_code", "locked"]);
    expect(c.status).toBe("locked");
    expect(c.attempts).toBe(OTP_POLICY.maxAttempts);
  });

  it("refuses a correct code that arrives late, for being late", () => {
    const d = evaluateVerification({
      challenge: challenge(),
      codeMatches: true,
      asOf: at(OTP_POLICY.ttlSeconds + 1),
    });
    expect(d.outcome).toBe("expired");
  });

  it("refuses a superseded code even inside its own ten minutes", () => {
    // The resend case: an old SMS is still on the phone, still unexpired.
    const d = evaluateVerification({
      challenge: challenge({ status: "superseded" }),
      codeMatches: true,
      asOf: at(30),
    });
    expect(d.outcome).toBe("expired");
  });

  it("will not let one code be spent twice", () => {
    const d = evaluateVerification({
      challenge: challenge({ status: "verified", verifiedAt: at(5) }),
      codeMatches: true,
      asOf: at(30),
    });
    expect(d.outcome).toBe("already_used");
  });

  it("treats a missing challenge as expired, not as an error", () => {
    const d = evaluateVerification({ challenge: null, codeMatches: false, asOf: T0 });
    expect(d.outcome).toBe("no_challenge");
    expect(d.message).toContain("expired");
  });
});

// --------------------------------------------------------- adapters ------

function grant(over: Partial<PortalGrant> & { id: string; phone: string }) {
  return {
    audience: "workforce" as const,
    personId: "p1",
    subjectPersonId: null,
    greetingName: "Jamisha",
    subjectName: null,
    state: "invited" as const,
    active: true,
    ...over,
  };
}

describe("MemoryOtpService", () => {
  function build(seed: Array<ReturnType<typeof grant>> = []) {
    const directory = new MemoryPortalDirectory(seed as never);
    const sms = new MemorySmsSender();
    const otp = new MemoryOtpService(directory, sms, () => "123456");
    return { directory, sms, otp };
  }

  it("is indistinguishable to a caller probing for an unknown number", async () => {
    const known = build([grant({ id: "g1", phone: "+17132319662" })]);
    const unknown = build();

    const a = await known.otp.request("+17132319662", T0);
    const b = await unknown.otp.request("+17135550100", T0);

    expect(a.accepted).toBe(b.accepted);
    expect(a.message).toBe(b.message);
    // A challenge id comes back either way; its absence would be the tell.
    expect(a.challengeId).not.toBeNull();
    expect(b.challengeId).not.toBeNull();

    // The difference is only that nothing was texted.
    expect(known.sms.outbox).toHaveLength(1);
    expect(unknown.sms.outbox).toHaveLength(0);
  });

  it("consumes an unknown number's quota too", async () => {
    const { otp } = build();
    await otp.request("+17135550100", T0);
    const second = await otp.request("+17135550100", at(5));
    // Cooldown applies to a number Joy has never heard of, so request timing
    // cannot be used to tell known from unknown either.
    expect(second.accepted).toBe(false);
    expect(second.retryAfterSeconds).toBe(55);
  });

  it("verifies and returns the grants the phone unlocks", async () => {
    const { otp, sms } = build([grant({ id: "g1", phone: "+17132319662" })]);
    const req = await otp.request("+17132319662", T0);
    expect(sms.outbox[0].body).toContain("123456");

    const res = await otp.verify({ challengeId: req.challengeId!, code: "123456", asOf: at(20) });
    expect(res.verified).toBe(true);
    expect(res.identity?.grants).toHaveLength(1);
    // No fabricated session token — the server issues that.
    expect(res.sessionToken).toBeNull();
  });

  it("burns the old code when a new one is requested", async () => {
    const { otp } = build([grant({ id: "g1", phone: "+17132319662" })]);
    const first = await otp.request("+17132319662", T0);
    await otp.request("+17132319662", at(90));

    const res = await otp.verify({ challengeId: first.challengeId!, code: "123456", asOf: at(95) });
    expect(res.verified).toBe(false);
  });

  it("does not report an SMS as delivered when nothing is connected", async () => {
    const { sms } = build();
    const result = await sms.send(composeMessage("login_code_workforce", "+17132319662", { code: "1" }));
    expect(result.delivered).toBe(false);
    expect(result.providerId).toBeNull();
  });

  it("sends a caregiver's code from the number they already text with", async () => {
    const { otp, sms } = build([grant({ id: "g1", phone: "+17132319662" })]);
    await otp.request("+17132319662", T0);
    expect(sms.outbox[0].purpose).toBe("login_code_workforce");
    expect(sms.outbox[0].carrier).toBe("ghl");
  });

  it("sends a family member's code from GHL too — they met Joy as a lead there", async () => {
    const { otp, sms } = build([
      grant({ id: "g1", phone: "+17132319662", audience: "family", subjectPersonId: "p9" }),
    ]);
    await otp.request("+17132319662", T0);
    expect(sms.outbox[0].purpose).toBe("login_code_family");
    expect(sms.outbox[0].carrier).toBe("ghl");
  });
});

// ------------------------------------------------------------ messaging --

describe("SMS routing and templates", () => {
  const ALL: MessagePurpose[] = Object.keys(SMS_ROUTING) as MessagePurpose[];

  it("never puts clinical detail in a text", () => {
    // §25: the text says something changed, the portal holds what.
    for (const purpose of ALL) {
      const msg = composeMessage(purpose, "+17132319662", {
        firstName: "Susan",
        clientFirstName: "Marcus",
        code: "123456",
        link: "https://joy.example/p/abc",
      });
      expect(looksLikeItLeaksDetail(msg.body)).toBe(false);
    }
  });

  it("keeps the login code free of a name, a link and a reason", () => {
    const msg = composeMessage("login_code_family", "+17132319662", {
      firstName: "Susan",
      clientFirstName: "Marcus",
      code: "123456",
      link: "https://joy.example/p/abc",
    });
    expect(msg.body).not.toContain("Susan");
    expect(msg.body).not.toContain("Marcus");
    expect(msg.body).not.toContain("http");
    // The line that survives a caller pretending to be the office.
    expect(msg.body).toContain("never ask you for it");
  });

  it("says a schedule changed without saying how", () => {
    const msg = composeMessage("care_notification", "+17132319662", {
      firstName: "Susan",
      clientFirstName: "Marcus",
      link: "https://joy.example/p/abc",
    });
    expect(msg.body).toContain("update about Marcus's care");
    expect(msg.body).toContain("Open your Joy portal");
  });

  it("tells a family about money without saying any (§9.4)", () => {
    // The spec's own examples: "A new Joy invoice is available", "Your payment
    // method needs attention." A dollar figure on a lock screen is the size of
    // somebody's care, and "card declined" is a financial fact about the
    // family — both readable by whoever is holding the phone.
    const invoice = composeMessage("invoice_notification", "+17132319662", {
      firstName: "Susan",
      link: "https://joy.example/p/abc",
    });
    expect(invoice.body).toContain("invoice is available");
    expect(invoice.body).not.toMatch(/\$|\d+\.\d{2}/);
    expect(invoice.carrier).toBe("spruce");

    const method = composeMessage("payment_method_notification", "+17132319662", {
      firstName: "Susan",
      link: "https://joy.example/p/abc",
    });
    expect(method.body).toContain("needs attention");
    expect(method.body).not.toMatch(/declin|expir|fail/i);
    expect(method.carrier).toBe("spruce");
  });

  it("keeps every login code off the office number", () => {
    // Karynn, 20 Aug: all OTPs through GHL.
    expect(SMS_ROUTING.login_code_workforce).toBe("ghl");
    expect(SMS_ROUTING.login_code_family).toBe("ghl");
  });

  it("sends every notification from the number a person is watching", () => {
    // A family that texts back "why did Monday move?" must reach the office,
    // and so must a caregiver whose Tuesday just moved. The line is not
    // staff-versus-family — it is whether a conversation is already open.
    expect(SMS_ROUTING.care_notification).toBe("spruce");
    expect(SMS_ROUTING.shift_notification).toBe("spruce");
  });

  it("marks the purposes that reach a client, whichever number carries them", () => {
    // The BAA follows the audience, not the carrier — family codes go via GHL
    // and still need one.
    expect(requiresBusinessAssociateAgreement("login_code_family")).toBe(true);
    expect(requiresBusinessAssociateAgreement("care_notification")).toBe(true);
    // Addressed to staff, but naming a client to a caregiver discloses that
    // the client receives care.
    expect(requiresBusinessAssociateAgreement("shift_notification")).toBe(true);
    expect(requiresBusinessAssociateAgreement("login_code_workforce")).toBe(false);
    expect(requiresBusinessAssociateAgreement("candidate_invitation")).toBe(false);
  });

  it("refuses to send rather than falling back to whichever number is configured", async () => {
    // Silently sending a care notification from GHL would undo the separation.
    const router = new MemorySmsRouter({ ghl: new MemorySmsSender("ghl") });
    await expect(
      router.deliver({ purpose: "care_notification", to: "+17132319662" }),
    ).rejects.toThrow(/No sender registered for spruce/);
  });

  it("splits identity traffic from the care conversation", async () => {
    const ghl = new MemorySmsSender("ghl");
    const spruce = new MemorySmsSender("spruce");
    const router = new MemorySmsRouter({ ghl, spruce });

    await router.deliver({ purpose: "candidate_invitation", to: "+17135550100" });
    await router.deliver({ purpose: "login_code_family", to: "+17135550101", inputs: { code: "123456" } });
    await router.deliver({ purpose: "care_notification", to: "+17135550101" });

    expect(ghl.outbox.map((m) => m.purpose)).toEqual(["candidate_invitation", "login_code_family"]);
    expect(spruce.outbox.map((m) => m.purpose)).toEqual(["care_notification"]);
  });
});

// -------------------------------------------------------------- routing --

describe("resolvePortal", () => {
  const workforce = grant({ id: "g1", phone: "+1", state: "active" });
  const family = grant({
    id: "g2",
    phone: "+1",
    audience: "family",
    subjectPersonId: "p9",
    subjectName: "Marcus",
    state: "active",
  });

  it("routes straight through when a phone unlocks one portal", () => {
    const r = resolvePortal({ phone: "+17132319662", grants: [workforce], verifiedAt: T0 });
    expect(r.outcome).toBe("one");
    expect(r.route).toBe("/portal/work");
  });

  it("asks rather than guessing when a caregiver is also a daughter", () => {
    // 0001_foundation.sql's founding example, now with one phone number.
    const r = resolvePortal({
      phone: "+17132319662",
      grants: [workforce, family],
      verifiedAt: T0,
    });
    expect(r.outcome).toBe("choose");
    expect(r.route).toBeNull();
    expect(r.choices).toHaveLength(2);
  });

  it("ignores revoked grants", () => {
    const r = resolvePortal({
      phone: "+17132319662",
      grants: [{ ...workforce, active: false }, family],
      verifiedAt: T0,
    });
    expect(r.outcome).toBe("one");
    expect(r.route).toBe("/portal/care");
  });

  it("says plainly when a verified phone unlocks nothing", () => {
    const r = resolvePortal({
      phone: "+17132319662",
      grants: [{ ...workforce, active: false }],
      verifiedAt: T0,
    });
    expect(r.outcome).toBe("none");
    expect(r.route).toBeNull();
  });
});

describe("workforceNextStep", () => {
  const base = {
    hiringStage: null,
    onboardingStage: null,
    outstandingDocuments: [],
    visitsToday: 0,
    nextVisitLabel: null,
  };

  it("gives a candidate under review no button to press", () => {
    // §5: Joy holds the ball, and a button would imply the candidate does not.
    const step = workforceNextStep({ ...base, state: "under_review" });
    expect(step.action).toBeNull();
    expect(step.headline).toBe("We're reviewing your information");
  });

  it("names the document rather than counting to it", () => {
    const step = workforceNextStep({
      ...base,
      state: "documents",
      outstandingDocuments: ["TB screening", "CPR card"],
    });
    expect(step.headline).toBe("Upload your TB screening");
    expect(step.action?.to).toBe("/portal/work/documents");
  });

  it("puts today's visit ahead of a credential that has not expired yet", () => {
    const step = workforceNextStep({
      ...base,
      state: "active",
      visitsToday: 1,
      nextVisitLabel: "Evelyn Carter, 9:00 AM",
      outstandingDocuments: ["TB screening"],
    });
    expect(step.headline).toBe("Evelyn Carter, 9:00 AM");
  });

  it("admits when there is nothing to do", () => {
    const step = workforceNextStep({ ...base, state: "active" });
    expect(step.headline).toBe("Nothing needs you right now");
    expect(step.action).toBeNull();
  });
});

describe("familyNextStep", () => {
  const base = {
    subjectName: "Marcus",
    requestedDocuments: [],
    awaitingSignature: [],
    startOfCare: null,
    nextVisitLabel: null,
  };

  it("puts a signature ahead of a document request", () => {
    // A missing signature stops care starting; a missing document usually does not.
    const step = familyNextStep({
      ...base,
      state: "pre_admission",
      awaitingSignature: ["Service Agreement"],
      requestedDocuments: ["medication list"],
    });
    expect(step.headline).toBe("Service Agreement needs your signature");
  });

  it("asks for the document by the client's name", () => {
    const step = familyNextStep({
      ...base,
      state: "pre_admission",
      requestedDocuments: ["medication list"],
    });
    expect(step.headline).toBe("Please upload Marcus's medication list");
  });

  it("does not invent a task while the office is getting ready", () => {
    const step = familyNextStep({ ...base, state: "pre_admission", startOfCare: "Monday" });
    expect(step.headline).toBe("Care starts Monday");
    expect(step.action).toBeNull();
  });
});

describe("grantAllows — §9.1's widened grant, mirrored from 0018", () => {
  const grant = (over: Partial<PortalGrant> = {}): PortalGrant => ({
    audience: "family",
    personId: "p-susan",
    subjectPersonId: "c-marcus",
    greetingName: "Susan",
    subjectName: "Marcus",
    state: "active",
    active: true,
    role: "responsible_party",
    allowedActions: ["view_invoices", "pay_invoice"],
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
    ...over,
  });

  const TODAY = "2026-08-22";

  it("allows what the grant says, today", () => {
    expect(grantAllows(grant(), "view_invoices", TODAY)).toBe(true);
    expect(grantAllows(grant(), "pay_invoice", TODAY)).toBe(true);
  });

  it("what a grant does not say, it does not allow", () => {
    // The daughter pays; the son follows along. Same client, different grants.
    const son = grant({ allowedActions: ["view_care_updates"] });
    expect(grantAllows(son, "view_invoices", TODAY)).toBe(false);
  });

  it("respects the window at both ends", () => {
    expect(grantAllows(grant({ effectiveFrom: "2026-09-01" }), "view_invoices", TODAY)).toBe(false);
    expect(grantAllows(grant({ effectiveTo: "2026-08-21" }), "view_invoices", TODAY)).toBe(false);
    expect(grantAllows(grant({ effectiveTo: "2026-08-22" }), "view_invoices", TODAY)).toBe(true);
  });

  it("a revoked grant allows nothing, immediately", () => {
    expect(grantAllows(grant({ active: false }), "view_invoices", TODAY)).toBe(false);
  });

  it("a workforce grant is not a finance surface", () => {
    const caregiver = grant({ audience: "workforce", subjectPersonId: null });
    expect(grantAllows(caregiver, "view_invoices", TODAY)).toBe(false);
  });
});

describe("after a death, the payer's portal stays open", () => {
  // Karynn, 22 Aug: "Portal stays open for the payer." The care surface
  // closes; the finance surface does not — the final invoices, the balance,
  // and the means to pay it, without a phone call to ask what is owed.
  const daughter: PortalGrant = {
    audience: "family",
    personId: "p-susan",
    subjectPersonId: "c-marcus",
    greetingName: "Susan",
    subjectName: "Marcus",
    state: "closed",
    active: true,
    role: "responsible_party",
    allowedActions: ["view_invoices", "pay_invoice", "view_care_updates"],
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  };

  it("keeps the finance actions and drops the care ones", () => {
    expect(actionsAfterCareEnds(daughter)).toEqual(["view_invoices", "pay_invoice"]);
    expect(grantAllowsAfterCareEnds(daughter, "pay_invoice", "2026-08-22")).toBe(true);
    expect(grantAllowsAfterCareEnds(daughter, "view_care_updates", "2026-08-22")).toBe(false);
  });

  it("never widens — an action the grant did not carry does not appear", () => {
    const son: PortalGrant = { ...daughter, allowedActions: ["view_care_updates"] };
    expect(actionsAfterCareEnds(son)).toEqual([]);
  });

  it("a revocation still ends everything — the filter is not a bypass", () => {
    const revoked: PortalGrant = { ...daughter, active: false };
    expect(grantAllowsAfterCareEnds(revoked, "pay_invoice", "2026-08-22")).toBe(false);
  });

  it("stays open exactly as long as money is owed, and not a day past it", () => {
    // The second half of her rule: "the client portal needs to close after
    // payment is settled."
    const owing = portalAfterDeath({ grant: daughter, balanceOutstanding: 360 });
    expect(owing.open).toBe(true);
    expect(owing.actions).toEqual(["view_invoices", "pay_invoice"]);

    const settled = portalAfterDeath({ grant: daughter, balanceOutstanding: 0 });
    expect(settled.open).toBe(false);
    expect(settled.actions).toEqual([]);
    // Closure is a recommendation to revoke attributably — nothing closes
    // itself, and the closure gets a name and a reason like every revocation.
    expect(settled.why).toContain("revoke");
  });
});

describe("the Thursday reminder text", () => {
  it("asks for payment without an amount, a threat, or the word overdue", () => {
    const msg = composeMessage("payment_reminder", "+17132319662", {
      firstName: "Susan",
      link: "https://joy.example/p/abc",
    });
    expect(msg.body).toContain("awaiting payment");
    expect(msg.body).not.toMatch(/\$|\d+\.\d{2}|overdue|late fee/i);
    expect(msg.carrier).toBe("spruce");
  });
});
