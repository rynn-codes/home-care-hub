import { GreetingBand } from "@/components/home/GreetingBand";
import { PriorityStrip } from "@/components/home/PriorityStrip";
import { TodaySchedule } from "@/components/home/TodaySchedule";
import { JoyAssistant } from "@/components/home/JoyAssistant";
import {
  AdmissionsSummary,
  BillingPanel,
  CompliancePanel,
  EmployeeTasks,
  PayrollPanel,
  QuickActions,
  RecentActivity,
  UpcomingDeadlines,
} from "@/components/home/SummaryPanels";

/**
 * Home — the CEO / Operations Command Center.
 *
 * Structure is fixed by Dashboard Revision 3 and section 25 of the Codex
 * Engineering Kickoff: greeting band, compact priority strip, then three
 * columns, with Joy Assistant collapsed at the bottom.
 *
 * Deliberately absent, because three separate specs forbid them: KPI card rows,
 * revenue or pie charts, and a large AI hero panel.
 *
 * The panels currently read deterministic demo seed from lib/joySeed. Section 25
 * requires them to query the real domain once Sprint 0 lands — and forbids
 * creating dashboard-specific tables to back them.
 */
export default function Dashboard() {
  return (
    <>
      <GreetingBand />
      <PriorityStrip />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <TodaySchedule />
          <AdmissionsSummary />
        </div>

        <div className="flex flex-col gap-4">
          <EmployeeTasks />
          <CompliancePanel />
          <RecentActivity />
        </div>

        <div className="flex flex-col gap-4">
          <QuickActions />
          <PayrollPanel />
          <BillingPanel />
          <UpcomingDeadlines />
        </div>
      </div>

      <JoyAssistant />
    </>
  );
}
