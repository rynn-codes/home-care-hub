import { useRef, useState } from "react";
import { Camera, Check, Clock, TriangleAlert } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { OfficeNumber } from "@/components/portal/OfficeNumber";
import {
  DOCUMENT_REQUEST_LABELS,
  type DocumentRequestState,
  type RequestedDocument,
} from "@/domain/portal/familyPortal";
import { ACCEPTED_UPLOAD_TYPES, checkUpload } from "@/domain/portal/uploads";
import { seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { cn } from "@/lib/utils";

/**
 * Documents the office has asked this family for — §21 and §22.
 *
 * §21 is explicit that this is not a new upload system: "Use the
 * already-established Joy secure document architecture rather than building a
 * second upload system." So the file checks here are the same `checkUpload`
 * the caregiver's screen uses, and the bytes would go through the same
 * `DocumentStorageService` port — which is still not connected, and says so.
 *
 * The requests themselves come from the office. A family never picks a
 * document type out of a list: Joy asks for the medication list, and the
 * medication list is what appears here.
 */

const STATE_ICON: Record<DocumentRequestState, { icon: typeof Check; tone: string }> = {
  needed: { icon: TriangleAlert, tone: "text-[hsl(var(--warning))]" },
  received: { icon: Check, tone: "text-[hsl(var(--success))]" },
  under_review: { icon: Clock, tone: "text-muted-foreground" },
  accepted: { icon: Check, tone: "text-[hsl(var(--success))]" },
};

function Row({
  doc,
  picked,
  onPick,
}: {
  doc: RequestedDocument;
  picked: string | null;
  onPick: () => void;
}) {
  const { icon: Icon, tone } = STATE_ICON[doc.state];

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden="true" />
            <span className="text-base font-medium">{doc.label}</span>
          </span>
          {doc.reason && (
            <span className="mt-1 block text-sm text-muted-foreground">{doc.reason}</span>
          )}
          {picked && (
            <span className="mt-2 block text-sm text-destructive">
              {picked} — chosen, but not sent. Uploading is not connected yet.
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {DOCUMENT_REQUEST_LABELS[doc.state]}
        </span>
      </div>

      {doc.state === "needed" && (
        <button
          type="button"
          onClick={onPick}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface-muted text-base font-medium transition-colors hover:bg-muted"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Take a photo or choose a file
        </button>
      )}
    </li>
  );
}

export default function FamilyDocuments() {
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const docs = seedRequestedDocuments;
  const outstanding = docs.filter((d) => d.state === "needed").length;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !target) return;

    const check = checkUpload(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setPicked((p) => ({ ...p, [target]: file.name }));
  }

  return (
    <PortalFrame>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">Documents</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {outstanding === 0
          ? "We have everything we need — thank you."
          : outstanding === 1
            ? "One thing we still need. A photo of each page is fine."
            : `${outstanding} things we still need. A photo of each page is fine.`}
      </p>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES.join(",")}
        capture="environment"
        onChange={onFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
        {docs.map((doc) => (
          <Row
            key={doc.id}
            doc={doc}
            picked={picked[doc.id] ?? null}
            onPick={() => {
              setTarget(doc.id);
              input.current?.click();
            }}
          />
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prototype
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          File storage is not connected, so nothing here is actually sent — the same{" "}
          <code>DocumentStorageService</code> the caregiver side uses. §21: one document system,
          not two.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Would rather bring them in? Call{" "}
        <OfficeNumber />
        .
      </p>
    </PortalFrame>
  );
}
