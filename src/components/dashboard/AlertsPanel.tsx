import { Card } from "@/components/ui/card";
import { useData } from "@/context/DataProvider";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { timeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const sev = {
  danger: { icon: AlertCircle, cls: "text-destructive bg-destructive/10" },
  warning: { icon: AlertTriangle, cls: "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)]" },
  info: { icon: Info, cls: "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.12)]" },
};

export function AlertsPanel() {
  const { alerts } = useData();
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Alerts & Tasks</h3>
        <span className="text-xs text-muted-foreground">{alerts.length} open</span>
      </div>
      <div className="space-y-3">
        {alerts.map((a) => {
          const S = sev[a.severity];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", S.cls)}>
                <S.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
