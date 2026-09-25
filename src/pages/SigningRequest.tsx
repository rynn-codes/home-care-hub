import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { PagesWithFields, useDocumentFile } from "@/components/signing/PagesWithFields";
import { StatusPill } from "@/components/signing/StatusPill";
import { SignaturePad } from "@/components/portal/SignaturePad";
import { OFFICE_NUMBER } from "@/components/portal/OfficeNumber";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { displayName } from "@/domain/documents/library";
import {
  deliveryEmail, deliveryLine, deliveryMessage, SIGNING_LIMITS, whyNotCountersign, whyNotEdit, whyNotSend, whyNotSendCopy, whyNotVoid, type EnvelopeEventKind, type FieldValue,
} from "@/domain/signing/envelopes";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const EVENT_LABELS: Record<EnvelopeEventKind, string> = {
  created: "Started",
  edited: "Edited",
  sent: "Sent",
  resent: "Sent again",
  viewed: "Opened",
  signed: "Signed",
  declined: "Declined",
  countersigned: "Countersigned",
  completed: "Completed",
  voided: "Voided",
  corrected: "Corrected",
  copy_sent: "Copy sent",
};

/**
 * One signing request, start to finish.
 *
 * Unsigned: edit, send again, or void. Signed and waiting on the agency:
 * countersign here. Complete: send the family a copy. Anything at all:
 * correct it, which voids this one with a reason and opens a fresh draft
 * that remembers where it came from. Every step is on the trail.
 */
