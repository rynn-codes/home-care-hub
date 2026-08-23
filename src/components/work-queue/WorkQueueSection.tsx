import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WorkQueueSection as Section } from "@/domain/workQueue";

interface WorkQueueSectionProps<T> {
  section: Section<T>;
  renderItem: (item: T) => ReactNode;
  emptyNote?: string;
}

/**
 * Renders one Needs You / Waiting / Moving Forward section, to the approved
 * Admissions mock's group pattern: a colored dot, the uppercase label, the
 * count and the hint over one quiet white card of rows.
 *
 * Shared across modules on purpose. Section 8 asks for one reusable pattern
 * rather than each module inventing its own list, and section 29 names
 * WorkQueueSection as a design-system primitive.
 *
 * The heading is always rendered, even when the section is empty — "Nothing
 * needs you right now" is useful information, and a heading that disappears
 * makes the page shift under the reader.
 */

const GROUP_DOT: Record<string, string> = {
  needs_you: "bg-[#F79009]",
  waiting: "bg-primary",
  moving_forward: "bg-[#12B76A]",
};

export function WorkQueueSection<T>({ section, renderItem, emptyNote }: WorkQueueSectionProps<T>) {
  return (
    <section aria-labelledby={`wq-${section.group}`} className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={cn("h-[7px] w-[7px] flex-none rounded-full", GROUP_DOT[section.group] ?? "bg-[#9B9BA3]")}
          aria-hidden="true"
        />
        <h2
          id={`wq-${section.group}`}
          className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground"
        >
          {section.label}
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">{section.items.length}</span>
        <span className="ml-1 hidden text-xs text-muted-foreground/60 sm:inline">{section.hint}</span>
      </div>

      {section.items.length === 0 ? (
        <p className="rounded-[14px] border border-[#ECECF1] bg-white px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          {emptyNote ?? "Nothing here right now."}
        </p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white p-0">
          {section.items.map((item, i) => (
            <li key={i} className="border-b border-[#F3F3F6] last:border-b-0">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
