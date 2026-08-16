# Joy Health --- Phone Intake

## Claude Design Master Specification

### AI-First Phone Intake + Manual Typeform-Style Forms + RN Assessment Scheduling Handoff

**Module:** Admissions\
**Workflow:** Referral → **Phone Intake** → Assessment Scheduling → RN
Assessment → Consents → RN Review → Pre-Onboarding\
**Primary users:** Intake Coordinator, Office Administrator,
CEO/Administrator\
**Design target:** Premium 5--6 figure healthcare SaaS; calm, warm,
modern, fast, and extremely easy to operate.

------------------------------------------------------------------------

# 0. CLAUDE --- READ THIS FIRST

Do **not** redesign the Joy Client Intake Form as a traditional medical
intake form, EHR, spreadsheet, CRM data-entry screen, or a literal
two-page web form.

The existing Joy two-page Client Intake Form is the **source-of-truth
for required intake information**. The digital experience should be
substantially easier than the paper form.

The primary experience is:

> **The staff member has a natural conversation with the caller. Joy
> listens quietly, structures what it hears, fills the intake, and
> surfaces only what still needs to be confirmed.**

The manual experience is equally important:

> **If AI is unavailable, disabled, or the user prefers manual entry,
> the same intake must be completable through a beautiful Typeform-like
> one-question/one-topic-at-a-time experience.**

Both modes write to the **same intake record**. They are not separate
forms or workflows.

The product should feel closer to **Typeform + CareSwitch +
Notion/Linear-level product polish** than an EHR.

The underlying workflow may be detailed. **The screen must not feel
detailed.**

------------------------------------------------------------------------

# 1. NON-NEGOTIABLE PRODUCT PRINCIPLES

1.  **AI first; manual always available.**
2.  **Enter once, reuse everywhere.**
3.  **Natural conversation, not a rigid phone script.**
4.  **A visible Question Guide is available so staff always know what
    remains.**
5.  **One focused question/topic at a time in manual mode.**
6.  **Autosave continuously.**
7.  **Human review makes the intake official.**
8.  **Joy structures, summarizes, identifies gaps, and drafts. Joy does
    not make clinical decisions.**
9.  **Phone Intake must not become the RN Comprehensive Assessment.**
10. **Do not ask the caller to repeat information already captured from
    the referral.**
11. **Do not ask for the client address upfront. Collect/confirm it when
    scheduling the home assessment visit.**
12. **Do not include "About Me" in Phone Intake. Reserve deeper
    personal-preference discovery for the in-person RN assessment.**
13. **Assessment scheduling is the natural successful end of Phone
    Intake.**
14. **Spruce is the communication layer. Joy owns the operational
    workflow and record.**
15. **One primary action per screen. Minimal color. Lots of
    whitespace.**
16. **The RN Assessment must inherit confirmed Phone Intake data.**
17. **If the decision is not to move forward, document the reason and
    stop/route to follow-up.**
18. **Do not activate a client from Phone Intake. Admission happens only
    after the downstream assessment/admission process.**

------------------------------------------------------------------------

# 2. SOURCE FORM --- REQUIRED DATA

The existing two-page Joy Client Intake Form must be represented in the
digital workflow.

## Page 1 requirements

-   Date
-   Staff Member
-   Caller's Name
-   Relationship to client
-   Phone number
-   Email address
-   Client address --- the paper form explicitly notes this is collected
    when scheduling the home visit
-   How the prospect heard about the agency
-   Living situation
    -   Home / lives alone
    -   Home / with spouse or child
    -   Care facility
-   Client needs
    -   Bathing
    -   Dressing
    -   Feeding
    -   Toileting
    -   Mobility
    -   Housekeeping
    -   Transportation
    -   Shopping / errands
    -   Companionship
    -   Other
-   Primary diagnosis, **if provided**
-   Primary reason care is needed
-   What is most important to the caller when selecting a home care
    agency?

## Page 2 requirements

-   Proposed schedule
    -   Monday
    -   Tuesday
    -   Wednesday
    -   Thursday
    -   Friday
    -   Saturday
    -   Sunday
-   Anticipated start date
-   Hours per week
-   Source of payment
    -   Private Pay
    -   LTC Insurance
    -   Other / comments
-   In-home consultation / RN assessment
    -   Date
    -   Time
    -   Location
    -   Who the caller will be meeting with
-   If the in-home consultation is not scheduled
    -   Reason
    -   Next follow-up date
    -   Next follow-up time
    -   Preferred method: Phone Call / Text / Email
-   Additional comments / notes

The digital product may improve the interaction and reuse existing data,
but it must not silently drop these source-form requirements.

------------------------------------------------------------------------

# 3. WHAT PHONE INTAKE IS --- AND IS NOT

## Phone Intake IS

A short qualification/discovery conversation that helps Joy understand:

-   who is calling;
-   who needs care;
-   why care is being sought;
-   broad care needs;
-   broad living/clinical snapshot;
-   requested schedule;
-   payment source basics;
-   what matters most to the family;
-   whether staff want to move forward to an in-home RN assessment;
-   when/how that assessment should be scheduled.

