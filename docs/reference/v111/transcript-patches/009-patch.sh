cd /home/claude/joy && python3 - <<'EOF'
p='src/components/employees/EmployeeForm.tsx'
s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:70],s.count(old))
    s=s.replace(old,new)

rep('''import {
  DISCIPLINES,
  EMPLOYMENT_TYPES,
  EXCLUSION_LABELS,
  GENDERS,
  MIGRATORY_STATUSES,
  REFERRAL_SOURCES,
  RELATIONSHIPS,
  blankProfile,
  mrNumberFrom,
  whyNotSaveEmployee,
  type EmployeeProfile,
  type ExclusionStatus,
} from "@/domain/employees/profile";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";''','''import {
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
  type EmployeeProfile,
  type ExclusionStatus,
} from "@/domain/employees/profile";
import { changedFieldLabels } from "@/domain/records/profileChanges";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";''')

rep(''' * screenshots are her current system's form, and this is its field list in its
 * own order and its own words — Migratory status, Staff's License (NPI or
 * Medicaid Id), Exclusion list, two emergency contacts.''',''' * screenshots are her current system's form, and this is its field list in its
 * own order and mostly its own words — Migratory status, Staff's License,
 * Exclusion list, two emergency contacts. Where she has since changed her mind
 * the form follows: no home phone (29 September), "NPI or license #" rather
 * than the old system's "NPI or Medicaid id" — Joy does not take Medicaid.''')

rep(''' * weekly and mostly returns to in order to change one field, and hunting for
 * which of four steps holds "rehire date" is worse than scrolling.
 */''',''' * weekly and mostly returns to in order to change one field, and hunting for
 * which of four steps holds "rehire date" is worse than scrolling.
 *
 * ── Saving an edit asks once more ────────────────────────────────────────
 *
 * Karynn, 29 September: "After any edits are made for changes to employee
 * profile or client profile, need a secondary confirm to ensure the change is
 * warranted on the right person." So "Save changes" on an existing record does
 * not save; it shows the person's name and the fields that moved, and the
 * second click saves. Adding somebody new is not an edit and saves at once —
 * there is no wrong person to have opened.
 */''')

rep('''  const [p, setP] = useState<EmployeeProfile>(blankProfile());
  const [ssn, setSsn] = useState("");
  const [showSsn, setShowSsn] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setP(initial ? { ...blankProfile(), ...initial } : blankProfile());
    setSsn("");
    setShowSsn(false);
    setTagDraft("");
  }, [open, initial]);

  const set = <K extends keyof EmployeeProfile>(key: K, value: EmployeeProfile[K]) =>
    setP((cur) => ({ ...cur, [key]: value }));
''','''  const [p, setP] = useState<EmployeeProfile>(blankProfile());
  const [ssn, setSsn] = useState("");
  const [showSsn, setShowSsn] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");
  /** Whether the employment type was picked by hand this time the form was open. */
  const [typeTouched, setTypeTouched] = useState(false);
  /** The second look before an edit is saved. */
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setP(initial ? { ...blankProfile(), ...initial } : blankProfile());
    setSsn("");
    setShowSsn(false);
    setTagDraft("");
    setLanguageDraft("");
    setTypeTouched(false);
    setConfirming(false);
  }, [open, initial]);

  const set = <K extends keyof EmployeeProfile>(key: K, value: EmployeeProfile[K]) =>
    setP((cur) => ({ ...cur, [key]: value }));

  /*
   * Karynn, 29 September: "every employee that is a CNA/Caregiver is PRN/Per
   * Diem. You can automatically set it as that unless we manually change it."
   * The role drives the type until somebody picks a type themselves; after
   * that the role can change all it likes.
   */
  const setRole = (role: EmployeeRole) =>
    setP((cur) => ({
      ...cur,
      role,
      employmentType: typeTouched ? cur.employmentType : defaultEmploymentType(role),
    }));
''')

