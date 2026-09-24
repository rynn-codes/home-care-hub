cd /home/claude/joy && python3 - <<'EOF'
p='src/context/DemoDataProvider.tsx'
s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:70],s.count(old))
    s=s.replace(old,new)

rep('''import type { EmployeeProfile } from "@/domain/employees/profile";
import { STAGE_LABELS }''','''import { fullName, type EmployeeProfile } from "@/domain/employees/profile";
import { EMPLOYEE_STATUS_LABELS } from "@/domain/employees/credentials";
import { CLIENT_STATUS_LABELS } from "@/domain/clients/roster";
import { changeSummary, changedFieldLabels, type ProfileChange } from "@/domain/records/profileChanges";
import { STAGE_LABELS }''')

rep('''  setClientStatus: (input: {
    clientPersonId: string;
    status: ClientStatus;
    note: string | null;
    lastServiceOn?: string | null;
  }) => void;''','''  setClientStatus: (input: {
    clientPersonId: string;
    status: ClientStatus;
    note: string | null;
    lastServiceOn?: string | null;
    /** The client's name, for the undo record. */
    name?: string;
  }) => void;
  /**
   * Put a client's or employee's record back to how it was before a change.
   *
   * Karynn, 29 September: changes "stay for 72 hours in case we need to undo
   * a change. We still would keep an audited trail." The audit line for the
   * original change stays; the undo writes its own. Only the newest change
   * to a record is offered — see domain/records/profileChanges.
   */
  undoProfileChange: (changeId: string) => void;''')

rep('''  setEmployeeStatus: (id: string, status: EmployeeStatus) => void;''',
    '''  setEmployeeStatus: (id: string, status: EmployeeStatus, name?: string) => void;''')

# saveEmployee: record the change
rep('''  const saveEmployee = useCallback<DemoContextValue["saveEmployee"]>((id, profile) => {
    const employeeId = id ?? newId("emp");
    audit({
      action: id ? "employee.updated" : "employee.created",
      entityType: "employee",
      entityId: employeeId,
      after: { name: `${profile.firstName} ${profile.lastName}`, role: profile.role, status: profile.status },
    });
    setState((s) => {
      const isAdded = s.addedEmployees.some((e) => e.id === employeeId);
      if (!id || isAdded) {
        return {
          ...s,
          addedEmployees: isAdded
            ? s.addedEmployees.map((e) => (e.id === employeeId ? { id: employeeId, profile } : e))
            : [{ id: employeeId, profile }, ...s.addedEmployees],
        };
      }
      // A seeded employee keeps everything nobody typed over.
      return { ...s, employeeEdits: { ...s.employeeEdits, [employeeId]: profile } };
    });
    return employeeId;
  }, [audit]);''','''  const saveEmployee = useCallback<DemoContextValue["saveEmployee"]>((id, profile) => {
    const employeeId = id ?? newId("emp");
    audit({
      action: id ? "employee.updated" : "employee.created",
      entityType: "employee",
      entityId: employeeId,
      after: { name: `${profile.firstName} ${profile.lastName}`, role: profile.role, status: profile.status },
    });
    setState((s) => {
      const isAdded = s.addedEmployees.some((e) => e.id === employeeId);
      /*
       * The record as it was, kept for the undo window. For somebody the
       * office added, that is their previous profile; for a seeded employee
       * it is the previous overlay, or null when nothing had been typed over
       * the seed yet — undoing then removes the overlay. Adding somebody new
       * is not a change to undo; deleting is its own bin.
       */
      const before = isAdded
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
      if (change && before && labels.length === 0) return s;
      const profileChanges = change ? [change, ...s.profileChanges] : s.profileChanges;
      if (!id || isAdded) {
        return {
          ...s,
          profileChanges,
          addedEmployees: isAdded
            ? s.addedEmployees.map((e) => (e.id === employeeId ? { id: employeeId, profile } : e))
            : [{ id: employeeId, profile }, ...s.addedEmployees],
        };
      }
      // A seeded employee keeps everything nobody typed over.
      return { ...s, profileChanges, employeeEdits: { ...s.employeeEdits, [employeeId]: profile } };
    });
    return employeeId;
  }, [audit]);''')

