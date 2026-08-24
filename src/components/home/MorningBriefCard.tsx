import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { morningBrief } from "@/domain/home/brief";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { todaysAgenda } from "@/lib/joySeed";
import { brainEvents, brainWaiting, brainWorking } from "@/lib/brainSeed";

/**
 * The Morning Brief, to Karynn's Home design: an eyebrow, one judgement
 * sentence, a short paragraph, the one thing coming up next in its own tinted
 * card, and a closing line that says whether anything else is waiting.
 *
 * Every sentence is computed from the module signals, so the brief cannot say
 * something a screen would contradict. The design's copy ("Operations are in
 * good shape", "Nothing else needs your attention this morning") is the
 * all-clear wording; when something IS wrong the same slots say so instead.
 */
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric" });

export function MorningBriefCard() {
  const signals = useHomeSignals();
  const urgent = signals.filter((s) => s.urgent);

  const paragraph = useMemo(() => {
    const today = new Date().toISOString();
    const base = morningBrief({
      visitsToday: todaysAgenda.length,
      unassignedToday: todaysAgenda.filter((e) => e.state === "unassigned").length,
      signals,
      upcomingBillingWeek: upcomingBillingWeek(today),
      today,
    });
    return `${base} Joy is carrying ${brainWorking.length} items forward and waiting on ${brainWaiting.length} outside parties.`;
  }, [signals]);

  // The next thing on the diary after today — the design's "Coming up
  // tomorrow" card. It names the soonest event, whenever that is.
  const today = new Date().toISOString().slice(0, 10);
  const next = brainEvents
    .filter((e) => e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white px-[22px] py-5">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Morning Brief
      </span>

      <p className="m-0 text-[17px] font-medium tracking-[-.015em]">
        {urgent.length === 0
          ? "Operations are in good shape."
          : `${urgent.length} ${urgent.length === 1 ? "thing needs" : "things need"} your attention.`}
      </p>

      <p className="m-0 max-w-[640px] text-[14px] leading-[1.7] text-[#8A6220] [text-wrap:pretty]">
        {paragraph}
      </p>

      {next && (
        <div className="flex items-center gap-3 rounded-[11px] border border-[#FCE8B6] bg-[#FFFCF5] px-3.5 py-2.5">
          <span className="text-base leading-none" aria-hidden="true">{next.icon}</span>
          <span className="flex flex-col leading-[1.35]">
            <span className="text-[13px] font-medium">Coming up — {next.title}</span>
            <span className="text-[12px] text-muted-foreground">{shortDate(next.date)}</span>
          </span>
        </div>
      )}

      {urgent.length === 0 ? (
        <p className="m-0 text-[13px] text-[#B54708]">Nothing else needs your attention this morning.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {urgent.slice(0, 3).map((s) => (
            <Link key={s.key} to={s.to} className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
              {s.label} — {s.detail ?? s.value} →
            </Link>
          ))}
          {urgent.length > 3 && (
            <Link to="/brain" className="text-[12.5px] text-muted-foreground hover:text-foreground">
              and {urgent.length - 3} more →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
