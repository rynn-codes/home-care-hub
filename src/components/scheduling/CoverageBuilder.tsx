import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Pin, Plus, Scissors, Trash2, TriangleAlert, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JoySuggests } from "@/components/scheduling/joy";
import { ProfitPills } from "@/components/scheduling/AssignCaregiver";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { canSeeProfit } from "@/domain/agency/settings";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { clientRateFor } from "@/lib/clientRates";
import { newId } from "@/lib/demoStore";
import { OVERTIME_THRESHOLD_HOURS, type Visit } from "@/domain/scheduling/conflicts";
import type { TimeOff } from "@/domain/scheduling/timeOff";
import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { employerTaxes } from "@/domain/billing/employerTaxes";
import { percentLabel, planMargin, shiftProfit } from "@/domain/scheduling/visitPay";
import { staffingHeadline, staffingNeed, staffingWeeksLine } from "@/domain/scheduling/newVisit";
import {
  CONTINUITY_OT_ALLOWANCE,
  COVERAGE_TYPES,
  NOT_COVERED_LABELS,
  NOT_COVERED_SHORT,
  POOL_MODE_LABELS,
  PREFERENCE_LABELS,
  PRIORITY_LABELS,
  addCustomShift,
  autoAssign,
  buildShifts,
  coverageSummary,
  existingWeeklyHours,
  hoursBetween,
  markNotCovered,
  notCoveredOf,
  overtimeOf,
  projectedWeekHours,
  rankForShift,
  recomputeProjections,
  retimeShift,
  shiftsByWeek,
  splitShift,
  uncoveredHours,
  validateCoverageDraft,
  whyNotApprovable,
  type CoverageCandidate,
  type CoverageEvent,
  type CoveragePriority,
  type CoverageShift,
  type CoverageType,
  type NotCoveredBy,
  type PoolMode,
  type PreferenceState,
  type RankedForShift,
} from "@/domain/scheduling/coverage";

