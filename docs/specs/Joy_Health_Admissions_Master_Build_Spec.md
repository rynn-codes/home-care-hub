# Joy Health Admissions — Master Build-Ready UI/UX Specification
## Claude Design / Product / Engineering Handoff
### V1 — Referral → Assessment → Pre-Onboarding → Ready for Admission → Client

---

# 0. READ THIS FIRST

Admissions is one of the most important workflows in Joy Health.

Do **not** design this as a traditional CRM pipeline with dozens of cards, bright status colors, or a giant clinical chart.

The underlying admissions process is complex.

**The interface should not feel complex.**

The design goal is:

> **Joy remembers the process, surfaces what is missing, and tells the user what should happen next.**

The office user should generally follow:

**Admissions → Person → Next Action**

This module must preserve the Joy Health product principles already established:

- AI drafts. Humans approve.
- Enter once. Reuse everywhere.
- Every workflow autosaves.
- Graceful failure for critical workflows.
- Calm before complexity.
- One source of truth.
- Joy assists quietly rather than dominating the page.
- Information collected during intake/assessment becomes the future client profile.
- Do not require duplicate data entry.
- Do not make clinical decisions automatically.

The existing Product Bible explicitly establishes AI-guided assessment with **voice, photo, and manual entry**, section-by-section assessment, confidence scoring, autosave/recovery, and a calm AI-first operating-system direction.

---

# 1. WHAT ADMISSIONS IS

Admissions is the workflow that takes a person from:

```text
Referral / Inquiry
        ↓
Phone Intake
        ↓
Assessment Scheduling
        ↓
Assessment
        ↓
Assessment Review / Decision
        ↓
Pre-Onboarding
        ↓
Ready for Admission
        ↓
Start-of-Care Setup
        ↓
Active Client
```

The permanent client record ultimately lives under:

**People → Clients**

Admissions is the **process**.

People is the **record**.

Do not create a second client after admission.

The prospect/client record created during admissions should progressively become the permanent client profile.

---

# 2. PRIMARY ADMISSIONS STAGES

Use these as the simplified top-level admissions stages:

1. **New Referral**
2. **Phone Intake**
3. **Assessment**
4. **Pre-Onboarding**
5. **Ready for Admission**
6. **Admitted**

The Home/Dashboard summaries already established the operational categories:

- New Referrals
- Phone Intakes
- Assessments Scheduled
- Pre-Onboarding
- Ready for Admission

The full Admissions workspace may add **Admitted** as a history/completion filter.

Do not create a 15-column pipeline.

---

# 3. CRITICAL UI MODEL

The Hiring simplification should become the model for Admissions.

The primary Admissions screen should organize work by:

## Needs You
Joy Health has an action.

## Waiting
Joy has completed its current action and is waiting on the prospect, family, payer, RN, documents, signature, etc.

## Moving Forward
The next milestone is already scheduled or progressing normally.

This is more useful than exposing the entire roadmap at once.

Example:

```text
NEEDS YOU · 3

Marcus Bell
Assessment
Assessment today at 10:30 AM
                                Open Assessment →

Susan Miller
Pre-Onboarding
Service Agreement needs review
                                Review →

John Williams
Phone Intake
Intake incomplete
                                Continue Intake →


WAITING · 2

Margaret Davis
Assessment
Waiting on medication list

Evelyn Carter
Pre-Onboarding
Waiting on family signature


MOVING FORWARD · 3

Lian Huang
Assessment scheduled
Friday · 2:00 PM

Robert Green
Ready for Admission
Start of care Monday

Angela Thomas
Assessment complete
Pre-onboarding prepared
```

---

# 4. GLOBAL ADMISSIONS FILTER BAR

At the top of the workspace use simple filters:

```text
All | Referrals | Phone Intake | Assessment | Pre-Onboarding | Ready | Admitted
```

These are **global filters across all prospects**.

They are not one person's progress tracker.

Optional counts:

```text
All 12 | Referrals 3 | Intake 2 | Assessment 4 | Pre-Onboarding 2 | Ready 1
```

Use counts only if they remain visually quiet.

Do not use a connected stepper at the top because that looks like one person's journey.

An individual person's journey belongs inside their detail drawer/workspace.

---

# 5. PAGE HEADER

## Admissions

Supporting text:

> Move new clients from referral to ready-for-care without losing a step.

Top-right controls:

- Search
- Filter
- View switch
- One **Quick Add** control

Quick Add may include:

- New Referral
- Phone Intake
- Schedule Assessment
- New Client
- Upload Document

Do not scatter multiple large buttons across the page.

---

# 6. LIST + KANBAN VIEW

Admissions should support two views.

## Default: Work Queue / List

Best for office operations.

## Alternate: Kanban

For users who prefer visual pipeline management.

View switch:

```text
[List] [Board]
```

Both views use the **same data**.

Do not build two separate workflows.

---

# 7. KANBAN DESIGN

If Board view is selected, keep it restrained.

Recommended columns:

```text
Referral
Phone Intake
Assessment
Pre-Onboarding
Ready
```

Do not add a rainbow color to every column.

Cards should show only:

- Person
- Service type
- One key status
- Next action / blocker
- Assessment date if relevant

Example:

```text
Marcus Bell
Personal Care

Assessment today · 10:30 AM
Medication list missing
```

Dragging between workflow stages should require validation where a stage has completion requirements.

Do not allow a user to drag someone to Ready for Admission if required items are incomplete without clearly warning them.

---

# 8. NEW REFERRAL

A referral may originate from:

- Phone inquiry
- Website / form
- Existing marketing/CRM source
- Hospital/facility/provider
- Family
- Client/self
- Manual office entry
- Other configured referral source

The initial referral record should remain intentionally light.

## Minimum Referral Information

- Prospective client name
- Preferred name
- Phone
- Email
- Responsible party / primary contact if different
- Referral source
- Service being requested
- General location / ZIP
- Best contact method
- Short referral note
- Date/time received
- Assigned staff member

Do not force the full clinical/intake packet at referral entry.

The goal is:

> **Capture enough to follow up without making referral entry burdensome.**

---

# 9. REFERRAL CARD / ROW

Example:

```text
Tammy Wilson
New Referral

Personal Care · Houston
Daughter is primary contact
Received today · 9:14 AM

Next: Complete phone intake

[Start Intake]
```

If no action is required immediately, place the record under Waiting or Moving Forward based on status.

---

# 10. DUPLICATE CHECK

Before creating a new referral, Joy should check for likely duplicate records using:

- Name
- Phone
- Email
- DOB when available
- Responsible party/contact

If a possible duplicate exists:

> **Possible existing client/referral found.**

Show the likely match.

Actions:

- Open Existing Record
- Continue as New