## Phone Intake IS NOT

Do not add a full:

-   medication reconciliation;
-   allergy assessment;
-   ADL scoring instrument;
-   cognitive assessment;
-   home safety inspection;
-   emergency-preparedness assessment;
-   physician/provider inventory;
-   clinical care recommendation;
-   caregiver acuity determination;
-   care plan;
-   consent packet;
-   "About Me" interview;
-   final admission decision.

Those belong downstream, primarily in the RN Assessment and admission
process.

------------------------------------------------------------------------

# 4. OVERALL WORKFLOW

``` text
New Referral / Inquiry
        ↓
Start Phone Intake
        ↓
AI-Assisted Conversation (default)
        ↓
Joy listens + structures information
        ↓
Staff can open Question Guide at any time
        ↓
Joy identifies missing / uncertain items
        ↓
Typeform-style confirmation questions
        ↓
Staff reviews Intake Summary
        ↓
Decision: Move forward to RN Assessment?
       ↙                         ↘
     NO                           YES
     ↓                             ↓
Document reason / follow-up   Schedule RN Assessment
                                    ↓
                             Joy Calendar + Spruce
                                    ↓
                          Intake becomes RN context
```

------------------------------------------------------------------------

# 5. ENTRY FROM ADMISSIONS

A Phone Intake record may appear in Admissions as:

``` text
John Williams
Phone Intake
Intake incomplete

[Continue Intake →]
```

A new referral may appear as:

``` text
Tammy Wilson
New Referral
Personal Care · Houston
Daughter is primary contact

Next: Complete phone intake
[Start Intake →]
```

Opening Phone Intake uses a **dedicated full workspace**, not a cramped
side drawer.

------------------------------------------------------------------------

# 6. PHONE INTAKE WORKSPACE SHELL

## Top bar

Left: - Back to Admissions - Client/prospect name - `Phone Intake`

Quiet status: - `Saved just now` - or `Saving…`

Right: - `Question Guide` - `Preview ▾` - `•••`

### Preview dropdown

-   **Preview Intake Summary**
-   View Referral
-   View Known Client Information

Preview opens as a right-side slide-over or modal layer. It must **not
navigate away from the intake**.

### More menu

`•••` may contain: - Save & Exit - Add internal note - View activity -
Close / Not Moving Forward

Do not clutter the header with many visible buttons.

------------------------------------------------------------------------

# 7. TWO INPUT MODES --- ONE RECORD

## Mode A --- Intake with Joy (default)

``` text
Phone Intake

Have the conversation. Joy will handle the paperwork.

Joy can listen to the call, organize what you learn,
and show you anything that still needs to be confirmed.

[ Start Intake with Joy ]

Complete manually instead
```

If recording is technically enabled and legally/configurationally
permitted, the UI may support it. Distinguish clearly between: -
**Listening/transcription active** - **Recording active**, if enabled

Do not imply recording when only live transcription/listening is
occurring.

## Mode B --- Manual Intake

Secondary action:

`Complete manually instead`

This launches the Typeform-like manual experience below.

The user can switch modes without losing data.

------------------------------------------------------------------------

# 8. AI CONVERSATION MODE --- PRIMARY EXPERIENCE

The coordinator should spend most of the call talking to the person,
**not staring at the screen**.

Example center canvas:

``` text
Marcus Bell · Phone Intake

        ✦ Joy is listening

Have the conversation naturally.
I’ll organize the intake as you go.

Captured so far
✓ Caller: Susan Bell · Daughter
✓ Client needs morning personal care
✓ Bathing assistance
✓ Mobility assistance
✓ Two recent falls mentioned
✓ Looking for weekday mornings

Still need to confirm
• What matters most when choosing an agency
• Estimated hours per week
• Payment source

[ Review captured information ]
```

Do not show a giant scrolling transcript by default.

If transcript access is needed, use a subtle `View transcript` action or
More menu.

------------------------------------------------------------------------

# 9. QUESTION GUIDE --- NATURAL CONVERSATION SUPPORT

The intake is a **natural conversation supported by a visible question
list**, not a rigid script.

`Question Guide` opens a lightweight right panel.

Required order:

1.  **Caller**
2.  **Client**
3.  **Clinical Snapshot**
4.  **Care Needs**
5.  **Daily Routine / Requested Schedule**
6.  **Assessment Scheduling**

Example:

``` text
Question Guide

✓ Caller
  ✓ Name
  ✓ Relationship
  ✓ Phone
  ✓ Email

✓ Client
  ✓ Client name
  ✓ Referral source
  ✓ Living situation

● Clinical Snapshot
  ✓ Reason care is needed
  ✓ Primary diagnosis if provided
  ○ DME / mobility equipment if mentioned

○ Care Needs
○ Daily Routine / Schedule
○ Assessment Scheduling
```

DME may be captured as part of the broad clinical snapshot **when
naturally mentioned**, because it helps prepare the RN. Do not turn it
into a full equipment assessment.

The Question Guide updates as Joy captures information.

