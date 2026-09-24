import { useMemo, useState } from "react";
import { Car, Check, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rankCandidates, type Candidate } from "@/domain/scheduling/assignment";
import { hoursOf, type Visit } from "@/domain/scheduling/conflicts";
import type { TimeOff } from "@/domain/scheduling/timeOff";
import { percentLabel, shiftProfit, type ShiftProfit } from "@/domain/scheduling/visitPay";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";

/**
 * Choosing who covers a shift.
 *
 * Everyone is listed, including the people who cannot take it, with the reason
 * attached. Hiding them would turn "why isn't Heather offered?" into a question
 * the screen provokes instead of answers — and the reasons are exactly the
 * things a scheduler needs to act on: a lapsed TB test is a renewal to chase,
 * not an absence to puzzle over.
 *
 * Ordered by who can take it, then by who has most room before overtime, so the
 * hours spread rather than landing on the same person every week. When the
 * signed-in role may see profit, each name carries what the shift nets.
 */

const SHOW_FIRST = 6;

export function ProfitPills({ profit, hours }: { profit: ShiftProfit; hours: number }) {
  const pill = (label: string, pct: number, dollars: number) => (
    <span
      className={cn("rounded-full px-1.5 py-[1px] text-[11px] font-semibold tabular-nums", dollars > 0 ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]")}
      title={`${label} profit $${dollars.toFixed(2)} on this ${hours}-hour shift`}
    >
      {label} {percentLabel(pct)}
    </span>
  );
  return (
    <>
      {pill("Gross", profit.grossPercent, profit.gross)}
      {pill("Net", profit.netPercent, profit.net)}
    </>
  );
}

interface Props {
  visit: Visit;
  allVisits: readonly Visit[];
  today: string;
  /** Undefined when nobody has asked the client yet — not the same as a refusal. */
  clientAgreedToTransport?: boolean;
  timeOff?: readonly TimeOff[];
  clientRate?: number | null;
  /** Present only when the signed-in role may see margins. */
  payRateFor?: (caregiverName: string) => number | null;
  onAssign: (caregiverName: string) => void;
}

export function AssignCaregiver({ visit, allVisits, today, clientAgreedToTransport, timeOff = [], clientRate = null, payRateFor, onAssign }: Props) {
  const [requiresDriving, setRequiresDriving] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  // Hours already booked this week, counted from the schedule itself rather
  // than from a number on the employee record — the schedule is the truth.
  const weeklyHours = useMemo(() => {
    const start = new Date(visit.startsAt);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const totals: Record<string, number> = {};
    for (const v of allVisits) {
      if (!v.caregiverName || v.id === visit.id) continue;
      const t = new Date(v.startsAt).getTime();
      if (t < start.getTime() || t >= end.getTime()) continue;
      totals[v.caregiverName] = (totals[v.caregiverName] ?? 0) + hoursOf(v);
    }
    return totals;
  }, [allVisits, visit]);

  const candidates: Candidate[] = useMemo(
    () =>
      seedEmployees
        .filter((e) => e.role !== "office")
        .map((e) => ({
          employeeId: e.id,
          name: e.name,
          role: e.role,
          drives: e.drives,
          status: e.status,
          credentials: credentialsFromRecords(e.id, e.records),
          weeklyHours: weeklyHours[e.name] ?? 0,
        })),
    [weeklyHours],
  );

  const ranked = useMemo(
    () => rankCandidates(candidates, { requirements: seedCredentialRequirements, visit, existing: allVisits, today, requiresDriving, clientAgreedToTransport, timeOff }),
    [candidates, visit, allVisits, today, requiresDriving, clientAgreedToTransport, timeOff],
  );

  const needle = query.trim().toLowerCase();
  const matches = (r: { name: string }) => needle === "" || r.name.toLowerCase().includes(needle);
  const can = ranked.filter((r) => r.canAssign && matches(r));
  const cannot = ranked.filter((r) => !r.canAssign && matches(r));
  const available = ranked.filter((r) => r.canAssign).length;
  const shown = showAll || needle !== "" ? can : can.slice(0, SHOW_FIRST);
  const hours = hoursOf(visit);
  const profitFor = (name: string) => (payRateFor ? shiftProfit({ payRate: payRateFor(name), clientRate, hours, on: visit.startsAt }) : null);

  const row = (r: (typeof ranked)[number]) => {
    const profit = profitFor(r.name);
    return (
      <li key={r.employeeId} className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1.5 text-sm font-medium", !r.canAssign && "text-muted-foreground")}>
            {r.name}
            {r.canAssign && r.warnings.length === 0 && <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-label="Available" />}
            {!r.canAssign && <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-label="Cannot take this shift" />}
            {profit !== null ? <ProfitPills profit={profit} hours={hours} /> : payRateFor && clientRate !== null ? <span className="text-[11px] font-normal text-muted-foreground">no pay rate on file</span> : null}
          </p>
          {r.issues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {r.projectedWeeklyHours} hrs this week with this shift
              {profit !== null && ` · $${profit.gross.toFixed(2)} gross · $${profit.net.toFixed(2)} net after payroll taxes`}
            </p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {r.issues.map((issue) => (
                <li key={issue.kind + issue.message} className={cn("text-xs", issue.severity === "blocking" ? "text-destructive" : "text-[hsl(var(--warning))]")}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button size="sm" variant={r.warnings.length > 0 ? "outline" : "default"} disabled={!r.canAssign} onClick={() => onAssign(r.name)} className="shrink-0">
          Assign
        </Button>
      </li>
    );
  };

  return (
    <div className="mt-5 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-sm font-medium">Assign a caregiver</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {available === 0 ? "Nobody can take this shift as it stands." : `${available} of ${ranked.length} can take this shift.`}
            {clientRate === null && payRateFor ? " No client rate on file, so no margins." : ""}
          </p>
        </div>
        <label className="flex h-8 w-[180px] items-center gap-1.5 rounded-[8px] border border-border bg-background px-2">
          <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a caregiver" aria-label="Find a caregiver" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground" />
        </label>
      </div>

      <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted p-3">
        <input type="checkbox" checked={requiresDriving} onChange={(e) => setRequiresDriving(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
        <span className="text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            This visit includes driving them
          </span>
          Needs the client's transport consent and a caregiver with a current licence and insurance.
          {clientAgreedToTransport === false && <strong className="mt-1 block text-destructive">This client declined the transport consent.</strong>}
        </span>
      </label>

      {can.length === 0 && cannot.length === 0 && needle !== "" && <p className="mt-3 text-xs text-muted-foreground">Nobody on the roster matches “{query.trim()}”.</p>}
      <ul className="mt-3 divide-y divide-border">{shown.map(row)}</ul>
      {!showAll && needle === "" && can.length > SHOW_FIRST && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-1 text-xs text-primary underline-offset-2 hover:underline">
          {can.length - SHOW_FIRST} more who can take it
        </button>
      )}
      {cannot.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <button type="button" aria-expanded={showWhy} onClick={() => setShowWhy((s) => !s)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            {cannot.length} {cannot.length === 1 ? "person" : "people"} can’t take this shift · {showWhy ? "hide why" : "show why"}
          </button>
          {showWhy && <ul className="mt-1 divide-y divide-border">{cannot.map(row)}</ul>}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Assigning saves on this device. Notifying the caregiver through Spruce is not wired up.</p>
    </div>
  );
}
