import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { todaysAgenda } from "@/lib/joySeed";
import { cn } from "@/lib/utils";

const stateLabel: Record<string, string> = {
  "in-progress": "In progress",
  scheduled: "Scheduled",
  unassigned: "Unassigned",
};

/**
 * My Tasks | Today's Schedule — the mock's working area, one focused column.
 *
 * TASKS ARE THE SIGNALS, AS ROWS. Each row is the same module-computed figure
 * the old priority strip carried, reshaped into the mock's task list: what it
 * is, why it matters, and one click to the screen that owns it. Urgent items
 * first — the mock's checkbox visual is skipped because none of these are
 * "done" by ticking; they are done on their own screens, and a checkbox that
 * doesn't check would be furniture.
 */
export function HomeTabs() {
  const signals = useHomeSignals();
  const tasks = [...signals].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const unassigned = todaysAgenda.filter((e) => e.state === "unassigned").length;

  return (
    <Tabs defaultValue="tasks">
      <TabsList>
        <TabsTrigger value="tasks">My Tasks</TabsTrigger>
        <TabsTrigger value="schedule">Today's Schedule</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {tasks.map((task) => (
            <li key={task.key}>
              <Link
                to={task.to}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.label}</p>
                  {task.detail && (
                    <p className="text-xs leading-snug text-muted-foreground">{task.detail}</p>
                  )}
                </div>
                {task.urgent && (
                  <span className="shrink-0 rounded-full border border-[hsl(var(--warning)/0.5)] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--warning))]">
                    Needs you
                  </span>
                )}
                <span className="shrink-0 text-sm font-semibold tabular-nums">{task.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="schedule">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {todaysAgenda.length} visits
            {unassigned > 0 ? ` · ${unassigned} unassigned` : " · all covered"}
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
                      entry.state === "in-progress"
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {stateLabel[entry.state]}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </TabsContent>
    </Tabs>
  );
}
