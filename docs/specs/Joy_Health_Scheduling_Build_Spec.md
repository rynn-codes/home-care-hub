# Joy Health Scheduling — Build-Ready UI/UX + Integration Specification

## Purpose

Design the Joy Health **Scheduling** page as a calm, premium, low-click operations workspace for creating, assigning, reviewing, and changing client shifts.

The schedule must support:
- Drag-and-drop scheduling
- Day, week, and month views
- Recurring shifts
- Open/unassigned shifts
- Caregiver availability
- Client schedule visibility
- Conflict prevention
- AI-assisted schedule changes
- Human approval for consequential AI changes
- Employee and client/family notifications through Spruce
- Audit history for changes
- Minimal visual clutter

The page should feel like:

**CareSwitch simplicity + Notion clarity + Monday/Trello ease of movement + premium modern SaaS polish**

The key UX principle:

> **The schedule should be easy to understand at a glance and easy to change without opening multiple screens.**

---

# 1. Feasibility With the Current Joy Architecture

Yes — this is compatible with the basic architecture already laid out.

Joy does **not** need a giant new scheduling platform or a deep re-architecture.

Use four reusable layers:

1. **Joy Scheduling Engine** — owns visits, recurring schedules, assignments, open shifts, availability, conflicts, and change history.
2. **Drag/Drop UI Layer** — lets authorized office users move visits and assignments visually.
3. **Joy AI Action Layer** — reads scheduling data, proposes changes, and can prepare schedule edits.
4. **Notification Adapter** — sends confirmed schedule changes to Spruce for client/family and employee communication.

This keeps the build modular and avoids duplicating scheduling logic across the app.

---

# 2. Spruce Integration — Current Feasibility

Spruce's current public API supports integration with external operational and scheduling systems, including contact synchronization, messaging, scheduled messages, and webhooks.

## V1 Recommendation

Keep the Spruce connection simple:

**Joy owns the schedule.**  
**Spruce owns communication.**

When a confirmed schedule change occurs:

```text
Joy Schedule Change
        ↓
Notification Event Created
        ↓
Spruce
        ↓
Employee / Client / Family
```

Do not make Spruce responsible for deciding or storing the official schedule.

Important implementation note:
- Spruce API access must be enabled for the organization.
- API access may depend on the Spruce plan/account configuration.
- Development credentials and webhook setup are required.
- The design should not assume any unsupported Spruce fields beyond contact/conversation/message functionality.

---

# 3. Scheduling Page Goal

The page should answer four questions immediately:

1. **What care is scheduled?**
2. **What is still open/unassigned?**
3. **Are there conflicts or risks?**
4. **What needs me to make a decision?**

The schedule itself is the primary workspace.

---

# 4. Main Navigation

Use the established Joy Health left navigation:

- Home
- Operations
- Admissions
- People
- **Scheduling — active**
- Billing
- Payroll
- Reports
- Settings

Keep **Talk to Joy** persistent but visually secondary.

---

# 5. Scheduling Header

## Scheduling

Supporting text:

> Manage client schedules, caregiver assignments, and open shifts.

### Primary controls

Keep compact:
- **Today**
- Previous / Next date controls
- **Day**
- **Week**
- **Month**
- Filter
- Search
- One **Quick Add** control

Do not scatter several large add buttons across the page.

---

# 6. Quick Add

Use the same single Quick Add pattern established elsewhere in Joy.

Example menu:

```text
+ New Shift
+ Recurring Schedule
+ Client Visit
+ Assessment
+ Orientation
+ Supervisor Visit
```

Scheduling-related options appear here without creating a row of colored buttons.

---

# 7. Default View

## Recommended Default: Week View

The Week view should be the primary office scheduling workspace.

Users may switch between:

**Day | Week | Month**

Persist the user's preferred view.

---

# 8. Layout

