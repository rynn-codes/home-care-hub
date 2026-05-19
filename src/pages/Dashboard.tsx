import { Plus, CalendarPlus, UserPlus, HeartHandshake } from "lucide-react";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { TodayShifts } from "@/components/dashboard/TodayShifts";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WeatherWidget } from "@/components/dashboard/WeatherWidget";
import { UpcomingDates } from "@/components/dashboard/UpcomingDates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const USER_NAME = "Karynn";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" aria-label="Quick add">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <CalendarPlus className="h-4 w-4 mr-2" />Add new shift
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus className="h-4 w-4 mr-2" />Add employee
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HeartHandshake className="h-4 w-4 mr-2" />Add new client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <UpcomingDates />
        <MiniCalendar />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ActivityFeed />
          <TodayShifts />
        </div>
        <div className="space-y-6">
          <AlertsPanel />
        </div>
      </div>
    </>
  );
}
