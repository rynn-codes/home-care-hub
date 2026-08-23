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

## To align next

- **10 — Payroll**, **03 — Clients**, **04 — Employees**,
  **05 — Admissions**, **06/07 — Intake & Assessment:** compare each against
  its mock and close the visual gaps. (Flows are built; this is layout,
  density, and vocabulary.)

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