------------------------------------------------------------------------

# 10. AI CAPTURE BEHAVIOR

Joy may: - transcribe/listen to the conversation; - identify which
intake fields were answered; - map conversational statements to
structured fields; - carry forward referral information; - summarize
free-text answers; - identify missing required information; - identify
uncertain information; - flag apparent conflicts; - draft internal
notes; - prepare the intake summary; - prepare the assessment-scheduling
handoff.

Joy must not: - diagnose; - invent information; - turn casual statements
into definitive clinical findings; - autonomously approve admission; -
silently overwrite staff corrections; - mark uncertain information
confirmed without review.

------------------------------------------------------------------------

# 11. AI CAPTURE EXAMPLES

## Care need

Caller: \> "She can dress herself, but I'm worried about the shower. She
needs someone there, and she's getting weaker walking around the house."

Joy draft:

``` text
Care Needs
✓ Bathing
✓ Mobility

Joy note
Caller reports client can dress independently but needs help/supervision with bathing and has increasing difficulty with mobility.

[Confirm] [Edit]
```

Do **not** automatically check Dressing.

## Diagnosis

Caller: \> "She has Parkinson's."

Joy may populate:

`Primary diagnosis (if provided): Parkinson’s — caller reported`

This is caller-reported information, not a Joy diagnosis.

## Schedule

Caller: \> "We need somebody Monday through Friday in the mornings,
maybe four hours a day."

Joy draft:

``` text
Requested schedule
Mon–Fri
Morning
Estimated: 4 hrs/day
Estimated: 20 hrs/week
```

Staff confirms before completion.

------------------------------------------------------------------------

# 12. NEEDS REVIEW --- NO AI SCORE DASHBOARD

Do not show an AI confidence percentage.

Show concrete issues:

``` text
Needs Review · 2

Schedule
Caller said “mornings” but did not give a preferred start time.
[Confirm]

Payment
LTC insurance was mentioned but details were not provided.
[Review]
```

The coordinator should understand **what needs attention**, not
interpret a model score.

------------------------------------------------------------------------

# 13. AI → TYPEFORM GAP COMPLETION

At the end of the conversation:

``` text
Nice — I captured most of the intake.

3 things still need to be confirmed.

[ Finish 3 items ]
```

Then one focused question at a time.

Example:

``` text
What is most important to Susan when choosing a home care agency?

[ Large open text / dictate field ]

🎙 Dictate

                         [Continue →]
```

Then:

``` text
What is the expected source of payment?

○ Private Pay
○ LTC Insurance
○ Other
○ Not sure yet

                         [Continue →]
```

This is how AI conversation and Typeform manual entry work together.

------------------------------------------------------------------------

# 14. MANUAL TYPEFORM MODE --- DESIGN RULES

Manual mode must be fully usable if AI is unavailable.

Do **not** show the paper form as a two-page digital grid.

Use: - one question or small related group per screen; - large readable
typography; - generous whitespace; - large tap/click targets; - clear
progress; - Back and Continue; - keyboard-friendly inputs; - optional
`Tell Joy` / dictate action where useful; - automatic carry-forward of
known referral data; - conditional questions only when relevant.

Example shell:

``` text
┌──────────────────────────────────────────────────────────────┐
│ ← Admissions    Marcus Bell · Phone Intake    Saved just now │
│                                     Preview ▾     •••         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   02  About the client                                       │
│   ───────────────────────────────────────                    │
│                                                              │
│   What is Marcus’s living situation?                         │
│                                                              │
│   ○ Lives alone                                              │
│   ○ Lives with spouse / child                                │
│   ○ Care facility                                            │
│   ○ Other                                                    │
│                                                              │
│                                     [Continue →]              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ← Back          6 of 18                          Save & exit  │
└──────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 15. MANUAL SECTION 1 --- CALLER

## Existing referral confirmation

If data exists:

``` text
We already have a few details.

Caller
Susan Bell
(412) 555-0198
susan@example.com

[Looks right]
[Edit]
```

Do not retype known information.

## Caller name

**Who are you speaking with?**

Field: `Caller’s name`

## Relationship

**What is Susan's relationship to the client?**

Options: - Self - Spouse / partner - Daughter / son - Other family -
Friend - Guardian / representative - Facility / provider - Other

## Contact

**What is the best contact information for Susan?**

Capture: - Phone - Email

Do not ask follow-up communication preference here unless operationally
needed. The source form specifically asks Phone/Text/Email in the branch
where the consultation is not scheduled.

------------------------------------------------------------------------

# 16. MANUAL SECTION 2 --- CLIENT

## Client identity

If known:

``` text
The referral is for:
Marcus Bell

