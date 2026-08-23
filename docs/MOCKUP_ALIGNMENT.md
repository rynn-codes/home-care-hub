# Mockup alignment — the running list

Karynn, 22 August, after her first walkthrough: "I think you veered away from
the mockups that I provided. Can you go back and look at the mock-ups and get
back to using them for UI/UX. The dashboard also seems not very user friendly."

She's right, and this file tracks the return, screen by screen. The approved
mocks live in `docs/mockups/` (pngs are the handoff; `.dc.html` the designs).

## Done

- **01/11 — Dashboard (Brief Band).** Exact-match pass completed 23 Aug from
  the design source (`Joy Health Dashboard - Brief Band.dc.html`), to the
  mock's own values throughout: Public Sans everywhere; the gradient greeting
  (28px/700, wave outside the gradient) over one light sub-line; the framed
  1.5fr/1fr brief band — Morning Brief in computed sentences
  (`domain/home/brief.ts`) plus the four-figure hairline stat row on the
  left, the Talk to Joy AI card (#FAFAFC, chips, input-mock) on the right;
  the pill-tab working area — My Tasks with ticking checkboxes,
  strikethrough and the 9-task progress footer | Today's Schedule as a
  timeline with a Now marker, greyed past visits and the red-dot Fill shift
  row — with Upcoming Deadlines below and Joy Assistant's prepared items in
  the hairline-divided right column; the gradient Ask Joy pill (breathing
  glow, ⌘J chip — the shortcut works) opening the 344px floating panel
  (three prompts that fill the input, mic "Listening…" state, indigo send).
  The shell matches too: white 224px sidebar with quiet-grey active row,
  indigo active icon, live counts and the user chip footer; the header's
  bordered ⌘K search, bell with the small orange dot, white "New" button
  with the mock's five actions, and the plain avatar circle.

  Recorded deviations, each deliberate:
  1. *Accessible grays.* The mock's lightest grays (#9B9BA3 meta text,
     #CACAD2 ⌘K hint) fail the 4.5:1 bar the app's own axe suite holds every
     screen to; they sit at the app's muted token instead. Visually
     near-identical, legally better.
  2. *Live numbers.* Stats, sidebar counts and the brief compute from the
     seeds and module signals (§25), so they read 6/7/1/2 rather than the
     mock's static 42/36/2/3 — and can never contradict the module screens.
  3. *A "needs you" link line under the brief,* only when something is
     urgent (capped at the three signals the headline names). The static
     mock cannot show live state; Home naming an incident past a deadline
     and taking you there is behavior three e2e stories depend on.
  4. *Nav structure keeps the earlier rulings* (Hiring under Operations per
     §6; Clients/Employees/People siblings per her 18 Aug ruling) in the
     mock's visual language; the mock's flat placeholder nav does not
     override them. The real Joy logo stands where the mock's placeholder
     dot is.
  5. *One AI surface.* The old round Command Center launcher is gone; the
     Ask Joy pill is the single door on every screen, and a question typed
     into its panel opens the full Command Center with that question as the
     thread's first message.

- **08 — Scheduling.** Aligned 23 Aug from the design source. The mock's
  252px rail of white cards (Needs you with colored dots, This week's counts,
  Ask Joy prompts that open the Command Center with the question), the week
  canvas with OPEN/CONFLICT pills, dashed open cards, avatar chips and tinted
  weekends — and the mock's Day and Month views, now real, over the same
  visits. Dragging a visit to another day raises the mock's confirm sheet
  with a live conflict check (a blocking double-booking disables Confirm and
  shows the red panel), and a confirmed change lands as the dark toast.
  Deviations: the shared shell keeps the Brief Band header rather than the
  mock's per-page breadcrumb strip; Quick add lists the mock's six items but
  greys the four that aren't built ("soon") instead of pretending; and every
  "notified through Spruce" claim reads "Spruce · not wired yet" because
  nothing here sends anything. The page-level "This week" stats are computed
  from the same visits the canvas shows.

- **10 — Payroll.** Aligned 23 Aug from the design source. The readiness
  hero with its progress bar and Review-items CTA (green-bordered once
  clear), the tabbed Needs-review queue whose rows open the exception
  drawer (compare cards, what-Joy-found, hours by week, and a plain
  statement of what clears each exception), the Payroll-cycle checklist
  with collapsed done-steps and the Also-on-Monday card, the week grid over
  the payroll week with flagged cells, the export preview with draft
  asterisks, and payroll history. All computed from the real payrollRun.
  Deviations, deliberate and recorded: **no money anywhere** — the mock's
  Rate/Gross columns and dollar pay-impacts are out because rates are not
  in the payroll domain (Karynn has not supplied real ones; Joy produces
  hours, Gusto produces wages); tab vocabulary follows the domain's real
  exception kinds (Time & clock / Verification / Documentation / Overtime —
  the mock's Mileage and Adjustments categories don't exist in Joy yet);
  the drawer explains what clears an exception instead of offering an
  approve button that would resolve nothing; download buttons are disabled
  (file generation lands with the developer); history starts honest and
  empty.

- **03 — Clients.** Aligned 23 Aug from the design source. The directory
  table to the mock's values (uppercase hairline headers, indigo-soft
  avatars, payer pills, status dots), and the client record's full tab set —
  Profile with the Details rail, Highlights (Summary + the indigo Payer
  card) and inline Activity; the Activity timeline; and the three tabs that
  used to say "not built yet", now real: **Schedule** is the mock's
  per-client month calendar over the same visits the Scheduling board shows
  (one Joy schedule, §20); **Services** carries the service card, the live
  care plan (goals, RN thresholds with their values, emergency plan) and
  its required-before-clock-out tasks, with the agreement rail — the rate
  row honestly reads "Emailed privately, not stored in the prototype";
  **Billing & Payments** computes the advance invoice from the agreement
  (Karynn's bill-the-agreement model), the deposit, and payment method from
  the same billing domain the Saturday run uses.

  The big fix underneath: **one cast, everywhere.** The directory used to
  carry six invented clients (Hollis, Arceneaux, Brightwell…) while every
  other module spoke of Lian Huang, Edward Pham and Ruth Alvarez — the
  person the dashboard said to call did not exist in the directory. The
  directory now carries the schedule board's own people with the board's
  own ids, so care plans, billing terms, visits and supervision all join;
  Theo (on hold) and Augustin (discharged) are deliberately absent from the
  board because on-hold and discharged clients have no visits. Thylia is
  active again (the board and the dashboard both showed her working while
  the employee seed said "on leave"), and the stale "c-lianhuang" paid-week
  id is fixed to the schedule's "c-lian".

- **04 — Employees.** Aligned 23 Aug from the design source. The directory
  to the mock's values, including the mock's compliance-attention strip —
  one amber chip per person with something lapsed or expiring, each opening
  that record — plus role pills, status and compliance dots, and Hours /
  Next shift columns. The record takes the mock's header and layout:
  Profile with the Details rail and Highlights (Summary, the tinted
  Compliance card, Next shift / This week / Driving tiles — This week
  computed from the schedule board, not a typed number), the Activity
  timeline, Employment & Compliance with the mock's facts grid, dotted
  credentials table (issued/expires from the record) and eligibility rail,
  and three tabs that used to stub out: **Schedule** is the per-caregiver
  month calendar over the board's visits with live tiles; **Docs** lists
  the credential documents' dates and states honestly ("the files
  themselves need storage the prototype doesn't have"); **Roles** shows the
  role chips and what each role may do, noting the real grants live in the
  migrations. Audit packet stays as built.

  Also caught: the sidebar counted 21 clients and 15 employees out of the
  old mockData store while the directories showed 8 and 9 from the seeds —
  the sidebar now counts the same seeds the screens render. Chanel's
  summary no longer claims 38 hours over a tile computing 8.8 from the
  board.

- **05 — Admissions.** Aligned 23 Aug. The stage filter tabs with counts,
  the stalled-record banner (Send reminder greyed with the Spruce reason,
  Open record real), the grouped queue under the mock's colored dots —
  WorkQueueSection restyled once, so Hiring's queue gains the same frame —
  rows with avatars, stage and Overdue pills, and the Today + Ask Joy rail.
  Deviation, recorded: the mock's kanban Board view is deliberately not
  built — §3 of the Admissions Master Build Spec prefers the
  who-holds-the-next-move queue and §2 warns against pipeline columns, so a
  second view of the same records would need its own reason to exist.

- **06/07 — Intake & Assessment.** Question screens aligned 23 Aug to the
  mock's floating one-question frame: the indigo NN / NN counter with the
  section label, the 29px question with its light helper, no card around
  the question. The mock's AI conversation mode ("Joy is listening") stays
  behind AI_PHONE_INTAKE_ENABLED, off — the manual path is the one that
  must always work. The assessment's section rail, plan-of-care and
  review-and-sign flows were already built to their mocks' structure.

## Conflicts needing Karynn's ruling (per the mockups README protocol)

1. **Hiring: mock 02 vs the newer roadmap.** The mock (Aug 18) shows an "Open
   Positions" job board — positions, recruitment, applicant directory. The
   Hiring Screen Roadmap she uploaded 22 Aug (UPDATED, superseding addendum)
   specifies the post-interview candidate work queue with Needs You | Waiting,
   and says GHL owns recruiting. The build follows the roadmap. If she also
   wants the job-positions view, it is a new surface, not a replacement.
2. **Billing: mock 09's framing.** The mock shows "To send | Sent |
   Profitability" tabs with a THIS WEEK'S BATCH review card and per-client
   review flags ("overtime captured", "shifts added after the schedule was
   set"). The built screen carries the same substance (the Saturday run's
   drafts and exceptions ARE the review flags) in a different frame. Mock also
   says "Due Wednesday" — superseded by her Saturday-run answers. Alignment
   plan: adopt the mock's tab framing and batch-summary card over the current
   stack, keeping the run engine underneath; confirm with her that
   "Profitability" waits for real pay rates (net margin currently refuses to
   compute, honestly).
