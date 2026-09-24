import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmployeeDirectory, type DirectoryRow, type RoleFilter, type StatusFilter } from "@/components/employees/EmployeeDirectory";
import { EmployeeRecordView } from "@/components/employees/EmployeeRecordView";
import { EmployeePeek } from "@/components/employees/EmployeePeek";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { ConfirmDeleteDialog } from "@/components/records/ConfirmDeleteDialog";
import { auditReadiness, complianceSummary } from "@/domain/credentials/compliance";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { authorizationExpires } from "@/domain/employees/workAuthorization";
import { ROSTER_HIDE_AFTER_DAYS, restingOffRoster, type EmployeeProfile } from "@/domain/employees/profile";
import { complianceBucket, type ComplianceFilter } from "@/domain/employees/directoryFilters";
import { recoveryDaysFor } from "@/domain/records/deletion";
import { canWrite } from "@/domain/access/roles";
import { agencyWeekStart } from "@/domain/calendar/agencyWeek";
import { hoursOf } from "@/domain/scheduling/conflicts";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { buildRoster, profileFromSeed, type RosterEmployee } from "@/lib/employeeRoster";
import { useAgencySettings } from "@/lib/agencyStore";
import { useDemo } from "@/context/DemoDataProvider";

/**
 * Employees — everyone on staff.
 *
 * The organising idea is compliance: the agency's real exposure is a
 * caregiver who went out on a shift with an expired credential, so the
 * directory is sorted by who needs attention rather than alphabetically, and
 * the record leads with the consequence.
 *
 * The roster is the seed plus everyone hired or added in the demo, with
 * edits laid over — see lib/employeeRoster.
 */
