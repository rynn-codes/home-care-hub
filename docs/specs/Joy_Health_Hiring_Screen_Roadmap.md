# Joy Health — Hiring Screen
## Operations Workspace | Screen Specification for Claude / Lovable

### Purpose

The Hiring screen is the internal Joy Health workspace used **after a candidate has progressed far enough that Joy Health is actively considering them**.

The goal is not to recreate GoHighLevel (GHL) or Gusto.

- **GoHighLevel** handles applicant communication, reminders, and pipeline automations.
- **Joy Health** provides the internal operational view, document review, employee application/profile creation, hiring decisions, and follow-through.
- **Gusto** handles the employment/payroll onboarding pieces that belong in Gusto.

The Hiring screen should let office leadership quickly answer:

1. Who is in the hiring process?
2. What stage is each person in?
3. What is missing?
4. What does Joy Health need to do next?
5. What is waiting on the candidate, GHL, Gusto, or a background check?
6. Who is ready to move forward?

The interface must remain **clean, calm, and low-click**.

---

# Entry Point Into Joy Hiring

Do **not** make Joy Health the primary application tracker from the moment someone applies on Indeed.

The workflow begins externally:

**Indeed Application → GHL → Phone Screening**

Joy should begin actively tracking the candidate once an **in-person interview is offered/scheduled**, because at that point Joy Health has demonstrated genuine interest in the applicant.

Joy should still receive enough GHL status information to document:
- interview offered
- interview scheduled
- interview reminder status
- attended
- cancelled
- no-show

No-shows must remain documented.

---

# Core Hiring Workflow

The screen must support this progression:

1. **Interview Scheduled**
2. **Documents / Application Pending**
3. **Document Review**
4. **Background Check**
5. **Ready for Decision**
6. **Offer**
7. **Gusto / HR Onboarding**
8. **Orientation**
9. **Field Orientation**
10. **First Shift**
11. **Week 1 Follow-Up**
12. **Active Employee**

Do not force all 12 stages into giant colorful columns.

The screen should remain visually simple.

Use a compact pipeline/stepper at the top and a work queue underneath.

---

# Interview Scheduled

Candidate information should arrive from GHL.

Show:
- candidate name
- phone
- email
- position
- interview date/time
- interviewer
- GHL status
- confirmation status

Actions:
- Open Candidate
- Reschedule
- Mark Attended
- Mark No-Show
- Decline

If No-Show:
- document date/time
- retain the record
- allow optional note
- sync status back to GHL

---

# After Interview — Candidate Document Collection

If Joy Health wants to continue with the applicant, request the hiring packet.

Required/expected items should include:

- Joy Health Employee Application
- Resume
- CPR Certification
- Immunization records
- TB documentation
- Driver's License
- Background Check Authorization
- Social Security Card when required before offer/payroll setup
- other required credentials based on role

The Employee Application is handled inside Joy.

Information entered into the employee application should automatically begin building the candidate's future **Employee Profile** so staff do not re-enter the same information later.

---

# Document Review

Joy should clearly show what is:

- Received
- Missing
- Expired
- Needs Review
- Approved

Do not require staff to open every document individually just to determine completeness.

Example candidate row:

**Sarah Johnson**  
Caregiver  
6 of 7 documents complete  
Missing: TB  
Background authorization: Signed

Primary action:

**Review Candidate**

---

# Background Check

Once authorization is signed and required identity information is available:

Status may show:

- Not Started
- Authorization Needed
- Submitted
- Pending
- Clear
- Review Required

Joy should never silently hire or reject someone based on AI.

AI may identify missing information or prepare a summary.

Human staff makes the hiring decision.

---

# Ready for Decision

Once documents and background requirements are complete, move the candidate to:

**Ready for Decision**

Candidate summary should show:

- Interview completed
- Documents complete
- Credentials reviewed
- Background status
- Availability
- Position
- relevant hiring notes

Primary actions:

**Move to Offer**

or

**Do Not Hire**

If Do Not Hire:
- document reason
- close Joy workflow
- sync appropriate status to GHL
- do not continue onboarding

---

# Offer

If there is a job available and the candidate is approved:

Move to **Offer**.

Show:

- Offer Prepared
- Offer Sent
- Awaiting Signature
- Offer Accepted
- Offer Declined

Once accepted, continue to Gusto / HR onboarding.

---

# Gusto / HR Onboarding

Gusto remains the system used for the HR/payroll onboarding steps that belong there.

Joy should display status, not duplicate Gusto.

Track:

- Gusto Invite Sent
- Offer Accepted
- W-4
- I-9
- Payroll Setup
- Gusto Onboarding Complete

Joy should receive/sync the status needed to know whether the candidate can move forward.

Once required employment onboarding is complete, the person becomes officially hired and moves into orientation.

---

# Orientation

Track:

- Office Orientation Scheduled
- Office Orientation Completed

Show date/time and status.

Primary action:

**Continue to Field Orientation**

---

# Field Orientation

Track:

- Field Orientation Scheduled
- Assigned trainer/supervisor
- Completed

Primary action:

**Ready for First Shift**

---

# First Shift

Show:

- first scheduled shift
- client
- date/time
- assigned supervisor if applicable
- completed/not completed

After first shift completion, automatically create the Week 1 Follow-Up requirement.

---

# Week 1 Follow-Up

Track:

- follow-up due date
- assigned staff member
- completed status
- notes

Once complete:

**Move to Active Employee**

The employee's profile should already contain information captured throughout hiring.

No duplicate employee creation.

---

# Candidate / Employee Portal

Candidates should have a simple portal/status view so they do not have to call or text the office asking where they are in the process.

Candidate-facing statuses should be written in friendly language.

Example:

**Your Hiring Progress**

✓ Interview Completed  
✓ Application Received  
✓ Documents Received  
• Background Check in Progress  
○ Offer  
○ HR Onboarding  
○ Orientation

Do not expose internal notes, scoring, hiring deliberations, or sensitive background-check information.

---

# GHL ↔ Joy Communication

GHL and Joy should communicate through API/webhook events where practical.

Examples of events Joy should be able to receive:

- Interview Offered
- Interview Scheduled
- Interview Confirmed
- Interview Cancelled
- Interview No-Show
- Interview Attended
- Candidate Moving Forward

Examples of events Joy may send back:

- Documents Requested
- Documents Complete
- Candidate Declined
- Ready for Offer
- Offer Accepted / appropriate status
- Hiring Closed

The exact integration architecture can be finalized during development, but the UI must be designed assuming statuses can synchronize.

---

# Hiring Screen Layout

## Header

**Hiring**

Subtitle:

*Move candidates from interview to first shift without losing a step.*

Keep the header simple.

Top utilities:
- Search candidates
- Filter
- one **Quick Add** icon/menu

Do not create multiple large action buttons.

---

# Top Hiring Pulse

Use a single thin summary strip rather than large KPI cards.

Example:

**Interview 4**  |  **Documents 6**  |  **Background 3**  |  **Ready for Decision 2**  |  **Offer 2**  |  **Onboarding 2**

Minimal color.

Numbers are clickable filters.

---

# Main Area — Hiring Work Queue

This should be the primary part of the screen.

Use a clean candidate list/table.

Columns:

- Candidate
- Position
- Current Stage
- What's Needed
- Last Activity
- Next Step
- Action

Example:

| Candidate | Position | Stage | What's Needed | Next Step |
|---|---|---|---|---|
| Emily Rodriguez | Caregiver | Interview | Interview today 2 PM | Open Interview |
| Jamal Scott | Caregiver | Documents | CPR + TB missing | Review Documents |
| Danielle Carter | CNA | Background | Check pending | View Candidate |
| Jessica Taylor | Caregiver | Ready for Decision | Nothing missing | Make Decision |
| Latisha Coleman | Caregiver | Gusto | I-9 incomplete | View Status |
| Angela Wright | CNA | Orientation | Scheduled May 13 | Open Orientation |

Do not overload rows with badges.

Use plain text and tiny status indicators.

---

# Candidate Detail Drawer

Clicking a candidate should open a side drawer rather than always navigating away.

The drawer should show:

### Candidate
Name  
Phone  
Email  
Position

### Progress
Compact vertical hiring stepper

### What's Missing
Only incomplete items

### Documents
Application  
Resume  
CPR  
TB  
Immunizations  
Driver's License  
Background Authorization  
Social Security Card, when applicable

### Activity
GHL communication/status history  
Interview history  
Document uploads  
Background status  
Offer/Gusto status

### Notes
Internal hiring notes

### Primary Next Action
Joy should determine the next logical action based on the workflow.

Examples:

**Mark Interview Attended**

**Request Missing Documents**

**Submit Background Check**

**Make Hiring Decision**

**Send Offer**

**Schedule Orientation**

Human confirmation is required before consequential actions.

---

# My Hiring Tasks

Use a small right-side panel or secondary section.

Only show actionable items assigned to the logged-in user.

Examples:

- Interview Emily — Today
- Review Jamal's documents
- Review Danielle's background check
- Schedule Angela's orientation

Do not duplicate the entire candidate pipeline here.

---

# Waiting on Others

Use one small section.

Examples:

- Sarah — TB upload
- Latisha — Gusto I-9
- Marcus — Background check
- Emily — Offer signature

This is important because it tells leadership what is pending but cannot currently be completed by them.

---

# Talk to Joy

Keep the familiar **Talk to Joy** block.

Suggested questions:

- Who can I move forward today?
- Which candidates are missing documents?
- Who has been waiting the longest?
- Show interview no-shows.
- Who is ready for orientation?
- What is holding up hiring?

Joy may summarize and prepare actions.

Joy should not make hiring decisions.

---

# Quick Add

Use ONE Quick Add control.

Hiring-related options may include:

- Add Candidate
- Schedule Interview
- Request Documents
- Schedule Orientation

Do not scatter multiple add buttons across the screen.

---

# Design Rules

Follow the Joy Health Design Constitution.

The hiring screen must be:

- white-dominant
- calm
- spacious
- minimal
- low-click
- easy to scan

Use Joy blue only as an accent.

Avoid:
- colored pipeline columns
- large KPI cards
- excessive badges
- charts
- graphs
- unnecessary hiring analytics
- multiple competing buttons
- giant AI sections
- dense CRM styling

This is an **operations workspace**, not an executive analytics dashboard.

---

# Important Simplification

The user should generally need only:

**Hiring → Candidate → Next Action**

The software should surface the next step rather than forcing office staff to remember the entire hiring process.

The candidate detail drawer should allow most routine hiring work to happen without leaving the Hiring screen.

---

# Acceptance Criteria

The screen is successful when:

1. Staff can see every active hiring candidate in one clean queue.
2. Staff can immediately identify what each candidate is waiting on.
3. Interview no-shows remain documented.
4. Employee application data begins the employee profile automatically.
5. Required documents are visible without opening multiple screens.
6. Background-check status is clear.
7. Offer and Gusto onboarding status are visible without duplicating Gusto.
8. Orientation, field orientation, first shift, and Week 1 follow-up are part of the same continuum.
9. Candidates can see a simplified version of their own progress.
10. Most candidate work can be completed from a detail drawer.
11. GHL automation remains responsible for communication/reminders.
12. Joy remains responsible for operational visibility, review, and workflow continuity.
13. The interface stays visually calm even when many candidates are active.
14. Human staff approves hiring decisions and consequential actions.

---

# Final Design Instruction

Do not build a traditional ATS dashboard.

Build a **simple hiring workspace that carries a person from interview → employee**.

The most important UI element is the candidate work queue.

The most important UX behavior is:

**Joy tells the user what needs to happen next.**

Keep the visual design consistent with the simplified Operations screen and the CareSwitch-inspired Joy UI.

---

# 2026 Hiring Workflow Revisions — Superseding Addendum

The following decisions supersede any conflicting language earlier in this roadmap.

## Correct GHL → Joy Handoff

GHL owns recruiting, communication, phone screening, interview scheduling/reminders, and the candidate pipeline **through the in-person interview**.

Joy's active candidate workflow begins only after the in-person interview when a human decides **Move Forward**.

```text
Applicant → GHL → Phone Screening → In-Person Interview
                                      ↓
                              Human Move Forward?
                                No       Yes
                                ↓         ↓
                               GHL   Joy Portal Invite
                                         ↓
                                     Phone OTP
                                         ↓
                                  Joy Application
```

Candidates who are not moved forward remain/close in GHL and do not need a Joy portal account.

## Candidate Portal / Application

After Move Forward, send the candidate a secure mobile-first Joy portal link. Preferred login is phone number + one-time verification code. The same identity persists through Candidate → Onboarding → Active Employee.

The employment application is completed natively in Joy, not through DocuSign as the application UI. Use the interaction philosophy of the existing Fillout workflow: mobile-first, white/warm-neutral, generous whitespace, one question or small group at a time, autosave, subtle progress, Back/Continue, review, and attestation/signature.

Application data should progressively populate the future Employee Profile. No duplicate data entry after hire.

## Candidate Status

Candidates return to the same portal to see status and their next action. Joy determines the status; candidates never self-select their stage.

Do not expose internal notes, scoring, deliberations, sensitive background information, or internal rejection reasoning.

## Documents / Credentials

Hiring must use the already-established shared Employee Documents / Credential Intelligence / Audit architecture. Do not build a Hiring-only document repository.

