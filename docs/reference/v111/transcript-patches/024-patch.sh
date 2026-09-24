cd /home/claude/joy && grep -rn "employmentType" src --include=*.ts --include=*.tsx | grep -v "employeesSeed\|profile.ts\|EmployeeForm\|employeeRoster\|profileChanges\|EmployeeRecordView\|test" | head; python3 - <<'EOF'
import re
p='src/components/employees/EmployeeRecordView.tsx'
s=open(p).read()
old='''                        : `${OVERTIME_AFTER_HOURS - (weekHours || employee.weeklyHours || 0)} hrs below overtime`,'''
assert s.count(old)==1
s=s.replace(old,'''                        : `${Math.round((OVERTIME_AFTER_HOURS - (weekHours || employee.weeklyHours || 0)) * 10) / 10} hrs below overtime`,''')
open(p,'w').write(s)

p='src/lib/employeesSeed.ts'
s=open(p).read()
# Field staff (caregiver/cna) → PRN / Per Diem, per Karynn 29 September
blocks=re.split(r'(?=\n  \{\n    id: "emp-)', s)
out=[]
for b in blocks:
    if re.search(r'role: "(caregiver|cna)"', b):
        b=re.sub(r'employmentType: "(Full-time · hourly|Part-time · hourly)"', 'employmentType: "PRN / Per Diem"', b, count=1)
    out.append(b)
s=''.join(out)
s=s.replace(''' * Pay rates and weekly hours are Karynn's own, given on 9 September with the''',''' * Every caregiver and CNA is "PRN / Per Diem" — Karynn, 29 September: "every
 * employee that is a CNA/Caregiver is PRN/Per Diem." Nurses and the office
 * keep their own types.
 *
 * Pay rates and weekly hours are Karynn's own, given on 9 September with the''')
open(p,'w').write(s)
EOF
grep -n 'employmentType' src/lib/employeesSeed.ts