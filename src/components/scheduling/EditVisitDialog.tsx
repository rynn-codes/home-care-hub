import { useEffect, useMemo, useState } from "react";
import { Plus, Repeat, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoyWarns } from "@/components/scheduling/joy";
import { LocationPicker } from "@/components/scheduling/LocationPicker";
import { ExpensesDialog } from "@/components/scheduling/ExpensesDialog";
import { ChangeConfirmSheet, type PendingChange } from "@/components/scheduling/ChangeConfirmSheet";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { seedEmployees } from "@/lib/employeesSeed";
import { findConflicts, type Visit } from "@/domain/scheduling/conflicts";
import { EDIT_STATUS_LABELS, SCOPE_LABELS, editStatus, visitDisplayId, type EditScope } from "@/domain/scheduling/visitState";
import { seriesPattern, seriesPatternLine } from "@/domain/scheduling/clientSchedule";
import { SERVICES, describeMix, hoursLabel, splitHours, validateServiceLines, type ServiceLine, type ServiceShare } from "@/domain/scheduling/serviceMix";
import type { ApprovedLocation } from "@/domain/scheduling/locations";
import { expensesLine, live, type VisitExpense } from "@/domain/scheduling/expenses";
import { marginLine, visitMargin, whyNoMargin, type RateKind, type VisitPay } from "@/domain/scheduling/visitPay";
import { CONFIRM_SOURCES, REASON_CODES, REASON_GROUP_LABELS, reasonCode, validateCorrection, type ReasonGroup } from "@/domain/scheduling/clockCorrections";
import { onCallNote, reviewSummary, reviewVisit, roleAbbreviation, validateMileage } from "@/domain/scheduling/visitReview";
import type { VisitMileage } from "@/lib/schedulingExtrasSeed";

export interface VisitEdit {
  date: string;
  start: string;
  end: string;
  endsOn: string;
  caregiverName: string | null;
  serviceLines: ServiceLine[];
  rate: number | null;
  rateKind: RateKind;
  actualIn: string;
  actualOut: string;
  inLocationId: string | null;
  outLocationId: string | null;
  actualMiles: number;
  milesNote: string;
  reasonCode: string;
  actionCode: string;
  note: string;
  onCall: boolean;
  payNextDay: boolean;
  expenses: VisitExpense[];
}

const REASON_ORDER: ReasonGroup[] = ["schedule", "clock", "data", "authorization", "disaster", "other"];
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const ymd = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const weekdayOf = (date: string) => {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { weekday: "long" });
};
const titleCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
const clockLabel = (t: string) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/**
 * Edit a visit: what was scheduled, the plan of care, the pay rate, the
 * clock, where it was taken, expenses and the reason the record is being
 * revised — with Joy checking as you go.
 */
