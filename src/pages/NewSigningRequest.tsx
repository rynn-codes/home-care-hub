import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { PagesWithFields, useDocumentFile } from "@/components/signing/PagesWithFields";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { buildClientRoster } from "@/lib/clientRoster";
import { displayName } from "@/domain/documents/library";
import { isSignerField, type TemplateField } from "@/domain/signing/fields";
import {
  createEnvelope as buildEnvelope, defaultDelivery, deliveryEmail, deliveryMessage, prefillValues, SIGNING_LIMITS, whyNotSend, type FieldValue, type PrefillSource, type SignerRole,
} from "@/domain/signing/envelopes";
import { OFFICE_NUMBER } from "@/components/portal/OfficeNumber";
import { cn } from "@/lib/utils";

/**
 * Send a form to sign.
 *
 * Pick the template and the client; Joy fills what the record knows and
 * leaves the rest blank. The office checks the page, ticks what the signer
 * must complete, says how to reach them — text first, email as well — and
 * sends. Nothing is guessed: a blank on the record is a blank on the form.
 */
export default function NewSigningRequest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signingTemplates, people, admissions, consentSessions, mrNumbers, createEnvelope, currentUser } = useDemo();
  const agency = useAgencySettings();

  const clients = useMemo(() => buildClientRoster({ people, admissions, consentSessions }).filter((c) => (c.status ?? "active") === "active"), [people, admissions, consentSessions]);

  const [templateId, setTemplateId] = useState(params.get("template") ?? signingTemplates[0]?.id ?? "");
  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [signerRole, setSignerRole] = useState<SignerRole>("responsible_party");
  const [textOn, setTextOn] = useState(true);
  const [textTo, setTextTo] = useState("");
  const [emailOn, setEmailOn] = useState(true);
  const [emailTo, setEmailTo] = useState("");
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  const template = signingTemplates.find((t) => t.id === templateId) ?? null;
  const client = clients.find((c) => c.personId === clientId) ?? null;
  const file = useDocumentFile(template?.documentId ?? null);
  const clientName = client ? `${client.firstName} ${client.lastName}` : "";
  const hasParty = !!client?.responsiblePartyName;

  const prefill: PrefillSource | null = useMemo(
    () => (client ? { name: clientName, dateOfBirth: client.dateOfBirth, address: client.address, phone: client.phone, mrNumber: mrNumbers[client.personId] ?? client.mrNumber, admissionDate: client.admissionDate } : null),
    [client, clientName, mrNumbers],
  );

  // A new template or client resets the page to Joy's prefill.
  useEffect(() => {
    if (!template) return;
    setFields(template.fields.map((f) => ({ ...f })));
    setValues(prefill ? prefillValues(template.fields, prefill, new Date().toISOString().slice(0, 10)) : {});
  }, [template, prefill]);

  useEffect(() => {
    if (!client) return;
    setSignerRole(hasParty ? "responsible_party" : "client");
    const d = defaultDelivery(client);
    setTextTo(d.textTo ?? "");
    setTextOn(!!d.textTo);
    setEmailTo(d.emailTo ?? "");
    setEmailOn(!!d.emailTo);
  }, [client, hasParty]);

  const signerName = signerRole === "responsible_party" && client?.responsiblePartyName ? client.responsiblePartyName : clientName;
  const preview = useMemo(() => {
    if (!template || !client || !prefill) return null;
    const env = buildEnvelope({ id: "preview", template, clientPersonId: client.personId, clientName, signerRole, signerName, prefill, by: currentUser.name, at: new Date().toISOString() });
    return { ...env, fields, values, message, textTo: textOn ? textTo : null, emailTo: emailOn ? emailTo : null };
  }, [template, client, prefill, clientName, signerRole, signerName, currentUser.name, fields, values, message, textOn, textTo, emailOn, emailTo]);

  const problem = !template ? "Choose a template." : !client ? "Choose a client." : preview ? whyNotSend(preview) : "Choose a client.";
  const signerFields = fields.filter(isSignerField);

  const submit = (send: boolean) => {
    if (!template || !client || !prefill || !preview) return;
    if (send && problem) return;
    const id = createEnvelope({
      templateId: template.id,
      clientPersonId: client.personId,
      clientName,
      signerRole,
      signerName,
      prefill,
      delivery: { textTo: textOn ? textTo.trim() || null : null, emailTo: emailOn ? emailTo.trim() || null : null },
      message,
      fields,
      values,
      send,
    });
    if (send) {
      toast.success(`Sent to ${signerName}`, { description: "It shows in the family portal. No text or email actually goes out until Spruce is wired." });
    } else {
      toast.success("Draft saved");
    }
    navigate(`/documents/signing/${id}`);
  };

  return (
    <>
      <PageHeader
        parents={[{ label: "Documents", to: "/documents" }, { label: "Signing", to: "/documents/signing" }]}
        title="Send to sign"
        description="Pick the form and the client. Joy fills what the record knows; blanks stay blank."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/documents/signing")}>Cancel</Button>
            <Button variant="outline" disabled={!template || !client} onClick={() => submit(false)}>Save as draft</Button>
            <Button disabled={!!problem} title={problem ?? undefined} onClick={() => submit(true)}>
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Send
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="space-y-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
            <div className="space-y-1">
              <Label htmlFor="req-template" className="text-[12px] font-medium">Form</Label>
              <select id="req-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a template</option>
                {signingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-client" className="text-[12px] font-medium">Client</Label>
              <select id="req-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.personId} value={c.personId}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            {client && (
              <div className="space-y-1">
                <p className="m-0 text-[12px] font-medium">Who signs</p>
                <div className="flex gap-1.5">
                  {(
                    [
                      ["responsible_party", hasParty ? `${client.responsiblePartyName}${client.responsiblePartyLine ? ` · ${client.responsiblePartyLine}` : ""}` : "No responsible party on file"],
                      ["client", `${clientName} · themselves`],
                    ] as const
                  ).map(([role, label]) => (
                    <button
                      key={role}
                      type="button"
                      disabled={role === "responsible_party" && !hasParty}
                      onClick={() => setSignerRole(role)}
                      aria-pressed={signerRole === role}
                      className={cn(
                        "min-h-10 flex-1 rounded-[10px] border px-3 py-2 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        signerRole === role ? "border-[#1407A2]/30 bg-[#EFEDFB] font-medium text-primary" : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {client && (
            <section className="space-y-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[13px] font-semibold">How to reach {signerName.split(" ")[0]}</h2>
              <p className="m-0 text-[12px] text-muted-foreground">Text first. Email as well for anyone who does not keep a phone close.</p>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={textOn} onChange={(e) => setTextOn(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Text
              </label>
              {textOn && <Input aria-label="Mobile number" value={textTo} onChange={(e) => setTextTo(e.target.value)} placeholder="(713) 555-0100" />}
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Email
              </label>
              {emailOn && <Input aria-label="Email address" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="name@example.com" />}
              {!textOn && !emailOn && <p className="m-0 text-[12px] text-[#B54708]">Portal only — they will see it when they next open it.</p>}
              <div className="space-y-1">
                <Label htmlFor="req-message" className="text-[12px] font-medium">
                  A note to them <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="req-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please sign before care starts on Monday." />
              </div>
              {preview && (
                <details className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2 text-[12px] text-muted-foreground">
                  <summary className="cursor-pointer font-medium">What Joy would send</summary>
                  {textOn && <p className="m-0 mt-2 whitespace-pre-wrap"><span className="font-medium">Text:</span> {deliveryMessage(preview, agency.profile.name)}</p>}
                  {emailOn && <p className="m-0 mt-2 whitespace-pre-wrap"><span className="font-medium">Email:</span> {deliveryEmail(preview, agency.profile.name, OFFICE_NUMBER).subject}</p>}
                  <p className="m-0 mt-2">{SIGNING_LIMITS}</p>
                </details>
              )}
            </section>
          )}

          {template && signerFields.length > 0 && (
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-4">
              <h2 className="m-0 text-[13px] font-semibold">What {signerName ? signerName.split(" ")[0] : "the signer"} completes</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">Tick what must be done before they can finish.</p>
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                {signerFields.map((f) => (
                  <li key={f.id}>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={f.required} onChange={(e) => setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)))} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                      {f.label}
                      {f.page > 1 && <span className="text-muted-foreground">· p.{f.page}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div>
          {!template ? (
            <p className="rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-4 py-8 text-center text-[13px] text-muted-foreground">Choose a form to see the page.</p>
          ) : (
            <>
              <p className="m-0 mb-2 text-[12px] text-muted-foreground">
                {client ? "Check what Joy filled in. Anything with a grey or blue box can be typed into before sending; amber boxes are for the signer." : "Choose a client and Joy fills what the record knows."}
              </p>
              <PagesWithFields
                file={file}
                pages={template.pages}
                fields={fields}
                mode="fill"
                values={values}
                canFill={(f) => f.fill === "joy" || f.fill === "office"}
                onValue={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
