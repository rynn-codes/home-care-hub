import { useState } from "react";
import { Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { ROLE_LABELS } from "@/domain/consents/witness";
import {
  AGENCY_SWITCHES,
  CALENDAR_START_LABELS,
  EARLY_CLOCK_IN_GRACE_OPTIONS,
  GEOFENCE_OPTIONS,
  PLAN_OF_CARE_LABELS,
  PROFIT_ROLE_CHOICES,
  SWITCH_GROUPS,
  SWITCH_GROUP_LABELS,
  describeDistance,
  requiresLabel,
  switchEnabled,
  type AgencyProfile,
  type CalendarStart,
  type PlanOfCareSource,
} from "@/domain/agency/settings";
import { TAG_AREAS, TAG_AREA_HINTS, TAG_AREA_LABELS, addPreset, removePreset } from "@/domain/agency/tagPresets";
import { isLatestForRecord, undoDeadline, undoableChanges } from "@/domain/records/profileChanges";
import {
  setAgencyField,
  setAgencyProfileField,
  setAgencySwitch,
  setNotification,
  setTagPresets,
  useAgencySettings,
} from "@/lib/agencyStore";

const NOTIFY_MINUTES = [5, 10, 15, 30, 45, 60, 90, 120];
const MISSED_IN_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

const PROFILE_FIELDS: Array<{ key: keyof AgencyProfile; label: string; required?: boolean; span?: boolean; inputMode?: "numeric" | "tel" | "email" }> = [
  { key: "name", label: "Name", required: true, span: true },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "zip", label: "Zip code", inputMode: "numeric" },
  { key: "address", label: "Address", span: true },
  { key: "phone", label: "Phone number", inputMode: "tel" },
  { key: "contactPhone", label: "Contact phone number", inputMode: "tel" },
  { key: "fax", label: "Fax", inputMode: "tel" },
  { key: "email", label: "Email", inputMode: "email" },
  { key: "apiKey", label: "API" },
  { key: "hrEmail", label: "HR email", inputMode: "email" },
  { key: "providerMedicareId", label: "Provider Medicare ID (IQIES agency ID)" },
  { key: "ein", label: "EIN", required: true },
  { key: "providerMedicaidId", label: "Provider Medicaid ID" },
  { key: "npi", label: "NPI", inputMode: "numeric" },
  { key: "zip9", label: "9-digit zip code", inputMode: "numeric" },
  { key: "taxonomyCode", label: "Taxonomy code" },
  { key: "twilioPhone", label: "Twilio phone number", inputMode: "tel" },
];

const SELECT = "h-10 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]";
const CARD = "rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6";
const H2 = "m-0 text-[15px] font-semibold tracking-[-.01em]";
const HINT = "m-0 text-[12px] leading-[1.5] text-muted-foreground";

