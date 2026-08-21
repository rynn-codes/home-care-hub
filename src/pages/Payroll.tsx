import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Clock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  OVERTIME_AFTER_HOURS,
  OVERTIME_MULTIPLIER,
  payrollRun,
  runSummary,
  type CaregiverHours,
  type PayrollException,
} from "@/domain/payroll/hours";
import { seedPayrollPeople, seedPayrollVisits, seedTimeEntries } from "@/lib/payrollSeed";
import { cn } from "@/lib/utils";

/**
 * Payroll — Sprint 7, unblocked by the visit clock.
 *
 * The screen is a readiness check rather than a calculator. Joy's job is to
 * hand Gusto hours it can trust; the interesting work is everything standing
 * between the clock and that, which is why exceptions come first and totals
 * second.
 *
 * There are no dollar figures here, deliberately. Rates are not in the payroll
 * domain: Karynn has not supplied real ones, and multiplying the mockup's
 * fictional rates by real hours would produce something that reads exactly like
 * a wage. Gusto owns money.
 */

function currentPeriod(): { start: string; end: string } {
  // A fortnight ending today, which is what the demo data covers. The real
  // version reads Joy's configured schedule.
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

const EXCEPTION_TONE: Record<PayrollException["kind"], string> = {
  open_entry: "text-destructive",
  visit_without_time: "text-destructive",
  implausible_length: "text-destructive",
  // An unfinished review blocks, but it is Joy's own work outstanding rather
  // than something wrong with the caregiver's timesheet.
  awaiting_verification: "text-[hsl(var(--warning))]",
  documentation_gap: "text-[hsl(var(--warning))]",
};

function CaregiverRow({ caregiver }: { caregiver: CaregiverHours }) {
  const [open, setOpen] = useState(!caregiver.ready);

  return (
    <li className="px-4 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          {caregiver.ready ? (
            <Check className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <span className="text-sm font-medium">{caregiver.caregiverName}</span>
        </span>

        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {caregiver.totalHours} h
            {caregiver.overtimeHours > 0 && (
              <span className="ml-1.5 text-[hsl(var(--warning))]">
                incl. {caregiver.overtimeHours} OT
              </span>
            )}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 pl-6">
          {/* Weeks, because overtime is per workweek and the split is the
              thing somebody checking this needs to see. */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-1.5 pr-4 font-medium">Week of</th>
                <th scope="col" className="py-1.5 pr-4 font-medium">Regular</th>
                <th scope="col" className="py-1.5 pr-4 font-medium">Overtime</th>
                <th scope="col" className="py-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {caregiver.weeks.map((week) => (
                <tr key={week.weekStart} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">{week.weekStart}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{week.regularHours}</td>
                  <td
                    className={cn(
                      "py-2 pr-4",
                      week.overtimeHours > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
                    )}
                  >
                    {week.overtimeHours}
                  </td>
                  <td className="py-2">{week.totalHours}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {caregiver.exceptions.length > 0 && (
            <ul className="space-y-2">
              {caregiver.exceptions.map((exception, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <TriangleAlert
                    className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", EXCEPTION_TONE[exception.kind])}
                    aria-hidden="true"
                  />
                  <span>
                    <span className={cn(!exception.blocking && "text-muted-foreground")}>
                      {exception.detail}
                    </span>
                    {!exception.blocking && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        · does not hold up pay
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export default function Payroll() {
  const period = useMemo(currentPeriod, []);

  const run = useMemo(
    () =>
      payrollRun({
        period,
        people: seedPayrollPeople,
        entries: seedTimeEntries,
        visits: seedPayrollVisits,
      }),
    [period],
  );

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Hours from the clock, checked and ready for Gusto."
      />

      <section className="mb-8">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Period
              </p>
              <p className="mt-0.5 text-sm font-medium">
                {period.start} to {period.end}
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Overtime after {OVERTIME_AFTER_HOURS} h a week at {OVERTIME_MULTIPLIER}×
            </p>
          </div>

          <p className="mt-4 text-sm">{runSummary(run)}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button disabled={!run.ready}>Send hours to Gusto</Button>
            <p className="text-xs text-muted-foreground">
              {run.ready
                ? "Gusto is not connected — see HrOnboardingService. Joy sends hours; tax, withholding and deposit stay with Gusto."
                : "Resolve what is blocking below first."}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Hours by caregiver</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {run.caregivers.map((caregiver) => (
            <CaregiverRow key={caregiver.caregiverPersonId} caregiver={caregiver} />
          ))}
          {run.caregivers.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hours recorded in this period.
            </li>
          )}
        </ul>
      </section>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Overtime is calculated per workweek rather than per pay period, so a light week followed
        by a heavy one still earns it. Joy's workweek starts on Monday and must match the setting
        in Gusto — a mismatch changes overtime silently for anybody working across the boundary.
        No pay rates appear here: Joy produces hours, Gusto produces wages.
      </p>
    </>
  );
}
