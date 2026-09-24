import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, Gift, Mic, Square, TriangleAlert, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { newId } from "@/lib/demoStore";
import { MAX_PHOTOS, formatBytes, shrinkPhoto } from "@/lib/photos";
import { useDictation } from "@/hooks/use-dictation";
import { CHANNEL_ICONS } from "@/components/records/ActivityFeed";
import {
  CHANNELS,
  CHANNEL_DESCRIPTIONS,
  CHANNEL_LABELS,
  DRAFT_ERRORS,
  allowsGift,
  blankDraft,
  draftProblems,
  draftValid,
  hasDirection,
  hasMinutes,
  hasPlace,
  isRecordable,
  notesHint,
  notesLabel,
  verbNoun,
  wordCount,
  type ActivityDraft,
  type Channel,
  type DraftProblem,
  type GiftPhoto,
} from "@/domain/records/activity";

/**
 * Log a call, a text, a visit, a meal, a meeting, an event or a note.
 *
 * The notes are the entry. They can be typed, pasted (a recorded call's
 * transcript, a text thread) or dictated through the browser, and the record
 * keeps which — a dictated note is flagged so names and numbers get checked.
 */
export function LogActivityDialog({
  open,
  onOpenChange,
  subjectName,
  suggestedParty,
  giftsSoFar,
  initialChannel = "phone",
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  /** Pre-fills "who was there" — a client's responsible party. */
  suggestedParty?: string | null;
  /** "2 gifts in 2026, $84" — shown under the gift fields. */
  giftsSoFar?: string | null;
  initialChannel?: Channel;
  onSave: (draft: ActivityDraft) => void;
}) {
  const [draft, setDraft] = useState<ActivityDraft>(() => blankDraft(initialChannel));
  const [tried, setTried] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [addingPhotos, setAddingPhotos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dictation = useDictation();
  const notesBeforeDictation = useRef("");
  const pastedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDraft(blankDraft(initialChannel));
    setTried(false);
    setPhotoError("");
    notesBeforeDictation.current = "";
    pastedRef.current = false;
    dictation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChannel]);

  useEffect(() => {
    if (!dictation.transcript) return;
    const merged = [notesBeforeDictation.current.trim(), dictation.transcript.trim()].filter(Boolean).join(" ");
    pastedRef.current = false;
    setDraft((d) => ({ ...d, notes: merged, source: "dictated" }));
  }, [dictation.transcript]);

  const set = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const problems = draftProblems(draft);
  const shows = (p: DraftProblem) => tried && problems.includes(p);

  const toggleDictation = () => {
    if (!dictation.listening) {
      notesBeforeDictation.current = draft.notes;
      dictation.reset();
    }
    dictation.toggle();
  };

  const addPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setAddingPhotos(true);
    setPhotoError("");
    const added: GiftPhoto[] = [];
    let message = "";
    for (const file of files) {
      if (draft.giftPhotos.length + added.length >= MAX_PHOTOS) {
        message = `Only the first ${MAX_PHOTOS} photos were kept.`;
        break;
      }
      const result = await shrinkPhoto(file, newId("photo"));
      if (result.status === "rejected") {
        message = result.message;
        continue;
      }
      const { id, dataUrl, name, bytes, addedAt } = result.photo;
      added.push({ id, dataUrl, name, bytes, addedAt });
    }
    if (added.length > 0) setDraft((d) => ({ ...d, giftPhotos: [...d.giftPhotos, ...added] }));
    setPhotoError(message);
    setAddingPhotos(false);
  };

  const save = () => {
    if (!draftValid(draft)) {
      setTried(true);
      return;
    }
    if (dictation.listening) dictation.toggle();
    onSave(draft);
    onOpenChange(false);
  };

  const words = wordCount(draft.notes);
  const reads = verbNoun(draft.channel, hasDirection(draft.channel) ? draft.direction : null);
  const chip =
    "flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-[10px] border px-2 text-[12px] transition-colors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription>About {subjectName}. Kept on their record with the date and who wrote it up.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>What happened</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHANNELS.map((c) => {
                const Icon = CHANNEL_ICONS[c];
                const on = draft.channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("channel", c)}
                    aria-pressed={on}
                    title={CHANNEL_DESCRIPTIONS[c]}
                    className={cn(
                      chip,
                      on
                        ? "border-[rgba(20,7,162,.24)] bg-[#EFEDFB] font-medium text-primary"
                        : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {CHANNEL_LABELS[c]}
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-[12px] text-muted-foreground">{CHANNEL_DESCRIPTIONS[draft.channel]}</p>
          </div>

          {hasDirection(draft.channel) && (
            <div className="flex flex-col gap-1.5">
              <Label>Direction</Label>
              <div className="flex gap-2">
                {(["incoming", "outgoing"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("direction", d)}
                    aria-pressed={draft.direction === d}
                    className={cn(
                      "h-9 flex-1 rounded-[10px] border px-3 text-[13px] transition-colors",
                      draft.direction === d
                        ? "border-[rgba(20,7,162,.24)] bg-[#EFEDFB] font-medium text-primary"
                        : "border-[var(--hairline)] bg-[var(--paper)] hover:bg-[var(--wash)]",
                    )}
                  >
                    {d === "incoming" ? "They contacted us" : "We contacted them"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cn("grid gap-3", hasMinutes(draft.channel) ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-date">Date</Label>
              <Input
                id="act-date"
                type="date"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                aria-invalid={shows("no_date") || shows("future")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-time">Time</Label>
              <Input id="act-time" type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            {hasMinutes(draft.channel) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="act-minutes">Minutes</Label>
                <Input
                  id="act-minutes"
                  inputMode="numeric"
                  placeholder="Optional"
                  value={draft.minutes}
                  onChange={(e) => set("minutes", e.target.value)}
                  aria-invalid={shows("bad_minutes")}
                />
              </div>
            )}
          </div>
          {shows("no_date") && <FieldError>{DRAFT_ERRORS.no_date}</FieldError>}
          {shows("future") && <FieldError>{DRAFT_ERRORS.future}</FieldError>}
          {shows("bad_minutes") && <FieldError>{DRAFT_ERRORS.bad_minutes}</FieldError>}

          <div className={cn("grid gap-3", hasPlace(draft.channel) && "sm:grid-cols-2")}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="act-party">{draft.channel === "note" ? "About" : "Who was there"}</Label>
              <Input
                id="act-party"
                value={draft.spokeWith}
                onChange={(e) => set("spokeWith", e.target.value)}
                placeholder={suggestedParty ?? subjectName}
              />
            </div>
            {hasPlace(draft.channel) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="act-place">Where</Label>
                <Input
                  id="act-place"
                  value={draft.place}
                  onChange={(e) => set("place", e.target.value)}
                  placeholder="Optional — the restaurant, the unit, the venue"
                />
              </div>
            )}
          </div>

          {allowsGift(draft.channel) && (
            <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={draft.giftBrought}
                  onChange={(e) => set("giftBrought", e.target.checked)}
                  className="mt-[3px] h-4 w-4 flex-none accent-[#1407A2]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Gift className="h-3.5 w-3.5 text-[var(--ink-body)]" aria-hidden="true" />
                    We brought a marketing gift
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Lunch for the team, a basket, branded bags — anything left with them.
                  </span>
                </span>
              </label>
              {draft.giftBrought && (
                <div className="mt-3.5 flex flex-col gap-3 border-t border-[var(--hairline)] pt-3.5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="gift-what">What did you bring</Label>
                      <Input
                        id="gift-what"
                        value={draft.giftDescription}
                        onChange={(e) => set("giftDescription", e.target.value)}
                        placeholder="Lunch for the 5 West team"
                        aria-invalid={shows("no_gift_description")}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="gift-value">What it cost</Label>
                      <Input
                        id="gift-value"
                        inputMode="decimal"
                        value={draft.giftValue}
                        onChange={(e) => set("giftValue", e.target.value)}
                        placeholder="$0.00"
                        aria-invalid={shows("bad_gift_value")}
                      />
                    </div>
                  </div>
                  {giftsSoFar && <p className="m-0 text-[12px] text-[var(--ink-body)]">Already this year: {giftsSoFar}.</p>}
                  {shows("no_gift_description") && <FieldError>{DRAFT_ERRORS.no_gift_description}</FieldError>}
                  {shows("bad_gift_value") && <FieldError>{DRAFT_ERRORS.bad_gift_value}</FieldError>}
                  <div className="flex flex-col gap-2">
                    <Label>Photos</Label>
                    {draft.giftPhotos.length > 0 && (
                      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                        {draft.giftPhotos.map((p) => (
                          <li key={p.id} className="relative">
                            <img
                              src={p.dataUrl}
                              alt={p.name}
                              className="h-[84px] w-[84px] rounded-[10px] border border-[var(--hairline)] object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => set("giftPhotos", draft.giftPhotos.filter((x) => x.id !== p.id))}
                              aria-label={`Remove ${p.name}`}
                              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground shadow-sm transition-colors hover:bg-[#FEF3F2] hover:text-[#B42318]"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <span className="mt-1 block text-center text-[10.5px] text-muted-foreground">
                              {formatBytes(p.bytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={addPhotos}
                      className="sr-only"
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={addingPhotos || draft.giftPhotos.length >= MAX_PHOTOS}
                      className="flex h-9 w-fit items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] transition-colors hover:bg-[var(--wash)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      {addingPhotos ? "Adding…" : draft.giftPhotos.length === 0 ? "Add a photo" : "Add another"}
                    </button>
                    <p className="m-0 text-[12px] text-muted-foreground">
                      {draft.giftPhotos.length >= MAX_PHOTOS
                        ? `${MAX_PHOTOS} photos is the limit.`
                        : "Take one now or pick from the camera roll. Photos are shrunk before they are saved."}
                    </p>
                    {photoError && <FieldError>{photoError}</FieldError>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="act-notes">{notesLabel(draft.channel)}</Label>
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-pressed={dictation.listening}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-[9px] border px-2.5 text-[12.5px] transition-colors",
                    dictation.listening
                      ? "border-[#F0BBB4] bg-[#FEF3F2] font-medium text-[#B42318]"
                      : "border-[var(--hairline)] bg-[var(--paper)] hover:bg-[var(--wash)]",
                  )}
                >
                  {dictation.listening ? (
                    <>
                      <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      Dictate
                    </>
                  )}
                </button>
              )}
            </div>
            <Textarea
              id="act-notes"
              rows={isRecordable(draft.channel) ? 9 : 7}
              value={draft.notes}
              onPaste={() => {
                pastedRef.current = true;
              }}
              onChange={(e) => {
                const value = e.target.value;
                notesBeforeDictation.current = value;
                if (!value.trim()) pastedRef.current = false;
                setDraft((d) => ({
                  ...d,
                  notes: value,
                  source:
                    d.source === "dictated" && dictation.listening ? "dictated" : pastedRef.current ? "pasted" : "typed",
                }));
              }}
              placeholder={
                isRecordable(draft.channel)
                  ? "Paste the transcript here, or write up what was said."
                  : "Paste or type it, or press Dictate."
              }
              aria-invalid={shows("no_notes")}
              className="resize-y leading-[1.6]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted-foreground">
                {dictation.listening
                  ? "Listening — speak normally."
                  : words > 0
                    ? `${words} ${words === 1 ? "word" : "words"}`
                    : "Nothing captured yet."}
              </span>
              {words > 0 && !dictation.listening && draft.source !== "typed" && (
                <span className="text-[12px] text-muted-foreground">
                  {draft.source === "dictated" ? "Saved as dictated — check names and numbers." : "Saved as a pasted transcript."}
                </span>
              )}
            </div>
            <p className="m-0 text-[12px] text-muted-foreground">{notesHint(draft.channel)}</p>
            {shows("no_notes") && <FieldError>{DRAFT_ERRORS.no_notes}</FieldError>}
            {!dictation.supported && (
              <p className="m-0 text-[12px] text-muted-foreground">This browser will not dictate. Type or paste instead.</p>
            )}
            {dictation.error && <FieldError>{dictation.error}</FieldError>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="act-summary">One-line summary</Label>
            <Input
              id="act-summary"
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Optional — what someone scanning the record needs to know"
            />
          </div>

          <p className="m-0 rounded-[10px] bg-[var(--paper-sunken)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-body)]">
            Will read:{" "}
            <span className="text-[var(--ink-strong)]">
              You {reads.verb} {reads.noun}
            </span>
            {draft.spokeWith.trim() && ` with ${draft.spokeWith.trim()}`}
            {hasPlace(draft.channel) && draft.place.trim() && ` at ${draft.place.trim()}`}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-1.5 text-[12.5px] text-[#B42318]">
      <TriangleAlert className="mt-[2px] h-3.5 w-3.5 flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}
