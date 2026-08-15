import { ReactNode } from "react";
import type { WorkQueueSection as Section } from "@/domain/workQueue";

interface WorkQueueSectionProps<T> {
  section: Section<T>;
  renderItem: (item: T) => ReactNode;
  emptyNote?: string;
}

/**
 * Renders one Needs You / Waiting / Moving Forward section.
 *
 * Shared across modules on purpose. Section 8 asks for one reusable pattern
 * rather than each module inventing its own list, and section 29 names
 * WorkQueueSection as a design-system primitive.
 *
 * The heading is always rendered, even when the section is empty — "Nothing
 * needs you right now" is useful information, and a heading that disappears
 * makes the page shift under the reader.
 */
export function WorkQueueSection<T>({ section, renderItem, emptyNote }: WorkQueueSectionProps<T>) {
  return (
    <section aria-labelledby={`wq-${section.group}`} className="mb-8 last:mb-0">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id={`wq-${section.group}`} className="text-base font-semibold tracking-tight">
          {section.label}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">{section.items.length}</span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          {section.hint}
        </span>
      </div>

      {section.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyNote ?? "Nothing here right now."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-surface">
          {section.items.map((item, i) => (
            <li key={i} className="border-b border-border last:border-b-0">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
