# Mockup alignment — the running list

Karynn, 22 August, after her first walkthrough: "I think you veered away from
the mockups that I provided. Can you go back and look at the mock-ups and get
back to using them for UI/UX. The dashboard also seems not very user friendly."

She's right, and this file tracks the return, screen by screen. The approved
mocks live in `docs/mockups/` (pngs are the handoff; `.dc.html` the designs).

## Done

- **00 — The Brain (24 Aug).** Karynn uploaded the home screen's design
  (`Joy Health The Brain.dc.html`, vendored) and confirmed the rebuild; the
  handoff README marks the Brief Band dashboard as a superseded exploration.
  Home is The Brain now: the gradient title over the range tray and the
  Add-task / Ask-the-Brain controls; five tabs — **Overview** (the Brain Brief
  as a written paragraph with a "See why →" drawer of the records behind each
  sentence, What's Going On with its category filters, the mini calendar with
  the Sat–Fri billing-week band, Recent Activity, and the Joy Operations
  snapshot), **My Work** (day navigation over My Schedule / Needs Me with
  ticking strikethrough checkboxes and the all-caught-up empty state / Waiting
  on Others), **Joy Operations** (the four state cards — Handled · Working ·
  Waiting · Needs You — over their lists, each Working row opening the audit
  drawer: current status, why Joy acted, the activity timeline, next action,
  source records), **Calendar** (Sat-first month grid with the billing-week
  band and today ring, day-click drawer, Agenda view, Add-event and Subscribe
  modals, Add task modal from the header), and **Activity** (the filtered
  log). The old Brief Band components are deleted; the sidebar's first entry
  is "The Brain".

  Deviations, recorded: (1) counts derive from the seed lists, not the mock's
  static 12/3/4/1; (2) the mock's cast is replaced by the one cast — each Joy
  Operations item anchors to a fact another screen already shows (Bedjine's
  CPR really is the expiring one, Dolores's records authorization really is
  lapsed, Brandon's background check really is the pending one); (3) the
  mock's **rate-change approval is an hours change** — Susan Miller's real
  "asked about increased hours" — because client rates are e-mailed privately
  and never stored; (4) the brief's urgent signals render as live links under
  the paragraph (the e2e stories that walk Home → incidents / care plans
  depend on them); (5) Ask-the-Brain's scoped prompts answer inline per the
  mock, and a free-typed question opens the real Command Center — on home the
  header dot is the single AI door, so the floating Ask Joy pill is hidden
  there and kept everywhere else; (6) "Spruce" claims read "not wired yet",
  the calendar Subscribe modal says plainly the feed isn't live, and tasks and
  events added here save to this device with the toast saying so; (7) light
  grays sit at the accessible muted token, and the disabled Custom range /
  month navigation say why in their tooltips.

- **Updated mockups reconciled (24 Aug).** Karynn uploaded refreshed designs —
  Admissions, Assessment, Billing, Clients — plus a rewritten handoff README
  (`docs/mockups/HANDOFF-README.md`), and asked to diff them against what's
  built and reconcile. The vendored `docs/mockups/*.dc.html` are refreshed to
  those uploads. What changed in the build:

  - **Business rules, enforced app-wide.** The refreshed README states the
    agency's hard constraints as enumerations, not examples: payer sources are
    exactly *Private Pay* and *Private Pay + LTC Insurance* (no Medicaid,
    Medicare, VA, or third-party billing anywhere), and the service catalog is
    exactly *Personal Care*, *Post-Surgical*, *Respite*. The demo cast still
    carried Live-In and Evening Care (schedules, not services), Companion Care
    (a Respite framing) and Dementia Care (a Personal Care population); all are
    mapped to the three real lines across every seed a screen reads. Theo
    Nakamura (post-surgical recovery) becomes the one Post-Surgical client;
    Ruth's relief coverage becomes Respite; Dolores now carries the second
    payer value so the directory shows both. The assessment payer question, the
    phone-intake payment sources and the referral service picker are narrowed to
    the real options. The consent packet's verbatim assignment-of-payment clause
    is left as-is — it is fixed legal text, and only the field the RN actually
    sets now offers just what Joy accepts.

  - **Admissions — Quick Add flexible entry.** The single "New referral" button
    is replaced by the mock's + menu: New lead (quick capture, DOB removed, now
    with both Save lead and Save & start intake), Start phone intake and Start
    assessment (each behind a person picker with "start with a new person"
    always available, and the non-blocking intake-outstanding notice on an
    assessment), Schedule (the three-step what → who → details modal, wired to
    the real scheduleAssessment service), and Upload document. Nothing blocks on
    a missing earlier step. The mock's kanban Board view stays deliberately
    unbuilt for the reasons already recorded below.

  - **The Saturday–Friday week, on every calendar.** Billing and payroll
    already kept the agency week (README rule #4); the Scheduling board and the
    per-client / per-employee month calendars still ran Monday-start. All are
    Sat-first now — the board's columns, its month grid, the weekend tint, and
    the record calendars — and the conflict service's overtime window moved
    with them, because a Monday-based boundary would have split one payroll
    week's hours across two windows and missed real overtime. The visit seed
    anchors on the agency week too, so the board looks right on a weekend.

  - **No partial-payment state** (README rule #3: "an invoice is paid or
    unpaid"). The receivables domain had a `part_paid` status; it is removed,
    not just hidden — money that arrives short of the balance is still recorded
    and subtracted (a cheque is a fact), but the invoice stays plainly Unpaid
    (or Overdue) until it is settled in full.

  - **The README's smaller screen notes, applied.** Scheduling gains the
    **Agenda** view the README pairs with Week (matching The Brain's calendar);
    Day and Month stay as a recorded superset from the earlier mock. Payroll's
    week grid gains its own **Export** that exports the grid exactly as
    displayed — hours only, since that is all Joy holds; the priced .xlsx
    stays with the developer and Gusto. The last two lowercase relationship
    labels are capitalized (rule #6). The README's Hiring section (an
    Applied → Screened → Interview pipeline) remains superseded by the newer
    Hiring Screen Roadmap and Karynn's 24 Aug ruling — GHL owns recruiting and
    Joy's screen is the post-interview candidate queue.

  - **Assessment — the mock dropped its standalone "Education provided"
    section** (the refreshed README's prose still lists it, so README and HTML
    disagree; trusting the concrete design, it is gone). Joy's assessment is not
    organised around the mock's illustrative 15-section list — it is built from
    the real Joy intake PDF and 26-page consent packet, and has no separate
    Education section to remove. Education-to-family is delivered where the
    README itself puts the weight: the signing walkthrough's plain-language
    "what caregivers can and cannot do" callouts. No build change; noted here so
    the divergence is on the record rather than silent.

- **Design tokens & the last unaligned screens (24 Aug).** A consistency
  pass so the whole app speaks the mocks' visual language, not just the
  screens that had a mock. The neutral tokens moved from the old warm-white
  world to the mocks' cool set — #FCFCFC ground, #ECECF1 card border,
  #FAFAFB hover — and the control radius dropped from 20px to the mocks'
  ~10–12px, so every shadcn button, input and card that reads `rounded-lg`
  now matches the hand-built cards. Checked against the V1 Design Brief:
  calm, spacious, rounded, soft, minimal, #1407A2 primary — all held, and
  the muted-foreground / green / amber contrast tokens are unchanged (still
  the accessible values the axe suite gates). **Settings** was the last
  screen on somebody else's scaffold — "CareHub Home Care", a teal brand,
  QuickBooks/Slack, a "$199/mo plan"; it now shows Joy Health's real
  identity, the #1407A2 brand, the domain's real roles, and the brief's
  four integrations (GHL / Gusto / Spruce / Stripe) each marked
  not-connected. The old `<title>CareHub…>` and OG tags are Joy Health now.
  A pre-existing date-fragile portal-signal unit test (it leaned on the
  seed's floating clock) was made deterministic in passing.

  Approval simplicity preserved, per Karynn's 24 Aug note ("I do like how
  simple it was to approve things"): Billing keeps its one-click Approve →
  Send per card and the batch Send-all — untouched by this pass.

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

- **09 — Billing.** Aligned 23 Aug, on Karynn's ruling ("adopt the mock's
  To send | Sent | Profitability framing"). The three tabs over the
  unchanged Saturday-run engine: **To send** carries the This-week's-batch
  card (run identity, total, hours, a Send-all that unlocks when every
  draft is approved), one card per client with status pill, expandable
  invoice lines and the run's real exceptions as the mock's review flags,
  amber No-draft cards for skipped clients saying what clears them, and
  the rail — The week (Karynn's rhythm: drafts Saturday, approve Sat–Mon,
  out Monday, the dunning ladder, the Sunday gate — the mock's "due
  Wednesday" is superseded), Outstanding with Record-a-payment, and an
  honest Stripe card ("Not connected"; the plumbing is ready). **Sent** is
  the mock's table over the issued invoices and every payment against
  them, with balance-state pills and the unpaid footer. **Profitability**
  keeps the mock's frame and refuses the net figure honestly — caregiver
  pay rates live in Gusto, so the billed side is real and the cost side
  says "In Gusto" instead of multiplying placeholder rates into something
  that reads like a margin. The mock's Hide-amounts toggle is real;
  Create invoice is greyed (invoices come from the run). Approve → Send →
  JH-number → Outstanding → audit trail all behave exactly as before, and
  the same four e2e specs prove it.

## Conflicts

1. **Hiring: mock 02's job board vs the newer roadmap's candidate queue —
   RESOLVED 24 Aug: keep the candidate queue, do not build the job board.**
   The Aug 18 mock showed an "Open Positions" job board (positions,
   recruitment, an applicant directory — the "we're hiring, here are the
   openings" view). The Hiring Screen Roadmap she uploaded 22 Aug superseded
   it with the post-interview candidate work queue (Needs You | Waiting |
   Moving forward, with Stale/Blocked flags), because GoHighLevel owns
   recruiting — so Joy never posts or advertises roles, it works the people
   already in the pipeline. The build already followed the roadmap; her
   ruling confirms it, so nothing changed. The job board is not a Joy
   surface.

2. **Billing: "To send | Sent | Profitability" vs the updated mock's
   "Invoices | Payers | Profitability" — RESOLVED 24 Aug: adopt the full
   updated mock.** The 24 Aug updated Billing mock superseded Karynn's 23 Aug
   two-tab ruling with a single **Invoices** list under a status filter
   (All · Needs review · Ready · Sent · Past due · Paid · Adjusted), a new
   **Payers** tab, and Profitability. Because that reversed her explicit
   earlier ruling and touched the approval simplicity she asked us to protect,
   it was put to her rather than reframed silently — and she chose the full
   updated mock. Built the same day: drafts and issued invoices are one list
   (one status per row, sorted work-first), approve stays exactly one click on
   the row and Approve → Send → JH-number → Outstanding is unchanged; the
   batch banner still sends the whole ready set at once; a service-period
   dropdown of Sat–Fri ranges and an Export-as-shown button sit in the header.
   **Payers** shows who is responsible for each client's bill, the two payer
   types, the method and the authorization line, from the real roster — with
   no rate column, because rates are e-mailed privately and never stored (the
   mock's per-payer rate and rate-history are out for the same recorded reason
   as Profitability's cost side). Profitability still honestly refuses a net
   figure until real pay rates exist, and the mock's "due Wednesday" remains
   superseded by the Saturday-run answers. The mock's "Unsure" payer type on
   an active client is not reproduced — the README's own business rule #1 says
   "Not sure yet" is a lead-only value, and the mock's seed simply violates
   its own rule.
