# Joy Health Payroll --- Build-Ready UI/UX Mockup Specification

## Purpose

Design the **Joy Health Payroll workspace** as a calm, premium
operations screen for the CEO/administrator.

Joy should organize the operational work completed **before payroll is
handed off to Gusto**, surface exceptions, and show whether the cycle is
ready. Do not recreate Gusto.

## Design Direction

-   CareSwitch-inspired simplicity
-   White / warm-neutral canvas
-   No blue page background
-   Minimal color
-   Generous whitespace
-   Premium SaaS polish
-   Rounded cards, subtle borders/shadows
-   Fewer clicks and progressive disclosure
-   No KPI overload or dense spreadsheet as the default
-   Joy AI assists quietly

The CEO should answer one question immediately:

> **Is payroll ready, and if not, what specifically needs me?**

------------------------------------------------------------------------

# 1. SOURCE-OF-TRUTH WORKFLOW

## Monday Administrative Workflow

The supplied Joy Health Payroll & Invoicing Schedule establishes this
Monday workflow:

1.  Invoice the **upcoming Saturday--Friday care week**.
2.  Calculate payroll for the applicable **prior Saturday--Friday
    week**.
3.  Send the **paid invoice copy / LTI email**.
4.  Bill applicable **overtime** for the prior week.

These are connected workflows but use different service periods. Never
collapse them into one generic pay-period card.

### Example

**Monday, August 10, 2026**

-   Upcoming Billing Week: **Aug 15--21**
-   Payroll / LTI / OT Review: **Aug 1--7**

The UI must make this distinction immediately obvious.

## Employee-Facing Payroll Timing

Existing Joy Health employee material separately describes: - 1st--15th:
time sheets due by the 16th - 16th--end of month: time sheets due by the
1st - Direct deposit - Payroll errors reported to supervisor, who
notifies payroll

Do not confuse this employee-facing timing with the weekly Monday
administrative workflow.

------------------------------------------------------------------------

# 2. GUSTO ROLE

Gusto remains the payroll/HR destination. Joy is the **operational
preparation and review layer**.

Workflow:

**Collect → Reconcile → Flag → Resolve → Approve → Prepare for Gusto →
Confirm**

Do not reproduce the entire Gusto product inside Joy.

## Gusto Screenshot Instruction

Previously discussed Gusto screenshots should be used as visual/process
references when supplied to the design project.

The source retrieval used for this specification did **not** surface the
actual Gusto screenshots. Therefore: - Do not invent Gusto screens or
fields. - Do not claim an unverified live Gusto integration. - Reserve
the appropriate handoff/export state. - Refine exact Gusto handoff
fields after the screenshots are attached.

------------------------------------------------------------------------

# 3. PRIMARY PAGE STRUCTURE

Use the standard Joy Health application shell.

### Left Navigation

-   Home
-   Operations
-   Admissions
-   People
-   Scheduling
-   Billing
-   **Payroll --- active**
-   Reports
-   Settings

Retain the established **Talk to Joy** access point.

### Top Bar

-   Global search
-   Notifications
-   Quick Add
-   User/profile

Keep payroll-specific controls out of the global header.

------------------------------------------------------------------------

# 4. PAYROLL HEADER

## Payroll

**Review payroll readiness, resolve exceptions, and prepare the cycle
for Gusto.**

Right-side actions: - **Payroll History** - **Prepare for Gusto**

The Gusto action should be disabled/not-ready until required reviews are
complete.

------------------------------------------------------------------------

# 5. MONDAY WORKFLOW STRIP

Immediately below the header:

## This Monday --- August 10

### Upcoming Billing Week

**Aug 15--21**

Invoice upcoming care week.

### Payroll / LTI / OT Week

**Aug 1--7**

Payroll • LTI • Overtime

Keep this visually simple. No complicated timeline.

------------------------------------------------------------------------

# 6. PRIMARY HERO --- PAYROLL READINESS

This should be the strongest element.

## Payroll is almost ready

**34 of 36 employees cleared**

> Two items need review before this payroll cycle is ready for Gusto.