Candidate uploads should flow through secure storage, document processing, AI/OCR extraction where enabled, human verification when required, structured credential records, hiring readiness, and later employee compliance.

The same CPR, TB, license, driver's license, and other credential records carry forward after hire. Do not require re-upload merely because Candidate becomes Employee.

## Revised Joy Hiring Continuum

```text
Application / Documents
→ Document Review
→ Background Check
→ Ready for Decision
→ Offer
→ Gusto / HR Onboarding
→ Orientation
→ Field Orientation
→ Ready for First Shift
→ First Shift
→ Week 1 Follow-Up
→ Active Employee
```

The completed in-person interview should remain visible in history/progress, but Joy does not need to manage the entire pre-interview applicant pipeline.

## Same Portal Becomes Onboarding + Employee App

After Offer/Onboarding, do not create another Joy account. The candidate portal changes state into onboarding and then the permanent Employee Portal.

The permanent portal connects to the already-established employee features: Home, Schedule, Documents, Profile, Start Visit, Clock In/Out, charting, and document renewals.

## First Shift / Scheduling

The first shift must come from the **official Joy schedule**. Do not create a separate Hiring schedule. Readiness/compliance logic should be reusable by Scheduling rather than duplicated inside Hiring.

## Main Hiring Screen

The primary UI should remain the work queue. Prefer the simple operating views:

```text
Needs You | Waiting | Moving Forward
```

Use compact stage filters instead of giant colorful Kanban columns. Candidate rows should answer: who, stage, what's missing, last activity, next step, and action.

## Candidate Drawer — Add Portal Status

The candidate drawer should also show concise portal progress, for example:

```text
Portal Invitation   Sent
Last Login          Aug 21
Application         Submitted
Waiting On          TB Upload
```

It should still show only current actionable exceptions under **Joy Needs You**, shared document/credential status, activity/history, internal notes, and one primary next action.

## Quick Add Revision

Use one compact Quick Add/More menu. Manual Candidate is an exception/admin path. `Schedule Interview` should not be a primary Joy action because interview scheduling belongs to GHL before the handoff.

## Talk to Joy — Expanded Hiring Prompts

Useful prompts include:

- Who can I move forward today?
- Who is missing documents?
- Who hasn't completed their Joy application?
- Who is waiting on Gusto?
- Who has been waiting longest?
- Who is ready for a hiring decision?
- Who is ready for orientation?
- Who is ready for their first shift?
- What is holding up this candidate?

Joy may summarize, identify missing items, prepare reminders/tasks, and propose next workflow actions. Joy does not make hiring decisions.

## Data Continuity Rule

```text
GHL Contact
→ Joy Person / Candidate
→ Joy Application
→ Employee Profile
→ Credentials / Documents
→ Hiring Readiness
→ Onboarding
→ Active Employee
→ Scheduling / Clocking / Charting / Compliance
```

Do not duplicate person identity, application data, employee profile, credentials, portal account, schedule, or first-shift records.

## Updated Acceptance Criteria

The revised roadmap is successful when:

1. GHL owns recruiting through the in-person interview.
2. Joy starts the active candidate workflow only after a human Move Forward decision.
3. The candidate receives the Joy portal link after that decision.
4. The candidate uses phone/OTP login.
5. The candidate completes the employment application natively in Joy with Fillout-like simplicity.
6. Application data builds the future Employee Profile.
7. Candidate status is generated by Joy rather than self-reported.
8. Candidate documents use the shared Employee Documents/Credentials system.
9. Credential records persist after hire.
10. Background information remains appropriately restricted.
11. Human staff makes consequential hiring decisions.
12. Gusto status is surfaced without recreating Gusto.
13. The same portal becomes onboarding and then the active Employee Portal.
14. Orientation, field orientation, first shift, and Week 1 follow-up remain one continuum.
15. First shift uses the official Joy schedule.
16. Candidate transitions to Active Employee without duplicate creation.
17. `Needs You` and `Waiting` make ownership obvious.
18. Most routine work remains possible from the work queue + candidate drawer.
19. Pre-interview applicants do not clutter the Joy Hiring workspace.
20. The UI remains calm, minimal, and low-click.

## Final Updated Rule

**Do not build a traditional ATS.** Build a post-interview operations workspace that carries a selected candidate from **Move Forward → Joy Application → Documents → Background → Decision → Offer → Gusto → Orientation → Field Orientation → First Shift → Week 1 → Active Employee**.

Candidate UX: **Joy tells the candidate what they need to do next.**

Admin UX: **Joy tells staff what is blocking the candidate from moving forward.**
