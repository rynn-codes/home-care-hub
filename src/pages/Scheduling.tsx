import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataProvider";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShiftStatus } from "@/lib/mockData";

const statusBg: Record<ShiftStatus, string> = {
  scheduled: "bg-primary-soft text-primary border-primary/20",
  "clocked-in": "bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.3)]",
  completed: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]",
  missed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function Scheduling() {
  const { shifts, employees, clients } = useData();
  const [anchor, setAnchor] = useState(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 0 }), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const visibleEmployees = employees.slice(0, 10);

  return (
    <>
      <PageHeader
        title="Scheduling"
        description="Drag, assign, and track caregiver shifts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <Button><Plus className="h-4 w-4 mr-1.5" />New Shift</Button>
          </div>
        }
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b bg-surface-muted">
              <div className="p-3 text-xs font-semibold text-muted-foreground uppercase">Caregiver</div>
              {days.map((d) => (
                <div key={d.toString()} className={cn("p-3 text-center border-l", isSameDay(d, new Date()) && "bg-primary-soft")}>
                  <p className="text-xs text-muted-foreground uppercase">{format(d, "EEE")}</p>
                  <p className="text-sm font-semibold">{format(d, "d")}</p>
                </div>
              ))}
            </div>
            {visibleEmployees.map((e) => (
              <div key={e.id} className="grid grid-cols-[180px_repeat(7,1fr)] border-b min-h-[80px]">
                <div className="p-3 text-sm font-medium border-r">{e.name}</div>
                {days.map((d) => {
                  const dayShifts = shifts.filter((s) => s.caregiverId === e.id && isSameDay(new Date(s.start), d));
                  return (
                    <div key={d.toString()} className="p-1.5 border-l space-y-1">
                      {dayShifts.map((s) => {
                        const cl = clients.find((c) => c.id === s.clientId);
                        return (
                          <div key={s.id} className={cn("rounded-md border px-2 py-1 text-xs", statusBg[s.status])}>
                            <p className="font-medium truncate">{cl?.name}</p>
                            <p className="opacity-80">{format(new Date(s.start), "h:mm a")}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