[Correct]
[Change]
```

## Referral source

**How did they hear about Joy Health?**

Use a searchable select if configured referral sources exist, plus
`Other`.

## Living situation

**What is Marcus's current living situation?**

-   Lives alone at home
-   Lives with spouse / child / family
-   Care facility
-   Other

### ADDRESS RULE

Do **not** place "What is the client's full address?" at the beginning
of Phone Intake.

If address exists from referral, retain it silently. Prominently
collect/confirm it later during Assessment Scheduling.

------------------------------------------------------------------------

# 17. MANUAL SECTION 3 --- CLINICAL SNAPSHOT

This section is intentionally light.

## Reason for care

**What is happening that made the family look for care?**

Large text area with: - type; - dictate; - optional Joy-assisted
summary.

Maps to `Primary Reason Care Is Needed`.

## Diagnosis if provided

**Did the caller mention a primary diagnosis?**

-   Yes
-   No / not provided

If Yes: `Primary diagnosis as reported`

Do not force or infer diagnosis.

## Broad mobility / DME note

**Is there anything about mobility or equipment the RN should know
before the visit?**

Helper examples only:
`Walker, wheelchair, hospital bed, oxygen, lift, other equipment`

Options: - Nothing mentioned - Add note - Dictate

This is preparation context, not a clinical equipment assessment.

------------------------------------------------------------------------

# 18. MANUAL SECTION 4 --- CARE NEEDS

Question:

# What does Marcus need help with?

Use large multi-select rows/cards.

Required source categories: - Bathing - Dressing - Feeding - Toileting -
Mobility - Housekeeping - Transportation - Shopping / Errands -
Companionship - Other

Do not make each category a separate clinical scoring screen.

After selection:

``` text
Anything else we should know about these needs?

[ Open note field ]
🎙 Dictate

Skip for now
```

------------------------------------------------------------------------

# 19. MANUAL SECTION 5 --- WHAT MATTERS MOST

Give this its **own screen**.

# What is most important to the caller when choosing a home care agency?

Subtext: `Capture this in their own words when possible.`

Large open text field.

Actions: - `🎙 Dictate` - `Continue`

Do not reduce this to generic checkboxes.

Example:

> "Consistency. My father gets anxious with new people, so having the
> same caregiver matters more than anything."

Preserve this downstream as important family context.

------------------------------------------------------------------------

# 20. MANUAL SECTION 6 --- DAILY ROUTINE / PROPOSED SCHEDULE

The paper form calls this **Proposed Schedule**.

Do not use a dense weekly grid.

## Days

**Which days are you looking for care?**

Large chips: `Mon  Tue  Wed  Thu  Fri  Sat  Sun`

## Time preference

The paper form does not dedicate time fields per day, but the digital
intake may capture a broad preference to prepare scheduling.

**What time of day are you hoping for?**

-   Morning
-   Afternoon
-   Evening
-   Overnight
-   Specific times
-   Flexible / not sure

If Specific times, show simple start/end inputs.

## Anticipated start

**When would you like care to begin?**

-   Date picker
-   As soon as possible
-   Not sure yet

## Hours per week

**About how many hours of care are you expecting each week?**

Numeric input + `Not sure yet`.

If Joy inferred hours from conversation, show the estimate for
confirmation.

------------------------------------------------------------------------

# 21. MANUAL SECTION 7 --- PAYMENT SOURCE

# How do they expect to pay for care?

Options matching the source form: - Private Pay - LTC Insurance -
Other - Not sure yet

If LTC Insurance, do **not** turn this into a full
insurance-verification workflow.

Optional lightweight note: `Carrier / policy note if caller has it`

If Other: `Other / comments`

------------------------------------------------------------------------

# 22. ADDITIONAL COMMENTS / NOTES

Near the end of intake, offer:

**Anything else the team should know before the RN assessment?**

-   large note field;
-   dictate;
-   optional;
-   internal by default unless specifically configured otherwise.

This maps to the source form's `Additional Comments/Notes`.

------------------------------------------------------------------------

# 23. INTAKE SUMMARY --- HUMAN REVIEW

Before intake becomes official:

``` text
Phone Intake Summary
Marcus Bell

CALLER
Susan Bell · Daughter
(412) 555-0198
susan@example.com

LIVING SITUATION
Lives alone at home

WHY CARE IS NEEDED
Susan reports two recent falls and increasing difficulty
with bathing and walking safely in the home.

CARE NEEDS
Bathing · Mobility · Housekeeping · Companionship

WHAT MATTERS MOST
Consistency — family strongly prefers the same caregiver.

REQUESTED SCHEDULE
Mon–Fri · mornings
Approx. 20 hrs/week
Start: As soon as possible

PAYMENT
Private Pay

Joy found no unanswered required intake items.
```

Actions: - `Edit section` - `Preview Intake` - Primary: **Complete
Intake & Continue**

If uncertain:

``` text
Needs Review · 2
• Requested start time not confirmed
• Hours/week estimated from conversation

[Resolve 2 items]
```

Human review makes the intake official.

------------------------------------------------------------------------

# 24. DECISION --- MOVE FORWARD?

After review:

``` text
Phone intake complete

Next step
Would you like to move forward with an in-home RN assessment?

