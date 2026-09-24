import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JoySuggests, JoyWarns, SmallButton } from "@/components/scheduling/joy";
import { ChangeConfirmSheet, type PendingChange } from "@/components/scheduling/ChangeConfirmSheet";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedApplicants } from "@/lib/hiringSeed";
import { clientRateFor } from "@/lib/clientRates";
import { OVERTIME_THRESHOLD_HOURS, findConflicts, type Visit } from "@/domain/scheduling/conflicts";
import { HOLIDAY_LABELS, holidayOn } from "@/domain/billing/holidays";
import { hoursLabel } from "@/domain/scheduling/serviceMix";
import { currentSchedule, describeSchedule, expansionHorizon, expansionSummary, scheduledDates, type ClientSchedule, type DayTimes } from "@/domain/scheduling/clientSchedule";
import {
  agoLabel,
  describeUsualWeek,
  nextFreeDay,
  officeVisitContext,
  shiftHours,
  suggestShift,
  suggestionEvidence,
  thatDayLine,
  usualWeek,
} from "@/domain/scheduling/newVisit";
import { bookSupervisoryVisit } from "@/domain/supervision/supervision";

export type NewVisitKind = "shift" | "client_visit" | "orientation" | "rn_assessment";
type Purpose = "client_visit" | "supervisory" | "training";

