import { Link } from "react-router-dom";
import { useDemo } from "@/context/DemoDataProvider";
import { MorningBriefCard } from "@/components/home/MorningBriefCard";
import { DayTabs } from "@/components/home/DayTabs";
import { JoyAssistantColumn } from "@/components/home/JoyAssistantColumn";
import { useMonitors } from "@/components/brain/useMonitors";
import { PageTitle, PlainSpan } from "@/components/layout/PageTitle";
import { HOME_STATS } from "@/lib/homeSeed";
import { weekBadge } from "@/domain/calendar/agencyWeek";
import { useNow } from "@/hooks/use-now";

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
 * The date, time and weather that used to open this screen now live in the
 * header, where every screen shares them. Talk to Joy is the Ask Joy pill,
 * which follows the user everywhere; a second box for the same conversation
 * on one screen was one box too many.
 */
export function partOfDay(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export default function Home() {
  const { currentUser } = useDemo();
  const { findings } = useMonitors();
  const now = useNow(60_000);
  const firstName = currentUser.name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <PageTitle>
          Good {partOfDay(now)}
          {firstName ? `, ${firstName}` : ""}. <PlainSpan>👋</PlainSpan>
        </PageTitle>
        <p className="m-0 text-[13px] text-muted-foreground">{weekBadge(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-[18px] sm:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <MorningBriefCard findings={findings} />
          <DayTabs />
          {/* The three figures that close the column. Each is a link into the
              screen that owns the number — a count you cannot act on is
              decoration. */}
          <div className="grid gap-[18px] sm:grid-cols-3">
            {HOME_STATS.map((s) => (
              <Link
                key={s.label}
                to={s.href}
                className="flex flex-col gap-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] px-5 py-[18px] transition-colors hover:border-[#DDE0F8]"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{s.label}</span>
                <span className="text-[32px] font-semibold leading-none tracking-[-.02em] text-[var(--ink)]">{s.value}</span>
                <span className="text-[12.5px] text-muted-foreground">{s.sub}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <JoyAssistantColumn />
        </div>
      </div>
    </div>
  );
}