Do not silently merge records.

---

# 11. PHONE INTAKE — PURPOSE

Phone Intake should be fast enough to complete during a real conversation.

It is **not** the comprehensive assessment.

Its purpose is to:

1. Understand why the person is calling.
2. Determine whether Joy Health may be a reasonable fit.
3. Capture enough information to schedule the assessment.
4. Identify obvious safety/urgency/payment/scheduling issues.
5. Avoid making the family repeat basic information later.

The phone intake should progressively build the client profile.

---

# 12. PHONE INTAKE UI

Do not present a giant 60-field form.

Use a focused, section-based intake workspace.

Recommended sections:

```text
1. Who needs care?
2. Why are you calling?
3. What help is needed?
4. Schedule & start date
5. Home / safety basics
6. Payment / responsible party
7. Assessment scheduling
```

Autosave continuously.

Show completion quietly:

> **5 of 7 sections complete**

Do not use a giant progress bar.

---

# 13. PHONE INTAKE — CLIENT INFORMATION

Capture:

- Legal name
- Preferred name
- DOB
- Address
- City
- State
- ZIP
- Phone
- Email
- Preferred language where relevant
- Best contact method

If caller is not client:

## Caller / Responsible Party

- Name
- Relationship
- Phone
- Email
- Is this person responsible for payment?
- Is this person authorized to coordinate care?

---

# 14. PHONE INTAKE — EMERGENCY CONTACTS

Capture at least:

### Primary Emergency Contact
- Name
- Relationship
- Phone
- Alternate phone

### Secondary Emergency Contact
- Name
- Relationship
- Phone
- Alternate phone

These should flow into the future Client Profile.

---

# 15. PHONE INTAKE — REASON FOR CARE

Capture conversationally:

- Primary reason care is needed
- Recent change that prompted inquiry
- Fall
- Hospitalization
- Surgery
- Decline
- New diagnosis
- Caregiver/family burnout
- Increased supervision need
- Other

Allow a free-text summary.

Joy AI may turn the conversation into a structured draft.

Human reviews before saving clinically meaningful interpretations.

---

# 16. PHONE INTAKE — SERVICES REQUESTED

The existing Joy intake materials include service categories such as:

- Companionship
- Personal Care
- Meal Preparation
- Light Housekeeping
- Daily Check-ins
- Medication Reminders
- Transportation
- Shopping / errands
- Mobility / transfers
- Respite
- Other

Allow multiple selections.

Do not make the intake coordinator decide the final care plan here.

This is the **requested service**, not the final RN recommendation.

---

# 17. PHONE INTAKE — BASIC FUNCTIONAL NEEDS

Capture enough for assessment planning:

- Bathing help
- Dressing help
- Toileting help
- Feeding help
- Mobility assistance
- Transfer assistance
- Continence concerns
- Walker
- Wheelchair
- Bedbound
- Supervision
- Memory/cognitive concerns
- Fall risk
- Transportation need

Use simple choices and optional notes.

Do not make this feel like a hospital EHR.

---

# 18. PHONE INTAKE — MEDICAL / CARE BASICS

Basic information may include:

- Diagnoses / conditions
- Allergies
- Mobility/equipment
- Medications known at intake
- Recent hospitalization
- Recent fall
- Special precautions
- Physician/provider information if available

If information is unknown:

**Unknown / Will provide at assessment**

should be a valid state.

Do not force staff to invent answers.

---

# 19. PHONE INTAKE — SCHEDULE

Capture:

- Requested start date
- Estimated hours/week
- Days needed
- Preferred times
- Overnight need
- Weekend need
- Frequency
- Flexibility
- Any immediate coverage need

This information should flow directly into:

- Assessment planning
- Care recommendations
- Start-of-care setup
- Scheduling

Do not re-enter it later.

---

# 20. PHONE INTAKE — PAYMENT

Capture only what is needed for the next operational step.

Potential fields:

- Source of payment
- Private pay / other configured payer
- Responsible party
- Billing contact
- Basic rate discussion status
- Payment questions/notes

Do not force the full payment workflow into the phone intake.

Payment setup belongs later in Pre-Onboarding once care is approved.

---

# 21. PHONE INTAKE COMPLETION

When the intake is complete, Joy should summarize:

```text
Marcus Bell

Phone intake complete.

Needs:
• Personal care
• 20–25 hrs/week
• Morning assistance
• Fall-risk assessment
• Daughter coordinates care

Recommended next step:
Schedule in-home assessment

[Schedule Assessment]
```

AI may prepare this summary.

Human confirms the next step.

---

# 22. NOT A FIT / CLOSED REFERRAL

Not every referral becomes an assessment.

Allow:

- Not a service fit
- Outside service area
- Unable to meet requested schedule
- Payer/financial mismatch
- Family declined
- Unable to reach
- Duplicate
- Other

Require an internal close reason.

Do not delete the referral.

Retain appropriate history.

---

# 23. ASSESSMENT SCHEDULING

Assessment scheduling is a major workflow.

The office should be able to schedule an assessment from:

- Admissions
- Quick Add
- Client/prospect drawer
- Home Quick Add
- Joy AI

The scheduling form should include:

- Client
- Assessment type
- RN / assessor
- Date
- Start time
- Expected duration
- Address
- Contact person
- Phone
- Email
- Notes / access instructions
- Documents/items needed before assessment
- Confirmation method

**Email must be included in assessment scheduling.**

---

# 24. ASSESSMENT CALENDAR INTEGRATION

Assessments should appear on the central Joy schedule/calendar.

Assessment events should display:

- Time
- Client
- Assessment type
- RN/assessor
- Address
- Status

Example:

```text
10:30 AM
Marcus Bell · Initial Assessment
Joan Robinson, RN
3704 Harmon Ave
```

Do not create a completely separate calendar engine just for Admissions.

Use the Joy scheduling system.

---

# 25. ASSESSMENT COMMUNICATION

Confirmed assessment scheduling should generate the appropriate communication workflow.

The current Joy architecture uses:

**Spruce for messaging.**

Use Spruce for client/family assessment communication where configured.

Assessment communication may include:

- Confirmation
- Date/time
- Address confirmation
- RN/assessor name if appropriate
- What to have available
- Reminder
- Reschedule instructions

If email is being used, assessment scheduling must retain the email address and communication status.

The UI should show:

```text
Assessment confirmed

✓ Client/family notification sent
✓ RN assigned
✓ Calendar event created
```

If a notification fails:

```text
Assessment scheduled
! Client notification failed

[Retry]
```

Do not roll back the assessment because a message failed.

---

# 26. PRE-ASSESSMENT DOCUMENT REQUEST

Joy should be able to request missing information before the RN arrives.

Example:

> **Marcus Bell's intake is missing a medication list. Joy can request it before the 10:30 assessment.**

Possible requested items:

- Medication list
- Physician list
- Insurance/payer information where applicable
- Advance directive information
- Relevant discharge paperwork
- Other care-related documents

Do not require every item before the assessment unless the business rule specifically requires it.

---

# 27. ASSESSMENT STATUS

Possible statuses:

- Not Scheduled
- Scheduled
- Confirmed
- Needs Reschedule
- Cancelled
- No-Show
- In Progress
- Draft
- Needs Review
- Completed

Keep the visible status language simple.

---

# 28. ASSESSMENT WORKSPACE — CORE DESIGN

This is the largest sub-workflow in Admissions.

Do not design it as one endless form.

Use a calm **section-by-section assessment workspace**.

Recommended desktop layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Marcus Bell                     Initial Assessment          │
│ Autosaved 10:42 AM                         Exit / Save      │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                          │
│ Assessment       │ CURRENT SECTION                          │
│                  │                                          │
│ ✓ Client         │ Functional Assessment                    │
│ ✓ Reason for Care│                                          │
│ • Function       │ [focused questions / fields]             │
│ ○ Cognition      │                                          │
│ ○ Safety         │                                          │
│ ○ Medications    │                                          │
│ ○ Services       │                                          │
│ ○ Schedule       │                                          │
│ ○ Recommendations│                                         │
│ ○ Review         │                                          │
│                  │                                          │
├──────────────────┴──────────────────────────────────────────┤
│ Ask Joy / Voice note / Add photo                            │
└─────────────────────────────────────────────────────────────┘
```

The user sees **one section at a time**.

---

# 29. ASSESSMENT INPUT MODES

The Product Bible explicitly establishes three input methods:

## Manual Entry
Traditional form input.

## Voice
RN can dictate findings naturally.

Joy converts speech into a structured draft.

## Photo
Where appropriate, RN can attach a photo to support documentation.

Photos must not silently become clinical conclusions.

AI may extract/organize information for human review.

---

# 30. ASSESSMENT AI BEHAVIOR

Joy should act like an assessment copilot.

Examples:

> “You mentioned a walker and two falls this month. I added those to Mobility and Fall Risk. Please review.”

> “The medication list was discussed but dosage is missing for one medication.”

> “You selected transportation assistance during intake. Would you like to confirm that need?”

Joy may:

- Draft structured answers
- Carry forward phone-intake information
- Identify missing sections
- Identify inconsistent entries
- Summarize
- Suggest follow-up questions
- Prepare the care recommendation

Joy may **not**:

- Diagnose
- Determine medical necessity autonomously
- Approve admission
- Generate a final clinical conclusion without RN review
- Silently overwrite RN documentation

---

# 31. CONFIDENCE / REVIEW MODEL

The Product Bible calls for section-by-section confidence scoring.

Do not turn this into a scary AI percentage dashboard.

Use confidence internally to identify what requires review.

Example:

```text
Needs Review

Medication dosage missing
Mobility answer conflicts with intake
Emergency contact phone not verified
```

If a confidence indicator is shown, keep it subtle.

The user should understand **what needs review**, not interpret an AI model score.

---

# 32. AUTOSAVE / OFFLINE RECOVERY

Assessment must autosave.

Display a quiet state:

> Saved just now

or

> Saving...

If connection is lost:

> **You're offline. Your assessment is saved on this device and will sync when connection returns.**

When restored:

> **Synced successfully.**

Never allow an RN to lose a long assessment because connectivity drops in a client's home.

---

# 33. ASSESSMENT — CLIENT / CONTACT SECTION

Reuse existing data from phone intake.

Show existing values and allow correction.

Fields:

- Client name
- DOB
- Address
- Phone
- Email
- Primary language
- Responsible party
- Emergency contacts
- Assessment date
- Assessor

Do not ask the RN to retype known demographics.

---

# 34. ASSESSMENT — REASON FOR CARE

Include:

- Primary diagnosis/condition when known
- Source of payment
- Primary reason care is needed
- Recent change
- Fall
- Hospital
- Surgery
- Decline
- New diagnosis
- Explanation

The existing one-page Joy nursing assessment contains these concepts.

---

# 35. ASSESSMENT — LIVING SITUATION & HOME SAFETY

Capture:

- Lives alone
- Spouse
- Family
- Assisted living
- Other
- Stairs
- Clutter
- Pets
- Limited support
- Fall hazards
- Bathroom safety
- Lighting
- Access concerns
- Equipment
- Emergency/evacuation considerations
- Other home concerns

The assessment should support notes.

---

# 36. ASSESSMENT — FUNCTIONAL STATUS

The existing Joy nursing assessment evaluates:

- Bathing
- Dressing
- Toileting
- Feeding
- Mobility
- Transfers
- Continence

Use consistent levels such as:

- Independent
- Supervision
- Assistance
- Dependent

Capture equipment where relevant:

- Walker
- Wheelchair
- Bedbound
- Bedside commode
- Briefs
- Other

---

# 37. ASSESSMENT — COGNITIVE / BEHAVIORAL / RISK

Capture as applicable:

- Alert/oriented
- Forgetful
- Confused
- Dementia/Alzheimer's
- Sundowning
- Wandering risk
- Anxiety/agitation
- High fall risk
- Skin breakdown risk
- Supervision needs
- Other risk concerns

Do not make AI infer diagnoses from behavior.

---

# 38. ASSESSMENT — MEDICATIONS

Capture:

- Medication name
- Dose
- Frequency
- Purpose if known/appropriate
- Source
- Medication reminder need
- Medication management limitations/notes
- Allergies

Allow:

- Manual entry
- Upload medication list
- Photo capture where appropriate
- Voice dictation

AI may draft medication entries from supplied information but RN must review.

---

# 39. ASSESSMENT — PHYSICIANS / PROVIDERS

Capture:

- Primary physician/provider
- Specialty providers
- Practice
- Phone
- Fax where needed
- Address
- Relevant orders/referrals when applicable

This information should flow into the permanent client record.

---

# 40. ASSESSMENT — SERVICES NEEDED

The existing Joy assessment includes:

- Bathing
- Dressing
- Toileting
- Meals
- Medication reminders
- Light housekeeping
- Laundry
- Companionship
- Transportation
- Shopping/errands
- Mobility/transfers
- Respite

Allow RN to select and add notes.

This section should become a building block for the Plan of Care.

---

# 41. ASSESSMENT — SCHEDULE RECOMMENDATION

Capture:

- Recommended start date
- Recommended days
- Recommended times
- Hours/week
- Visit duration
- Frequency
- Overnight/weekend need
- Flexibility
- Caregiver level
- Special matching considerations

Caregiver level examples from the existing Joy assessment:

- Companion
- Personal Care
- CNA preferred
- Higher-acuity caregiver

---

# 42. ASSESSMENT — SPECIAL PRECAUTIONS

Capture:

- Falls
- Skin
- Diet
- Infection control
- Transport
- Mobility
- Cognitive/supervision
- Other

These should flow into:

- Care plan
- Scheduling/matching
- Caregiver-facing instructions where appropriate
- Client profile

Do not require duplicate entry.

---

# 43. ASSESSMENT — EMERGENCY PRIORITY / LEVEL OF CARE

Joy's emergency-preparedness material establishes a client emergency priority classification during intake and reassessment:

- **Level 1 — High Priority**
- **Level 2 — Moderate Priority**
- **Level 3 — Low Priority**

This classification helps prioritize emergency contact, caregiver reassignment, family notification, and escalation.

The assessment should include or support the appropriate emergency-priority classification workflow.

Do not use bright permanent red/yellow/green client cards.

Keep the classification accessible in the client record and emergency workflows.

---

# 44. ASSESSMENT — EDUCATION PROVIDED

The existing nursing assessment includes education such as:

- Fall prevention
- Emergency procedures
- Infection control
- Medication reminder limits
- Home safety
- Care plan review
- Other

Capture what was provided.

Allow RN notes.

---

# 45. ASSESSMENT — RN RECOMMENDATIONS

At the end of the assessment, show a clean review page.

Example:

```text
Assessment Summary

