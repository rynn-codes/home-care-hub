import { useState } from "react";
import { FileQuestion, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DOCUMENT_REQUEST_LABELS,
  type RequestedDocument,
} from "@/domain/portal/familyPortal";
import { cn } from "@/lib/utils";

/**
 * Asking a family for a document — §21.
 *
 * "Authorized staff should be able to request a document from the admin
 * workflow. That request appears in the Client Portal." The portal side and the
 * table existed; nothing created a row.
 *
 * The reason field is required, and that is a deliberate friction. §21's
 * examples are all things a family has to go and find — a medication list, a
 * discharge summary, an advance directive — often while their father is in
 * hospital. Being told to produce paperwork without being told why is how a
 * request gets ignored, and then chased, and then resented. One sentence costs
 * the office ten seconds and is shown to the family verbatim.
 */

/** §21's list, as the starting point rather than the limit. */
const COMMON = [
  "Medication list",
  "Hospital discharge paperwork",
  "Physician information",
  "Advance directive",
  "Long-term care insurance",
  "Insurance or payer documentation",
];

export function RequestDocumentCard({
  clientName,
  requests,
  onRequest,
}: {
  clientName: string;
  requests: readonly RequestedDocument[];
  onRequest?: (request: { label: string; reason: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");

  const ready = label.trim().length > 1 && reason.trim().length > 5;

  function request() {
    if (!ready) return;
    onRequest?.({ label: label.trim(), reason: reason.trim() });
    toast.success(`Asked for ${label.trim().toLowerCase()}`, {
      description: `It will appear in ${clientName}'s family portal.`,
    });
    setLabel("");
    setReason("");
  }

  const outstanding = requests.filter((r) => r.state === "needed");

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FileQuestion className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Documents from the family
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {outstanding.length === 0
          ? "Nothing outstanding."
          : `${outstanding.length} still waiting on the family.`}
      </p>

      {requests.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {requests.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm">{r.label}</span>
                {r.reason && (
                  <span className="block text-xs text-muted-foreground">{r.reason}</span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs",
                  r.state === "needed" ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
                )}
              >
                {DOCUMENT_REQUEST_LABELS[r.state]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-label" className="text-xs">
            What do you need?
          </Label>
          <Input
            id="doc-label"
            list="common-documents"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Medication list"
          />
          {/* A datalist rather than a select: §21's examples are the common
              cases, not the whole world, and a fixed list would send somebody
              to the phone the first time they need something unusual. */}
          <datalist id="common-documents">
            {COMMON.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="doc-reason" className="text-xs">
            Why Joy needs it
          </Label>
          <Input
            id="doc-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Our nurse needs it before the care plan is finished."
          />
          <p className="text-xs text-muted-foreground">
            Shown to the family word for word. Being asked for paperwork without being told why
            is how a request gets ignored.
          </p>
        </div>

        <Button size="sm" disabled={!ready} onClick={request}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ask the family
        </Button>
      </div>
    </section>
  );
}
