import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Cake, CalendarDays, DollarSign, FileText, PartyPopper, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type TabKey = "all" | "holidays" | "payroll" | "invoices" | "birthdays";

interface DateItem {
  id: string;
  category: Exclude<TabKey, "all">;
  title: string;
  subtitle: string;
  date: Date;
  icon: LucideIcon;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

const items: DateItem[] = [
  { id: "1", category: "payroll", title: "Bi-weekly Payroll Run", subtitle: "All caregivers · ACH transfer", date: daysFromNow(2), icon: DollarSign },
  { id: "2", category: "birthdays", title: "Maya Patel", subtitle: "RN · turns 34", date: daysFromNow(3), icon: Cake },
  { id: "3", category: "invoices", title: "Invoices Due", subtitle: "12 client invoices · ~$18,400", date: daysFromNow(5), icon: FileText },
  { id: "4", category: "holidays", title: "Memorial Day", subtitle: "Federal holiday · Office closed", date: new Date(new Date().getFullYear(), 4, 25), icon: PartyPopper },
  { id: "5", category: "birthdays", title: "Eleanor Whitfield", subtitle: "Client · turns 82", date: daysFromNow(8), icon: Cake },
  { id: "6", category: "payroll", title: "Quarterly Tax Filing", subtitle: "Form 941 deadline", date: daysFromNow(11), icon: DollarSign },
  { id: "7", category: "invoices", title: "Insurance Reimbursements", subtitle: "Medicare batch submission", date: daysFromNow(14), icon: FileText },
  { id: "8", category: "holidays", title: "Juneteenth", subtitle: "Federal holiday", date: new Date(new Date().getFullYear(), 5, 19), icon: PartyPopper },
];

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "holidays", label: "Holidays" },
  { key: "payroll", label: "Payroll" },
  { key: "invoices", label: "Invoices" },
  { key: "birthdays", label: "Birthdays" },
];

const categoryStyles: Record<Exclude<TabKey, "all">, string> = {
  holidays: "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.12)]",
  payroll: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.12)]",
  invoices: "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)]",
  birthdays: "text-primary bg-primary-soft",
};

export function UpcomingDates() {
  const [tab, setTab] = useState<TabKey>("all");

  const filtered = items
    .filter((i) => tab === "all" || i.category === tab)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Upcoming Dates</h3>
        </div>
        <span className="text-xs text-muted-foreground">Next 30 days</span>
      </div>

      <div className="bg-muted/60 rounded-lg p-1 flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 min-w-fit text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap",
              tab === t.key
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing upcoming.</p>
        )}
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", categoryStyles[item.category])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{format(item.date, "MMM d")}</p>
                <p className="text-[11px] text-muted-foreground">{format(item.date, "EEE")}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
