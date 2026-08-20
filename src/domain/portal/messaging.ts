import type { E164 } from "@/domain/portal/phone";

/**
 * Outbound texts: what Joy is allowed to say, and who carries it.
 *
 * Two decisions live here, and they are separate on purpose.
 *
 * WHO CARRIES IT
 *
 * Joy has two numbers already — GHL and Spruce — and they are good at different
 * things. Rather than picking one and wiring it through the codebase, every
 * message declares its *purpose*, and a routing table maps purpose to carrier.
 * Changing carrier is then one line in `SMS_ROUTING`, not a search through the
 * app. If A2P registration or a BAA forces a change later, it costs a config
 * edit.
 *
 * WHAT IT SAYS
 *
 * There is no free-text SMS body anywhere in Joy. Every message is built from a
 * template in this file out of a small, named set of inputs, and none of those
 * inputs is a diagnosis, a medication, a visit note or a Moment.
 *
 * That is §25 enforced rather than intended. §25 says the portal is the
 * persistent source of truth and Spruce is the notification channel, and that
 * "important status information should not live only in a text thread." A text
 * that said "Marcus's insulin schedule changed" would put clinical detail in a
 * carrier's logs, on a lock screen, and in whatever backup the phone makes —
 * outside every control Joy has. So the text says something changed and to open
 * Joy. The detail is behind the login, which is the whole point of building a
 * portal.
 *
 * A `body` parameter on the sender would make that rule advisory. There isn't
 * one.
 */

/**
 * The numbers Joy sends from, and the principle that decides which.
 *
 * CAN THEY USEFULLY REPLY?
 *
 * That is the whole test, and it falls out of Karynn's two instructions on
 * 20 Aug — "All OTPs need to go through GHL", and "Care notification questions
 * will come from Spruce."
 *
 * Spruce is the office's number: where a human at Joy has a conversation with
 * the people it already works with. Tell a family their mother's Monday visit
 * moved and some of them will text back asking why. Tell a caregiver her
 * Tuesday moved and she may well do the same. Either reply has to land in front
 * of an actual person at Joy, so the message it answers must have come from the
 * number a person is watching. Sending it from a marketing platform routes a
 * worried family — or a caregiver who now has a childcare problem — into a
 * channel nobody reads.
 *
 * GHL carries everything a reply makes no sense to. A login code cannot be
 * replied to. Neither can a recruiting handoff — that conversation continues in
 * the thread the recruiter is already in, which is GHL's.
 *
 * Note that the line is not staff-versus-family. It is whether a conversation
 * is already open. An operational message to an active caregiver belongs on the
 * office number for the same reason one to a family does.
 *
 * The separation cuts the other way too: a client who gets automated traffic on
 * Spruce learns to skim the number the RN uses to tell them something urgent.
 */
export type SmsCarrier = "ghl" | "spruce" | "transactional";

export const CARRIER_LABELS: Record<SmsCarrier, string> = {
  ghl: "GoHighLevel",
  spruce: "Spruce — the office number",
  transactional: "Dedicated verification sender (unused — see SMS_ROUTING)",
};

/**
 * The one thing to check with each vendor before go-live.
 *
 * Written down here rather than left in a chat message, because whoever wires
 * this up will not have been in that conversation.
 */
export const CARRIER_PREFLIGHT: Record<SmsCarrier, string> = {
  ghl:
    "Two questions, both before launch. (1) Will GoHighLevel sign a business " +
    "associate agreement covering Joy's plan? Family login codes and portal " +
    "invitations go down this number, so the answer gates go-live. (2) Does " +
    "the number's A2P 10DLC campaign cover an authentication / 2FA use case and " +
    "not marketing alone? Codes on a marketing-only registration are the traffic " +
    "carriers filter first, and a filtered code looks like a broken portal.",
  spruce:
    "Confirm the BAA covers automated sends and not only staff-typed messages, " +
    "and that Spruce exposes an API for programmatic delivery on Joy's plan. If " +
    "it does not, care notifications need a different route — not a quiet " +
    "fallback to GHL, which would undo the separation on purpose here.",
  transactional:
    "Only needed if login codes prove unreliable on GHL. Whichever provider is " +
    "chosen must sign a BAA before it carries anything to a client.",
};