const KIND_LABELS: Record<NewVisitKind, string> = { shift: "New shift", client_visit: "Visit", orientation: "Orientation", rn_assessment: "RN assessment" };
const PURPOSE_OPTIONS: Record<Purpose, string> = {
  client_visit: "Client visit — somebody from the office going out",
  supervisory: "Supervisory visit — the RN's 90-day or annual check",
  training: "Training visit — a trainee paired with a caregiver",
};
const PURPOSE_LABELS: Record<Purpose, string> = { client_visit: "Client visit", supervisory: "Supervisory visit", training: "Training visit" };
const PURPOSE_MEANINGS: Record<Purpose, string> = {
  client_visit: "Somebody from the office going out to a client. Not a shift, not billed.",
  supervisory: "The supervision the service agreement commits Joy to — 90 days from start of care and annually after. Booking it here stops the clock on the client's record.",
  training: "A trainee shadowing a caregiver on a real visit. Both names go on it, because a trainee sent out alone is not training.",
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RNS = ["Kelsey Westley, RN", "Karynn Verrett, RN"];
const RN_USER = "u-karynn";
const stamp = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();
const clock = (hhmm: string) => {
  if (!hhmm) return "";
  const d = new Date(`2000-01-01T${hhmm}:00`);
  return Number.isNaN(d.getTime()) ? hhmm : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
const dayNames = (days: Record<number, DayTimes>) =>
  Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => DAYS[d])
    .join(", ");
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const waitingLabel = (a: { waitingSince?: string | null; meta?: string }) => {
  if (!a.waitingSince) return a.meta || "No date recorded";
  const since = new Date(a.waitingSince);
  if (Number.isNaN(since.getTime())) return a.meta || "No date recorded";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  since.setHours(12, 0, 0, 0);
  const days = Math.round((today.getTime() - since.getTime()) / 86_400_000);
  return days <= 0 ? "since today" : `${days} ${days === 1 ? "day" : "days"}`;
};
const fmtDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Quick Add: a shift (one-off or recurring), an office visit, an orientation
 * or an RN assessment — all onto the one Joy schedule. Joy reads the board
 * and offers what it sees; the person fills in or overrides.
 */
export function NewVisitDialog({
  open,
  onOpenChange,
  kind,
  repeatByDefault = false,
  visits,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: NewVisitKind;
  repeatByDefault?: boolean;
  visits: readonly Visit[];
  onAdded: (description: string) => void;
}) {
  const { addShift, addClientSchedule, clientSchedules, addScheduleEvent, scheduleAssessment, currentUser, newHires, admissions, households, bookSupervision } = useDemo();
  const today = new Date().toISOString().slice(0, 10);
  const [clientId, setClientId] = useState("");
  const [who, setWho] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");
  const [repeat, setRepeat] = useState(repeatByDefault);
  const [days, setDays] = useState<Record<number, DayTimes>>({});
  const [until, setUntil] = useState("");
  const [perDay, setPerDay] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [hire, setHire] = useState("");
  const [visitKind, setVisitKind] = useState<Purpose>("client_visit");
  const [paired, setPaired] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientId("");
    setWho(kind === "shift" ? "" : kind === "rn_assessment" ? (currentUser.rnLicence ? "Karynn Verrett, RN" : RNS[0]) : currentUser.name);
    setDate(today);
    setStart(kind === "rn_assessment" ? "10:00" : "09:00");
    setEnd(kind === "shift" ? "13:00" : kind === "rn_assessment" ? "11:30" : "10:00");
    setRepeat(repeatByDefault);
    setDays({});
    setUntil("");
    setPerDay(false);
    setPurpose("");
    setHire("");
    setVisitKind("client_visit");
    setPaired("");
  }, [open, kind, repeatByDefault, today, currentUser.name, currentUser.rnLicence]);
  useEffect(() => setDismissed(false), [clientId, open]);

  const clients = useMemo(() => seedClients.filter((c) => c.status === "active").map((c) => ({ id: c.personId, name: `${c.firstName} ${c.lastName}` })), []);
  const inFunnel = useMemo(() => admissions.filter((a) => a.status === "active" && ["new_referral", "phone_intake", "assessment"].includes(a.stage)), [admissions]);
  const caregivers = useMemo(() => seedEmployees.filter((e) => e.role !== "office" && e.status === "active"), []);
  const staff = useMemo(() => seedEmployees.filter((e) => e.status === "active"), []);
  const onboarding = useMemo(() => [...seedApplicants.filter((a) => a.track === "onboarding").map((a) => a.name), ...newHires.map((h) => h.name)], [newHires]);
  const client = kind === "rn_assessment" ? null : clients.find((c) => c.id === clientId);
  const admission = kind === "rn_assessment" ? inFunnel.find((a) => a.id === clientId) : null;
  const subject = kind === "orientation" ? hire : kind === "rn_assessment" ? admission?.name ?? "" : client?.name ?? "";
  const holiday = holidayOn(date);
  const horizon = expansionHorizon(today);

  const plannedDays = useMemo(() => {
    if (kind !== "shift") return [];
    if (!repeat) return [{ date, start, end }];
    if (until && until < date) return [];
    return scheduledDates({ days, startsOn: date, endsOn: until || null } as ClientSchedule, { from: date, to: horizon }).map((d) => ({ date: d, ...days[new Date(`${d}T12:00:00`).getDay()] }));
  }, [kind, repeat, date, until, days, start, end, horizon]);
  const existingSchedule = kind === "shift" && repeat && client ? currentSchedule(clientSchedules, client.id, new Date(`${date || today}T12:00:00`)) : null;
  const proposed: Visit[] = useMemo(
    () =>
      kind === "shift" && client
        ? plannedDays
            .filter((d) => d.start && d.end && d.end > d.start)
            .map((d, i) => ({ id: `proposed-${i}`, clientName: client.name, clientPersonId: client.id, service: "Personal Care", caregiverName: who || null, startsAt: stamp(d.date, d.start), endsAt: stamp(d.date, d.end) }))
        : [],
    [kind, client, plannedDays, who],
  );
  const conflicts = proposed.flatMap((p) => findConflicts(p, visits).map((c) => ({ ...c, on: p.startsAt.slice(0, 10) })));
  const suggestion = useMemo(() => (kind === "shift" && client ? suggestShift({ clientName: client.name, visits }) : null), [kind, client, visits]);
  const suggestedDay = useMemo(() => (suggestion && client ? nextFreeDay({ suggestion, clientName: client.name, visits, from: new Date(`${date}T12:00:00`) }) : null), [suggestion, client, visits, date]);
  const suggested: Visit | null =
    suggestion && client && suggestedDay
      ? { id: "suggested", clientName: client.name, clientPersonId: client.id, service: "Personal Care", caregiverName: suggestion.caregiverName, startsAt: stamp(suggestedDay, suggestion.start), endsAt: stamp(suggestion.end <= suggestion.start ? nextDay(suggestedDay) : suggestedDay, suggestion.end) }
      : null;
  const suggestedConflicts = useMemo(() => (suggested ? findConflicts(suggested, visits) : []), [suggested?.startsAt, suggested?.endsAt, suggested?.caregiverName, visits]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = client ? clientRateFor({ clientPersonId: client.id, households, on: suggestedDay ?? date }) : null;
  const cost = suggestion && rate !== null ? Math.round(shiftHours(suggestion) * rate * 100) / 100 : null;
  const suggestedOt = suggestedConflicts.find((c) => c.kind === "overtime_risk");
  const suggestedClash = suggestedConflicts.find((c) => c.kind !== "overtime_risk");
  const filledIn = !!(suggestion && start === suggestion.start && end === suggestion.end && who === (suggestion.caregiverName ?? "") && (suggestedDay === null || date === suggestedDay));
  const useSuggestion = () => {
    if (!suggestion) return;
    setStart(suggestion.start);
    setEnd(suggestion.end);
    setWho(suggestion.caregiverName ?? "");
    if (suggestedDay) setDate(suggestedDay);
  };
  const longestWaiting = useMemo(() => {
    const dated = inFunnel.filter((a) => a.waitingSince);
    return dated.length === 0 ? inFunnel[0] ?? null : [...dated].sort((a, b) => (a.waitingSince! < b.waitingSince! ? -1 : 1))[0];
  }, [inFunnel]);
  const office = useMemo(() => (kind === "client_visit" && client ? officeVisitContext({ clientName: client.name, visits, from: new Date(`${date}T12:00:00`) }) : null), [kind, client, visits, date]);
  const usual = useMemo(() => (kind === "shift" && repeat && client ? usualWeek({ clientName: client.name, visits }) : {}), [kind, repeat, client, visits]);
  const usualDays = Object.keys(usual).map(Number);
  const usualFilled = usualDays.length > 0 && usualDays.every((d) => days[d]?.start === usual[d].start && days[d]?.end === usual[d].end) && Object.keys(days).length === usualDays.length;
  const useUsual = () => {
    setDays({ ...usual });
    if (suggestion?.caregiverName) setWho(suggestion.caregiverName);
  };
  const clear = () => {
    setWho("");
    setStart("");
    setEnd("");
    setDismissed(true);
  };
  const blocking = conflicts.find((c) => c.severity === "blocking");
  const badDay = repeat ? Object.values(days).find((d) => !d.start || !d.end || d.end <= d.start) : null;

  const problem = (() => {
    if (kind === "orientation") {
      if (!hire) return "Say who is being oriented.";
      if (!who) return "Say who is running it.";
    } else if (kind === "rn_assessment") {
      if (!admission) return "Pick who is being assessed.";
      if (!who) return "Pick the RN.";
    } else if (!client) return "Pick the client.";
    if (kind === "client_visit" && visitKind === "training" && !paired) return "Say which caregiver they are shadowing.";
    if (!date) return "Pick the day.";
    if (kind === "shift" && repeat) {
      if (Object.keys(days).length === 0) return "Tick the days it repeats on.";
      if (badDay) return "On one of the days the end is before the start.";
      if (until && until < date) return "The end is before the first day.";
    } else if (!start || !end || end <= start) return "The end has to be after the start.";
    return blocking ? `${fmtDate(blocking.on)}: ${blocking.message}` : null;
  })();

  const toggleDay = (d: number) =>
    setDays((prev) => {
      if (prev[d]) {
        const next = { ...prev };
        delete next[d];
        return next;
      }
      return { ...prev, [d]: { start, end } };
    });

  const confirm = () => {
    if (problem) return;
    const warn = conflicts.find((c) => c.severity !== "blocking");
    setPending({
      kind: "create",
      clientName: subject || "Somebody",
      service: kind === "shift" ? "Personal Care" : kind === "client_visit" ? PURPOSE_LABELS[visitKind] : KIND_LABELS[kind],
      when: kind === "shift" && repeat ? (until ? `${fmtDate(date)} to ${fmtDate(until)}` : `From ${fmtDate(date)} · booked 3 months ahead, rolling`) : `${fmtDate(date)} · ${clock(start)} – ${clock(end)}`,
      rows: [
        { label: kind === "shift" ? "Caregiver" : kind === "client_visit" && visitKind === "training" ? "Being trained" : "Who is going", from: null, to: who || "Open shift" },
        ...(kind === "client_visit" && visitKind === "training" && paired ? [{ label: "Paired with", from: null, to: paired }] : []),
        ...(kind === "shift" && repeat ? [{ label: "Days", from: null, to: dayNames(days) }] : []),
      ],
      affects: [...(who ? [who] : []), ...(kind === "shift" && subject ? [`${subject} / family contact`] : [])],
      visitCount: kind === "shift" ? Math.max(proposed.length, 1) : 1,
      blocker: null,
      warning: warn ? `${fmtDate(warn.on)}: ${warn.message}` : null,
    });
  };

  const commit = () => {
    if (problem) return;
    if (kind === "shift" && client) {
      if (repeat) {
        const schedule: ClientSchedule = {
          id: `sch-${client.id}-${date}-${Math.random().toString(36).slice(2, 7)}`,
          clientPersonId: client.id,
          clientName: client.name,
          caregiverName: who || null,
          days: { ...days },
          startsOn: date,
          endsOn: until || null,
          setBy: currentUser.name,
          setAt: new Date().toISOString(),
          reason: "",
          supersedesId: null,
          agreementSentAt: null,
          agreementSignedAt: null,
          expands: true,
        };
        addClientSchedule(schedule);
        onAdded(until ? `${proposed.length} shifts for ${client.name} through ${fmtDate(until)}, ${who || "open"}` : `${client.name} ${dayNames(days)} from ${fmtDate(date)}, ${who || "open"} — booked 3 months ahead`);
      } else {
        for (const p of proposed) addShift({ ...p, id: `shift-${p.startsAt.slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`, seriesId: undefined });
        onAdded(`${client.name} on ${fmtDate(date)}, ${who || "open"}`);
      }
    } else if (kind === "rn_assessment" && admission) {
      scheduleAssessment({
        admissionId: admission.id,
        clientName: admission.name,
        assessorName: who,
        startsAt: stamp(date, start),
        durationMinutes: Math.round((Date.parse(stamp(date, end)) - Date.parse(stamp(date, start))) / 60_000),
        address: purpose || admission.location,
        notifyName: admission.name,
      });
      onAdded(`RN assessment · ${admission.name} with ${who} on ${fmtDate(date)}`);
    } else {
      const minutes = Math.round((Date.parse(stamp(date, end)) - Date.parse(stamp(date, start))) / 60_000);
      if (kind === "client_visit" && visitKind === "supervisory" && client) {
        bookSupervision(bookSupervisoryVisit({ id: `sv-${client.id}-${Date.now()}`, clientPersonId: client.id, clientName: client.name, scheduledFor: date, assignedToUserId: RN_USER }));
      }
      addScheduleEvent({
        id: `ev-${Date.now()}`,
        eventType: kind === "client_visit" && visitKind === "supervisory" ? "supervisor_visit" : kind === "client_visit" ? "client_visit" : kind === "orientation" ? "orientation" : "rn_assessment",
        admissionId: null,
        clientName: subject,
        assessorName: kind === "client_visit" && visitKind === "training" && paired ? `${who} with ${paired}` : who,
        startsAt: stamp(date, start),
        durationMinutes: minutes,
        address: purpose,
        createdAt: new Date().toISOString(),
      });
      onAdded(
        kind === "client_visit"
          ? visitKind === "supervisory"
            ? `Supervisory visit · ${subject} with ${who} on ${fmtDate(date)} — their record shows it booked rather than overdue`
            : visitKind === "training"
              ? `Training visit · ${who} shadowing ${paired} at ${subject}'s on ${fmtDate(date)}`
              : `Client visit · ${subject} with ${who}`
          : `${KIND_LABELS[kind]} · ${subject} with ${who}`,
      );
    }
    onOpenChange(false);
  };

  const select = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const title = kind === "shift" && repeat ? "Recurring schedule" : KIND_LABELS[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          {subject ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-[.085em] text-muted-foreground">{title}</span>
              <DialogTitle className="text-[19px] tracking-[-.015em]">{subject}</DialogTitle>
            </>
          ) : (
            <DialogTitle>{title}</DialogTitle>
          )}
          <DialogDescription>
            {kind === "shift"
              ? "Leave the caregiver blank and it goes on the board as an open shift."
              : kind === "client_visit"
                ? PURPOSE_MEANINGS[visitKind]
                : kind === "orientation"
                  ? "A new hire's orientation, and who is running it."
                  : "The RN's visit to somebody in the funnel. Books it on the record and on the schedule."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {kind === "client_visit" && (
            <div className="space-y-1">
              <Label htmlFor="ev-purpose-kind" className="text-[12px] font-medium">
                What kind of visit
              </Label>
              <select id="ev-purpose-kind" value={visitKind} onChange={(e) => setVisitKind(e.target.value as Purpose)} className={select}>
                {(Object.keys(PURPOSE_OPTIONS) as Purpose[]).map((p) => (
                  <option key={p} value={p}>
                    {PURPOSE_OPTIONS[p]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind === "orientation" ? (
            <div className="space-y-1">
              <Label htmlFor="ev-hire" className="text-[12px] font-medium">
                Who is being oriented
              </Label>
              <select id="ev-hire" value={hire} onChange={(e) => setHire(e.target.value)} className={select}>
                <option value="">Choose a new hire</option>
                {onboarding.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ) : kind === "rn_assessment" ? (
            <div className="space-y-1">
              <Label htmlFor="ev-client" className="text-[12px] font-medium">
                Who is being assessed
              </Label>
              <select id="ev-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={select}>
                <option value="">Choose from Admissions</option>
                {inFunnel.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.location}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="ev-client" className="text-[12px] font-medium">
                Client
              </Label>
              <select id="ev-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={select}>
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {suggestion && client && dismissed && (
            <button type="button" onClick={() => setDismissed(false)} className="self-start text-[12.5px] text-primary underline-offset-2 hover:underline">
              Show Joy's suggestion again
            </button>
          )}
          {kind === "shift" && suggestion && client && !dismissed && (
            <JoySuggests
              headline={
                <>
                  <span className="font-semibold">
                    {suggestion.caregiverName ?? "An open shift"}, {clock(suggestion.start)} – {clock(suggestion.end)}
                  </span>
                  {suggestedDay ? ` on ${fmtDate(suggestedDay)}` : ""} · {hoursLabel(shiftHours(suggestion))}
                </>
              }
              rows={[
                {
                  label: "Cost",
                  tone: cost === null ? "warn" : "plain",
                  value:
                    cost === null ? (
                      `No rate on file for ${client.name} yet`
                    ) : (
                      <>
                        <span className="font-semibold tabular-nums">{money(cost)}</span>
                        <span className="text-muted-foreground"> at {money(rate ?? 0)}/hr</span>
                      </>
                    ),
                },
                { label: "Conflicts", tone: suggestedClash ? "bad" : "good", value: suggestedClash ? suggestedClash.message : "None" },
                { label: "Overtime", tone: suggestedOt ? "warn" : "good", value: suggestedOt ? suggestedOt.message : `No — ${suggestion.caregiverName ?? "an open shift"} stays under ${OVERTIME_THRESHOLD_HOURS} hrs that week` },
                ...(repeat && usualDays.length > 0 ? [{ label: "Repeats", tone: "plain" as const, value: describeUsualWeek(usual) }] : []),
              ]}
              note={suggestionEvidence(suggestion, client.name)}
              actions={
                <>
                  <SmallButton disabled={repeat ? usualFilled : filledIn} onClick={repeat && usualDays.length > 0 ? useUsual : useSuggestion}>
                    {(repeat ? usualFilled : filledIn) ? "Filled in" : "Use this"}
                  </SmallButton>
                  <SmallButton secondary onClick={clear}>
                    Clear, I'll fill it out myself
                  </SmallButton>
                </>
              }
            />
          )}
          {kind === "client_visit" && client && office && !dismissed && (
            <JoySuggests
              headline={
                visitKind === "training"
                  ? office.regularCaregiver
                    ? `${office.regularCaregiver} works ${client.name} most often — the natural person to shadow.`
                    : `${client.name} has no regular caregiver on the board yet.`
                  : visitKind === "supervisory"
                    ? `A supervisory visit for ${client.name}. Booking it here takes them off the overdue list.`
                    : `Going out to ${client.name}.`
              }
              rows={[
                { label: "That day", tone: office.nextVisit ? "plain" : "warn", value: thatDayLine(office.nextVisit, (iso) => `for ${fmtDate(iso.slice(0, 10))}`) ?? "Nothing booked — nobody from the agency will be there" },
                { label: "Regular", tone: "plain", value: office.regularCaregiver ?? "Nobody regular yet" },
                { label: "Last seen", tone: office.lastOfficeVisit ? "plain" : "warn", value: agoLabel(office.lastOfficeVisit, new Date()) ?? "No office visit on record" },
              ]}
              note={office.drawnFrom > 0 ? `Read from ${client.name}'s ${office.drawnFrom} ${office.drawnFrom === 1 ? "visit" : "visits"} on the board.` : `Nothing on the board for ${client.name} yet, so there is little to read.`}
              actions={visitKind === "training" && office.regularCaregiver && !paired ? <SmallButton onClick={() => setPaired(office.regularCaregiver!)}>Pair with {office.regularCaregiver}</SmallButton> : undefined}
            />
          )}
          {kind === "rn_assessment" && inFunnel.length > 0 && !dismissed && (
            <JoySuggests
              headline={longestWaiting ? `${longestWaiting.name} has been waiting longest.` : `${inFunnel.length} ${inFunnel.length === 1 ? "person is" : "people are"} in the funnel.`}
              rows={
                longestWaiting
                  ? [
                      { label: "Waiting", tone: "warn", value: waitingLabel(longestWaiting) },
                      { label: "Stage", tone: "plain", value: longestWaiting.headline },
                      { label: "Where", tone: "plain", value: longestWaiting.location },
                    ]
                  : []
              }
              note="An assessment cannot be booked for somebody who is not in the funnel, so this is the whole list Joy can offer."
              actions={longestWaiting && clientId !== longestWaiting.id ? <SmallButton onClick={() => setClientId(longestWaiting.id)}>Book {longestWaiting.name}</SmallButton> : undefined}
            />
          )}
          {kind === "orientation" && onboarding.length === 0 && (
            <JoySuggests headline="Nobody is in onboarding, so there is nobody to orient." note="Read from the hiring pipeline. Somebody moves into onboarding once their offer is accepted — until then this list stays empty." />
          )}
          {kind === "rn_assessment" && inFunnel.length === 0 && (
            <JoySuggests headline="Nobody in the funnel is waiting for an assessment." note="Read from Admissions. Assessments are booked for people at new referral, phone intake or assessment stage." />
          )}
          {kind === "orientation" && onboarding.length > 0 && !dismissed && (
            <JoySuggests
              headline={onboarding.length === 1 ? `${onboarding[0]} is the only person in onboarding.` : `${onboarding.length} people are in onboarding and have not been oriented.`}
              rows={[
                { label: "Waiting", tone: "plain", value: onboarding.slice(0, 4).join(", ") },
                { label: "Running it", tone: "plain", value: currentUser.name },
              ]}
              note="Read from the hiring pipeline — only somebody in onboarding can be oriented."
              actions={hire ? undefined : <SmallButton onClick={() => setHire(onboarding[0])}>Orient {onboarding[0]}</SmallButton>}
            />
          )}
          <div className="space-y-1">
            <Label htmlFor="ev-who" className="text-[12px] font-medium">
              {kind === "shift" ? "Caregiver" : kind === "client_visit" ? (visitKind === "supervisory" ? "Which RN" : visitKind === "training" ? "Who is being trained" : "Who is going") : kind === "rn_assessment" ? "RN" : "Who is running it"}
            </Label>
            <select id="ev-who" value={who} onChange={(e) => setWho(e.target.value)} className={select}>
              <option value="">{kind === "shift" ? "Nobody yet — open shift" : "Choose"}</option>
              {kind === "rn_assessment" || (kind === "client_visit" && visitKind === "supervisory")
                ? RNS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))
                : kind === "client_visit" && visitKind === "training"
                  ? [...onboarding, ...caregivers.map((c) => c.name)].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))
                  : (kind === "shift" ? caregivers : staff).map((e) => (
                      <option key={e.id} value={e.name}>
                        {e.name}
                      </option>
                    ))}
            </select>
          </div>
          {kind === "client_visit" && visitKind === "training" && (
            <div className="space-y-1">
              <Label htmlFor="ev-paired" className="text-[12px] font-medium">
                Paired with
              </Label>
              <select id="ev-paired" value={paired} onChange={(e) => setPaired(e.target.value)} className={select}>
                <option value="">Choose the caregiver they are shadowing</option>
                {caregivers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ev-date" className="text-[12px] font-medium">
                {repeat ? "Starts" : "Day"}
              </Label>
              <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-w-0" />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ev-start" className="text-[12px] font-medium">
                Start
              </Label>
              <Input
                id="ev-start"
                type="time"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (!perDay) setDays((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, start: e.target.value }])));
                }}
                className="min-w-0"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ev-end" className="text-[12px] font-medium">
                End
              </Label>
              <Input
                id="ev-end"
                type="time"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  if (!perDay) setDays((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, end: e.target.value }])));
                }}
                className="min-w-0"
              />
            </div>
          </div>
          {kind === "shift" && (
            <div className="space-y-2.5 rounded-[10px] border border-[var(--hairline)] p-3">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Repeats every week{repeat ? " on" : ""}
              </label>
              {repeat && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((name, d) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={!!days[d]}
                        onClick={() => toggleDay(d)}
                        className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors", days[d] ? "border-primary bg-[#EEF0FE] font-medium text-primary" : "border-[var(--hairline)] hover:bg-[var(--wash)]")}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  {Object.keys(days).length > 0 && (
                    <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={perDay}
                        onChange={(e) => {
                          setPerDay(e.target.checked);
                          if (!e.target.checked) setDays((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, { start, end }])));
                        }}
                        className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                      />
                      Different hours on some days
                    </label>
                  )}
                  {perDay && Object.keys(days).length > 0 && (
                    <div className="space-y-1.5">
                      {[1, 2, 3, 4, 5, 6, 0]
                        .filter((d) => days[d])
                        .map((d) => (
                          <div key={d} className="grid grid-cols-[52px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                            <span className="text-[12.5px] font-medium">{DAYS[d]}</span>
                            <Input type="time" aria-label={`${DAYS[d]} start`} value={days[d].start} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], start: e.target.value } }))} className="h-9 min-w-0" />
                            <Input type="time" aria-label={`${DAYS[d]} end`} value={days[d].end} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], end: e.target.value } }))} className="h-9 min-w-0" />
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="ev-until" className="text-[12px] font-medium">
                        Ends <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input id="ev-until" type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} className="min-w-0" />
                    </div>
                    <p className="m-0 pb-2 text-[12px] leading-[1.4] text-muted-foreground [text-wrap:pretty]">{until ? "Stops on that day." : "Leave it blank and Joy keeps the next 3 months booked, always."}</p>
                  </div>
                  {plannedDays.length > 0 && !problem && (
                    <p className="m-0 text-[12.5px] text-muted-foreground">{expansionSummary({ count: plannedDays.length, firstDay: plannedDays[0].date, lastDay: plannedDays[plannedDays.length - 1].date, endsOn: until || null })}</p>
                  )}
                  {existingSchedule && (
                    <p className="m-0 rounded-[9px] bg-[#FFFAEB] px-3 py-2 text-[12.5px] leading-[1.45] text-[#B54708] [text-wrap:pretty]">
                      {client?.name.split(" ")[0]} already has a recurring schedule — {describeSchedule(existingSchedule)}
                      {existingSchedule.caregiverName ? ` with ${existingSchedule.caregiverName}` : ""}. This adds a second pattern on top of it. To change the existing one, revise it from the Schedule tab on the client's record.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {kind !== "shift" && (
            <div className="space-y-1">
              <Label htmlFor="ev-purpose" className="text-[12px] font-medium">
                {kind === "rn_assessment" ? "Address (optional)" : "What for (optional)"}
              </Label>
              <Input
                id="ev-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={
                  kind === "client_visit"
                    ? visitKind === "supervisory"
                      ? "90-day check · annual"
                      : visitKind === "training"
                        ? "What they are learning"
                        : "Welfare check · care plan review"
                    : kind === "rn_assessment"
                      ? admission?.location ?? "Where the visit happens"
                      : "Day one · shadowing Chanel"
                }
              />
            </div>
          )}
          {holiday && (
            <p className="m-0 text-[12.5px] leading-[1.5] text-[#B54708]">
              {date === today ? "Today" : "That day"} is {HOLIDAY_LABELS[holiday]} — holiday rate applies.
            </p>
          )}
          {conflicts.length > 0 && (
            <JoyWarns title={blocking ? "Why this conflicts" : "Worth knowing"}>
              {conflicts.slice(0, 3).map((c) => (
                <p key={c.on + c.message} className="m-0 [&+p]:mt-1">
                  {fmtDate(c.on)}: {c.message}
                </p>
              ))}
            </JoyWarns>
          )}
          {problem && subject && !blocking && <p className="m-0 text-[12.5px] leading-[1.5] text-[#98322C]">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!!problem} onClick={confirm}>
            {kind === "shift" ? (repeat ? "Add the schedule" : "Add shift") : `Book ${KIND_LABELS[kind].toLowerCase()}`}
          </Button>
        </DialogFooter>
        <ChangeConfirmSheet
          change={pending}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            commit();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
