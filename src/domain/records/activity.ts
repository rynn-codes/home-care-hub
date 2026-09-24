/**
 * Activity on a record — the calls, texts, visits, meals and notes that a
 * client, an employee or a business contact accumulates.
 *
 * One shape for all three kinds of record, so the feed component, the log
 * dialog and the store cannot drift apart by subject. A logged activity is
 * what someone typed, pasted or dictated at the time; the feed derives its
 * sentence ("Karynn Verrett took an inbound phone call with Marta") from the
 * channel and direction rather than storing prose twice.
 *
 * Gifts are marketing: a lunch left with a discharge planner, a basket for a
 * unit. They are recorded against the activity that brought them, with an
 * optional value and up to four shrunken photos, so the year's spend on a
 * contact can be totalled. See lib/photos for why photos are shrunk.
 */

export type ActivitySubjectKind = "client" | "employee" | "contact";

export interface ActivitySubject {
  kind: ActivitySubjectKind;
  id: string;
  name: string;
}

export const CHANNELS = ["phone", "text", "email", "in_person", "meal", "meeting", "event", "note"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  phone: "Phone call",
  text: "Text message",
  email: "Email",
  in_person: "In-person visit",
  meal: "Meal",
  meeting: "Meeting",
  event: "Event",
  note: "Note",
};

export const CHANNEL_DESCRIPTIONS: Record<Channel, string> = {
  phone: "Rang them, or they rang us",
  text: "A text thread worth keeping",
  email: "An exchange worth keeping on the record",
  in_person: "Dropped by, or they came to the office",
  meal: "Lunch or dinner",
  meeting: "A scheduled sit-down — home health, facility, care conference",
  event: "A conference, health fair or community event",
  note: "Something worth recording that was not a conversation",
};

export type Direction = "incoming" | "outgoing";
export type ActivitySource = "typed" | "dictated" | "pasted";

/** Phone, text and email have a direction; a meal does not. */
export function hasDirection(channel: Channel): boolean {
  return channel === "phone" || channel === "text" || channel === "email";
}

/** The channels that happen somewhere. */
export function hasPlace(channel: Channel): boolean {
  return channel === "in_person" || channel === "meal" || channel === "meeting" || channel === "event";
}

/** A gift changes hands in person. */
export function allowsGift(channel: Channel): boolean {
  return hasPlace(channel);
}

/** Texts, emails and notes have no duration worth asking for. */
export function hasMinutes(channel: Channel): boolean {
  return channel !== "text" && channel !== "email" && channel !== "note";
}

/** The channels a transcript could exist for. */
export function isRecordable(channel: Channel): boolean {
  return channel === "phone" || channel === "in_person" || channel === "meeting" || channel === "event";
}

export function verbNoun(channel: Channel, direction: Direction | null): { verb: string; noun: string } {
  switch (channel) {
    case "phone":
      return direction === "incoming"
        ? { verb: "took", noun: "an inbound phone call" }
        : { verb: "made", noun: "an outbound phone call" };
    case "text":
      return direction === "incoming" ? { verb: "received", noun: "a text message" } : { verb: "sent", noun: "a text message" };
    case "email":
      return direction === "incoming" ? { verb: "received", noun: "an email" } : { verb: "sent", noun: "an email" };
    case "in_person":
      return { verb: "had", noun: "an in-person meeting" };
    case "meal":
      return { verb: "had", noun: "a meal" };
    case "meeting":
      return { verb: "attended", noun: "a meeting" };
    case "event":
      return { verb: "attended", noun: "an event" };
    case "note":
      return { verb: "added", noun: "a note" };
    default:
      return { verb: "logged", noun: "an activity" };
  }
}

export function notesLabel(channel: Channel): string {
  if (isRecordable(channel)) return "Transcript or notes";
  if (channel === "text" || channel === "email") return "What was exchanged";
  if (channel === "note") return "The note";
  return "What was discussed";
}

export function notesHint(channel: Channel): string {
  if (isRecordable(channel)) return "Paste the transcript if the call was recorded, dictate it, or type it up.";
  if (channel === "text" || channel === "email") return "Paste the thread, or write up what was said.";
  return "Type it, paste it, or press Dictate.";
}

export const SOURCE_LABELS: Record<ActivitySource, string> = {
  typed: "Typed",
  dictated: "Dictated",
  pasted: "Pasted",
};

