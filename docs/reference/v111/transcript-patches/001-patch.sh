cd /home/claude/joy && python3 - <<'EOF'
p='src/domain/employees/profile.ts'
s=open(p).read()
def rep(old,new,count=1):
    global s
    assert s.count(old)==count,(old,s.count(old))
    s=s.replace(old,new)

rep('''export const EMPLOYMENT_TYPES = [
  "Full-time · hourly",
  "Full-time · salaried",
  "Part-time · hourly",
  "Per Diem",
  "Contract",
] as const;
''','''export const EMPLOYMENT_TYPES = [
  "PRN / Per Diem",
  "Full-time · hourly",
  "Full-time · salaried",
  "Part-time · hourly",
  "Contract",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/**
 * What a new employee's employment type starts as, by role.
 *
 * Karynn, 29 September: "every employee that is a CNA/Caregiver is PRN/Per
 * Diem. You can automatically set it as that unless we manually change it."
 * Field staff are as-needed by default; the office and the nurses are not, so
 * they keep the older default and somebody picks. The form applies this when
 * the role changes and the type has not been touched by hand — see
 * EmployeeForm — so a deliberate choice is never overwritten.
 */
export const FIELD_ROLES: readonly EmployeeRole[] = ["caregiver", "cna"];

export function defaultEmploymentType(role: EmployeeRole): EmploymentType {
  return FIELD_ROLES.includes(role) ? "PRN / Per Diem" : "Part-time · hourly";
}
''')

rep('''export interface EmergencyContact {
  name: string;
  address: string;
  phone: string;
  relationship: string;
}

export function blankContact(): EmergencyContact {
  return { name: "", address: "", phone: "", relationship: "" };
}''','''export interface EmergencyContact {
  name: string;
  address: string;
  phone: string;
  relationship: string;
  /**
   * Who they are when the relationship is "Other". Karynn, 29 September: "If
   * other is selected, need to fill in who." Older records saved before the
   * field existed read as an empty string.
   */
  relationshipOther?: string;
}

export function blankContact(): EmergencyContact {
  return { name: "", address: "", phone: "", relationship: "", relationshipOther: "" };
}

/** "Other · Neighbour" rather than a bare "Other". */
export function relationshipLabel(c: Pick<EmergencyContact, "relationship" | "relationshipOther">): string {
  if (c.relationship === "Other" && c.relationshipOther?.trim()) return `Other · ${c.relationshipOther.trim()}`;
  return c.relationship;
}''')

rep('''  /** NPI or Medicaid id, as her form words it. */
  staffLicense: string;''','''  /**
   * NPI or licence number. Her current system says "NPI or Medicaid id";
   * Karynn, 29 September: "take off medicaid ID. We don't take medicaid."
   */
  staffLicense: string;''')

rep('''  preferredLanguage: string;

  /* Dates */''','''  preferredLanguage: string;
  /**
   * Every other language they can work in. Karynn, 29 September: "add if
   * [the employee] is bilingual." Kept as a list rather than a yes/no because
   * "bilingual" on a roster is only useful when it says which — a Spanish
   * speaker and a Vietnamese speaker are not interchangeable to a family. See
   * `isBilingual` and `spokenLanguages`.
   */
  otherLanguages: string[];

  /* Dates */''')

rep('''  /* Contact */
  phoneHome: string;
  phoneMobile: string;''','''  /*
   * Contact. One phone. Karynn, 29 September: "No one really has home phones
   * anymore, so you can take home phone off." Records saved before that carry
   * a `phoneHome` key nothing reads any more.
   */
  phoneMobile: string;''')

rep('''    employmentType: "Part-time · hourly",
    disciplines: [],''','''    employmentType: defaultEmploymentType("caregiver"),
    disciplines: [],''')
rep('''    preferredLanguage: "English",
    applicationDate: null,''','''    preferredLanguage: "English",
    otherLanguages: [],
    applicationDate: null,''')
rep('''    phoneHome: "",
    phoneMobile: "",''','''    phoneMobile: "",''')

rep('''export function fullName(p: Pick<EmployeeProfile, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`.trim();
}''','''export function fullName(p: Pick<EmployeeProfile, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** Every language on the record, preferred first, without repeats or blanks. */
export function spokenLanguages(
  p: Pick<EmployeeProfile, "preferredLanguage" | "otherLanguages">,
): string[] {
  const out: string[] = [];
  for (const raw of [p.preferredLanguage, ...(p.otherLanguages ?? [])]) {
    const l = raw.trim();
    if (l && !out.some((x) => x.toLowerCase() === l.toLowerCase())) out.push(l);
  }
  return out;
}

export function isBilingual(p: Pick<EmployeeProfile, "preferredLanguage" | "otherLanguages">): boolean {
  return spokenLanguages(p).length >= 2;
}''')
open(p,'w').write(s)
EOF