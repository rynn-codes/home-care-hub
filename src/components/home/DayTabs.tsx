import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, CornerUpRight, Upload, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_NEEDS, HOME_NEEDS_FOOTNOTE, HOME_SCHEDULE, HOME_WAITING } from "@/lib/homeSeed";
import { Confetti } from "@/components/home/Confetti";

/**
 * My Schedule · Needs Me · Waiting on Others — the mockup's working card,
 * transcribed. Rows, pills, the Now marker and the copy are the design's.
 */
type Tab = "schedule" | "needs" | "waiting";

/** The tinted disc icons on Waiting on Others, as the mockup draws them. */
const WAITING_ICON = {
  check: ClipboardCheck,
  share: CornerUpRight,
  upload: Upload,
  user: User,
} as const;

export function DayTabs() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [celebrating, setCelebrating] = useState(false);
  const openNeeds = HOME_NEEDS.filter((n) => !done[n.title]).length;
  const cleared = HOME_NEEDS.length - openNeeds;
  const allClear = cleared === HOME_NEEDS.length;

  // Fire the burst on the transition into "all cleared", not on every render
  // that happens to be clear — reopening and re-clearing an item earns it again,
  // but simply sitting on a finished list does not.
  const wasClear = useRef(allClear);
  useEffect(() => {
    if (allClear && !wasClear.current) setCelebrating(true);
    wasClear.current = allClear;
  }, [allClear]);

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
                      // Same weight of mark as a cleared Needs-Me row: the
                      // body-text ink, not a hairline grey that reads as a
                      // rendering artefact.
                      e.done && "text-muted-foreground line-through decoration-[#5B6274] decoration-[1.5px]",
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
        <div className="relative flex flex-col">
          {celebrating && <Confetti onDone={() => setCelebrating(false)} />}

          {/* Progress under the tabs: how much of today's judgement is done. */}
          <div className="mb-1 pt-1">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-[#F1F2F6]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={HOME_NEEDS.length}
              aria-valuenow={cleared}
              aria-label="Needs Me progress"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
                  allClear ? "bg-[#12B76A]" : "bg-primary",
                )}
                style={{ width: `${(cleared / HOME_NEEDS.length) * 100}%` }}
              />
            </div>
          </div>

          {HOME_NEEDS.map((n) => {
            const isDone = Boolean(done[n.title]);
            return (
              <div key={n.title} className="flex items-center gap-4 border-t border-[#F3F3F6] py-4">
                <button
                  type="button"
                  onClick={() => setDone((d) => ({ ...d, [n.title]: !d[n.title] }))}
                  aria-label={isDone ? `Reopen ${n.title}` : "Mark done"}
                  aria-pressed={isDone}
                  className={cn(
                    "flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] transition-colors duration-200",
                    isDone ? "border-primary bg-primary" : "border-[#D4D4DC] bg-transparent hover:border-[#A9A9B4]",
                  )}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("transition-opacity duration-200", isDone ? "opacity-100" : "opacity-0")}
                  >
                    <path d="M2.4 6.2l2.4 2.4 4.8-5.2" />
                  </svg>
                </button>

                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className={cn("text-[14px] font-medium tracking-[-.01em]", isDone && "text-muted-foreground")}>
                    {/* The line is drawn across the words rather than switched
                        on — see .strike in index.css. */}
                    {isDone ? <span className="strike">{n.title}</span> : n.title}
                  </span>
                  <span className={cn("text-[12.5px]", isDone ? "text-muted-foreground/70" : "text-muted-foreground")}>
                    {n.subject}
                  </span>
                </span>

                <span
                  className={cn(
                    "flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    isDone ? "bg-[#F4F4F6] text-muted-foreground/70" : "bg-[#F1F2F6] text-[#5B6274]",
                  )}
                >
                  {n.pill}
                </span>

                {isDone ? (
                  <span className="flex-none text-[12.5px] text-muted-foreground/60">{n.cta}</span>
                ) : (
                  <Link to={n.href} className="flex-none text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    {n.cta}
                  </Link>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-3 border-t border-[#F3F3F6] pt-3">
            <span className="flex-none whitespace-nowrap text-[12px] text-muted-foreground tabular-nums">
              {cleared} of {HOME_NEEDS.length} cleared
            </span>
            <span className={cn("ml-auto text-[12px]", allClear ? "text-[#027A48]" : "text-muted-foreground")}>
              {allClear ? "You're all caught up. " : ""}
              {HOME_NEEDS_FOOTNOTE}
            </span>
          </div>
        </div>
      )}

      {tab === "waiting" && (
        <div className="flex flex-col">
          {HOME_WAITING.map((w) => {
            const Icon = WAITING_ICON[w.icon];
            return (
              <Link
                key={w.title}
                to={w.href}
                className="flex items-center gap-3.5 border-t border-[#F3F3F6] py-3.5 transition-colors first:border-t-0 hover:bg-[#FCFCFD]"
              >
                <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-[10px]", w.tint[0])}>
                  <Icon className={cn("h-[17px] w-[17px]", w.tint[1])} aria-hidden="true" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-[14px] font-medium tracking-[-.01em]">{w.title}</span>
                  <span className="text-[12.5px] text-muted-foreground">{w.sub}</span>
                </span>
                <span className="flex-none whitespace-nowrap rounded-full bg-[#F1F2F6] px-2.5 py-1 text-[11px] font-medium text-[#5B6274]">
                  {w.pill}
                </span>
              </Link>
            );
          })}
        </div>
      )}

    </section>
  );
}
