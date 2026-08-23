import { Button } from "@/components/ui/button";
import { CONSENTS, CONSENT_GROUPS, type ConsentDecisions } from "@/domain/consents/registry";
import { witnessLine } from "@/domain/consents/witness";
import type { DemoConsentSession } from "@/lib/demoStore";

/**
 * The signed packet, rendered as the document it is.
 *
 * This is the RECORD made readable — every clause in full, this client's
 * decisions, and the signature block exactly as it was captured: the typed
 * signature, the initials, the witness, the timestamps, including the moment
 * the completed document was reviewed in its entirety (Karynn's requirement).
 * Print it and the browser produces the PDF.
 *
 * Deliberately NOT the CONSENT_PDF_GENERATION_ENABLED integration, which
 * stays off. That flag is for a server-produced, stored, tamper-evident
 * document — the legal artifact. This view renders what Joy recorded, says
 * what it is, and never claims to be more. §41: no fake success.
 */
export function SignedPacket({
  clientName,
  session,
  onClose,
}: {
  clientName: string;
  session: DemoConsentSession;
  onClose: () => void;
}) {
  const decisions: ConsentDecisions = session.decisions ?? {};
  const fmt = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString([], {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  return (
    <div className="signed-packet fixed inset-0 z-50 overflow-y-auto bg-white text-black">
      {/* On print, only this packet is visible — everything else in the app
          disappears. Injected here so the rule exists only while the packet
          is open. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .signed-packet, .signed-packet * { visibility: visible; }
          .signed-packet { position: absolute; inset: 0; overflow: visible; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="no-print mb-6 flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print / save as PDF</Button>
        </div>

        <header className="border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold">Joy Healthcare Services, LLC</h1>
          <p className="mt-1 text-sm">Service agreement and consents — signed record</p>
          <p className="mt-3 text-sm">
            Client: <strong>{clientName}</strong>
          </p>
        </header>

        {CONSENT_GROUPS.map(({ group, title }) => (
          <section key={group} className="mt-8">
            <h2 className="text-base font-bold">{title}</h2>
            {CONSENTS.filter((c) => c.group === group).map((c) => (
              <article key={c.key} className="mt-4 break-inside-avoid">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-sm font-semibold">{c.title}</h3>
                  <span className="shrink-0 text-sm font-semibold uppercase">
                    {decisions[c.key] === "agree"
                      ? "Agreed"
                      : decisions[c.key] === "decline"
                        ? "Declined"
                        : "N/A"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">{c.fullText}</p>
              </article>
            ))}
          </section>
        ))}

        <section className="mt-10 border-t-2 border-black pt-6">
          <h2 className="text-base font-bold">Signature</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="border-b border-black pb-1 font-serif text-2xl">
                {session.signatureText ?? session.signerName ?? "—"}
              </p>
              <p className="mt-1 text-xs">
                Signature (typed) — {session.signerName ?? "—"}
                {session.signerRelationship ? `, ${session.signerRelationship}` : ""}
              </p>
            </div>
            <div>
              <p className="border-b border-black pb-1 font-serif text-2xl">
                {session.initials ?? "—"}
              </p>
              <p className="mt-1 text-xs">Initials, applied where the packet asks</p>
            </div>
          </div>

          <dl className="mt-6 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="font-semibold">Completed document reviewed in its entirety:</dt>
              <dd>{fmt(session.reviewedCompletedAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">Signed:</dt>
              <dd>{fmt(session.signedAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">Witness:</dt>
              <dd>
                {witnessLine(
                  session.witnessName && session.witnessRole
                    ? { name: session.witnessName, role: session.witnessRole }
                    : null,
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-6 text-[10px] leading-relaxed">
            A typed signature stands in for handwriting in this prototype. This page renders
            Joy's stored record of the signing; the tamper-evident generated document is a
            separate integration and is not yet enabled.
          </p>
        </section>
      </div>
    </div>
  );
}