Marcus Bell

Care recommendation
Personal Care

Recommended schedule
Mon–Fri
8:00 AM–12:00 PM
20 hrs/week

Caregiver level
Personal Care / CNA preferred

Key needs
• Bathing assistance
• Transfers
• Meal preparation
• Medication reminders
• Fall precautions

Open items
• Medication dosage missing
• Daughter needs to confirm Friday hours

[Return to Section]     [Complete Assessment]
```

RN reviews and signs/completes.

AI may draft the summary.

Human approves.

---

# 46. ASSESSMENT SIGNATURE

Where the comprehensive assessment requires RN completion/signature, provide:

- RN name
- Credentials
- Signature
- Date/time
- Completion status

Do not mark the assessment complete without the required human sign-off.

---

# 47. ASSESSMENT COMPLETE → DECISION

After completion, Joy should surface the next operational decision.

Example:

```text
Assessment complete.

Joy prepared the admission summary.

No unresolved assessment sections.

Next:
Review for admission

[Review Admission]
```

Human makes the admission decision.

---

# 48. ADMISSION DECISION

Possible outcomes:

## Move Forward
Continue to Pre-Onboarding.

## Need More Information
Keep in Assessment/Waiting and create the specific missing item.

## Not Accepted / Unable to Serve
Close with reason.

Do not let AI autonomously admit or decline a client.

---

# 49. PRE-ONBOARDING — PURPOSE

Pre-Onboarding is where an approved prospective client becomes **administratively ready to start care**.

This stage should not feel like another giant packet.

Joy should present a **readiness checklist**.

---

# 50. REQUIRED NEW CLIENT FOLDER / READINESS ITEMS

Existing Joy Health policy materials identify the following new-client folder items:

1. Initial phone intake form
2. Comprehensive Assessment — RN completed/signed
3. Service Agreement / Contract
4. Service Plan / Care Plan / Plan of Care
5. Emergency Contact Form
6. Client Rights & Responsibilities
7. Medication Log
8. Advance Directive Identifier
9. Physician List
10. Supervisory Visit requirement as applicable
11. Responsible Party information when someone other than the client is paying
12. Other required client-specific documents

The system should track these as structured readiness items.

Do not display all of them as giant cards.

---

# 51. PRE-ONBOARDING UI

Example:

```text
Marcus Bell
Pre-Onboarding

Ready: 7 of 10 required items

JOY NEEDS YOU

Service Agreement
Ready for client signature

[Send for Signature]

--------------------------------

WAITING

Medication list
Waiting on family

Payment method
Waiting on responsible party

--------------------------------

COMPLETE

✓ Phone Intake
✓ RN Assessment
✓ Emergency Contacts
✓ Client Rights
✓ Physician List
```

The emphasis is the **next missing action**, not the number of documents.

---

# 52. SERVICE AGREEMENT / CONTRACT

The service agreement should be generated/populated from information already captured where possible.

Reuse:

- Client name
- Responsible party
- Address
- Services
- Rate
- Schedule
- Billing information
- Start date

Allow staff to review before sending.

Track:

- Draft
- Ready for Review
- Sent
- Viewed where available
- Signed
- Needs Correction

Do not make the office manually retype client demographics.

---

# 53. PLAN OF CARE / SERVICE PLAN

The Plan of Care should be drafted from the RN assessment.

Joy may prepare:

- Services
- Tasks
- Schedule
- Frequency
- Safety precautions
- Mobility needs
- Transportation needs
- Caregiver level
- Relevant preferences
- Other care instructions

RN/authorized human reviews and approves.

AI does not independently create the final clinical plan.

---

# 54. CLIENT RIGHTS & RESPONSIBILITIES

Track:

- Provided
- Acknowledged
- Signed/received if required
- Date
- Method

Keep the actual document available in the client record.

---

# 55. EMERGENCY CONTACT FORM

Pre-populate from intake.

Allow confirmation/correction.

Do not ask the family to enter the same emergency contacts again unless they need to verify/update them.

---

# 56. ADVANCE DIRECTIVE IDENTIFIER

Capture the required status/identifier based on Joy's form/process.

Possible UI state:

```text
Advance Directive
Status: Not provided
[Update]
```

Do not invent legal conclusions.

---

# 57. PHYSICIAN LIST

Reuse providers captured during intake/assessment.

Allow confirmation.

Track completeness.

---

# 58. MEDICATION LOG

Reuse medication information from assessment.

Allow review/correction.

Do not make staff re-enter the medication list into a separate disconnected form.

---

# 59. RESPONSIBLE PARTY / BILLING CONTACT

If someone other than the client is responsible for payment, track:

- Name
- Relationship
- Address
- Phone
- Email
- Billing contact preference
- Payment responsibility status

Reuse intake information.

---

# 60. PAYMENT SETUP

The Product Bible establishes Tap to Pay with a payment fallback ladder as an approved Phase 1 principle.

For design purposes, Pre-Onboarding should include a clear **Payment Setup** readiness item.

Possible states:

- Not Started
- Payment Method Needed
- Ready
- Complete
- Needs Attention

Do not turn Admissions into the Billing page.

The purpose is only to answer:

> **Can this client begin service without an unresolved payment setup issue?**

---

# 61. CLIENT / FAMILY PORTAL

The client/family should be able to see a simplified admissions status rather than repeatedly calling the office.

Example:

```text
Your Joy Health Care Setup

