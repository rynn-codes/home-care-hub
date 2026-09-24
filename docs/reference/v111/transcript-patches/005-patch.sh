cd /home/claude/joy && cp src/domain/employees/profile.test.ts /tmp/new_profile_test.ts && git checkout src/domain/employees/profile.test.ts && python3 - <<'EOF'
p='src/domain/employees/profile.test.ts'
s=open(p).read()
new=open('/tmp/new_profile_test.ts').read()
# drop the new file's import block, reuse the original's with extra names
body=new[new.index('describe("employment type defaults"'):]
s=s.replace('''import {
  ROSTER_HIDE_AFTER_DAYS,
  blankProfile,
  daysSince,
  mrNumberFrom,
  restingOffRoster,
  whyNotSaveEmployee,
} from "@/domain/employees/profile";''','''import {
  EMPLOYMENT_TYPES,
  ROSTER_HIDE_AFTER_DAYS,
  blankProfile,
  daysSince,
  defaultEmploymentType,
  isBilingual,
  mrNumberFrom,
  relationshipLabel,
  restingOffRoster,
  spokenLanguages,
  whyNotSaveEmployee,
} from "@/domain/employees/profile";''')
s=s.rstrip('\n')+'\n\n'+body
open(p,'w').write(s)
EOF
rm /tmp/new_profile_test.ts && npx vitest run src/domain/employees/profile.test.ts 2>&1 | grep -E "Tests|✓|✗|FAIL"