[ Schedule RN Assessment ]
[ Not Moving Forward ]
```

Joy does not autonomously make this decision.

------------------------------------------------------------------------

# 25. NOT MOVING FORWARD / NOT SCHEDULED BRANCH

If `Not Moving Forward` or assessment not scheduled is selected, require
a reason.

Operational options: - Not a service fit - Outside service area - Unable
to meet requested schedule - Payer / financial mismatch - Family
declined - Unable to reach - Duplicate - Other

Then support source-form follow-up fields when relevant: - Reason - Next
follow-up date - Next follow-up time - Preferred method - Phone Call -
Text - Email

If closed, retain history. Do not delete the referral.

If follow-up is planned, place the record in a waiting/follow-up state.

------------------------------------------------------------------------

# 26. ASSESSMENT SCHEDULING --- SUCCESSFUL END OF INTAKE

When `Schedule RN Assessment` is selected, transition directly into
Assessment Scheduling.

Required fields: - Client - Assessment type - RN / assessor - Date -
Start time - Expected duration - **Address** - Contact person - Phone -
**Email** - Notes / access instructions - Documents/items needed before
assessment - Confirmation method - Spruce notification recipients

### Address behavior

This is where the client address is prominently collected/confirmed.

``` text
Where will the assessment take place?

3704 Harmon Ave
Houston, TX 77004

[Use this address]
[Edit]
```

If no address exists, collect it here.

------------------------------------------------------------------------

# 27. ASSESSMENT SCHEDULING UI

``` text
Schedule RN Assessment
Marcus Bell

WHEN
Date                 Start time
[ Aug 17, 2026 ]     [ 10:30 AM ]
Expected duration     [ 90 min ▾ ]

WHO
RN / Assessor
[ Joan Robinson, RN ▾ ]

WHERE
3704 Harmon Ave
Houston, TX 77004
[Edit]

CONTACT FOR VISIT
Susan Bell · Daughter
(412) 555-0198
susan@example.com
[Edit]

BEFORE THE VISIT
□ Medication list
□ Physician list
□ Insurance / payer information
□ Advance directive information
□ Relevant discharge paperwork
□ Other

NOTIFY THROUGH SPRUCE
☑ Susan Bell
□ Marcus Bell

[Cancel]                    [Schedule Assessment]
```

Keep this spacious. Do not make it look like an Outlook event editor.

------------------------------------------------------------------------

# 28. WHO WILL YOU BE MEETING WITH?

The source form asks `Who will you be meeting with?`

Map this to the assigned RN/assessor.

Example confirmation:

``` text
You’ll be meeting with
Joan Robinson, RN
Joy Health
```

If assignment is not yet known, use truthful copy such as:
`RN assignment pending`

Do not invent a staff member.

------------------------------------------------------------------------

# 29. SPRUCE COMMUNICATION

Spruce owns client/family messaging.

After scheduling, Joy prepares/triggers the configured communication
workflow.

Possible content: - assessment date; - time; - address confirmation; -
RN/assessor name when appropriate; - what to have available; -
reminder; - reschedule instructions.

Show communication **status**, not a Spruce inbox.

Success:

``` text
Assessment scheduled

✓ Calendar updated
✓ RN assigned
✓ Susan Bell notified through Spruce

[Done]
```

Failure:

``` text
Assessment scheduled

✓ Calendar updated
✓ RN assigned
! Client/family notification failed

[Retry notification]
```

Do **not** roll back the assessment because a message failed.

------------------------------------------------------------------------

# 30. JOY SCHEDULE HANDOFF

The appointment must use the central Joy schedule/calendar.

Do not create a separate Admissions-only calendar.

Example event:

``` text
10:30 AM
Marcus Bell · Initial RN Assessment
Joan Robinson, RN
3704 Harmon Ave
```

------------------------------------------------------------------------

# 31. PRE-ASSESSMENT DOCUMENT REQUEST

After scheduling, Joy may identify useful items to request before the RN
arrives: - Medication list - Physician list - Insurance/payer
information where applicable - Advance directive information - Relevant
discharge paperwork - Other care-related documents

Example:

``` text
Before the assessment

Joy noticed Marcus’s medication list has not been provided.
Would you like to request it from Susan before the visit?

[Review message] [Send through Spruce]
```

Do not make every item mandatory unless a business rule requires it.

------------------------------------------------------------------------

# 32. DATA HANDOFF TO RN ASSESSMENT

Everything confirmed during Phone Intake becomes context for the RN
Assessment.

Do not make the RN ask the family the same questions again.

Example RN start state:

``` text
From Phone Intake

Caller
Susan Bell · Daughter

Reason for care
Two recent falls; increasing difficulty with bathing and mobility.

Requested help
Bathing · Mobility · Housekeeping · Companionship

Living situation
Lives alone

Requested schedule
Mon–Fri mornings · approx. 20 hrs/week

What matters most
Caregiver consistency

