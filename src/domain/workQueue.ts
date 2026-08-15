/**
 * The reusable work-queue pattern: Needs You / Waiting / Moving Forward.
 *
 * Section 8 asks for one shared pattern rather than three list systems per
 * module. Today only Admissions implements it properly; Hiring and Scheduling
 * have a "Needs you" panel and nothing else, and Payroll and Billing use
 * unrelated tabs. This module is where that convergence starts, so it is
 * deliberately generic over the item type.
 *
 *   Needs You       — a Joy Health user must act.
 *   Waiting         — Joy is waiting on a person, system or event.
 *   Moving Forward  — the next milestone is already progressing.
 */

export const WORK_QUEUE_GROUPS = ["needs_you", "waiting", "moving_forward"] as const;

export type WorkQueueGroup = (typeof WORK_QUEUE_GROUPS)[number];

export const WORK_QUEUE_LABELS: Record<WorkQueueGroup, string> = {
  needs_you: "Needs You",
  waiting: "Waiting",
  moving_forward: "Moving Forward",
};

export const WORK_QUEUE_HINTS: Record<WorkQueueGroup, string> = {
  needs_you: "Someone here is waiting on you",
  waiting: "Waiting on someone outside the office",
  moving_forward: "The next step is already booked",
};

export interface WorkQueueSection<T> {
  group: WorkQueueGroup;
  label: string;
  hint: string;
  items: T[];
}

/**
 * Groups items into the three sections, always returning all three so a module
 * can render an empty state rather than silently dropping a heading.
 *
 * Order within a group is preserved, so callers control priority by sorting
 * before they classify.
 */
export function buildWorkQueue<T>(
  items: readonly T[],
  classify: (item: T) => WorkQueueGroup,
): WorkQueueSection<T>[] {
  const buckets: Record<WorkQueueGroup, T[]> = {
    needs_you: [],
    waiting: [],
    moving_forward: [],
  };

  for (const item of items) {
    buckets[classify(item)].push(item);
  }

  return WORK_QUEUE_GROUPS.map((group) => ({
    group,
    label: WORK_QUEUE_LABELS[group],
    hint: WORK_QUEUE_HINTS[group],
    items: buckets[group],
  }));
}

export function countNeedsYou<T>(sections: WorkQueueSection<T>[]): number {
  return sections.find((s) => s.group === "needs_you")?.items.length ?? 0;
}
