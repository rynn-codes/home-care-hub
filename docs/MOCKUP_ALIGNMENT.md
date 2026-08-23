# Mockup alignment — the running list

Karynn, 22 August, after her first walkthrough: "I think you veered away from
the mockups that I provided. Can you go back and look at the mock-ups and get
back to using them for UI/UX. The dashboard also seems not very user friendly."

She's right, and this file tracks the return, screen by screen. The approved
mocks live in `docs/mockups/` (pngs are the handoff; `.dc.html` the designs).

## Done

- **01/11 — Dashboard (Brief Band).** Rebuilt 22 Aug. The nine-panel,
  three-column wall is gone. Now the mock's morning: greeting with the accent
  time-of-day and the wave, the Morning Brief in computed sentences
  (`domain/home/brief.ts` — every sentence from the module-owned signals, so
  the brief can never contradict a screen), the thin hairline stat band
  (explicitly not KPI cards), My Tasks | Today's Schedule as tabs in one
  focused column, and the floating Ask Joy pill opening the collapsed
  assistant panel. Tasks are the old strip's signals as rows — same numbers,
  same links, calmer shape.

## To align next

- **08 — Scheduling**, **10 — Payroll**, **03 — Clients**, **04 — Employees**,
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
