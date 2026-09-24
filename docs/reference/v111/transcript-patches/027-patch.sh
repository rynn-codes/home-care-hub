cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/components/layout/AppHeader.tsx', [
('''const newActions = [
  { label: "New Client", to: "/admissions" },
  { label: "New Employee", to: "/hiring" },
  { label: "Schedule Shift", to: "/scheduling" },
  { label: "New Assessment", to: "/admissions" },''','''/*
 * Karynn, 29 September: "New button at the top right, doesn't work on every
 * page. Run a check." It navigated and stopped: New Client took you to
 * Admissions and left you to find the button there, and from Admissions
 * itself it did nothing visible at all. Each item now names the dialog it
 * wants and the page opens it on arrival — see hooks/use-open-request.
 */
const newActions = [
  { label: "New Client", to: "/admissions", state: { open: "referral" } as const },
  { label: "New Employee", to: "/hiring", state: { open: "invite" } as const },
  { label: "Schedule Shift", to: "/scheduling", state: { open: "shift" } as const },
  { label: "New Assessment", to: "/admissions", state: { open: "assessment" } as const },'''),
])

patch('src/pages/Admissions.tsx', [
('''  const [deleting, setDeleting] = useState<SeedAdmission | null>(null);
  const navigate = useNavigate();
  const {
    admissions,
    people,''','''  const [deleting, setDeleting] = useState<SeedAdmission | null>(null);
  const navigate = useNavigate();
  /* The header's New menu, arriving with a dialog to open. */
  const openRequest = useOpenRequest<"referral" | "assessment">();
  useEffect(() => {
    if (openRequest === "referral") setReferralOpen(true);
    if (openRequest === "assessment") setPickerMode("assessment");
  }, [openRequest]);
  const {
    admissions,
    people,'''),
('''import { useNavigate } from "react-router-dom";''','''import { useNavigate } from "react-router-dom";
import { useOpenRequest } from "@/hooks/use-open-request";'''),
])
s=open('src/pages/Admissions.tsx').read()
import re
m=re.search(r'^import \{([^}]*)\} from "react";', s, re.M)
assert m, "react import"
names=[n.strip() for n in m.group(1).split(',') if n.strip()]
if 'useEffect' not in names: names.append('useEffect')
s=s.replace(m.group(0), 'import { '+', '.join(sorted(names))+' } from "react";')
open('src/pages/Admissions.tsx','w').write(s)

patch('src/pages/Hiring.tsx', [
('''  const [inviting, setInviting] = useState(false);
  const { hireEmployee } = useDemo();
  const navigate = useNavigate();''','''  const [inviting, setInviting] = useState(false);
  const { hireEmployee } = useDemo();
  const navigate = useNavigate();
  /* The header's New Employee, arriving with the invitation to open. */
  const openRequest = useOpenRequest<"invite">();
  useEffect(() => {
    if (openRequest === "invite") setInviting(true);
  }, [openRequest]);'''),
('''import { useNavigate } from "react-router-dom";''','''import { useNavigate } from "react-router-dom";
import { useOpenRequest } from "@/hooks/use-open-request";'''),
])
s=open('src/pages/Hiring.tsx').read()
m=re.search(r'^import \{([^}]*)\} from "react";', s, re.M)
names=[n.strip() for n in m.group(1).split(',') if n.strip()]
if 'useEffect' not in names: names.append('useEffect')
s=s.replace(m.group(0), 'import { '+', '.join(sorted(names))+' } from "react";')
open('src/pages/Hiring.tsx','w').write(s)

patch('src/pages/Scheduling.tsx', [
('''  const { state: routeState } = useLocation();
  useEffect(() => {
    const target = (routeState as { scheduleFor?: { client: string; caregiver: string | null } } | null)?.scheduleFor;''','''  const { state: routeState } = useLocation();
  /* The header's Schedule Shift, arriving with the new-shift dialog to open. */
  const openRequest = useOpenRequest<"shift">();
  useEffect(() => {
    if (openRequest === "shift") setAdding({ kind: "shift", repeat: false });
  }, [openRequest]);
  useEffect(() => {
    const target = (routeState as { scheduleFor?: { client: string; caregiver: string | null } } | null)?.scheduleFor;'''),
])
s=open('src/pages/Scheduling.tsx').read()
m=re.search(r'^import \{[^}]*\} from "react-router-dom";', s, re.M)
s=s.replace(m.group(0), m.group(0)+'\nimport { useOpenRequest } from "@/hooks/use-open-request";',1)
open('src/pages/Scheduling.tsx','w').write(s)
EOF
grep -n 'from "react-router-dom"\|from "react";' src/pages/Admissions.tsx src/pages/Hiring.tsx src/pages/Scheduling.tsx