export const SOURCE_EXPLANATIONS: Record<ActivitySource, string> = {
  typed: "Written up by hand.",
  dictated: "Transcribed by the browser as it was spoken — check names and numbers.",
  pasted: "Pasted in whole — a transcript or thread, not written from memory.",
};

export interface GiftPhoto {
  id: string;
  /** A shrunken JPEG data URL. See lib/photos. */
  dataUrl: string;
  name: string;
  bytes: number;
  addedAt: string;
}

export interface Gift {
  description: string;
  valueUsd: number | null;
  photos: GiftPhoto[];
}

export interface Interaction {
  id: string;
  subject: ActivitySubject;
  channel: Channel;
  /** When it happened, ISO. */
  at: string;
  direction: Direction | null;
  spokeWith: string | null;
  minutes: number | null;
  place: string | null;
  gift: Gift | null;
  notes: string;
  summary: string | null;
  source: ActivitySource;
  loggedBy: string;
  loggedAt: string;
}

/* ── The dialog's draft ────────────────────────────────────────────────── */

export interface ActivityDraft {
  channel: Channel;
  date: string;
  time: string;
  direction: Direction;
  spokeWith: string;
  minutes: string;
  place: string;
  giftBrought: boolean;
  giftDescription: string;
  giftValue: string;
  giftPhotos: GiftPhoto[];
  notes: string;
  summary: string;
  source: ActivitySource;
}

export function blankDraft(channel: Channel = "phone", now: Date = new Date()): ActivityDraft {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    channel,
    date: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    time: `${p(now.getHours())}:${p(now.getMinutes())}`,
    direction: "incoming",
    spokeWith: "",
    minutes: "",
    place: "",
    giftBrought: false,
    giftDescription: "",
    giftValue: "",
    giftPhotos: [],
    notes: "",
    summary: "",
    source: "typed",
  };
}

export type DraftProblem = "no_notes" | "no_date" | "future" | "bad_minutes" | "no_gift_description" | "bad_gift_value";

export const DRAFT_ERRORS: Record<DraftProblem, string> = {
  no_notes: "Add what happened — that is the point of the entry.",
  no_date: "Say when it happened.",
  future: "That is in the future. Activity records something that already happened.",
  bad_minutes: "How long, in whole minutes?",
  no_gift_description: 'What did you bring? "A gift" is not something anyone can look back on.',
  bad_gift_value: "What did it cost? A number, or leave it blank.",
};

export function draftProblems(draft: ActivityDraft, now: Date = new Date()): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (!draft.notes.trim()) out.push("no_notes");
  if (!draft.date) out.push("no_date");
  const instant = draftInstant(draft);
  if (draft.date && (!instant || Number.isNaN(Date.parse(instant)))) out.push("no_date");
  else if (instant && Date.parse(instant) > now.getTime() + 60_000) out.push("future");
  const minutes = draft.minutes.trim();
  if (minutes && (!/^\d{1,4}$/.test(minutes) || Number(minutes) === 0)) out.push("bad_minutes");
  if (allowsGift(draft.channel) && draft.giftBrought) {
    if (!draft.giftDescription.trim()) out.push("no_gift_description");
    const value = draft.giftValue.trim().replace(/^\$/, "");
    if (value && !/^\d{1,6}(\.\d{1,2})?$/.test(value)) out.push("bad_gift_value");
  }
  return out;
}

