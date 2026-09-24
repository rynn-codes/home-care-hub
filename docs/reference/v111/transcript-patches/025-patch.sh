cd /home/claude/joy && python3 - <<'EOF'
p='src/components/hiring/ApplicantDrawer.tsx'
s=open(p).read()
old='''  const [employmentType, setEmploymentType] = useState("Full-time · hourly");'''
assert s.count(old)==1
s=s.replace(old,'''  /* Karynn, 29 September: field staff start as PRN / Per Diem unless changed by hand. */
  const [employmentType, setEmploymentType] = useState<string>(defaultEmploymentType(guessedRole));
  const [typeTouched, setTypeTouched] = useState(false);''')
old='''            onChange={(e) => setRole(e.target.value as HireDetails["role"])}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {/* The agency's own four.'''
assert s.count(old)==1
s=s.replace(old,'''            onChange={(e) => {
              const next = e.target.value as HireDetails["role"];
              setRole(next);
              if (!typeTouched) setEmploymentType(defaultEmploymentType(next));
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {/* The agency's own four.''')
old='''          <Input
            id="hire-type"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
          />'''
assert s.count(old)==1
s=s.replace(old,'''          <select
            id="hire-type"
            value={employmentType}
            onChange={(e) => {
              setTypeTouched(true);
              setEmploymentType(e.target.value);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>''')
# import
import re
m=re.search(r'^import .*\n', s, re.M)
s=s.replace(m.group(0), m.group(0)+'import { EMPLOYMENT_TYPES, defaultEmploymentType } from "@/domain/employees/profile";\n',1)
open(p,'w').write(s)
EOF
npm run typecheck 2>&1 | grep -v "^>"; npm run lint 2>&1 | tail -1; npx vitest run 2>&1 | grep -E "Tests |FAIL" ; npm run build:demo 2>&1 | tail -1 && timeout 120 node pw-check.mjs 2>&1 | grep -E '"errors"|hrs below|bannerAfterEdit' ; rm -f pw-check.mjs