import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_KIND_LABELS,
  DRAFT_MESSAGES,
  EMPTY_DRAFT,
  REFERRING_KINDS,
  canSave,
  draftProblems,
  type ContactDraft,
  type ContactKind,
} from "@/domain/people/contacts";
import { cn } from "@/lib/utils";

/**
 * Typing in a business card.
 *
 * Almost every field is optional, deliberately. Cards vary — some have a unit
 * and no address, some are a name and a mobile — and a form that insists on
 * completeness gets abandoned halfway, which loses the contact entirely.
 * Half-entering somebody beats not entering them.
 *
 * The three things it does insist on are a name, some way to reach them, and a
 * kind. The middle one because a row with a name and no email or phone is a
 * note rather than a contact, and it will sit in the list looking like
 * something Joy can act on.
 *
 * The kind is asked for with the referring options first and marked, because
 * that single choice decides whether this person ever appears on the follow-up
 * list — which is the whole reason the screen is worth opening.
 */

const KIND_ORDER: ContactKind[] = [
  "discharge_planner",
  "physician",
  "case_manager",
  "outreach",
  "facility",
  "partner",
  "vendor",
  "community",
  "other",
];

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function AddContactDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (draft: ContactDraft) => void;
}) {
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);

  const problems = draftProblems(draft);
  const set = (patch: Partial<ContactDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function close(next: boolean) {
    if (!next) {
      setDraft(EMPTY_DRAFT);
      setTouched(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a contact</DialogTitle>
          <DialogDescription>
            Business contacts, referral sources and partners. Only the name and one way to reach
            them are required — fill in what the card actually has.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field
              id="contact-name"
              label="Name"
              value={draft.name}
              onChange={(name) => set({ name })}
              placeholder="Bria Bonnette"
            />
            <Field
              id="contact-credentials"
              label="Letters"
              hint="optional"
              value={draft.credentials}
              onChange={(credentials) => set({ credentials })}
              placeholder="LCSW"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="contact-title"
              label="Title"
              value={draft.title}
              onChange={(title) => set({ title })}
              placeholder="Social Worker II"
            />
            <Field
              id="contact-org"
              label="Organisation"
              value={draft.organization}
              onChange={(organization) => set({ organization })}
              placeholder="Houston Methodist"
            />
          </div>

          <Field
            id="contact-unit"
            label="Unit or department"
            hint="optional"
            value={draft.unit}
            onChange={(unit) => set({ unit })}
            placeholder="Skilled Nursing Unit"
          />

          <div className="space-y-2">
            <Label className="text-xs">What kind of contact</Label>
            <div className="flex flex-wrap gap-2">
              {KIND_ORDER.map((kind) => {
                const referring = REFERRING_KINDS.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => set({ kind })}
                    aria-pressed={draft.kind === kind}
                    className={cn(
                      "min-h-11 rounded-xl border px-3.5 py-2 text-sm transition-colors",
                      draft.kind === kind
                        ? "border-primary bg-[hsl(var(--primary-soft))] font-medium text-[hsl(var(--accent-foreground))]"
                        : "border-border hover:bg-surface-muted",
                    )}
                  >
                    {CONTACT_KIND_LABELS[kind]}
                    {/* Marked because this choice, and only this choice,
                        decides whether they appear on the follow-up list. */}
                    {referring && <span className="ml-1.5 text-xs text-muted-foreground">·</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              The first five can send Joy work, so Joy will remind you when they have not heard
              from anybody in three months.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="contact-email"
              label="Email"
              value={draft.email}
              onChange={(email) => set({ email })}
              placeholder="name@example.org"
            />
            <Field
              id="contact-phone"
              label="Phone"
              value={draft.phone}
              onChange={(phone) => set({ phone })}
              placeholder="(713) 555-0100"
            />
          </div>

          <Field
            id="contact-address"
            label="Address"
            hint="optional"
            value={draft.address}
            onChange={(address) => set({ address })}
            placeholder="6565 Fannin St, Houston, TX 77030"
          />

          <div className="space-y-1.5">
            <Label htmlFor="contact-notes" className="text-xs">
              Notes <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Textarea
              id="contact-notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Anything worth knowing before you ring them."
            />
          </div>

          {touched && problems.length > 0 && (
            <ul role="alert" className="space-y-1">
              {problems.map((problem) => (
                <li key={problem} className="text-sm text-destructive">
                  {DRAFT_MESSAGES[problem]}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (!canSave(draft)) return;
              onAdd(draft);
              close(false);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