✓ Phone Intake Complete
✓ Assessment Complete
• Service Agreement — Signature Needed
• Care Plan — In Review
○ Start of Care

Next step:
Please review and sign your Service Agreement.

[Review Document]
```

Do not expose:

- Internal staff notes
- AI confidence
- Internal admission deliberations
- Sensitive operational comments
- Staff-only risk flags
- Internal pricing discussions not intended for client view

---

# 62. DOCUMENT UPLOAD EXPERIENCE

Family/client upload should be simple.

Examples:

- Medication list
- Insurance/payer document where applicable
- Physician paperwork
- Advance directive
- Other requested document

Show:

```text
Medication List

[Upload File] [Take Photo]

PDF, JPG, PNG
```

After upload:

> **Received — waiting for Joy Health review**

Do not imply approval merely because a file was uploaded.

---

# 63. READY FOR ADMISSION

A client reaches **Ready for Admission** when the required admission/readiness items are complete enough for the agency to proceed.

The screen should summarize:

```text
Marcus Bell
Ready for Admission

✓ Phone Intake
✓ RN Assessment
✓ Service Agreement
✓ Plan of Care
✓ Emergency Contacts
✓ Client Rights
✓ Physician Information
✓ Payment Setup

Start-of-care target:
Monday, Aug 17

Care requested:
Mon–Fri · 8 AM–12 PM

[Prepare Start of Care]
```

Human confirms readiness.

---

# 64. READY DOES NOT MEAN SCHEDULED

Important distinction:

**Ready for Admission** means the administrative/clinical admission process is ready.

It does not necessarily mean:

- Caregiver assigned
- First shift scheduled
- Start of care operationally covered

Those belong in the transition into **Care Setup / Scheduling / Operations**.

---

# 65. ADMISSIONS → OPERATIONS HANDOFF

Once admitted, Joy should pass the structured information forward.

## To People → Client Profile
- Demographics
- Contacts
- Responsible party
- Physicians
- Diagnoses/conditions
- Allergies
- Medications
- Documents
- Assessment
- Care plan
- Emergency priority
- Payment/billing setup status
- Admission history

## To Scheduling
- Start date
- Days/times
- Hours
- Visit frequency
- Caregiver level
- Matching needs
- Special precautions
- Transportation need
- Preferences

## To Operations / Care Setup
- Start-of-care readiness
- Caregiver assignment status
- First visit readiness
- Outstanding operational items

No duplicate data entry.

---

# 66. START-OF-CARE SETUP

After Ready for Admission:

```text
Ready for Admission
        ↓
Prepare Start of Care
        ↓
Create Schedule
        ↓
JoyMatch / Caregiver Assignment
        ↓
Confirm Client/Family
        ↓
First Visit
        ↓
Active Client
```

The exact staffing/scheduling work should happen in Scheduling/Operations, not be duplicated inside Admissions.

Admissions should show the handoff status.

---

# 67. ACTIVE CLIENT CONVERSION

Once admission/start-of-care is confirmed:

Status:

**Admitted / Active**

The existing admissions record becomes the client's permanent record.

Do not create another client profile.

The Admissions workspace may keep the record available under:

**Admitted**

for history/audit purposes.

---

# 68. CLIENT DETAIL DRAWER — DEFAULT INTERACTION

From the Admissions list, clicking a person should open a right-side drawer.

Top:

```text
Marcus Bell
Personal Care

ASSESSMENT

Joy needs:
Medication list before today's assessment.

[Request Medication List]
```

Then collapsed sections:

- Overview
- Intake
- Assessment
- Documents
- Care Plan
- Payment
- Communications
- Activity
- Notes

The top of the drawer should always answer:

> **What needs to happen next?**

---

# 69. FULL RECORD VS DRAWER

Routine work should happen in the drawer.

Use a full-page workspace only for:

- Phone Intake
- Comprehensive Assessment
- Complex document review
- Plan of Care editing

Do not navigate away for simple status changes or document requests.

---

# 70. COMMUNICATION OWNERSHIP

The established Joy architecture uses:

**Spruce → Messaging**

Joy should trigger communication events.

Spruce should deliver client/family messages.

Examples:

- Intake follow-up
- Assessment confirmation
- Assessment reminder
- Missing document request
- Service Agreement signature reminder
- Start-of-care confirmation
- Schedule communication after admission

Joy remains the source of truth for workflow status.

Spruce remains the communication channel.

---

# 71. MESSAGE HISTORY

The Admissions drawer should show a lightweight communication history:

```text
Today · 9:14 AM
Assessment reminder sent

Yesterday · 3:42 PM
Medication list requested

Aug 10 · 11:05 AM
Assessment scheduled
```

Do not rebuild the entire Spruce inbox inside Admissions V1.

Allow:

**Open in Spruce**

where technically appropriate.

---

# 72. COMMUNICATION FAILURE

If a message fails:

```text
Assessment scheduled

! Confirmation was not sent

[Retry]
```

The workflow event and communication event are separate.

Do not undo the assessment because the notification failed.

---

# 73. TASKS

Joy should automatically create operational tasks when the workflow requires them.

Examples:

- Call new referral
- Complete phone intake
- Schedule assessment
- Review assessment
- Request medication list
- Send Service Agreement
- Review signed agreement
- Complete Plan of Care
- Confirm payment setup
- Prepare start of care

Tasks should appear where appropriate on:

- Admissions
- Home / My Tasks
- Assigned user's task list

Do not make staff manually create routine workflow tasks.

---

# 74. WAITING STATES

Admissions has many external dependencies.

Make them explicit.

Examples:

```text
Waiting on Family
Medication list

Waiting on RN
Assessment signature

Waiting on Client
Service Agreement

Waiting on Payment
Card / ACH setup

Waiting on Scheduling
Start-of-care coverage
```

This is important because it prevents staff from repeatedly opening records to determine why something has stopped.

---

# 75. AGING / STALLED ADMISSIONS

Joy should quietly identify records that have stopped moving.

Example:

> **Susan Miller has been waiting on a signed Service Agreement for 4 days.**

Actions:

- Send Reminder
- Call
- Add Note
- Close Admission

Do not create a giant "aging report" on the main screen.

Surface only meaningful stalled records.

---

# 76. JOY AI — ADMISSIONS

Keep Talk to Joy available but not visually dominant.

Useful prompts:

- Who needs me today?
- Which assessments are today?
- Who is missing documents before assessment?
- Which families have not signed their Service Agreement?
- Who is ready for admission?
- What is holding up Marcus Bell?
- Summarize today's assessments.
- Prepare the next step for Susan Miller.
- Which admissions have been stalled for more than 3 days?
- Show clients ready for scheduling.

Joy can:

- Summarize
- Draft
- Identify missing information
- Prepare messages
- Prepare tasks
- Prepare assessment sections
- Prepare care-plan content
- Propose workflow moves

Human approves consequential actions.

---

# 77. AI ACTION REVIEW

Example:

User:

> “Get Marcus ready for his assessment.”

Joy:

```text
Marcus Bell
Assessment today · 10:30 AM

