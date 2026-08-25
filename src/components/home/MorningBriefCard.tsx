import { Sparkles } from "lucide-react";
import { HOME_BRIEF } from "@/lib/homeSeed";
import { weatherAdvisory } from "@/domain/home/weather";
import { seedForecast } from "@/lib/weatherSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { cn } from "@/lib/utils";

/**
 * The Morning Brief, to the spec's own colours.
 *
 * THE_BRAIN.md §3.1 fixes the body at #3A3A42 — a warm near-ink, not the
 * lighter #5B6274 body token, because this paragraph is the screen's lead and
 * has to hold its weight against the verdict line above it.
 *
 * The amber here is governed by the README's semantic rule: "amber = a human
 * still owes something." Two earlier uses broke it and are corrected:
 *
 *  - "Nothing else needs your attention this morning" says the opposite of
 *    something being owed. Amber made a reassurance read as a warning. It sits
 *    at the muted supporting-text token now.
 *  - A colleague's birthday owes nobody anything. The coming-up card is a
 *    neutral tinted panel, and the People violet (#7C3AED — the category
 *    colour The Brain's What's Going On uses) marks what kind of event it is.
 *
 * Amber is left free to mean what it is supposed to mean when this brief has
 * something outstanding to report.
 */
/** How many visits fall on each date, counted once off the schedule seed. */
const visitsByDate = seedVisits.reduce((m, v) => {
  const day = v.startsAt.slice(0, 10);
  return m.set(day, (m.get(day) ?? 0) + 1);
}, new Map<string, number>());

export function MorningBriefCard() {
  // Weather earns a line only when there is weather worth acting on. A clear
  // week produces nothing and the brief stays short.
  const today = new Date().toISOString().slice(0, 10);
  const weather = weatherAdvisory({
    forecast: seedForecast,
    today,
    // Counted off the real visit board, not the brief's own list: the sentence
    // says "7 visits are scheduled across those days", and a number in a brief
    // has to be a number somebody can go and check.
    visitsOn: (date) => visitsByDate.get(date) ?? 0,
  });

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white px-[22px] py-5">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Morning Brief
      </span>

      <p className="m-0 text-[17px] font-medium tracking-[-.015em] text-[#1B1B1F]">
        {HOME_BRIEF.headline}
      </p>

      <p className="m-0 max-w-[800px] text-[15px] leading-[1.75] text-[#3A3A42] [text-wrap:pretty]">
        {HOME_BRIEF.paragraph}
      </p>

      {/* Karynn, 25 August: "the weather box under the Coming up tomorrow box —
          I feel that that should all be together instead of just throwing the
          weather in the mix." Right: they were two loose cards stacked, and a
          stack of cards reads as a list of unrelated alarms. They are the same
          kind of thing — what is coming that you have not been told about — so
          they are one bordered block with one heading and a hairline between
          the rows. When there is no weather, the block is just the birthday and
          looks like it was always meant to hold one thing. */}
      <div className="flex flex-col rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD]">
        <span className="px-3.5 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
          Heads up
        </span>

        {weather && (
          <div
            className={cn(
              "flex items-center gap-3 border-t border-[#ECECF1] px-3.5 py-3",
              // Amber is legitimate here and only here: a storm is something
              // the office still owes an answer to — who drives, and does a
              // visit move. Heavy rain without a storm stays neutral.
              weather.severity === "warn" && "bg-[#FFFCF5]",
            )}
          >
            {/* Karynn asked whether this matched the birthday card's icon. It
                did not: that one is an emoji at 16px, this was a Lucide line
                icon at 14px in a tinted colour — two icon families three lines
                apart in one card. Same treatment now. */}
            <span className="text-base leading-none" aria-hidden="true">
              {weather.severity === "warn" ? "\u26C8\uFE0F" : "\uD83C\uDF27\uFE0F"}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 leading-[1.5]">
              <span className={cn("text-[13px]", weather.severity === "warn" ? "text-[#8A6220]" : "text-[#3A3A42]")}>
                {weather.line}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                Forecast is seeded — no weather provider is connected yet.
              </span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-[#ECECF1] px-3.5 py-3">
          <span className="text-base leading-none" aria-hidden="true">{HOME_BRIEF.comingUp.icon}</span>
          <span className="flex min-w-0 flex-col leading-[1.4]">
            <span className="text-[13px] font-medium text-[#1B1B1F]">{HOME_BRIEF.comingUp.title}</span>
            <span className="text-[12px] text-[#7C3AED]">{HOME_BRIEF.comingUp.when} · People</span>
          </span>
        </div>
      </div>

      <p className="m-0 text-[13px] text-muted-foreground">{HOME_BRIEF.allClear}</p>
    </section>
  );
}
