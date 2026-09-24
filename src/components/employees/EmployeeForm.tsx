import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/layout/TagPicker";
import { cn } from "@/lib/utils";
import { useAgencySettings } from "@/lib/agencyStore";
import {
  EMPLOYEE_STATUS_LABELS,
  ROLE_LABELS,
  type EmployeeRole,
  type EmployeeStatus,
} from "@/domain/employees/credentials";
import {
  DISCIPLINES,
  EMPLOYMENT_TYPES,
  EXCLUSION_LABELS,
  GENDERS,
  MIGRATORY_STATUSES,
  REFERRAL_SOURCES,
  RELATIONSHIPS,
  blankProfile,
  defaultEmploymentType,
  fullName,
  isBilingual,
  mrNumberFrom,
  whyNotSaveEmployee,
  type EmergencyContact,
  type EmployeeProfile,
  type ExclusionStatus,
} from "@/domain/employees/profile";
import { changedFieldLabels } from "@/domain/records/profileChanges";

/**
 * Add or edit an employee — Karynn's employee form, section for section.
 *
 * Two things the form refuses to do. It never saves the social security
 * number: the field exists only to compute the MR number, and the digits die
 * with the dialog. And it never saves an edit without the second look —
 * Karynn, 29 September: "need a secondary confirm to ensure the change is
 * warranted on the right person." The confirm names the person and lists
 * exactly which fields moved.
 */
const ROLES: readonly EmployeeRole[] = ["caregiver", "cna", "lvn", "rn", "office"];
const STATUSES: readonly EmployeeStatus[] = ["active", "onboarding", "on_leave", "inactive"];

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label htmlFor={htmlFor} className="text-[12px] font-medium">
        {label}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const typeHint = (p: EmployeeProfile) =>
  p.employmentType === defaultEmploymentType(p.role) && (p.role === "caregiver" || p.role === "cna")
    ? "field staff default"
    : undefined;

