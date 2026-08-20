import { Check, FileText, Printer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuditPacket } from "@/domain/credentials/auditPacket";

/**
 * What the personnel-file audit packet will contain, on screen.
 *
 * §25 keeps a hard line between the generated artifact and the evidence: this
 * previews the packet's *structure* — cover, summary, checklist, sections and
 * the Joy cover that precedes each original — without pretending to be the PDF.
 * Producing pages is the AuditPacketService port's job and needs a toolchain
 * the developer connects.
 *
 * Previewing rather than only offering a download button is the honest choice
 * while that is true: somebody can see exactly what an auditor would receive,
 * and see it change when a credential is renewed, without a file that does not
 * exist yet.
 *
 * §16's rule is followed literally — every status carries a mark as well as a
 * colour, so the page survives a mono printer and a colour-blind reader.
 */

const MARK_TONE: Record<string, string> = {
  "✓": "text-[hsl(var(--success))]",
  "!": "text-[hsl(var(--warning))]",
  "✗": "text-destructive",
  "–": "text-muted-foreground",
};

export function AuditPacketPreview({
  packet,
  onGenerate,
}: {
  packet: AuditPacket;
  onGenerate: () => void;
}) {
  const { cover } = packet;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- cover ---- */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Joy Health
        </p>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight">{cover.title}</h2>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Employee", cover.employeeName],
            ["Position", cover.position],
            ["Hire date", cover.hireDate ?? "Not recorded"],
            ["Employment status", cover.employmentStatus],
            ["Generated", cover.generatedAt],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div
          className={cn(
            "mt-5 rounded-xl border p-4",
            cover.ready
              ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.06)]"
              : "border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)]",
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {cover.ready ? (
              <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
            ) : (
              <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" aria-hidden="true" />
            )}
            Audit readiness — {cover.readinessLine}
          </p>

          {cover.needsAttention.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Needs attention
              </p>
              <ul className="mt-1 space-y-0.5">
                {cover.needsAttention.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    ✗ {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {cover.current.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current
              </p>
              <ul className="mt-1 space-y-0.5">
                {cover.current.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">
                    ✓ {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------- summary ---- */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold">Credential summary</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Requirement</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Expires / completed</th>
                <th scope="col" className="py-2 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody>
              {packet.summary.map((row) => (
                <tr key={row.requirement} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4">{row.requirement}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    {/* §16: a mark as well as colour. */}
                    <span className={cn("mr-1.5 font-semibold", MARK_TONE[row.mark])}>{row.mark}</span>
                    {row.status}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">
                    {row.expiresOrCompleted}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{row.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------- checklist ---- */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold">Required document checklist</h3>
        <ul className="mt-3 space-y-1.5">
          {packet.checklist.map((item) => (
            <li key={item.requirement} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "font-semibold",
                  item.present ? "text-[hsl(var(--success))]" : "text-destructive",
                )}
              >
                {item.present ? "✓" : "✗"}
              </span>
              <span className={cn(!item.present && "text-muted-foreground")}>{item.requirement}</span>
              {!item.present && (
                <span className="text-xs text-muted-foreground">· {item.status}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- sections ---- */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold">Document sections</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each Joy cover sheet is followed by the original document, unmodified.
        </p>

        <div className="mt-4 space-y-5">
          {packet.sections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
              {section.note ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{section.note}</p>
              ) : (
                <ul className="mt-1.5 divide-y divide-border rounded-xl border border-border">
                  {section.covers.map((c) => (
                    <li key={c.documentName} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <span className="flex items-start gap-2">
                        <FileText
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block text-sm">{c.documentName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.credentialStatus}
                            {c.expirationDate ? ` · expires ${c.expirationDate}` : ""}
                            {c.verifiedBy ? ` · verified by ${c.verifiedBy}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.documentId ? c.standing : "No document on file"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button onClick={onGenerate}>
          <Printer className="mr-1.5 h-4 w-4" />
          Generate PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Everything above is composed from verified records and regenerates identically. Turning
          it into pages needs the PDF toolchain, which is not connected.
        </p>
      </div>
    </div>
  );
}