rep('''  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !p.tags.includes(t)) set("tags", [...p.tags, t]);
    setTagDraft("");
  };
''','''  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !p.tags.includes(t)) set("tags", [...p.tags, t]);
    setTagDraft("");
  };

  const addLanguage = () => {
    const l = languageDraft.trim();
    const have = [p.preferredLanguage, ...p.otherLanguages].map((x) => x.trim().toLowerCase());
    if (l && !have.includes(l.toLowerCase())) set("otherLanguages", [...p.otherLanguages, l]);
    setLanguageDraft("");
  };

  /* What the confirm step lists. Empty for a new employee. */
  const changed = initial ? changedFieldLabels(initial, { ...p, mrNumber: computedMr ?? p.mrNumber }) : [];

  const save = () => {
    if (problem) return;
    /* The MR number rides along; the digits it came from do not. */
    onSave({ ...p, mrNumber: computedMr ?? p.mrNumber });
    onOpenChange(false);
  };
''')

# Role select uses setRole
rep('''<select id="emp-role" className={selectClass} value={p.role} onChange={(e) => set("role", e.target.value as EmployeeRole)}>''',
    '''<select id="emp-role" className={selectClass} value={p.role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>''')

# Status: segmented control
rep('''              <Field label="Status" htmlFor="emp-status">
                <select id="emp-status" className={selectClass} value={p.status} onChange={(e) => set("status", e.target.value as EmployeeStatus)}>
                  {STATUSES.map((st) => <option key={st} value={st}>{EMPLOYEE_STATUS_LABELS[st]}</option>)}
                </select>
              </Field>
              <Field label="Employment type" htmlFor="emp-type">
                <select id="emp-type" className={selectClass} value={p.employmentType} onChange={(e) => set("employmentType", e.target.value)}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>''','''              <Field label="Employment type" htmlFor="emp-type" hint={FIELD_TYPE_HINT(p)}>
                <select
                  id="emp-type"
                  className={selectClass}
                  value={p.employmentType}
                  onChange={(e) => {
                    setTypeTouched(true);
                    set("employmentType", e.target.value);
                  }}
                >
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  {/* A type from before the list changed still shows, so a save never silently rewrites it. */}
                  {!EMPLOYMENT_TYPES.includes(p.employmentType as (typeof EMPLOYMENT_TYPES)[number]) && p.employmentType && (
                    <option value={p.employmentType}>{p.employmentType}</option>
                  )}
                </select>
              </Field>
            </div>

            {/*
              Karynn, 29 September: "Under edit employee give me a slider to
              make active/inactive/etc." One control, every status visible,
              the current one filled — no dropdown to open to find out what
              the choices are.
            */}
            <Field label="Status">
              <div
                role="radiogroup"
                aria-label="Employment status"
                className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-[var(--paper-sunken)] p-[3px]"
              >
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={p.status === st}
                    onClick={() => set("status", st)}
                    className={cn(
                      "rounded-[8px] px-3 py-[6px] text-[12.5px] transition-colors",
                      p.status === st
                        ? "bg-[var(--paper)] font-medium text-foreground shadow-[0_1px_2px_rgba(25,26,46,.08)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {EMPLOYEE_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">''')

rep('''              <Field label="Staff's license" htmlFor="emp-lic" hint="NPI or Medicaid id">''',
    '''              <Field label="Staff's license" htmlFor="emp-lic" hint="NPI or license #">''')

rep('''                  placeholder="Bilingual, weekends only…"''','''                  placeholder="Weekends only, nights…"''')