[No changes]
[Update information]
```

The RN confirms or corrects. Corrections update the shared record with
audit history.

------------------------------------------------------------------------

# 33. COMPLETE MANUAL SCREEN MAP

Claude should design a reusable component system, not 25 unrelated
pages.

## Screen family A --- Welcome / mode selection

1.  Phone Intake welcome
2.  Start with Joy
3.  Complete manually

## Screen family B --- Existing information confirmation

4.  Referral information already known
5.  `Looks right / Edit`

## Screen family C --- Single-select Typeform question

6.  Relationship to client
7.  Living situation
8.  Payment source

## Screen family D --- Text / dictate

9.  Primary reason care is needed
10. Primary diagnosis if provided
11. What matters most
12. Additional comments

## Screen family E --- Multi-select

13. Client care needs
14. Proposed days

## Screen family F --- Date / numeric

15. Anticipated start date
16. Hours per week

## Screen family G --- Gap resolution

17. Joy needs confirmation
18. Conflicting/uncertain information

## Screen family H --- Summary

19. Intake review
20. Needs Review state

## Screen family I --- Decision

21. Schedule assessment / Not moving forward

## Screen family J --- Scheduling

22. Assessment date/time/RN
23. Address/contact confirmation
24. Documents before visit
25. Spruce recipients
26. Scheduling success/failure

Create a **small reusable Typeform design system** and show
representative states.

------------------------------------------------------------------------

# 34. TYPEFORM COMPONENT SYSTEM

Create reusable components:

### `IntakeQuestionShell`

-   section number/name;
-   question;
-   optional helper text;
-   answer area;
-   Back;
-   Continue;
-   autosave state;
-   progress.

### `LargeChoice`

Single select.

### `MultiChoiceRow`

Care needs and days.

### `VoiceTextArea`

Large text input + dictate control.

### `KnownInfoCard`

Carried-forward referral information with `Looks right / Edit`.

### `JoyCapturedCard`

What Joy heard and how it mapped to the intake.

### `NeedsReviewCard`

One concrete missing/uncertain item.

### `SummarySection`

Compact review block with Edit action.

### `PreviewDrawer`

Read-only Intake Summary/referral preview.

### `QuestionGuideDrawer`

Conversational checklist.

### `ScheduleAssessmentPanel`

Final scheduling handoff.

### `SaveState`

`Saving…` / `Saved just now` / offline.

------------------------------------------------------------------------

# 35. PROGRESS DESIGN

Do not use a loud 0--100% progress meter.

Preferred manual indicator: `6 of 18`

or a very thin progress line.

In AI mode use topical completion:

``` text
Captured
Caller ✓
Client ✓
Clinical Snapshot ✓
Care Needs ✓
Schedule 2 items left
Assessment Scheduling not started
```

------------------------------------------------------------------------

# 36. VISUAL DESIGN DIRECTION

## Overall feeling

-   calm;
-   human;
-   warm;
-   premium;
-   spacious;
-   confident;
-   not clinical;
-   not childish;
-   not generic Bootstrap admin;
-   not a colorful Monday.com clone;
-   not an EHR.

## Background

Use: - white; - warm white; - very light neutral.

**Do not use a blue page background.**

## Surfaces

-   white cards/surfaces;
-   subtle borders;
-   very subtle shadows only where needed;
-   generous padding;
-   rounded corners;
-   no excessive nested cards.

## Joy blue

Joy Royal Blue: `#1407A2`

Use sparingly for: - primary action; - selected state; - active
navigation; - important link; - small Joy AI accent.

Do not fill large screen areas with blue.

## Status colors

Use red/amber only for actual exception/review states.

Do not assign a bright color to every section.

## Typography

-   modern sans-serif;
-   large Typeform-like question typography;
-   highly readable body;
-   muted secondary metadata;
-   avoid tiny labels.

------------------------------------------------------------------------

# 37. RESPONSIVE / TABLET BEHAVIOR

### Desktop

-   centered question canvas;
-   optional Question Guide drawer;
-   Preview drawer;
-   max content width.

### Tablet

-   full-width focused question;
-   drawers become overlays;
-   large touch targets;
-   bottom actions reachable;
-   no dense sidebar.

### Mobile

Not primary, but degrade gracefully: - one column; - sticky Continue; -
no side-by-side forms; - large inputs.

------------------------------------------------------------------------

# 38. AUTOSAVE / RECOVERY

Normal: - `Saving…` - `Saved just now`

Offline:

``` text
You’re offline.
Your intake is saved on this device and will sync when connection returns.

[Continue Intake]
```

Restored: `Synced successfully.`

------------------------------------------------------------------------

# 39. AI UNAVAILABLE STATE

``` text
Joy listening is temporarily unavailable.
Your intake is safe.

[Continue manually]
[Try again]
```

Manual Typeform mode remains fully functional.

------------------------------------------------------------------------

# 40. DUPLICATE / EXISTING CLIENT PROTECTION

Support duplicate checking using available information such as: -
name; - phone; - email; - address when known.

If likely match:

``` text
Possible existing record
Marcus Bell
(412) 555-0198

[Open existing record]
[Continue as new inquiry]
```

Do not silently create a second client.

------------------------------------------------------------------------

# 41. AUDIT / ACTIVITY

Maintain quiet history for: - referral created; - phone intake
started; - AI-assisted capture used; - intake saved; - intake
completed; - staff correction; - assessment scheduled; - Spruce
confirmation sent/failed; - follow-up scheduled; - record closed/reason.