/** Settings → Agency: the profile, the calendar, tags, the clock, the switches, staff notifications. */
export function AgencySettingsPanel() {
  const s = useAgencySettings();
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const { profileChanges, undoProfileChange, currentUser } = useDemo();
  const mayWrite = canWrite(currentUser.role);
  const undoable = undoableChanges(profileChanges, s.profileUndoHours, new Date().toISOString());
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <h2 className={H2}>Agency</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">What Joy puts on an invoice, a consent packet and a claim form.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key} className={cn("flex flex-col gap-1.5", f.span && "sm:col-span-2 lg:col-span-3")}>
              <Label htmlFor={`agency-${f.key}`} className="text-[12.5px]">
                {f.label}
                {f.required && (
                  <span className="ml-0.5 text-primary" aria-label="required">
                    *
                  </span>
                )}
              </Label>
              <Input
                id={`agency-${f.key}`}
                inputMode={f.inputMode}
                value={s.profile[f.key]}
                onChange={(e) => setAgencyProfileField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>Calendar and care plan</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-calendar" className="text-[12.5px]">Calendar display configuration</Label>
            <select id="agency-calendar" value={s.calendarStart} onChange={(e) => setAgencyField("calendarStart", e.target.value as CalendarStart)} className={SELECT}>
              {(Object.keys(CALENDAR_START_LABELS) as CalendarStart[]).map((k) => (
                <option key={k} value={k}>{CALENDAR_START_LABELS[k]}</option>
              ))}
            </select>
            <p className={HINT}>How the week is drawn. The pay week stays Saturday to Friday whatever this says.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-poc" className="text-[12.5px]">Plan of care option</Label>
            <select id="agency-poc" value={s.planOfCare} onChange={(e) => setAgencyField("planOfCare", e.target.value as PlanOfCareSource)} className={SELECT}>
              {(Object.keys(PLAN_OF_CARE_LABELS) as PlanOfCareSource[]).map((k) => (
                <option key={k} value={k}>{PLAN_OF_CARE_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={H2}>Tags</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The tags people can pick from. Forms offer these lists and nothing else, so a search for “Weekends” finds everybody
          who works weekends rather than the ones who spelt it the same way.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {TAG_AREAS.map((area) => {
            const list = s.tagPresets[area];
            const draft = tagDrafts[area] ?? "";
            const add = () => {
              setTagPresets(area, addPreset(list, draft));
              setTagDrafts((d) => ({ ...d, [area]: "" }));
            };
            return (
              <div key={area} className="flex flex-col gap-2">
                <Label htmlFor={`agency-tag-${area}`} className="text-[12.5px]">{TAG_AREA_LABELS[area]}</Label>
                <p className={HINT}>{TAG_AREA_HINTS[area]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.length === 0 && <span className="text-[12.5px] text-muted-foreground">None yet.</span>}
                  {list.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--paper)] px-2.5 py-[3px] text-[12px]">
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag} from ${TAG_AREA_LABELS[area].toLowerCase()}`}
                        onClick={() => setTagPresets(area, removePreset(list, tag))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`agency-tag-${area}`}
                    value={draft}
                    onChange={(e) => setTagDrafts((d) => ({ ...d, [area]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        add();
                      }
                    }}
                    placeholder={area === "employees" ? "Add a tag — e.g. Overnights" : "Add a tag — e.g. survey 2027"}
                    className="h-9 min-w-0 flex-1 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={add}
                    className="h-9 flex-none rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] leading-[1.5] text-muted-foreground">
          Taking a tag off the list does not strip it from records that already carry it — they show it as “no longer on the
          list” until somebody removes it there.
        </p>
      </section>

      <section className={CARD}>
        <h2 className={H2}>Clocking in</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-grace" className="text-[12.5px]">How early a shift may start</Label>
            <select id="agency-grace" value={s.earlyClockInGraceMinutes} onChange={(e) => setAgencyField("earlyClockInGraceMinutes", Number(e.target.value))} className={SELECT}>
              {EARLY_CLOCK_IN_GRACE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m === 0 ? "Not at all" : `${m} minutes before the shift`}</option>
              ))}
            </select>
            <p className={HINT}>
              A caregiver can always clock in when she arrives. Arriving earlier than this, her time starts{" "}
              {s.earlyClockInGraceMinutes === 0 ? "at the scheduled time" : `${s.earlyClockInGraceMinutes} minutes before the shift`}{" "}
              unless the office authorized an early start on that visit.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-missed-in" className="text-[12.5px]">How long before a missing clock-in reaches you</Label>
            <select id="agency-missed-in" value={s.missedClockInEscalationMinutes} onChange={(e) => setAgencyField("missedClockInEscalationMinutes", Number(e.target.value))} className={SELECT}>
              {MISSED_IN_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} minutes after the shift starts</option>
              ))}
            </select>
            <p className={HINT}>
              Joy reminds the caregiver five minutes before the shift and again at the start. After this it stops being a
              forgotten tap and becomes a phone call — somebody has to check the client is not sitting at home alone. Shorter
              catches it sooner and interrupts you more.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-mileage" className="text-[12.5px]">Mileage rate</Label>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">$</span>
              <input
                id="agency-mileage"
                type="number"
                min="0"
                step="0.01"
                value={s.mileageRatePerMile}
                onChange={(e) => setAgencyField("mileageRatePerMile", Number(e.target.value))}
                className="h-10 w-[110px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]"
              />
              <span className="text-[13px] text-muted-foreground">per mile</span>
            </div>
            <p className={HINT}>
              A placeholder, not the IRS rate — Joy has no way to know today's. Set the one you actually pay. Mileage is a
              reimbursement rather than wages: it is not taxed and it does not count toward overtime.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-undo-hours" className="text-[12.5px]">How long a profile change can be undone</Label>
            <div className="flex items-center gap-2">
              <input
                id="agency-undo-hours"
                type="number"
                min="1"
                step="1"
                value={s.profileUndoHours}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0) setAgencyField("profileUndoHours", n);
                }}
                className="h-10 w-[110px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]"
              />
              <span className="text-[13px] text-muted-foreground">hours</span>
            </div>
            <p className={HINT}>
              A change to a client's or employee's profile or status can be put back exactly as it was, from the record or
              from the list below, until this long after it was made. The audit trail keeps every change and every undo
              whatever this is set to.
            </p>
            {undoable.length > 0 && (
              <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
                {undoable.map((c) => {
                  const latest = isLatestForRecord(profileChanges, c);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 [text-wrap:pretty]">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground"> · {c.what === "status" ? "status" : "profile"} · {c.summary}</span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {fmt(c.changedAt)} by {c.changedBy} · until {fmt(undoDeadline(c, s.profileUndoHours))}
                        </span>
                      </span>
                      {latest ? (
                        mayWrite ? (
                          <button
                            type="button"
                            onClick={() => {
                              undoProfileChange(c.id);
                              toast(`${c.name}'s ${c.what === "status" ? "status" : "profile"} put back`, {
                                description: "The audit trail keeps both the change and the undo.",
                              });
                            }}
                            className="flex h-[28px] flex-none items-center gap-1.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-[var(--wash)]"
                          >
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Undo
                          </button>
                        ) : null
                      ) : (
                        <span className="text-[11.5px] text-muted-foreground">Undo the later change first</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Who can see gross and net profit on scheduling</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {PROFIT_ROLE_CHOICES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={s.profitVisibleTo.includes(role)}
                    onChange={(e) =>
                      setAgencyField(
                        "profitVisibleTo",
                        e.target.checked ? [...s.profitVisibleTo, role] : s.profitVisibleTo.filter((r) => r !== role),
                      )
                    }
                    className="h-4 w-4 rounded border-[var(--hairline)]"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
            <p className={HINT}>
              Everyone else sees the schedule without the money on it — no pills beside caregivers, no margin line on a
              visit. Caregivers, client contacts and auditors never see it.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agency-geofence" className="text-[12.5px]">How far from the client's address a shift may be clocked</Label>
            <select id="agency-geofence" value={s.geofenceMeters} onChange={(e) => setAgencyField("geofenceMeters", Number(e.target.value))} className={SELECT}>
              {GEOFENCE_OPTIONS.map((m) => (
                <option key={m} value={m}>{describeDistance(m)}</option>
              ))}
            </select>
            <p className={HINT}>
              {s.switches.reject_out_of_range
                ? "A clock-in further out than this is refused, and the office is told how far away it was."
                : "The office is told when a clock-in is further out than this. Turn on “Reject check-in/check-out if out of range” below to stop it as well."}{" "}
              A phone that cannot say where it is never blocks anybody.
            </p>
          </div>
        </div>
      </section>

      {SWITCH_GROUPS.map((group) => (
        <section key={group} className={CARD}>
          <h2 className={H2}>{SWITCH_GROUP_LABELS[group]}</h2>
          <div className="mt-3 grid gap-x-8 lg:grid-cols-2">
            {AGENCY_SWITCHES.filter((sw) => sw.group === group).map((sw) => {
              const enabled = switchEnabled(sw, s.switches);
              const parent = requiresLabel(sw);
              return (
                <div key={sw.key} className="flex items-start justify-between gap-4 border-b border-[var(--hairline-soft)] py-3 last:border-0 lg:last:border-b">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("text-[13.5px] leading-[1.45]", enabled ? "text-[var(--ink-strong)]" : "text-muted-foreground")}>{sw.label}</span>
                    {!enabled && parent && <span className="text-[12px] leading-[1.45] text-muted-foreground">Available once “{parent}” is on.</span>}
                    {sw.notWired && <span className="text-[12px] leading-[1.45] text-muted-foreground">Nothing reads this yet.</span>}
                  </span>
                  <Switch
                    checked={!!s.switches[sw.key]}
                    disabled={!enabled}
                    onCheckedChange={(on) => setAgencySwitch(sw.key, on)}
                    aria-label={sw.label}
                    className="mt-0.5 flex-none"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className={CARD}>
        <h2 className={H2}>Staff notifications</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">What the caregiver's phone tells her, and how long before.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["beforeStart", "beforeStartMinutes", "Notify staff before the start of a visit"],
              ["beforeEnd", "beforeEndMinutes", "Notify staff before the end of a visit"],
            ] as const
          ).map(([onKey, minutesKey, label]) => (
            <div key={onKey} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--hairline)] px-4 py-3.5">
              <Switch checked={s.notifications[onKey]} onCheckedChange={(on) => setNotification(onKey, on)} aria-label={label} className="flex-none" />
              <span className="min-w-0 flex-1 text-[13.5px] leading-[1.4]">{label}</span>
              <select
                aria-label={`${label} — minutes`}
                value={s.notifications[minutesKey]}
                disabled={!s.notifications[onKey]}
                onChange={(e) => setNotification(minutesKey, Number(e.target.value))}
                className="h-9 rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[13px] tabular-nums disabled:opacity-50"
              >
                {NOTIFY_MINUTES.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
