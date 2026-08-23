import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ban, Car, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from "@/domain/employees/credentials";
import {
  auditReadiness,
  canDriveClients,
  canWorkShifts,
  complianceSummary,
} from "@/domain/credentials/compliance";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import type { CredentialStatus } from "@/domain/documents/types";
import { seedEmployeeActivity, type SeedEmployee } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { OVERTIME_AFTER_HOURS } from "@/domain/payroll/hours";
import { hoursOf } from "@/domain/scheduling/conflicts";
import { buildAuditPacket } from "@/domain/credentials/auditPacket";
import { AuditPacketPreview } from "@/components/employees/AuditPacketPreview";
import { toast } from "sonner";

/**
 * The employee record, to the approved Employees mock: the 56px avatar
 * header, then Profile / Activity / Employment & Compliance / Audit packet /
 * Schedule / Docs / Roles — every tab real, reading the same compliance
 * engine and the same schedule board as the rest of Joy.
 *
 * The addition to the mock is the same shape as the one on the client
 * record — state the consequence, not just the fact. A lapsed credential is
 * not a red row in a table, it is a person who must come off the schedule
 * today, and the screen says so at the top rather than leaving it to be
 * inferred.
 */

const TABS = ["Profile", "Activity", "Employment & Compliance", "Audit packet", "Schedule", "Docs", "Roles"] as const;
type Tab = (typeof TABS)[number];