const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const weekRange = (weekStart: string) => {
  const s = new Date(`${weekStart}T12:00:00`);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${f(s)} – ${f(e)}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
const toLocal = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function whyOpen(ranked: readonly RankedForShift[]): string | null {
  const first = ranked.find((r) => !r.blocked);
  if (first) return `${first.caregiverName} would go to ${first.projectedHours} hrs — ${first.overtimeHours} over the threshold`;
  const counts = new Map<string, number>();
  for (const r of ranked) if (r.blockedReason) counts.set(r.blockedReason, (counts.get(r.blockedReason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function CaregiverRow({ name, previous, hours, profit, shiftHours, rateKnown, state, onChange }: { name: string; previous: number; hours: number; profit: ReturnType<typeof shiftProfit>; shiftHours: number; rateKnown: boolean; state: PreferenceState | null; onChange: (s: PreferenceState | null) => void }) {
  const room = Math.max(0, OVERTIME_THRESHOLD_HOURS - hours);
  return (
    <li className="flex items-center gap-2 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          <span className="truncate">{name}</span>
          {profit !== null ? <ProfitPills profit={profit} hours={shiftHours} /> : rateKnown ? <span className="flex-none text-[11px] font-normal text-muted-foreground">no pay rate on file</span> : null}
        </span>
        <span className="block text-[11.5px] text-muted-foreground">
          {previous > 0 ? `${previous} previous ${previous === 1 ? "shift" : "shifts"} · ` : ""}
          {hours} hrs booked · {room} before overtime
        </span>
      </span>
      <span className="flex flex-none gap-1">
        {(Object.keys(PREFERENCE_LABELS) as PreferenceState[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={state === s}
            onClick={() => onChange(state === s ? null : s)}
            className={cn(
              "rounded-full border px-2.5 py-[3px] text-[11.5px] transition-colors",
              state === s ? (s === "excluded" ? "border-[#F0A6A0] bg-[#FEF3F2] font-medium text-[#B42318]" : "border-primary bg-[#EEF0FE] font-medium text-primary") : "border-[var(--hairline)] text-muted-foreground hover:bg-[var(--wash)]",
            )}
          >
            {PREFERENCE_LABELS[s]}
          </button>
        ))}
      </span>
    </li>
  );
}

/**
 * Build coverage in three steps: the window, the caregivers Joy may use, and
 * the proposed plan — which a person edits, approves overtime on, and finally
 * approves. Nothing is notified: Spruce is not wired.
 */
export function CoverageBuilder({ open, onOpenChange, visits, timeOff, today, clients, editing }: { open: boolean; onOpenChange: (open: boolean) => void; visits: readonly Visit[]; timeOff: readonly TimeOff[]; today: string; clients: readonly string[]; editing: CoverageEvent | null }) {
  const { currentUser, saveCoverageEvent, approveCoveragePlan, approveCoverageOvertime, households, employeeEdits } = useDemo();
  const settings = useAgencySettings();
  const showProfit = canSeeProfit(currentUser.role, settings.profitVisibleTo);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientName, setClientName] = useState(clients[0] ?? "");
  const [type, setType] = useState<CoverageType>("24-Hour Respite");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [length, setLength] = useState(12);
  const [dayStart, setDayStart] = useState("09:00");
  const [note, setNote] = useState("");
  const [pool, setPool] = useState<PoolMode>("preferred_first");
  const [priority, setPriority] = useState<CoveragePriority>("avoid_overtime");
  const [prefs, setPrefs] = useState<Record<string, PreferenceState>>({});
  const [plan, setPlan] = useState<CoverageEvent | null>(null);
  const [considered, setConsidered] = useState<Record<string, RankedForShift[]>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPlan(editing);
      setClientName(editing.clientName);
      setType(editing.coverageType);
      setStartsAt(editing.startsAt);
      setEndsAt(editing.endsAt);
      setLength(editing.shiftLengthHours);
      setDayStart(editing.dayShiftStart);
      setNote(editing.note ?? "");
      setPool(editing.poolMode);
      setPriority(editing.staffingPriority);
      setPrefs(Object.fromEntries(editing.preferences.map((p) => [p.caregiverName, p.state])));
      setStep(3);
      return;
    }
    // Next Thursday 9 AM for four days: a respite window the demo can show.
    const s = new Date();
    s.setDate(s.getDate() + (((4 - s.getDay() + 7) % 7) || 7));
    s.setHours(9, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 4);
    setPlan(null);
    setConsidered({});
    setStep(1);
    setClientName(clients[0] ?? "");
    setType("24-Hour Respite");
    setStartsAt(s.toISOString());
    setEndsAt(e.toISOString());
    setLength(12);
    setDayStart("09:00");
    setNote("");
    setPool("preferred_first");
    setPriority("avoid_overtime");
    setPrefs({});
  }, [open, editing, clients]);

  const problem = validateCoverageDraft({ clientName, startsAt, endsAt, shiftLengthHours: length });
  const draftShifts = useMemo(() => (problem ? [] : buildShifts({ eventId: plan?.id ?? "draft", startsAt, endsAt, shiftLengthHours: length, dayShiftStart: dayStart })), [problem, plan?.id, startsAt, endsAt, length, dayStart]);
  const weekCount = useMemo(() => new Set(draftShifts.map((s) => agencyWeekStart(s.startsAt.slice(0, 10)))).size, [draftShifts]);
  const clientPersonId = seedClients.find((c) => `${c.firstName} ${c.lastName}` === clientName)?.personId ?? null;
  const clientRate = startsAt ? clientRateFor({ clientPersonId, households, on: startsAt }) : null;
  const payRateFor = (name: string | null) => {
    if (!name) return null;
    const e = seedEmployees.find((x) => x.name === name);
    return e ? employeeEdits[e.id]?.baseRate ?? e.baseRate ?? null : null;
  };
  const profitFor = (name: string) => (showProfit ? shiftProfit({ payRate: payRateFor(name), clientRate, hours: length, on: startsAt || new Date().toISOString() }) : null);

  const previousWith = useMemo(() => {
    const out: Record<string, number> = {};
    for (const v of visits) if (v.clientName === clientName && v.caregiverName && new Date(v.startsAt).getTime() <= Date.now()) out[v.caregiverName] = (out[v.caregiverName] ?? 0) + 1;
    return out;
  }, [visits, clientName]);
  const people: CoverageCandidate[] = useMemo(
    () =>
      seedEmployees
        .filter((e) => e.role !== "office")
        .map((e) => ({
          candidate: { employeeId: e.id, name: e.name, role: e.role, drives: e.drives, status: e.status, credentials: credentialsFromRecords(e.id, e.records), weeklyHours: 0 },
          previousShiftsWithClient: previousWith[e.name] ?? 0,
        })),
    [previousWith],
  );
  const known = people.filter((p) => p.previousShiftsWithClient > 0);
  const others = people.filter((p) => p.previousShiftsWithClient === 0);
  const board = useMemo(() => (plan ? visits.filter((v) => v.coverageEventId !== plan.id) : [...visits]), [visits, plan]);
  const weekly = useMemo(() => existingWeeklyHours(board), [board]);
  const need = useMemo(() => staffingNeed(draftShifts), [draftShifts]);
  const knowsRoom = useMemo(() => {
    const week = draftShifts[0] ? agencyWeekStart(draftShifts[0].startsAt.slice(0, 10)) : null;
    return known.map((p) => ({ name: p.candidate.name, room: week === null ? OVERTIME_THRESHOLD_HOURS : Math.max(0, OVERTIME_THRESHOLD_HOURS - (weekly[`${p.candidate.name}|${week}`] ?? 0)) })).sort((a, b) => b.room - a.room);
  }, [known, weekly, draftShifts]);
  const ctx = useMemo(() => ({ requirements: seedCredentialRequirements, existing: board, today, timeOff }), [board, today, timeOff]);
  const template = useMemo<Visit>(() => ({ id: "coverage-template", clientName, service: type, caregiverName: null, startsAt, endsAt }), [clientName, type, startsAt, endsAt]);
  const preferences = useMemo(() => Object.entries(prefs).map(([caregiverName, state]) => ({ caregiverName, state })), [prefs]);

  const build = (shifts: readonly CoverageShift[], base?: CoverageEvent | null) => {
    const id = base?.id ?? plan?.id ?? newId("cov");
    const result = autoAssign({
      shifts: shifts.map((s) => ({ ...s, coverageEventId: id, id: s.id.replace(/^draft-/, `${id}-`) })),
      people,
      ctx,
      visitTemplate: template,
      preferences,
      approvals: base?.overtimeApprovals ?? plan?.overtimeApprovals ?? [],
      existingWeekly: weekly,
      poolMode: pool,
      priority,
    });
    const event: CoverageEvent = {
      id,
      clientName,
      clientPersonId,
      coverageType: type,
      startsAt,
      endsAt,
      requiredHours: hoursBetween(startsAt, endsAt),
      shiftLengthHours: length,
      dayShiftStart: dayStart,
      poolMode: pool,
      staffingPriority: priority,
      preferences,
      overtimeApprovals: base?.overtimeApprovals ?? plan?.overtimeApprovals ?? [],
      shifts: result.shifts,
      approvedAt: base?.approvedAt ?? plan?.approvedAt ?? null,
      approvedBy: base?.approvedBy ?? plan?.approvedBy ?? null,
      cancelledAt: null,
      note: note.trim() || null,
      createdBy: base?.createdBy ?? plan?.createdBy ?? currentUser.name,
      createdAt: base?.createdAt ?? plan?.createdAt ?? new Date().toISOString(),
    };
    setPlan(event);
    setConsidered(result.considered);
    setStep(3);
    return event;
  };
  const fillRemaining = () => {
    if (!plan) return;
    const next = build(plan.shifts, plan);
    const s = coverageSummary(next.shifts);
    toast.success(s.openShifts === 0 ? "Coverage is complete" : `${s.openShifts} ${s.openShifts === 1 ? "shift" : "shifts"} still open`, { description: `${s.coveredHours} of ${s.requiredHours} hours covered.` });
  };
  const setNotCovered = (shiftId: string, by: NotCoveredBy | null) => plan && setPlan({ ...plan, shifts: plan.shifts.map((s) => (s.id === shiftId ? markNotCovered(s, by) : s)) });
  const [splitting, setSplitting] = useState<{ shiftId: string; at: string } | null>(null);
  const doSplit = () => {
    if (!plan || !splitting) return;
    const shift = plan.shifts.find((s) => s.id === splitting.shiftId);
    if (!shift) return;
    const halves = splitShift(shift, toIso(splitting.at));
    if (!halves) {
      toast.error("Pick a time inside the shift.");
      return;
    }
    setPlan({ ...plan, shifts: recomputeProjections(plan.shifts.flatMap((s) => (s.id === shift.id ? halves : [s])), weekly) });
    setSplitting(null);
  };
  const [adding, setAdding] = useState(false);
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const addProblem = (() => {
    if (!plan) return "Build the coverage plan first.";
    if (!addStart || !addEnd) return "Pick a start and an end.";
    const r = addCustomShift(plan, { startsAt: toIso(addStart), endsAt: toIso(addEnd) });
    return "problem" in r ? r.problem : null;
  })();
  const doAdd = () => {
    if (!plan || addProblem) return;
    const r = addCustomShift(plan, { startsAt: toIso(addStart), endsAt: toIso(addEnd) });
    if ("problem" in r) return;
    setPlan({ ...plan, shifts: [...plan.shifts, r.shift] });
    setAddStart(addEnd);
    setAddEnd("");
  };
  const [retiming, setRetiming] = useState<{ shiftId: string; startsAt: string; endsAt: string } | null>(null);
  const retimeProblem = (() => {
    if (!plan || !retiming) return null;
    const shift = plan.shifts.find((s) => s.id === retiming.shiftId);
    if (!shift) return null;
    const r = retimeShift(plan, shift, { startsAt: toIso(retiming.startsAt), endsAt: toIso(retiming.endsAt) });
    return "problem" in r ? r.problem : null;
  })();
  const doRetime = () => {
    if (!plan || !retiming || retimeProblem) return;
    setPlan({
      ...plan,
      shifts: recomputeProjections(
        plan.shifts.map((s) => {
          if (s.id !== retiming.shiftId) return s;
          const r = retimeShift(plan, s, { startsAt: toIso(retiming.startsAt), endsAt: toIso(retiming.endsAt) });
          return "shift" in r ? r.shift : s;
        }),
        weekly,
      ),
    });
    setRetiming(null);
  };
  const removeShift = (id: string) => plan && setPlan({ ...plan, shifts: recomputeProjections(plan.shifts.filter((s) => s.id !== id), weekly) });
  const gap = plan ? uncoveredHours(plan, plan.shifts) : 0;
  const midpoint = (s: CoverageShift) => toLocal(new Date((new Date(s.startsAt).getTime() + new Date(s.endsAt).getTime()) / 2).toISOString());
  const assign = (shiftId: string, name: string | null) => {
    if (!plan) return;
    setPlan({
      ...plan,
      shifts: plan.shifts.map((s) => {
        if (s.id !== shiftId) return s;
        if (!name) return { ...s, caregiverName: null, pinned: false, projectedWeekHours: 0, projectedOtHours: 0 };
        const hrs = projectedWeekHours({ caregiverName: name, shift: s, existingWeekly: weekly, assigned: plan.shifts.filter((x) => x.id !== shiftId && x.caregiverName), excludeShiftId: shiftId });
        return { ...s, caregiverName: name, pinned: true, notCovered: undefined, familyCovers: false, projectedWeekHours: Math.round(hrs * 100) / 100, projectedOtHours: overtimeOf(hrs) };
      }),
    });
  };
  const togglePin = (id: string) => plan && setPlan({ ...plan, shifts: plan.shifts.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)) });
  const rankedFor = (s: CoverageShift) =>
    considered[s.id] ??
    rankForShift(people, { shift: s, ctx, visitTemplate: template, preferences, approvals: plan?.overtimeApprovals ?? [], existingWeekly: weekly, assigned: (plan?.shifts ?? []).filter((x) => x.id !== s.id && x.caregiverName), poolMode: pool, priority });
  const summary = plan ? coverageSummary(plan.shifts) : null;
  const margin = plan ? planMargin({ clientRate, shifts: plan.shifts.map((s) => ({ hours: hoursBetween(s.startsAt, s.endsAt), payRate: s.caregiverName ? payRateFor(s.caregiverName) : null, otHours: s.caregiverName ? s.projectedOtHours : 0 })) }) : null;
  const notApprovable = plan ? whyNotApprovable(plan) : "Build the coverage plan first.";
  const setPref = (name: string, state: PreferenceState | null) =>
    setPrefs((prev) => {
      const next = { ...prev };
      if (state) next[name] = state;
      else delete next[name];
      return next;
    });
  const stepTitle = ["Coverage details", "Caregivers", "Proposed coverage"][step - 1];
  const select = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const first = clientName.split(" ")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100%-32px)] max-w-[680px] flex-col gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--hairline)] px-5 py-4 text-left">
          <DialogTitle className="text-[17px]">Build coverage</DialogTitle>
          <DialogDescription>You set the window. Joy builds the shift plan and keeps everybody clear of overtime.</DialogDescription>
          <ol className="m-0 flex list-none gap-1.5 p-0 pt-2.5">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex flex-1 items-center gap-2">
                <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-semibold", step >= n ? "bg-primary text-primary-foreground" : "bg-[var(--wash-strong)] text-muted-foreground")}>{n}</span>
                <span className={cn("h-px flex-1", step > n ? "bg-primary" : "bg-[var(--hairline)]")} />
              </li>
            ))}
          </ol>
          <p className="m-0 pt-1 text-[12px] font-medium text-[var(--ink-body)]">{stepTitle}</p>
        </DialogHeader>
        <div className="flex-1 px-5 py-4">
          {step === 1 && (
            <div className="space-y-3.5">
              {!problem && draftShifts.length > 0 && (
                <JoySuggests
                  headline={staffingHeadline(need)}
                  rows={[
                    { label: "Weeks", value: staffingWeeksLine(need) },
                    { label: "Knows", value: knowsRoom.length === 0 ? `Nobody has worked with ${first} yet — the next step starts from the whole roster.` : knowsRoom.map((k) => `${k.name} (${k.room} hrs before overtime)`).join(" · ") },
                  ]}
                  note="From the window's hours and the board's booked hours, workweek by workweek. Joy suggests; you choose the caregivers in the next step."
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cov-client" className="text-[12px] font-medium">
                    Client
                  </Label>
                  <select id="cov-client" value={clientName} onChange={(e) => setClientName(e.target.value)} className={select}>
                    {clients.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-type" className="text-[12px] font-medium">
                    Coverage type
                  </Label>
                  <select id="cov-type" value={type} onChange={(e) => setType(e.target.value as CoverageType)} className={select}>
                    {COVERAGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-start" className="text-[12px] font-medium">
                    Begins
                  </Label>
                  <Input id="cov-start" type="datetime-local" value={toLocal(startsAt)} onChange={(e) => setStartsAt(toIso(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-end" className="text-[12px] font-medium">
                    Ends
                  </Label>
                  <Input id="cov-end" type="datetime-local" value={toLocal(endsAt)} onChange={(e) => setEndsAt(toIso(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-len" className="text-[12px] font-medium">
                    Shift length
                  </Label>
                  <select id="cov-len" value={length} onChange={(e) => setLength(Number(e.target.value))} className={select}>
                    {[4, 6, 8, 10, 12, 16, 24].map((h) => (
                      <option key={h} value={h}>
                        {h} hours
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-day" className="text-[12px] font-medium">
                    Day shift starts
                  </Label>
                  <Input id="cov-day" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cov-note" className="text-[12px] font-medium">
                  Internal note <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="cov-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Family away — daughter back Monday morning" />
              </div>
              {problem ? (
                <p className="m-0 rounded-[10px] bg-[#FEF3F2] px-3 py-2.5 text-[12.5px] text-[#B42318]">{problem}</p>
              ) : (
                <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3.5 py-3">
                  <p className="m-0 text-[13px] font-medium">
                    {hoursBetween(startsAt, endsAt)} hours of care · {draftShifts.length} {draftShifts.length === 1 ? "shift" : "shifts"} · {weekCount} {weekCount === 1 ? "workweek" : "workweeks"}
                  </p>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <section>
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Previously worked with {first}</p>
                {known.length === 0 ? (
                  <p className="m-0 rounded-[10px] bg-[var(--paper-sunken)] px-3 py-2.5 text-[12.5px] text-muted-foreground">Nobody has worked with this client yet. Pick from the roster below.</p>
                ) : (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {known.map((p) => (
                      <CaregiverRow
                        key={p.candidate.employeeId}
                        name={p.candidate.name}
                        previous={p.previousShiftsWithClient}
                        hours={weekly[`${p.candidate.name}|${agencyWeekStart(startsAt.slice(0, 10))}`] ?? 0}
                        profit={profitFor(p.candidate.name)}
                        shiftHours={length}
                        rateKnown={showProfit && clientRate !== null}
                        state={prefs[p.candidate.name] ?? null}
                        onChange={(s) => setPref(p.candidate.name, s)}
                      />
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Other caregivers to consider</p>
                {showProfit && clientRate !== null && (
                  <p className="m-0 pb-2 text-[12px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
                    Gross and net are for one {length}-hour shift: what {first} is billed at ${clientRate.toFixed(2)}/hr, minus the caregiver's pay at her rate (gross), minus the employer's payroll taxes on that pay (net). Insurance and overhead are not in it.
                  </p>
                )}
                <ul className="m-0 list-none space-y-1 p-0">
                  {others.map((p) => (
                    <CaregiverRow
                      key={p.candidate.employeeId}
                      name={p.candidate.name}
                      previous={0}
                      hours={weekly[`${p.candidate.name}|${agencyWeekStart(startsAt.slice(0, 10))}`] ?? 0}
                      profit={profitFor(p.candidate.name)}
                      shiftHours={length}
                      rateKnown={showProfit && clientRate !== null}
                      state={prefs[p.candidate.name] ?? null}
                      onChange={(s) => setPref(p.candidate.name, s)}
                    />
                  ))}
                </ul>
              </section>
              <section className="grid grid-cols-1 gap-3 border-t border-[var(--hairline)] pt-3.5">
                <div className="space-y-1">
                  <Label htmlFor="cov-pool" className="text-[12px] font-medium">
                    Who Joy may use
                  </Label>
                  <select id="cov-pool" value={pool} onChange={(e) => setPool(e.target.value as PoolMode)} className={select}>
                    {(Object.keys(POOL_MODE_LABELS) as PoolMode[]).map((k) => (
                      <option key={k} value={k}>
                        {POOL_MODE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  {pool === "selected_only" && <p className="m-0 pt-1 text-[12px] text-muted-foreground">Hours nobody selected can take will be left open rather than filled by somebody else.</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cov-priority" className="text-[12px] font-medium">
                    What to optimize for
                  </Label>
                  <select id="cov-priority" value={priority} onChange={(e) => setPriority(e.target.value as CoveragePriority)} className={select}>
                    {(Object.keys(PRIORITY_LABELS) as CoveragePriority[]).map((k) => (
                      <option key={k} value={k}>
                        {PRIORITY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <p className="m-0 pt-1 text-[12px] text-muted-foreground">
                    {priority === "continuity"
                      ? `Somebody who already works with ${first} may be put up to ${CONTINUITY_OT_ALLOWANCE} hours over ${OVERTIME_THRESHOLD_HOURS}. It shows on the plan as overtime and needs your approval before the plan is final.`
                      : `Nobody goes over ${OVERTIME_THRESHOLD_HOURS} hours without your approval, whichever you choose.`}
                  </p>
                </div>
              </section>
            </div>
          )}
          {step === 3 && plan && summary && (
            <div className="space-y-3.5">
              <div className={cn("rounded-[10px] border px-3.5 py-3", summary.openShifts === 0 ? "border-[#A6E3C4] bg-[#F3FAF5]" : "border-[#F5C9A6] bg-[#FEF6EE]")}>
                <p className="m-0 text-[13.5px] font-semibold">Coverage plan is {summary.percentComplete}% complete</p>
                <p className="m-0 pt-0.5 text-[12.5px] text-[var(--ink-body)]">
                  {summary.coveredHours} of {summary.requiredHours} hours covered
                  {summary.openShifts > 0 && ` · ${summary.openShifts} ${summary.openShifts === 1 ? "shift" : "shifts"} still open`} · {summary.projectedOtHours} projected OT · {summary.caregiverCount} {summary.caregiverCount === 1 ? "caregiver" : "caregivers"}
                  {summary.notCoveredShifts > 0 &&
                    ` · ${summary.notCoveredHours} hrs not covered by Joy (${Object.entries(summary.notCoveredBy)
                      .map(([by, n]) => `${n} ${NOT_COVERED_SHORT[by as NotCoveredBy].toLowerCase()}`)
                      .join(", ")}, not billed)`}
                </p>
                {gap > 0 && (
                  <p className="m-0 pt-1 text-[12.5px] text-[#B54708]">
                    {gap} {gap === 1 ? "hr" : "hrs"} of the window {gap === 1 ? "has" : "have"} no shift at all — not open, just missing. Add a shift below if that is not on purpose.
                  </p>
                )}
                {margin && showProfit && margin.billed > 0 && (
                  <p className="m-0 pt-1 text-[12.5px] text-[var(--ink-body)]">
                    {margin.unpriced > 0 ? `On the ${plan.shifts.length - margin.unpriced} assigned: bills $${margin.billed.toFixed(2)} · pays $${margin.pay.toFixed(2)}` : `Bills $${margin.billed.toFixed(2)} · pays $${margin.pay.toFixed(2)}`} ·{" "}
                    {(() => {
                      const taxes = employerTaxes({ grossWages: margin.pay, on: plan.startsAt }).total;
                      const net = Math.round((margin.margin - taxes) * 100) / 100;
                      const pill = (label: string, dollars: number) => (
                        <span className={cn("rounded-full px-1.5 py-[1px] text-[11px] font-semibold tabular-nums", dollars > 0 ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]")} title={`$${dollars.toFixed(2)}`}>
                          {label} {margin.billed > 0 ? percentLabel(dollars / margin.billed) : "—"}
                        </span>
                      );
                      return (
                        <>
                          {pill("Gross", margin.margin)} {pill("Net", net)}
                        </>
                      );
                    })()}
                  </p>
                )}
              </div>
              {shiftsByWeek(plan.shifts).map((week) => (
                <section key={week.weekStart}>
                  <p className="m-0 flex items-baseline gap-2 pb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Workweek {weekRange(week.weekStart)}</span>
                    <span className="text-[11.5px] text-muted-foreground">Sat–Fri</span>
                  </p>
                  <ul className="m-0 list-none space-y-1 p-0">
                    {week.shifts.map((s) => {
                      const ranked = rankedFor(s);
                      const ot = s.caregiverName ? s.projectedOtHours : 0;
                      const nc = notCoveredOf(s);
                      return (
                        <li
                          key={s.id}
                          className={cn(
                            "flex flex-wrap items-center gap-2.5 rounded-[10px] border px-3 py-2",
                            nc ? "border-[var(--hairline)] bg-[var(--paper-sunken)]" : s.caregiverName ? (ot > 0 ? "border-[#F5C9A6] bg-[#FEF6EE]" : "border-[var(--hairline)] bg-[var(--paper)]") : "border-dashed border-[#C9CEF2] bg-[var(--paper)]",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {fmtWhen(s.startsAt)} – {fmtTime(s.endsAt)}
                            </span>
                            <span className="block text-[11.5px] text-muted-foreground">
                              {hoursBetween(s.startsAt, s.endsAt)} hrs
                              {nc && ` · ${NOT_COVERED_LABELS[nc.by].toLowerCase()} — nobody is scheduled and nothing is billed`}
                              {s.caregiverName && ` · ${s.projectedWeekHours} hrs projected this week`}
                              {!nc && !s.caregiverName && whyOpen(ranked) && <> · {whyOpen(ranked)}</>}
                            </span>
                          </span>
                          {nc ? (
                            <span className="flex-none rounded-full bg-[var(--wash-strong)] px-2 py-[2px] text-[11px] font-semibold uppercase text-[var(--ink-body)]">{NOT_COVERED_SHORT[nc.by]}</span>
                          ) : s.caregiverName ? (
                            ot > 0 ? (
                              <span className="flex-none rounded-full bg-[#FDEAD7] px-2 py-[2px] text-[11px] font-semibold text-[#B54708]">{ot} HR OT</span>
                            ) : s.pinned ? (
                              <span className="flex flex-none items-center gap-1 rounded-full bg-[var(--wash-strong)] px-2 py-[2px] text-[11px] font-semibold text-[var(--ink-body)]">
                                <Pin className="h-2.5 w-2.5" aria-hidden="true" />
                                PINNED
                              </span>
                            ) : null
                          ) : (
                            <span className="flex-none rounded-full border border-[#C9CEF2] px-2 py-[2px] text-[11px] font-semibold text-primary">OPEN</span>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="flex-none rounded-[8px] border border-[var(--hairline)] px-2.5 py-1 text-[12.5px] transition-colors hover:bg-[var(--wash)]">
                                {nc ? NOT_COVERED_SHORT[nc.by] : s.caregiverName ?? "Choose"}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-[min(70vh,520px)] w-[290px] overflow-y-auto">
                              <DropdownMenuItem onSelect={() => setSplitting({ shiftId: s.id, at: midpoint(s) })}>
                                <Scissors className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Split this shift…
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setRetiming({ shiftId: s.id, startsAt: toLocal(s.startsAt), endsAt: toLocal(s.endsAt) })}>
                                <Clock className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Edit the times…
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => removeShift(s.id)}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Remove this shift
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {nc ? (
                                <DropdownMenuItem onSelect={() => setNotCovered(s.id, null)}>
                                  <Users className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                  Joy needs to cover this after all
                                </DropdownMenuItem>
                              ) : (
                                (Object.keys(NOT_COVERED_LABELS) as NotCoveredBy[]).map((by) => (
                                  <DropdownMenuItem key={by} onSelect={() => setNotCovered(s.id, by)}>
                                    <Users className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                    {NOT_COVERED_LABELS[by]}
                                  </DropdownMenuItem>
                                ))
                              )}
                              <DropdownMenuSeparator />
                              {s.caregiverName && (
                                <>
                                  <DropdownMenuItem onSelect={() => togglePin(s.id)}>
                                    <Pin className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                    {s.pinned ? "Unpin" : "Pin this assignment"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => assign(s.id, null)}>Leave open</DropdownMenuItem>
                                </>
                              )}
                              {ranked.slice(0, 8).map((r) => (
                                <DropdownMenuItem key={r.caregiverName} disabled={r.blocked} onSelect={() => assign(s.id, r.caregiverName)} className="flex-col items-start gap-0">
                                  <span className="text-[13px]">{r.caregiverName}</span>
                                  <span className="text-[11.5px] text-muted-foreground">
                                    {r.blocked ? r.blockedReason : `${r.projectedHours} hrs projected${r.overtimeHours > 0 ? ` · ${r.overtimeHours} OT` : ""}${r.previousShiftsWithClient > 0 ? ` · ${r.previousShiftsWithClient} previous shifts` : ""}`}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {retiming?.shiftId === s.id && (
                            <div className="flex w-full flex-wrap items-end gap-2 border-t border-[var(--hairline-soft)] pt-2">
                              <div className="space-y-1">
                                <Label htmlFor={`retime-start-${s.id}`} className="text-[12px] font-medium">
                                  Starts
                                </Label>
                                <Input id={`retime-start-${s.id}`} type="datetime-local" value={retiming.startsAt} min={toLocal(plan.startsAt)} max={toLocal(plan.endsAt)} onChange={(e) => setRetiming({ ...retiming, startsAt: e.target.value })} className="h-8 w-[210px]" />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`retime-end-${s.id}`} className="text-[12px] font-medium">
                                  Ends
                                </Label>
                                <Input id={`retime-end-${s.id}`} type="datetime-local" value={retiming.endsAt} min={toLocal(plan.startsAt)} max={toLocal(plan.endsAt)} onChange={(e) => setRetiming({ ...retiming, endsAt: e.target.value })} className="h-8 w-[210px]" />
                              </div>
                              <Button size="sm" disabled={!!retimeProblem} onClick={doRetime}>
                                Save times
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setRetiming(null)}>
                                Cancel
                              </Button>
                              {retimeProblem && <span className="basis-full text-[12px] text-[#B54708]">{retimeProblem}</span>}
                            </div>
                          )}
                          {splitting?.shiftId === s.id && (
                            <div className="flex w-full flex-wrap items-center gap-2 border-t border-[var(--hairline-soft)] pt-2">
                              <Label htmlFor={`split-${s.id}`} className="text-[12px] font-medium">
                                Split at
                              </Label>
                              <Input id={`split-${s.id}`} type="datetime-local" value={splitting.at} min={toLocal(s.startsAt)} max={toLocal(s.endsAt)} onChange={(e) => setSplitting({ shiftId: s.id, at: e.target.value })} className="h-8 w-[210px]" />
                              <Button size="sm" onClick={doSplit}>
                                Split
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setSplitting(null)}>
                                Cancel
                              </Button>
                              <span className="text-[11.5px] text-muted-foreground">Two shifts, each with its own caregiver, family or open.</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {week.shifts
                    .filter((s) => s.caregiverName && s.projectedOtHours > 0)
                    .map((s) => (
                      <div key={`ot-${s.id}`} className="mt-1.5 rounded-[10px] border border-[#F5C9A6] bg-[#FEF6EE] px-3.5 py-3">
                        <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-[#B54708]">
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          This assignment creates overtime
                        </p>
                        <p className="m-0 pt-1 text-[12.5px] text-[var(--ink-body)]">
                          {s.caregiverName} is projected for {Math.round((s.projectedWeekHours - hoursBetween(s.startsAt, s.endsAt)) * 100) / 100} hours before this shift. Adding it brings them to <strong>{s.projectedWeekHours} hours</strong>, including{" "}
                          <strong>
                            {s.projectedOtHours} projected overtime {s.projectedOtHours === 1 ? "hour" : "hours"}
                          </strong>
                          .
                        </p>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => assign(s.id, null)}>
                            Choose another caregiver
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!s.caregiverName) return;
                              approveCoverageOvertime(plan.id, { caregiverName: s.caregiverName, hours: s.projectedOtHours, weekStart: week.weekStart, reason: "" });
                              setPlan({
                                ...plan,
                                overtimeApprovals: [
                                  ...plan.overtimeApprovals.filter((a) => !(a.caregiverName === s.caregiverName && a.weekStart === week.weekStart)),
                                  { caregiverName: s.caregiverName, hours: s.projectedOtHours, weekStart: week.weekStart, reason: null, approvedBy: currentUser.name, approvedAt: new Date().toISOString() },
                                ],
                              });
                              toast.success(`${s.projectedOtHours} hours of overtime approved`, { description: `${s.caregiverName} · approved by ${currentUser.name}. It is on the record.` });
                            }}
                          >
                            Approve {s.projectedOtHours} {s.projectedOtHours === 1 ? "hour" : "hours"} OT
                          </Button>
                        </div>
                      </div>
                    ))}
                </section>
              ))}
              <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 py-3">
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={adding}
                    onChange={(e) => {
                      setAdding(e.target.checked);
                      if (e.target.checked && !addStart) setAddStart(toLocal(plan.startsAt));
                    }}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Add a shift by date and time
                </label>
                {adding && (
                  <div className="mt-2.5 flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="cov-add-start" className="text-[12px] font-medium">
                        Starts
                      </Label>
                      <Input id="cov-add-start" type="datetime-local" value={addStart} min={toLocal(plan.startsAt)} max={toLocal(plan.endsAt)} onChange={(e) => setAddStart(e.target.value)} className="h-9 w-[210px]" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cov-add-end" className="text-[12px] font-medium">
                        Ends
                      </Label>
                      <Input id="cov-add-end" type="datetime-local" value={addEnd} min={toLocal(plan.startsAt)} max={toLocal(plan.endsAt)} onChange={(e) => setAddEnd(e.target.value)} className="h-9 w-[210px]" />
                    </div>
                    <Button size="sm" disabled={!!addProblem} onClick={doAdd}>
                      <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Add shift
                    </Button>
                    {addProblem && addStart && addEnd && <span className="basis-full text-[12px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">{addProblem}</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-[var(--hairline)] bg-[var(--paper)] px-5 py-3.5">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
              Back
            </Button>
          )}
          <span className="flex-1" />
          {step === 1 && (
            <Button disabled={!!problem} onClick={() => setStep(2)}>
              <Users className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Choose caregivers
            </Button>
          )}
          {step === 2 && <Button onClick={() => build(draftShifts)}>Build coverage plan</Button>}
          {step === 3 && plan && (
            <>
              <Button variant="outline" onClick={fillRemaining}>
                Fill remaining coverage
              </Button>
              {plan.approvedAt ? (
                <Button
                  onClick={() => {
                    saveCoverageEvent(plan);
                    onOpenChange(false);
                    const s = coverageSummary(plan.shifts);
                    toast.success("Coverage updated", { description: s.openShifts === 0 ? "Every shift is covered." : `${s.openShifts} ${s.openShifts === 1 ? "shift is" : "shifts are"} open and in Needs you.` });
                  }}
                >
                  <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Save changes
                </Button>
              ) : (
                <Button
                  disabled={!!notApprovable}
                  title={notApprovable ?? undefined}
                  onClick={() => {
                    saveCoverageEvent(plan);
                    approveCoveragePlan(plan.id);
                    onOpenChange(false);
                    const s = coverageSummary(plan.shifts);
                    toast.success("Coverage plan approved", {
                      description: s.openShifts === 0 ? `${plan.shifts.length} shifts are on the schedule. Nobody has been notified — Spruce is not wired up.` : `${plan.shifts.length} shifts on the schedule, ${s.openShifts} still open and in Needs you.`,
                    });
                  }}
                >
                  <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Approve coverage plan
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
