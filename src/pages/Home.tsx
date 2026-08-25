import { useState } from "react";
import { Mic, ArrowUp, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useDemo } from "@/context/DemoDataProvider";
import { MorningBriefCard } from "@/components/home/MorningBriefCard";
import { DayTabs } from "@/components/home/DayTabs";
import { JoyAssistantColumn } from "@/components/home/JoyAssistantColumn";
import { HOME_ASK_CHIPS, HOME_STATS } from "@/lib/homeSeed";
import { weekBadge } from "@/domain/calendar/agencyWeek";
import { todaysWeather } from "@/lib/weatherSeed";

/**
 * Home — the operator's morning, built to Karynn's own screenshot of the
 * current design (24 August).
 *
 * The history is worth keeping, because it cost a round of rework: the handoff
 * README and THE_BRAIN.md both say The Brain "replaces" the Command Center and
 * Brief Band explorations, so Home was first built as The Brain and then as the
 * Brief Band variant. Neither was right. The live canvas has moved past both
 * documents — its nav carries Home, My Work AND The Brain as three separate
 * screens, and Home is this: a written Morning Brief, the day in three tabs,
 * and Joy's own work down the right-hand side. Karynn sent the screenshot; this
 * is built from it.
 *
 * It shares its data with The Brain rather than keeping its own, so the two
 * screens cannot drift apart: same events, same decisions, same Joy queues.
 */
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
};

export default function Home() {
  const { currentUser } = useDemo();
  const [q, setQ] = useState("");
  const now = new Date();
  // `allowEmpty` is what the Talk to Joy heading uses: opening Joy with nothing
  // typed is a legitimate thing to want, and the Command Center starts a fresh
  // thread when it receives no question. The send arrow still refuses a blank,
  // because pressing send on an empty box means nothing.
  const ask = (question: string, opts?: { allowEmpty?: boolean }) => {
    const text = question.trim();
    if (!text && !opts?.allowEmpty) return;
    document.dispatchEvent(new CustomEvent("joy:ask", { detail: { question: text } }));
    setQ("");
  };

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      {/* The thin context strip: where and when you are. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        <span className="font-medium text-foreground">
          {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </span>
        <span>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        <span className="flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-[#F79009]" aria-hidden="true" />
          {todaysWeather.high}°F
        </span>
        <span>Houston, TX</span>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-bold leading-[1.15] tracking-[-.03em]">
          Good {greeting()},{" "}
          {/* Flat primary, not a gradient. THE_BRAIN.md §2: the gradient H1 is
              The Brain's alone — "the only gradient in the entire product. Do
              not repeat the treatment elsewhere." */}
          <span className="text-primary">{currentUser.name.split(" ")[0]}.</span>{" "}
          <span aria-hidden="true">👋</span>
        </h1>
        <p className="m-0 text-[13px] text-muted-foreground">{weekBadge(new Date().toISOString())}</p>
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <MorningBriefCard />
          <DayTabs />
        </div>

        <div className="flex flex-col gap-[18px]">
          {/* Talk to Joy — the conversational door. A question here opens the
              full Command Center with it as the thread's first message. */}
          <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white px-5 py-[18px]">
            {/* Karynn, 25 August: "Talk to Joy icon doesn't work." It didn't —
                the disc and its breathing dot were decoration, so the one thing
                on the card that looks most like a button was the one thing that
                wasn't. The heading and the mark are now a single button that
                opens Joy with no question, the same as clicking the pill. */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => ask("", { allowEmpty: true })}
                className="-mx-1 -my-0.5 flex items-center gap-2 self-start rounded-lg px-1 py-0.5 text-[13.5px] font-semibold tracking-[-.01em] transition-colors hover:bg-[#FAFAFB]"
              >
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#191A2E]">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#8FA0FF]"
                    style={{ animation: "joyGlow 2.6s ease-in-out infinite" }}
                  />
                </span>
                Talk to Joy
              </button>
              <span className="text-[12px] text-muted-foreground">
                Your assistant for smarter, faster decisions.
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-[11px] border border-[#ECECF1] bg-white py-1.5 pl-3 pr-1.5">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(q)}
                placeholder="What would you like help with today?"
                aria-label="Ask Joy"
                className="min-w-0 flex-1 border-none bg-transparent py-1 text-[12.5px] outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                disabled
                title="Voice input needs a microphone permission the prototype doesn't ask for"
                aria-label="Voice input (not available in the prototype)"
                className="flex h-7 w-7 flex-none cursor-not-allowed items-center justify-center rounded-full text-muted-foreground/40"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => ask(q)}
                aria-label="Send"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-[#2A1BD1]"
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col items-start gap-1.5">
              {HOME_ASK_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => ask(c)}
                  className="rounded-[20px] border border-[#1407A2]/[.16] bg-white px-3 py-1.5 text-left text-[12px] text-primary transition-colors hover:bg-[#FAFAFB]"
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          <JoyAssistantColumn />
        </div>
      </div>

      {/* The three figures that close the screen. Each is a link into the
          screen that owns the number — a count you cannot act on is decoration. */}
      <div className="grid gap-[18px] sm:grid-cols-3">
        {HOME_STATS.map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="flex flex-col gap-2 rounded-[14px] border border-[#ECECF1] bg-white px-5 py-[18px] transition-colors hover:border-[#DDE0F8]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
              {s.label}
            </span>
            <span className="text-[32px] font-semibold leading-none tracking-[-.02em] text-[#1B1B1F]">
              {s.value}
            </span>
            <span className="text-[12.5px] text-muted-foreground">{s.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
