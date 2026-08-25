import { ReactNode } from "react";
import { WeekChip } from "@/components/layout/WeekChip";

/**
 * Every module screen's title, to the approved mocks' shared treatment:
 * 24px/600 with a light one-line purpose under it, actions on the right.
 *
 * `week` opts a screen into the shared week badge, which sits beside the title
 * so a screen whose numbers mean "this week" says which week that is. Only the
 * week-shaped screens set it — a directory of clients has no week.
 */
export function PageHeader({
  title,
  description,
  actions,
  week,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Show the agency-week badge. Pass an ISO date to pin it, or true for today. */
  week?: boolean | string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-[5px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-2xl font-semibold tracking-[-.02em]">{title}</h1>
          {week && <WeekChip iso={typeof week === "string" ? week : undefined} />}
        </div>
        {description && <p className="m-0 text-[13.5px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