Recommended desktop layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Scheduling     Today   ‹ Aug 10–16 ›     Day | Week | Month         │
│                               Search   Filter   + Quick Add          │
├──────────────────┬───────────────────────────────────────────────────┤
│                  │                                                   │
│ NEEDS YOU        │                SCHEDULE                           │
│                  │                                                   │
│ 2 Open Shifts    │  Mon   Tue   Wed   Thu   Fri   Sat   Sun        │
│ 1 Conflict       │                                                   │
│ 1 Call-Out       │        Drag / Drop schedule canvas               │
│                  │                                                   │
│ [Review →]       │                                                   │
│                  │                                                   │
├──────────────────┴───────────────────────────────────────────────────┤
│ Talk to Joy: "Who can cover Ruth's Friday shift?"                   │
└──────────────────────────────────────────────────────────────────────┘
```

The **schedule canvas gets most of the screen width**.

---

# 9. Schedule Event Design

Each scheduled visit should be easy to scan.

Example:

```text
8:00 AM
Evelyn Carter
Personal Care
Maria Johnson
8:00–12:00
```

Use:
- Client name
- Service/visit type
- Caregiver
- Time
- Small status indicator only when needed

Avoid:
- Large colored blocks
- Multiple badges
- Excessive secondary text
- Rainbow caregiver colors

---

# 10. Open Shift Design

Unassigned shifts must be visually obvious without turning the entire calendar red.

Example:

```text
2:00 PM
Ruth Alvarez
Companion Care
OPEN
```

Optional line:

> **Open · 3 caregiver matches**

Clicking the shift opens its detail drawer.

---

# 11. Drag-and-Drop Behavior

Drag/drop is a required V1 feature.

Authorized users should be able to:
- Move a visit to another date/time
- Reassign a caregiver
- Fill an open shift
- Reschedule a visit

## Important

**Dropping does not immediately finalize the change.**

After drop, open a compact confirmation sheet:

```text
Change this visit?

Evelyn Carter
Monday, Aug 10
8:00 AM → 10:00 AM

Caregiver: Maria Johnson

This change will notify:
✓ Maria Johnson
✓ Evelyn Carter / Family Contact

[Cancel]       [Confirm Change]
```

This prevents accidental schedule changes.

---

# 12. Drag/Drop Validation

Before confirmation, Joy checks:
- Caregiver availability
- Overlapping caregiver shifts
- Client overlap
- Travel/time feasibility where data exists
- Employee qualifications / required skills
- Employee status
- Relevant scheduling restrictions
- Overtime risk
- Orientation/readiness status where applicable

If there is a conflict:

> **This change creates a scheduling conflict.**

Then explain why.

Example:

> Maria already has a visit from 10:00 AM–2:00 PM.

Actions:
- **Keep Original**
- **Choose Another Caregiver**

AI may suggest alternatives.

---

# 13. Visit Detail Drawer

Clicking any scheduled visit opens a right-side drawer.

## Example

### Evelyn Carter

**Personal Care**

Monday, Aug 10  
8:00 AM–12:00 PM

### Assigned

**Maria Johnson**

### Status

Confirmed

### Quick Actions
- Change time
- Change caregiver
- Mark open
- Cancel visit
- Add note
- View client
- View employee

### Communication

Last notification:

> Schedule confirmed via Spruce

### Activity
- Shift created
- Maria assigned
- Confirmation sent
- Schedule changed

Keep detailed history collapsed unless requested.

---

# 14. Recurring Scheduling

Recurring schedules are required.

Example:

```text
Every:
Monday, Wednesday, Friday

8:00 AM–12:00 PM

Starting:
Aug 10