rep('''  const setEmployeeStatus = useCallback<DemoContextValue["setEmployeeStatus"]>((id, status) => {
    audit({ action: "employee.status_changed", entityType: "employee", entityId: id, after: { status } });
    setState((s) => {
      const added = s.addedEmployees.find((e) => e.id === id);
      if (added) {
        return {
          ...s,
          addedEmployees: s.addedEmployees.map((e) =>
            e.id === id ? { ...e, profile: { ...e.profile, status } } : e,
          ),
        };
      }
      return {
        ...s,
        employeeEdits: { ...s.employeeEdits, [id]: { ...(s.employeeEdits[id] ?? {}), status } },
      };
    });
  }, [audit]);''','''  const setEmployeeStatus = useCallback<DemoContextValue["setEmployeeStatus"]>((id, status, name) => {
    audit({ action: "employee.status_changed", entityType: "employee", entityId: id, after: { status } });
    setState((s) => {
      const added = s.addedEmployees.find((e) => e.id === id);
      const before = added ? added.profile : (s.employeeEdits[id] ?? null);
      const wasStatus = added
        ? added.profile.status
        : (s.employeeEdits[id]?.status ?? seedEmployees.find((e) => e.id === id)?.status);
      if (wasStatus === status) return s;
      const change: ProfileChange = {
        id: newId("chg"),
        kind: "employee",
        entityId: id,
        name: name ?? (before ? fullName(before as EmployeeProfile) : id),
        what: "status",
        summary: `${wasStatus ? EMPLOYEE_STATUS_LABELS[wasStatus] : "Status"} → ${EMPLOYEE_STATUS_LABELS[status]}`,
        before,
        changedAt: new Date().toISOString(),
        changedBy: currentUserRef.current.name,
      };
      const profileChanges = [change, ...s.profileChanges];
      if (added) {
        return {
          ...s,
          profileChanges,
          addedEmployees: s.addedEmployees.map((e) =>
            e.id === id ? { ...e, profile: { ...e.profile, status } } : e,
          ),
        };
      }
      return {
        ...s,
        profileChanges,
        employeeEdits: { ...s.employeeEdits, [id]: { ...(s.employeeEdits[id] ?? {}), status } },
      };
    });
  }, [audit]);

  const undoProfileChange = useCallback<DemoContextValue["undoProfileChange"]>((changeId) => {
    const change = stateRef.current.profileChanges.find((c) => c.id === changeId);
    if (!change) return;
    audit({
      action: change.kind === "employee" ? "employee.change_undone" : "client.change_undone",
      entityType: change.kind,
      entityId: change.entityId,
      before: { what: change.what, summary: change.summary, changedAt: change.changedAt, changedBy: change.changedBy },
    });
    setState((s) => {
      const profileChanges = s.profileChanges.filter((c) => c.id !== changeId);
      if (change.kind === "client") {
        const clientStatuses = { ...s.clientStatuses };
        if (change.before) {
          clientStatuses[change.entityId] = change.before as DemoState["clientStatuses"][string];
        } else {
          delete clientStatuses[change.entityId];
        }
        return { ...s, profileChanges, clientStatuses };
      }
      const added = s.addedEmployees.find((e) => e.id === change.entityId);
      if (added) {
        // Somebody the office added always has a whole previous profile.
        if (!change.before) return { ...s, profileChanges };
        return {
          ...s,
          profileChanges,
          addedEmployees: s.addedEmployees.map((e) =>
            e.id === change.entityId ? { ...e, profile: change.before as EmployeeProfile } : e,
          ),
        };
      }
      const employeeEdits = { ...s.employeeEdits };
      if (change.before) {
        employeeEdits[change.entityId] = change.before as Partial<EmployeeProfile>;
      } else {
        // Nothing had been typed over the seed before this change: back to it.
        delete employeeEdits[change.entityId];
      }
      return { ...s, profileChanges, employeeEdits };
    });
  }, [audit]);''')

rep('''      setState((s) => ({
        ...s,
        clientStatuses: {
          ...s.clientStatuses,
          [input.clientPersonId]: {
            status: input.status,
            changedAt: new Date().toISOString(),
            changedBy: currentUserRef.current.name,
            note: input.note?.trim() || null,
            lastServiceOn: input.status === "discharged" ? input.lastServiceOn ?? null : null,
          },
        },
      }));''','''      setState((s) => {
        const before = s.clientStatuses[input.clientPersonId] ?? null;
        const change: ProfileChange = {
          id: newId("chg"),
          kind: "client",
          entityId: input.clientPersonId,
          name: input.name ?? input.clientPersonId,
          what: "status",
          summary: `${before ? CLIENT_STATUS_LABELS[before.status] : "Status"} → ${CLIENT_STATUS_LABELS[input.status]}`,
          before,
          changedAt: new Date().toISOString(),
          changedBy: currentUserRef.current.name,
        };
        return {
          ...s,
          profileChanges: [change, ...s.profileChanges],
          clientStatuses: {
            ...s.clientStatuses,
            [input.clientPersonId]: {
              status: input.status,
              changedAt: new Date().toISOString(),
              changedBy: currentUserRef.current.name,
              note: input.note?.trim() || null,
              lastServiceOn: input.status === "discharged" ? input.lastServiceOn ?? null : null,
            },
          },
        };
      });''')

rep('''      saveEmployee,
      setEmployeeStatus,
      deleteEmployee,
      deleteClient,
      saveCoverageEvent,''','''      saveEmployee,
      setEmployeeStatus,
      undoProfileChange,
      deleteEmployee,
      deleteClient,
      saveCoverageEvent,''')
rep('''saveEmployee, setEmployeeStatus, deleteEmployee, deleteClient, saveCoverageEvent,''',
    '''saveEmployee, setEmployeeStatus, undoProfileChange, deleteEmployee, deleteClient, saveCoverageEvent,''')
open(p,'w').write(s)
EOF
grep -n "DemoState" src/context/DemoDataProvider.tsx | head -5