import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoySuggests, JoyWarns } from "@/components/scheduling/joy";
import { cn } from "@/lib/utils";
import { OVERTIME_THRESHOLD_HOURS, findConflicts, type Visit } from "@/domain/scheduling/conflicts";
import {
  AGREEMENT_GRACE_DAYS,
  DAY_NAMES,
  dateOnlyOf,
  dayList,
  describeSchedule,
  reviseSchedule,
  scheduleDiff,
  scheduledDays,
  weeklyHours,
  type ClientSchedule,
  type DayTimes,
  type ScheduleRevision,
} from "@/domain/scheduling/clientSchedule";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const weeklyCost = (hours: number, rate: number | null) => (rate === null || !(hours > 0) ? null : Math.round(hours * rate * 100) / 100);

/**
 * Change a client's standing schedule from a date: which days, what times,
 * who. Joy shows what changes, what it costs, whether the first week clashes
 * and whether an amendment will be due.
 */
export function ScheduleEditDialog({
  open,
  onOpenChange,
  schedule,
  visits,
  caregivers,
  hourlyRate,
  currentUserName,
  onRevise,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ClientSchedule | null;
  visits: readonly Visit[];
  caregivers: readonly string[];
  hourlyRate: number | null;
  currentUserName: string;
  onRevise: (revision: ScheduleRevision) => void;
}) {
  const [days, setDays] = useState<Record<number, DayTimes>>({});
  const [who, setWho] = useState("");
  const [from, setFrom] = useState("");
  const [why, setWhy] = useState("");

  // The first scheduled day after tomorrow — where a change most naturally starts.
  const defaultFrom = useMemo(() => {
    if (!schedule) return "";
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 28; i += 1) {
      if (schedule.days[d.getDay()]) return dateOnlyOf(d);
      d.setDate(d.getDate() + 1);
    }
    return dateOnlyOf(d);
  }, [schedule]);

  useEffect(() => {
    if (!open || !schedule) return;
    setDays({ ...schedule.days });
    setWho(schedule.caregiverName ?? "");
    setFrom(defaultFrom);
    setWhy("");
  }, [open, schedule, defaultFrom]);

  const toggleDay = (d: number) =>
    setDays((prev) => {
      if (prev[d]) {
        const next = { ...prev };
        delete next[d];
        return next;
      }
      const template = Object.values(prev)[0] ?? { start: "09:00", end: "13:00" };
      return { ...prev, [d]: { ...template } };
    });
  const setTime = (d: number, key: keyof DayTimes, value: string) => setDays((prev) => (prev[d] ? { ...prev, [d]: { ...prev[d], [key]: value } } : prev));

  const picked = scheduledDays({ days });
  const diff = schedule ? scheduleDiff(schedule, { days }) : null;
  const unchanged = diff !== null && diff.added.length === 0 && diff.removed.length === 0 && diff.retimed.length === 0 && (schedule?.caregiverName ?? "") === who;

  // The first week of the new schedule, checked against everything else on the board.
  const proposed = useMemo<Visit[]>(() => {
    if (!schedule || !from) return [];
    const out: Visit[] = [];
    const cursor = new Date(`${from}T12:00:00`);
    for (let i = 0; i < 7; i += 1) {
      const times = days[cursor.getDay()];
      if (times) {
        const date = dateOnlyOf(cursor);
        out.push({
          id: `proposed-${date}`,
          clientName: schedule.clientName,
          clientPersonId: schedule.clientPersonId,
          service: "Personal Care",
          caregiverName: who || null,
          startsAt: `${date}T${times.start}:00`,
          endsAt: `${date}T${times.end}:00`,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [schedule, from, days, who]);
  const others = useMemo(() => (schedule && from ? visits.filter((v) => !(v.clientName === schedule.clientName && v.startsAt.slice(0, 10) >= from)) : visits), [visits, schedule, from]);
  const conflicts = useMemo(() => proposed.flatMap((p) => findConflicts(p, others)), [proposed, others]);
  const blocking = conflicts.filter((c) => c.kind !== "overtime_risk");
  const overtime = conflicts.find((c) => c.kind === "overtime_risk");
  const hoursAfter = weeklyHours({ days });
  const costBefore = schedule ? weeklyCost(weeklyHours(schedule), hourlyRate) : null;
  const costAfter = weeklyCost(hoursAfter, hourlyRate);

  const problem = (() => {
    if (picked.length === 0) return "Tick at least one day.";
    const missing = picked.find((d) => !days[d].start || !days[d].end);
    if (missing !== undefined) return `${DAY_NAMES[missing]} is missing a start or an end.`;
    if (!from) return "Say when the new schedule starts.";
    if (schedule && from <= schedule.startsOn) return "The new schedule has to start after the current one did.";
    if (unchanged) return "Nothing has changed yet.";
    return null;
  })();

  if (!schedule) return null;
  const fromDate = from ? new Date(`${from}T12:00:00`) : null;
  const dayBefore = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - 1) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <span className="text-[11px] font-semibold uppercase tracking-[.085em] text-muted-foreground">Edit schedule</span>
          <DialogTitle className="text-[19px] tracking-[-.015em]">{schedule.clientName}</DialogTitle>
          <DialogDescription>Now: {describeSchedule(schedule)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium">Days and times</Label>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={!!days[d]}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-[12.5px] transition-colors",
                    days[d] ? "border-primary bg-[#EEF0FE] text-primary" : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-body)] hover:bg-[var(--wash)]",
                  )}
                >
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>
          </div>
          {picked.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2.5">
              {picked.map((d) => (
                <div key={d} className="flex items-center gap-2.5">
                  <span className="w-9 flex-none text-[12.5px] text-muted-foreground">{DAY_NAMES[d]}</span>
                  <Input type="time" aria-label={`${DAY_NAMES[d]} start`} value={days[d].start} onChange={(e) => setTime(d, "start", e.target.value)} className="h-9 min-w-0 flex-1" />
                  <Input type="time" aria-label={`${DAY_NAMES[d]} end`} value={days[d].end} onChange={(e) => setTime(d, "end", e.target.value)} className="h-9 min-w-0 flex-1" />
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="space-y-1">
              <Label htmlFor="sch-who" className="text-[12px] font-medium">
                Caregiver
              </Label>
              <select id="sch-who" value={who} onChange={(e) => setWho(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nobody regular — cover each week</option>
                {caregivers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sch-from" className="flex items-baseline gap-1.5 text-[12px] font-medium">
                Starts
                {fromDate && <span className="font-normal text-muted-foreground">· {fromDate.toLocaleDateString([], { weekday: "long" })}</span>}
              </Label>
              <Input id="sch-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sch-why" className="text-[12px] font-medium">
              Why it is changing
            </Label>
            <Input id="sch-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Hours increase · family request · condition changed" />
          </div>
          {diff && !unchanged && fromDate && (
            <JoySuggests
              headline={
                <>
                  <span className="font-semibold">
                    {dayList(picked)} · {hoursAfter} hrs a week
                  </span>{" "}
                  from {fromDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </>
              }
              rows={[
                { label: "Hours", tone: "plain", value: `${diff.hoursBefore} → ${diff.hoursAfter} a week` },
                {
                  label: "Days",
                  tone: "plain",
                  value:
                    [diff.added.length > 0 && `${dayList(diff.added)} added`, diff.removed.length > 0 && `${dayList(diff.removed)} come off`, diff.retimed.length > 0 && `${dayList(diff.retimed)} retimed`]
                      .filter(Boolean)
                      .join(" · ") || "Same days",
                },
                {
                  label: "Cost",
                  tone: costAfter === null ? "warn" : "plain",
                  value: costAfter === null ? `No rate on file for ${schedule.clientName} yet` : `${costBefore === null ? "—" : money(costBefore)} → ${money(costAfter)} a week`,
                },
                {
                  label: "Conflicts",
                  tone: blocking.length > 0 ? "bad" : "good",
                  value: blocking.length > 0 ? `${blocking.length} of the new visits clash — ${blocking[0].message}` : "None in the first week",
                },
                { label: "Overtime", tone: overtime ? "warn" : "good", value: overtime ? overtime.message : `No — ${who || "an open shift"} stays under ${OVERTIME_THRESHOLD_HOURS} hrs` },
              ]}
              note={
                <>
                  Nothing already worked is touched. The schedule running until {dayBefore?.toLocaleDateString([], { month: "short", day: "numeric" })} stays on the record.
                </>
              }
            />
          )}
          {diff && !unchanged && diff.hoursAfter !== diff.hoursBefore && (
            <JoyWarns title="This will need a new agreement">
              <span className="text-[12.5px] leading-[1.45] text-[#98322C]">
                {schedule.clientName} signed for {diff.hoursBefore} hours a week. If this is still running in {AGREEMENT_GRACE_DAYS} days, Joy will draft the amendment for you to review before it goes out.
              </span>
            </JoyWarns>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!!problem}
            onClick={() => {
              if (problem) return;
              onRevise(reviseSchedule({ current: schedule, days, caregiverName: who || null, effectiveFrom: from, by: currentUserName, at: new Date().toISOString(), reason: why.trim() }));
              onOpenChange(false);
            }}
          >
            {problem ?? `Change from ${fromDate?.toLocaleDateString([], { month: "short", day: "numeric" })}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
