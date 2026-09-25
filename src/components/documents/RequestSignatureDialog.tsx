import { useEffect, useMemo, useState } from "react";
import { PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { displayName, type LibraryDocument } from "@/domain/documents/library";
import { SIGNATURE_LIMITS, whyNotRequestSignature, type SignerRole } from "@/domain/documents/signatureRequests";
import type { ClientInput } from "@/domain/clients/roster";
import { cn } from "@/lib/utils";

/**
 * Ask a client, or the person who signs for them, to sign a file.
 *
 * The signer is worked out from the client's record: a responsible party
 * signs when there is one, otherwise the client. A reason is optional — the
 * file is named on the request, so it often explains itself — and when given
 * it goes to the family word for word.
 */
export function RequestSignatureDialog({
  document,
  clients,
  onOpenChange,
  onRequest,
}: {
  document: LibraryDocument | null;
  clients: readonly ClientInput[];
  onOpenChange: (open: boolean) => void;
  onRequest: (input: { documentId: string; documentName: string; clientPersonId: string; clientName: string; signerRole: SignerRole; signerName: string; reason: string }) => void;
}) {
  const [clientId, setClientId] = useState<string>("");
  const [signerRole, setSignerRole] = useState<SignerRole>("responsible_party");
  const [reason, setReason] = useState("");

  const active = useMemo(() => clients.filter((c) => (c.status ?? "active") === "active"), [clients]);
  const client = active.find((c) => c.personId === clientId) ?? null;
  const clientName = client ? `${client.firstName} ${client.lastName}` : "";
  const hasParty = !!client?.responsiblePartyName;

  useEffect(() => {
    if (document) {
      setClientId("");
      setSignerRole("responsible_party");
      setReason("");
    }
  }, [document]);

  useEffect(() => {
    if (client && !hasParty) setSignerRole("client");
  }, [client, hasParty]);

  const problem = whyNotRequestSignature({ documentId: document?.id ?? null, clientPersonId: clientId || null, reason });
  const signerName = signerRole === "responsible_party" && client?.responsiblePartyName ? client.responsiblePartyName : clientName;

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
            Request a signature
          </DialogTitle>
          <DialogDescription>{document ? `${displayName(document.name)} — who needs to sign it.` : ""}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1">
            <Label htmlFor="sig-client" className="text-[12px] font-medium">
              Whose signature
            </Label>
            <select id="sig-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose a client</option>
              {active.map((c) => (
                <option key={c.personId} value={c.personId}>
                  {c.firstName} {c.lastName}
                </option>
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

          <div className="space-y-1">
            <Label htmlFor="sig-reason" className="text-[12px] font-medium">
              Why Joy needs it <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="sig-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Needed before care starts on Monday." />
            <p className="m-0 text-[12px] text-muted-foreground">If you give one, the family sees it word for word.</p>
          </div>

          <p className="m-0 rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5 text-[12px] leading-[1.5] text-muted-foreground">{SIGNATURE_LIMITS}</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!!problem}
            title={problem ?? undefined}
            onClick={() => {
              if (!document || !client || problem) return;
              onRequest({ documentId: document.id, documentName: document.name, clientPersonId: client.personId, clientName, signerRole, signerName, reason });
              toast.success(`Signature requested from ${signerName}`, { description: `It is on ${clientName}'s record and in the family portal.` });
              onOpenChange(false);
            }}
          >
            Request signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