export default function Employees() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [role, setRole] = useState<RoleFilter>("all");
  const [compliance, setCompliance] = useState<ComplianceFilter | "all">("all");
  const [peek, setPeek] = useState<RosterEmployee | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; profile: EmployeeProfile | null } | null>(null);
  const [deleting, setDeleting] = useState<RosterEmployee | null>(null);

  const demo = useDemo();
  const { newHires, currentUser, saveEmployee, deleteEmployee, restoreDeleted } = demo;
  const mayWrite = canWrite(currentUser.role);
  const { profileUndoHours } = useAgencySettings();

  const everyone = useMemo(() => buildRoster({ ...demo, newHires }), [demo, newHires]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Hours on the board this agency week, by caregiver name — the peek's payroll block.
  const weekHours = useMemo(() => {
    const week = agencyWeekStart(today);
    const out: Record<string, number> = {};
    for (const v of seedVisits) {
      if (v.caregiverName && agencyWeekStart(v.startsAt.slice(0, 10)) === week) {
        out[v.caregiverName] = (out[v.caregiverName] ?? 0) + hoursOf(v);
      }
    }
    return out;
  }, [today]);

  const rows = useMemo<DirectoryRow[]>(() => {
    const built = everyone.map((e) => ({
      id: e.id,
      name: e.name,
      initials: e.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
      title: e.title,
      role: e.role,
      status: e.status,
      location: e.location,
      compliance: complianceSummary(
        auditReadiness(
          { employeeId: e.id, role: e.role, drives: e.drives, workAuthorizationExpires: authorizationExpires(e.workAuthorization) },
          seedCredentialRequirements,
          credentialsFromRecords(e.id, e.records),
          today,
        ),
      ),
      clients: e.clients,
      nextShift: e.nextShift,
      weeklyHours: e.weeklyHours,
      drives: e.drives,
      phone: e.profile?.phoneMobile || e.phone || null,
      email: e.profile?.email || e.email || null,
    }));
    const rank = (r: DirectoryRow) =>
      r.compliance.verdict === "blocked" ? 0 : r.compliance.verdict === "incomplete" ? 1 : r.compliance.verdict === "expiring" ? 2 : r.status !== "active" ? 4 : 3;
    return built.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [everyone, today]);

  const selected = id ? everyone.find((e) => e.id === id) : undefined;

  const form = (
    <EmployeeForm
      open={editing !== null}
      onOpenChange={(o) => !o && setEditing(null)}
      initial={editing?.profile ?? null}
      onSave={(profile) => {
        const savedId = saveEmployee(editing?.id ?? null, profile);
        const name = `${profile.firstName} ${profile.lastName}`;
        toast.success(editing?.id ? `${name} saved` : `${name} added`, {
          description: editing?.id
            ? `Can be undone from the record for ${profileUndoHours} hours.`
            : "No credentials on file yet — their compliance reads as outstanding until documents are added.",
          action: editing?.id ? undefined : { label: "Open", onClick: () => navigate(`/employees/${savedId}`) },
        });
        setEditing(null);
      }}
    />
  );

  const confirmDelete = (afterDelete?: () => void) => (
    <ConfirmDeleteDialog
      open={!!deleting}
      onOpenChange={(o) => !o && setDeleting(null)}
      title="Delete this employee?"
      subject={deleting ? `${deleting.name} · ${deleting.title}` : ""}
      consequences={["The employee record and everything typed on it"]}
      recoveryDays={recoveryDaysFor("employee")}
      confirmLabel="Delete employee"
      onConfirm={() => {
        if (!deleting) return;
        const { id: employeeId, name } = deleting;
        deleteEmployee(employeeId, name);
        setDeleting(null);
        afterDelete?.();
        toast(`${name} deleted`, {
          description: `In Settings → Deleted items for ${recoveryDaysFor("employee")} days.`,
          action: { label: "Undo", onClick: () => restoreDeleted(employeeId) },
        });
      }}
    />
  );

  if (id && !selected) {
    return (
      <>
        <PageHeader title="Not on staff" description="That record is not in the directory." />
        <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => navigate("/employees")}>
          Back to the directory
        </button>
      </>
    );
  }

  if (selected) {
    return (
      <>
        <EmployeeRecordView
          employee={selected}
          today={today}
          onEdit={mayWrite ? () => setEditing({ id: selected.id, profile: selected.profile as EmployeeProfile ?? profileFromSeed(selected) }) : undefined}
          onDelete={mayWrite ? () => setDeleting(selected) : undefined}
        />
        {form}
        {confirmDelete(() => navigate("/employees"))}
      </>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (r: DirectoryRow) => !q || [r.name, r.title, r.location, ...r.clients].join(" ").toLowerCase().includes(q);
  const searched = rows.filter(matches);
  // People who left more than sixty days ago rest off the roster unless asked for.
  const resting = new Set(
    everyone
      .filter((e) => restingOffRoster({ status: e.status, inactiveSince: e.inactiveSince }, today))
      .map((e) => e.id),
  );
  const byStatus = searched.filter((r) => (status === "all" || r.status === status) && (status === "inactive" || !!q || !resting.has(r.id)));
  const visible = byStatus.filter((r) => (role === "all" || r.role === role) && (compliance === "all" || complianceBucket(r.compliance.verdict) === compliance));
  const counts: Record<StatusFilter, number> = {
    all: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    onboarding: rows.filter((r) => r.status === "onboarding").length,
    on_leave: rows.filter((r) => r.status === "on_leave").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
  };

  return (
    <>
      <PageHeader
        title="Employees"
        actions={
          mayWrite ? (
            <Button onClick={() => setEditing({ id: null, profile: null })}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add employee
            </Button>
          ) : undefined
        }
      />

      <EmployeeDirectory
        rows={visible}
        query={query}
        onQueryChange={setQuery}
        onOpen={(employeeId) => setPeek(everyone.find((e) => e.id === employeeId) ?? null)}
        status={status}
        onStatusChange={setStatus}
        role={role}
        onRoleChange={setRole}
        compliance={compliance}
        onComplianceChange={setCompliance}
        pool={byStatus}
        counts={counts}
        hiddenByFilters={q ? searched.length - visible.length : 0}
        onClearFilters={() => {
          setStatus("all");
          setRole("all");
          setCompliance("all");
        }}
      />

      {resting.size > 0 && status !== "inactive" && !q && (
        <p className="mt-3 text-xs text-muted-foreground">
          {resting.size} {resting.size === 1 ? "person who left" : "people who left"} more than {ROSTER_HIDE_AFTER_DAYS} days ago{" "}
          {resting.size === 1 ? "is" : "are"} resting off the roster.{" "}
          <button type="button" onClick={() => setStatus("inactive")} className="font-medium text-primary underline-offset-4 hover:underline">
            Show them
          </button>{" "}
          — their files are kept in full.
        </p>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. Credential states are computed from their expiry dates, not entered by hand.
      </p>

      <EmployeePeek
        employee={peek}
        today={today}
        weekHours={peek ? weekHours[peek.name] ?? 0 : 0}
        mayWrite={mayWrite}
        onClose={() => setPeek(null)}
        onEdit={() => {
          if (!peek) return;
          setEditing({ id: peek.id, profile: (peek.profile as EmployeeProfile) ?? profileFromSeed(peek) });
          setPeek(null);
        }}
        onDelete={() => {
          if (!peek) return;
          setDeleting(peek);
          setPeek(null);
        }}
      />
      {form}
      {confirmDelete()}
    </>
  );
}