export function EmployeeForm({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set; adding when null. */
  initial: EmployeeProfile | null;
  onSave: (profile: EmployeeProfile) => void;
}) {
  const [p, setP] = useState<EmployeeProfile>(blankProfile());
  const [ssn, setSsn] = useState("");
  const [showSsn, setShowSsn] = useState(false);
  const [language, setLanguage] = useState("");
  const { tagPresets } = useAgencySettings();
  const [typeTouched, setTypeTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setP(initial ? { ...blankProfile(), ...initial } : blankProfile());
    setSsn("");
    setShowSsn(false);
    setLanguage("");
    setTypeTouched(false);
    setConfirming(false);
  }, [open, initial]);

  const set = <K extends keyof EmployeeProfile>(key: K, value: EmployeeProfile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));
  // Karynn, 29 September: field staff are PRN / Per Diem "unless we manually
  // change it" — so the role sets the type until somebody touches the type.
  const setRole = (role: EmployeeRole) =>
    setP((prev) => ({ ...prev, role, employmentType: typeTouched ? prev.employmentType : defaultEmploymentType(role) }));
  const setContact = <K extends keyof EmergencyContact>(index: number, key: K, value: EmergencyContact[K]) =>
    setP((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    }));

  const computedMr = mrNumberFrom({ firstName: p.firstName, lastName: p.lastName, ssn });
  const problem = whyNotSaveEmployee(p);
  const toggleDiscipline = (d: string) =>
    set("disciplines", p.disciplines.includes(d) ? p.disciplines.filter((x) => x !== d) : [...p.disciplines, d]);
  const addLanguage = () => {
    const l = language.trim();
    const have = [p.preferredLanguage, ...p.otherLanguages].map((x) => x.trim().toLowerCase());
    if (l && !have.includes(l.toLowerCase())) set("otherLanguages", [...p.otherLanguages, l]);
    setLanguage("");
  };
  const changes = initial ? changedFieldLabels(initial, { ...p, mrNumber: computedMr ?? p.mrNumber }) : [];
  const save = () => {
    if (problem) return;
    onSave({ ...p, mrNumber: computedMr ?? p.mrNumber });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit employee" : "Add an employee"}</DialogTitle>
          <DialogDescription>A first and last name is all that is needed to save. Everything else can follow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-primary">Personal information</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="First name" htmlFor="emp-first">
                <Input id="emp-first" value={p.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </Field>
              <Field label="Middle name" htmlFor="emp-middle">
                <Input id="emp-middle" value={p.middleName} onChange={(e) => set("middleName", e.target.value)} />
              </Field>
              <Field label="Last name" htmlFor="emp-last">
                <Input id="emp-last" value={p.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </Field>
              <Field label="Date of birth" htmlFor="emp-dob">
                <Input id="emp-dob" type="date" value={p.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value || null)} />
              </Field>
              <Field label="External id" htmlFor="emp-ext">
                <Input id="emp-ext" value={p.externalId} onChange={(e) => set("externalId", e.target.value)} />
              </Field>
              <Field label="Gender" htmlFor="emp-gender">
                <select id="emp-gender" className={SELECT} value={p.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Referral source" htmlFor="emp-refsrc">
                <select id="emp-refsrc" className={SELECT} value={p.referralSource} onChange={(e) => set("referralSource", e.target.value)}>
                  <option value="">—</option>
                  {REFERRAL_SOURCES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              {p.referralSource === "Other" && (
                <Field label="Which one" htmlFor="emp-refother">
                  <Input id="emp-refother" value={p.referralSourceOther} onChange={(e) => set("referralSourceOther", e.target.value)} />
                </Field>
              )}
              <Field label="Migratory status" htmlFor="emp-migratory">
                <select id="emp-migratory" className={SELECT} value={p.migratoryStatus} onChange={(e) => set("migratoryStatus", e.target.value)}>
                  <option value="">—</option>
                  {MIGRATORY_STATUSES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Social security number" htmlFor="emp-ssn" hint="not saved">
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="emp-ssn"
                      type={showSsn ? "text" : "password"}
                      value={ssn}
                      onChange={(e) => setSsn(e.target.value)}
                      placeholder="123-45-6789"
                      autoComplete="off"
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      aria-label={showSsn ? "Hide the number" : "Show the number"}
                      onClick={() => setShowSsn((s) => !s)}
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    >
                      {showSsn ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </Field>
                <Field label="MR number" hint="from the last four">
                  <p className="m-0 flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm tabular-nums">
                    {computedMr ?? p.mrNumber ?? <span className="text-muted-foreground">—</span>}
                  </p>
                </Field>
              </div>
              <p className="m-0 flex items-start gap-1.5 pt-2.5 text-[12px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
                <ShieldCheck className="mt-[2px] h-3.5 w-3.5 flex-none text-[#0B7268]" aria-hidden="true" />
                Joy computes the MR number from the last four digits and keeps only the number. The social security
                number itself is never saved — not on the record, not on this device, not in the audit trail.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-primary">Employment</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Role" htmlFor="emp-role">
                <select id="emp-role" className={SELECT} value={p.role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Title" htmlFor="emp-title">
                <Input id="emp-title" value={p.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Employment type" htmlFor="emp-type" hint={typeHint(p)}>
                <select
                  id="emp-type"
                  className={SELECT}
                  value={p.employmentType}
                  onChange={(e) => {
                    setTypeTouched(true);
                    set("employmentType", e.target.value);
                  }}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {!(EMPLOYMENT_TYPES as readonly string[]).includes(p.employmentType) && p.employmentType && (
                    <option value={p.employmentType}>{p.employmentType}</option>
                  )}
                </select>
              </Field>
            </div>
            <Field label="Status">
              <div
                role="radiogroup"
                aria-label="Employment status"
                className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-[var(--paper-sunken)] p-[3px]"
              >
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={p.status === s}
                    onClick={() => set("status", s)}
                    className={cn(
                      "rounded-[8px] px-3 py-[6px] text-[12.5px] transition-colors",
                      p.status === s
                        ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {EMPLOYEE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Application date" htmlFor="emp-appdate">
                <Input id="emp-appdate" type="date" value={p.applicationDate ?? ""} onChange={(e) => set("applicationDate", e.target.value || null)} />
              </Field>
              <Field label="Hire date" htmlFor="emp-hire">
                <Input id="emp-hire" type="date" value={p.hiredOn ?? ""} onChange={(e) => set("hiredOn", e.target.value || null)} />
              </Field>
              <Field label="Rehire date" htmlFor="emp-rehire">
                <Input id="emp-rehire" type="date" value={p.rehireDate ?? ""} onChange={(e) => set("rehireDate", e.target.value || null)} />
              </Field>
              <Field label="Job description signed on" htmlFor="emp-jobdesc">
                <Input id="emp-jobdesc" type="date" value={p.jobDescriptionSignedOn ?? ""} onChange={(e) => set("jobDescriptionSignedOn", e.target.value || null)} />
              </Field>
              <Field label="Staff's license" htmlFor="emp-lic" hint="NPI or license #">
                <Input id="emp-lic" value={p.staffLicense} onChange={(e) => set("staffLicense", e.target.value)} />
              </Field>
              <Field label="Pay rate" htmlFor="emp-rate" hint="per hour">
                <Input
                  id="emp-rate"
                  type="number"
                  step="0.25"
                  value={p.baseRate ?? ""}
                  onChange={(e) => set("baseRate", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Agreed weekly hours" htmlFor="emp-hours">
                <Input
                  id="emp-hours"
                  type="number"
                  value={p.weeklyHours ?? ""}
                  onChange={(e) => set("weeklyHours", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Base location" htmlFor="emp-loc">
                <Input id="emp-loc" value={p.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={p.drives}
                onChange={(e) => set("drives", e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Drives clients — needs a license and insurance on file
            </label>
            <Field label="Disciplines">
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {DISCIPLINES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={p.disciplines.includes(d)}
                    onClick={() => toggleDiscipline(d)}
                    className={cn(
                      "rounded-full border px-2.5 py-[4px] text-[12px] transition-colors",
                      p.disciplines.includes(d)
                        ? "border-primary bg-[#EEF0FE] font-medium text-primary"
                        : "border-[var(--hairline)] text-muted-foreground hover:bg-[var(--wash)]",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Exclusion list" htmlFor="emp-excl">
                <select id="emp-excl" className={SELECT} value={p.exclusionStatus} onChange={(e) => set("exclusionStatus", e.target.value as ExclusionStatus)}>
                  {(Object.keys(EXCLUSION_LABELS) as ExclusionStatus[]).map((k) => (
                    <option key={k} value={k}>{EXCLUSION_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status last checked" htmlFor="emp-exclat">
                <Input id="emp-exclat" type="date" value={p.exclusionCheckedAt ?? ""} onChange={(e) => set("exclusionCheckedAt", e.target.value || null)} />
              </Field>
            </div>
            <Field label="Tags">
              <TagPicker presets={tagPresets.employees} value={p.tags} onChange={(tags) => set("tags", tags)} />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-primary">Address</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Address" htmlFor="emp-addr1" className="sm:col-span-2">
                <Input id="emp-addr1" value={p.address.line1} onChange={(e) => set("address", { ...p.address, line1: e.target.value })} />
              </Field>
              <Field label="Address line 2" htmlFor="emp-addr2">
                <Input id="emp-addr2" value={p.address.line2} onChange={(e) => set("address", { ...p.address, line2: e.target.value })} />
              </Field>
              <Field label="City" htmlFor="emp-city">
                <Input id="emp-city" value={p.address.city} onChange={(e) => set("address", { ...p.address, city: e.target.value })} />
              </Field>
              <Field label="State" htmlFor="emp-state">
                <Input id="emp-state" value={p.address.state} onChange={(e) => set("address", { ...p.address, state: e.target.value })} placeholder="Texas, TX" />
              </Field>
              <Field label="Zip code" htmlFor="emp-zip">
                <Input id="emp-zip" value={p.address.zip} onChange={(e) => set("address", { ...p.address, zip: e.target.value })} />
              </Field>
              <Field label="County" htmlFor="emp-county">
                <Input id="emp-county" value={p.address.county} onChange={(e) => set("address", { ...p.address, county: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-primary">Contact information</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone (mobile)" htmlFor="emp-mobile" hint="needed for the caregiver app">
                <Input id="emp-mobile" value={p.phoneMobile} onChange={(e) => set("phoneMobile", e.target.value)} />
              </Field>
              <Field label="Email address" htmlFor="emp-email">
                <Input id="emp-email" value={p.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Preferred language" htmlFor="emp-lang">
                <Input id="emp-lang" value={p.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} />
              </Field>
              <Field label="Also speaks" htmlFor="emp-lang2" hint={isBilingual(p) ? "bilingual" : "leave empty if only one"}>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="emp-lang2"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addLanguage();
                      }
                    }}
                    placeholder="Spanish"
                    className="min-w-0 flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addLanguage} className="h-10 flex-none">
                    Add
                  </Button>
                </div>
                {p.otherLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {p.otherLanguages.map((l) => (
                      <span
                        key={l}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[12px]"
                      >
                        {l}
                        <button
                          type="button"
                          aria-label={`Remove ${l}`}
                          onClick={() => set("otherLanguages", p.otherLanguages.filter((x) => x !== l))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </div>
            <Field label="General notes" htmlFor="emp-notes">
              <textarea
                id="emp-notes"
                value={p.generalNotes}
                onChange={(e) => set("generalNotes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="m-0 text-[13px] font-semibold text-primary">Emergency contacts</h3>
            {p.emergencyContacts.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-[10px] border border-[var(--hairline)] p-3.5 sm:grid-cols-2">
                <p className="m-0 text-[12px] font-medium text-muted-foreground sm:col-span-2">Emergency contact {i + 1}</p>
                <Field label="Name" htmlFor={`emp-ec-name-${i}`}>
                  <Input id={`emp-ec-name-${i}`} value={c.name} onChange={(e) => setContact(i, "name", e.target.value)} />
                </Field>
                <Field label="Relationship" htmlFor={`emp-ec-rel-${i}`}>
                  <select id={`emp-ec-rel-${i}`} className={SELECT} value={c.relationship} onChange={(e) => setContact(i, "relationship", e.target.value)}>
                    <option value="">—</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                {c.relationship === "Other" && (
                  <Field label="Who" htmlFor={`emp-ec-who-${i}`} hint="neighbour, pastor, roommate…" className="sm:col-span-2">
                    <Input id={`emp-ec-who-${i}`} value={c.relationshipOther ?? ""} onChange={(e) => setContact(i, "relationshipOther", e.target.value)} />
                  </Field>
                )}
                <Field label="Phone" htmlFor={`emp-ec-phone-${i}`}>
                  <Input id={`emp-ec-phone-${i}`} value={c.phone} onChange={(e) => setContact(i, "phone", e.target.value)} />
                </Field>
                <Field label="Address" htmlFor={`emp-ec-addr-${i}`}>
                  <Input id={`emp-ec-addr-${i}`} value={c.address} onChange={(e) => setContact(i, "address", e.target.value)} />
                </Field>
              </div>
            ))}
          </section>

          {problem && (p.firstName || p.lastName) && (
            <p className="m-0 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[12.5px] text-[#B42318]">{problem}</p>
          )}
        </div>

        {confirming && initial ? (
          <div
            role="group"
            aria-label="Confirm the changes"
            className="flex flex-col gap-2.5 rounded-[12px] border border-[#FCE8B6] bg-[#FFFAEB] p-4"
          >
            <p className="m-0 text-[14px] font-semibold text-foreground">
              Save changes to {fullName(initial) || "this employee"}?
            </p>
            {changes.length === 0 ? (
              <p className="m-0 text-[12.5px] text-[#B54708]">Nothing has changed. There is nothing to save.</p>
            ) : (
              <ul className="m-0 flex flex-wrap gap-1.5 p-0">
                {changes.map((c) => (
                  <li key={c} className="list-none rounded-full bg-[var(--paper)] px-2.5 py-[3px] text-[12px] text-[var(--ink-body)]">
                    {c}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Back to the form
              </Button>
              <Button disabled={changes.length === 0} onClick={save}>
                Yes, save {changes.length === 1 ? "this change" : `these ${changes.length} changes`}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!!problem}
              onClick={() => {
                if (problem) return;
                if (initial) {
                  setConfirming(true);
                  return;
                }
                save();
              }}
            >
              {initial ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