Use one subtle progress indicator.

Show only actionable unresolved items, for example: - 2 payroll
exceptions - 5 shifts missing EVV verification - 1 overtime item
requiring review

Primary action:

**Review items →**

Do not use multiple brightly colored KPI cards.

------------------------------------------------------------------------

# 7. MAIN WORK AREA

Two-column desktop layout:

### Main Column

**Needs Review**

### Right Column

**Payroll Cycle**

The screen should feel like a focused work queue, not an analytics
dashboard.

------------------------------------------------------------------------

# 8. NEEDS REVIEW

Subtext:

> Only payroll items requiring action appear here.

Tabs:

**All \| Time & EVV \| Overtime \| Mileage \| Adjustments**

Do not create a separate page for each category.

### Example --- Maria Johnson

Client: Evelyn Carter

**Time / EVV mismatch**

Scheduled: 8.0 hrs\
Verified: 7.5 hrs

Status: **Needs review**

**Review →**

### Example --- David Okoro

**Overtime review**

Regular: 40.0 hrs\
OT: 4.5 hrs

Status: **Confirm OT**

**Review →**

### Example --- Samantha Chen

**Mileage documentation**

Mileage entry requires supporting review.

Status: **Missing information**

**Review →**

------------------------------------------------------------------------

# 9. EXCEPTION DRAWER

Clicking Review should open a right-side drawer rather than forcing
navigation away.

## Maria Johnson --- Payroll Exception

**Scheduled**\
8:00 AM--4:00 PM

**Recorded / Verified**\
8:02 AM--3:32 PM

**Difference**\
30 minutes

Supporting information: - Client - Service date - Scheduled shift -
EVV/visit verification - Documentation status - Relevant notes

Actions: - **Approve recorded time** - **Correct time** - **Request
clarification** - **Add note**

If an action must occur in another authoritative system, clearly say so
instead of implying Joy changed payroll externally.

------------------------------------------------------------------------

# 10. PAYROLL CYCLE PANEL

Use a simple checklist:

✓ Visit hours collected\
✓ Schedule compared\
! Exceptions reviewed --- 2 remaining\
! Overtime reviewed --- 1 remaining\
✓ Mileage reviewed\
○ Payroll approved\
○ Prepared for Gusto\
○ LTI / paid invoice sent\
○ Cycle complete

Avoid charts.

------------------------------------------------------------------------

# 11. TIME / EVV REVIEW

Joy should surface exceptions such as: - Missing clock-in - Missing
clock-out - Scheduled vs verified-hour difference - Missing visit
verification - Potential overlapping shifts - Edited time - Missing
associated documentation - Other time records requiring review

Correct records remain quiet.

**Everything correct disappears into the background. Everything
requiring action rises to the top.**

------------------------------------------------------------------------

# 12. OVERTIME

Overtime must be visible within Needs Review.

### Example

**David Okoro**

Regular hours: **40.0**\
Overtime: **4.5**

Clients served: **3**

> Overtime is included in the Aug 1--7 payroll review period.

Actions: - **Approve OT** - **Review shifts** - **Add note**

Where relevant, show client/facility billing status separately:

**OT Billing: Pending**

Do not merge employee payroll and client billing into one concept.

------------------------------------------------------------------------

# 13. MILEAGE / TRAVEL REIMBURSEMENT

Existing Joy Health policy identifies potentially reimbursable travel
expenses including: - Mileage using a personal car while out with
clients during a shift - Meals while out with clients - Activities while
on outings with clients

Travel expense documentation and applicable receipts should be
reviewable.

### Example

**Samantha Chen**\
Client: Margaret Davis

Mileage: **18.4 mi**\
Trip documentation: **Complete**\
Receipt: **N/A**\
Status: **Ready**

Do not invent a blanket rule for travel between client locations; the
underlying policy contains unresolved/template language on that point.

------------------------------------------------------------------------

# 14. ADJUSTMENTS

Use one Adjustments tab for unusual items: - Time correction -
Reimbursement - Bonus - Manual adjustment - Prior-period correction

