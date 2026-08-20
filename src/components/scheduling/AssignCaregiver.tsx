import { useMemo, useState } from "react";
import { Car, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rankCandidates, type Candidate } from "@/domain/scheduling/assignment";
import { hoursOf, type Visit } from "@/domain/scheduling/conflicts";
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
 * hours spread rather than landing on the same person every week.
 */

interface Props {
  visit: Visit;
  allVisits: readonly Visit[];
  today: string;
  /** Undefined when nobody has asked the client yet — not the same as a refusal. */
  clientAgreedToTransport?: boolean;
  onAssign: (caregiverName: string) => void;
}

export function AssignCaregiver({
  visit,
  allVisits,
  today,
  clientAgreedToTransport,
  onAssign,
}: Props) {
  const [requiresDriving, setRequiresDriving] = useState(false);

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
        // Office staff do not take client shifts.
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
    () =>
      rankCandidates(candidates, {
        requirements: seedCredentialRequirements,
        visit,
        existing: allVisits,
        today,
        requiresDriving,
        clientAgreedToTransport,
      }),
    [candidates, visit, allVisits, today, requiresDriving, clientAgreedToTransport],
  );

  const available = ranked.filter((r) => r.canAssign).length;

  return (
    <div className="mt-5 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Assign a caregiver</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {available === 0
          ? "Nobody can take this shift as it stands."
          : `${available} of ${ranked.length} can take this shift.`}
      </p>

      <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted p-3">
        <input
          type="checkbox"
          checked={requiresDriving}
          onChange={(e) => setRequiresDriving(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
        />
        <span className="text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            This visit includes driving them
          </span>
          Needs the client's transport consent and a caregiver with a current licence and
          insurance.
          {clientAgreedToTransport === false && (
            <strong className="mt-1 block text-destructive">
              This client declined the transport consent.
            </strong>
          )}
        </span>
      </label>

      <ul className="mt-3 divide-y divide-border">
        {ranked.map((r) => (
          <li key={r.employeeId} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  !r.canAssign && "text-muted-foreground",
                )}
              >
                {r.name}
                {r.canAssign && r.warnings.length === 0 && (
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-label="Available" />
                )}
                {!r.canAssign && (
                  <TriangleAlert className="h-3.5 w-3.5 text-destructive" aria-label="Cannot take this shift" />
                )}
              </p>
              {r.issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {r.projectedWeeklyHours} hrs this week with this shift
                </p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {r.issues.map((issue) => (
                    <li
                      key={issue.kind + issue.message}
                      className={cn(
                        "text-xs",
                        issue.severity === "blocking"
                          ? "text-destructive"
                          : "text-[hsl(var(--warning))]",
                      )}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              size="sm"
              variant={r.warnings.length > 0 ? "outline" : "default"}
              disabled={!r.canAssign}
              onClick={() => onAssign(r.name)}
              className="shrink-0"
            >
              Assign
            </Button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Assigning saves on this device. Notifying the caregiver through Spruce is not wired up.
      </p>
    </div>
  );
}
