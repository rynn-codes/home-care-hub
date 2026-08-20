import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmployeeDirectory, type DirectoryRow } from "@/components/employees/EmployeeDirectory";
import { EmployeeRecordView } from "@/components/employees/EmployeeRecordView";
import { employeeCompliance } from "@/domain/employees/credentials";
import { seedEmployees, type SeedEmployee } from "@/lib/employeesSeed";
import { useDemo } from "@/context/DemoDataProvider";

/**
 * Employees — everyone on staff.
 *
 * Built to the approved Employees mockup. The organising idea is compliance:
 * the agency's real exposure is a caregiver who went out on a shift with an
 * expired credential, so the directory is sorted by who needs attention rather
 * than alphabetically, and the record leads with the consequence.
 *
 * Reads the seed rather than the demo store, because nothing in the prototype
 * creates an employee yet — that is Sprint 6, Hiring. The credential logic
 * underneath is real and tested; only the data source is temporary.
 */
export default function Employees() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { newHires } = useDemo();

  // People hired through Onboarding appear alongside the seed. The shapes match
  // because toEmployee() produces exactly what this screen already reads.
  const everyone = useMemo<SeedEmployee[]>(() => {
    const hiredIds = new Set(newHires.map((e) => e.id));
    return [
      ...(newHires as unknown as SeedEmployee[]),
      ...seedEmployees.filter((e) => !hiredIds.has(e.id)),
    ];
  }, [newHires]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rows = useMemo<DirectoryRow[]>(() => {
    const built = everyone.map((e) => ({
      id: e.id,
      name: e.name,
      initials: e.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase(),
      title: e.title,
      role: e.role,
      status: e.status,
      location: e.location,
      compliance: employeeCompliance({ role: e.role, drives: e.drives, records: e.records }, today),
      clients: e.clients,
      nextShift: e.nextShift,
      weeklyHours: e.weeklyHours,
      drives: e.drives,
    }));

    // Same principle as the admissions queue and the client directory: sort by
    // who holds the next move. A lapsed credential must not sit at R because
    // the person is called Robinson.
    const rank = (r: DirectoryRow) => {
      if (r.compliance.verdict === "blocked") return 0;
      if (r.compliance.verdict === "incomplete") return 1;
      if (r.compliance.verdict === "expiring") return 2;
      if (r.status !== "active") return 4;
      return 3;
    };

    return built.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [everyone, today]);

  const selected = id ? everyone.find((e) => e.id === id) : undefined;

  if (id && !selected) {
    return (
      <>
        <PageHeader title="Not on staff" description="That record is not in the directory." />
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => navigate("/employees")}
        >
          Back to the directory
        </button>
      </>
    );
  }

  if (selected) {
    return (
      <EmployeeRecordView employee={selected} today={today} onBack={() => navigate("/employees")} />
    );
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        [r.name, r.title, r.location, ...r.clients].join(" ").toLowerCase().includes(q),
      )
    : rows;

  const active = rows.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader
        title="Employees"
        description={`Everyone on staff — role, status, compliance and current assignments. ${rows.length} total · ${active} active.`}
      />

      <EmployeeDirectory
        rows={visible}
        query={query}
        onQueryChange={setQuery}
        onOpen={(employeeId) => navigate(`/employees/${employeeId}`)}
      />

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Demo data, saved on this device. Staff names are real; every client named here is fictional.
        Credential states are computed from their expiry dates, not entered by hand.
      </p>
    </>
  );
}