export type MessagePurpose =
  /** A login code to a candidate or caregiver. Sent from the number they know. */
  | "login_code_workforce"
  /** A login code to a client or family member. Same, from their number. */
  | "login_code_family"
  /** §2's handoff — Joy wants this candidate to move forward. */
  | "candidate_invitation"
  /** §5 — the candidate's status moved; the portal has the detail. */
  | "candidate_update"
  /** §19's handoff — the responsible party gets a portal. */
  | "family_invitation"
  /** §25 — a schedule or document change the family should open Joy for. */
  | "care_notification"
  /** A caregiver's shift changed. */
  | "shift_notification";

/**
 * Which number carries which message.
 *
 * The reasoning, since a table alone will not survive a handover:
 *
 * - Login codes → the number that person already texts with. Karynn's
 *   argument, and it is the stronger one: a code from a number you do not
 *   recognize is indistinguishable from a phishing text, and a portal that
 *   routinely sends codes from unfamiliar numbers is training its own users to
 *   accept codes from unfamiliar numbers. That is the habit attackers rely on.
 *
 *   Followed properly it splits, because the two audiences know different
 *   numbers. A candidate has been texting the recruiter on GHL since before
 *   Joy had a record of them (§2), so GHL is the familiar number. A family
 *   member has never seen GHL; they know Spruce, which is what Joy already uses
 *   with clients. Each gets their code from the number already in their phone.
 *
 *   `transactional` stays in `SmsCarrier` as the escape hatch. US carriers file
 *   authentication traffic under a different A2P 10DLC use case than marketing,
 *   so if codes start arriving late or not at all, the cause is almost
 *   certainly campaign registration on the sending number — see the note under
 *   `CARRIER_LABELS`. A dedicated verification service is the fix, at the cost
 *   of the recognition this routing buys.
 *
 * - `candidate_invitation`, `candidate_update` → GHL. GHL already owns
 *   recruiting up to the in-person interview (§2), so it already holds the
 *   candidate's number and the thread the recruiter has been texting in. The
 *   invitation arriving from a new number would look like spam. No PHI is
 *   involved — a candidate is not a patient.
 *
 * - `family_invitation`, `care_notification` → Spruce. These go to clients and
 *   their families about care. Even reduced to "something changed," the fact of
 *   the relationship is itself health information, and Spruce is the channel
 *   Joy already uses with clients.
 *
 * - `shift_notification` → Spruce. It names a client to a caregiver.
 */
export const SMS_ROUTING: Record<MessagePurpose, SmsCarrier> = {
  login_code_workforce: "ghl",
  login_code_family: "ghl",
  candidate_invitation: "ghl",
  candidate_update: "ghl",
  family_invitation: "ghl",
  care_notification: "spruce",
  shift_notification: "spruce",
};

/**
 * ONE ROW ABOVE IS INFERRED RATHER THAN INSTRUCTED, and it is a one-line change.
 *
 * `family_invitation` is on GHL because it is a handoff rather than a care
 * message: the family met Joy as a lead in GHL, and "here is your portal link"
 * invites a tap, not a reply. If Karynn would rather the first message a new
 * family gets come from the office number, move it to spruce.
 *
 * Everything else is her decision directly — all login codes on GHL, care and
 * shift notifications on Spruce.
 */

