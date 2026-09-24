import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { HOME_BRIEF } from "@/lib/homeSeed";
import { weatherAdvisory } from "@/domain/home/weather";
import { seedForecast } from "@/lib/weatherSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { holidaySentence, usHolidayOn } from "@/domain/calendar/usHolidays";
import { findingsHeadline, type Finding } from "@/domain/monitors";
import { subjectHref, subjectLabel } from "@/domain/brain/subjects";
import { cn } from "@/lib/utils";

/**
 * The Morning Brief.
 *
 * The headline is what the monitors found this morning — "23 things need
 * fixing today" — and falls back to the standing "Operations are in good
 * shape." only when they found nothing. The paragraph is the day's narrative;
 * on a holiday it opens by saying so.
 *
 * The amber here is governed by the README's semantic rule: "amber = a human
 * still owes something." A storm is something the office still owes an answer
 * to — who drives, and does a visit move — so it earns the tint. A colleague's
 * birthday owes nobody anything and sits in the People violet.
 */
/** How many visits fall on each date, counted once off the schedule seed. */
const visitsByDate = seedVisits.reduce((m, v) => {
  const day = v.startsAt.slice(0, 10);
  return m.set(day, (m.get(day) ?? 0) + 1);
}, new Map<string, number>());

export function MorningBriefCard({ findings = [] }: { findings?: Finding[] }) {
  const headline = findingsHeadline(findings) ?? HOME_BRIEF.headline;
  const quiet = findings.length === 0;
  const today = new Date().toISOString().slice(0, 10);
  const holiday = usHolidayOn(today);
  const weather = weatherAdvisory({
    forecast: seedForecast,
    today,
    // Counted off the real visit board, not the brief's own list: the sentence
    // says "7 visits are scheduled across those days", and a number in a brief
    // has to be a number somebody can go and check.
    visitsOn: (date) => visitsByDate.get(date) ?? 0,
  });

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-[22px] py-5">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Morning Brief
      </span>

      <p className="m-0 text-[17px] font-medium tracking-[-.015em] text-[var(--ink)]">{headline}</p>

      <p className="m-0 max-w-[800px] text-[15px] leading-[1.75] text-[var(--ink-soft)] [text-wrap:pretty]">
        {holiday ? `${holidaySentence(holiday)} ` : ""}
        {HOME_BRIEF.paragraph}
      </p>

      {/* Karynn, 25 August: "the weather box under the Coming up tomorrow box —
          I feel that that should all be together instead of just throwing the
          weather in the mix." They are the same kind of thing — what is coming
          that you have not been told about — so they are one bordered block
          with one heading and a hairline between the rows. */}
      <div className="flex flex-col rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)]">
        <span className="px-3.5 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
          Heads up
        </span>

        {weather && (
          <div
            className={cn(
              "flex items-center gap-3 border-t border-[var(--hairline)] px-3.5 py-3",
              weather.severity === "warn" && "bg-[#FFFCF5]",
            )}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {weather.severity === "warn" ? "⛈️" : "🌧️"}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 leading-[1.5]">
              <span className={cn("text-[13px]", weather.severity === "warn" ? "text-[#8A6220]" : "text-[var(--ink-soft)]")}>
                {weather.line}
              </span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-[var(--hairline)] px-3.5 py-3">
          <span className="text-base leading-none" aria-hidden="true">{HOME_BRIEF.comingUp.icon}</span>
          <span className="flex min-w-0 flex-col leading-[1.4]">
            <span className="text-[13px] font-medium text-[var(--ink)]">{HOME_BRIEF.comingUp.title}</span>
            <Link to={subjectHref(HOME_BRIEF.comingUp.subject)} className="text-[12px] text-[#7C3AED] hover:underline">
              {HOME_BRIEF.comingUp.when} · {subjectLabel(HOME_BRIEF.comingUp.subject)}
            </Link>
          </span>
        </div>
      </div>

      {quiet ? (
        <p className="m-0 text-[13px] text-muted-foreground">{HOME_BRIEF.allClear}</p>
      ) : (
        <Link to="/brain" className="m-0 self-start text-[13px] font-medium text-primary transition-colors hover:text-[#2A1BD1]">
          Joy has {findings.length} {findings.length === 1 ? "thing" : "things"} for you in The Brain →
        </Link>
      )}
    </section>
  );
}
