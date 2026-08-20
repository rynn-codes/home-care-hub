import { useState } from "react";
import { ArrowLeft, Ban, Car, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from "@/domain/employees/credentials";
import {
  auditReadiness,
  canDriveClients,
  canWorkShifts,
  complianceSummary,
  type RequirementOutcome,
} from "@/domain/credentials/compliance";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import type { CredentialStatus } from "@/domain/documents/types";
import { seedEmployeeActivity, type SeedEmployee } from "@/lib/employeesSeed";

/**
 * The employee record, following the approved mockup: Profile, Activity,
 * Employment & Compliance, Schedule, Docs, Roles.
 *
 * The addition to the mockup is the same shape as the one on the client record —
 * state the consequence, not just the fact. A lapsed credential is not a red row
 * in a table, it is a person who must come off the schedule today, and the
 * screen says so at the top rather than leaving it to be inferred.
 */

const TABS = ["Profile", "Activity", "Employment & Compliance", "Schedule", "Docs", "Roles"] as const;
type Tab = (typeof TABS)[number];

const TONE: Record<string, string> = {
  done: "bg-[hsl(var(--success))]",
  prog: "bg-primary",
  warn: "bg-[hsl(var(--warning))]",
  bad: "bg-destructive",
};

const STATE_LABEL: Record<CredentialStatus, string> = {
  current: "Current",
  expiring: "Expiring soon",
  expired: "Expired",
  missing: "Outstanding",
  pending_review: "Awaiting review",
  rejected: "Rejected",
  not_applicable: "N/A",
};

const STATE_TONE: Record<CredentialStatus, string> = {
  current: "text-[hsl(var(--success))]",
  expiring: "text-[hsl(var(--warning))]",
  expired: "text-destructive",
  missing: "text-[hsl(var(--warning))]",
  pending_review: "text-primary",
  rejected: "text-destructive",
  not_applicable: "text-muted-foreground",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export function EmployeeRecordView({
  employee,
  today,
  onBack,
}: {
  employee: SeedEmployee;
  today: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Profile");

  // One engine, reading requirements as data. §27: the same readiness result
  // feeds this screen, Operations, Home, Hiring and scheduling eligibility.
  const readiness = auditReadiness(
    { employeeId: employee.id, role: employee.role, drives: employee.drives },
    seedCredentialRequirements,
    credentialsFromRecords(employee.id, employee.records),
    today,
  );
  const compliance = complianceSummary(readiness);
  const employable = canWorkShifts(readiness, employee.status);
  const mayDrive = canDriveClients(readiness, employee.drives);
  const blocking = readiness.outcomes.filter((o) => o.blocksScheduling && o.status !== "current");
  const activity = seedEmployeeActivity[employee.id] ?? [];
  const initials = employee.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the staff directory"
            className="mt-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary">
            {initials}
          </span>
          <div>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                employee.status === "active"
                  ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]"
                  : employee.status === "onboarding"
                    ? "bg-primary-soft text-primary"
                    : "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",
              )}
            >
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">{employee.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {employee.title} · {ROLE_LABELS[employee.role]} · {employee.location}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Message
          </Button>
          <Button size="sm" disabled={!employable} title={employable ? undefined : compliance.summary}>
            <Plus className="mr-1.5 h-4 w-4" />
            Assign shift
          </Button>
        </div>
      </div>

      {/* The consequence, said before the detail. */}
      {!employable && (
        <div
          className={cn(
            "mb-6 rounded-xl border p-4",
            blocking.length > 0
              ? "border-destructive/40 bg-destructive/5"
              : "border-border bg-surface-muted",
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {blocking.length > 0 ? (
              <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
            ) : (
              <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            {blocking.length > 0
              ? "Cannot be scheduled"
              : `Not available — ${EMPLOYEE_STATUS_LABELS[employee.status].toLowerCase()}`}
          </p>
          {blocking.length > 0 && (
            <ul className="mt-2 space-y-1">
              {blocking.map((c) => (
                <li key={c.credentialType} className="text-sm text-muted-foreground">
                  {c.action}
                </li>
              ))}
            </ul>
          )}
          {/* Somebody who cannot be scheduled but is already on the rota is not
              a contradiction — it is a shift that needs covering today. Saying
              so beats letting the two facts sit next to each other looking like
              a bug. */}
          {employee.nextShift && (
            <p className="mt-2 text-sm font-medium">
              {employee.nextShift} is still booked
              {employee.clients[0] ? ` with ${employee.clients[0]}` : ""} — that shift needs covering.
            </p>
          )}
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              tab === t
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Details</h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Detail label="Phone" value={employee.phone} />
              <Detail label="Email" value={employee.email} />
              <Detail label="Hired" value={employee.hiredOn} />
              <Detail label="Employment" value={employee.employmentType} />
              <Detail
                label="Assigned clients"
                value={employee.clients.length ? employee.clients.join(", ") : "None"}
              />
              {employee.kin && <Detail label="Emergency contact" value={`${employee.kin} · ${employee.kinLine}`} />}
            </dl>
          </section>

          <div className="space-y-6">
            <p className="max-w-prose text-sm text-muted-foreground">{employee.summary}</p>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Next shift</p>
                <p className="mt-1 font-semibold">{employee.nextShift ?? "None scheduled"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {employee.clients[0] ?? "No client assigned"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">This week</p>
                <p className="mt-1 font-semibold">
                  {employee.weeklyHours === null ? "Not scheduled" : `${employee.weeklyHours} hrs`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {employee.weeklyHours === null
                    ? "—"
                    : employee.weeklyHours >= 40
                      ? "At the overtime threshold — another shift bills at 1.5×"
                      : `${40 - employee.weeklyHours} hrs below overtime`}
                </p>
              </div>
            </section>

            {/* The cross-module rule: this and the client's transport consent
                both have to be true before anyone gets in a car. */}
            <section
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-4",
                mayDrive ? "border-border bg-surface" : "border-border bg-surface-muted",
              )}
            >
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {mayDrive ? (
                  <>
                    <span className="font-medium text-foreground">Can drive clients.</span> Licence and
                    auto insurance are both current. The client must also have agreed to the transport
                    consent.
                  </>
                ) : employee.drives ? (
                  <>
                    <span className="font-medium text-foreground">Must not drive clients.</span> Licence
                    or insurance is not current.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">Does not drive.</span> Never assign
                    transport or escort work, and keep assignments close.
                  </>
                )}
              </p>
            </section>
          </div>
        </div>
      )}

      {tab === "Employment & Compliance" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                Credentials &amp; compliance
              </h2>
              <span
                className={cn(
                  "text-xs",
                  compliance.verdict === "current"
                    ? "text-[hsl(var(--success))]"
                    : compliance.verdict === "blocked"
                      ? "text-destructive"
                      : "text-[hsl(var(--warning))]",
                )}
              >
                {compliance.summary}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Item</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Issued</th>
                    <th scope="col" className="py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.outcomes.map((item) => (
                    <tr key={item.credentialType} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4">{item.displayName}</td>
                      <td className={cn("whitespace-nowrap py-2.5 pr-4", STATE_TONE[item.status])}>
                        {STATE_LABEL[item.status]}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-muted-foreground">
                        {item.expiresAt ? "—" : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-muted-foreground">
                        {item.expiresAt ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Employment</h2>
            <dl className="space-y-3.5">
              <Detail label="Status" value={EMPLOYEE_STATUS_LABELS[employee.status]} />
              <Detail label="Type" value={employee.employmentType} />
              <Detail
                label="Base rate"
                value={employee.baseRate === null ? "Salaried" : `$${employee.baseRate.toFixed(2)} / hr`}
              />
              <Detail
                label="Overtime rate"
                value={
                  employee.baseRate === null
                    ? "Not hourly"
                    : `$${(employee.baseRate * 1.5).toFixed(2)} / hr over 40`
                }
              />
              <Detail label="Work location" value={employee.location} />
            </dl>
          </section>
        </div>
      )}

      {tab === "Activity" && (
        <ul className="rounded-2xl border border-border bg-surface">
          {activity.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing recorded for this person yet.
            </li>
          )}
          {activity.map((a) => (
            <li
              key={a.label}
              className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0"
            >
              <span className="flex items-center gap-2.5 text-sm">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[a.tone] ?? TONE.prog)} aria-hidden="true" />
                {a.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
            </li>
          ))}
        </ul>
      )}

      {(tab === "Schedule" || tab === "Docs" || tab === "Roles") && (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium">{tab} is not built yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {tab === "Schedule"
              ? "This person's shifts are on the Scheduling screen. A per-caregiver view comes with the shift-assignment work."
              : tab === "Docs"
                ? "Credential documents themselves need file storage, which is not wired up. The dates and states are on Employment & Compliance."
                : "Roles and permissions come from the database once the migrations are applied — right now the app has one demo user with a role switch in the header."}
          </p>
        </section>
      )}
    </>
  );
}
