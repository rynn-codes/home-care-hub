import { Sparkles } from "lucide-react";
import { HOME_BRIEF } from "@/lib/homeSeed";

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
export function MorningBriefCard() {
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

      <div className="flex items-center gap-3 rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD] px-3.5 py-3">
        <span className="text-base leading-none" aria-hidden="true">{HOME_BRIEF.comingUp.icon}</span>
        <span className="flex min-w-0 flex-col leading-[1.4]">
          <span className="text-[13px] font-medium text-[#1B1B1F]">{HOME_BRIEF.comingUp.title}</span>
          <span className="text-[12px] text-[#7C3AED]">{HOME_BRIEF.comingUp.when} · People</span>
        </span>
      </div>

      <p className="m-0 text-[13px] text-muted-foreground">{HOME_BRIEF.allClear}</p>
    </section>
  );
}
