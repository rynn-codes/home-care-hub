import { GreetingBand } from "@/components/home/GreetingBand";
import { BriefBand } from "@/components/home/BriefBand";
import { HomeTabs } from "@/components/home/HomeTabs";
import { UpcomingDeadlines } from "@/components/home/UpcomingDeadlines";
import { JoyAssistant } from "@/components/home/JoyAssistant";

/**
 * Home, rebuilt to the approved dashboard mock
 * (docs/mockups/Joy Health Dashboard - Brief Band.dc.html) after Karynn's
 * 22 August walkthrough: "I think you veered away from the mockups... The
 * dashboard also seems not very user friendly."
 *
 * The mock is a morning, not a wall of panels: the gradient greeting, the
 * framed brief band (Morning Brief + one thin stat row on the left, Talk to
 * Joy AI on the right), then the working area — My Tasks | Today's Schedule
 * and Upcoming Deadlines on the left, Joy Assistant's prepared items on the
 * right — divided by hairlines rather than cards. Ask Joy floats bottom-right
 * on the gradient pill.
 *
 * Still deliberately absent, per three specs and the mock alike: KPI card
 * rows, charts, and a large AI hero.
 */
export default function Dashboard() {
  return (
    <div className="flex max-w-[1400px] flex-col gap-[30px]">
      <GreetingBand />
      <BriefBand />

      <div className="grid items-stretch gap-y-11 lg:grid-cols-[1.5fr_1fr] lg:gap-y-0">
        <div className="flex min-w-0 flex-col gap-11 lg:pr-11">
          <HomeTabs />
          <UpcomingDeadlines />
        </div>
        <div className="flex min-w-0 flex-col gap-9 lg:border-l lg:border-black/[.07] lg:pl-11">
          <JoyAssistant />
        </div>
      </div>
    </div>
  );
}