const TONE: Record<string, string> = {
  done: "bg-[#12B76A]",
  prog: "bg-primary",
  warn: "bg-[#F79009]",
  bad: "bg-[#D92D20]",
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

const STATE_DOT: Record<CredentialStatus, string> = {
  current: "bg-[#12B76A]",
  expiring: "bg-[#F79009]",
  expired: "bg-[#D92D20]",
  missing: "bg-[#F79009]",
  pending_review: "bg-primary",
  rejected: "bg-[#D92D20]",
  not_applicable: "bg-[#D0D5DD]",
};

/** Board names carry a trailing period ("Chanel P."); the seed doesn't. */
const sameCaregiver = (boardName: string | null, employeeName: string) =>
  boardName !== null &&
  boardName.replace(/\./g, "").trim() === employeeName.replace(/\./g, "").trim();

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[#F3F3F6] py-2 last:border-0">
      <dt className="w-28 flex-none text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13px] [text-wrap:pretty]">{value}</dd>
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
  const myVisits = useMemo(
    () => seedVisits.filter((v) => sameCaregiver(v.caregiverName, employee.name)),
    [employee.name],
  );
  const weekHours = useMemo(
    () => Math.round(myVisits.reduce((t, v) => t + hoursOf(v), 0) * 10) / 10,
    [myVisits],
  );
  const initials = employee.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the staff directory"
            className="mt-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EEF0FE] text-[17px] font-semibold text-primary">
            {initials}
          </span>
          <div className="flex flex-col gap-1 pt-0.5">
            <span
              className={cn(
                "inline-flex self-start rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                employee.status === "active"
                  ? "bg-[#ECFDF3] text-[#027A48]"
                  : employee.status === "onboarding"
                    ? "bg-[#EEF0FE] text-primary"
                    : "bg-[#FFFAEB] text-[#B54708]",
              )}
            >
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </span>
            <h1 className="m-0 text-[23px] font-semibold leading-[1.15] tracking-[-.02em]">{employee.name}</h1>
            <p className="m-0 text-[12.5px] text-muted-foreground">
              {employee.title} · {ROLE_LABELS[employee.role]} · {employee.location}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto sm:pt-1.5">
          <button
            type="button"
            disabled
            title="Messaging goes through Spruce — not wired in the prototype"
            className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] border border-[#ECECF1] bg-white px-3 text-[13px] text-muted-foreground/50"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Message
          </button>
          {employable ? (
            <Link
              to="/scheduling"
              className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              Assign shift
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title={compliance.summary}
              className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] bg-[#F1F2F6] px-3.5 text-[13px] font-medium text-muted-foreground/50"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              Assign shift
            </button>
          )}
        </div>
      </div>

      {/* The consequence, said before the detail. */}
      {!employable && (
        <div
          className={cn(
            "mb-5 rounded-xl border p-4",
            blocking.length > 0 ? "border-[#FBD9D3] bg-[#FEF3F2]" : "border-[#ECECF1] bg-[#FCFCFD]",
          )}
        >
          <p className="m-0 flex items-center gap-2 text-sm font-semibold">
            {blocking.length > 0 ? (
              <TriangleAlert className="h-4 w-4 text-[#B42318]" aria-hidden="true" />
            ) : (
              <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            {blocking.length > 0
              ? "Cannot be scheduled"
              : `Not available — ${EMPLOYEE_STATUS_LABELS[employee.status].toLowerCase()}`}
          </p>
          {blocking.length > 0 && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {blocking.map((c) => (
                <li key={c.credentialType} className="text-[13px] text-[#912018]">
                  {c.action}
                </li>
              ))}
            </ul>
          )}
          {/* Somebody who cannot be scheduled but is already on the rota is
              not a contradiction — it is a shift that needs covering today. */}
          {employee.nextShift && (
            <p className="m-0 mt-2 text-sm font-medium">
              {employee.nextShift} is still booked
              {employee.clients[0] ? ` with ${employee.clients[0]}` : ""} — that shift needs covering.
            </p>
          )}
        </div>
      )}

      <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[#ECECF1]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
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
        <div className="grid items-start gap-[18px] lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
            <SectionLabel>Details</SectionLabel>
            <dl className="m-0">
              <Detail label="Phone" value={employee.phone} />
              <Detail label="Email" value={employee.email} />
              <Detail label="Hired" value={employee.hiredOn} />
              <Detail label="Employment" value={employee.employmentType} />
              <Detail label="Location" value={employee.location} />
              <Detail label="Drives" value={employee.drives ? "Yes" : "No"} />
              <Detail label="Clients" value={employee.clients.length ? employee.clients.join(", ") : "None"} />
            </dl>
            {employee.kin && (
              <>
                <SectionLabel>Emergency contact</SectionLabel>
                <div className="flex items-center gap-2.5 rounded-[11px] border border-[#ECECF1] bg-[#FCFCFD] p-2.5">
                  <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#F1F2F6] text-[11px] font-semibold text-[#5B6274]">
                    {employee.kin.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                  </span>
                  <span className="flex flex-col leading-[1.35]">
                    <span className="text-[13px] font-medium">{employee.kin}</span>
                    <span className="text-[11.5px] text-muted-foreground">{employee.kinLine}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-[18px]">
            <section className="flex flex-col gap-3">
              <h2 className="m-0 text-sm font-semibold tracking-[-.01em]">Highlights</h2>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <div className="flex flex-col gap-2 rounded-[14px] border border-[#ECECF1] bg-white p-4">
                  <span className="text-[12.5px] font-medium text-[#5B6274]">Summary</span>
                  <p className="m-0 text-sm leading-[1.55] [text-wrap:pretty]">{employee.summary}</p>
                </div>
                <div
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[14px] border p-4",
                    compliance.verdict === "current"
                      ? "border-[#D3F0DF] bg-[#F4FDF8]"
                      : compliance.verdict === "blocked"
                        ? "border-[#FBD9D3] bg-[#FEF3F2]"
                        : "border-[#FCE8B6] bg-[#FFFAEB]",
                  )}
                >
                  <span className="text-[12.5px] font-medium text-[#5B6274]">Compliance</span>
                  <span className="text-[15px] font-semibold">
                    {compliance.verdict === "current" ? "In date" : compliance.verdict === "blocked" ? "Blocked" : "Attention"}
                  </span>
                  <span className="text-xs text-[#5B6274]">{compliance.summary}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Next shift",
                    value: employee.nextShift ?? "None scheduled",
                    sub: employee.clients[0] ?? "No client assigned",
                  },
                  {
                    label: "This week",
                    value: weekHours > 0 ? `${weekHours} hrs` : employee.weeklyHours ? `${employee.weeklyHours} hrs` : "Not scheduled",
                    sub:
                      (weekHours || employee.weeklyHours || 0) >= OVERTIME_AFTER_HOURS
                        ? "At the overtime threshold"
                        : `${OVERTIME_AFTER_HOURS - (weekHours || employee.weeklyHours || 0)} hrs below overtime`,
                  },
                  {
                    label: "Driving",
                    value: mayDrive ? "Can drive clients" : employee.drives ? "Must not drive" : "Does not drive",
                    sub: mayDrive
                      ? "Licence and insurance current"
                      : employee.drives
                        ? "Licence or insurance not current"
                        : "Keep assignments close",
                  },
                ].map((h) => (
                  <div key={h.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
                    <span className="text-[12.5px] font-medium text-[#5B6274]">{h.label}</span>
                    <span className="text-[15px] font-semibold leading-[1.3]">{h.value}</span>
                    <span className="text-xs leading-[1.45] text-muted-foreground">{h.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* The cross-module rule: this and the client's transport consent
                both have to be true before anyone gets in a car. */}
            <section className="flex items-start gap-2.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="m-0 text-[13px] text-muted-foreground">
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

            {activity.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="m-0 flex items-center gap-2 text-sm font-semibold tracking-[-.01em]">
                  Activity
                  <button
                    type="button"
                    onClick={() => setTab("Activity")}
                    className="text-[12.5px] font-normal text-primary hover:text-[#2A1BD1]"
                  >
                    View all
                  </button>
                </h2>
                <div className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
                  {activity.slice(0, 3).map((a) => (
                    <div key={a.label} className="flex items-center gap-3 border-b border-[#F3F3F6] px-4 py-3.5 last:border-0">
                      <span className={cn("h-[7px] w-[7px] flex-none rounded-full", TONE[a.tone] ?? TONE.prog)} aria-hidden="true" />
                      <span className="text-[13px]">{a.label}</span>
                      <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{a.when}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "Activity" && (
        <div className="max-w-[820px] rounded-[14px] border border-[#ECECF1] bg-white p-5">
          {activity.length === 0 && (
            <p className="m-0 py-6 text-center text-sm text-muted-foreground">
              Nothing recorded for this person yet.
            </p>
          )}
          {activity.map((a, i) => (
            <div key={a.label} className="flex gap-3.5 pb-[18px] last:pb-0">
              <span className="flex flex-none flex-col items-center pt-[5px]">
                <span className={cn("h-[7px] w-[7px] rounded-full", TONE[a.tone] ?? TONE.prog)} aria-hidden="true" />
                {i < activity.length - 1 && <span className="mt-[5px] w-px flex-1 bg-[#ECECF1]" aria-hidden="true" />}
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13.5px] leading-[1.45]">{a.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{a.when}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "Employment & Compliance" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3.5">
            <section className="flex flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
              <h3 className="m-0 text-[13.5px] font-semibold">Employment</h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3">
                {[
                  ["Status", EMPLOYEE_STATUS_LABELS[employee.status]],
                  ["Type", employee.employmentType],
                  ["Hired", employee.hiredOn],
                  ["Role", ROLE_LABELS[employee.role]],
                  ["Base rate", employee.baseRate === null ? "Salaried" : `$${employee.baseRate.toFixed(2)} / hr`],
                  [
                    "Overtime rate",
                    employee.baseRate === null
                      ? "Not hourly"
                      : `$${(employee.baseRate * 1.5).toFixed(2)} / hr over ${OVERTIME_AFTER_HOURS}`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-[3px]">
                    <span className="text-[11.5px] text-muted-foreground">{label}</span>
                    <span className="text-[13px]">{value}</span>
                  </div>
                ))}
              </div>
              <p className="m-0 border-t border-[#F3F3F6] pt-3 text-[11.5px] text-muted-foreground">
                Placeholder rates — real pay lives in Gusto, and payroll hands over hours only.
              </p>
            </section>

            <section className="overflow-hidden rounded-[14px] border border-[#ECECF1] bg-white">
              <div className="flex items-center gap-2 border-b border-[#ECECF1] px-4 py-3.5">
                <h3 className="m-0 text-[13.5px] font-semibold">Credentials &amp; compliance</h3>
                <span className="ml-auto text-xs text-muted-foreground">{compliance.summary}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr>
                      {["Item", "Status", "Issued", "Expires"].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="whitespace-nowrap bg-[#FCFCFD] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.outcomes.map((item) => (
                      <tr key={item.credentialType} className="border-t border-[#F3F3F6]">
                        <td className="px-4 py-3 text-[13px]">{item.displayName}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[#5B6274]">
                            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATE_DOT[item.status])} aria-hidden="true" />
                            {STATE_LABEL[item.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                          {employee.records[item.credentialType]?.issued ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5B6274]">
                          {item.expiresAt ?? employee.records[item.credentialType]?.expires ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
            {[
              {
                title: "Assignments",
                rows: [
                  ["Clients", employee.clients.join(", ") || "None"],
                  ["Next shift", employee.nextShift ?? "None"],
                  ["Hours this week", weekHours > 0 ? `${weekHours} hrs` : "—"],
                ],
              },
              {
                title: "Scheduling eligibility",
                rows: [
                  ["Can work shifts", employable ? "Yes" : "No"],
                  ["Can drive clients", mayDrive ? "Yes" : "No"],
                ],
              },
            ].map((g) => (
              <div key={g.title} className="flex flex-col gap-2">
                <SectionLabel>{g.title}</SectionLabel>
                <div className="flex flex-col">
                  {g.rows.map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-2.5 border-b border-[#F3F3F6] py-[7px] last:border-0">
                      <span className="flex-none text-[12.5px] text-muted-foreground">{label}</span>
                      <span className="ml-auto min-w-0 text-right text-[12.5px] [text-wrap:pretty]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Audit packet" && (
        <AuditPacketPreview
          packet={buildAuditPacket({
            kind: "personnel_file",
            employee: {
              id: employee.id,
              name: employee.name,
              position: `${employee.title} · ${ROLE_LABELS[employee.role]}`,
              hiredOn: employee.hiredOn,
              employmentStatus: EMPLOYEE_STATUS_LABELS[employee.status],
            },
            readiness,
            credentials: credentialsFromRecords(employee.id, employee.records),
            documents: [],
            folderFor: (type) =>
              seedCredentialRequirements.find((r) => r.credentialType === type)?.folderType ?? "other",
            generatedAt: today,
            generatedByUserId: "Karynn Verrett",
          })}
          onGenerate={() =>
            // §23: never fake processing success. There is no PDF toolchain
            // connected, so the button says so rather than producing nothing.
            toast.info("The PDF toolchain is not connected yet.", {
              description:
                "The packet is composed and ready. Generating pages is the AuditPacketService port, which your developer wires up.",
            })
          }
        />
      )}

      {tab === "Schedule" && <EmployeeScheduleTab employee={employee} visits={myVisits} weekHours={weekHours} />}

      {tab === "Docs" && (
        <div className="max-w-[720px] rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
          <div className="flex flex-col gap-1.5 pb-3">
            <h3 className="m-0 text-[13.5px] font-semibold">Credential documents</h3>
            <p className="m-0 text-[12.5px] text-muted-foreground">
              The dates and states below are the record; the files themselves need storage the
              prototype doesn't have, so nothing here pretends to open one.
            </p>
          </div>
          <div className="flex flex-col">
            {readiness.outcomes.map((item) => (
              <div key={item.credentialType} className="flex items-center gap-2.5 border-t border-[#F3F3F6] py-2.5">
                <span className="flex flex-col leading-[1.35]">
                  <span className="text-[13px]">{item.displayName}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {employee.records[item.credentialType]?.issued
                      ? `Issued ${employee.records[item.credentialType]?.issued}`
                      : "Not on file"}
                    {item.expiresAt ? ` · expires ${item.expiresAt}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-auto inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                    item.status === "current"
                      ? "bg-[#ECFDF3] text-[#027A48]"
                      : item.status === "expired" || item.status === "rejected"
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : item.status === "not_applicable"
                          ? "bg-[#F3F3F6] text-[#5B6274]"
                          : "bg-[#FFFAEB] text-[#B54708]",
                  )}
                >
                  {STATE_LABEL[item.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Roles" && (
        <div className="max-w-[720px] flex-col gap-3.5 rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
          <div className="flex items-center gap-2 pb-3">
            <h3 className="m-0 text-[13.5px] font-semibold">Roles</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              The real grants live in the database migrations
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pb-3">
            <span className="inline-flex rounded-full bg-[#EEF0FE] px-3 py-1 text-[12.5px] font-medium text-primary">
              {ROLE_LABELS[employee.role]}
            </span>
            {employee.drives && (
              <span className="inline-flex rounded-full bg-[#F3F3F6] px-3 py-1 text-[12.5px] font-medium text-[#5B6274]">
                Driver
              </span>
            )}
          </div>
          <div className="flex flex-col">
            {(employee.role === "office"
              ? [
                  ["Scheduling and intake", "Full access"],
                  ["Client clinical records", "No access"],
                  ["Pay and rates", "Gusto only"],
                ]
              : [
                  ["Own schedule and clock", "Full access"],
                  ["Assigned clients' care plans", "Read and chart"],
                  ["Rates and billing", "No access — J-06 keeps caregivers out of rate discussions"],
                ]
            ).map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-3 border-t border-[#F3F3F6] py-2.5">
                <span className="text-[13px]">{label}</span>
                <span className="ml-auto text-right text-[12.5px] text-[#5B6274]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------ Schedule --

function EmployeeScheduleTab({
  employee,
  visits,
  weekHours,
}: {
  employee: SeedEmployee;
  visits: typeof seedVisits;
  weekHours: number;
}) {
  const [cursor, setCursor] = useState(() => new Date());

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - lead);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dayVisits = visits.filter(
        (v) => new Date(v.startsAt).toDateString() === date.toDateString(),
      );
      return { date, inMonth: date.getMonth() === cursor.getMonth(), visits: dayVisits };
    });
  }, [cursor, visits]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const otRisk = weekHours >= OVERTIME_AFTER_HOURS - 8;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "This week", value: weekHours > 0 ? `${weekHours} hrs` : "—", sub: "From the schedule board" },
          { label: "Next shift", value: employee.nextShift ?? "None", sub: employee.clients[0] ?? "No client assigned" },
          {
            label: "Overtime",
            value: otRisk ? "Approaching" : "Clear",
            sub: `Threshold ${OVERTIME_AFTER_HOURS} hrs · Sat–Fri week`,
            warn: otRisk,
          },
          { label: "Clients", value: String(employee.clients.length), sub: employee.clients.join(", ") || "—" },
        ].map((b) => (
          <div key={b.label} className="flex flex-col gap-1.5 rounded-[14px] border border-[#ECECF1] bg-white p-4">
            <SectionLabel>{b.label}</SectionLabel>
            <span className={cn("text-[15px] font-semibold", b.warn && "text-[#B54708]")}>{b.value}</span>
            <span className="text-[11.5px] text-muted-foreground">{b.sub}</span>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border border-[#ECECF1] bg-white p-[18px]">
        <div className="flex flex-wrap items-center gap-3 pb-3.5">
          <span className="text-[15px] font-semibold tracking-[-.01em]">
            {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </span>
          <span className="ml-auto flex items-center gap-3.5 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#12B76A]" aria-hidden="true" />
              Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" />
              Scheduled
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="h-7 w-7 rounded-lg border border-[#ECECF1] bg-white text-muted-foreground hover:bg-[#FAFAFB]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="h-7 rounded-lg border border-[#ECECF1] bg-white px-3 text-[12.5px] hover:bg-[#FAFAFB]"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="h-7 w-7 rounded-lg border border-[#ECECF1] bg-white text-muted-foreground hover:bg-[#FAFAFB]"
            >
              ›
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-[11px] border border-[#ECECF1]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div
              key={w}
              className="border-b border-[#ECECF1] bg-[#FCFCFD] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {cells.map(({ date, inMonth, visits: dayVisits }) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex min-h-[84px] flex-col gap-1 border-b border-r border-[#F3F3F6] px-2 py-1.5",
                  isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-white" : "bg-[#FCFCFD]",
                )}
              >
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isToday ? "font-semibold text-primary" : inMonth ? "text-[#5B6274]" : "text-muted-foreground/40",
                  )}
                >
                  {date.getDate()}
                </span>
                {dayVisits.map((v) => {
                  const past = new Date(v.endsAt) < new Date();
                  return (
                    <span
                      key={v.id}
                      className={cn(
                        "block rounded-md px-1.5 py-1 leading-[1.3]",
                        past ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#EEF0FE] text-primary",
                      )}
                    >
                      <span className="block text-[10px] opacity-90">{fmtTime(v.startsAt)}</span>
                      <span className="block text-[11px] font-medium">{v.clientName}</span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mb-0 mt-3 text-xs text-muted-foreground">
          The same visits the Scheduling board shows, filtered to {employee.name} — one Joy
          schedule, per §20.{" "}
          <Link to="/scheduling" className="text-primary hover:text-[#2A1BD1]">
            Open Scheduling →
          </Link>
        </p>
      </div>
    </div>
  );
}