Joy captures/reviews/prepares the information; do not assume every
adjustment is posted directly to Gusto.

------------------------------------------------------------------------

# 15. EMPLOYEE PAYROLL SUMMARY

When an employee is opened:

## Maria Johnson

Review period: **Aug 1--7**

### Hours

Regular: 36.0\
Overtime: 0.0

### Visit Verification

6 visits\
6 verified

### Reimbursements

Mileage: 24.8 mi

### Exceptions

None

### Status

**Ready for payroll**

Keep unnecessary HR/payroll detail off the CEO's primary screen.

------------------------------------------------------------------------

# 16. READY FOR GUSTO STATE

After required reviews are resolved:

## Ready for Gusto

**36 of 36 employees cleared**

> Payroll review is complete for Aug 1--7.

Actions: - **View Payroll Summary** - **Prepare for Gusto**

After preparation:

## Prepared for Gusto

Prepared: Monday, Aug 10 • 10:42 AM\
Prepared by: Ren Robinson

**View export summary**

Do not say payroll was submitted to Gusto unless an integration can
actually verify submission.

------------------------------------------------------------------------

# 17. LTI / PAID INVOICE

The Excel workflow explicitly ties Monday to the **paid invoice copy /
LTI email**.

Represent it in the Payroll Cycle.

### LTI / Paid Invoice

Payroll review period: **Aug 1--7**

Status: **Ready to send**

**Review LTI package**

After completion:

✓ **LTI / paid invoice sent**

Record: - Date/time - User - Period - Status

------------------------------------------------------------------------

# 18. UPCOMING BILLING CONNECTION

Because Monday also includes invoicing the upcoming care week:

## Upcoming Billing Week

**Aug 15--21**

**12 client invoices**

Status: **Ready for billing review**

**Open Billing →**

Payroll should not become the Billing page. This card simply connects
the Monday obligations.

------------------------------------------------------------------------

# 19. TALK TO JOY

Do not add a giant AI panel.

Useful contextual questions: - What is holding up payroll? - Show
employees with missing EVV. - Who has overtime this period? - Which
payroll exceptions remain? - Summarize payroll before I send it to
Gusto. - Which mileage entries need review? - What still needs to happen
for Monday?

Optional contextual insight:

> **Joy:** Two employees are preventing payroll from being ready. One
> has an EVV mismatch and one has unreviewed overtime.

**Review with Joy →**

------------------------------------------------------------------------

# 20. PAYROLL HISTORY

Use a clean list/table:

  Period       Status       Employees   Exceptions Gusto Prep   Completed
  ------------ ---------- ----------- ------------ ------------ -----------
  Aug 1--7     Complete            36            0 Prepared     Aug 10
  Jul 25--31   Complete            35            0 Prepared     Aug 3
  Jul 18--24   Complete            35            0 Prepared     Jul 27

Selecting a cycle opens its summary.

------------------------------------------------------------------------

# 21. AUDIT TRAIL

Track: - Exception approved - Time corrected - Overtime approved -
Mileage reviewed - Note added - Payroll marked ready -
Export/preparation generated - LTI package marked sent

Capture: - User - Action - Date/time - Employee/client where relevant -
Payroll period - Note/reason when appropriate

Keep audit detail available but out of the default CEO view.

------------------------------------------------------------------------

# 22. VISUAL DESIGN

## Use

-   White / soft warm-neutral background
-   Generous whitespace
-   Dark charcoal text
-   Joy accent sparingly
-   Soft gray borders
-   Subtle shadows
-   Rounded cards
-   Strong typography hierarchy
-   Restrained status pills
-   Simple line icons

## Avoid

-   Blue page backgrounds
-   Large saturated blue/purple areas
-   Rainbow KPI cards
-   Excessive status colors
-   Dense spreadsheets
-   Rows of summary cards
-   Competing CTAs
-   Decorative charts
-   Nested navigation
-   Separate pages for every exception
-   Recreating Gusto

------------------------------------------------------------------------

# 23. DESKTOP WIREFRAME