For consequential edits retain: - user; - date/time; - prior value; -
new value; - AI-assisted yes/no where relevant.

Do not show audit history during normal intake unless requested.

------------------------------------------------------------------------

# 42. PERMISSIONS

### CEO / Administrator

Full access.

### Intake / Office Coordinator

Can: - start/continue intake; - review AI capture; - edit intake
information; - schedule assessment; - trigger configured
communication; - document follow-up/close reason.

### RN / Clinical Supervisor

Can view intake context and use it during the RN Assessment.

------------------------------------------------------------------------

# 43. REALISTIC SAMPLE DATA FOR MOCKUPS

Use the same fictional person consistently.

**Client:** Marcus Bell\
**Caller:** Susan Bell, Daughter\
**Phone:** (412) 555-0198\
**Email:** susan.bell@example.com\
**Referral source:** Family / word of mouth\
**Living situation:** Lives alone at home\
**Reason for care:** Susan reports two recent falls and increasing
difficulty with bathing and walking safely around the home.\
**Primary diagnosis if provided:** Parkinson's disease --- reported by
daughter\
**Broad DME/mobility:** Uses a walker\
**Care needs:** Bathing, Mobility, Housekeeping, Companionship\
**What matters most:** Consistency; Marcus becomes anxious with
unfamiliar people and the family strongly prefers a consistent
caregiver.\
**Requested schedule:** Monday--Friday, mornings, approx. 4 hours/day,
approx. 20 hours/week\
**Anticipated start:** As soon as possible\
**Payment:** Private Pay\
**Assessment:** Monday, August 17, 2026 at 10:30 AM\
**RN:** Joan Robinson, RN\
**Location:** 3704 Harmon Ave, Houston, TX 77004

Use only as design sample data. Do not hard-code it.

------------------------------------------------------------------------

# 44. MOCKUP 1 --- PHONE INTAKE START / AI MODE

Create a high-fidelity mockup showing: - Joy standard navigation
shell; - Admissions context; - Marcus Bell · Phone Intake; -
`Saved just now`; - Question Guide; - Preview dropdown; - AI listening
state; - 5--6 captured facts; - 3 remaining items; - one
`Review captured information` action; - lots of whitespace; - no
transcript wall; - no clinical dashboard clutter.

It should immediately communicate:

> "The coordinator can talk to the caller while Joy handles the form."

------------------------------------------------------------------------

# 45. MOCKUP 2 --- QUESTION GUIDE OPEN

Show the same intake with Question Guide open.

Required sections: - Caller - Client - Clinical Snapshot - Care Needs -
Daily Routine / Schedule - Assessment Scheduling

Show completed/current/not-yet-covered states.

Do not make it look like a 40-step compliance checklist.

------------------------------------------------------------------------

# 46. MOCKUP 3 --- MANUAL TYPEFORM MODE

Representative screen:

``` text
04 · Care Needs

What does Marcus need help with?

☑ Bathing
☐ Dressing
☐ Feeding
☐ Toileting
☑ Mobility
☑ Housekeeping
☐ Transportation
☐ Shopping / Errands
☑ Companionship
☐ Other

[← Back]                         [Continue →]

8 of 18 · Saved just now
```

Make it elegant and spacious. Do not render choices as a tiny checkbox
grid.

------------------------------------------------------------------------

# 47. MOCKUP 4 --- WHAT MATTERS MOST

``` text
What is most important to Susan when choosing a home care agency?

[ large open answer area ]

“Consistency. My dad gets anxious with unfamiliar people,
so having the same caregiver matters most.”

🎙 Dictate

[Continue →]
```

This should feel like a premium guided interview, not medical software.

------------------------------------------------------------------------

# 48. MOCKUP 5 --- AI GAP RESOLUTION

``` text
I captured most of the intake.

2 things still need to be confirmed.

Requested start time
Susan said “mornings.”

○ 7–9 AM
○ 9–11 AM
○ Flexible morning
○ Enter another time

[Continue →]
```

Demonstrate how AI conversation and Typeform entry work together.

------------------------------------------------------------------------

# 49. MOCKUP 6 --- INTAKE SUMMARY / REVIEW

Show: - clean sections; - edit action per section; - no giant form; -
Needs Review only when actually uncertain; - primary action:
`Complete Intake & Continue`.

------------------------------------------------------------------------

# 50. MOCKUP 7 --- ASSESSMENT SCHEDULING

Show: - Marcus Bell; - date/time; - RN selector; - expected duration; -
address confirmation; - contact person; - phone; - email; -
pre-assessment items; - Spruce notification recipients; - one primary
`Schedule Assessment` action.

------------------------------------------------------------------------

# 51. MOCKUP 8 --- SUCCESS STATE

``` text
Assessment scheduled

Monday, Aug 17 · 10:30 AM
Joan Robinson, RN
3704 Harmon Ave

✓ Calendar updated
✓ RN assigned
✓ Susan Bell notified through Spruce

Next
Marcus’s phone intake will be available to Joan when she starts the RN Assessment.

[Done]
```

