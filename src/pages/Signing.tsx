import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FilePlus2, PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/signing/StatusPill";
import { useDemo } from "@/context/DemoDataProvider";
import { displayName } from "@/domain/documents/library";
import { envelopeLine, SIGNING_LIMITS, waitingOnAgency, waitingOnSigner, type Envelope } from "@/domain/signing/envelopes";
import { onFilesChanged, recallFile } from "@/lib/fileCache";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Signing — what is out for signature, what is waiting on the office, and
 * the forms set up to send.
 *
 * The office's replacement for DocuSign in its basic form: a template is a
 * PDF with boxes placed once; a request is that form sent to one client's
 * signer with Joy's prefill; the office countersigns when the form asks for
 * it, and can void or correct anything with a reason that stays on record.
 */
function Section({ title, hint, items, empty }: { title: string; hint?: string; items: Envelope[]; empty: string }) {
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
      <div className="border-b border-[var(--hairline-soft)] px-4 py-3">
        <h2 className="m-0 text-[13px] font-semibold">{title}</h2>
        {hint && <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
      </div>
      {items.length === 0 ? (
        <p className="m-0 px-4 py-5 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-[var(--hairline-soft)] p-0">
          {items.map((e) => (
            <li key={e.id}>
              <Link to={`/documents/signing/${e.id}`} className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--wash)]">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">
                    {displayName(e.documentName)} <span className="font-normal text-muted-foreground">· {e.clientName}</span>
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{envelopeLine(e, when)}</span>
                </span>
                <StatusPill status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Signing() {
  const { envelopes, signingTemplates, deleteSigningTemplate, documents } = useDemo();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Forms read back from the browser arrive after first paint.
  const [, setFilesTick] = useState(0);
  useEffect(() => onFilesChanged(() => setFilesTick((n) => n + 1)), []);

  const groups = useMemo(
    () => ({
      agency: envelopes.filter(waitingOnAgency),
      signer: envelopes.filter(waitingOnSigner),
      drafts: envelopes.filter((e) => e.status === "draft"),
      done: envelopes.filter((e) => e.status === "completed"),
      closed: envelopes.filter((e) => e.status === "declined" || e.status === "voided"),
    }),
    [envelopes],
  );
  const pdfs = useMemo(() => documents.filter((d) => d.kind === "pdf"), [documents]);

  return (
    <>
      <PageHeader
        parents={[
          { label: "The Brain", to: "/brain" },
          { label: "Documents", to: "/documents" },
        ]}
        title="Signing"
        description="Send a form to a client or their family, watch it come back, and countersign."
        actions={
          <>
            <Button variant="outline" onClick={() => setPicking(true)}>
              <FilePlus2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New template
            </Button>
            <Button onClick={() => navigate("/documents/signing/new")} disabled={signingTemplates.length === 0} title={signingTemplates.length === 0 ? "Set up a template first." : undefined}>
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Send to sign
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {groups.agency.length > 0 && <Section title="Waiting on your signature" hint="The client signed. The form is not complete until the agency does." items={groups.agency} empty="" />}
          <Section title="Out for signature" hint="With the client or their family." items={groups.signer} empty="Nothing is out for signature." />
          {groups.drafts.length > 0 && <Section title="Drafts" items={groups.drafts} empty="" />}
          <Section title="Completed" items={groups.done} empty="Nothing completed yet." />
          {groups.closed.length > 0 && (
            <details className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
              <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold">Declined and voided ({groups.closed.length})</summary>
              <ul className="m-0 list-none divide-y divide-[var(--hairline-soft)] border-t border-[var(--hairline-soft)] p-0">
                {groups.closed.map((e) => (
                  <li key={e.id}>
                    <Link to={`/documents/signing/${e.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[var(--wash)]">
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px]">
                          {displayName(e.documentName)} <span className="text-muted-foreground">· {e.clientName}</span>
                        </span>
                        <span className="block text-[12px] text-muted-foreground">{envelopeLine(e, when)}</span>
                      </span>
                      <StatusPill status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]">
            <div className="border-b border-[var(--hairline-soft)] px-4 py-3">
              <h2 className="m-0 flex items-center gap-2 text-[13px] font-semibold">
                <PenLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Templates
              </h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Forms with their boxes placed once.</p>
            </div>
            {signingTemplates.length === 0 ? (
              <p className="m-0 px-4 py-5 text-[13px] text-muted-foreground">No templates yet. Upload a PDF in Documents and choose "Set up for signing".</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--hairline-soft)] p-0">
                {signingTemplates.map((t) => (
                  <li key={t.id} className="px-4 py-3">
                    <p className="m-0 truncate text-[13.5px] font-medium" title={t.name}>{t.name}</p>
                    <p className="m-0 text-[12px] text-muted-foreground">
                      {t.fields.length} {t.fields.length === 1 ? "box" : "boxes"} · {t.pages} {t.pages === 1 ? "page" : "pages"}
                      {!recallFile(t.documentId) && " · pages not in this browser"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                      <Link to={`/documents/signing/new?template=${encodeURIComponent(t.id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        Use
                      </Link>
                      <Link to={`/documents/signing/templates/${encodeURIComponent(t.id)}`} className="text-[var(--ink-body)] underline-offset-4 hover:underline">
                        Edit boxes
                      </Link>
                      {confirmDelete === t.id ? (
                        <span className="text-[#B42318]">
                          Delete it?{" "}
                          <button type="button" className="font-medium underline" onClick={() => { deleteSigningTemplate(t.id); setConfirmDelete(null); toast.success(`${t.name} removed`, { description: "Requests already made from it are kept." }); }}>
                            Yes
                          </button>{" "}
                          <button type="button" className="underline" onClick={() => setConfirmDelete(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="text-[var(--ink-muted)] underline-offset-4 hover:underline" onClick={() => setConfirmDelete(t.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="m-0 rounded-[12px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-3 text-[12px] leading-[1.55] text-muted-foreground">{SIGNING_LIMITS}</p>
        </aside>
      </div>

      <Dialog open={picking} onOpenChange={(o) => !o && setPicking(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>Pick a PDF from Documents to place boxes on. Only files with their pages in this browser can be set up.</DialogDescription>
          </DialogHeader>
          {pdfs.length === 0 ? (
            <p className="m-0 text-[13px] text-muted-foreground">There are no PDFs in Documents yet.</p>
          ) : (
            <ul className="m-0 max-h-72 list-none divide-y divide-[var(--hairline-soft)] overflow-y-auto rounded-[10px] border border-[var(--hairline)] p-0">
              {pdfs.map((d) => {
                const has = !!recallFile(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={!has}
                      onClick={() => {
                        setPicking(false);
                        navigate(`/documents/signing/templates/new?doc=${encodeURIComponent(d.id)}`);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-[var(--wash)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="truncate">{displayName(d.name)}</span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{has ? d.folder : "no copy here"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="m-0 text-[12px] text-muted-foreground">
            Not listed? <Link to="/documents" className="text-primary underline-offset-4 hover:underline">Upload it in Documents</Link> and choose "Set up for signing".
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
