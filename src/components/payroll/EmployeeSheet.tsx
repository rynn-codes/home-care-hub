import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_PILL, type DayHours, type OvertimeAsk } from "@/domain/payroll/review";
import type { PayrollRow } from "@/components/payroll/EmployeesTable";

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function dayParts(iso: string): { weekday: string; date: string } {
  const d = new Date(`${iso}T12:00:00`);
  return { weekday: d.toLocaleDateString("en-US", { weekday: "short" }), date: `${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}` };
}

/**
 * One employee's payroll week: the numbers, what Joy is asking, approved
 * against actual overtime, the day by day time and the audit trail.
 */
export function EmployeeSheet({
  open,
  onOpenChange,
  row,
  periodLabel,
  days,
  overtimeDays,
  audit,
  ask,
  compare,
  money,
  onApproveOvertime,
  hoursUnknown = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PayrollRow | null;
  periodLabel: string;
  days: DayHours[];
  overtimeDays?: string[];
  audit: Array<{ text: string; when: string }>;
  ask: OvertimeAsk | null;
  compare?: Array<{ label: string; value: string; variance?: boolean }>;
  money: (n: number | null) => string;
  onApproveOvertime?: () => void;
  hoursUnknown?: boolean;
}) {
  if (!row) return null;
  const hasOt = row.overtimeHours > 0;
  const flagged = new Set(overtimeDays ?? []);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
          <SheetHeader className="space-y-0 text-left">
            <span className="flex items-center gap-2.5">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[12px] font-semibold text-primary">{initialsOf(row.name)}</span>
              <span className="flex min-w-0 flex-col gap-[2px]">
                <SheetTitle className="text-[17px] tracking-[-.01em]">{row.name}</SheetTitle>
                <SheetDescription className="text-[12.5px]">
                  {row.role} · {periodLabel}
                </SheetDescription>
              </span>
            </span>
            <span className={cn("mt-2.5 inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", PAYROLL_STATUS_PILL[row.status])}>{PAYROLL_STATUS_LABELS[row.status]}</span>
          </SheetHeader>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            {(
              [
                ["Regular hours", hoursUnknown ? "—" : row.regularHours.toFixed(1), false],
                ["Overtime", hasOt ? row.overtimeHours.toFixed(1) : "—", hasOt],
                ["Gross pay", hoursUnknown ? "—" : money(row.gross), false],
              ] as const
            ).map(([label, value, warn]) => (
              <span key={label} className={cn("flex min-w-[104px] flex-1 flex-col gap-[3px] rounded-[12px] border px-3.5 py-3", warn ? "border-[#FCE8B6] bg-[#FFFAEB]" : "border-[var(--hairline)]")}>
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
                <span className={cn("text-[19px] font-semibold tracking-[-.015em] tabular-nums", warn && "text-[#B54708]")}>{value}</span>
              </span>
            ))}
          </div>
          {ask && (
            <div className="mt-3.5 flex flex-col gap-1 rounded-[10px] border border-[#FCE8B6] bg-[#FFFAEB] px-3.5 py-3">
              <span className="text-[12.5px] font-semibold text-[#B54708]">{ask.headline}</span>
              <span className="text-[12px] leading-[1.5] text-[#B54708] [text-wrap:pretty]">{ask.detail}</span>
            </div>
          )}
          {row.detail && !ask && <p className="m-0 mt-3.5 rounded-[10px] border border-[#CFE0FF] bg-[#F5F9FF] px-3.5 py-2.5 text-[12px] leading-[1.5] text-[#2B4A7E] [text-wrap:pretty]">{row.detail}</p>}
          {compare && compare.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Approved vs actual</h3>
              <div className="flex flex-col">
                {compare.map((c) => (
                  <span key={c.label} className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                    <span className="text-[12.5px] text-muted-foreground">{c.label}</span>
                    <span className={cn("ml-auto text-[12.5px] tabular-nums", c.variance ? "font-medium text-[#B42318]" : "text-[var(--ink-body)]")}>{c.value}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Time detail</h3>
          <div className="flex flex-col">
            {days.map((d) => {
              const { weekday, date } = dayParts(d.on);
              return (
                <span key={d.on} className="flex items-baseline gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0">
                  <span className="w-[34px] flex-none text-[12.5px]">{weekday}</span>
                  <span className="text-[12.5px] text-muted-foreground">{date}</span>
                  <span className={cn("ml-auto text-[12.5px] tabular-nums", d.hours === null ? "text-muted-foreground/70" : flagged.has(d.on) ? "font-medium text-[#B42318]" : "text-[var(--ink-body)]")}>{d.hours === null ? "—" : `${d.hours} hrs`}</span>
                </span>
              );
            })}
          </div>
          <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Audit trail</h3>
          <div className="flex flex-col">
            {audit.map((a, i) => (
              <span key={`${a.text}-${i}`} className="flex items-start gap-2.5 py-1.5">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--hairline)]" aria-hidden="true" />
                <span className="text-[12.5px] leading-[1.45] [text-wrap:pretty]">{a.text}</span>
                <span className="ml-auto flex-none whitespace-nowrap text-[11.5px] text-muted-foreground">{a.when}</span>
              </span>
            ))}
          </div>
        </div>
        {onApproveOvertime && ask && (
          <div className="flex flex-none flex-col gap-2 border-t border-[var(--hairline)] bg-[var(--paper)] px-6 py-4">
            <button type="button" onClick={onApproveOvertime} className="h-[42px] rounded-[10px] bg-primary px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]">
              {ask.button}
            </button>
            <span className="text-center text-[11px] text-muted-foreground [text-wrap:pretty]">Approvals and variances are recorded on this employee's payroll audit trail.</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
