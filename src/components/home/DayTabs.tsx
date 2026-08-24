import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { myEvents, myNeeds, brainWaiting } from "@/lib/brainSeed";

/**
 * My Schedule | Needs Me | Waiting on Others — the design's working card.
 *
 * The same three groups The Brain's My Work tab carries, reading the same
 * seed, so Home and The Brain can never disagree about the day. The "Now"
 * marker sits between the last past entry and the next one, as the design
 * draws it.
 */
type Tab = "schedule" | "needs" | "waiting";

const nowHour = () => new Date().getHours();
const hourOf = (time: string) => {
  const m = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h + Number(m[2]) / 60;
};

export function DayTabs() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [done, setDone] = useState<Record<string, boolean>>({});

  const openNeeds = myNeeds.filter((n) => !done[n.title]).length;
  // Where the Now line falls in today's list.
  const nowAt = myEvents.findIndex((e) => hourOf(e.time) > nowHour());

  return (
    <section className="flex flex-col rounded-[14px] border border-[#ECECF1] bg-white px-[22px] py-5">
      <div className="mb-3.5 flex items-center gap-3.5">
        <div className="flex gap-0.5 rounded-[9px] bg-[#F4F4F6] p-[3px]" role="tablist" aria-label="Today">
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
                "whitespace-nowrap rounded-[7px] px-3.5 py-1.5 text-[12.5px] transition-colors",
                tab === value
                  ? "bg-white font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {value === "needs" && openNeeds > 0 && (
                <span className="ml-1.5 text-[11px] text-[#C2410C]">{openNeeds}</span>
              )}
            </button>
          ))}
        </div>
        <Link to="/brain" className="ml-auto text-[12.5px] text-muted-foreground transition-colors hover:text-primary">
          View all →
        </Link>
      </div>

      {tab === "schedule" && (
        <div className="flex flex-col">
          {myEvents.map((e, i) => (
            <div key={e.title}>
              {i === nowAt && (
                <div className="flex items-center gap-3 py-1.5">
                  <span className="w-[86px] flex-none text-[11.5px] font-medium text-primary">Now</span>
                  <span className="h-[7px] w-[7px] flex-none rounded-full bg-primary" aria-hidden="true" />
                  <span className="h-px flex-1 bg-[#E4E4EA]" aria-hidden="true" />
                </div>
              )}
              <div className="flex items-start gap-4 border-t border-[#F3F3F6] py-3.5 first:border-t-0">
                {/* The design dims completed rows to #C8C8D0 / #B4B4BC, which
                    fails the 4.5:1 bar the axe suite holds every screen to. The
                    same recorded substitution as elsewhere: completed text sits
                    at the accessible muted token, and the strike-through of the
                    tag pill carries the "done" reading instead of pale grey. */}
                <span className="flex w-[86px] flex-none flex-col leading-[1.3]">
                  <span className="text-[13px] font-medium text-muted-foreground">{e.time}</span>
                  <span className="text-[11.5px] text-muted-foreground">{e.duration}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span
                    className={cn(
                      "text-[14px] font-medium tracking-[-.01em]",
                      e.done && "text-muted-foreground line-through decoration-[#D4D4DC]",
                    )}
                  >
                    {e.title}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {e.meta} · {e.joyNote}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex-none self-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px]",
                    e.done ? "bg-[#F4F4F6] text-muted-foreground" : "bg-[#EFEDFB] text-primary",
                  )}
                >
                  {e.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "needs" && (
        <div className="flex flex-col">
          {openNeeds === 0 && (
            <p className="m-0 py-8 text-center text-[13.5px] text-muted-foreground">
              You're all caught up. Joy doesn't need any decisions from you right now.
            </p>
          )}
          {myNeeds.map((n) => {
            const isDone = Boolean(done[n.title]);
            return (
              <div key={n.title} className="flex items-start gap-4 border-t border-[#F3F3F6] py-4 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setDone((d) => ({ ...d, [n.title]: !d[n.title] }))}
                  aria-label={isDone ? `Reopen ${n.title}` : `Mark ${n.title} done`}
                  className={cn(
                    "mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.4px] transition-colors",
                    isDone ? "border-primary bg-primary" : "border-[#C8C8D0]",
                  )}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDone ? "opacity-100" : "opacity-0"}>
                    <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                  </svg>
                </button>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className={cn("text-[14px] font-medium tracking-[-.01em]", isDone && "text-muted-foreground/60 line-through decoration-[#C8C8D0]")}>
                    {n.title}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">{n.subject}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1.5">
                  <span className={cn("text-[11.5px]", isDone ? "text-muted-foreground/50" : "text-[#C2410C]")}>{n.due}</span>
                  <Link to={n.href} className="text-[12px] font-medium text-primary hover:text-[#2A1BD1]">
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
          {brainWaiting.map((w) => (
            <div key={w.title} className="flex items-start gap-4 border-t border-[#F3F3F6] py-4 first:border-t-0">
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[14px] font-medium tracking-[-.01em]">{w.title}</span>
                <span className="text-[12.5px] text-[#6E6E76]">{w.state}</span>
                <span className="text-[12px] text-muted-foreground">{w.next}</span>
              </span>
              <Link to={w.href} className="flex-none self-center text-[12px] font-medium text-primary hover:text-[#2A1BD1]">
                {w.cta} →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
