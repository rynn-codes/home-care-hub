import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useData } from "@/context/DataProvider";
import { initials } from "@/lib/formatters";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { ShiftStatus } from "@/lib/mockData";

const statusStyle: Record<ShiftStatus, string> = {
  "scheduled": "bg-secondary text-secondary-foreground",
  "clocked-in": "bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))]",
  "completed": "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",
  "missed": "bg-destructive/15 text-destructive",
  "cancelled": "bg-muted text-muted-foreground",
};

export function TodayShifts() {
  const { shifts, employees, clients } = useData();
  const today = new Date();
  const list = shifts
    .filter((s) => isSameDay(new Date(s.start), today))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Today's Shifts</h3>
        <span className="text-xs text-muted-foreground">{list.length} scheduled</span>
      </div>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No shifts today.</p>}
        {list.map((s) => {
          const cg = employees.find((e) => e.id === s.caregiverId);
          const cl = clients.find((c) => c.id === s.clientId);
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-surface-muted transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                  {cg ? initials(cg.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cg?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {cl?.name} • {format(new Date(s.start), "h:mm a")} – {format(new Date(s.end), "h:mm a")}
                </p>
              </div>
              <Badge variant="secondary" className={cn("capitalize text-xs", statusStyle[s.status])}>
                {s.status.replace("-", " ")}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
