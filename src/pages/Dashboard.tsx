import { Users, UserCog, Clock, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { TodayShifts } from "@/components/dashboard/TodayShifts";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { useData } from "@/context/DataProvider";
import { formatMoney } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const { clients, employees, shifts, invoices } = useData();
  const activeClients = clients.filter((c) => c.status === "active").length;
  const activeCaregivers = employees.filter((e) => e.status === "active").length;
  const weekly = shifts.reduce((sum, s) => {
    const h = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 36e5;
    return sum + h;
  }, 0);
  const revenue = invoices.filter((i) => i.status === "paid" || i.status === "sent").reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your home care operations."
        actions={<Button><Plus className="h-4 w-4 mr-1.5" />New Shift</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Clients" value={activeClients} delta={6} icon={Users} accent="primary" />
        <KpiCard label="Active Caregivers" value={activeCaregivers} delta={3} icon={UserCog} accent="info" />
        <KpiCard label="Weekly Hours" value={Math.round(weekly)} delta={-2} icon={Clock} accent="warning" />
        <KpiCard label="Weekly Revenue" value={formatMoney(revenue)} delta={9} icon={DollarSign} accent="success" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <TodayShifts />
          <ActivityFeed />
        </div>
        <div className="space-y-6">
          <MiniCalendar />
          <AlertsPanel />
        </div>
      </div>
    </>
  );
}