I found one missing item:
Medication list

I prepared a message to his daughter requesting it before the visit.

[Review Message] [Send]
```

This is the type of AI assistance Joy should prioritize.

Not a giant chatbot panel.

---

# 78. ADMISSIONS SEARCH

Search should support:

- Client/prospect name
- Responsible party
- Phone
- Email
- Address
- Referral source
- Assessor
- Admission status

Placeholder:

> Search admissions...

---

# 79. ADMISSIONS FILTERS

Keep filters compact.

Potential filters:

- Stage
- Assigned staff
- Assessment date
- Assessor/RN
- Referral source
- Service type
- Waiting on
- Ready
- Stalled
- Closed

Use a popover/drawer.

Do not permanently occupy screen width with a filter sidebar.

---

# 80. CLOSED / LOST REFERRALS

Retain records for history.

Possible close reasons:

- Family declined
- Unable to reach
- Not a service fit
- Outside service area
- Schedule unavailable
- Financial/payer issue
- Chose another provider
- Duplicate
- Other

Closed records should not clutter the active admissions workspace.

---

# 81. ACTIVITY TIMELINE

Every admission should maintain a quiet activity timeline.

Examples:

- Referral created
- Phone intake started
- Intake completed
- Assessment scheduled
- Reminder sent
- Assessment completed
- Document requested
- Document uploaded
- Service Agreement sent
- Service Agreement signed
- Plan of Care approved
- Payment setup completed
- Ready for Admission
- Start-of-care handoff created
- Admitted

Show user/date/time.

Keep this collapsed by default.

---

# 82. AUDIT TRAIL

For consequential actions track:

- User
- Action
- Date/time
- Previous value
- New value
- AI-assisted? Yes/No
- Human approver when applicable
- Communication status
- Signature/completion state

Assessment edits and signatures require appropriate traceability.

---

# 83. PERMISSIONS

Suggested roles:

## CEO / Administrator
Full admissions access.

## RN / Clinical Supervisor
Assessment, care-plan, clinical review, admission-related clinical sections.

## Intake / Office Coordinator
Referral, phone intake, scheduling, documents, communication, administrative onboarding.

## Scheduler
View admission details needed to prepare start of care.

## Client / Responsible Party
Only their authorized portal/status/document/signature experience.

Do not expose clinical/internal information merely because someone can schedule.

---

# 84. PRIVACY / SECURITY UX

Because Admissions contains sensitive health/client information:

- Role-based access
- Session/security controls
- Audit logging
- Minimum necessary visibility
- Secure file handling
- No sensitive data in unnecessary dashboard previews
- Client/family portal shows only authorized information

Do not place detailed diagnoses or medication lists on the main Admissions queue.

---

# 85. MAIN ADMISSIONS SCREEN — WIREFRAME

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Admissions                                                                  │
│ Move new clients from referral to ready-for-care without losing a step.     │
│                                         Search   Filter   List/Board   +     │
├──────────────────────────────────────────────────────────────────────────────┤
│ All 12   Referrals 3   Intake 2   Assessment 4   Pre-Onboarding 2   Ready 1│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ NEEDS YOU · 3                                                               │
│                                                                              │
│ Marcus Bell                                                                 │
│ Assessment · Today 10:30 AM                                                 │
│ Medication list missing                              Open Assessment →       │
│ ───────────────────────────────────────────────────────────────────────────  │
│ Susan Miller                                                                │
│ Pre-Onboarding                                                              │
│ Service Agreement ready for review                    Review →               │
│ ───────────────────────────────────────────────────────────────────────────  │
│ John Williams                                                               │
│ Phone Intake                                                                │
│ Intake incomplete                                    Continue →             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WAITING · 2                                                                 │
│                                                                              │
│ Margaret Davis        Assessment       Waiting on medication list            │
│ Evelyn Carter         Pre-Onboarding   Waiting on family signature           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ MOVING FORWARD · 3                                                          │
│                                                                              │
│ Lian Huang            Assessment Fri 2:00 PM                                │
│ Robert Green          Ready · Start of care Monday                          │
│ Angela Thomas         Assessment complete · Pre-onboarding prepared         │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Talk to Joy: "Who is ready for admission?"                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 86. CLIENT DRAWER WIREFRAME

```text
┌───────────────────────────────────────┐
│ Marcus Bell                       ×   │
│ Personal Care                        │
│                                       │
│ ASSESSMENT                            │
│ Today · 10:30 AM                      │
│ Joan Robinson, RN                     │
│                                       │
│ JOY NEEDS                             │
│ Medication list before assessment     │
│                                       │
│ [Request Medication List]             │
│                                       │
│ ───────────────────────────────────   │
│                                       │
│ Progress                              │
│ ✓ Referral                            │
│ ✓ Phone Intake                        │
│ • Assessment                          │
│ ○ Pre-Onboarding                      │
│ ○ Ready                               │
│                                       │
│ Intake                            >    │
│ Assessment                        >    │
│ Documents                         >    │
│ Care Plan                         >    │
│ Payment                           >    │
│ Communications                    >    │
│ Activity                          >    │
│ Notes                             >    │
└───────────────────────────────────────┘
```

---

# 87. PHONE INTAKE WIREFRAME

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Marcus Bell · Phone Intake                         Saved just now    │
├──────────────────┬───────────────────────────────────────────────────┤
│ ✓ Client         │ WHY ARE YOU CALLING?                              │
│ ✓ Contact        │                                                   │
│ • Care Needs     │ Primary reason care is needed                     │
│ ○ Schedule       │ [                                                ]│
│ ○ Safety         │                                                   │
│ ○ Payment        │ Recent change                                     │
│ ○ Assessment     │ □ Fall  □ Hospital  □ Surgery  □ Decline          │
│                  │ □ New diagnosis  □ Other                          │
│                  │                                                   │
│                  │ [Back]                         [Continue →]        │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

# 88. ASSESSMENT WIREFRAME

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Marcus Bell · Initial Assessment                  Saved just now     │
│ Joan Robinson, RN                                                   │
├──────────────────┬───────────────────────────────────────────────────┤
│ ✓ Client         │ FUNCTIONAL ASSESSMENT                             │
│ ✓ Reason         │                                                   │
│ • Function       │ Bathing                                           │
│ ○ Cognition      │ ○ Independent ○ Supervision ○ Assist ○ Dependent │
│ ○ Safety         │                                                   │
│ ○ Medications    │ Mobility                                          │
│ ○ Services       │ ○ Independent ○ Walker ○ Wheelchair ○ Bedbound   │
│ ○ Schedule       │                                                   │
│ ○ Recommendations│ Transfers                                        │
│ ○ Review         │ ○ Independent ○ Supervision ○ Assist ○ Dependent │
│                  │                                                   │
│                  │ Notes                                             │
│                  │ [                                                ]│
│                  │                                                   │
│                  │ [Back]                         [Continue →]        │
├──────────────────┴───────────────────────────────────────────────────┤
│ 🎙 Dictate        📷 Add Photo        ✨ Ask Joy                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 89. PRE-ONBOARDING WIREFRAME

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Marcus Bell · Pre-Onboarding                                        │
│ 7 of 10 required items ready                                        │
├──────────────────────────────────────────────────────────────────────┤
│ JOY NEEDS YOU                                                       │
│                                                                      │
│ Service Agreement                                                   │
│ Ready for review and signature                                      │
│                                                [Review & Send →]     │
├──────────────────────────────────────────────────────────────────────┤
│ WAITING                                                             │
│                                                                      │
│ Medication List               Waiting on family                     │
│ Payment Setup                 Waiting on responsible party          │
├──────────────────────────────────────────────────────────────────────┤
│ COMPLETE                                                            │
│                                                                      │
│ ✓ Phone Intake                                                     │
│ ✓ RN Assessment                                                    │
│ ✓ Emergency Contacts                                               │
│ ✓ Client Rights                                                    │
│ ✓ Physician List                                                   │
│                                                                      │
│                                               [View All Items →]     │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 90. READY FOR ADMISSION WIREFRAME

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Marcus Bell                                                         │
│                                                                      │
│ ✓ READY FOR ADMISSION                                               │
│                                                                      │
│ All required admission items are complete.                          │
│                                                                      │
│ Start-of-care target                                                │
│ Monday, Aug 17                                                      │
│                                                                      │
│ Requested care                                                      │
│ Mon–Fri · 8:00 AM–12:00 PM                                         │
│ Personal Care · 20 hrs/week                                        │
│                                                                      │
│ Caregiver level                                                     │
│ Personal Care / CNA preferred                                       │
│                                                                      │
│ [View Admission Summary]          [Prepare Start of Care →]          │
└──────────────────────────────────────────────────────────────────────┘
```