``` text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Payroll                                      History   Prepare for Gusto     │
│ Review payroll readiness, resolve exceptions, and prepare the cycle.        │
├─────────────────────────────────────────────────────────────────────────────┤
│ THIS MONDAY • AUG 10                                                       │
│ Upcoming Billing Week              Payroll / LTI / OT Week                 │
│ Aug 15–21                          Aug 1–7                                  │
│ Invoice upcoming care week         Payroll • LTI • Overtime                │
├─────────────────────────────────────────────────────────────────────────────┤
│ PAYROLL READINESS                                                          │
│ Payroll is almost ready                                      94%           │
│ 34 of 36 employees cleared                                                │
│ Two items need review before the cycle is ready for Gusto.                 │
│                                                        [Review items →]     │
├──────────────────────────────────────────────┬──────────────────────────────┤
│ NEEDS REVIEW                                 │ PAYROLL CYCLE                │
│ All | Time & EVV | OT | Mileage | Adjust.    │ ✓ Hours collected           │
│                                              │ ✓ Schedule compared          │
│ Maria Johnson                                │ ! Exceptions — 2 remaining  │
│ Time / EVV mismatch                          │ ! OT — 1 review              │
│ Scheduled 8.0 • Verified 7.5   [Review →]   │ ✓ Mileage reviewed          │
│ ───────────────────────────────────────────  │ ○ Payroll approved          │
│ David Okoro                                  │ ○ Prepared for Gusto        │
│ Overtime review                              │ ○ LTI / paid invoice sent   │
│ 40 regular • 4.5 OT            [Review →]   │ ○ Cycle complete            │
│                                              │                              │
│                                              │ UPCOMING BILLING             │
│                                              │ Aug 15–21 • 12 invoices      │
│                                              │ [Open Billing →]             │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

------------------------------------------------------------------------

# 24. FIRST MOCKUP REQUEST

Create a high-fidelity desktop mockup for:

## **Payroll --- Monday Workflow / Almost Ready State**

It must show: 1. Standard Joy Health navigation 2. Payroll header 3.
Monday workflow strip with both date periods 4. Large Payroll Readiness
section 5. Two-item Needs Review queue 6. Payroll Cycle checklist 7.
Upcoming Billing connection 8. Prepare for Gusto in the correct
not-ready state 9. Talk to Joy access 10. Minimal color and substantial
whitespace

**Do not design every secondary screen yet.**

Approve the information architecture and visual hierarchy first.

------------------------------------------------------------------------

# 25. SECOND MOCKUP

After primary approval:

## Payroll Exception Drawer

Use Maria Johnson's EVV/time mismatch.

Show how the CEO can: - Understand the discrepancy - See supporting
information - Approve, correct, or request clarification - Add a note -
Return to the queue without losing context

------------------------------------------------------------------------

# 26. THIRD MOCKUP

After exception-flow approval:

## Payroll --- Ready for Gusto

Show: - 36 of 36 employees cleared - No unresolved exceptions - Payroll
period clearly identified - Gusto preparation enabled - LTI step ready -
Upcoming billing visible but secondary

------------------------------------------------------------------------

# 27. SUCCESS CRITERIA

The CEO should answer these within ten seconds:

1.  What payroll period am I working on?
2.  Is payroll ready?
3.  If not, what is blocking it?
4.  What do I need to do next?
5.  Is overtime handled?
6.  Is the LTI/paid invoice step handled?
7.  What gets handed to Gusto?
8.  What upcoming billing week am I responsible for Monday?

If these require multiple pages, simplify the design.

------------------------------------------------------------------------

# FINAL DESIGNER DIRECTION

This should look like a **premium operations product that happens to
manage payroll preparation**, not traditional payroll software.

Reference qualities:

**CareSwitch simplicity + Notion clarity + Monday/Trello actionability +
premium modern SaaS polish**

Do not visually clone those products.

The core principle:

> **Joy hides the complexity and shows the CEO only what requires a
> decision.**

Payroll can be complex behind the scenes.

**The screen should not be.**