------------------------------------------------------------------------

# 52. PREVIEW BEHAVIOR

At any point, `Preview ▾` lets the coordinator inspect the structured
intake without losing their place.

Example drawer:

``` text
Intake Preview
Marcus Bell

Caller
Susan Bell · Daughter

Phone / Email
...

Living Situation
...

Care Needs
...

Requested Schedule
...

Payment
...

Assessment
Not yet scheduled
```

Preview is read-only by default. `Edit section` returns to the
appropriate question.

------------------------------------------------------------------------

# 53. SOURCE FORM / GENERATED RECORD

The product retains a structured digital intake record containing the
fields represented by the two-page Joy Client Intake Form.

The UI does **not** visually mimic the paper form.

If a printable/exported intake representation is needed later, the
structured record should be able to map into the formal intake output.

------------------------------------------------------------------------

# 54. FIELD MAPPING

  ------------------------------------------------------------------------
  Source Intake Field     Digital UX              Downstream Reuse
  ----------------------- ----------------------- ------------------------
  Date                    Auto-generated,         Audit/intake record
                          editable if needed      

  Staff Member            Logged-in staff         Audit/activity
                          auto-fill               

  Caller Name             Referral carry-forward  Contact context
                          or question             

  Relationship            Large choice            Client contacts

  Phone                   Carry-forward/confirm   Spruce/contact

  Email                   Carry-forward/confirm   Scheduling/contact

  Client Address          Confirm during          RN assessment, client
                          assessment scheduling   profile, scheduling

  Referral Source         Select/search           Admissions/reporting

  Living Situation        Large choice            RN assessment context

  Client Needs            Multi-select            RN assessment starting
                                                  context

  Primary Diagnosis if    Optional reported text  RN assessment context
  Provided                                        

  Primary Reason Care     Narrative/dictate       RN assessment context
  Needed                                          

  What Matters Most       Narrative/dictate       Care experience/context

  Proposed Schedule       Day chips + broad time  Assessment/care planning
                                                  context

  Start Date              Date / ASAP / unsure    Admissions planning

  Hours/Week              Number / unsure         Admissions planning

  Payment Source          Large choice            Billing/pre-onboarding
                                                  context

  Consultation Date/Time  Assessment scheduling   Joy schedule

  Consultation Location   Address confirmation    Joy schedule

  Who Meeting With        RN assignment           Confirmation message

  Not Scheduled Reason    Conditional branch      Admissions follow-up

  Follow-up Date/Time     Conditional branch      Tasks/follow-up

  Preferred Method        Conditional branch      Follow-up communication

  Additional Notes        Optional narrative      Admissions record
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 55. DO NOT DO THESE THINGS

Claude must **not**: - recreate the paper form as a giant web form; -
show every intake field at once; - use a blue background; - use large
blue/purple gradients; - create rainbow status cards; - make Joy a giant
chatbot taking half the screen; - use a dense clinical sidebar; - ask
for address first; - include "About Me" in Phone Intake; - add the full
RN Assessment here; - add the consent workflow here; - ask staff to
re-enter referral data; - make AI mandatory; - make AI decisions final
without human review; - hide missing information; - show meaningless AI
confidence percentages; - create a separate Admissions calendar; - build
a Spruce inbox clone; - scatter multiple primary buttons across the
screen; - make manual mode feel like a low-quality fallback.

------------------------------------------------------------------------

# 56. SUCCESS CRITERIA

The design succeeds if an intake coordinator can instantly answer:

1.  Who am I speaking with?
2.  What has Joy already captured?
3.  What do I still need to ask?
4.  Can I manually enter/correct anything immediately?
5.  Can I preview the intake without losing my place?
6.  What does the client broadly need?
7.  What schedule are they seeking?
8.  What matters most to the family?
9.  Are we moving forward to an RN assessment?
10. If yes, can I schedule it without re-entering client/contact data?
11. Was the assessment added to Joy's schedule?
12. Was the family notification sent through Spruce?
13. Will the RN see this intake automatically when the assessment
    begins?

Emotional test:

> **The staff member should feel like Joy is quietly taking notes for
> them---not like they are completing paperwork while trying to talk to
> a family.**

------------------------------------------------------------------------

# 57. FINAL INSTRUCTION TO CLAUDE DESIGN

Design this as a **single coherent Phone Intake product**, not
disconnected forms.

The product has three visible layers:

### Layer 1 --- Natural conversation

Joy listens and structures.

### Layer 2 --- Typeform-style manual/confirmation experience

The user fills or confirms only what is needed, one focused topic at a
time.

### Layer 3 --- Structured record and workflow

The intake becomes the source for Assessment Scheduling and the starting
context for the RN Assessment.

The most important behavior is:

> **Referral information flows into Phone Intake. Phone Intake
> information flows into the RN Assessment. The family should not have
> to start over at every stage.**

The design should make a complex admissions operation feel almost
effortless.

**Do not add complexity simply because the underlying workflow is
complex. Hide complexity intelligently.**
