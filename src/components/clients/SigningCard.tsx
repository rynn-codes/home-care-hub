import { Link } from "react-router-dom";
import { PenLine } from "lucide-react";
import { StatusPill } from "@/components/signing/StatusPill";
import { envelopeLine, waitingOnAgency, waitingOnSigner, type Envelope } from "@/domain/signing/envelopes";
import { displayName } from "@/domain/documents/library";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Documents sent to this client or their family to sign, from Signing.
 * Requests are raised from a template because the form is the thing being
 * signed; they land here because the signature is a fact about the client.
 */
export function SigningCard({ envelopes, clientPersonId }: { envelopes: readonly Envelope[]; clientPersonId: string }) {
  const waitingSigner = envelopes.filter(waitingOnSigner).length;
  const waitingAgency = envelopes.filter(waitingOnAgency).length;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <PenLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Signing
        </h3>
        <Link to={`/documents/signing/new?client=${encodeURIComponent(clientPersonId)}`} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Send something to sign
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {envelopes.length === 0
          ? "Nothing has been sent to sign."
          : [waitingSigner ? `${waitingSigner} waiting on the family` : null, waitingAgency ? `${waitingAgency} waiting on your signature` : null].filter(Boolean).join(" · ") || "Nothing waiting."}
      </p>
      {envelopes.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {envelopes.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <Link to={`/documents/signing/${e.id}`} className="block text-sm hover:underline">
                  {displayName(e.documentName)}
                </Link>
                <span className="block text-xs text-muted-foreground">{envelopeLine(e, when)}</span>
              </span>
              <StatusPill status={e.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
