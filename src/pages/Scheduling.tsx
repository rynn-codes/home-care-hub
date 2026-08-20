import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDemo } from "@/context/DemoDataProvider";
import { consentSessionForClient } from "@/lib/demoStore";
import { AssignCaregiver } from "@/components/scheduling/AssignCaregiver";
import { seedClients } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import {
  hoursOf,
  openShifts,
  scheduleConflicts,
  type Visit,
} from "@/domain/scheduling/conflicts";
import { cn } from "@/lib/utils";

/**
 * Scheduling — the week view.
 *
 * §7 of the Scheduling Build Spec makes Week the primary office workspace, and
 * §8 gives the layout: a small Needs You panel beside a schedule canvas that
 * takes most of the width.
 *
 * §9 governs how a visit reads — client, service, caregiver, time, and a status
 * indicator only when one is needed. No large coloured blocks, no rainbow
 * caregiver colours, no badge stacks.
 *
 * There is ONE Joy schedule (§20). Assessments booked in Admissions appear here
 * because they are events on this schedule, not on a separate admissions
 * calendar — §15 forbids building one.
 */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Scheduling() {
  const { scheduleEvents, assignments, assignShift, consentSessions, admissions } = useDemo();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<Visit | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /**
   * Whether this client agreed to be driven. Undefined when nobody has asked —
   * which is not a refusal, and must not be treated as one.
   */
  const transportConsentFor = (clientName: string): boolean | undefined => {
    const session = consentSessionForClient({ admissions, consentSessions }, clientName);
    const decision = session?.decisions?.transportation;
    if (!decision) {
      const seeded = seedClients.find((c) => `${c.firstName} ${c.lastName}` === clientName);
      const seededDecision = seeded?.decisions?.transportation;
      return seededDecision ? seededDecision === "agree" : undefined;
    }
    return decision === "agree";
  };

  const weekStart = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  // Assessments booked through Admissions are visits on this same board.
  const visits: Visit[] = useMemo(() => {
    const booked: Visit[] = scheduleEvents.map((e) => ({
      id: e.id,
      clientName: e.clientName,
      service: "RN Assessment",
      caregiverName: e.assessorName,
      startsAt: e.startsAt,
      endsAt: new Date(new Date(e.startsAt).getTime() + e.durationMinutes * 60_000).toISOString(),
      eventType: e.eventType,
    }));
    // Assignments made in the app override whatever the seed said.
    return [...seedVisits, ...booked].map((v) =>
      assignments[v.id] ? { ...v, caregiverName: assignments[v.id] } : v,
    );
  }, [scheduleEvents, assignments]);

  const weekVisits = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return visits.filter((v) => {
      const t = new Date(v.startsAt).getTime();
      return t >= weekStart.getTime() && t < end.getTime();
    });
  }, [visits, weekStart]);

  const byDay = useMemo(() => {
    const buckets: Visit[][] = [[], [], [], [], [], [], []];
    for (const v of weekVisits) {
      const idx = (new Date(v.startsAt).getDay() + 6) % 7;
      buckets[idx].push(v);
    }
    for (const b of buckets) {
      b.sort((a, z) => new Date(a.startsAt).getTime() - new Date(z.startsAt).getTime());
    }
    return buckets;
  }, [weekVisits]);

  const open = useMemo(() => openShifts(weekVisits), [weekVisits]);
  const conflicts = useMemo(() => scheduleConflicts(weekVisits), [weekVisits]);
  const covered = open.length === 0 && conflicts.length === 0;

  const rangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekStart.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}`;
  }, [weekStart]);

  return (
    <>
      <PageHeader
        title="Scheduling"
        description="One schedule. Client visits, assessments and orientations all live here."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium tabular-nums">{rangeLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="ml-auto flex gap-1 rounded-lg border border-border p-0.5">
          {["Day", "Week", "Month"].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === "Week"}
              disabled={v !== "Week"}
              title={v === "Week" ? undefined : `${v} view is not built yet`}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                v === "Week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground disabled:opacity-40",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Needs You — §17: only actionable items, and a plain statement when
            there are none. */}
        <aside className="rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-3 text-sm font-semibold">Needs You</h2>
          {covered ? (
            <p className="text-sm text-muted-foreground">
              Schedule is covered. No open shifts or conflicts this week.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {open.length > 0 && (
                <li>
                  <p className="text-sm font-medium">
                    {open.length} open {open.length === 1 ? "shift" : "shifts"}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {open.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(v)}
                          className="text-left text-xs text-muted-foreground hover:text-primary"
                        >
                          {v.clientName} · {fmtTime(v.startsAt)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {conflicts.length > 0 && (
                <li className="border-t border-border pt-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <TriangleAlert className="h-3.5 w-3.5 text-[hsl(var(--warning))]" aria-hidden="true" />
                    {conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {conflicts.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {c.message}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </aside>

        {/* The canvas gets most of the width, per §8. */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7 gap-2">
            {DAY_NAMES.map((name, i) => {
              const date = new Date(weekStart);
              date.setDate(date.getDate() + i);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div key={name} className="flex flex-col">
                  <div
                    className={cn(
                      "mb-2 rounded-lg px-2 py-1.5 text-center",
                      isToday ? "bg-primary-soft" : "",
                    )}
                  >
                    <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                      {name}
                    </p>
                    <p className={cn("text-sm tabular-nums", isToday && "font-semibold text-primary")}>
                      {date.getDate()}
                    </p>
                  </div>

                  <div className="flex min-h-40 flex-col gap-1.5 rounded-xl border border-border bg-surface p-1.5">
                    {byDay[i].length === 0 && (
                      <p className="px-1 py-2 text-center text-xs text-muted-foreground/60">—</p>
                    )}
                    {byDay[i].map((v) => {
                      const isOpen = v.caregiverName === null;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelected(v)}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-surface-muted",
                            isOpen
                              ? "border-dashed border-[hsl(var(--warning)/0.6)]"
                              : "border-border",
                          )}
                        >
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {fmtTime(v.startsAt)}
                          </p>
                          <p className="truncate text-xs font-medium">{v.clientName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{v.service}</p>
                          <p
                            className={cn(
                              "truncate text-[11px]",
                              isOpen ? "font-medium text-[hsl(var(--warning))]" : "text-muted-foreground",
                            )}
                          >
                            {isOpen ? "Open" : v.caregiverName}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data plus anything you booked through Admissions. Conflict detection is real and
        tested; drag-and-drop, recurring visits and the day and month views are not built yet.
      </p>

      <VisitDrawer
        visit={selected}
        onClose={() => setSelected(null)}
        // The whole week, not just the day, so overtime is counted honestly.
        allVisits={visits}
        today={today}
        transportConsent={selected ? transportConsentFor(selected.clientName) : undefined}
        onAssign={assignShift}
      />
    </>
  );
}

function VisitDrawer({
  visit,
  onClose,
  allVisits,
  today,
  transportConsent,
  onAssign,
}: {
  visit: Visit | null;
  onClose: () => void;
  allVisits: Visit[];
  today: string;
  /** Undefined when nobody has asked this client yet. */
  transportConsent?: boolean;
  onAssign: (visitId: string, caregiverName: string) => void;
}) {
  const conflicts = useMemo(
    () => (visit ? scheduleConflicts(allVisits).filter((c) => c.message.includes(visit.clientName) || c.conflictsWith?.id === visit.id) : []),
    [visit, allVisits],
  );

  return (
    <Sheet open={visit !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {visit && (
          <>
            <SheetHeader>
              <SheetTitle>{visit.clientName}</SheetTitle>
              <SheetDescription>
                {visit.service} ·{" "}
                {new Date(visit.startsAt).toLocaleDateString([], {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </SheetDescription>
            </SheetHeader>

            <dl className="mt-6 divide-y divide-border">
              {[
                ["Time", `${fmtTime(visit.startsAt)} – ${fmtTime(visit.endsAt)}`],
                ["Length", `${hoursOf(visit).toFixed(1)} hours`],
                ["Assigned", visit.caregiverName ?? "Unassigned"],
                ["Type", visit.eventType === "rn_assessment" ? "RN assessment" : visit.service],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {conflicts.length > 0 && (
              <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
                <p className="text-sm font-semibold">Conflict</p>
                {conflicts.map((c, i) => (
                  <p key={i} className="mt-1.5 text-sm text-muted-foreground">
                    {c.message}
                  </p>
                ))}
              </div>
            )}

            {visit.caregiverName === null && visit.eventType !== "rn_assessment" && (
              <AssignCaregiver
                visit={visit}
                allVisits={allVisits}
                today={today}
                clientAgreedToTransport={transportConsent}
                onAssign={(name) => {
                  onAssign(visit.id, name);
                  onClose();
                }}
              />
            )}

            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              Assignment saves on this device and records a domain event. Notifying the caregiver
              through Spruce is not wired up.
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
