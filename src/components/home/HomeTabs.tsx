import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { myTasks, TASKS_DONE_OFFSET, TASKS_TOTAL, todaysAgenda } from "@/lib/joySeed";
import { cn } from "@/lib/utils";

/**
 * My Tasks | Today's Schedule — the mock's working area, to its own values:
 * the pill tab switch (#F4F4F6 track, white active with a whisper of shadow),
 * checkbox task rows that strike through as they're ticked, the progress
 * footer, and the schedule as a timeline with a Now marker — past visits
 * greyed, the unassigned one carrying the red dot and a Fill shift link.
 */
export function HomeTabs() {
  const [tab, setTab] = useState<"tasks" | "schedule">("tasks");
  const [done, setDone] = useState<Record<string, boolean>>({});

  const doneCount = myTasks.filter((t) => done[t.id]).length + TASKS_DONE_OFFSET;
  const pct = Math.round((doneCount / TASKS_TOTAL) * 100);

  // Timeline position: entries before now render as completed, greyed.
  const nowLabel = useMemo(() => {
    const h = new Date().getHours();
    return (index: number, total: number) => Math.floor((h / 24) * total) === index;
  }, []);
  const hourOf = (time: string) => {
    const [clock, meridiem] = time.split(" ");
    let h = Number(clock.split(":")[0]);
    if (meridiem === "PM" && h !== 12) h += 12;
    if (meridiem === "AM" && h === 12) h = 0;
    return h;
  };
  const currentHour = new Date().getHours();
  const unassigned = todaysAgenda.filter((e) => e.state === "unassigned").length;

  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3.5">
        <div className="flex gap-0.5 rounded-[9px] bg-[#F4F4F6] p-[3px]" role="tablist" aria-label="Home views">
          {(
            [
              ["tasks", "My Tasks"],
              ["schedule", "Today's Schedule"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[12.5px] transition-colors",
                tab === value
                  ? "bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          to={tab === "tasks" ? "/operations" : "/scheduling"}
          className="ml-auto text-[12.5px] font-normal text-muted-foreground transition-colors hover:text-primary"
        >
          View all
        </Link>
      </div>

      {tab === "tasks" && (
        <div>
          {myTasks.map((task) => {
            const isDone = Boolean(done[task.id]);
            return (
              <div key={task.id} className="flex items-center gap-4 border-t border-black/[.05] py-4">
                <button
                  type="button"
                  aria-label={`Mark "${task.title}" ${isDone ? "not done" : "done"}`}
                  onClick={() => setDone((d) => ({ ...d, [task.id]: !d[task.id] }))}
                  className={cn(
                    "flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] border-[1.4px] transition-colors",
                    isDone ? "border-primary bg-primary" : "border-[#C8C8D0] bg-transparent",
                  )}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn("transition-opacity", isDone ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  >
                    <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                  </svg>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span
                    className={cn(
                      "text-sm font-medium tracking-[-.01em] transition-colors",
                      isDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className={cn("text-xs font-light text-muted-foreground", isDone && "text-muted-foreground/60")}>
                    {task.category}
                  </span>
                </div>
                <span className={cn("flex-none text-xs font-normal text-muted-foreground", isDone && "text-muted-foreground/60")}>
                  {task.tag}
                </span>
                <span className={cn("w-[64px] flex-none whitespace-nowrap text-right text-[12.5px] text-muted-foreground", isDone && "text-muted-foreground/60")}>
                  {task.time}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-4 border-t border-black/[.05] py-4">
            <span className="text-[12.5px] font-light text-muted-foreground">{TASKS_TOTAL} tasks</span>
            <div className="h-[3px] max-w-[280px] flex-1 overflow-hidden rounded-[3px] bg-[#F0F0F2]">
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <span className="ml-auto text-[12.5px] font-normal text-muted-foreground">{pct}% complete</span>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div>
          <p className="mb-1.5 mt-0 text-[12.5px] font-light text-muted-foreground">
            {todaysAgenda.length} visits{unassigned > 0 ? ` · ${unassigned} unassigned` : " · all covered"}
          </p>
          {todaysAgenda.map((entry, i) => {
            const past = hourOf(entry.time) < currentHour && entry.state !== "unassigned";
            const showNow =
              i > 0 &&
              hourOf(todaysAgenda[i - 1].time) < currentHour &&
              hourOf(entry.time) >= currentHour;
            return (
              <div key={entry.id}>
                {showNow && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="w-[78px] flex-none text-[11.5px] font-medium text-primary">Now</span>
                    <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
                    <span className="h-px flex-1 bg-primary/[.22]" aria-hidden="true" />
                  </div>
                )}
                <div className="flex gap-6 border-t border-black/[.05] py-5">
                  <div className={cn("w-[78px] flex-none pt-0.5 text-[13px] font-normal", past ? "text-muted-foreground/50" : "text-muted-foreground")}>
                    {entry.time}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className={cn("text-[14.5px] font-medium tracking-[-.01em]", past && "text-muted-foreground/60")}>
                      {entry.client} · {entry.service}
                    </span>
                    <span className={cn("flex items-center gap-[7px] text-[12.5px] font-light text-muted-foreground", past && "text-muted-foreground/60")}>
                      {entry.state === "unassigned" && (
                        <span className="h-[5px] w-[5px] flex-none rounded-full bg-[#B91C1C]" aria-hidden="true" />
                      )}
                      {entry.assignee}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </span>
                  </div>
                  {entry.state === "unassigned" ? (
                    <Link to="/scheduling" className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                      Fill shift
                    </Link>
                  ) : (
                    <span className={cn("flex flex-none items-center gap-[7px] self-center text-[12.5px]", past ? "text-muted-foreground/50" : "text-muted-foreground")}>
                      <span className={cn("h-[5px] w-[5px] rounded-full", past ? "bg-[#D4D4DC]" : "bg-muted-foreground/50")} aria-hidden="true" />
                      {past ? "Completed" : entry.state === "in-progress" ? "In progress" : "Scheduled"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
