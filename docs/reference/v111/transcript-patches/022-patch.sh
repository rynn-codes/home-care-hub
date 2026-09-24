cd /home/claude/joy && python3 - <<'EOF'
p='src/components/employees/EmployeeRecordView.tsx'
s=open(p).read()
old='''            {employee.kin && (
              <>
                <SectionLabel>Emergency contact</SectionLabel>'''
assert s.count(old)==1
s=s.replace(old,'''            {/* The seed's one-line kin, only when the profile has no contacts of its own. */}
            {employee.kin && !p?.emergencyContacts.some((c) => c.name.trim()) && (
              <>
                <SectionLabel>Emergency contact</SectionLabel>''')
open(p,'w').write(s)
EOF
npm run typecheck 2>&1 | grep -v "^>" ; npm run lint 2>&1 | tail -3; npx vitest run 2>&1 | grep -E "Tests |Test Files|FAIL|✗" ; npm run build:demo 2>&1 | tail -3