Ending:
No end date
```

Allow:
- Repeat daily
- Repeat selected weekdays
- Weekly
- Custom recurrence
- End date / no end date

## Editing Recurring Shifts

When changing one instance:

> Apply change to:

- This visit only
- This and future visits
- Entire series

---

# 15. Month View

Month view is required.

Purpose:
- High-level coverage visibility
- Assessments/orientations/visits
- Open shifts
- Supervisor visits
- Major office events

Do not show every detail inside every calendar cell.

Example:

```text
10
8 visits
1 open shift
1 assessment
```

Click the date to open that day's schedule.

---

# 16. Day View

Day View should be useful for detailed daily staffing.

Display a vertical timeline.

Optional grouping:
- By client
- By caregiver

---

# 17. Needs You

Use one small **Needs You** panel beside the calendar.

Only actionable scheduling items belong here.

Example:

## Needs You

**2 Open Shifts**

**1 Caregiver Call-Out**

**1 Scheduling Conflict**

**Review →**

When there is nothing requiring action:

> **Schedule is covered.**

---

# 18. Caregiver Availability

Availability should feed scheduling automatically.

Caregiver records may include:
- Available days
- Available times
- Preferred hours
- Maximum hours
- Client preferences where relevant
- Requested time off
- Unavailable dates

Joy should use availability when determining valid assignments.

---

# 19. AI Scheduling Assistant

Joy AI should be able to work directly with the scheduling engine.

Example requests:
- "Who can cover Ruth's Friday shift?"
- "Move Samantha's Tuesday visits to Thursday where possible."
- "Find coverage for tomorrow's open shifts."
- "Show me scheduling conflicts next week."
- "Swap Maria off Mrs. Carter's Friday visit."
- "Fill this shift with the best available caregiver."
- "Show me everyone approaching overtime."

## AI Authority

AI may:
- Search schedules
- Find matches
- Recommend caregivers
- Prepare changes
- Move/reschedule visits after authorization
- Prepare notifications
- Identify conflicts
- Batch proposed changes

AI should **not silently make consequential schedule changes**.

Default pattern:

```text
User Request
     ↓
Joy Analyzes
     ↓
Joy Shows Proposed Change
     ↓
Human Confirms
     ↓
Schedule Updates
     ↓
Spruce Notifications Send
```

---

# 20. AI Batch Changes

Example:

> "Move all of Mrs. Carter's visits next week from 8 AM to 9 AM."

Joy returns:

```text
5 visits will change.

Mon Aug 10    8:00 → 9:00
Tue Aug 11    8:00 → 9:00
Wed Aug 12    8:00 → 9:00
Thu Aug 13    8:00 → 9:00
Fri Aug 14    8:00 → 9:00

Affected:
1 client
2 caregivers

No conflicts found.

Notifications will be sent through Spruce.

[Cancel]       [Confirm 5 Changes]
```

---

# 21. AI Match Suggestions

For an open shift:

## Suggested Caregivers

**1. Maria Johnson**  
Available  
12 min away  
Qualified  
32 hrs scheduled this week

**2. Samantha Chen**  
Available  
Qualified  
28 hrs scheduled

**3. Danielle Carter**  
Available  
Qualified  
39 hrs scheduled  
*Overtime risk*

Do not create opaque AI scores.

Explain why someone is recommended.

---

# 22. Spruce Notifications

Once a schedule change is confirmed, Joy should create a notification event.

## Employee Notification

> **Joy Health Schedule Update**  
> Your visit with Evelyn Carter has been updated.  
> Monday, Aug 10  
> New time: 10:00 AM–2:00 PM  
> Please reply if you have questions.

## Client / Family Notification

> **Joy Health Schedule Update**  
> Evelyn's Monday care visit has been updated to 10:00 AM–2:00 PM. Maria Johnson remains the assigned caregiver.

Message wording should be configurable.

---

# 23. Which Changes Trigger Notifications?

Default triggers:
- New visit assigned
- Caregiver changed
- Visit time changed
- Visit date changed
- Shift cancelled
- Open shift accepted/assigned
- Recurring schedule changed

Normally do **not** notify for:
- Internal office note
- Internal tag
- Scheduler-only administrative field
- Draft/proposed AI change

Only **confirmed schedule changes** trigger communication.

---

# 24. Notification Confirmation

After schedule change:

```text
Schedule updated

✓ Maria Johnson notified
✓ Carter family notified

Sent through Spruce
```

If delivery fails:

```text
Schedule updated

