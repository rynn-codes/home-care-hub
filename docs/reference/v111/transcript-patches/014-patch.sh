cd /home/claude/joy && python3 - <<'EOF'
p='src/pages/Employees.tsx'
s=open(p).read()
old='''import { useDemo } from "@/context/DemoDataProvider";
import { buildRoster'''
assert s.count(old)==1
s=s.replace(old,'''import { useDemo } from "@/context/DemoDataProvider";
import { useAgencySettings } from "@/lib/agencyStore";
import { buildRoster''')
open(p,'w').write(s)
EOF
npm run typecheck 2>&1 | tail -30