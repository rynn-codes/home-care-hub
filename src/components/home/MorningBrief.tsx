import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { morningBrief } from "@/domain/home/brief";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { todaysAgenda } from "@/lib/joySeed";

/**
 * The Morning Brief — the mock's opening move. Two or three plain sentences,
 * every one computed from the same signals the modules own, so the brief can
 * never say something a screen would contradict.
 */
export function MorningBrief() {
  const signals = useHomeSignals();

  const brief = useMemo(() => {
    const today = new Date().toISOString();
    return morningBrief({
      visitsToday: todaysAgenda.length,
      unassignedToday: todaysAgenda.filter((e) => e.state === "unassigned").length,
      signals,
      upcomingBillingWeek: upcomingBillingWeek(today),
      today,
    });
  }, [signals]);

  return (
    <section aria-label="Morning brief" className="mb-6 border-l-2 border-primary/30 pl-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Morning Brief
      </p>
      <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-foreground">{brief}</p>
    </section>
  );
}