! Caregiver notification failed

[Retry]
```

Never make the scheduler wonder whether people were informed.

---

# 25. Spruce Contact Mapping

Joy client and employee records should store the appropriate Spruce contact/integration reference.

Conceptually:

```text
Joy Client ID
      ↕
Spruce Contact ID

Joy Employee ID
      ↕
Spruce Contact ID
```

This avoids guessing recipients each time.

---

# 26. Spruce Webhooks

Where useful, Spruce webhooks can return communication activity back to Joy.

Possible future statuses:
- Message sent
- Message created
- Reply received
- Conversation updated

Do not overbuild message synchronization in V1.

### V1 Goal

Joy should confidently know:

> **The notification request was successfully sent to Spruce.**

Deeper two-way communication history can come later.

---

# 27. Call-Out Workflow

When an employee calls out:

1. Open shift/visit
2. Select **Caregiver Call-Out**
3. Original caregiver removed or marked unavailable
4. Shift becomes Open
5. Joy finds qualified available matches
6. Scheduler reviews suggestions
7. Outreach can be prepared/sent
8. Replacement assigned
9. Client/family notified of relevant confirmed change
10. Activity logged

---

# 28. Open Shift Workflow

```text
Open Shift
     ↓
Joy Matches Available Caregivers
     ↓
Scheduler Reviews
     ↓
Offer / Outreach
     ↓
Caregiver Accepts
     ↓
Scheduler Confirms
     ↓
Shift Assigned
     ↓