# Contact: remove home phone; languages
rep('''              <Field label="Phone (mobile)" htmlFor="emp-mobile" hint="needed for the caregiver app">
                <Input id="emp-mobile" value={p.phoneMobile} onChange={(e) => set("phoneMobile", e.target.value)} />
              </Field>
              <Field label="Phone (home)" htmlFor="emp-home">
                <Input id="emp-home" value={p.phoneHome} onChange={(e) => set("phoneHome", e.target.value)} />
              </Field>
              <Field label="Email address" htmlFor="emp-email">
                <Input id="emp-email" value={p.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Preferred language" htmlFor="emp-lang">
                <Input id="emp-lang" value={p.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} />
              </Field>
            </div>''','''              <Field label="Phone (mobile)" htmlFor="emp-mobile" hint="needed for the caregiver app">
                <Input id="emp-mobile" value={p.phoneMobile} onChange={(e) => set("phoneMobile", e.target.value)} />
              </Field>
              <Field label="Email address" htmlFor="emp-email">
                <Input id="emp-email" value={p.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Preferred language" htmlFor="emp-lang">
                <Input id="emp-lang" value={p.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} />
              </Field>
              {/* Karynn, 29 September: "add if [the employee] is bilingual." Which languages, not just whether. */}
              <Field label="Also speaks" htmlFor="emp-lang2" hint={isBilingual(p) ? "bilingual" : "leave empty if only one"}>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="emp-lang2"
                    value={languageDraft}
                    onChange={(e) => setLanguageDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addLanguage();
                      }
                    }}
                    placeholder="Spanish"
                    className="min-w-0 flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addLanguage} className="h-10 flex-none">Add</Button>
                </div>
                {p.otherLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {p.otherLanguages.map((l) => (
                      <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-[3px] text-[12px]">
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
            </div>''')

# Emergency contact "Other" → who
rep('''                <Field label="Relationship" htmlFor={`emp-ec-rel-${i}`}>
                  <select id={`emp-ec-rel-${i}`} className={selectClass} value={c.relationship} onChange={(e) => setContact(i, "relationship", e.target.value)}>
                    <option value="">—</option>
                    {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>''','''                <Field label="Relationship" htmlFor={`emp-ec-rel-${i}`}>
                  <select id={`emp-ec-rel-${i}`} className={selectClass} value={c.relationship} onChange={(e) => setContact(i, "relationship", e.target.value)}>
                    <option value="">—</option>
                    {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                {/* Karynn, 29 September: "If other is selected, need to fill in who." */}
                {c.relationship === "Other" && (
                  <Field label="Who" htmlFor={`emp-ec-who-${i}`} hint="neighbour, pastor, roommate…" className="sm:col-span-2">
                    <Input
                      id={`emp-ec-who-${i}`}
                      value={c.relationshipOther ?? ""}
                      onChange={(e) => setContact(i, "relationshipOther", e.target.value)}
                    />
                  </Field>
                )}''')

# Footer with confirm step
rep('''          {problem && (p.firstName || p.lastName) && (
            <p className="m-0 rounded-[10px] bg-[#FEF3F2] px-3.5 py-2.5 text-[12.5px] text-[#B42318]">{problem}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={Boolean(problem)}
            onClick={() => {
              if (problem) return;
              /* The MR number rides along; the digits it came from do not. */
              onSave({ ...p, mrNumber: computedMr ?? p.mrNumber });
              onOpenChange(false);
            }}
          >
            {initial ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>''','''          {problem && (p.firstName || p.lastName) && (
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
            {changed.length === 0 ? (
              <p className="m-0 text-[12.5px] text-[#B54708]">Nothing has changed. There is nothing to save.</p>
            ) : (
              <ul className="m-0 flex flex-wrap gap-1.5 p-0">
                {changed.map((label) => (
                  <li key={label} className="list-none rounded-full bg-[var(--paper)] px-2.5 py-[3px] text-[12px] text-[var(--ink-body)]">
                    {label}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setConfirming(false)}>Back to the form</Button>
              <Button disabled={changed.length === 0} onClick={save}>
                Yes, save {changed.length === 1 ? "this change" : `these ${changed.length} changes`}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={Boolean(problem)}
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
        )}''')

rep('''const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
''','''const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** The hint under Employment type: says when the role set it. */
const FIELD_TYPE_HINT = (p: EmployeeProfile) =>
  p.employmentType === defaultEmploymentType(p.role) && (p.role === "caregiver" || p.role === "cna")
    ? "field staff default"
    : undefined;
''')
open(p,'w').write(s)
EOF