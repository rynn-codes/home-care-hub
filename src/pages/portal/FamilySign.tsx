import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { OfficeNumber } from "@/components/portal/OfficeNumber";
import { SignaturePad } from "@/components/portal/SignaturePad";
import { PagesWithFields, useDocumentFile } from "@/components/signing/PagesWithFields";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { displayName } from "@/domain/documents/library";
import { isMarkField, isSignerField } from "@/domain/signing/fields";
import { envelopesForFamily, signerFields, whyNotSign, type FieldValue } from "@/domain/signing/envelopes";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Read and sign a form, on a phone.
 *
 * The page is drawn with the office's boxes on it. "Start" walks the signer
 * from box to box; they type where asked, tick where asked, and sign once
 * at the bottom — the signature goes into every signature box. Joy records
 * the typed name, the time and what was put in each box. The drawn mark is
 * shown here and not kept anywhere.
 */
export default function FamilySign() {
  const { id } = useParams();
  const { grant } = usePortalSession();
  const { envelopes, markEnvelopeViewed, signEnvelope, declineEnvelope } = useDemo();
  const agency = useAgencySettings();

  const env = useMemo(() => (grant ? envelopesForFamily(envelopes, grant).find((e) => e.id === id) ?? null : null), [envelopes, grant, id]);
  const file = useDocumentFile(env?.documentId ?? null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [typedName, setTypedName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (env?.status === "sent") markEnvelopeViewed(env.id);
    // Once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env?.id]);
  useEffect(() => {
    if (env) {
      setValues({ ...env.values });
      setTypedName(env.signerName);
    }
  }, [env?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!grant) return null;
  if (!env) {
    return (
      <PortalFrame>
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">Nothing to sign here</h1>
        <p className="mt-3 text-base text-muted-foreground">
          This link is not for a document sent to you. <Link to="/portal/care/documents" className="text-primary underline-offset-4 hover:underline">Back to documents</Link>.
        </p>
      </PortalFrame>
    );
  }

  const pending = env.status === "sent" || env.status === "viewed";
  const toDo = signerFields(env).filter((f) => !isMarkField(f) && f.kind !== "date_signed");
  const stops = [...toDo.map((f) => f.id), "sign-here"];
  const currentId = step === null ? null : stops[step] ?? null;
  const problem = whyNotSign(env, { typedName, markDrawn: drawn, values });

  const go = (i: number) => {
    setStep(i);
    const target = stops[i] === "sign-here" ? document.getElementById("sign-here") : document.getElementById(`field-${stops[i]}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (stops[i] !== "sign-here") {
      const input = document.querySelector<HTMLInputElement>(`#field-${stops[i]} input`);
      input?.focus();
    }
  };

  return (
    <PortalFrame>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From {agency.profile.name}</p>
      <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight">{displayName(env.documentName)}</h1>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">
        For {env.clientName}. {env.message ? `“${env.message}” ` : ""}
        {pending ? `Read it, fill in what is marked, and sign at the bottom. About a minute.` : ""}
      </p>

      {env.status === "declined" && (
        <p className="mt-5 rounded-2xl border border-border bg-surface p-4 text-base">You declined this{env.declinedReason ? ` — ${env.declinedReason}` : ""}. The office has been told.</p>
      )}
      {(env.status === "signed" || env.status === "completed") && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
          <div className="text-base">
            <p className="m-0 font-medium">Signed by {env.signedName} · {when(env.signedAt ?? env.createdAt)}</p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {env.status === "completed" ? (env.copySentAt ? `A copy was sent to ${env.copySentTo}.` : "The office will send you a copy.") : "The agency signs next, then the office sends you a copy."}
            </p>
          </div>
        </div>
      )}

      {pending && !declining && (
        <div className="mt-5 flex gap-2">
          <Button className="h-12 flex-1 rounded-2xl text-base" onClick={() => go(0)}>
            {step === null ? "Start" : "Next"}
          </Button>
          <Button variant="ghost" className="h-12 rounded-2xl text-base" onClick={() => setDeclining(true)}>
            Not now
          </Button>
        </div>
      )}
      {declining && (
        <div className="mt-5 space-y-2">
          <Input value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Why not — optional, the office will see it" className="h-12 rounded-2xl text-base" />
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 rounded-2xl text-base" onClick={() => declineEnvelope(env.id, declineReason)}>
              Decline to sign
            </Button>
            <Button variant="ghost" className="h-12 rounded-2xl text-base" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <PagesWithFields
          file={file}
          pages={env.pages}
          fields={env.fields}
          mode={pending ? "fill" : "view"}
          values={pending ? values : env.values}
          canFill={(f) => pending && isSignerField(f) && !isMarkField(f) && f.kind !== "date_signed"}
          onValue={(fid, v) => setValues((p) => ({ ...p, [fid]: v }))}
          currentId={currentId}
        />
      </div>

      {pending && (
        <div id="sign-here" className="mt-6 space-y-4 rounded-2xl border border-border bg-surface-muted p-4">
          {toDo.length > 0 && (
            <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {toDo.map((f, i) => (
                <li key={f.id}>
                  <button type="button" onClick={() => go(i)} className="underline-offset-2 hover:underline">
                    {f.label}
                    {f.required ? "" : " (optional)"}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="space-y-1.5">
            <label htmlFor="sign-name" className="block text-sm font-medium">Type your full name</label>
            <Input id="sign-name" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="name" className="h-12 rounded-2xl bg-surface text-base" />
          </div>
          <div className="space-y-1.5">
            <p className="m-0 text-sm font-medium">Draw your signature</p>
            <SignaturePad onChange={setDrawn} />
          </div>
          <p className="m-0 text-xs leading-[1.5] text-muted-foreground">
            By signing you agree to {displayName(env.documentName)}. Your signature goes in every signature box on the form. Joy records your typed name, the time and what you filled in. No signing provider is connected, so nothing is stamped onto a stored file and the drawing is not kept.
          </p>
          <Button className="h-12 w-full rounded-2xl text-base" disabled={!!problem} title={problem ?? undefined} onClick={() => signEnvelope(env.id, { typedName, markDrawn: drawn, values })}>
            Finish and sign
          </Button>
          {problem && <p className="m-0 text-center text-xs text-muted-foreground">{problem}</p>}
        </div>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        Would rather sign on paper? Call <OfficeNumber />.
      </p>
      <p className="mt-2 text-sm">
        <Link to="/portal/care/documents" className="text-primary underline-offset-4 hover:underline">Back to documents</Link>
      </p>
    </PortalFrame>
  );
}
