import { Link } from "react-router-dom";
import { HomePanel } from "@/components/home/HomePanel";
import { todaysAgenda } from "@/lib/joySeed";
import { cn } from "@/lib/utils";

const stateLabel: Record<string, string> = {
  "in-progress": "In progress",
  scheduled: "Scheduled",
  unassigned: "Unassigned",
};

/** Today's Schedule, agenda style rather than a grid or a table. */
export function TodaySchedule() {
  return (
    <HomePanel title="Today's Schedule" action={{ label: "Open board", to: "/scheduling" }}>
      <p className="mb-3 text-xs text-muted-foreground">
        {todaysAgenda.length} visits · {todaysAgenda.filter((e) => e.state === "unassigned").length} unassigned
      </p>
      <ol className="divide-y divide-border">
        {todaysAgenda.map((entry) => (
          <li key={entry.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
            <span className="w-[68px] shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {entry.time}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{entry.client}</p>
              <p className="text-xs leading-snug text-muted-foreground">
                {entry.service} · {entry.assignee}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            </div>
            {entry.state === "unassigned" ? (
              <Link
                to="/scheduling"
                className="shrink-0 rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                Fill shift
              </Link>
            ) : (
              <span
                className={cn(
                  "shrink-0 text-xs",
                  entry.state === "in-progress" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {stateLabel[entry.state]}
              </span>
            )}
          </li>
        ))}
      </ol>
    </HomePanel>
  );
}
