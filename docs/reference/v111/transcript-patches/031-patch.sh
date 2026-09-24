cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)
patch('src/pages/TheBrain.tsx', [
('''  const openTaskRequested = Boolean(
    (useLocation().state as { openTask?: boolean } | null)?.openTask,
  );
  useEffect(() => {
    if (openTaskRequested) setModal("task");
  }, [openTaskRequested]);''','''  const openRequest = useOpenRequest<"task">();
  useEffect(() => {
    if (openRequest === "task") setModal("task");
  }, [openRequest]);'''),
('''import { Link, useLocation } from "react-router-dom";''','''import { Link, useLocation } from "react-router-dom";
import { useOpenRequest } from "@/hooks/use-open-request";'''),
])
patch('src/components/layout/AppHeader.tsx', [
('''  { label: "Add Task", to: "/brain", state: { openTask: true } as const },''','''  { label: "Add Task", to: "/brain", state: { open: "task" } as const },'''),
])
EOF
grep -rn "openTask" src | head