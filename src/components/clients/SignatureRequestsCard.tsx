import { PenLine } from "lucide-react";
import { SIGNATURE_STATUS_LABELS, signatureLine, type SignatureRequest } from "@/domain/documents/signatureRequests";
import { displayName } from "@/domain/documents/library";
import { cn } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const PILL: Record<SignatureRequest["status"], string> = {
  pending: "bg-[#FFFAEB] text-[#B54708]",
  signed: "bg-[#ECFDF3] text-[#027A48]",
  declined: "bg-[#FEF3F2] text-[#B42318]",
};

/**
 * Signatures asked of this client, from the Documents library.
 *
 * Requests are raised from a file's menu in Documents, because the file is
 * the thing being signed; they land here because the signature is a fact
 * about the client.
 */
export function SignatureRequestsCard({ requests }: { requests: readonly SignatureRequest[] }) {
  const pending = requests.filter((r) => r.status === "pending").length;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Signatures
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {requests.length === 0 ? "Nothing has been sent to sign. Ask from a file's menu in Documents." : pending === 0 ? "Nothing waiting." : `${pending} waiting on the family.`}
      </p>
      {requests.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {requests.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm">{displayName(r.documentName)}</span>
                <span className="block text-xs text-muted-foreground">{signatureLine(r, when)}</span>
                {r.status === "signed" && <span className="block text-xs text-muted-foreground">Typed name and a drawn mark. The mark is not kept in this browser — a signing provider would hold it with the file.</span>}
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-[2px] text-[11px] font-medium", PILL[r.status])}>{SIGNATURE_STATUS_LABELS[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
