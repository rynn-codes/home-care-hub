cd /home/claude/joy && grep -n 'clients: \["Marilyn K"\]' src/lib/employeesSeed.ts | head -2; python3 - <<'EOF'
p='src/lib/employeesSeed.ts'
s=open(p).read()
old='''    clients: ["Marilyn K"],
    /* Mock, per Karynn 29 September. 555-01xx numbers reach nobody. */'''
assert s.count(old)==1
s=s.replace(old,'''    /* Pamela P is who the schedule board actually has her with, weekdays. */
    clients: ["Pamela P", "Marilyn K"],
    /* Mock, per Karynn 29 September. 555-01xx numbers reach nobody. */''')
old2='''"Chanel is the agency's longest-serving field caregiver, with Joy since March 2023 and on the Marilyn K case.'''
assert s.count(old2)==1
s=s.replace(old2,'''"Chanel is the agency's longest-serving field caregiver, with Joy since March 2023, primary on Pamela P and backup for Marilyn K.''')
open(p,'w').write(s)
EOF
npx vitest run 2>&1 | grep -E "Tests |FAIL" ; npm run build:demo 2>&1 | tail -1 && timeout 240 node pw-new.mjs 2>&1 | tail -70