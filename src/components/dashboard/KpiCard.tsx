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
  featured?: boolean;
}

const accents: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]",
  info: "bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]",
};

export function KpiCard({ label, value, delta, icon: Icon, accent = "primary", featured = false }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;

  if (featured) {
    return (
      <Card className="p-6 card-hover bg-gradient-primary border-0 text-primary-foreground shadow-glow overflow-hidden relative">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium opacity-80">{label}</p>
            <p className="font-display text-4xl font-bold mt-2 tracking-tight">{value}</p>
            {delta !== undefined && (
              <div className="inline-flex items-center gap-1 text-xs font-medium mt-3 bg-white/15 backdrop-blur px-2 py-1 rounded-full">
                {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(delta)}% vs last week
              </div>
            )}
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 card-hover border-border/60 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</p>
          {delta !== undefined && (
            <div className={cn("inline-flex items-center gap-1 text-xs font-medium mt-2", positive ? "text-[hsl(var(--success))]" : "text-destructive")}>
              {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta)}% vs last week
            </div>
          )}
        </div>
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