export function EditVisitDialog({
  open,
  onOpenChange,
  visit,
  scope,
  affected,
  allVisits,
  clockedInAt,
  clockedOutAt,
  rate,
  standardRate,
  clientRate,
  pay,
  currentUserName,
  showProfit = true,
  expenses,
  gpsMiles,
  mix,
  locations,
  pings,
  otherHoursThisWeek,
  payrollWeek,
  onProposeLocation,
  mileage,
  mileageRatePerMile,
  onSave,
  review,
  onAskForPhone,
  phoneAskPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: Visit | null;
  scope: EditScope;
  affected: readonly Visit[];
  allVisits: readonly Visit[];
  clockedInAt: string | null;
  clockedOutAt: string | null;
  rate: number | null;
  standardRate: number | null;
  clientRate: number | null;
  pay: VisitPay | null;
  currentUserName: string;
  showProfit?: boolean;
  expenses: readonly VisitExpense[];
  gpsMiles: number | null;
  mix: ServiceShare[];
  locations: readonly ApprovedLocation[];
  pings: ReadonlyArray<{ at: string; feet: number }>;
  otherHoursThisWeek: number;
  payrollWeek: string;
  onProposeLocation: (label: string, address: string) => ApprovedLocation | null;
  mileage: VisitMileage | null;
  mileageRatePerMile: number;
  onSave: (edit: VisitEdit) => void;
  /** Builds the confirmation for an edit; null means nothing changed. */
  review?: (edit: VisitEdit) => PendingChange | null;
  onAskForPhone?: (caregiverName: string) => void;
  phoneAskPending?: boolean;
}) {
  const { employeeEdits } = useDemo();
  const [asked, setAsked] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [who, setWho] = useState("");
  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [ranDifferently, setRanDifferently] = useState(false);
  const [rateText, setRateText] = useState("");
  const [rateKind, setRateKind] = useState<RateKind>("hourly");
  const [actualIn, setActualIn] = useState("");
  const [actualOut, setActualOut] = useState("");
  const [inLoc, setInLoc] = useState<string | null>(null);
  const [outLoc, setOutLoc] = useState<string | null>(null);
  const [outSame, setOutSame] = useState(true);
  const [items, setItems] = useState<VisitExpense[]>([]);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [onCall, setOnCall] = useState(false);
  const [payNextDay, setPayNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<{ change: PendingChange; edit: VisitEdit } | null>(null);
  const mileageItem = live(items).find((e) => e.category === "mileage") ?? null;
  const milesText = mileageItem ? String(mileageItem.miles) : "";
  const milesNote = mileageItem ? [mileageItem.tripFrom, mileageItem.tripTo].filter(Boolean).join(" → ") || mileageItem.description : "";

  useEffect(() => {
    if (!open || !visit) return;
    setAsked(!!phoneAskPending);
    setDate(ymd(visit.startsAt));
    setStart(hhmm(visit.startsAt));
    setEnd(hhmm(visit.endsAt));
    setWho(visit.caregiverName ?? "");
    setLines([]);
    setRanDifferently(false);
    setRateText(pay?.rate != null ? String(pay.rate) : rate === null ? "" : String(rate));
    setRateKind(pay?.rateKind ?? "hourly");
    setActualIn(clockedInAt ? hhmm(clockedInAt) : "");
    setActualOut(clockedOutAt ? hhmm(clockedOutAt) : "");
    setInLoc(null);
    setOutLoc(null);
    setOutSame(true);
    setOnCall(pay?.onCall ?? false);
    setPayNextDay(pay?.payNextDay ?? false);
    // Mileage recorded the old way surfaces as an expense line so there is one place for it.
    const seeded: VisitExpense[] =
      expenses.length === 0 && mileage && mileage.actualMiles > 0
        ? [
            {
              id: `exp-${visit.id}-mileage`,
              visitId: visit.id,
              date: ymd(visit.startsAt),
              category: "mileage",
              otherKind: "",
              description: mileage.note,
              amount: 0,
              miles: mileage.actualMiles,
              milesFrom: "typed",
              tripFrom: locations[0]?.label ?? "",
              tripTo: mileage.note,
              receipt: null,
              recordedBy: visit.caregiverName ?? "",
              recordedOn: visit.startsAt,
              reviewedBy: null,
              reviewedAt: null,
              deletedBy: null,
              deletedAt: null,
            },
          ]
        : [...expenses];
    setItems(seeded);
    setReason("");
    setAction("");
    setNote("");
  }, [open, visit, rate, pay, clockedInAt, clockedOutAt, mileage, phoneAskPending, expenses, locations]);
  useEffect(() => {
    if (open && inLoc === null && locations.length > 0) setInLoc(locations[0].id);
  }, [open, inLoc, locations]);

  const caregivers = useMemo(() => seedEmployees.filter((e) => e.role !== "office" && e.status === "active"), []);
  const chosen = useMemo(() => seedEmployees.find((e) => e.name === who) ?? null, [who]);
  const chosenPhone = chosen ? employeeEdits[chosen.id]?.phoneMobile || chosen.phone : null;
  const pattern = useMemo(() => (visit ? seriesPattern(visit, allVisits) : null), [visit, allVisits]);
  const overnight = !!(start && end && end <= start);
  const endsOn = useMemo(() => {
    if (!date || !overnight) return date;
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return ymd(d.toISOString());
  }, [date, overnight]);
  const hours = useMemo(() => (!date || !start || !end || end === start ? 0 : Math.round(((Date.parse(`${endsOn}T${end}:00`) - Date.parse(`${date}T${start}:00`)) / 3_600_000) * 100) / 100), [date, endsOn, start, end]);
  useEffect(() => {
    if (hours > 0 && !ranDifferently) setLines(splitHours(mix, hours));
  }, [hours, mix, ranDifferently]);

  const payRate = rateText.trim() === "" ? null : Number(rateText);
  const checks = useMemo(() => {
    const at = (t: string, d: string) => (t ? `${d}T${t}:00` : null);
    const inAt = at(actualIn, date);
    const outAt = at(actualOut, endsOn);
    const actual = inAt && outAt ? Math.max(0, Math.round(((Date.parse(outAt) - Date.parse(inAt)) / 3_600_000) * 100) / 100) : hours;
    return reviewVisit({
      clockedInAt: inAt,
      clockedOutAt: outAt,
      pings,
      inLocation: locations.find((l) => l.id === inLoc) ?? null,
      outLocation: locations.find((l) => l.id === outLoc) ?? null,
      outSameAsIn: outSame,
      scheduledHours: hours,
      actualHours: actual,
      otherHoursThisWeek,
      payrollWeek,
      clientName: visit?.clientName ?? "",
      expenses: items,
      mileageRatePerMile,
      payRate,
      standardRate,
      rateKind,
      caregiverName: who || null,
      onCall,
      payNextDay,
    });
  }, [actualIn, actualOut, date, endsOn, hours, pings, locations, inLoc, outLoc, outSame, otherHoursThisWeek, payrollWeek, visit?.clientName, mileageRatePerMile, who, items, payRate, rateKind, standardRate, onCall, payNextDay]);
  const conflicts = useMemo(() => {
    if (!visit || !date || !start || !end || end === start) return [];
    const proposed: Visit = { ...visit, caregiverName: who || null, startsAt: `${date}T${start}:00`, endsAt: `${endsOn}T${end}:00` };
    return findConflicts(proposed, allVisits.filter((v) => !affected.some((a) => a.id === v.id)));
  }, [visit, date, endsOn, start, end, who, allVisits, affected]);
  const blocked = conflicts.some((c) => c.severity === "blocking");
  const scheduleChanged = !!(visit && (date !== ymd(visit.startsAt) || start !== hhmm(visit.startsAt) || end !== hhmm(visit.endsAt) || (who || null) !== visit.caregiverName));
  const clockChanged = (clockedInAt ? hhmm(clockedInAt) : "") !== actualIn || (clockedOutAt ? hhmm(clockedOutAt) : "") !== actualOut;
  const needsReason = scheduleChanged || clockChanged;
  const worked = (() => {
    if (!actualIn || !actualOut) return 0;
    const a = Date.parse(`${date}T${actualIn}:00`);
    const b = Date.parse(`${endsOn}T${actualOut}:00`);
    return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.max(0, Math.round(((b - a) / 3_600_000) * 100) / 100);
  })();
  const inPast = !!(visit && Date.parse(visit.startsAt) < Date.now());
  const total = payRate === null || !(payRate > 0) ? null : rateKind === "daily" ? payRate : Math.round(payRate * hours * 100) / 100;
  const margin = visitMargin({ payRate, rateKind, clientRate, hours });
  const onCallText = onCallNote({ onCall, payRate, standardRate, caregiverName: who || null });
  const edit = (): VisitEdit => ({
    date,
    start,
    end,
    endsOn,
    caregiverName: who || null,
    serviceLines: lines,
    rate: payRate,
    rateKind,
    actualIn,
    actualOut,
    inLocationId: inLoc,
    outLocationId: outSame ? inLoc : outLoc,
    actualMiles: milesText.trim() === "" ? 0 : Number(milesText),
    milesNote: milesNote.trim(),
    reasonCode: reason,
    actionCode: action,
    note: note.trim(),
    onCall,
    payNextDay: onCall && payNextDay,
    expenses: items,
  });
  const problem = (() => {
    if (!date) return "Pick the day.";
    if (!start || !end) return "Fill in the start and the end.";
    if (end === start) return "The end is the same as the start.";
    if (blocked) return conflicts.find((c) => c.severity === "blocking")!.message;
    const lineProblem = validateServiceLines(lines, hours);
    if (lineProblem) return lineProblem;
    if (payRate !== null && !(payRate > 0)) return "The rate has to be a number above zero.";
    if (actualOut && !actualIn) return "There is a clock-out with no clock-in.";
    const miles = validateMileage({ actualMiles: milesText.trim() === "" ? 0 : Number(milesText), note: milesNote });
    if (miles) return miles;
    if (inLoc === null) return "Pick where the clock-in was taken.";
    if (!outSame && outLoc === null) return "Pick where the clock-out was taken.";
    return needsReason ? validateCorrection({ reasonCode: reason, actionCode: action, note }) : null;
  })();

  if (!visit) return null;
  const status = editStatus({ visit, clockedInAt, clockedOutAt, now: new Date() });
  const select = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const heading = "text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground";
  const setLine = (i: number, patch: Partial<ServiceLine>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <span className="text-[11px] font-semibold uppercase tracking-[.085em] text-muted-foreground">Edit visit</span>
          <DialogTitle className="text-[19px] tracking-[-.015em]">{visit.clientName}</DialogTitle>
          <DialogDescription className="sr-only">
            Visit {visitDisplayId(visit.id)} · {SCOPE_LABELS[scope]}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                status === "complete" && "bg-[#ECFDF3] text-[#027A48]",
                (status === "needs_clock_out" || status === "missed_clock_in") && "bg-[#FDF3F3] text-[#98322C]",
                status === "in_progress" && "bg-[#EEF0FE] text-primary",
                status === "unassigned" && "bg-[#FFFAEB] text-[#B54708]",
                status === "upcoming" && "bg-[var(--wash-strong)] text-[var(--ink-body)]",
              )}
            >
              {EDIT_STATUS_LABELS[status]}
            </span>
            {onCall && <span className="rounded-full border border-[#D6BBFB] bg-[#F4EBFF] px-2.5 py-[3px] text-[11.5px] font-medium text-[#6941C6]">On-call shift</span>}
            <span className="text-[12px] text-muted-foreground tabular-nums">
              Visit {visitDisplayId(visit.id)} · {SCOPE_LABELS[scope].toLowerCase()}
              {affected.length > 1 ? ` · ${affected.length} visits` : ""}
            </span>
          </div>
          {pattern && (
            <p className={cn("m-0 flex items-start gap-2 rounded-[9px] px-3 py-2 text-[12.5px] leading-[1.45]", pattern.differs ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[var(--wash)] text-muted-foreground")}>
              <Repeat className="mt-[2px] h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {seriesPatternLine(pattern, visit, clockLabel)}
            </p>
          )}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={heading}>What was scheduled</h3>
              <span className="text-[12.5px] font-medium tabular-nums">
                {hours.toFixed(1)} hrs{total === null ? "" : ` · $${total.toFixed(2)}`}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_72px] gap-3">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-date" className="flex items-baseline gap-1.5 text-[12px] font-medium">
                  Day{weekdayOf(date) && <span className="font-normal text-muted-foreground">· {weekdayOf(date)}</span>}
                </Label>
                <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-w-0" />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-start" className="text-[12px] font-medium">
                  Start
                </Label>
                <Input id="edit-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0" />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-end" className="text-[12px] font-medium">
                  End
                </Label>
                <Input id="edit-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-0" />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-hours" className="text-[12px] font-medium">
                  Hours
                </Label>
                <output id="edit-hours" className="flex h-10 w-full items-center justify-end rounded-md border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 text-sm tabular-nums text-muted-foreground">
                  {hours.toFixed(1)}
                </output>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-staff" className="text-[12px] font-medium">
                Caregiver
              </Label>
              <select id="edit-staff" value={who} onChange={(e) => setWho(e.target.value)} className={select}>
                <option value="">Nobody yet — open shift</option>
                {caregivers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} · {roleAbbreviation(c.title)}
                  </option>
                ))}
              </select>
              {chosen && (
                <p className={cn("m-0 pt-0.5 text-[12px]", chosenPhone ? "text-muted-foreground" : "text-[#B54708]")}>
                  {chosenPhone ? (
                    <a href={`tel:${chosenPhone}`} className="text-primary hover:underline">
                      {chosenPhone}
                    </a>
                  ) : (
                    "No phone number on file — Joy can't send her a reminder."
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2 rounded-[10px] border border-[var(--hairline)] p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className={heading}>Plan of care</span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                  {Math.round(lines.reduce((sum, l) => sum + (l.hours || 0), 0) * 100) / 100} of {hours} hrs
                </span>
              </div>
              <p className="m-0 text-[12px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
                {ranDifferently ? <>Changed for this visit only — the care plan still says {describeMix(mix).toLowerCase()}.</> : <>From {visit.clientName}'s care plan · {describeMix(mix).toLowerCase()}</>}
              </p>
              {!ranDifferently &&
                lines.map((l) => (
                  <div key={l.service} className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline-soft)] py-1.5 last:border-b-0">
                    <span className="min-w-0 truncate text-[13px]">{titleCase(l.service)}</span>
                    <span className="flex-none text-[13px] tabular-nums text-muted-foreground">{hoursLabel(l.hours)}</span>
                  </div>
                ))}
              {ranDifferently &&
                lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_78px_32px] items-center gap-2">
                    <select value={l.service} aria-label={`Service ${i + 1}`} onChange={(e) => setLine(i, { service: e.target.value })} className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-[13px]">
                      {SERVICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Input type="number" min="0" step="0.25" aria-label={`Hours for ${l.service}`} value={String(l.hours)} onChange={(e) => setLine(i, { hours: Number(e.target.value) })} className="h-9 min-w-0 text-right" />
                    <button
                      type="button"
                      aria-label={`Remove ${l.service}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                      className="flex h-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--wash)] disabled:opacity-30"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              {ranDifferently ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        { service: SERVICES.find((s) => !prev.some((l) => l.service === s)) ?? SERVICES[0], hours: Math.max(0, Math.round((hours - prev.reduce((sum, l) => sum + (l.hours || 0), 0)) * 100) / 100) },
                      ])
                    }
                    disabled={lines.length >= SERVICES.length}
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--wash)] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add a service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRanDifferently(false);
                      setLines(splitHours(mix, hours));
                    }}
                    className="h-8 rounded-md px-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--wash)]"
                  >
                    Back to the care plan
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setRanDifferently(true)} className="h-8 rounded-md px-2 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--wash)]">
                  This visit ran differently
                </button>
              )}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-rate" className="text-[12px] font-medium">
                  Pay Rate
                </Label>
                <Input id="edit-rate" type="number" min="0" step="0.5" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder={rate === null ? "None on file" : undefined} className="min-w-0" />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-rate-kind" className="text-[12px] font-medium">
                  Billed
                </Label>
                <select id="edit-rate-kind" value={rateKind} onChange={(e) => setRateKind(e.target.value as RateKind)} className={select}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-total" className="text-[12px] font-medium">
                  Visit total
                </Label>
                <output id="edit-total" className="flex h-10 w-full min-w-0 items-center rounded-md border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 text-sm tabular-nums text-muted-foreground">
                  {total === null ? "—" : `$${total.toFixed(2)}`}
                </output>
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor="edit-client-rate" className="text-[12px] font-medium">
                  Client Rate
                </Label>
                <output id="edit-client-rate" className="flex h-10 w-full min-w-0 items-center rounded-md border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 text-sm tabular-nums text-muted-foreground">
                  {clientRate === null ? "Not on file" : `$${clientRate.toFixed(2)}/hr`}
                </output>
              </div>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {showProfit ? (
                <p className={cn("m-0 min-w-0 flex-1 text-[12px] leading-[1.45] [text-wrap:pretty]", margin && margin.margin < 0 ? "text-[#B54708]" : "text-muted-foreground")} data-testid="edit-margin">
                  {margin ? `${marginLine(margin)} · before employer taxes and expenses` : whyNoMargin({ payRate, clientRate })}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <label className="flex flex-none items-center gap-2 whitespace-nowrap text-[13px]">
                <input type="checkbox" checked={onCall} onChange={(e) => setOnCall(e.target.checked)} className="h-4 w-4 rounded border-[var(--hairline)]" />
                On-call shift
              </label>
            </div>
            {onCallText && (
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 rounded-[9px] bg-[#FFFAEB] px-3 py-2">
                <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">{onCallText}</span>
                <label className="flex flex-none items-center gap-2 whitespace-nowrap text-[12.5px] text-[#B54708]">
                  <input type="checkbox" checked={payNextDay} onChange={(e) => setPayNextDay(e.target.checked)} className="h-4 w-4 rounded border-[var(--hairline)]" />
                  Pay out next day
                </label>
              </div>
            )}
            {chosen && !chosenPhone && onAskForPhone && (
              <div className="flex flex-col gap-2 rounded-[11px] border border-[#DDE1FA] bg-[#F7F8FE] px-3.5 py-3">
                <span className="flex gap-2 text-[12.5px] leading-[1.45] [text-wrap:pretty]">
                  <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
                  <span>{chosen.name.split(" ")[0]} has no phone number on file, so no clock-out reminder can reach her. Joy can ask her for one in the app.</span>
                </span>
                <span className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={asked}
                    onClick={() => {
                      onAskForPhone(chosen.name);
                      setAsked(true);
                    }}
                    className={cn("h-9 rounded-lg px-3.5 text-[13px] font-medium transition-colors", asked ? "cursor-default bg-[var(--wash-strong)] text-muted-foreground" : "bg-[var(--ink-strong)] text-white hover:bg-[#2E3269]")}
                  >
                    {asked ? `Asked ${chosen.name.split(" ")[0]}` : `Ask ${chosen.name.split(" ")[0]} for her number`}
                  </button>
                  <span className="text-[12.5px] text-muted-foreground">{asked ? "Waiting on her — it is on her app home" : "Sends an app message"}</span>
                </span>
              </div>
            )}
          </section>
          <section className="border-t border-[var(--hairline)] pt-4">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
              <div className="min-w-0 space-y-3">
                <div className="space-y-0.5">
                  <h3 className="m-0 text-[14px] font-semibold tracking-[-.01em]">Clock-in and clock-out</h3>
                  <p className="m-0 text-[12.5px] text-muted-foreground">
                    Scheduled {clockLabel(start)} – {clockLabel(end)}.
                  </p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px] gap-3">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="edit-in" className="text-[12px] font-medium">
                      Clocked in
                    </Label>
                    <Input id="edit-in" type="time" value={actualIn} onChange={(e) => setActualIn(e.target.value)} className="min-w-0" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="edit-out" className="text-[12px] font-medium">
                      Clocked out
                    </Label>
                    <Input id="edit-out" type="time" value={actualOut} onChange={(e) => setActualOut(e.target.value)} className="min-w-0" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="edit-worked" className="text-[12px] font-medium">
                      Hours
                    </Label>
                    <output id="edit-worked" className="flex h-10 w-full items-center justify-end rounded-md border border-dashed border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 text-sm tabular-nums text-muted-foreground">
                      {worked}
                    </output>
                  </div>
                </div>
                <LocationPicker
                  id="edit-in-loc"
                  label="Clock-in location"
                  locations={locations}
                  value={inLoc}
                  onPick={setInLoc}
                  onPropose={(label, address) => {
                    const l = onProposeLocation(label, address);
                    if (l) setInLoc(l.id);
                  }}
                />
                <LocationPicker
                  id="edit-out-loc"
                  label="Clock-out location"
                  locations={locations}
                  value={outSame ? null : outLoc}
                  sameAs={outSame ? locations.find((l) => l.id === inLoc) ?? null : null}
                  onSame={() => setOutSame(true)}
                  onPick={(id) => {
                    setOutSame(false);
                    setOutLoc(id);
                  }}
                  onPropose={(label, address) => {
                    const l = onProposeLocation(label, address);
                    if (l) {
                      setOutSame(false);
                      setOutLoc(l.id);
                    }
                  }}
                />
                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--hairline-soft)] pt-3">
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={items.length > 0 || expensesOpen}
                      onChange={(e) => {
                        if (e.target.checked) setExpensesOpen(true);
                        else setItems([]);
                      }}
                      className="h-4 w-4 rounded border-[var(--hairline)]"
                    />
                    Expenses on this visit
                  </label>
                  {items.length > 0 && (
                    <>
                      <span className="text-[12.5px] text-muted-foreground">{expensesLine(items, mileageRatePerMile)}</span>
                      <button type="button" onClick={() => setExpensesOpen(true)} className="text-[12.5px] text-primary underline-offset-2 hover:underline">
                        Edit
                      </button>
                    </>
                  )}
                </div>
                {needsReason && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-reason" className={heading}>
                      Reason
                    </Label>
                    <select id="edit-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={select}>
                      <option value="">Why this visit is being revised</option>
                      {REASON_ORDER.map((g) => {
                        const codes = REASON_CODES.filter((c) => c.group === g);
                        return codes.length === 0 ? null : (
                          <optgroup key={g} label={REASON_GROUP_LABELS[g]}>
                            {codes.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.plain}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    {reason !== "" && (
                      <span className="block pt-0.5 text-[11px] text-muted-foreground">
                        Recorded as ({reason}) {reasonCode(reason)?.label}
                      </span>
                    )}
                  </div>
                )}
                {needsReason && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-action" className={heading}>
                      Confirmed by
                    </Label>
                    <select id="edit-action" value={action} onChange={(e) => setAction(e.target.value)} className={select}>
                      <option value="">How you know</option>
                      {CONFIRM_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {needsReason && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-note" className={heading}>
                      Note
                    </Label>
                    <Input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said, and who said it" />
                  </div>
                )}
              </div>
              <div className="min-w-0 rounded-[11px] bg-[#F7F7FC] p-3.5">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.085em] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Joy is checking
                </span>
                <div className="mt-2.5 flex flex-col gap-2.5">
                  {checks.map((c) => (
                    <div key={c.key} className="flex gap-2">
                      <span
                        className={cn(
                          "mt-[1px] flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold",
                          c.verdict === "pass" && "bg-[#ECFDF3] text-[#027A48]",
                          c.verdict === "warn" && "bg-[#FFFAEB] text-[#B54708]",
                          c.verdict === "blocked" && "bg-[#FDF3F3] text-[#98322C]",
                          c.verdict === "unknown" && "bg-[var(--wash-strong)] text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {c.verdict === "pass" ? "✓" : c.verdict === "unknown" ? "–" : "!"}
                      </span>
                      <span className="flex min-w-0 flex-col leading-[1.35]">
                        <span className="text-[12.5px] font-medium">{c.title}</span>
                        <span className="text-[12px] text-muted-foreground [text-wrap:pretty]">{c.detail}</span>
                      </span>
                    </div>
                  ))}
                  {inPast && !actualIn && !actualOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setActualIn(start);
                        setActualOut(end);
                      }}
                      className="mt-1 h-9 self-start rounded-lg bg-[var(--ink-strong)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2E3269]"
                    >
                      Use scheduled times
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
          {conflicts.length > 0 && (
            <JoyWarns title={blocked ? "Why this conflicts" : "Worth knowing"}>
              {conflicts.slice(0, 3).map((c, i) => (
                <p key={i} className="m-0 [&+p]:mt-1">
                  {c.message}
                </p>
              ))}
            </JoyWarns>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <span className={cn("order-last text-[12.5px] sm:order-first sm:self-center", problem ? "text-[#B54708]" : "text-muted-foreground")}>{problem ?? reviewSummary(checks)}</span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={problem !== null}
              onClick={() => {
                if (problem !== null) return;
                const e = edit();
                const change = review?.(e) ?? null;
                if (!change) {
                  onSave(e);
                  onOpenChange(false);
                  return;
                }
                setPending({ change, edit: e });
              }}
            >
              {affected.length > 1 ? `Save ${affected.length} visits` : "Save visit"}
            </Button>
          </span>
        </DialogFooter>
        <ExpensesDialog
          open={expensesOpen}
          onOpenChange={setExpensesOpen}
          visitId={visit.id}
          visitDate={date}
          caregiverName={who || visit.caregiverName || "Caregiver"}
          existing={items}
          ratePerMile={mileageRatePerMile}
          gpsMiles={gpsMiles}
          tripStart={locations[0]?.label ?? null}
          reviewer={currentUserName}
          onSave={setItems}
        />
        <ChangeConfirmSheet
          change={pending?.change ?? null}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (!pending) return;
            onSave(pending.edit);
            setPending(null);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
