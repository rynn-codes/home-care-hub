import { useMemo } from "react";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { cn } from "@/lib/utils";

/**
 * The stat band — the mock's thin row of four figures with hairline dividers,
 * explicitly NOT KPI cards (three separate specs forbid those, and the
 * approved mock agrees: numbers with quiet labels, one line of context each).
 *
 * Open Shifts carries the mock's red dot when the number demands somebody's
 * morning. Everything else stays neutral: a count is information, not an
 * alarm.
 */
export function StatBand() {
  const signals = useHomeSignals();

  const stats = useMemo(() => {
    const activeClients = new Set(
      seedVisits.filter((v) => v.clientPersonId && !v.eventType).map((v) => v.clientPersonId),
    ).size;
    const caregivers = seedEmployees.filter((e) => e.status === "active").length;
    const openShifts = signals.find((s) => s.key === "open-shifts");
    const assessments = seedVisits.filter((v) => v.eventType === "rn_assessment").length;

    return [
      { label: "Active Clients", value: String(activeClients), note: "on the schedule", dot: false },
      { label: "Caregivers", value: String(caregivers), note: "active", dot: false },
      {
        label: "Open Shifts",
        value: openShifts?.value ?? "0",
        note: openShifts && openShifts.value !== "0" ? "Needs coverage" : "All covered",
        dot: Boolean(openShifts && openShifts.value !== "0"),
      },
      { label: "Assessments", value: String(assessments), note: "This week", dot: false },
    ];
  }, [signals]);

  return (
    <dl aria-label="Today at a glance" className="mb-8 flex flex-wrap">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "min-w-[140px] flex-1 py-1 pr-6",
            i > 0 && "border-l border-border pl-6",
          )}
        >
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {stat.dot && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-destructive"
              />
            )}
            {stat.label}
          </dt>
          <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          <dd className="text-xs text-muted-foreground">{stat.note}</dd>
        </div>
      ))}
    </dl>
  );
}
