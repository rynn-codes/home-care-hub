import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { HOME_NEEDS, HOME_SCHEDULE, HOME_WAITING } from "@/lib/homeSeed";

/**
 * My Schedule · Needs Me · Waiting on Others — the mockup's working card,
 * transcribed. Rows, pills, the Now marker and the copy are the design's.
 */
type Tab = "schedule" | "needs" | "waiting";

export function DayTabs() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const openNeeds = HOME_NEEDS.filter((n) => !done[n.title]).length;

  return (
    <section className="flex flex-col rounded-[14px] border border-[#ECECF1] bg-white px-[22px] py-5">
      <div className="mb-2 flex items-center gap-3.5">
        <div className="flex gap-0.5 rounded-[10px] bg-[#F4F4F6] p-[3px]" role="tablist" aria-label="Today">
          {(
            [
              ["schedule", "My Schedule"],
              ["needs", "Needs Me"],
              ["waiting", "Waiting on Others"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "whitespace-nowrap rounded-[8px] px-3.5 py-[7px] text-[12.5px] transition-colors",
                tab === value
                  ? "bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)]"
                  : "font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/brain/my-work" className="ml-auto text-[12.5px] text-muted-foreground transition-colors hover:text-primary">
          View all →
        </Link>
      </div>

      {tab === "schedule" && (
        <div className="flex flex-col">
          {HOME_SCHEDULE.map((e) => (
            <div key={e.title}>
              {e.nowBefore && (
                <div className="flex items-center gap-3 pb-1 pt-2">
                  <span className="w-[88px] flex-none text-[12px] font-medium text-primary">Now</span>
                  <span className="h-[7px] w-[7px] flex-none rounded-full bg-primary" aria-hidden="true" />
                  <span className="h-px flex-1 bg-[#E9E9EF]" aria-hidden="true" />
                </div>
              )}
              <Link
                to={e.href}
                className="flex items-start gap-4 border-t border-[#F3F3F6] py-4 transition-colors first:border-t-0 hover:bg-[#FCFCFD]"
              >
                <span className="flex w-[88px] flex-none flex-col leading-[1.35]">
                  <span className="text-[13px] font-medium text-muted-foreground">{e.time}</span>
                  <span className="text-[11.5px] text-muted-foreground">{e.duration}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                  {/* The design dims completed rows to #9B9BA3/#B4B4BC, which
                      fails the contrast bar the axe suite holds every screen
                      to. Completed rows keep the accessible muted token and
                      take a strike-through, which reads as done without the
                      unreadable grey. */}
                  <span
                    className={cn(
                      "text-[15px] font-medium tracking-[-.01em]",
                      e.done && "text-muted-foreground line-through decoration-[#D4D4DC]",
                    )}
                  >
                    {e.title}
                  </span>
                  <span className="text-[13px] text-muted-foreground">{e.meta}</span>
                </span>
                <span
                  className={cn(
                    "flex-none self-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px]",
                    e.done ? "bg-[#F4F4F6] text-muted-foreground" : "bg-[#EFEDFB] text-primary",
                  )}
                >
                  {e.tag}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === "needs" && (
        <div className="flex flex-col">
          {openNeeds === 0 && (
            <div className="flex flex-col items-center gap-[7px] py-11 text-center">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#F1F2F6]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1407A2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.6 8.4l2.8 2.8 6-6.4" />
                </svg>
              </span>
              <span className="text-base font-medium tracking-[-.015em]">You're all caught up.</span>
              <span className="text-[13.5px] text-muted-foreground">
                Joy doesn't need any decisions from you right now.
              </span>
            </div>
          )}
          {HOME_NEEDS.map((n) => {
            const isDone = Boolean(done[n.title]);
            return (
              <div key={n.title} className="flex items-start gap-5 border-t border-[#F3F3F6] py-5 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setDone((d) => ({ ...d, [n.title]: !d[n.title] }))}
                  aria-label={isDone ? `Reopen ${n.title}` : "Mark done"}
                  className={cn(
                    "mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] transition-colors",
                    isDone ? "border-primary bg-primary" : "border-[#D4D4DC] bg-transparent",
                  )}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDone ? "opacity-100" : "opacity-0"}>
                    <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                  </svg>
                </button>
                <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                  <span className={cn("text-[15px] font-medium tracking-[-.01em]", isDone && "text-muted-foreground line-through decoration-[#D4D4DC]")}>
                    {n.title}
                  </span>
                  <span className="text-[13px] text-[#6E6E76]">{n.subject}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-2">
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
                      isDone
                        ? "bg-[#F3F3F6] text-muted-foreground"
                        : n.due === "Due today"
                          ? "bg-[#FFFAEB] text-[#B54708]"
                          : "bg-[#F3F3F6] text-[#5B6274]",
                    )}
                  >
                    {n.due}
                  </span>
                  <Link to={n.href} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {n.cta}
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "waiting" && (
        <div className="flex flex-col">
          {HOME_WAITING.map((w) => (
            <div key={w.title} className="flex items-start gap-5 border-t border-[#F3F3F6] py-5 first:border-t-0">
              <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <span className="text-[15px] font-medium tracking-[-.01em]">{w.title}</span>
                <span className="text-[13px] text-[#6E6E76]">{w.state}</span>
                <span className="text-[12.5px] text-muted-foreground">{w.next}</span>
              </span>
              <Link to={w.href} className="flex-none self-center text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                {w.cta}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
