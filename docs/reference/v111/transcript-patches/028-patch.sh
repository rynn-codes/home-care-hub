cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

# ── seed: roles extras ──
patch('src/lib/employeesSeed.ts', [
('''  employment?: EmploymentExtras;
}''','''  employment?: EmploymentExtras;
  /**
   * The Roles tab, to Karynn's screenshot of 29 September. Mock on Chanel's
   * record only. The access rows describe what the role grants in the
   * database migrations; nothing here changes a grant.
   */
  roles?: RolesExtras;
}

export interface RolesExtras {
  badges: string[];
  access: Array<{ label: string; detail: string; level: string; tone: "on" | "partial" | "off" }>;
  assignments: Array<{ client: string; kind: "Primary" | "Backup"; hoursPerWeek: number }>;
  skills: Array<{ name: string; status: "Verified" | "Approved" | "Pending" }>;
  preferences: { preferredShifts: string; maxWeeklyHours: number; travelRadiusMiles: number };
}'''),
('''      reviews: { lastOn: "2026-03-02", lastRating: "Meets", nextOn: "2027-03-02" },
    },
  },''','''      reviews: { lastOn: "2026-03-02", lastRating: "Meets", nextOn: "2027-03-02" },
    },
    roles: {
      badges: ["Caregiver", "Field Caregiver", "Transportation approved"],
      access: [
        { label: "App access", detail: "Caregiver mobile app", level: "Standard", tone: "on" },
        { label: "Client records", detail: "Assigned clients only", level: "Assigned", tone: "on" },
        { label: "Schedule editing", detail: "View and claim open shifts", level: "Limited", tone: "partial" },
        { label: "Billing & payroll", detail: "No access", level: "None", tone: "off" },
      ],
      assignments: [
        { client: "Pamela P", kind: "Primary", hoursPerWeek: 37.5 },
        { client: "Marilyn K", kind: "Backup", hoursPerWeek: 8 },
      ],
      skills: [
        { name: "Transfers & mobility", status: "Verified" },
        { name: "Dementia care", status: "Verified" },
        { name: "Medication reminders", status: "Verified" },
        { name: "Meal preparation", status: "Verified" },
        { name: "Hoyer lift", status: "Verified" },
        { name: "Transportation", status: "Approved" },
      ],
      preferences: { preferredShifts: "Weekday mornings", maxWeeklyHours: 40, travelRadiusMiles: 20 },
    },
  },'''),
])

# ── record view: Roles tab ──
patch('src/components/employees/EmployeeRecordView.tsx', [
('''      {tab === "Roles" && (
        <div className="max-w-[720px] flex-col gap-3.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
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
              <span className="inline-flex rounded-full bg-[var(--hairline-soft)] px-3 py-1 text-[12.5px] font-medium text-[var(--ink-body)]">
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
              <div key={label} className="flex items-baseline gap-3 border-t border-[var(--hairline-soft)] py-2.5">
                <span className="text-[13px]">{label}</span>
                <span className="ml-auto text-right text-[12.5px] text-[var(--ink-body)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}''','''      {tab === "Roles" && (
        /*
          Karynn's Roles screenshot, 29 September. The access rows are what
          the role grants; "Edit roles" says where grants actually live rather
          than pretending to change one. Skills, assignments and preferences
          are the mock on Chanel's record; everybody else shows the role's
          standing rows and "Not recorded".
        */
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3.5">
            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
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
                {(
                  employee.roles?.access ??
                  (employee.role === "office"
                    ? [
                        { label: "Scheduling and intake", detail: "Every client and every shift", level: "Full access", tone: "on" as const },
                        { label: "Client clinical records", detail: "Charts and assessments", level: "None", tone: "off" as const },
                        { label: "Pay and rates", detail: "Gusto only", level: "Gusto", tone: "partial" as const },
                      ]
                    : [
                        { label: "Own schedule and clock", detail: "Caregiver mobile app", level: "Full access", tone: "on" as const },
                        { label: "Assigned clients' care plans", detail: "Read and chart", level: "Assigned", tone: "on" as const },
                        { label: "Rates and billing", detail: "J-06 keeps caregivers out of rate discussions", level: "None", tone: "off" as const },
                      ])
                ).map((row) => (
                  <div key={row.label} className="flex items-center gap-3 border-t border-[var(--hairline-soft)] py-3">
                    <span
                      className={cn(
                        "h-[8px] w-[8px] flex-none rounded-full",
                        row.tone === "on" ? "bg-[#12B76A]" : row.tone === "partial" ? "bg-primary" : "bg-[#D0D5DD]",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-col leading-[1.35]">
                      <span className="text-[13px]">{row.label}</span>
                      <span className="text-[11.5px] text-muted-foreground">{row.detail}</span>
                    </span>
                    <span className="ml-auto text-right text-[12.5px] text-[var(--ink-body)]">{row.level}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
              <div className="flex items-center gap-2 pb-2">
                <h3 className="m-0 text-[13.5px] font-semibold">Client assignments</h3>
                {employable && (
                  <Link to="/scheduling" className="ml-auto text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]">
                    Assign client
                  </Link>
                )}
              </div>
              {(employee.roles?.assignments ?? employee.clients.map((c) => ({ client: c, kind: "Primary" as const, hoursPerWeek: 0 }))).length === 0 ? (
                <p className="m-0 py-2 text-[12.5px] text-muted-foreground">No client assigned.</p>
              ) : (
                (employee.roles?.assignments ?? employee.clients.map((c) => ({ client: c, kind: "Primary" as const, hoursPerWeek: 0 }))).map((a) => (
                  <div key={a.client} className="flex items-center gap-3 border-t border-[var(--hairline-soft)] py-3">
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                      {a.client.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </span>
                    <span className="flex min-w-0 flex-col leading-[1.35]">
                      <span className="text-[13px] font-medium">{a.client}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {a.kind === "Primary" ? "Primary caregiver" : "Backup coverage"}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-[3px] text-[11.5px] font-medium",
                        a.kind === "Primary" ? "bg-[#EEF0FE] text-primary" : "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
                      )}
                    >
                      {a.kind}
                    </span>
                    <span className="ml-auto text-[12.5px] tabular-nums text-[var(--ink-body)]">
                      {a.hoursPerWeek > 0 ? `${a.hoursPerWeek} hrs / wk` : "—"}
                    </span>
                  </div>
                ))
              )}
            </section>
          </div>

          <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
            <div className="flex flex-col gap-2">
              <SectionLabel>Skills &amp; competencies</SectionLabel>
              {employee.roles ? (
                <div className="flex flex-col">
                  {employee.roles.skills.map((sk) => (
                    <div key={sk.name} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] py-[7px] last:border-0">
                      <span className={cn("h-[8px] w-[8px] flex-none rounded-full", sk.status === "Pending" ? "bg-[#F79009]" : "bg-[#12B76A]")} aria-hidden="true" />
                      <span className="text-[12.5px]">{sk.name}</span>
                      <span className="ml-auto text-[12.5px] text-muted-foreground">{sk.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[12.5px] text-muted-foreground">Not recorded.</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <SectionLabel>Preferences</SectionLabel>
              <div className="flex flex-col">
                {[
                  ["Preferred shifts", employee.roles?.preferences.preferredShifts ?? "Not recorded"],
                  ["Max weekly hours", employee.roles ? String(employee.roles.preferences.maxWeeklyHours) : "Not recorded"],
                  ["Travel radius", employee.roles ? `${employee.roles.preferences.travelRadiusMiles} miles` : "Not recorded"],
                  ["Languages", p ? spokenLanguages(p).join(", ") || "Not recorded" : "Not recorded"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-2.5 border-b border-[var(--hairline-soft)] py-[7px] last:border-0">
                    <span className="flex-none text-[12.5px] text-muted-foreground">{label}</span>
                    <span className="ml-auto min-w-0 text-right text-[12.5px]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}'''),
])