Employee + Client/Family Notified
```

---

# 29. Scheduling Conflicts

Potential conflict types:
- Employee double-booked
- Client double-booked
- Caregiver unavailable
- Overtime risk
- Insufficient travel time
- Missing qualification
- Employee not active/ready
- Requested time off
- Recurrence collision

Example:

> **Conflict**  
> Samantha is already assigned from 1:00–5:00 PM.

Action:

**See available caregivers**

---

# 30. Schedule Change Audit Trail

Every confirmed schedule change should log:
- Original date/time
- New date/time
- Original caregiver
- New caregiver
- Who made the change
- Whether AI prepared the change
- Who approved it
- Date/time
- Reason when applicable
- Notification status

---

# 31. AI Audit Rule

If Joy AI prepares a schedule adjustment:

> **Prepared by Joy AI · Approved by Ren Robinson**

This creates a clear accountability trail.

---

# 32. Filters

Possible filters:
- Client
- Caregiver
- Open shifts
- Visit type
- Status
- Office/team
- Unassigned
- Conflicts

Use a compact filter button and drawer/popover.

---

# 33. Search

Scheduling search should find:
- Client
- Employee/caregiver
- Visit
- Address
- Date where practical

Example:

> Search client or caregiver...

---

# 34. Empty States

### No open shifts
> **Everything is covered.**

### No schedule conflicts
> **No scheduling conflicts found.**

### No visits
> **No visits scheduled.**

Offer the relevant action:

**+ Add Shift**

---

# 35. Mobile / Tablet

Desktop is primary.

Tablet:
- Maintain calendar usability
- Collapse Needs You
- Visit drawer can become full-width sheet

Mobile:
- Default to Day / Agenda view
- Use tap-to-reschedule and reassign
- Month view remains high-level
- AI can simplify scheduling through natural language

---

# 36. Permissions

### CEO / Administrator
Full schedule control

### Scheduler
Create/edit/assign/reschedule

### RN / Supervisor
View and edit relevant events where permitted

### Caregiver
View own schedule only

### Client / Family
View applicable confirmed schedule only

---

# 37. Visual Design

Use:
- Mostly white
- Soft neutral page background if needed
- Subtle gray dividers
- Dark readable text
- Minimal Joy blue accent
- Large whitespace
- Clean typography
- Soft rounded surfaces
- Tiny status indicators

Avoid:
- Blue backgrounds
- Rainbow shift cards
- Color-coding every caregiver
- Huge KPI rows
- Excessive pills/badges
- Clinical-looking interface
- Heavy shadows
- Dense enterprise calendar styling
- Too many controls exposed at once

The schedule should feel **calm even on a busy day**.

---

# 38. First High-Fidelity Mockup

Create:

## Scheduling — Weekly View

Show:
- Joy standard navigation
- Week of Aug 10–16
- Day / Week / Month control
- Quick Add
- Small Needs You panel
- Main weekly calendar
- Several assigned visits
- Two open shifts
- One subtle conflict indicator
- Talk to Joy entry
- One visit drawer open

Keep the page spacious.

---

# 39. Second Mockup

## Drag-and-Drop Confirmation

Scenario:

A scheduler drags Evelyn Carter's Monday visit from:

**8:00 AM → 10:00 AM**

Show:
- Old time
- New time
- Assigned caregiver
- Conflict result
- People who will be notified
- Cancel
- Confirm Change

---

# 40. Third Mockup

## AI Schedule Change Review

User request:

> "Move Evelyn Carter's visits next week from 8 AM to 9 AM."

Joy shows:
- 5 proposed changes
- Conflict check
- Affected caregivers
- Affected client/family
- Spruce notification note
- Cancel
- Confirm Changes

---

# 41. Fourth Mockup

## Month View

Each date shows high-level counts only.

Example:

```text
12
7 visits
1 open
```

Avoid stuffing detailed appointment cards into small cells.

---

# 42. V1 Build Boundary

## Include in V1
- Day / Week / Month
- Drag/drop
- Recurring schedules
- Open shifts
- Assignment/reassignment
- Availability checking
- Basic conflict checking
- Schedule change confirmation
- Visit detail drawer
- AI match suggestions
- AI proposed schedule changes
- Human confirmation
- Spruce outbound notifications
- Notification status
- Audit log
- Quick Add

## Do Not Overbuild V1
- Full live GPS tracking
- Complex route optimization
- Autonomous AI schedule changes without approval
- Full two-way Spruce inbox inside Joy
- Advanced forecasting
- Staffing analytics dashboards
- Custom workflow builder
- Dozens of calendar color rules
- Separate scheduling systems for clients and employees

One scheduling engine should power all views.

---

# 43. Technical / Product Architecture

```text
                         JOY
                          │
                 Scheduling Database
                          │
        ┌─────────────────┼───────────────────┐
        │                 │                   │
    Calendar UI       Joy AI Layer       Notification Layer
        │                 │                   │
   Drag / Drop       Propose Changes         Spruce API
        │                 │                   │
        └────────── Human Approval ───────────┘
                          │
                    Confirmed Schedule
```

There is **one official Joy schedule**.

Everything else acts on it.

---

# 44. Simple Change Event Model

Every confirmed schedule change can generate one internal event:

```text
schedule.updated
```

Payload concept:

```text
Visit ID
Client ID
Employee ID
Old Date/Time
New Date/Time
Old Assignment
New Assignment
Change Type
Changed By
AI Assisted? Yes/No
Notification Required? Yes/No
```

Then:
- Audit service records it
- Spruce adapter sends required messages
- UI updates
- Relevant task/status logic runs

---

# 45. Failure Handling

A schedule change and a message notification are separate events.

Example:

**Schedule saved successfully**

but

**Spruce message failed**

Do not roll back the schedule just because the notification service failed.

Instead:

```text
Schedule updated
Notification needs retry

[Retry Notification]
```

Log the failure and surface it to authorized staff.

---

# 46. Final Product Principle

The ideal workflow is:

> **See schedule → move something → Joy checks it → confirm → everyone is notified.**

Or:

> **Ask Joy → review the proposed change → confirm → everyone is notified.**

---

# 47. Final Designer Direction

Create a scheduling experience that feels expensive because the complexity is hidden.

The scheduler needs:
- Context
- A clear calendar
- The right next action
- Fast drag/drop
- AI assistance
- Reliable communication

Everything else should stay behind the interface until needed.
