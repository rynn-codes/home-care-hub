cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/components/employees/EmployeeRecordView.tsx', [
('''import { seedEmployeeActivity, type SeedEmployee } from "@/lib/employeesSeed";''',
 '''import { GUSTO_STATE_LABELS, seedEmployeeActivity, type SeedEmployee } from "@/lib/employeesSeed";'''),
# Optional requirements read as such
('''const STATE_DOT: Record<CredentialStatus, string> = {''','''/**
 * Karynn, 29 September: "Passport is an optional form of ID." An optional
 * document nobody has supplied is not outstanding — the compliance engine
 * already leaves it out of the count, and the rows here now say the same.
 */
const OPTIONAL_TYPES = new Set(seedCredentialRequirements.filter((r) => r.optional).map((r) => r.credentialType));
const stateLabel = (item: { credentialType: string; status: CredentialStatus }) =>
  item.status === "missing" && OPTIONAL_TYPES.has(item.credentialType) ? "Optional · not on file" : STATE_LABEL[item.status];
const stateDot = (item: { credentialType: string; status: CredentialStatus }) =>
  item.status === "missing" && OPTIONAL_TYPES.has(item.credentialType) ? "bg-[#D0D5DD]" : STATE_DOT[item.status];

const STATE_DOT: Record<CredentialStatus, string> = {'''),
('''                            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATE_DOT[item.status])} aria-hidden="true" />
                            {STATE_LABEL[item.status]}''','''                            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", stateDot(item))} aria-hidden="true" />
                            {stateLabel(item)}'''),
('''                    item.status === "current"
                      ? "bg-[#ECFDF3] text-[#027A48]"
                      : item.status === "expired" || item.status === "rejected"
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : item.status === "not_applicable"
                          ? "bg-[var(--hairline-soft)] text-[var(--ink-body)]"
                          : "bg-[#FFFAEB] text-[#B54708]",
                  )}
                >
                  {STATE_LABEL[item.status]}''','''                    item.status === "current"
                      ? "bg-[#ECFDF3] text-[#027A48]"
                      : item.status === "expired" || item.status === "rejected"
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : item.status === "not_applicable" || (item.status === "missing" && OPTIONAL_TYPES.has(item.credentialType))
                          ? "bg-[var(--hairline-soft)] text-[var(--ink-body)]"
                          : "bg-[#FFFAEB] text-[#B54708]",
                  )}
                >
                  {stateLabel(item)}'''),
# Highlights: assigned clients instead of the driving card
('''                  {
                    label: "Driving",
                    value: mayDrive ? "Can drive clients" : employee.drives ? "Must not drive" : "Does not drive",
                    sub: mayDrive
                      ? "Licence and insurance current"
                      : employee.drives
                        ? "Licence or insurance not current"
                        : "Keep assignments close",
                  },''','''                  /*
                    Karynn, 29 September: "Under driving box, change for
                    assigned clients. Bc we already have the little driving
                    box at the bottom on the current employee profile." The
                    driving line below says it once.
                  */
                  {
                    label: "Assigned clients",
                    value: employee.clients.length === 0 ? "None" : `${employee.clients.length} active`,
                    sub: employee.clients.length ? employee.clients.join(", ") : "No client assigned",
                  },'''),
# Employment card: the rest of the screenshot
('''                  [
                    "Overtime rate",
                    employee.baseRate === null
                      ? "Not hourly"
                      : `$${(employee.baseRate * 1.5).toFixed(2)} / hr over ${OVERTIME_AFTER_HOURS}`,
                  ],
                ].map(([label, value]) => (''','''                  [
                    "Overtime rate",
                    employee.baseRate === null
                      ? "Not hourly"
                      : `$${(employee.baseRate * 1.5).toFixed(2)} / hr over ${OVERTIME_AFTER_HOURS}`,
                  ],
                  ["Weekly hours", employee.weeklyHours === null ? "Not set" : `${employee.weeklyHours} hrs / wk`],
                  /* Karynn's screenshot of 29 September. Mock on Chanel's record; "Not recorded" elsewhere. */
                  [
                    "Gusto onboarding",
                    employee.employment
                      ? [employee.employment.gusto.w4, employee.employment.gusto.i9, employee.employment.gusto.payrollSetup].every((s) => s === "complete")
                        ? "Complete"
                        : "In progress"
                      : "Not recorded",
                  ],
                  [
                    "Payroll",
                    employee.employment
                      ? `${employee.employment.payMethod} · ${employee.employment.payCadence.toLowerCase()}`
                      : "Not recorded",
                  ],
                  ["Work location", employee.location],
                ].map(([label, value]) => ('''),
# Rail: Gusto, time & attendance, reviews
('''              {
                title: "Scheduling eligibility",
                rows: [
                  ["Can work shifts", employable ? "Yes" : "No"],
                  ["Can drive clients", mayDrive ? "Yes" : "No"],
                ],
              },
            ].map((g) => (
              <div key={g.title} className="flex flex-col gap-2">
                <SectionLabel>{g.title}</SectionLabel>
                <div className="flex flex-col">''','''              {
                title: "Scheduling eligibility",
                rows: [
                  ["Can work shifts", employable ? "Yes" : "No"],
                  ["Can drive clients", mayDrive ? "Yes" : "No"],
                ],
              },
              /*
                Karynn's rail screenshot of 29 September. Gusto is not
                connected, so "Open" says so rather than pretending; the
                figures are the mock on Chanel's record, and "Not recorded"
                for everybody else.
              */
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
                  [
                    "Handbook",
                    employee.employment?.gusto.handbookSignedOn
                      ? `Signed ${fmtLong(employee.employment.gusto.handbookSignedOn)}`
                      : "Not recorded",
                  ],
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
            ].map((g) => (
              <div key={g.title} className="flex flex-col gap-2">
                <div className="flex items-center">
                  <SectionLabel>{g.title}</SectionLabel>
                  {"action" in g && g.action && (
                    <button
                      type="button"
                      onClick={g.action.run}
                      className="ml-auto text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
                    >
                      {g.action.label}
                    </button>
                  )}
                </div>
                <div className="flex flex-col">'''),
('''/** Board names carry a trailing period ("Chanel P."); the seed doesn't. */''','''/** "Jul 1, 2026" and "Mar 2026" for the rail. */
const fmtLong = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const fmtMonth = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });

/** Board names carry a trailing period ("Chanel P."); the seed doesn't. */'''),
])
EOF
npm run typecheck 2>&1 | tail -20