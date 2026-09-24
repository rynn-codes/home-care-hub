import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Car, MoreVertical, Pencil, Phone, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordDetail, RecordHeader, RecordSectionLabel } from "@/components/records/RecordHeader";
import { UndoChangeBanner } from "@/components/records/UndoChangeBanner";
import { ActivityFeed } from "@/components/records/ActivityFeed";
import { LogActivityDialog } from "@/components/records/LogActivityDialog";
import { MrNumberField } from "@/components/records/MrNumberField";
import { StatusControl, type StatusOption } from "@/components/layout/StatusControl";
import { AuditPacketPreview } from "@/components/employees/AuditPacketPreview";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS, type EmployeeStatus } from "@/domain/employees/credentials";
import { auditReadiness, canDriveClients, canWorkShifts, complianceSummary } from "@/domain/credentials/compliance";
import { credentialsFromRecords } from "@/domain/credentials/fromSeed";
import { buildAuditPacket } from "@/domain/credentials/auditPacket";
import type { CredentialStatus } from "@/domain/documents/types";
import { authorizationExpires } from "@/domain/employees/workAuthorization";
import { EXCLUSION_LABELS, isBilingual, relationshipLabel, spokenLanguages } from "@/domain/employees/profile";
import { buildFeed, giftSummaryLine, giftTotalFor, interactionsFor, type Channel } from "@/domain/records/activity";
import { OVERTIME_AFTER_HOURS } from "@/domain/payroll/hours";
import { hoursOf } from "@/domain/scheduling/conflicts";
import { seedCredentialRequirements } from "@/lib/credentialRequirementsSeed";
import { GUSTO_STATE_LABELS, seedEmployeeActivity } from "@/lib/employeesSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import type { RosterEmployee } from "@/lib/employeeRoster";

/**
 * The employee record: Profile / Activity / Employment & Compliance / Audit
 * packet / Schedule / Docs / Roles — every tab reading the same compliance
 * engine and the same schedule board as the rest of Joy.
 *
 * The screen states the consequence, not just the fact. A lapsed credential
 * is not a red row in a table, it is a person who must come off the schedule
 * today, and the top of the record says so.
 */
const STATUS_MEANINGS: Record<EmployeeStatus, string> = {
  active: "Available for shifts, credentials permitting.",
  onboarding: "Hired, not yet cleared for cases. Cannot be scheduled.",
  on_leave: "Away and expected back. Not offered shifts while on leave.",
  inactive: "No longer working cases. The record and its documents are kept.",
};

const STATUS_OPTIONS: StatusOption<EmployeeStatus>[] = (["active", "onboarding", "on_leave", "inactive"] as EmployeeStatus[]).map(
  (value) => ({ value, label: EMPLOYEE_STATUS_LABELS[value], meaning: STATUS_MEANINGS[value] }),
);

const TABS = ["Profile", "Activity", "Employment & Compliance", "Audit packet", "Schedule", "Docs", "Roles"] as const;
type Tab = (typeof TABS)[number];

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

const OPTIONAL = new Set(seedCredentialRequirements.filter((r) => r.optional).map((r) => r.credentialType));
type Outcome = ReturnType<typeof auditReadiness>["outcomes"][number];
const stateLabel = (o: Outcome) => (o.status === "missing" && OPTIONAL.has(o.credentialType) ? "Optional · not on file" : STATE_LABEL[o.status]);
const stateDot = (o: Outcome) => (o.status === "missing" && OPTIONAL.has(o.credentialType) ? "bg-[#D0D5DD]" : STATE_DOT[o.status]);

const fmtDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const fmtMonth = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });

/** Board names carry a trailing period ("Chanel P."); the seed doesn't. */
const sameCaregiver = (boardName: string | null, employeeName: string) =>
  boardName !== null && boardName.replace(/\./g, "").trim() === employeeName.replace(/\./g, "").trim();

const CARD = "rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)]";

