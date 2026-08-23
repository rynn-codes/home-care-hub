import { GreetingBand } from "@/components/home/GreetingBand";
import { MorningBrief } from "@/components/home/MorningBrief";
import { StatBand } from "@/components/home/StatBand";
import { HomeTabs } from "@/components/home/HomeTabs";
import { JoyAssistant } from "@/components/home/JoyAssistant";

/**
 * Home, rebuilt to the approved dashboard mock (docs/mockups/11-brief-band.png)
 * after Karynn's 22 August walkthrough: "I think you veered away from the
 * mockups... The dashboard also seems not very user friendly."
 *
 * She was right. The previous Home was nine panels in three columns — a wall.
 * The mock is a morning: a greeting, a brief in sentences, one thin band of
 * numbers, and the two things she actually works from — her tasks and today's
 * schedule — as tabs in a single focused column. Everything the panels showed
 * still exists one click away on its own module screen, where it always had
 * more room anyway.
 *
 * Still deliberately absent, per three specs and the mock alike: KPI card
 * rows, charts, and a large AI hero. Joy Assistant stays collapsed at the
 * bottom with its floating Ask Joy pill.
 */
export default function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl">
      <GreetingBand />
      <MorningBrief />
      <StatBand />
      <HomeTabs />
      <JoyAssistant />
    </div>
  );
}