/**
 * True when a purpose carries client health information — which is to say, the
 * purposes whose carrier must be covered by a BAA.
 *
 * `shift_notification` counts although it is addressed to staff rather than to
 * a client: naming a client to a caregiver discloses that the client receives
 * care. The recipient is not what makes something protected.
 *
 * `login_code_family` belongs here even though its body is six digits and
 * nothing else. The protected fact is not the content — it is that Joy Health,
 * a home care agency, is texting this number at all. A carrier's logs showing
 * regular Joy traffic to a phone say that someone at that number is in a care
 * relationship, which is the disclosure, code or no code.
 */
export function reachesAClient(purpose: MessagePurpose): boolean {
  return (
    purpose === "login_code_family" ||
    purpose === "family_invitation" ||
    purpose === "care_notification" ||
    purpose === "shift_notification"
  );
}

/**
 * Whether the carrier for a purpose must be covered by a BAA.
 *
 * Kept as a function rather than a comment so a developer changing `SMS_ROUTING`
 * has something that can fail a test, not a paragraph they may not read.
 */
export function requiresBusinessAssociateAgreement(purpose: MessagePurpose): boolean {
  return reachesAClient(purpose);
}

// ------------------------------------------------------------ templates --

/**
 * The only inputs a template may take.
 *
 * Note what is absent: no diagnosis, no medication, no visit note, no Moment
 * text, no document name. `firstName` and `clientFirstName` are the most
 * identifying things here, and both are first names only.
 */
export interface MessageInputs {
  firstName?: string;
  clientFirstName?: string;
  code?: string;
  link?: string;
}

export interface OutboundMessage {
  to: E164;
  purpose: MessagePurpose;
  carrier: SmsCarrier;
  body: string;
}

const OFFICE = "(713) 231-9662";

/**
 * Build the message for a purpose.
 *
 * Every care-related template lands on the same shape: something happened, open
 * Joy. That repetition is the design, not a lack of imagination.
 */
export function composeMessage(
  purpose: MessagePurpose,
  to: E164,
  inputs: MessageInputs = {},
): OutboundMessage {
  const name = inputs.firstName ? `${inputs.firstName}, ` : "";
  const client = inputs.clientFirstName ?? "your family member";
  const link = inputs.link ?? "";

  const body = ((): string => {
    switch (purpose) {
      case "login_code_workforce":
      case "login_code_family":
        // No name, nothing about why, no link. Read off a lock screen by
        // whoever is holding the phone, and quoted back by anyone who calls
        // pretending to be the office — hence the last sentence.
        return `${inputs.code} is your Joy Health code. It expires in 10 minutes. We will never ask you for it.`;

      case "candidate_invitation":
        return `${name}thanks for coming in to meet us at Joy Health. We would like to move forward. Start your application here: ${link}`;

      case "candidate_update":
        return `${name}there is an update on your Joy Health application. Open your portal to see it: ${link}`;

      case "family_invitation":
        return `${name}Joy Health has set up your care portal. Sign in with this number to see next steps: ${link}`;

      case "care_notification":
        // Deliberately does not say what changed. §25.
        return `${name}there is an update about ${client}'s care. Open your Joy portal for the details: ${link}`;

      case "shift_notification":
        return `${name}your Joy Health schedule has changed. Open your portal to see it: ${link}`;
    }
  })();

  return { to, purpose, carrier: SMS_ROUTING[purpose], body };
}

/**
 * A crude guard against the thing this file exists to prevent.
 *
 * It cannot detect every leak — no string check can — but it catches the
 * realistic accident, which is a well-meaning change that starts putting the
 * useful detail in the text because the office is tired of saying "open the
 * app." Wired into a test, it turns that change into a red build.
 */
const CLINICAL_TERMS = [
  "diagnos",
  "medication",
  "dementia",
  "cancer",
  "insulin",
  "prescri",
  "hospice",
  "fall",
  "wound",
  "catheter",
  "incontinen",
];

export function looksLikeItLeaksDetail(body: string): boolean {
  const lower = body.toLowerCase();
  return CLINICAL_TERMS.some((term) => lower.includes(term));
}

export { OFFICE as OFFICE_NUMBER };
