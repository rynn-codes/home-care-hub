import { Users, UserCog, Clock, DollarSign, Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { TodayShifts } from "@/components/dashboard/TodayShifts";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WeatherWidget } from "@/components/dashboard/WeatherWidget";
import { UpcomingDates } from "@/components/dashboard/UpcomingDates";
import { useData } from "@/context/DataProvider";
import { formatMoney } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

const USER_NAME = "Karynn";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            {getGreeting()}, {USER_NAME} <span className="inline-block">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · Here's what's happening across your agency today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeatherWidget />
          <Button><Plus className="h-4 w-4 mr-1.5" />New Shift</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Clients" value={activeClients} delta={6} icon={Users} accent="primary" featured />
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
