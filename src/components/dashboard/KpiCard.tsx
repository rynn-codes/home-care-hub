import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "info";
}

const accents: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]",
  info: "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]",
};

export function KpiCard({ label, value, delta, icon: Icon, accent = "primary" }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-5 card-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="font-display text-3xl font-bold mt-2">{value}</p>
          {delta !== undefined && (
            <div className={cn("inline-flex items-center gap-1 text-xs font-medium mt-2", positive ? "text-[hsl(var(--success))]" : "text-destructive")}>
              {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta)}% vs last week
            </div>
          )}
        </div>
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