export function EmployeeRecordView({
  employee,
  today,
  onEdit,
  onDelete,
}: {
  employee: RosterEmployee;
  today: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Profile");
  const p = employee.profile;
  const [logging, setLogging] = useState<Channel | "any" | null>(null);
  const { interactions, logActivity, deleteActivity, recordView, currentUser, mrNumbers, issueMrNumber, setEmployeeStatus } = useDemo();
  const mayWrite = canWrite(currentUser.role);

  useEffect(() => {
    recordView("employee", employee.id, employee.name);
  }, [recordView, employee.id, employee.name]);

  const readiness = auditReadiness(
    { employeeId: employee.id, role: employee.role, drives: employee.drives, workAuthorizationExpires: authorizationExpires(employee.workAuthorization) },
    seedCredentialRequirements,
    credentialsFromRecords(employee.id, employee.records),
    today,
  );
  const compliance = complianceSummary(readiness);
  const canWork = canWorkShifts(readiness, employee.status);
  const canDrive = canDriveClients(readiness, employee.drives);
  const blockers = readiness.outcomes.filter((o) => o.blocksScheduling && o.status !== "current");

  const system = seedEmployeeActivity[employee.id] ?? [];
  const year = new Date().getFullYear();
  const gifts = giftSummaryLine(giftTotalFor(interactions, "employee", employee.id, year), year);
  const feed = buildFeed(
    interactionsFor(interactions, "employee", employee.id),
    system.map((s, i) => ({ id: `sys-${employee.id}-${i}`, at: s.at, label: s.label, tone: s.tone })),
  );

  const visits = useMemo(() => seedVisits.filter((v) => sameCaregiver(v.caregiverName, employee.name)), [employee.name]);
  const weekHours = useMemo(() => Math.round(visits.reduce((t, v) => t + hoursOf(v), 0) * 10) / 10, [visits]);
  const first = employee.name.split(" ")[0] ?? "";

  const packet = buildAuditPacket({
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
    folderFor: (type) => seedCredentialRequirements.find((r) => r.credentialType === type)?.folderType ?? "other",
    generatedAt: today,
    generatedByUserId: "Karynn Verrett",
  });

  const detailRows = (rows: Array<[string, string]>) =>
    rows.map(([label, value]) => (
      <div key={label} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-[7px] last:border-0">
        <span className="flex-none text-[12.5px] text-muted-foreground">{label}</span>
        <span className="ml-auto min-w-0 text-right text-[12.5px] [text-wrap:pretty]">{value}</span>
      </div>
    ));

  const rail: Array<{ title: string; action?: { label: string; run: () => void }; rows: Array<[string, string]> }> = [
    {
      title: "Assignments",
      rows: [
        ["Clients", employee.clients.join(", ") || "None"],
        ["Next shift", employee.nextShift ?? "None"],
        ["Hours this week", weekHours > 0 ? `${weekHours} hrs` : "—"],
      ],
    },
    { title: "Scheduling eligibility", rows: [["Can work shifts", canWork ? "Yes" : "No"], ["Can drive clients", canDrive ? "Yes" : "No"]] },
    {
      title: "Gusto",
      action: {
        label: "Open",
        run: () =>
          toast.info("Gusto is not connected to Joy yet.", {
            description: "When it is, this opens their Gusto profile. Nothing here is read from Gusto today.",
          }),
      },
      rows: [
        ["W-4", employee.employment ? GUSTO_STATE_LABELS[employee.employment.gusto.w4] : "Not recorded"],
        ["I-9", employee.employment ? GUSTO_STATE_LABELS[employee.employment.gusto.i9] : "Not recorded"],
        ["Payroll setup", employee.employment ? GUSTO_STATE_LABELS[employee.employment.gusto.payrollSetup] : "Not recorded"],
        ["Handbook", employee.employment?.gusto.handbookSignedOn ? `Signed ${fmtDate(employee.employment.gusto.handbookSignedOn)}` : "Not recorded"],
      ],
    },
    {
      title: "Time & attendance",
      action: { label: "View", run: () => setTab("Schedule") },
      rows: [
        ["Clock method", employee.employment?.timeAndAttendance.clockMethod ?? "Not recorded"],
        ["Late arrivals (90d)", employee.employment ? String(employee.employment.timeAndAttendance.lateArrivals90d) : "—"],
        ["Missed shifts (90d)", employee.employment ? String(employee.employment.timeAndAttendance.missedShifts90d) : "—"],
      ],
    },
    {
      title: "Reviews",
      action: { label: "Add", run: () => setLogging("any") },
      rows: [
        [
          "Last review",
          employee.employment?.reviews.lastOn
            ? `${fmtMonth(employee.employment.reviews.lastOn)}${employee.employment.reviews.lastRating ? ` · ${employee.employment.reviews.lastRating}` : ""}`
            : "None yet",
        ],
        ["Next review", employee.employment?.reviews.nextOn ? fmtMonth(employee.employment.reviews.nextOn) : "Not scheduled"],
      ],
    },
  ];

  const assignments = employee.roles?.assignments ?? employee.clients.map((c) => ({ client: c, kind: "Primary" as const, hoursPerWeek: 0 }));
  const access =
    employee.roles?.access ??
    (employee.role === "office"
      ? [
          { label: "Scheduling and intake", detail: "Every client and every shift", level: "Full access", tone: "on" },
          { label: "Client clinical records", detail: "Charts and assessments", level: "None", tone: "off" },
          { label: "Pay and rates", detail: "Gusto only", level: "Gusto", tone: "partial" },
        ]
      : [
          { label: "Own schedule and clock", detail: "Caregiver mobile app", level: "Full access", tone: "on" },
          { label: "Assigned clients' care plans", detail: "Read and chart", level: "Assigned", tone: "on" },
          { label: "Rates and billing", detail: "J-06 keeps caregivers out of rate discussions", level: "None", tone: "off" },
        ]);

  return (
    <>
      <RecordHeader
        name={employee.name}
        parents={[{ label: "Employees", to: "/employees" }]}
        status={EMPLOYEE_STATUS_LABELS[employee.status]}
        statusTone={employee.status === "active" ? "good" : employee.status === "onboarding" ? "info" : "warn"}
        line={`${employee.title} · ${ROLE_LABELS[employee.role]} · ${employee.location}`}
        actions={
          mayWrite ? (
            <>
              <StatusControl
                current={employee.status}
                label="Employment status"
                options={STATUS_OPTIONS}
                subject={employee.name}
                onChange={(status) => setEmployeeStatus(employee.id, status, employee.name)}
              />
              {onEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More for ${employee.name}`}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground transition-colors hover:bg-[var(--wash)] hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[210px]">
                    <DropdownMenuItem onSelect={onEdit}>
                      <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Edit this profile
                    </DropdownMenuItem>
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[#B42318] focus:text-[#B42318]" onSelect={onDelete}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                          Delete employee
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                type="button"
                onClick={() => setLogging("phone")}
                className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                Log a call
              </button>
              {canWork ? (
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
                  className="flex h-[34px] cursor-not-allowed items-center gap-[7px] rounded-[9px] bg-[var(--wash-strong)] px-3.5 text-[13px] font-medium text-muted-foreground/50"
                >
                  <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
                  Assign shift
                </button>
              )}
            </>
          ) : undefined
        }
      />

      <UndoChangeBanner kind="employee" entityId={employee.id} mayWrite={mayWrite} />

      {!canWork && (
        <div className={cn("mb-5 rounded-xl border p-4", blockers.length > 0 ? "border-[#FBD9D3] bg-[#FEF3F2]" : "border-[var(--hairline)] bg-[var(--paper-sunken)]")}>
          <p className="m-0 flex items-center gap-2 text-sm font-semibold">
            {blockers.length > 0 ? (
              <TriangleAlert className="h-4 w-4 text-[#B42318]" aria-hidden="true" />
            ) : (
              <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            {blockers.length > 0 ? "Cannot be scheduled" : `Not available — ${EMPLOYEE_STATUS_LABELS[employee.status].toLowerCase()}`}
          </p>
          {blockers.length > 0 && (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {blockers.map((b) => (
                <li key={b.credentialType} className="text-[13px] text-[#912018]">
                  {b.action}
                </li>
              ))}
            </ul>
          )}
          {employee.nextShift && (
            <p className="m-0 mt-2 text-sm font-medium">
              {employee.nextShift} is still booked{employee.clients[0] ? ` with ${employee.clients[0]}` : ""} — that shift needs covering.
            </p>
          )}
        </div>
      )}

      <div className="mb-5 flex gap-6 overflow-x-auto border-b border-[var(--hairline)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors",
              tab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className={cn(CARD, "flex flex-col gap-3.5 p-[18px]")}>
            <RecordSectionLabel>Details</RecordSectionLabel>
            <dl className="m-0">
              <RecordDetail
                label="MR #"
                value={
                  <MrNumberField
                    firstName={employee.name.split(" ")[0] ?? ""}
                    lastName={employee.name.split(" ").slice(1).join(" ")}
                    value={employee.mrNumber ?? mrNumbers[employee.id]}
                    existing={[...Object.values(mrNumbers), ...seedClients.map((c) => c.mrNumber)]}
                    canEdit={mayWrite}
                    onIssue={(n) => issueMrNumber(employee.id, n)}
                  />
                }
              />
              <RecordDetail label="Phone (mobile)" value={p?.phoneMobile || employee.phone} />
              <RecordDetail label="Email" value={p?.email || employee.email} />
              <RecordDetail label="Hired" value={employee.hiredOn} />
              {p?.rehireDate && <RecordDetail label="Rehired" value={p.rehireDate} />}
              <RecordDetail label="Employment" value={employee.employmentType} />
              <RecordDetail label="Location" value={employee.location} />
              <RecordDetail label="Drives" value={employee.drives ? "Yes" : "No"} />
              <RecordDetail label="Clients" value={employee.clients.length ? employee.clients.join(", ") : "None"} />
            </dl>

            {p && (
              <>
                <RecordSectionLabel>Demographics</RecordSectionLabel>
                <dl className="m-0">
                  <RecordDetail label="Full name" value={[p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")} />
                  <RecordDetail label="Date of birth" value={p.dateOfBirth} />
                  <RecordDetail label="Gender" value={p.gender} />
                  <RecordDetail
                    label="Languages"
                    value={
                      spokenLanguages({ preferredLanguage: p.preferredLanguage ?? "", otherLanguages: p.otherLanguages ?? [] }).length
                        ? `${spokenLanguages({ preferredLanguage: p.preferredLanguage ?? "", otherLanguages: p.otherLanguages ?? [] }).join(", ")}${
                            isBilingual({ preferredLanguage: p.preferredLanguage ?? "", otherLanguages: p.otherLanguages ?? [] }) ? " · Bilingual" : ""
                          }`
                        : null
                    }
                  />
                  <RecordDetail label="External id" value={p.externalId} />
                  <RecordDetail
                    label="Referral source"
                    value={p.referralSource === "Other" && p.referralSourceOther ? `Other · ${p.referralSourceOther}` : p.referralSource}
                  />
                  <RecordDetail label="Migratory status" value={p.migratoryStatus} />
                  <RecordDetail label="NPI or license #" value={p.staffLicense} />
                  <RecordDetail label="Disciplines" value={(p.disciplines ?? []).join(", ")} />
                  <RecordDetail label="Tags" value={(p.tags ?? []).join(", ")} />
                </dl>
                <RecordSectionLabel>Dates and checks</RecordSectionLabel>
                <dl className="m-0">
                  <RecordDetail label="Application date" value={p.applicationDate} />
                  <RecordDetail label="Job description signed" value={p.jobDescriptionSignedOn} />
                  <RecordDetail
                    label="Exclusion list"
                    value={
                      <span className={p.exclusionStatus === "flagged" ? "font-medium text-[#B42318]" : undefined}>
                        {EXCLUSION_LABELS[p.exclusionStatus ?? "not_checked"]}
                        {p.exclusionCheckedAt ? ` · checked ${p.exclusionCheckedAt}` : ""}
                      </span>
                    }
                  />
                </dl>
                <RecordSectionLabel>Address</RecordSectionLabel>
                <dl className="m-0">
                  <RecordDetail label="Address" value={[p.address?.line1, p.address?.line2].filter(Boolean).join(", ")} />
                  <RecordDetail label="City, state" value={[p.address?.city, p.address?.state].filter(Boolean).join(", ")} />
                  <RecordDetail label="Zip" value={p.address?.zip} />
                  <RecordDetail label="County" value={p.address?.county} />
                </dl>
                <RecordSectionLabel>Emergency contacts</RecordSectionLabel>
                {(p.emergencyContacts ?? []).filter((c) => c.name.trim()).length === 0 ? (
                  <p className="m-0 text-[12.5px] text-muted-foreground">Not recorded.</p>
                ) : (
                  (p.emergencyContacts ?? [])
                    .filter((c) => c.name.trim())
                    .map((c, i) => (
                      <div key={i} className="rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-2.5">
                        <p className="m-0 text-[13px] font-medium">{c.name}</p>
                        <p className="m-0 text-[11.5px] text-muted-foreground">
                          {[relationshipLabel(c), c.phone, c.address].filter(Boolean).join(" · ") || "No details recorded"}
                        </p>
                      </div>
                    ))
                )}
                {p.generalNotes?.trim() && (
                  <>
                    <RecordSectionLabel>Notes</RecordSectionLabel>
                    <p className="m-0 text-[13px] leading-[1.55] [text-wrap:pretty]">{p.generalNotes}</p>
                  </>
                )}
              </>
            )}

            {employee.kin && !p?.emergencyContacts?.some((c) => c.name.trim()) && (
              <>
                <RecordSectionLabel>Emergency contact</RecordSectionLabel>
                <div className="flex items-center gap-2.5 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-2.5">
                  <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--wash-strong)] text-[11px] font-semibold text-[var(--ink-body)]">
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
                <div className={cn(CARD, "flex flex-col gap-2 p-4")}>
                  <span className="text-[12.5px] font-medium text-[var(--ink-body)]">Summary</span>
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
                  <span className="text-[12.5px] font-medium text-[var(--ink-body)]">Compliance</span>
                  <span className="text-[15px] font-semibold">
                    {compliance.verdict === "current" ? "In date" : compliance.verdict === "blocked" ? "Cannot be scheduled" : "Attention"}
                  </span>
                  <span className="text-xs text-[var(--ink-body)]">{compliance.summary}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Next shift", value: employee.nextShift ?? "None scheduled", sub: employee.clients[0] ?? "No client assigned" },
                  {
                    label: "This week",
                    value: weekHours > 0 ? `${weekHours} hrs` : employee.weeklyHours ? `${employee.weeklyHours} hrs` : "Not scheduled",
                    sub:
                      (weekHours || employee.weeklyHours || 0) >= OVERTIME_AFTER_HOURS
                        ? "At the overtime threshold"
                        : `${Math.round((OVERTIME_AFTER_HOURS - (weekHours || employee.weeklyHours || 0)) * 10) / 10} hrs below overtime`,
                  },
                  {
                    label: "Assigned clients",
                    value: employee.clients.length === 0 ? "None" : `${employee.clients.length} active`,
                    sub: employee.clients.length ? employee.clients.join(", ") : "No client assigned",
                  },
                ].map((c) => (
                  <div key={c.label} className={cn(CARD, "flex flex-col gap-1.5 p-4")}>
                    <span className="text-[12.5px] font-medium text-[var(--ink-body)]">{c.label}</span>
                    <span className="text-[15px] font-semibold leading-[1.3]">{c.value}</span>
                    <span className="text-xs leading-[1.45] text-muted-foreground">{c.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={cn(CARD, "flex items-start gap-2.5 p-4")}>
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="m-0 text-[13px] text-muted-foreground">
                {canDrive ? (
                  <>
                    <span className="font-medium text-foreground">Can drive clients.</span> Licence and auto insurance are both current. The
                    client must also have agreed to the transport consent.
                  </>
                ) : employee.drives ? (
                  <>
                    <span className="font-medium text-foreground">Must not drive clients.</span> Licence or insurance is not current.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">Does not drive.</span> Never assign transport or escort work, and keep
                    assignments close.
                  </>
                )}
              </p>
            </section>

            <ActivityFeed rows={feed.slice(0, 6)} subjectName={first} onLogActivity={() => setLogging("any")} onLogCall={() => setLogging("phone")} onDelete={deleteActivity} />
            {feed.length > 6 && (
              <button type="button" onClick={() => setTab("Activity")} className="self-start text-[12.5px] text-primary hover:text-[#2A1BD1]">
                View all {feed.length}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "Activity" && (
        <div className="max-w-[880px]">
          <ActivityFeed rows={feed} subjectName={first} onLogActivity={() => setLogging("any")} onLogCall={() => setLogging("phone")} onDelete={deleteActivity} />
        </div>
      )}

      {tab === "Employment & Compliance" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3.5">
            <section className={cn(CARD, "flex flex-col gap-3.5 p-[18px]")}>
              <h3 className="m-0 text-[13.5px] font-semibold">Employment</h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3">
                {(
                  [
                    ["Status", EMPLOYEE_STATUS_LABELS[employee.status]],
                    ["Type", employee.employmentType],
                    ["Hired", employee.hiredOn],
                    ["Role", ROLE_LABELS[employee.role]],
                    ["Base rate", employee.baseRate === null ? "Salaried" : `$${employee.baseRate.toFixed(2)} / hr`],
                    ["Overtime rate", employee.baseRate === null ? "Not hourly" : `$${(employee.baseRate * 1.5).toFixed(2)} / hr over ${OVERTIME_AFTER_HOURS}`],
                    ["Weekly hours", employee.weeklyHours === null ? "Not set" : `${employee.weeklyHours} hrs / wk`],
                    [
                      "Gusto onboarding",
                      employee.employment
                        ? [employee.employment.gusto.w4, employee.employment.gusto.i9, employee.employment.gusto.payrollSetup].every((s) => s === "complete")
                          ? "Complete"
                          : "In progress"
                        : "Not recorded",
                    ],
                    ["Payroll", employee.employment ? `${employee.employment.payMethod} · ${employee.employment.payCadence.toLowerCase()}` : "Not recorded"],
                    ["Work location", employee.location],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-[3px]">
                    <span className="text-[11.5px] text-muted-foreground">{label}</span>
                    <span className="text-[13px]">{value}</span>
                  </div>
                ))}
              </div>
              <p className="m-0 border-t border-[var(--hairline-soft)] pt-3 text-[11.5px] text-muted-foreground">
                Placeholder rates — real pay lives in Gusto, and payroll hands over hours only.
              </p>
            </section>

            <section className={cn(CARD, "overflow-hidden")}>
              <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-3.5">
                <h3 className="m-0 text-[13.5px] font-semibold">Credentials & compliance</h3>
                <span className="ml-auto text-xs text-muted-foreground">{compliance.summary}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr>
                      {["Item", "Status", "Issued", "Expires"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="whitespace-nowrap bg-[var(--paper-sunken)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.outcomes.map((o) => (
                      <tr key={o.credentialType} className="border-t border-[var(--hairline-soft)]">
                        <td className="px-4 py-3 text-[13px]">{o.displayName}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-[7px] whitespace-nowrap text-[12.5px] text-[var(--ink-body)]">
                            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", stateDot(o))} aria-hidden="true" />
                            {stateLabel(o)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{employee.records[o.credentialType]?.issued ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[var(--ink-body)]">
                          {o.expiresAt ?? employee.records[o.credentialType]?.expires ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className={cn(CARD, "flex flex-col gap-4 p-[18px]")}>
            {rail.map((block) => (
              <div key={block.title} className="flex flex-col gap-2">
                <div className="flex items-center">
                  <RecordSectionLabel>{block.title}</RecordSectionLabel>
                  {block.action && (
                    <button type="button" onClick={block.action.run} className="ml-auto text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                      {block.action.label}
                    </button>
                  )}
                </div>
                <div className="flex flex-col">{detailRows(block.rows)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Audit packet" && (
        <AuditPacketPreview
          packet={packet}
          onGenerate={() =>
            toast.info("The PDF toolchain is not connected yet.", {
              description: "The packet is composed and ready. Generating pages is the AuditPacketService port, which your developer wires up.",
            })
          }
        />
      )}

      {tab === "Schedule" && <EmployeeScheduleTab employee={employee} visits={visits} weekHours={weekHours} />}

      {tab === "Docs" && (
        <div className={cn(CARD, "max-w-[720px] p-[18px]")}>
          <div className="flex flex-col gap-1.5 pb-3">
            <h3 className="m-0 text-[13.5px] font-semibold">Credential documents</h3>
            <p className="m-0 text-[12.5px] text-muted-foreground">
              The dates and states below are the record; the files themselves need storage the prototype doesn't have, so nothing here
              pretends to open one.
            </p>
          </div>
          <div className="flex flex-col">
            {readiness.outcomes.map((o) => (
              <div key={o.credentialType} className="flex items-center gap-2.5 border-t border-[var(--hairline-soft)] py-2.5">
                <span className="flex flex-col leading-[1.35]">
                  <span className="text-[13px]">{o.displayName}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {employee.records[o.credentialType]?.issued ? `Issued ${employee.records[o.credentialType]?.issued}` : "Not on file"}
                    {o.expiresAt ? ` · expires ${o.expiresAt}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-auto inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                    o.status === "current"
                      ? "bg-[#ECFDF3] text-[#027A48]"
                      : o.status === "expired" || o.status === "rejected"
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : o.status === "not_applicable" || (o.status === "missing" && OPTIONAL.has(o.credentialType))
                          ? "bg-[var(--hairline-soft)] text-[var(--ink-body)]"
                          : "bg-[#FFFAEB] text-[#B54708]",
                  )}
                >
                  {stateLabel(o)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Roles" && (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3.5">
            <section className={cn(CARD, "p-[18px]")}>
              <div className="flex items-center gap-2 pb-3">
                <h3 className="m-0 text-[13.5px] font-semibold">Roles</h3>
                {mayWrite && (
                  <button
                    type="button"
                    onClick={() =>
                      toast.info("Roles are granted in the database, not on this screen yet.", {
                        description: "Changing what a role can open is a developer step until the roles editor is built.",
                      })
                    }
                    className="ml-auto flex h-[34px] items-center rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] transition-colors hover:bg-[var(--wash)]"
                  >
                    Edit roles
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pb-3">
                {(employee.roles?.badges ?? [ROLE_LABELS[employee.role], ...(employee.drives ? ["Driver"] : [])]).map((b, i) => (
                  <span
                    key={b}
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-[12.5px] font-medium",
                      i === 0 ? "bg-[#EEF0FE] text-primary" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                    )}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <div className="flex flex-col">
                {access.map((a) => (
                  <div key={a.label} className="flex items-center gap-3 border-t border-[var(--hairline-soft)] py-3">
                    <span
                      className={cn("h-[8px] w-[8px] flex-none rounded-full", a.tone === "on" ? "bg-[#12B76A]" : a.tone === "partial" ? "bg-primary" : "bg-[#D0D5DD]")}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-col leading-[1.35]">
                      <span className="text-[13px]">{a.label}</span>
                      <span className="text-[11.5px] text-muted-foreground">{a.detail}</span>
                    </span>
                    <span className="ml-auto text-right text-[12.5px] text-[var(--ink-body)]">{a.level}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={cn(CARD, "p-[18px]")}>
              <div className="flex items-center gap-2 pb-2">
                <h3 className="m-0 text-[13.5px] font-semibold">Client assignments</h3>
                {canWork && (
                  <Link to="/scheduling" className="ml-auto text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    Assign client
                  </Link>
                )}
              </div>
              {assignments.length === 0 ? (
                <p className="m-0 py-2 text-[12.5px] text-muted-foreground">No client assigned.</p>
              ) : (
                assignments.map((a) => (
                  <div key={a.client} className="flex items-center gap-3 border-t border-[var(--hairline-soft)] py-3">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                      {a.client.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </span>
                    <span className="flex min-w-0 flex-col leading-[1.35]">
                      <span className="text-[13px] font-medium">{a.client}</span>
                      <span className="text-[11.5px] text-muted-foreground">{a.kind === "Primary" ? "Primary caregiver" : "Backup coverage"}</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        a.kind === "Primary" ? "bg-[#EEF0FE] text-primary" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                      )}
                    >
                      {a.kind}
                    </span>
                    <span className="ml-auto text-[12.5px] tabular-nums text-[var(--ink-body)]">{a.hoursPerWeek > 0 ? `${a.hoursPerWeek} hrs / wk` : "—"}</span>
                  </div>
                ))
              )}
            </section>
          </div>

          <div className={cn(CARD, "flex flex-col gap-4 p-[18px]")}>
            <div className="flex flex-col gap-2">
              <RecordSectionLabel>Skills & competencies</RecordSectionLabel>
              {employee.roles ? (
                <div className="flex flex-col">
                  {employee.roles.skills.map((s) => (
                    <div key={s.name} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-[7px] last:border-0">
                      <span className={cn("h-[8px] w-[8px] flex-none rounded-full", s.status === "Pending" ? "bg-[#F79009]" : "bg-[#12B76A]")} aria-hidden="true" />
                      <span className="text-[12.5px]">{s.name}</span>
                      <span className="ml-auto text-[12.5px] text-muted-foreground">{s.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[12.5px] text-muted-foreground">Not recorded.</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <RecordSectionLabel>Preferences</RecordSectionLabel>
              <div className="flex flex-col">
                {detailRows([
                  ["Preferred shifts", employee.roles?.preferences.preferredShifts ?? "Not recorded"],
                  ["Max weekly hours", employee.roles ? String(employee.roles.preferences.maxWeeklyHours) : "Not recorded"],
                  ["Travel radius", employee.roles ? `${employee.roles.preferences.travelRadiusMiles} miles` : "Not recorded"],
                  [
                    "Languages",
                    (p && spokenLanguages({ preferredLanguage: p.preferredLanguage ?? "", otherLanguages: p.otherLanguages ?? [] }).join(", ")) || "Not recorded",
                  ],
                ])}
              </div>
            </div>
          </div>
        </div>
      )}

      <LogActivityDialog
        open={logging !== null}
        onOpenChange={(o) => setLogging(o ? "any" : null)}
        initialChannel="phone"
        subjectName={employee.name}
        giftsSoFar={gifts}
        onSave={(draft) => logActivity({ draft, subject: { kind: "employee", id: employee.id, name: employee.name } })}
      />
    </>
  );
}

// ------------------------------------------------------------ Schedule --

function EmployeeScheduleTab({
  employee,
  visits,
  weekHours,
}: {
  employee: RosterEmployee;
  visits: typeof seedVisits;
  weekHours: number;
}) {
  const [cursor, setCursor] = useState(() => new Date());

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dayVisits = visits.filter((v) => new Date(v.startsAt).toDateString() === date.toDateString());
      return { date, inMonth: date.getMonth() === cursor.getMonth(), visits: dayVisits };
    });
  }, [cursor, visits]);

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const otRisk = weekHours >= OVERTIME_AFTER_HOURS - 8;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "This week", value: weekHours > 0 ? `${weekHours} hrs` : "—", sub: "From the schedule board" },
          { label: "Next shift", value: employee.nextShift ?? "None", sub: employee.clients[0] ?? "No client assigned" },
          { label: "Overtime", value: otRisk ? "Approaching" : "Clear", sub: `Threshold ${OVERTIME_AFTER_HOURS} hrs · Sat–Fri week`, warn: otRisk },
          { label: "Clients", value: String(employee.clients.length), sub: employee.clients.join(", ") || "—" },
        ].map((b) => (
          <div key={b.label} className={cn(CARD, "flex flex-col gap-1.5 p-4")}>
            <RecordSectionLabel>{b.label}</RecordSectionLabel>
            <span className={cn("text-[15px] font-semibold", b.warn && "text-[#B54708]")}>{b.value}</span>
            <span className="text-[11.5px] text-muted-foreground">{b.sub}</span>
          </div>
        ))}
      </div>

      <div className={cn(CARD, "p-[18px]")}>
        <div className="flex flex-wrap items-center gap-3 pb-3.5">
          <span className="text-[15px] font-semibold tracking-[-.01em]">{cursor.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
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
              className="h-7 w-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:bg-[var(--wash)]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="h-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] hover:bg-[var(--wash)]"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="h-7 w-7 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:bg-[var(--wash)]"
            >
              ›
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-[11px] border border-[var(--hairline)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="border-b border-[var(--hairline)] bg-[var(--paper-sunken)] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
              {w}
            </div>
          ))}
          {cells.map(({ date, inMonth, visits: dayVisits }) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex min-h-[84px] flex-col gap-1 border-b border-r border-[var(--hairline-soft)] px-2 py-1.5",
                  isToday ? "bg-[#FBFBFE]" : inMonth ? "bg-[var(--paper)]" : "bg-[var(--paper-sunken)]",
                )}
              >
                <span className={cn("text-xs tabular-nums", isToday ? "font-semibold text-primary" : inMonth ? "text-[var(--ink-body)]" : "text-muted-foreground/40")}>
                  {date.getDate()}
                </span>
                {dayVisits.map((v) => {
                  const past = new Date(v.endsAt) < new Date();
                  return (
                    <span key={v.id} className={cn("block rounded-md px-1.5 py-1 leading-[1.3]", past ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#EEF0FE] text-primary")}>
                      <span className="block text-[10.5px] opacity-90">{fmtTime(v.startsAt)}</span>
                      <span className="block text-[11px] font-medium">{v.clientName}</span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="mb-0 mt-3 text-xs text-muted-foreground">
          The same visits the Scheduling board shows, filtered to {employee.name} — one Joy schedule, per §20.{" "}
          <Link to="/scheduling" className="text-primary hover:text-[#2A1BD1]">
            Open Scheduling →
          </Link>
        </p>
      </div>
    </div>
  );
}