export function giftValue(raw: string): number | null {
  const t = raw.trim().replace(/^\$/, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function draftValid(draft: ActivityDraft, now: Date = new Date()): boolean {
  return draftProblems(draft, now).length === 0;
}

/** The draft's date and time as an ISO instant, or null when unparseable. */
export function draftInstant(draft: Pick<ActivityDraft, "date" | "time">): string | null {
  if (!draft.date) return null;
  const d = new Date(`${draft.date}T${draft.time || "00:00"}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function interactionFromDraft(input: {
  draft: ActivityDraft;
  id: string;
  subject: ActivitySubject;
  loggedBy: string;
  loggedAt?: string;
}): Interaction {
  const { draft, id, subject, loggedBy } = input;
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  return {
    id,
    subject,
    channel: draft.channel,
    at: draftInstant(draft) ?? new Date().toISOString(),
    direction: hasDirection(draft.channel) ? draft.direction : null,
    spokeWith: orNull(draft.spokeWith),
    minutes: hasMinutes(draft.channel) && draft.minutes.trim() ? Number(draft.minutes.trim()) : null,
    place: hasPlace(draft.channel) ? orNull(draft.place) : null,
    gift:
      allowsGift(draft.channel) && draft.giftBrought
        ? { description: draft.giftDescription.trim(), valueUsd: giftValue(draft.giftValue), photos: draft.giftPhotos }
        : null,
    notes: draft.notes.trim(),
    summary: orNull(draft.summary),
    source: draft.source,
    loggedBy,
    loggedAt: input.loggedAt ?? new Date().toISOString(),
  };
}

/* ── Reading the record ────────────────────────────────────────────────── */

export function interactionsFor(all: Interaction[], kind: ActivitySubjectKind, id: string): Interaction[] {
  return all
    .filter((i) => i.subject.kind === kind && i.subject.id === id)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface GiftTotal {
  count: number;
  totalUsd: number;
  unpriced: number;
  entries: Interaction[];
}

export function giftTotalFor(
  all: Interaction[],
  kind: ActivitySubjectKind,
  id: string,
  year: number = new Date().getFullYear(),
): GiftTotal {
  const entries = interactionsFor(all, kind, id).filter(
    (i) => i.gift !== null && new Date(i.at).getFullYear() === year,
  );
  return {
    count: entries.length,
    totalUsd: entries.reduce((sum, i) => sum + (i.gift?.valueUsd ?? 0), 0),
    unpriced: entries.filter((i) => i.gift?.valueUsd == null).length,
    entries,
  };
}

export function formatMoney(n: number): string {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

/** "3 gifts in 2026, $184 · 1 without a value", or null when none. */
export function giftSummaryLine(total: GiftTotal, year: number): string | null {
  if (total.count === 0) return null;
  const count = `${total.count} ${total.count === 1 ? "gift" : "gifts"}`;
  const money = total.totalUsd > 0 ? `, ${formatMoney(total.totalUsd)}` : "";
  const unpriced = total.unpriced > 0 ? ` · ${total.unpriced} without a value` : "";
  return `${count} in ${year}${money}${unpriced}`;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function truncate(text: string, max = 150): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 40 ? space : max).trimEnd()}…`;
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const minutes = Math.floor((now.getTime() - t) / 60_000);
  if (minutes < 0) return "Scheduled";
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 31) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

/* ── The feed ──────────────────────────────────────────────────────────── */

export type FeedTone = "done" | "prog" | "warn" | "bad";

/** One row of a record's activity feed — a logged activity or a system event. */
export interface FeedRow {
  id: string;
  at: string;
  actor: string | null;
  verb: string;
  noun: string;
  counterpart: string | null;
  place: string | null;
  detail: string | null;
  body: string | null;
  channel: Channel | null;
  tone: FeedTone;
  source: ActivitySource | null;
  loggedBy: string | null;
  minutes: number | null;
  gift: Gift | null;
}

export interface SystemEvent {
  id: string;
  at: string;
  label: string;
  tone: FeedTone | string;
}

export function fromInteraction(i: Interaction): FeedRow {
  const { verb, noun } = verbNoun(i.channel, i.direction);
  return {
    id: i.id,
    at: i.at,
    actor: i.loggedBy,
    verb,
    noun,
    counterpart: i.spokeWith,
    place: i.place,
    detail: i.summary ?? truncate(i.notes, 110),
    body: i.notes,
    channel: i.channel,
    tone: "prog",
    source: i.source,
    loggedBy: i.loggedBy,
    minutes: i.minutes,
    gift: i.gift,
  };
}

export function fromSystem(e: SystemEvent): FeedRow {
  return {
    id: e.id,
    at: e.at,
    actor: null,
    verb: "",
    noun: e.label,
    counterpart: null,
    place: null,
    detail: null,
    body: null,
    channel: null,
    tone: (e.tone as FeedTone) ?? "prog",
    source: null,
    loggedBy: null,
    minutes: null,
    gift: null,
  };
}

/** Logged activity and system events, newest first. */
export function buildFeed(interactions: Interaction[], system: SystemEvent[] = []): FeedRow[] {
  return [...interactions.map(fromInteraction), ...system.map(fromSystem)].sort((a, b) => b.at.localeCompare(a.at));
}