# ── Assessment: every question on one page ──
patch('src/pages/Assessment.tsx', [
('''  const [phase, setPhase] = useState<"intro" | "questions" | "review" | "signing">(
    stored?.completedAt ? "review" : stored ? "questions" : "intro",
  );''','''  /*
   * "all" is every question on one scrolling page. Karynn, 29 September:
   * "if I want to hurry and fill out the full assessment, I don't see a way
   * to fill it out all at once without clicking on each tab." One at a time
   * stays the default for the kitchen table; this is for the office copying
   * from paper.
   */
  const [phase, setPhase] = useState<"intro" | "questions" | "all" | "review" | "signing">(
    stored?.completedAt ? "review" : stored ? "questions" : "intro",
  );'''),
('''            <Button variant="ghost" onClick={() => navigate("/admissions")}>
              Not now
            </Button>
          </div>
        </section>
      )}''','''            <Button variant="outline" onClick={() => setPhase("all")}>
              Fill it all in at once
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admissions")}>
              Not now
            </Button>
          </div>
        </section>
      )}

      {phase === "all" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-xl font-semibold tracking-tight">Every question</h2>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                  {progress.done} of {progress.total} answered. Everything saves as you go.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentId(resumeAt);
                  setPhase("questions");
                }}
              >
                One at a time
              </Button>
              <Button size="sm" onClick={() => setPhase("review")}>
                Review
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {questions.map((q, i) => {
              const newSection = i === 0 || questions[i - 1].section !== q.section;
              const answered = answers[q.id] !== undefined && answers[q.id] !== "";
              return (
                <div key={q.id}>
                  {newSection && (
                    <h3 className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.09em] text-muted-foreground first:mt-0">
                      {q.section}
                    </h3>
                  )}
                  <section className="mb-3 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-[3px] text-[12px] font-semibold tabular-nums text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="m-0 text-[16px] font-semibold leading-[1.3] tracking-[-.01em] [text-wrap:pretty]">
                          {q.question}
                          {q.required && !answered && (
                            <span className="ml-2 align-middle text-[11px] font-medium text-[#B54708]">needed</span>
                          )}
                        </h4>
                        {q.helper && <p className="mt-1.5 text-[13px] leading-[1.5] text-muted-foreground">{q.helper}</p>}
                        {q.restricted && (
                          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Not saved — it fills the packet for this visit, then it is gone.
                          </p>
                        )}
                        <div className="mt-3">
                          <AnswerInput
                            question={q}
                            value={answers[q.id]}
                            onChange={(v) => setAnswerFor(q.id, v)}
                            intake={intake?.answers ?? {}}
                            admissionName={admission.name}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              );
            })}

            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button onClick={() => setPhase("review")}>
                Review
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCurrentId(resumeAt);
                  setPhase("questions");
                }}
              >
                One at a time
              </Button>
            </div>
          </div>

          <PacketMeter coverage={coverage} pagesReady={pagesReady} progress={progress} />
        </div>
      )}'''),
('''                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-muted-foreground"
                  onClick={() => setPhase("review")}
                >
                  Review
                </Button>''','''                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-muted-foreground"
                  onClick={() => setPhase("all")}
                >
                  All at once
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setPhase("review")}
                >
                  Review
                </Button>'''),
])
EOF
npm run typecheck 2>&1 | grep -v "^>"; npm run lint 2>&1 | grep problems