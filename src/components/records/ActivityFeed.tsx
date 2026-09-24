import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Gift,
  Handshake,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Users,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canSeeMarketing, canWrite } from "@/domain/access/roles";
import {
  SOURCE_EXPLANATIONS,
  SOURCE_LABELS,
  fmtWhen,
  formatMoney,
  timeAgo,
  wordCount,
  type Channel,
  type FeedRow,
  type FeedTone,
} from "@/domain/records/activity";
import { initialsOf } from "@/lib/initials";

export const CHANNEL_ICONS: Record<Channel, typeof Phone> = {
  phone: Phone,
  text: MessageSquare,
  email: Mail,
  in_person: Handshake,
  meal: Utensils,
  meeting: Users,
  event: CalendarDays,
  note: StickyNote,
};

const TONE_DOT: Record<FeedTone, string> = {
  done: "bg-[#12B76A]",
  prog: "bg-primary",
  warn: "bg-[#F79009]",
  bad: "bg-[#D92D20]",
};

/**
 * A record's activity, newest first: what was logged and what the system did.
 *
 * Rows with a body open on click to show the notes, the source (typed,
 * dictated, pasted) and who logged it. Gifts show only to roles that may see
 * marketing — see domain/access/roles.
 */
export function ActivityFeed({
  rows,
  onLogActivity,
  onLogCall,
  onDelete,
  subjectName,
  bare,
}: {
  rows: FeedRow[];
  onLogActivity: () => void;
  onLogCall?: () => void;
  onDelete?: (id: string) => void;
  subjectName: string;
  /** No heading and no buttons — the caller supplies them. */
  bare?: boolean;
}) {
  const { currentUser } = useDemo();
  const mayWrite = canWrite(currentUser.role);
  return (
    <section className="flex flex-col gap-3">
      {!bare && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-semibold tracking-[-.01em] text-[var(--ink-strong)]">
            Activity
            {rows.length > 0 && <span className="ml-2 font-normal text-muted-foreground">{rows.length}</span>}
          </h2>
          <div className="flex items-center gap-2">
            {mayWrite && onLogCall && (
              <button
                type="button"
                onClick={onLogCall}
                className="flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Log a call
              </button>
            )}
            {mayWrite && (
              <button
                type="button"
                onClick={onLogActivity}
                className="flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Log activity
              </button>
            )}
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[var(--hairline)] bg-[var(--paper)] px-5 py-7 text-center">
          <p className="m-0 text-[13px] text-[var(--ink-body)]">Nothing recorded for {subjectName} yet.</p>
          {mayWrite && (
            <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
              Log a call, a visit or a meeting and it appears here with the date and who took it. A recorded call's
              transcript can be pasted in whole.
            </p>
          )}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0 overflow-hidden rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-0">
          {rows.map((row) => (
            <FeedRowItem key={row.id} row={row} onDelete={mayWrite ? onDelete : undefined} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedRowItem({ row, onDelete }: { row: FeedRow; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const expandable = !!row.body;
  const Icon = row.channel ? CHANNEL_ICONS[row.channel] : null;
  const { currentUser } = useDemo();
  const gift = canSeeMarketing(currentUser.role) ? row.gift : null;

  const content = (
    <>
      <span className="flex flex-none items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[var(--hairline)] bg-[var(--paper-sunken)]"
        >
          {Icon ? (
            <Icon className="h-3 w-3 text-[var(--ink-body)]" />
          ) : (
            <span className={cn("h-[7px] w-[7px] rounded-full", TONE_DOT[row.tone] ?? TONE_DOT.prog)} />
          )}
        </span>
        {row.actor && (
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF0FE] text-[10px] font-semibold text-primary"
          >
            {initialsOf(row.actor)}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] leading-[1.45] text-[var(--ink-strong)]">
          {row.actor && <span className="font-medium">{row.actor} </span>}
          {row.verb && <span>{row.verb} </span>}
          <span className={cn("underline decoration-[#C7C7CF] underline-offset-[3px]", expandable && "decoration-dotted")}>
            {row.noun}
          </span>
          {row.counterpart && <span className="text-[var(--ink-body)]"> with {row.counterpart}</span>}
          {row.place && <span className="text-[var(--ink-body)]"> at {row.place}</span>}
        </span>
        {gift && (
          <span className="mt-0.5 flex w-fit items-center gap-1.5 rounded-full bg-[#FFF7E6] px-2 py-[2px] text-[11.5px] font-medium text-[#93540A]">
            <Gift className="h-3 w-3" aria-hidden="true" />
            {gift.description}
            {gift.valueUsd !== null && ` · ${formatMoney(gift.valueUsd)}`}
            {gift.photos.length > 0 && ` · ${gift.photos.length} ${gift.photos.length === 1 ? "photo" : "photos"}`}
          </span>
        )}
        {row.detail && <span className="text-[12.5px] leading-[1.5] text-[var(--ink-body)]">{row.detail}</span>}
      </span>
      <span className="flex flex-none items-center gap-2 pt-[2px]">
        <span className="whitespace-nowrap text-[12px] text-[#9B9BA3]" title={fmtWhen(row.at)}>
          {timeAgo(row.at)}
        </span>
        {expandable && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-[#9B9BA3] transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        )}
      </span>
    </>
  );

  return (
    <li className="border-b border-[var(--hairline-soft)] last:border-b-0">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--wash)]"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-5 py-3.5">{content}</div>
      )}
      {open && row.body && (
        <div className="border-t border-[var(--hairline-soft)] bg-[var(--paper-sunken)] px-5 py-4">
          <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.65] text-[var(--ink-strong)] [text-wrap:pretty]">
            {row.body}
          </p>
          {gift && gift.photos.length > 0 && (
            <ul className="m-0 mt-3.5 flex list-none flex-wrap gap-2 p-0">
              {gift.photos.map((p) => (
                <li key={p.id}>
                  <a href={p.dataUrl} target="_blank" rel="noreferrer" title={p.name}>
                    <img
                      src={p.dataUrl}
                      alt={`${gift.description} — ${p.name}`}
                      loading="lazy"
                      className="h-[92px] w-[92px] rounded-[10px] border border-[var(--hairline)] object-cover transition-opacity hover:opacity-90"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--hairline-soft)] pt-3 text-[12px] text-muted-foreground">
            {row.source && (
              <>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-[2px] font-medium",
                    row.source === "dictated"
                      ? "bg-[#FFFAEB] text-[#B54708]"
                      : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                  )}
                >
                  {SOURCE_LABELS[row.source]}
                </span>
                <span>{SOURCE_EXPLANATIONS[row.source]}</span>
              </>
            )}
            <span className="ml-auto flex items-center gap-3">
              <span>
                {wordCount(row.body)} words
                {row.minutes ? ` · ${row.minutes} min` : ""}
                {row.loggedBy ? ` · logged by ${row.loggedBy}` : ""}
              </span>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  className="rounded-[8px] px-2 py-1 text-muted-foreground transition-colors hover:bg-[#FEF3F2] hover:text-[#B42318]"
                >
                  Delete
                </button>
              )}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
