import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { weekBadge } from "@/domain/calendar/agencyWeek";

/**
 * Which week it is, in the one place every week-shaped screen prints it.
 *
 * Karynn, 25 August: "Ensure AI is aware and tracking what week we are on on
 * all pages." Before this, Home carried a hardcoded label, payroll ran off a
 * fortnight that slid with the clock, and billing computed its own Saturday —
 * three screens that could each name a different week on the same morning.
 * They all read `agencyWeek` now, and they all show it here.
 *
 * Neutral by design. The semantic colour rule reserves amber for something a
 * human still owes and blue for the one primary action; the date is neither,
 * so it stays out of both.
 */
export function WeekChip({ iso, className }: { iso?: string; className?: string }) {
  const label = weekBadge(iso ?? new Date().toISOString());
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[#F4F4F7] px-2.5 py-[3px] text-[11.5px] font-medium text-muted-foreground",
        className,
      )}
    >
      <CalendarRange className="h-3 w-3 flex-none" aria-hidden="true" />
      {label}
    </span>
  );
}