---

# 91. VISUAL DESIGN DIRECTION

The Admissions module must match the clean Joy design language.

## Use

- Warm white / very light neutral background
- White content surfaces
- Dark charcoal text
- Joy Royal Blue `#1407A2` sparingly
- Very subtle borders
- Minimal shadows
- Generous whitespace
- Rounded corners
- Strong typography
- Calm spacing
- Small status indicators
- One primary action per context

## Avoid

- Blue page backgrounds
- Purple gradients
- Rainbow pipeline stages
- Giant KPI cards
- Dense CRM tables
- Salesforce/HubSpot visual density
- Clinical EHR appearance
- Too many pills/badges
- Progress bars everywhere
- Multiple competing CTAs
- Giant AI panels
- Charts on the Admissions home
- Showing every document at once
- Showing diagnoses/medications on the main queue
- Forcing full-page navigation for simple actions

---

# 92. BLUE BUDGET

Joy Royal Blue:

`#1407A2`

Use only for:

- Active navigation
- Selected view/filter
- Primary action
- Important links
- Small focal accents

Most secondary actions:

- White
- Soft gray
- Text-only
- Subtle outline

Urgent warning colors only when there is a true actionable problem.

---

# 93. MOBILE / TABLET

## Desktop
Primary office/RN experience.

## Tablet
Assessment must work extremely well on tablet because an RN may use it in the home.

- Large touch targets
- Section navigation collapsible
- Voice easy to access
- Camera easy to access
- Autosave visible
- No hover-only controls

## Mobile
Use:
- Work queue
- Client drawer as full-screen sheet
- Phone Intake
- Assessment section-by-section
- Upload/photo
- Voice dictation
- Simple task actions

Do not shrink a desktop CRM table onto mobile.

---

# 94. V1 BUILD BOUNDARY

## Build in V1

- Admissions work queue
- List + simple Kanban view
- Referral creation
- Duplicate warning
- Phone Intake
- Assessment scheduling
- Email field in assessment scheduling
- Assessment events on Joy schedule
- Spruce-triggered client/family communication
- Pre-assessment document requests
- Comprehensive assessment
- Manual / voice / photo assessment input
- Autosave
- Offline recovery/resume
- Assessment review
- RN completion/signature
- Admission decision
- Pre-Onboarding readiness
- New-client document checklist
- Service Agreement status
- Care Plan status
- Emergency contacts
- Client Rights status
- Medication information
- Advance Directive status
- Physician list
- Responsible party
- Payment setup status
- Ready for Admission
- Start-of-care handoff
- Client portal/status view
- Tasks
- Waiting states
- Activity timeline
- Audit history
- Joy AI assistance
- Role-based access

## Do Not Overbuild V1

- Full hospital-style EHR
- Autonomous clinical decision-making
- Autonomous admission approval
- Giant CRM automation builder
- Full Spruce inbox clone
- Complex referral-source analytics
- Sales forecasting dashboards
- Excessive admission KPIs
- Separate duplicate client database
- Separate assessment calendar engine
- Separate document systems for intake/assessment/client profile
- Multiple competing client portals

---

# 95. CORE DATA REUSE MAP

```text
REFERRAL
Name / Phone / Email / Source
        ↓
PHONE INTAKE
Demographics / Contacts / Needs / Schedule / Payment basics
        ↓
ASSESSMENT
Clinical + functional + safety + care recommendations
        ↓
PRE-ONBOARDING
Agreement / Care Plan / Rights / Payment / Documents
        ↓
READY
Validated admission package
        ↓
CLIENT PROFILE
All approved information reused
        ↓
SCHEDULING / OPERATIONS / BILLING
Only the data each module needs
```

This is the **Enter Once, Reuse Everywhere** principle.

---

# 96. SIMPLE EVENT MODEL

Recommended workflow events may include:

```text
referral.created
intake.started
intake.completed
assessment.scheduled
assessment.rescheduled
assessment.cancelled
assessment.started
assessment.completed
document.requested
document.received
agreement.sent
agreement.signed
care_plan.prepared
care_plan.approved
payment_setup.completed
admission.ready
admission.approved
start_of_care.prepared
client.activated
```

