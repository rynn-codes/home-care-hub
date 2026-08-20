import { useMemo, useRef, useState } from "react";
import { Camera, Check, Clock, TriangleAlert, Upload } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { usePortalSession } from "@/context/PortalSessionProvider";
import {
  ACCEPTED_UPLOAD_TYPES,
  UPLOAD_STATE_LABELS,
  checkUpload,
  uploadList,
  uploadSummary,
  type UploadItem,
  type UploadState,
} from "@/domain/portal/uploads";
import { seedApplicants } from "@/lib/hiringSeed";
import { cn } from "@/lib/utils";

/**
 * Sending Joy a document from a phone — §29's step 5.
 *
 * This is the screen Karynn asked about directly: where does a caregiver
 * actually upload their information? The answer is here, and the thing worth
 * noticing is what it does not contain — no folder picker, no document-type
 * dropdown, no "choose a category". Joy already knows which documents it wants,
 * because the list is computed from its own credential requirements. The
 * candidate taps the row for the thing they were asked for and sends a photo.
 *
 * NOTHING IS ACTUALLY UPLOADED
 *
 * `DocumentStorageService` is not connected, so the button records the file and
 * says plainly that it has not been sent. That is the same choice the SMS
 * adapter makes in reporting `delivered: false`. A screen that showed a
 * satisfying tick here would be teaching Karynn to trust a pipeline that does
 * not exist, and the person it would eventually fail is a caregiver who thinks
 * her TB test is on file.
 */

const STATE_ICON: Record<UploadState, { icon: typeof Check; tone: string }> = {
  needed: { icon: TriangleAlert, tone: "text-[hsl(var(--warning))]" },
  resend: { icon: TriangleAlert, tone: "text-destructive" },
  in_review: { icon: Clock, tone: "text-muted-foreground" },
  accepted: { icon: Check, tone: "text-[hsl(var(--success))]" },
  on_file: { icon: Check, tone: "text-[hsl(var(--success))]" },
};

function Row({
  item,
  onPick,
  picked,
}: {
  item: UploadItem;
  onPick: () => void;
  picked: string | null;
}) {
  const { icon: Icon, tone } = STATE_ICON[item.state];
  const actionable = item.state === "needed" || item.state === "resend";

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden="true" />
            <span className="text-base font-medium">{item.displayName}</span>
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{item.hint}</span>
          {picked && (
            <span className="mt-2 block text-sm text-destructive">
              {picked} — chosen, but not sent. Uploading is not connected yet.
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {UPLOAD_STATE_LABELS[item.state]}
        </span>
      </div>

      {actionable && (
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

export default function PortalDocuments() {
  const { grant } = usePortalSession();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(
    () =>
      uploadList({
        applicant: seedApplicants.find((a) => a.track === "hiring") ?? seedApplicants[0],
      }),
    [],
  );

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
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        Your documents
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {uploadSummary(items)} A clear photo from your phone is fine.
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
        {items.map((item) => (
          <Row
            key={item.credentialType}
            item={item}
            picked={picked[item.credentialType] ?? null}
            onPick={() => {
              setTarget(item.credentialType);
              input.current?.click();
            }}
          />
        ))}
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing is needed from you right now.
          </li>
        )}
      </ul>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Prototype
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          File storage is not connected, so nothing here is actually sent. The screen checks the
          file and stops there — see <code>DocumentStorageService</code>.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Stuck? Call the office on{" "}
        <a href="tel:+17132319662" className="underline underline-offset-4">
          (713) 231-9662
        </a>
        {grant?.greetingName ? " and ask for help." : "."}
      </p>
    </PortalFrame>
  );
}
