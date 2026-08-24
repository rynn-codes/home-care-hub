import { Sparkles } from "lucide-react";
import { HOME_BRIEF } from "@/lib/homeSeed";

/**
 * The Morning Brief, transcribed from Karynn's mockup: eyebrow, one judgement
 * sentence, the paragraph, the coming-up card, and the all-clear line.
 *
 * A written brief, not a stat wall — CLAUDE.md's rule for this screen, and the
 * reason there is not a number in sight here.
 */
export function MorningBriefCard() {
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[#ECECF1] bg-white px-[22px] py-5">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Morning Brief
      </span>

      <p className="m-0 text-[17px] font-medium tracking-[-.015em]">{HOME_BRIEF.headline}</p>

      <p className="m-0 max-w-[660px] text-[14px] leading-[1.7] text-[#5B6274] [text-wrap:pretty]">
        {HOME_BRIEF.paragraph}
      </p>

      <div className="flex items-center gap-3 rounded-[11px] border border-[#FCE8B6] bg-[#FFFCF5] px-3.5 py-3">
        <span className="text-base leading-none" aria-hidden="true">{HOME_BRIEF.comingUp.icon}</span>
        <span className="flex flex-col leading-[1.4]">
          <span className="text-[13px] font-medium">{HOME_BRIEF.comingUp.title}</span>
          <span className="text-[12px] text-muted-foreground">{HOME_BRIEF.comingUp.when}</span>
        </span>
      </div>

      <p className="m-0 text-[13px] text-[#B54708]">{HOME_BRIEF.allClear}</p>
    </section>
  );
}
