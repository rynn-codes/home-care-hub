import type { E164 } from "@/domain/portal/phone";
import type { OtpChallenge } from "@/domain/portal/otp";
import type { PortalGrant, PortalIdentity } from "@/domain/portal/identity";
import type { MessagePurpose, OutboundMessage, SmsCarrier } from "@/domain/portal/messaging";
import type { GustoStatus } from "@/domain/portal/onboarding";
import type { ChartDraft } from "@/domain/portal/charting";
import type { CareTask, VisitRecord } from "@/domain/portal/visit";

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

/**
 * One carrier's outbound SMS. GHL, Spruce, or a transactional provider.
 *
 * `send` takes a composed `OutboundMessage`, never a loose body, so no caller
 * can write its own text. `messaging.ts` explains why that matters.
 */
export interface SmsSender {
  readonly carrier: SmsCarrier;
  send(message: OutboundMessage): Promise<{ delivered: boolean; providerId: string | null }>;
}

/**
 * Picks the carrier for a purpose and hands the message to it.
 *
 * This is the seam Karynn's GHL-or-Spruce question actually turns on. Joy's
 * code asks for "the candidate invitation"; the routing table decides which
 * number carries it. Moving a purpose between carriers is then a one-line
 * change with a test behind it, not a migration.
 */
export interface SmsRouter {
  deliver(input: {
    purpose: MessagePurpose;
    to: E164;
    inputs?: Record<string, string | undefined>;
  }): Promise<{ delivered: boolean; carrier: SmsCarrier; providerId: string | null }>;
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

// ------------------------------------------------------------------ hr --

/**
 * Gusto, or whichever payroll provider replaces it.
 *
 * §6 assigns the HR workflow to Gusto deliberately — W-4, I-9, direct deposit
 * — and tells Joy not to rebuild it. So this port is narrow on purpose: Joy
 * asks where somebody has got to and gets a link to send them. It has no
 * ability to read a tax form or a bank detail, and that is the point. A wider
 * port would invite Joy to start storing the things it decided not to store.
 *
 * `status` returning null means "not connected", not "not started". The
 * difference matters on screen: one is a prompt, the other would be Joy
 * telling a new hire their paperwork is underway when Joy has no idea.
 */
export interface HrOnboardingService {
  status(employeeRef: string): Promise<GustoStatus | null>;
  /** A link for this person, if the provider issues per-person links. */
  onboardingUrl(employeeRef: string): Promise<string | null>;
}

// ------------------------------------------------------------ charting --

/**
 * The model that turns a caregiver's narrative into chart lines — §12.
 *
 * Note what it is not allowed to do. It receives the visit record and the
 * caregiver's own words, and it returns a draft whose every non-recorded line
 * cites a span of that narrative. `validateDraft` then checks those citations
 * against the text before a caregiver is shown anything, so a service that
 * invents a fact produces a draft that is thrown away rather than a chart that
 * is confirmed.
 *
 * That check runs on Joy's side, not the provider's. A port that trusted the
 * model to police itself would be a port with no guarantee at all.
 *
 * Returning null means "no draft" and is a perfectly good answer — Joy falls
 * back to the caregiver's verbatim words, which is a less tidy chart and a
 * strictly more trustworthy one.
 */
export interface ChartDraftingService {
  draft(input: {
    record: VisitRecord;
    tasks: readonly CareTask[];
    visitId: string;
  }): Promise<ChartDraft | null>;
}

/**
 * Speech to text for the dictate option — §12 and §14.
 *
 * Separate from the drafting service on purpose. Transcription is a different
 * risk: its failure is a wrong word, not an invented fact, and a caregiver can
 * see a wrong word. Joy treats the transcript as the caregiver's own words
 * once she has read it, which is why the UI must show it to her before it
 * becomes the narrative.
 */
export interface DictationService {
  transcribe(audio: Blob): Promise<{ text: string; confidence: number } | null>;
}
