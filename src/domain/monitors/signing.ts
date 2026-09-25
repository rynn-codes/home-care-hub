import { daysWaiting, waitingOnAgency, waitingOnSigner } from "@/domain/signing/envelopes";
import type { Monitor, RawFinding } from "./types";

/** A sent request nobody has signed for this long is worth a word. */
export const SIGNING_NUDGE_DAYS = 3;

/**
 * Signing Watch: is a document waiting on somebody's signature?
 *
 * Two things Joy notices. A client signed and the agency has not
 * countersigned — that is the office's turn, today. And a request sent days
 * ago that nobody has opened or signed — worth a call, since nobody is
 * texted automatically until Spruce is wired.
 */
export const signingWatch: Monitor = {
  id: "signing",
  name: "Signing Watch",
  question: "Is a document waiting on somebody's signature?",
  cadence: "daily",
  run({ envelopes, today }) {
    const out: RawFinding[] = [];
    for (const env of envelopes) {
      const doc = env.documentName.replace(/\.[a-z0-9]{2,5}$/i, "");
      if (waitingOnAgency(env)) {
        out.push({
          key: `signing:countersign:${env.id}`,
          subject: { kind: "client", id: env.clientPersonId, name: env.clientName },
          severity: "due_soon",
          headline: `${env.signedName ?? env.signerName} signed ${doc} — it is waiting on your signature`,
          because: `Signed ${env.signedAt?.slice(0, 10) ?? today}. The form has an agency signature box, so it is not complete until the office signs. A copy can go to the family once it is.`,
          next: { label: "Sign for the agency", to: `/documents/signing/${env.id}` },
        });
        continue;
      }
      if (waitingOnSigner(env)) {
        const days = daysWaiting(env, today);
        if (days < SIGNING_NUDGE_DAYS) continue;
        out.push({
          key: `signing:waiting:${env.id}`,
          subject: { kind: "client", id: env.clientPersonId, name: env.clientName },
          severity: "note",
          headline: `${env.signerName} has not signed ${doc} — sent ${days} days ago`,
          because: env.status === "viewed" ? "They opened it and stopped. Worth a call to see what is in the way." : "It has not been opened. Nobody is texted automatically yet, so a call or a resend is the nudge.",
          next: { label: "Open the request", to: `/documents/signing/${env.id}` },
        });
      }
    }
    return out;
  },
};