export default function SigningRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { envelopes, editEnvelope, sendEnvelope, countersignEnvelope, voidEnvelope, correctEnvelope, recordEnvelopeCopy, currentUser } = useDemo();
  const agency = useAgencySettings();
  const env = envelopes.find((e) => e.id === id) ?? null;
  const file = useDocumentFile(env?.documentId ?? null);

  const [editing, setEditing] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, FieldValue>>({});
  const [draftText, setDraftText] = useState<string>("");
  const [draftEmail, setDraftEmail] = useState<string>("");
  const [draftMessage, setDraftMessage] = useState("");
  const [voiding, setVoiding] = useState<null | "void" | "correct">(null);
  const [reason, setReason] = useState("");
  const [typedName, setTypedName] = useState(currentUser.name);
  const [drawn, setDrawn] = useState(false);
  const [copyTo, setCopyTo] = useState<string | null>(null);

  const editable = env ? whyNotEdit(env) === null : false;
  const replacement = useMemo(() => (env?.correctedToId ? envelopes.find((e) => e.id === env.correctedToId) ?? null : null), [env, envelopes]);

  if (!env) {
    return (
      <>
        <PageHeader parents={[{ label: "Documents", to: "/documents" }, { label: "Signing", to: "/documents/signing" }]} title="Signing request" />
        <p className="text-[13.5px] text-muted-foreground">That request is not on this device.</p>
      </>
    );
  }

  const startEditing = () => {
    setDraftValues({ ...env.values });
    setDraftText(env.textTo ?? "");
    setDraftEmail(env.emailTo ?? "");
    setDraftMessage(env.message);
    setEditing(true);
  };
  const saveEdits = () => {
    editEnvelope(env.id, { values: draftValues, textTo: draftText.trim() || null, emailTo: draftEmail.trim() || null, message: draftMessage });
    setEditing(false);
    toast.success("Saved");
  };
  const send = () => {
    const why = whyNotSend(env);
    if (why) return toast.error(why);
    sendEnvelope(env.id);
    toast.success(env.status === "draft" ? `Sent to ${env.signerName}` : `Sent again to ${env.signerName}`, { description: "It shows in the family portal. No text or email actually goes out until Spruce is wired." });
  };
  const doVoid = () => {
    const why = whyNotVoid(env, reason);
    if (why) return toast.error(why);
    if (voiding === "correct") {
      const newId = correctEnvelope(env.id, reason);
      toast.success("Voided and reopened as a fresh draft", { description: "The old one keeps its reason and points to the new one." });
      navigate(`/documents/signing/${newId}`);
    } else {
      voidEnvelope(env.id, reason);
      toast.success("Voided", { description: "The reason stays on the record." });
    }
    setVoiding(null);
    setReason("");
  };
  const countersign = () => {
    const why = whyNotCountersign(env, { typedName, markDrawn: drawn });
    if (why) return toast.error(why);
    countersignEnvelope(env.id, { typedName, markDrawn: drawn });
    toast.success("Countersigned — complete", { description: "Send the family a copy from the panel on the right." });
  };
  const sendCopy = () => {
    const to = (copyTo ?? env.emailTo ?? env.textTo ?? "").trim();
    const why = whyNotSendCopy(env, to);
    if (why) return toast.error(why);
    recordEnvelopeCopy(env.id, to);
    setCopyTo(null);
    toast.success(`Copy recorded as sent to ${to}`, { description: "Nothing actually goes out until Spruce and file storage are connected; the record shows the copy was sent." });
  };

  const values = editing ? draftValues : env.values;
  const canFill = editing ? (f: { fill: string }) => f.fill === "joy" || f.fill === "office" : undefined;

  return (
    <>
      <PageHeader
        parents={[{ label: "Documents", to: "/documents" }, { label: "Signing", to: "/documents/signing" }]}
        title={displayName(env.documentName)}
        description={`${env.clientName} · signer ${env.signerName}${env.signerRole === "responsible_party" ? " (responsible party)" : ""}`}
        actions={
          <>
            <StatusPill status={env.status} className="px-2.5 py-1 text-[12px]" />
            {editable && !editing && (
              <Button variant="outline" onClick={startEditing}>Edit</Button>
            )}
            {editing && (
              <>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button onClick={saveEdits}>Save changes</Button>
              </>
            )}
            {editable && !editing && <Button onClick={send}>{env.status === "draft" ? "Send" : "Send again"}</Button>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {editing && <p className="m-0 mb-2 text-[12px] text-muted-foreground">Grey and blue boxes can be typed into. Amber boxes are the signer's.</p>}
          <PagesWithFields file={file} pages={env.pages} fields={env.fields} mode={editing ? "fill" : "view"} values={values} canFill={canFill} onValue={(fid, v) => setDraftValues((p) => ({ ...p, [fid]: v }))} />
        </div>

        <aside className="space-y-4">
          {env.status === "voided" && (
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-4 text-[13px]">
              <p className="m-0 font-medium">Voided by {env.voidedBy} · {when(env.voidedAt ?? env.createdAt)}</p>
              <p className="m-0 mt-1 text-muted-foreground">{env.voidReason}</p>
              {replacement && (
                <p className="m-0 mt-2">
                  Replaced by <Link to={`/documents/signing/${replacement.id}`} className="text-primary underline-offset-4 hover:underline">the corrected copy</Link>.
                </p>
              )}
            </section>
          )}
          {env.correctedFromId && (
            <p className="m-0 text-[12.5px] text-muted-foreground">
              Corrected from <Link to={`/documents/signing/${env.correctedFromId}`} className="text-primary underline-offset-4 hover:underline">an earlier request</Link>.
            </p>
          )}

          {env.status === "signed" && env.needsCountersign && (
            <section className="space-y-3 rounded-[14px] border border-[#6941C6]/40 bg-[#F4F3FF]/60 p-4">
              <h2 className="m-0 text-[13px] font-semibold">Sign for the agency</h2>
              <p className="m-0 text-[12.5px] text-muted-foreground">{env.signedName} signed {when(env.signedAt ?? env.createdAt)}. Your signature completes it.</p>
              <div className="space-y-1">
                <Label htmlFor="cs-name" className="text-[12px] font-medium">Type your full name</Label>
                <Input id="cs-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} />
              </div>
              <SignaturePad onChange={setDrawn} />
              <p className="m-0 text-[11.5px] text-muted-foreground">Joy records your typed name and the time. The drawn mark is not stored.</p>
              <Button className="w-full" disabled={!!whyNotCountersign(env, { typedName, markDrawn: drawn })} title={whyNotCountersign(env, { typedName, markDrawn: drawn }) ?? undefined} onClick={countersign}>
                Countersign
              </Button>
            </section>
          )}

          {env.status === "completed" && (
            <section className="space-y-2 rounded-[14px] border border-[#027A48]/30 bg-[#ECFDF3]/60 p-4">
              <h2 className="m-0 text-[13px] font-semibold">Complete</h2>
              <p className="m-0 text-[12.5px] text-muted-foreground">
                {env.copySentAt ? `A copy was sent to ${env.copySentTo} · ${when(env.copySentAt)}.` : "Send the family their copy."}
              </p>
              {copyTo === null ? (
                <Button variant="outline" className="w-full" onClick={() => setCopyTo(env.emailTo ?? env.textTo ?? "")}>
                  {env.copySentAt ? "Send another copy" : "Send a copy"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input aria-label="Send the copy to" value={copyTo} onChange={(e) => setCopyTo(e.target.value)} placeholder="Email address or mobile number" />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={sendCopy}>Send</Button>
                    <Button variant="ghost" onClick={() => setCopyTo(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
            <h2 className="m-0 text-[13px] font-semibold">Delivery</h2>
            {editing ? (
              <div className="space-y-2">
                <Input aria-label="Mobile number" value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Text — mobile number, or leave blank" />
                <Input aria-label="Email address" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} placeholder="Email — address, or leave blank" />
                <Input aria-label="Note to the signer" value={draftMessage} onChange={(e) => setDraftMessage(e.target.value)} placeholder="A note to them (optional)" />
              </div>
            ) : (
              <>
                <p className="m-0 text-[13px]">{deliveryLine(env)}</p>
                {env.message && <p className="m-0 text-[12.5px] text-muted-foreground">“{env.message}”</p>}
                <details className="text-[12px] text-muted-foreground">
                  <summary className="cursor-pointer font-medium">What Joy would send</summary>
                  {env.textTo && <p className="m-0 mt-2"><span className="font-medium">Text:</span> {deliveryMessage(env, agency.profile.name)}</p>}
                  {env.emailTo && <p className="m-0 mt-2 whitespace-pre-wrap"><span className="font-medium">Email:</span> {deliveryEmail(env, agency.profile.name, OFFICE_NUMBER).subject}{"\n"}{deliveryEmail(env, agency.profile.name, OFFICE_NUMBER).body}</p>}
                  <p className="m-0 mt-2">{SIGNING_LIMITS}</p>
                </details>
              </>
            )}
          </section>

          <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
            <h2 className="m-0 text-[13px] font-semibold">History</h2>
            <ol className="m-0 mt-2 list-none space-y-1.5 p-0 text-[12.5px]">
              {[...env.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-[92px] shrink-0 text-muted-foreground">{when(h.at)}</span>
                  <span>
                    <span className="font-medium">{EVENT_LABELS[h.kind]}</span> · {h.by}
                    {h.note && <span className="block text-muted-foreground">{h.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {env.status !== "voided" && (
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[13px] font-semibold">Something wrong?</h2>
              {voiding === null ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setVoiding("correct")}>Correct and resend</Button>
                  <Button variant="outline" size="sm" className="text-[#B42318]" onClick={() => setVoiding("void")}>Void</Button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="m-0 text-[12.5px] text-muted-foreground">{voiding === "correct" ? "This one is voided and a fresh draft opens with the same boxes and values, minus any signatures." : "This one is voided. Nobody can sign it after this."}</p>
                  <Input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why — stays on the record" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={doVoid} disabled={!!whyNotVoid(env, reason)} title={whyNotVoid(env, reason) ?? undefined}>
                      {voiding === "correct" ? "Void and reopen" : "Void it"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setVoiding(null); setReason(""); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </section>
          )}
          {env.status === "voided" && !replacement && (
            <Button variant="outline" className="w-full" onClick={() => setVoiding("correct")}>Reopen as a corrected copy</Button>
          )}
          {env.status === "voided" && voiding === "correct" && (
            <div className="space-y-2">
              <Input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is being corrected" />
              <Button
                size="sm"
                disabled={reason.trim().length < 3}
                onClick={() => {
                  const newId = correctEnvelope(env.id, reason);
                  navigate(`/documents/signing/${newId}`);
                }}
              >
                Open the corrected draft
              </Button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
