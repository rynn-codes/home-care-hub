import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, TriangleAlert } from "lucide-react";
import { useDemo } from "@/context/DemoDataProvider";
import {
  planBillingRun,
  runSummary,
  upcomingBillingWeek,
  RUN_EXCEPTION_LABELS,
} from "@/domain/billing/run";
import { approvalRefusals, APPROVAL_MESSAGES, linesFromInvoice } from "@/domain/billing/approval";
import {
  seedBillingAccounts,
  seedBillingAccountClients,
  seedRatePlanVersions,
} from "@/lib/billingAccountsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import type { Visit } from "@/domain/scheduling/conflicts";

/**
 * The Saturday run — §7.2 steps 1–6 on one card, and §19's draft-review
 * screen at prototype fidelity.
 *
 * Exceptions first, drafts second, approval last, because that is the spec's
 * order and the office's morning: the three families with something wrong are
 * tasks; the clean drafts are one read and one click each. Approval goes
 * through the same refusals the database enforces and lands on the audit
 * trail with the approver's name.
 *
 * THE PROJECTED WEEK. Joy bills the upcoming week, and the demo's schedule
 * seed carries only the current one — so the run here projects the standing
 * weekly schedule forward seven days, labeled as exactly that. Billing in
 * advance bills the schedule as it stands; for a standing schedule, next week
 * IS this week, moved.
 */
export function SaturdayRunCard() {
  const { approvedDrafts, approveDraft, currentUser } = useDemo();

  const weekStart = useMemo(() => upcomingBillingWeek(new Date().toISOString()), []);

  const run = useMemo(() => {
    // Project the standing schedule INTO the target week: the seed's Monday
    // lands on the Monday inside the upcoming Sat–Fri billing week, whatever
    // day it is today. A flat +7 was wrong every Saturday — the day the run
    // actually happens.
    const seedMonday = new Date(seedVisits[0]?.startsAt ?? new Date().toISOString());
    seedMonday.setHours(0, 0, 0, 0);
    seedMonday.setDate(seedMonday.getDate() - ((seedMonday.getDay() + 6) % 7));
    const targetMonday = new Date(`${weekStart}T00:00:00`);
    targetMonday.setDate(targetMonday.getDate() + 2);
    const offsetDays = Math.round((targetMonday.getTime() - seedMonday.getTime()) / 86_400_000);

    const shift = (iso: string) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + offsetDays);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    };
    const projected: Visit[] = seedVisits.map((v) => ({
      ...v,
      id: `${v.id}-next`,
      startsAt: shift(v.startsAt),
      endsAt: shift(v.endsAt),
    }));

    const weekEnd = (() => {
      const d = new Date(`${weekStart}T12:00:00`);
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();

    return planBillingRun({
      periodStart: weekStart,
      periodEnd: weekEnd,
      visits: projected,
      accounts: seedBillingAccounts,
      accountClients: seedBillingAccountClients,
      rateVersions: seedRatePlanVersions,
    });
  }, [weekStart]);

  function approve(draftIndex: number) {
    const draft = run.drafts[draftIndex];
    const key = `${draft.clientPersonId}:${draft.weekStart}:${draft.ratePlanVersionId ?? "no-rate"}`;
    const lines = linesFromInvoice(draft);

    // The stored draft's total IS its lines (0016 enforces the sum). The
    // computed invoice's `total` also carries deposit and fees, which are
    // collection-time arithmetic, not approval-time content.
    const approvedTotal = draft.subtotal ?? 0;

    const refusals = approvalRefusals({
      state: "pending_approval",
      lines,
      total: approvedTotal,
      byUserId: currentUser.name,
    });
    if (refusals.length > 0) {
      toast.error(APPROVAL_MESSAGES[refusals[0]]);
      return;
    }

    approveDraft(key, {
      total: approvedTotal,
      lineCount: lines.length,
      ratePlanVersionId: draft.ratePlanVersionId,
    });
    toast.success(
      `${draft.clientName}'s invoice approved — $${approvedTotal.toFixed(2)} for the week of ${draft.weekStart}.`,
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">The Saturday run — week of {weekStart}</h2>
        <p className="text-xs text-muted-foreground">{runSummary(run)}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Drafted from the standing schedule projected one week forward, priced from each
        agreement. Approve between Saturday and Monday; nothing goes out unapproved.
      </p>

      {/* ------------------------------------------ exceptions, first -- */}
      {run.exceptions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {run.exceptions.map((e, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-3 text-sm"
            >
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]"
                aria-hidden="true"
              />
              <span>
                <span className="font-medium">
                  {e.clientName ? `${e.clientName} — ` : ""}
                  {RUN_EXCEPTION_LABELS[e.kind]}.
                </span>{" "}
                <span className="text-muted-foreground">{e.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------- the drafts -- */}
      {run.drafts.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {run.drafts.map((draft, i) => {
            const key = `${draft.clientPersonId}:${draft.weekStart}:${draft.ratePlanVersionId ?? "no-rate"}`;
            const approved = approvedDrafts[key];
            return (
              <li key={key} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{draft.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft.lines
                        .map((l) => `${l.hours}h ${l.kind === "standard" ? "" : `(${l.kind.replace("_", " ")}) `}`)
                        .join("· ")}
                      at {draft.lines[0]?.rate != null ? `$${draft.lines[0].rate}/h` : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">
                      ${(draft.subtotal ?? 0).toFixed(2)}
                    </span>
                    {approved ? (
                      <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Approved by {approved.by}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => approve(i)}>
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {run.skipped.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Skipped until their exception clears:{" "}
          {run.skipped.map((s) => s.clientName).join(", ")}.
        </p>
      )}
    </section>
  );
}