These events may trigger:

- UI status update
- Task creation
- Spruce communication
- Notification
- Audit log
- AI suggestion
- Scheduling handoff

Do not hard-code communication separately into every screen.

---

# 97. GRACEFUL FAILURE

Critical workflows must fail safely.

## Assessment saved, Spruce failed

```text
Assessment scheduled successfully.

! Confirmation message failed.

[Retry Message]
```

## Offline assessment

```text
You're offline.
Your work is saved locally.

[Continue Assessment]
```

## Document upload interrupted

```text
Upload interrupted.

[Retry]
```

## AI unavailable

The RN must still be able to complete the assessment manually.

AI is an accelerator, not a dependency.

---

# 98. FIRST CLAUDE MOCKUP REQUEST

Do **not** ask Claude to design the entire admissions system in one image.

Start with:

## Mockup 1 — Admissions Main Workspace

Required:

- Standard Joy navigation
- Admissions header
- Global filter tabs
- List / Board switch
- Needs You
- Waiting
- Moving Forward
- 8–10 realistic prospects
- One person drawer open
- Quick Add
- Talk to Joy
- Minimal color
- Lots of whitespace

Example person in drawer:

**Marcus Bell — Assessment today at 10:30 AM — medication list missing**

The first mockup should prove that the huge admissions workflow can feel calm.

---

# 99. SECOND CLAUDE MOCKUP REQUEST

After main workspace approval:

## Mockup 2 — Phone Intake

Show:

- Section navigation
- Autosave
- Existing referral information already populated
- One focused section
- Continue button
- Talk/dictate option where useful
- Assessment scheduling as final intake step

Do not show all intake questions simultaneously.

---

# 100. THIRD CLAUDE MOCKUP REQUEST

After Phone Intake approval:

## Mockup 3 — Assessment Scheduling

Show:

- Client
- RN
- Date/time
- Duration
- Address
- Phone
- **Email**
- Documents needed
- Confirmation/reminder settings
- Spruce notification recipients
- Schedule Assessment action

After save show:

```text
Assessment scheduled
✓ Calendar updated
✓ Family notified
✓ RN assigned
```

---

# 101. FOURTH CLAUDE MOCKUP REQUEST

## Mockup 4 — RN Comprehensive Assessment

Show:

- Tablet-friendly layout
- Section-by-section navigation
- Autosave
- Functional Assessment as active section
- Manual fields
- Dictate
- Add Photo
- Ask Joy
- Quiet "Needs Review" behavior
- No clinical-dashboard clutter

This is a critical screen.

It should feel like a premium field tool, not an EHR.

---

# 102. FIFTH CLAUDE MOCKUP REQUEST

## Mockup 5 — Assessment Review

Show:

- Assessment summary
- Recommended services
- Schedule recommendation
- Caregiver level
- Key precautions
- Missing/uncertain items
- RN signature
- Complete Assessment

AI-generated content must be clearly reviewable.

---

# 103. SIXTH CLAUDE MOCKUP REQUEST

## Mockup 6 — Pre-Onboarding

Show:

- Joy Needs You
- Waiting
- Complete
- Service Agreement
- Care Plan
- Medication list
- Client Rights
- Physician List
- Payment Setup
- Responsible Party
- Document status
- One clear next action

Do not display 12 giant document cards.

---

# 104. SEVENTH CLAUDE MOCKUP REQUEST

## Mockup 7 — Client/Family Admissions Portal

Show:

```text
Your Joy Health Care Setup

✓ Phone Intake
✓ Assessment
• Service Agreement — Signature Needed
• Care Plan — In Review
○ Start of Care
```

Primary action:

**Review & Sign**

Make it extremely simple and reassuring.

---

# 105. EIGHTH CLAUDE MOCKUP REQUEST

## Mockup 8 — Ready for Admission / Start-of-Care Handoff

Show:

- Ready state
- Start target
- Recommended schedule
- Caregiver level
- Matching/special considerations
- View admission summary
- Prepare Start of Care

This screen should clearly transition from Admissions into Scheduling/Operations.

---

# 106. REALISTIC MOCK DATA FOR CLAUDE

Use these examples consistently across mockups.

## Marcus Bell
Stage: Assessment  
Service: Personal Care  
Assessment: Today 10:30 AM  
RN: Joan Robinson, RN  
Address: 3704 Harmon Ave  
Missing: Medication list  
Responsible party: Daughter  
Requested care: Mon–Fri mornings

## Margaret Davis
Stage: Assessment  
Service: Companion Care  
Assessment: Friday 2:00 PM  
Status: Waiting on medication list

## Susan Miller
Stage: Pre-Onboarding  
Service: Personal Care  
Status: Service Agreement ready for review

## Evelyn Carter
Stage: Pre-Onboarding  
Status: Waiting on family signature

## Lian Huang
Stage: Assessment Scheduled  
Service: Personal Care  
RN: Samantha Chen  
Status: Moving Forward

## Robert Green
Stage: Ready for Admission  
Start-of-care target: Monday  
Requested schedule: Mon/Wed/Fri 9 AM–1 PM

## Tammy Wilson
Stage: New Referral  
Status: Phone intake needed

## John Williams
Stage: Phone Intake  
Status: Intake incomplete

---

# 107. DESIGN SUCCESS CRITERIA

The main Admissions screen succeeds if the user can answer within 10 seconds:

1. Who needs me?
2. Who are we waiting on?
3. Who is moving forward?
4. Who has an assessment today?
5. What is missing before an assessment?
6. Who is ready for admission?
7. What should I do next for any person?

The individual record succeeds if:

1. Basic information is never re-entered unnecessarily.
2. The next action is obvious.
3. Documents/statuses are easy to understand.
4. The RN can complete the assessment without fighting the software.
5. The family can understand their progress without calling the office.
6. Admissions hands clean data to People, Scheduling, Operations, and Billing.

---

# 108. FINAL INSTRUCTION TO CLAUDE DESIGN

Admissions is **large behind the scenes and simple on the screen**.

Do not solve complexity by displaying more.

Solve complexity by:

- Showing the right information at the right moment
- Reusing previously captured information
- Keeping routine work in drawers
- Using full workspaces only for Phone Intake and Assessment
- Organizing the main screen around Needs You / Waiting / Moving Forward
- Letting Joy prepare the next action
- Requiring human approval for clinical/admission decisions
- Keeping Spruce as the communication layer
- Keeping Scheduling as the schedule engine
- Converting the admissions record into the permanent client record instead of recreating it

The desired feeling is:

> **“Joy already knows where this client is in the process and what I need to do next.”**

The product should feel like a **5–6 figure custom healthcare SaaS platform** because the complexity is intelligently hidden—not because the screen contains more components.
