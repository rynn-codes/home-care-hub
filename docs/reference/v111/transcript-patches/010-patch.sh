cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

# diff normalises against blankProfile so records saved before a field existed do not report it as changed
patch('src/domain/records/profileChanges.ts', [
('''import type { EmployeeProfile } from "@/domain/employees/profile";''',
 '''import { blankProfile, type EmployeeProfile } from "@/domain/employees/profile";'''),
('''export function changedFieldLabels(before: EmployeeProfile, after: EmployeeProfile): string[] {
  const out: string[] = [];
  for (const key of Object.keys(FIELD_LABELS) as Array<keyof EmployeeProfile>) {
    if (same(before[key], after[key])) continue;''','''export function changedFieldLabels(before: EmployeeProfile, after: EmployeeProfile): string[] {
  // A record saved before a field existed has no key for it; blank is blank.
  const a: EmployeeProfile = { ...blankProfile(), ...before };
  const b: EmployeeProfile = { ...blankProfile(), ...after };
  const out: string[] = [];
  for (const key of Object.keys(FIELD_LABELS) as Array<keyof EmployeeProfile>) {
    if (same(a[key], b[key])) continue;'''),
])
patch('src/domain/records/profileChanges.test.ts', [
('''  it("reports nothing when nothing moved", () => {
    expect(changedFieldLabels(blankProfile(), blankProfile())).toEqual([]);''','''  it("reports nothing when nothing moved", () => {
    expect(changedFieldLabels(blankProfile(), blankProfile())).toEqual([]);
    // A record saved before "Other languages" existed is not a change to it.
    const older = { ...blankProfile() } as Partial<typeof blank>;
    delete older.otherLanguages;
    expect(changedFieldLabels(older as typeof blank, blankProfile())).toEqual([]);'''),
('''const change = (over''','''const blank = blankProfile();

const change = (over'''),
])

# StatusControl: name the person on the confirm step
patch('src/components/layout/StatusControl.tsx', [
(''' * well and states its consequences before it will commit, because it is the
 * one that starts a retention clock and a final invoice.
 */''',''' * well and states its consequences before it will commit, because it is the
 * one that starts a retention clock and a final invoice.
 *
 * ── The second step names the person ─────────────────────────────────────
 *
 * Karynn, 29 September: "need a secondary confirm to ensure the change is
 * warranted on the right person." Picking a status opens the confirm step;
 * that step carries the person's name in its heading and on its button, so
 * "Change Pamela P to on hold" is read before it is clicked. Two clicks, not
 * three — the reason field was already the pause.
 */'''),
('''  /** "Client status", "Employment status" — what the menu is about. */
  label: string;''','''  /** "Client status", "Employment status" — what the menu is about. */
  label: string;
  /** Whose status — named on the confirm step so the right person is changed. */
  subject?: string;'''),
('''  label,
  onChange,
  disabled,
}: Props<T>) {''','''  label,
  subject,
  onChange,
  disabled,
}: Props<T>) {'''),
('''                <span className="text-[13px] font-semibold">
                  {currentOption?.label ?? current} → {picked.label}
                </span>''','''                <span className="flex flex-col gap-[2px]">
                  {subject && <span className="text-[13px] font-semibold">{subject}</span>}
                  <span className={cn("text-[13px]", subject ? "text-muted-foreground" : "font-semibold")}>
                    {currentOption?.label ?? current} → {picked.label}
                  </span>
                </span>'''),
('''                      : `Change to ${picked.label.toLowerCase()}`}''',
 '''                      : `Change ${subject ?? ""} to ${picked.label.toLowerCase()}`.replace("  ", " ")}'''),
])

# Directory grouping: caregivers and CNAs together
patch('src/components/employees/EmployeeDirectory.tsx', [
('''  /*
   * The role order is the agency's, not the type union's: caregivers and CNAs
   * are most of the staff and most of the looking-up, so they lead.
   */
  const ROLE_ORDER: EmployeeRole[] = ["caregiver", "cna", "lvn", "rn", "office"];
  const grouped = ROLE_ORDER.map(
    (role) => [role, rows.filter((r) => r.role === role)] as const,
  ).filter(([, group]) => group.length > 0);''','''  /*
   * The group order is the agency's, not the type union's: field staff are
   * most of the roster and most of the looking-up, so they lead.
   *
   * Karynn, 29 September: "Combine/merge CNA and caregiver as they operate
   * pretty much the same. Keep RN and office." One group for both; each row
   * still carries its own role pill, so who is certified stays visible.
   */
  const GROUPS: ReadonlyArray<{ key: string; label: string; roles: EmployeeRole[] }> = [
    { key: "field", label: "Caregivers & CNAs", roles: ["caregiver", "cna"] },
    { key: "lvn", label: ROLE_LABELS.lvn, roles: ["lvn"] },
    { key: "rn", label: ROLE_LABELS.rn, roles: ["rn"] },
    { key: "office", label: ROLE_LABELS.office, roles: ["office"] },
  ];
  const grouped = GROUPS.map(
    (g) => [g, rows.filter((r) => g.roles.includes(r.role))] as const,
  ).filter(([, group]) => group.length > 0);'''),
('''            {grouped.map(([role, group]) => (
            <tbody key={role}>''','''            {grouped.map(([g, group]) => (
            <tbody key={g.key}>'''),
('''                  {ROLE_LABELS[role]}
                  <span className="ml-1.5 font-medium text-muted-foreground">{group.length}</span>''',
 '''                  {g.label}
                  <span className="ml-1.5 font-medium text-muted-foreground">{group.length}</span>'''),
])
EOF