import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from "@/domain/employees/credentials";
import { auditReadiness, complianceSummary } from "@/domain/credentials/compliance";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { CREDENTIAL_STATUS_LABELS } from "@/domain/documents/types";
import { authorizationExpires } from "@/domain/employees/workAuthorization";
import { EXCLUSION_LABELS } from "@/domain/employees/profile";
import { OVERTIME_AFTER_HOURS } from "@/domain/payroll/hours";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { initialsOf } from "@/lib/initials";
import type { RosterEmployee } from "@/lib/employeeRoster";

/**
 * The quick look from the directory: who they are, what is lapsed, what the
 * week costs, and the way to the full record. A right-hand sheet so the
 * directory stays where it was.
 */
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";
const money = (n: number | null) => (n === null ? "—" : n.toLocaleString([], { style: "currency", currency: "USD" }));

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[5px]">
      <span className="flex-none text-[12px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[12.5px] text-[var(--ink-body)]">{children}</span>
    </div>
  );
}

export function EmployeePeek({
  employee,
  today,
  weekHours,
  mayWrite,
  onClose,
  onEdit,
  onDelete,
}: {
  employee: RosterEmployee | null;
  today: string;
  weekHours: number;
  mayWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const readiness = employee
    ? auditReadiness(
        {
          employeeId: employee.id,
          role: employee.role,
          drives: employee.drives,
          workAuthorizationExpires: authorizationExpires(employee.workAuthorization),
        },
        seedCredentialRequirements,
        credentialsFromRecords(employee.id, employee.records),
        today,
      )
    : null;
  const summary = readiness ? complianceSummary(readiness) : null;
  const optional = new Set(seedCredentialRequirements.filter((r) => r.optional).map((r) => r.credentialType));
  const p = employee?.profile;
  const rate = employee?.baseRate ?? null;
  const regular = Math.min(weekHours, OVERTIME_AFTER_HOURS);
  const overtime = Math.max(0, weekHours - OVERTIME_AFTER_HOURS);
  const cost = rate === null ? null : regular * rate + overtime * rate * 1.5;

  return (
    <Sheet open={employee !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        {employee && p && (
          <>
            <SheetHeader className="border-b border-[var(--hairline)] px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[14px] font-semibold text-primary">
                  {initialsOf(employee.name)}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-[17px]">{employee.name}</SheetTitle>
                  <SheetDescription className="text-[12.5px]">
                    {ROLE_LABELS[employee.role]} · {EMPLOYEE_STATUS_LABELS[employee.status]}
                    {employee.location ? ` · ${employee.location}` : ""}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                {p.phoneMobile ? (
                  <a
                    href={`tel:${p.phoneMobile.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {p.phoneMobile}
                  </a>
                ) : (
                  <span className="rounded-[9px] border border-dashed border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
                    No phone on file
                  </span>
                )}
                {p.email ? (
                  <a
                    href={`mailto:${p.email}`}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-[9px] border border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--wash)]"
                  >
                    <Mail className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                    <span className="truncate">{p.email}</span>
                  </a>
                ) : (
                  <span className="rounded-[9px] border border-dashed border-[var(--hairline)] px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
                    No email on file
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 px-5 py-4">
              {summary && readiness && (
                <section className="rounded-[12px] border border-[var(--hairline)] p-3.5">
                  <p className="m-0 flex items-center gap-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                    Compliance
                  </p>
                  <p className="m-0 flex items-center gap-2 text-[13.5px] font-medium">
                    <span
                      className={cn(
                        "h-[8px] w-[8px] flex-none rounded-full",
                        summary.verdict === "current" ? "bg-[#12B76A]" : summary.verdict === "expiring" ? "bg-[#F79009]" : "bg-[#F04438]",
                      )}
                      aria-hidden="true"
                    />
                    {summary.summary}
                  </p>
                  <ul className="m-0 mt-2 list-none space-y-1 p-0">
                    {readiness.outcomes
                      .filter((o) => o.status !== "current" && !optional.has(o.credentialType))
                      .map((o) => (
                        <li key={o.credentialType} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                          <span className="min-w-0 truncate">{o.displayName}</span>
                          <span className={cn("flex-none", o.status === "expiring" ? "text-[#B54708]" : "text-[#B42318]")}>
                            {CREDENTIAL_STATUS_LABELS[o.status]}
                            {o.expiresAt ? ` · ${fmtDate(o.expiresAt)}` : ""}
                          </span>
                        </li>
                      ))}
                    {readiness.outcomes.every((o) => o.status === "current" || optional.has(o.credentialType)) && (
                      <li className="text-[12.5px] text-muted-foreground">Everything on file is current.</li>
                    )}
                  </ul>
                </section>
              )}

              <section className="rounded-[12px] border border-[var(--hairline)] p-3.5">
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Payroll</p>
                <Row label="Pay rate">{rate === null ? "Not recorded" : `${money(rate)} / hr`}</Row>
                <Row label="Employment">{employee.employmentType || "—"}</Row>
                <Row label="Agreed hours">{employee.weeklyHours === null ? "—" : `${employee.weeklyHours} / week`}</Row>
                <Row label="Scheduled this week">
                  <span className="tabular-nums">{Math.round(weekHours * 100) / 100} hrs</span>
                  {overtime > 0 && <span className="text-[#B54708]"> · {Math.round(overtime * 100) / 100} OT</span>}
                </Row>
                <Row label="This week costs">
                  {cost === null ? (
                    <span className="text-muted-foreground">No rate on file</span>
                  ) : (
                    <span className="font-medium tabular-nums">{money(cost)}</span>
                  )}
                </Row>
                <p className="m-0 pt-2 text-[11.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
                  Hours over {OVERTIME_AFTER_HOURS} are costed at time and a half. Joy projects payroll; Gusto pays it.
                </p>
              </section>

              <section className="rounded-[12px] border border-[var(--hairline)] p-3.5">
                <p className="m-0 pb-1.5 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Record</p>
                <Row label="MR number">{p.mrNumber ?? "Not issued"}</Row>
                <Row label="Hired">{fmtDate(employee.hiredOn)}</Row>
                {p.rehireDate && <Row label="Rehired">{fmtDate(p.rehireDate)}</Row>}
                <Row label="Disciplines">{p.disciplines?.length ? p.disciplines.join(", ") : "—"}</Row>
                <Row label="Exclusion list">
                  {EXCLUSION_LABELS[p.exclusionStatus ?? "not_checked"]}
                  {p.exclusionCheckedAt ? ` · ${fmtDate(p.exclusionCheckedAt)}` : ""}
                </Row>
                <Row label="Clients">{employee.clients.length ? employee.clients.join(", ") : "—"}</Row>
                <Row label="Next shift">{employee.nextShift ?? "—"}</Row>
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-[var(--hairline)] bg-[var(--paper)] px-5 py-3.5">
              {mayWrite && (
                <>
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="text-[#B42318] hover:bg-[#FEF3F2] hover:text-[#B42318]"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </>
              )}
              <span className="flex-1" />
              <Button asChild size="sm">
                <Link to={`/employees/${employee.id}`} onClick={onClose}>
                  Full profile
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
