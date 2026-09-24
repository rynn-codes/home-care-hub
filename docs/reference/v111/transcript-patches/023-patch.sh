cd /home/claude/joy && grep -n "^import" src/lib/employeeRoster.ts && python3 - <<'EOF'
p='src/context/DemoDataProvider.tsx'
s=open(p).read()
old='''      const before = isAdded
        ? (s.addedEmployees.find((e) => e.id === employeeId)?.profile ?? null)
        : (s.employeeEdits[employeeId] ?? null);
      const labels = before ? changedFieldLabels(before as EmployeeProfile, profile) : [];
      const change: ProfileChange | null = id
        ? {
            id: newId("chg"),
            kind: "employee",
            entityId: employeeId,
            name: fullName(profile),
            what: "profile",
            summary: before ? changeSummary(labels) : "Profile filled in",
            before,
            changedAt: new Date().toISOString(),
            changedBy: currentUserRef.current.name,
          }
        : null;
      // An edit that changed nothing leaves nothing to undo.
      if (change && before && labels.length === 0) return s;'''
new='''      const before = isAdded
        ? (s.addedEmployees.find((e) => e.id === employeeId)?.profile ?? null)
        : (s.employeeEdits[employeeId] ?? null);
      // What the form showed before this edit — the seed's own columns when
      // nothing had been typed over them yet — so the summary names the fields.
      const seed = seedEmployees.find((e) => e.id === employeeId);
      const baseline = (before as EmployeeProfile | null) ?? (seed ? profileFromSeed(seed) : null);
      const labels = baseline ? changedFieldLabels(baseline, profile) : [];
      const change: ProfileChange | null = id
        ? {
            id: newId("chg"),
            kind: "employee",
            entityId: employeeId,
            name: fullName(profile),
            what: "profile",
            summary: baseline ? changeSummary(labels) : "Profile filled in",
            before,
            changedAt: new Date().toISOString(),
            changedBy: currentUserRef.current.name,
          }
        : null;
      // An edit that changed nothing leaves nothing to undo.
      if (change && baseline && labels.length === 0) return s;'''
assert s.count(old)==1
s=s.replace(old,new)
old2='''import { seedEmployees } from "@/lib/employeesSeed";'''
assert s.count(old2)==1
s=s.replace(old2,'''import { seedEmployees } from "@/lib/employeesSeed";
import { profileFromSeed } from "@/lib/employeeRoster";''')
open(p,'w').write(s)
EOF
npm run typecheck 2>&1 | grep -v "^>"; npm run build:demo 2>&1 | tail -1 && timeout 180 node pw-check.mjs 2>&1 | head -22