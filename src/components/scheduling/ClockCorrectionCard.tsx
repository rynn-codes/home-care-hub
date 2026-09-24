import { useMemo, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { JoyWarns } from "@/components/scheduling/joy";
import type { Visit } from "@/domain/scheduling/conflicts";
import { CLOCK_PLACE_LABELS, validateClockPlace, type ClockPlace, type ClockPlaceKind } from "@/domain/scheduling/locations";
import { clockInLadder, clockOutLadder, dueReminders, lateLabel, nextReminder, suggestClockIn, suggestClockOut } from "@/domain/scheduling/reminders";
import {
  CONFIRM_SOURCES,
  REASON_CODES,
  REASON_GROUP_LABELS,
  REASON_GROUP_ORDER,
  reasonCode,
  stopsBilling,
  validateCorrection,
} from "@/domain/scheduling/clockCorrections";

export interface ClockCorrectionInput {
  clockedInAt: string | null;
  clockedOutAt: string;
  reasonCode: string;
  actionCode: string;
  note: string;
  place: ClockPlace;
}

const PLACE_KINDS: ClockPlaceKind[] = ["service_address", "other", "not_recorded"];
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * The office records a clock a caregiver never made — with Joy's suggestion
 * from the phone's GPS trail, the reason, how the time was confirmed, and
 * where the shift ended.
 */
export function ClockCorrectionCard({
  visit,
  clockedInAt,
  by,
  role,
  lastPing = null,
  addressName,
  payrollWeek,
  escalateAfterMinutes,
  onRecord,
}: {
  visit: Visit;
  clockedInAt: string | null;
  by: string;
  role: string | null;
  lastPing?: { at: string; feet: number } | null;
  addressName: string;
  payrollWeek: string;
  escalateAfterMinutes: number;
  onRecord: (input: ClockCorrectionInput) => void;
}) {
  const noClockIn = clockedInAt === null;
  const [inAt, setInAt] = useState("");
  const [outAt, setOutAt] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [placeKind, setPlaceKind] = useState<ClockPlaceKind>("service_address");
  const [where, setWhere] = useState("");
  const place: ClockPlace = { kind: placeKind, where };

  const ladder = useMemo(
    () => (noClockIn ? clockInLadder({ visit, clockedInAt: null, escalateAfterMinutes, now: new Date() }) : clockOutLadder({ visit, clockedInAt, clockedOutAt: null, now: new Date() })),
    [visit, clockedInAt, noClockIn, escalateAfterMinutes],
  );
  const due = dueReminders(ladder);
  const next = nextReminder(ladder);
  const sent = due.filter((r) => r.to === "caregiver").length;
  const minutesLate = useMemo(() => {
    const start = new Date(visit.startsAt).getTime();
    return Number.isNaN(start) ? null : Math.max(0, Math.round((Date.now() - start) / 60_000));
  }, [visit.startsAt]);
  const problem = noClockIn && inAt === "" ? "Enter the time the shift started" : outAt === "" ? "Enter the time the shift ended" : validateClockPlace(place) ?? validateCorrection({ reasonCode: reason, actionCode: action, note });
  const suggestion = useMemo(
    () =>
      lastPing
        ? noClockIn
          ? suggestClockIn({ scheduledStartsAt: visit.startsAt, arrival: lastPing, atAddressName: addressName })
          : suggestClockOut({ scheduledEndsAt: visit.endsAt, clockedInAt: clockedInAt!, lastPing, atAddressName: addressName })
        : null,
    [noClockIn, visit.startsAt, visit.endsAt, clockedInAt, lastPing, addressName],
  );
  const because = useMemo(() => (suggestion === null ? "" : suggestion.because.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, (m) => fmtTime(m))), [suggestion]);
  const dayLabel = new Date(visit.startsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const input = "h-[34px] w-full min-w-0 rounded-[9px] border border-[#EED4D2] bg-[var(--paper)] px-2.5 text-[13px] outline-none transition-colors focus:border-primary";
  const label = "text-[10.5px] font-semibold uppercase tracking-[.08em] text-[#B4443C]";

  return (
    <JoyWarns className="mt-4" title={noClockIn ? "Nobody clocked in on this shift" : "No clock-out on this shift"} icon={<TriangleAlert className="h-3.5 w-3.5 flex-none" aria-hidden="true" />}>
      <div className="-mx-1 mb-2.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
          {(visit.caregiverName ?? "?")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col leading-[1.25]">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-[14px] font-semibold text-[var(--ink)]">{visit.caregiverName ?? "Unassigned"}</span>
            {role && <span className="flex-none rounded-full bg-[var(--wash-strong)] px-1.5 py-[1px] text-[10px] font-semibold text-[var(--ink-body)]">{role}</span>}
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            {dayLabel} · {visit.clientName} · {fmtTime(visit.startsAt)} – {fmtTime(visit.endsAt)}
          </span>
        </span>
      </div>
      {noClockIn ? (
        <p className="m-0">
          {visit.caregiverName ?? "The caregiver"} never clocked in{minutesLate === null ? "" : ` — ${lateLabel(minutesLate)}`}. Joy has no way to tell a forgotten tap from a visit that did not happen, so somebody has to call and find out which it was, then record it here. Until that is done this shift cannot be billed or paid.
        </p>
      ) : (
        <p className="m-0">
          Clocked in {fmtTime(clockedInAt!)}, never clocked out. The {payrollWeek} payroll week cannot total until this shift has an end time.
        </p>
      )}
      {suggestion && (
        <div className="mt-3 flex flex-col gap-2 rounded-[11px] border border-[#D9DCF5] bg-[#F4F5FE] px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.085em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Joy suggests
          </span>
          <p className="m-0 text-[13px] leading-[1.5] text-[var(--ink)] [text-wrap:pretty]">
            <span className="font-semibold tabular-nums">{fmtTime(suggestion.at)}</span> — {because}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => (noClockIn ? setInAt(hhmm(suggestion.at)) : setOutAt(hhmm(suggestion.at)))}
              className="h-[34px] rounded-[9px] bg-[var(--ink)] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-black"
            >
              Use {fmtTime(suggestion.at)}
            </button>
            <span className="text-[12.5px] text-muted-foreground">Or type the confirmed time below</span>
          </div>
          {suggestion.endsEarly && <p className="m-0 text-[12px] leading-[1.45] text-[#B54708]">This is shorter than the scheduled shift. Taking it bills the family for the hours actually worked.</p>}
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={label}>Actual start</span>
          {noClockIn ? (
            <input type="time" aria-label="Actual start" value={inAt} onChange={(e) => setInAt(e.target.value)} className={input} />
          ) : (
            <span className="flex h-[34px] items-center rounded-[9px] border border-dashed border-[#EED4D2] px-2.5 text-[13px] tabular-nums">{fmtTime(clockedInAt!)}</span>
          )}
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={label}>Actual end</span>
          <input type="time" aria-label="Actual end" value={outAt} onChange={(e) => setOutAt(e.target.value)} className={input} />
        </label>
      </div>
      <div className="mt-2.5 flex flex-col gap-1">
        <span className={label}>{noClockIn ? "Where the shift happened" : "Where the shift ended"}</span>
        <div className="flex flex-wrap gap-1.5">
          {PLACE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={placeKind === k}
              onClick={() => setPlaceKind(k)}
              className={cn("h-[30px] rounded-full border px-3 text-[12px] transition-colors", placeKind === k ? "border-[#B4443C] bg-[#F6DEDC] font-medium text-[#98322C]" : "border-[#EED4D2] hover:bg-[#F9E9E8]")}
            >
              {CLOCK_PLACE_LABELS[k]}
            </button>
          ))}
        </div>
        {placeKind === "other" && <input value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Where the shift ended" placeholder="Where — the family will know the address" className={cn(input, "mt-1")} />}
      </div>
      <div className="mt-2.5 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className={label}>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className={input}>
            <option value="">Why the clock is missing</option>
            {REASON_GROUP_ORDER.map((g) => {
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
            <span className="text-[11px] text-[#B4443C]/70">
              Recorded as ({reason}) {reasonCode(reason)?.label}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Confirmed by</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Confirmed by" className={input}>
            <option value="">How you know the time</option>
            {CONFIRM_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder="What was said on the call" className={input} />
        </label>
      </div>
      <details className="mt-3 rounded-[9px] px-1 [&[open]>summary]:mb-1.5">
        <summary className="cursor-pointer list-none text-[12px] text-[#98322C] marker:content-['']">
          <span className="mr-1 inline-block transition-transform">▸</span>
          {sent === 0 ? "No reminders sent yet" : `${sent} ${sent === 1 ? "reminder" : "reminders"} sent · ${due.filter((r) => r.to === "caregiver").map((r) => fmtTime(r.at)).join(", ")}`}
        </summary>
        <div className="flex flex-col gap-1 rounded-[9px] bg-[#F9E9E8] px-3 py-2.5">
          {due.map((r) => (
            <span key={r.rung} className="flex items-baseline gap-2 text-[12px]">
              <span className="w-[62px] flex-none tabular-nums text-[#B4443C]">{fmtTime(r.at)}</span>
              <span className="min-w-0">{r.text}</span>
            </span>
          ))}
          {next && (
            <span className="flex items-baseline gap-2 text-[12px] opacity-60">
              <span className="w-[62px] flex-none tabular-nums text-[#B4443C]">{fmtTime(next.at)}</span>
              <span className="min-w-0">Due: {next.text}</span>
            </span>
          )}
          {due.length === 0 && !next && <span className="text-[12px]">Nothing has gone out about this shift.</span>}
        </div>
      </details>
      {stopsBilling(action) && (
        <p className="m-0 mt-2 text-[12px] font-medium leading-[1.45] text-[#98322C]">
          This marks the visit unverified and records it against the shift. Billing does not read that yet — take the visit off this week's draft by hand before sending it.
        </p>
      )}
      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          disabled={problem !== null}
          onClick={() => {
            if (problem !== null) return;
            onRecord({ clockedInAt: noClockIn ? inAt : null, clockedOutAt: outAt, reasonCode: reason, actionCode: action, note: note.trim(), place });
          }}
          className={cn("flex h-[34px] items-center gap-1.5 rounded-[9px] px-3.5 text-[13px] font-medium transition-colors", problem !== null ? "cursor-not-allowed bg-[#F3DEDC] text-[#B4443C]/60" : "bg-primary text-white hover:bg-[#2A1BD1]")}
        >
          {problem === null && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          {problem ?? "Record the clock-out"}
        </button>
        <span className="text-[11.5px] text-[#98322C]">Saved against this visit as {by}</span>
      </div>
    </JoyWarns>
  );
}
