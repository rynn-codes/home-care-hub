# Joy Health — Codex Engineering Kickoff
## Master V1 Implementation Brief

**Project:** Joy Health Home Care Operating System  
**Audience:** Codex / engineering agent  
**Purpose:** Convert the approved Joy Health workflows and designs into a maintainable V1 application without re-inventing the product.

---

# 1. Read This Before Coding

Joy Health is an **AI-first Home Care Operating System**, not a generic CRM, ATS, EHR, scheduling tool, or payroll app.

Preserve these approved principles:

- **AI drafts. Humans approve.**
- **Enter once. Reuse everywhere.**
- **Every workflow autosaves.**
- **Graceful failure for critical workflows.**
- **Calm before complexity.**
- **One source of truth.**
- OpenAI is the primary AI provider behind a provider abstraction.
- AI-assisted assessment supports voice, photo, and manual entry.
- AI uncertainty should surface concrete review items, not a confusing score dashboard.
- Offline recovery/resume is required for field-assessment workflows.
- Humans remain responsible for consequential clinical, hiring, payroll, scheduling, and admission decisions.

Do not replace approved Joy UX with a generic admin template.

---

# 2. Existing Specs Are Source of Truth

Before implementing a module, inspect the corresponding approved artifact if it exists.

Primary project specs include:

- `Joy_Health_Dashboard_Claude_Revision_3.md`
- `Joy_Health_Admissions_Master_Build_Spec.md`
- `Joy_Health_Phone_Intake_Claude_Design_Master_Spec.md`
- `Joy_Health_Hiring_Screen_Roadmap.md`
- `Joy_Health_Payroll_Mockup_Build_Spec.md`
- `Joy_Health_Scheduling_Build_Spec.md`
- Patient Consents packet
- Client Intake Form
- Joy nursing assessment
- Joy Product Bible v1.0 Builder Edition

If the repo contains approved Claude/Lovable mockups, preserve their information architecture and visual direction.

If code and source specs conflict, do not silently invent a new business rule. Document the mismatch.

---

# 3. First Codex Task: Inspect the Repository

Before adding dependencies or generating a new application:

1. Inspect the file tree.
2. Identify the framework and package manager.
3. Inspect routing, components, design system, database, auth, API setup, tests, and environment variables.
4. Run the existing build, lint, and test commands.
5. Do not create a second frontend if one already exists.
6. Do not replace a working framework simply because another framework is preferred.

Create:

`docs/IMPLEMENTATION_STATUS.md`

Document:

- current stack;
- current working screens;
- existing backend/data layer;
- missing foundations;
- integration status;
- Sprint 0 gaps;
- Sprint 1 plan;
- known blockers.

---

# 4. Default Architecture Only If Repo Is Blank

If there is no established stack, use a modern TypeScript full-stack web architecture.

Recommended baseline:

- React-based full-stack framework
- TypeScript strict mode
- PostgreSQL
- typed ORM/query layer
- committed schema migrations
- secure session authentication
- server-enforced role/permission checks
- private object storage for sensitive documents
- background/outbox job processing for integration retries
- accessible headless UI primitives
- reusable Joy design system

Do not introduce microservices for V1 unless the existing architecture already requires them.

---

# 5. Integration Boundaries

External systems must sit behind adapters.

Create interfaces for:

- OpenAI
- Spruce
- GoHighLevel
- Gusto
- future payments
- future background-check provider

Example:

```ts
interface AIProvider {
  structurePhoneIntake(input: IntakeAIInput): Promise<IntakeAIDraft>;
  structureAssessment(input: AssessmentAIInput): Promise<AssessmentAIDraft>;
  summarizeRecord(input: SummaryInput): Promise<StructuredSummary>;
  proposeScheduleChange(input: ScheduleChangeInput): Promise<ScheduleProposal>;
}

interface MessagingProvider {
  upsertContact(input: MessagingContactInput): Promise<ExternalContactRef>;
  sendMessage(input: OutboundMessageInput): Promise<MessageSendResult>;
}
```

Do not scatter vendor SDK calls throughout React components.

---

# 6. Main Joy Navigation

Use:

```text
Home
Operations
Admissions
People
Scheduling
Billing
Payroll
Reports
Settings
```

`Talk to Joy` is persistent AI access, not another main module.

Hiring lives under:

`Operations → Hiring`

---

# 7. Visual Constitution

Joy must stay calm and premium.

Use:

- warm white / light neutral page backgrounds;
- white content surfaces;
- dark charcoal text;
- subtle borders;
- minimal shadows;
- generous whitespace;
- rounded corners;
- restrained iconography;
- clear typography hierarchy.

Joy Royal Blue:

`#1407A2`

Use it sparingly for:

- active navigation;
- primary actions;
- selected states;
- important links;
- small Joy/AI accents.

Never use:

- blue page backgrounds;
- rainbow workflow columns;
- giant KPI-card rows;
- dense Salesforce-style tables;
- decorative gradients;
- giant AI hero panels;
- charts without an operational decision purpose.

---

# 8. Reusable Work-Queue Pattern

Several Joy modules use:

```text
Needs You
Waiting
Moving Forward
```

Meaning:

- **Needs You** — a Joy Health user must act.
- **Waiting** — Joy is waiting on a person/system/event.
- **Moving Forward** — the next milestone is already progressing.

Build reusable query/UI patterns instead of duplicating three different list systems per module.

---

# 9. Core Identity/Data Model

Use normalized entities and one source of truth.

## `organizations`

- id
- name
- timezone
- office_address
- phone
- settings_json
- created_at
- updated_at

## `users`

- id
- organization_id
- first_name
- last_name
- email
- role
- status
- created_at
- updated_at

Suggested roles:

```text
ceo_admin
intake_coordinator
rn_clinical
scheduler
payroll
billing
hr
employee
client_contact
```

## `people`

- id
- organization_id
- first_name
- preferred_name
- last_name
- date_of_birth nullable
- phone nullable
- email nullable
- address fields nullable
- created_at
- updated_at

## `client_profiles`

- id
- person_id unique
- client_status
- admission_date nullable
- emergency_priority nullable
- created_at
- updated_at

## `employee_profiles`

- id
- person_id unique
- employee_status
- job_role
- hire_date nullable
- ready_to_work_at nullable
- gusto_external_id nullable

## `relationships`

Use for daughter/spouse/responsible party/emergency contact/etc.

- id
- subject_person_id
- related_person_id
- relationship_type
- is_primary_contact
- is_emergency_contact
- is_responsible_party
- is_authorized_for_care_coordination

Do not create duplicate family/client/employee records merely because they appear in another workflow.

---

# 10. Admissions — First Major Vertical Slice

Admissions flow:

```text
Referral
  ↓
Phone Intake
  ↓
Assessment Scheduling
  ↓
RN Assessment
  ↓
Assessment Review / Decision
  ↓
Pre-Onboarding
  ↓
Ready for Admission
  ↓
Start-of-Care Handoff
  ↓
Active Client
```

The permanent client record ultimately lives under `People → Clients`.

Admissions is the process. People is the record.

Do not create a second client record when a person becomes admitted.

## `admissions`

- id
- organization_id
- client_person_id
- stage
- status
- referral_source
- assigned_user_id nullable
- closed_at nullable
- close_reason nullable
- created_at
- updated_at

Suggested stages:

```text
new_referral
phone_intake
assessment
pre_onboarding
ready_for_admission
admitted
closed
```

---

# 11. Phone Intake Model

The approved two-page Client Intake Form is the data basis.

## `phone_intakes`

- id
- admission_id unique
- intake_date
- staff_user_id
- caller_person_id nullable
- caller_name_snapshot nullable
- caller_relationship nullable
- caller_phone nullable
- caller_email nullable
- referral_source nullable
- living_situation nullable
- primary_diagnosis_reported nullable
- primary_reason_care_needed text nullable
- what_matters_most text nullable
- anticipated_start_date nullable
- hours_per_week nullable
- payment_source nullable
- payment_notes nullable
- additional_notes nullable
- status
- completed_at nullable
- completed_by_user_id nullable
- created_at
- updated_at

## `phone_intake_needs`

Allowed V1 values:

```text
bathing
dressing
feeding
toileting
mobility
housekeeping
transportation
shopping_errands
companionship
other
```

## `phone_intake_requested_days`

- id
- phone_intake_id
- weekday

Important source-form rule:

> Client address should be collected/confirmed during assessment scheduling rather than forcing a full-address question at the beginning of the call.

---

# 12. Phone Intake UX

Two modes write to the same record.

## A. AI-Assisted Conversation

Default/recommended.

Must support:

- Start Intake with Joy
- live structured capture when enabled
- captured facts
- still-needs-confirmation list
- Question Guide drawer
- Preview dropdown
- review/correction
- Typeform-style gap completion
- Complete Intake & Continue

Do not show a transcript wall by default.

## B. Manual Typeform-Style Intake

Must work without AI.

Reusable components:

- `TypeformShell`
- `IntakeQuestionShell`
- `LargeChoice`
- `MultiChoice`
- `VoiceTextArea`
- `KnownInfoCard`
- `JoyCapturedCard`
- `NeedsReviewCard`
- `SummarySection`
- `PreviewDrawer`
- `QuestionGuideDrawer`
- `SaveState`

Manual sequence:

```text
Caller
Client
Clinical Snapshot
Care Needs
What Matters Most
Requested Schedule
Payment Source
Review
Assessment Decision
Assessment Scheduling
```

Implement **manual mode first**. It defines the structured schema that AI later fills.

---

# 13. Phone Intake AI Output

Do not parse important workflow data from free-form prose.

Use structured validation.

Example:

```ts
interface PhoneIntakeAIDraft {
  caller?: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  livingSituation?: string;
  careNeeds: Array<{
    type: string;
    evidence?: string;
  }>;
  primaryDiagnosisReported?: string;
  primaryReasonCareNeeded?: string;
  whatMattersMost?: string;
  requestedSchedule?: {
    weekdays?: string[];
    timePreference?: string;
    anticipatedStartDate?: string;
    hoursPerWeek?: number;
  };
  paymentSource?: string;
  missingFields: string[];
  uncertainFields: Array<{
    field: string;
    reason: string;
  }>;
}
```

AI may draft. Human confirmation makes the field official.

---

# 14. Autosave

Autosave is mandatory.

Requirements:

- immediate local state update;
- debounced server persistence;
- visible `Saving…` / `Saved just now`;
- draft recovery after refresh;
- stale-write protection;
- no field loss during section navigation.

Assessment later also requires offline local persistence + sync.

If AI fails, manual mode must remain fully usable.

---

# 15. Assessment Scheduling Uses the Central Joy Schedule

Do not build a separate Admissions calendar.

## `schedule_events`

- id
- organization_id
- event_type
- client_person_id nullable
- employee_person_id nullable
- admission_id nullable
- starts_at
- ends_at
- timezone
- location/address
- status
- recurrence_rule nullable
- created_by_user_id
- created_at
- updated_at

Initial event types:

```text
rn_assessment
client_visit
orientation
field_orientation
supervisor_visit
internal_event
```

Assessment scheduling must capture:

- client;
- assessment type;
- RN/assessor;
- date/time;
- expected duration;
- address;
- contact person;
- phone;
- email;
- access notes;
- pre-assessment documents;
- notification recipients.

---

# 16. Spruce Messaging Pattern

Joy owns workflow state.

Spruce owns client/family/employee messaging.

Flow:

```text
Business action succeeds
      ↓
Domain event/outbox
      ↓
Communication job
      ↓
Spruce
      ↓
Sent / Failed
```

A failed message must **not** roll back a successfully scheduled assessment or schedule change.

## `communication_events`

- id
- organization_id
- entity_type
- entity_id
- recipient_person_id nullable
- channel
- provider
- provider_message_id nullable
- template_key
- status
- error_code nullable
- error_message nullable
- created_at
- sent_at nullable

Statuses:

```text
queued
sent
failed
cancelled
```

Support retry.

---

# 17. Domain Event / Outbox Foundation

Create this early.

## `domain_events`

- id
- organization_id
- event_type
- aggregate_type
- aggregate_id
- payload_json
- status
- attempts
- created_at
- processed_at nullable
- last_error nullable

Events may include:

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
schedule.updated
candidate.stage_changed
payroll.exception_resolved
```

Use durable asynchronous processing without over-engineering V1.

---

# 18. RN Assessment — Next Admissions Phase

Approved high-level experience:

```text
Phone Intake context
      ↓
RN starts assessment
      ↓
AI Conversation Mode by default
      ↓
Joy fills structured assessment
      ↓
Typeform questions fill remaining gaps
      ↓
Preview ▾
  Assessment
  Patient Consents
  Draft Plan of Care
      ↓
Client Mode for guided consents
      ↓
Client signs
      ↓
RN resolves review items
      ↓
RN signs/completes assessment
```

## `assessments`

- id
- admission_id
- client_person_id
- assessor_user_id
- assessment_type
- started_at nullable
- completed_at nullable
- status
- version
- created_at
- updated_at

## `assessment_sections`

Initial keys:

```text
client_contacts
reason_for_care
living_situation_home_safety
functional_status
cognition_behavior_risk
medications
providers
services_needed
schedule_recommendation
special_precautions
emergency_priority
education
rn_recommendations
review
```

Do not store the entire assessment only as one opaque blob if downstream scheduling/care operations need specific fields.

---

# 19. Consents and Signatures

Use the current Patient Consents packet. Do **not** implement the obsolete 6-page agreement.

Requirements:

- structured admission/assessment data auto-populates the formal packet;
- guided Typeform-like Client Mode is the default UX;
- `Preview ▾` allows full agreement/document preview;
- full legal language can be expanded/read;
- client gives one handwritten initial + one handwritten signature for the signing session;
- every distinct consent still records its own explicit Agree / Decline / N/A decision where applicable;
- representative name/relationship is captured when signing for the client;
- RN/company signatures remain separately attributable where required;
- finalized signed documents are immutable/versioned.

Suggested:

## `consent_sessions`

- id
- admission_id
- client_person_id
- signer_person_id nullable
- signer_name
- signer_relationship nullable
- signature_asset_id
- initials_asset_id
- started_at
- completed_at nullable

## `consent_decisions`

- id
- consent_session_id
- consent_key
- decision
- acknowledged_at
- signature_applied
- initials_applied
- metadata_json

## `documents`

- id
- organization_id
- owner_type
- owner_id
- document_type
- storage_key
- mime_type
- version
- status
- created_by_user_id nullable
- created_at
- finalized_at nullable

Do not overwrite finalized signed documents.

Obtain legal/compliance review before production use of one captured signature/initial across distinct authorizations.

---

# 20. Scheduling V1

Approved requirements:

- Day / Week / Month
- drag/drop
- recurring shifts
- open shifts
- caregiver availability
- assignment/reassignment
- conflict checking
- confirmation before consequential changes
- AI match suggestions
- AI-proposed schedule changes
- human confirmation
- Spruce notifications
- notification status
- audit history
- Quick Add

Architecture rule:

> **There is one official Joy schedule. UI, AI, and Spruce act on it; they do not each maintain separate schedule state.**

Change flow:

```text
Proposed change
  ↓
Validation
  ↓
Human confirmation
  ↓
Transactional schedule update
  ↓
Domain event
  ↓
Spruce notification
```

Keep conflict logic in domain services, not calendar components.

---

# 21. Hiring / Onboarding Continuum

Flow:

```text
GHL / applicant source
  ↓
Interview
  ↓
Application + Documents
  ↓
Background
  ↓
Decision
  ↓
Offer
  ↓
Gusto / HR Onboarding
  ↓
Orientation
  ↓
Field Orientation
  ↓
First Shift
  ↓
Week 1 Follow-Up
  ↓
Active Employee
```

Joy should not recreate Gusto.

No-show interviews must remain documented.

Employee application data should progressively build the permanent employee profile.

## `candidates`

Suggested stages:

```text
interview
documents
background
decision
offer
onboarding
ready
closed
```

Potential requirements:

```text
employee_application
resume
cpr
immunizations
tb
drivers_license
background_authorization
social_security_card
other
```

Sensitive identity documents require tighter access controls.

---

# 22. GHL Boundary

Use an adapter + webhook endpoint.

Requirements:

- external IDs;
- idempotent webhook processing;
- no duplicate candidate creation;
- stage/status mapping;
- interview confirmation/no-show/cancel history;
- safe error logging;
- asynchronous processing where practical.

Do not make UI depend directly on GHL payload shapes.

---

# 23. Gusto Boundary

Joy shows operational readiness but does not recreate Gusto.

Hiring needs enough status to know whether an employee can move to the next milestone.

Payroll uses a separate preparation/handoff boundary.

Never show a Gusto action as successful unless the integration actually confirms it.

---

# 24. Payroll Product Model

Payroll is exception management, not a spreadsheet-first accounting system.

Flow:

```text
Collect
  ↓
Reconcile
  ↓
Flag
  ↓
Resolve
  ↓
Approve
  ↓
Prepare for Gusto
  ↓
Confirm
```

The approved Payroll spec includes:

- Monday workflow context;
- different billing vs payroll/LTI/OT periods;
- Needs Review;
- Time/EVV exceptions;
- overtime;
- mileage;
- adjustments;
- readiness checklist;
- LTI / paid-invoice step;
- Gusto preparation state;
- history/audit.

---

# 25. Home / CEO Dashboard

Build the shell early but wire final Home progressively from real domain data.

Approved concepts:

- personalized greeting;
- current date;
- motivational statement;
- compact local weather;
- priority strip;
- Today's Schedule;
- Admissions summary;
- Employee Tasks;
- Compliance;
- Quick Actions;
- Payroll;
- Billing;
- Upcoming Deadlines;
- Recent Activity;
- Joy Assistant available but not dominant.

Do not create fake dashboard-specific data tables. Query the real domain.

---

# 26. AI Safety Model

Use explicit authority levels.

```ts
type AIActionAuthority =
  | 'read_only'
  | 'draft_only'
  | 'propose_change'
  | 'execute_after_human_confirmation';
```

Examples:

- Phone Intake — draft only until human review.
- RN Assessment — draft only; RN completes/signs.
- Scheduling — propose change; human confirms.
- Hiring — summarize/readiness; human employment decision.
- Payroll — identify/draft; human approves.
- Admissions — prepare summary; human admission decision.

Never give an unrestricted AI agent direct database write access.

---

# 27. Audit Log

Create centrally.

## `audit_entries`

- id
- organization_id
- actor_user_id nullable
- actor_type (`user`, `ai`, `system`, `integration`)
- action
- entity_type
- entity_id
- before_json nullable
- after_json nullable
- metadata_json nullable
- created_at

Audit consequential changes such as:

- intake correction;
- assessment completion;
- signature capture;
- admission approval;
- schedule changes;
- candidate stage changes;
- payroll approvals;
- integration retry/failure.

Do not log sensitive raw document content unnecessarily.

---

# 28. Security / Privacy Baseline

At minimum:

- secure authentication;
- server-enforced RBAC;
- organization scoping on every query;
- private file storage;
- signed file URLs;
- no secrets in repo;
- audit history;
- redact PHI/sensitive data from logs;
- do not place sensitive fields in browser URLs;
- stricter access for Social Security and identity docs;
- appropriate XSS/CSRF/SQL injection protections;
- secure session handling.

Do not claim compliance merely because controls exist. Compliance validation is a separate workstream.

---

# 29. Design System Components

Create reusable primitives:

- `AppShell`
- `SidebarNav`
- `TopBar`
- `PageHeader`
- `QuickAddMenu`
- `SearchField`
- `SegmentedTabs`
- `WorkQueueSection`
- `EntityRow`
- `RightDrawer`
- `SummaryCard`
- `EmptyState`
- `SaveState`
- `JoyInsight`
- `ConfirmationSheet`
- `ActivityTimeline`
- `TypeformShell`
- `LargeChoice`
- `MultiChoice`
- `SignaturePad`
- `DocumentPreviewDrawer`

Avoid page-specific style duplication.

---

# 30. Accessibility

Required:

- semantic HTML;
- keyboard navigation;
- visible focus states;
- accessible dialogs/drawers;
- proper labels/errors;
- color not used as sole status signal;
- tablet-friendly touch targets;
- no hover-only essential actions;
- Typeform screens fully keyboard operable.

---

# 31. Testing

## Unit

- stage transitions;
- work-queue classification;
- required-field rules;
- conflict rules;
- permission rules;
- AI output validation;
- notification rules.

## Integration

- autosave/recovery;
- intake completion;
- assessment scheduling;
- event/outbox creation;
- Spruce mocked success/failure;
- duplicate protection;
- webhook idempotency;
- document finalization.

## Sprint 1 E2E

1. Create referral.
2. Start Phone Intake.
3. Complete manual Typeform path.
4. Preview summary.
5. Complete intake.
6. Schedule assessment.
7. Confirm schedule event exists.
8. Confirm notification job exists.
9. Simulate Spruce success/failure.
10. Reload mid-intake and confirm draft recovery.

---

# 32. Seed Data

Use deterministic fictional seed data.

Examples:

### Marcus Bell
- Personal Care
- daughter: Susan Bell
- Mon–Fri mornings
- approx. 20 hrs/week
- walker
- two recent falls reported
- RN assessment Aug 17, 10:30 AM

### Susan Miller
- Pre-Onboarding
- agreement ready for review

### Evelyn Carter
- Pre-Onboarding
- waiting on family signature

### Robert Green
- Ready for Admission
- start-of-care target Monday

### Hiring
- Jamal Scott
- Jessica Taylor
- Emily Rodriguez

### Payroll
- Maria Johnson — EVV mismatch
- David Okoro — overtime review

Never mix demo seed data into production migrations.

---

# 33. Sprint 0 — Foundation

Build only what is missing:

1. Inspect/preserve current repo.
2. App shell + navigation.
3. Authentication.
4. organization/user/RBAC foundation.
5. database/migrations.
6. People/contact core.
7. audit service.
8. event/outbox foundation.
9. private document abstraction.
10. Joy design-system primitives.
11. error handling.
12. seed data.
13. test harness.
14. environment validation.

Exit criteria:

- sign-in works;
- tenant/role enforcement works;
- app shell matches Joy visual language;
- migrations run;
- seed loads;
- tests/build/lint pass;
- audit and domain events can be persisted.

---

# 34. Sprint 1 — Admissions + Phone Intake

This is the **first full vertical product slice**.

Build in this exact order:

1. Admissions schema and services.
2. Referral create/list/duplicate check.
3. Admissions UI shell.
4. **Complete Manual Phone Intake first.**
5. Autosave/recovery.
6. Intake summary/review/completion.
7. Assessment Scheduling.
8. Messaging provider interface + mock.
9. Notification queue/status/retry.
10. Live Spruce adapter only when credentials are available.
11. AI provider interface + fixture/mock output.
12. Typed Phone Intake AI schema.
13. Live OpenAI implementation behind feature flag.
14. Question Guide + AI/manual hybrid flow.

Why manual first:

> Manual mode defines the exact authoritative structured workflow AI must populate and guarantees that intake remains usable if AI is unavailable.

Sprint 1 exit criteria:

- manual intake works end to end;
- refresh does not lose work;
- referral data carries forward;
- source-form fields are represented;
- summary review works;
- assessment scheduling does not re-enter known data;
- schedule event is persisted;
- notification is queued;
- message success/failure is visible;
- AI can be disabled without breaking the workflow;
- audit entries exist.

---

# 35. Sprint 2 — RN Assessment

Build:

- full assessment workspace;
- inherited Phone Intake context;
- section navigation;
- manual Typeform-style assessment;
- AI conversation mode;
- autosave;
- offline local draft/resume;
- photo/document attachments;
- Needs Review queue;
- Preview dropdown:
  - Assessment
  - Patient Consents
  - Draft Plan of Care
- RN review/signature foundation.

Do not start with raw PDF screens.

---

# 36. Sprint 3 — Consents + Client Signing

Build:

- guided Client Mode;
- consent registry;
- full-language expansion;
- Agree / Decline / N/A decisions;
- one captured client initial;
- one captured client signature;
- representative signing flow;
- document preview;
- deterministic Patient Consents generation;
- signature/initial mapping;
- immutable finalized document storage;
- RN/company signature handling.

Legal/compliance review is required before production rollout of signature reuse across separate authorizations.

---

# 37. Sprint 4 — Admissions Completion

Build:

- RN final review/signature;
- admission decision;
- Pre-Onboarding readiness;
- Plan of Care approval;
- emergency contacts;
- client rights;
- medication/provider handoff;
- responsible party;
- payment setup status;
- Ready for Admission;
- Prepare Start of Care;
- transition to Active Client without duplicate records.

---

# 38. Sprint 5 — Scheduling

Implement approved Scheduling spec:

- Week view first;
- Day/Month;
- drag/drop;
- visit drawer;
- recurring visits;
- open shifts;
- availability;
- conflict service;
- confirmation before schedule update;
- Spruce notification event;
- AI proposed changes with human confirmation;
- audit trail.

---

# 39. Sprint 6 — Hiring / Onboarding

Implement:

- Operations → Hiring;
- work queue;
- stage filters;
- detail drawer;
- interview/no-show;
- employee application/profile reuse;
- document requirements;
- background;
- decision;
- offer;
- Gusto status boundary;
- orientation;
- field orientation;
- first shift;
- Week 1 follow-up;
- Active Employee transition;
- GHL webhooks.

---

# 40. Sprint 7 — Payroll

Implement:

- payroll cycle;
- Monday workflow context;
- Needs Review;
- EVV/time exceptions;
- overtime;
- mileage;
- adjustments;
- readiness;
- approval;
- Gusto preparation boundary;
- LTI/paid-invoice status;
- history/audit.

Do not build a generic accounting system.

---

# 41. Feature Flags

Use flags/configuration for unfinished integrations:

```text
AI_PHONE_INTAKE_ENABLED
AI_ASSESSMENT_ENABLED
SPRUCE_ENABLED
GHL_ENABLED
GUSTO_ENABLED
CONSENT_PDF_GENERATION_ENABLED
```

The app must remain usable when integrations are disabled.

Never show fake success.

---

# 42. Transactions and Idempotency

Use DB transactions for multi-record business operations.

Example assessment scheduling transaction:

1. validate intake/admission;
2. create schedule event;
3. update admission stage;
4. create domain event;
5. create audit entry.

Then process Spruce asynchronously.

Idempotency is required for:

- GHL webhooks;
- Spruce retries;
- Gusto callbacks;
- assessment scheduling double-clicks;
- document finalization;
- signature submission;
- AI retries that could create duplicate side effects.

---

# 43. Error Experience

Preserve user work.

Good:

```text
Assessment scheduled successfully.
The family notification could not be sent.

[Retry notification]
```

AI failure:

```text
Joy couldn't structure this part of the intake.
Your notes are safe.

[Try again] [Continue manually]
```

Autosave failure:

```text
We couldn't sync the last change yet.
Your work is saved locally.
```

Avoid generic “Something went wrong” when a more useful state is known.

---

# 44. Environment Example

Create `.env.example` with names only.

Possible categories:

```text
DATABASE_URL=
AUTH_SECRET=
APP_URL=

OPENAI_API_KEY=

SPRUCE_API_KEY=
SPRUCE_BASE_URL=
SPRUCE_WEBHOOK_SECRET=

GHL_API_KEY=
GHL_LOCATION_ID=
GHL_WEBHOOK_SECRET=

GUSTO_CLIENT_ID=
GUSTO_CLIENT_SECRET=
GUSTO_REDIRECT_URI=

OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

Only include variables actually used by the selected implementation.

---

# 45. Documentation Codex Must Maintain

Create:

```text
docs/
  ARCHITECTURE.md
  IMPLEMENTATION_STATUS.md
  DATA_MODEL.md
  INTEGRATIONS.md
  SECURITY_NOTES.md
  DOMAIN_EVENTS.md
  DECISIONS/
```

Use short ADRs for major decisions.

Examples:

- persistence/auth choice;
- event/outbox strategy;
- AI provider abstraction;
- offline assessment storage;
- consent generation/signature mapping.

---

# 46. Initial Route Map

Adapt to the existing framework:

```text
/home
/operations
/operations/hiring
/admissions
/admissions/:id
/admissions/:id/intake
/admissions/:id/assessment
/people
/people/clients/:id
/people/employees/:id
/scheduling
/billing
/payroll
/reports
/settings
```

Routine details should use drawers even when full deep-link routes exist.

---

# 47. Golden Sprint 1 Demo

Starting state:

`Tammy Wilson — New Referral`

Golden flow:

1. Open Tammy.
2. Start Intake.
3. Referral fields are pre-filled.
4. Complete manual Typeform intake.
5. Record caller/contact.
6. Record living situation.
7. Record reason for care.
8. Select broad care needs.
9. Record “what matters most.”
10. Select proposed days.
11. Record anticipated start/hours.
12. Select payment source.
13. Preview Intake Summary without losing place.
14. Complete Intake.
15. Choose Schedule RN Assessment.
16. Existing contact data carries forward.
17. Confirm/add assessment address.
18. Assign RN/date/time/duration.
19. Select Spruce recipient.
20. Schedule.
21. Schedule event exists.
22. Domain event exists.
23. Communication job exists.
24. Success or retry state appears.
25. Admission moves to Assessment.
26. RN Assessment can see the Phone Intake context.

No duplicate person/client/admission should be created.

---

# 48. Sprint 1 Failure Tests

Test:

- refresh midway through intake;
- network failure during autosave;
- assessment saved but Spruce fails;
- duplicate Schedule click;
- duplicate referral;
- malformed AI output;
- AI unavailable;
- invalid email;
- address not known until scheduling;
- abandoned intake resumed later;
- unauthorized role;
- cross-organization access attempt;
- duplicate webhook/event.

The app must preserve work and fail safely.

---

# 49. What “Done” Means

A screen is not done because it visually resembles a mockup.

For a workflow screen, Done means:

- approved visual system;
- real persisted data;
- loading state;
- empty state;
- permissions;
- validation;
- error state;
- autosave where required;
- audit where consequential;
- accessibility;
- responsive behavior;
- tests;
- no fake integration success;
- no dead buttons.

---

# 50. Code Quality Rules

- TypeScript strict where applicable.
- Avoid `any`.
- Domain logic outside UI components.
- Vendor logic behind adapters.
- Shared client/server validation.
- Small composable components.
- Explicit enums/state transitions.
- DB constraints for integrity.
- Migrations in source control.
- Avoid premature microservices.
- Avoid speculative abstractions.
- Tests with consequential workflow changes.
- Never silently invent missing business rules.

---

# 51. First Prompt to Give Codex

After adding this file to the repository:

> **Read `Joy_Health_Codex_Engineering_Kickoff.md` and inspect the repository before changing code. Create `docs/IMPLEMENTATION_STATUS.md` with the current stack, working features, gaps, and Sprint 0 plan. Implement only missing Sprint 0 foundations. Preserve existing approved Joy UI. Run the existing build/test/lint suite before and after changes.**

After Sprint 0 review:

> **Implement Sprint 1 in the exact order in this document, beginning with Admissions schema/services and the complete Manual Phone Intake vertical slice. Use `Joy_Health_Phone_Intake_Claude_Design_Master_Spec.md` as the detailed UI/behavior source of truth. Do not require live AI or Spruce credentials for the first working slice; use provider interfaces and mocks.**

---

# 52. Final Engineering Principle

Do not measure progress by the number of modules generated.

Measure progress by completed vertical workflows.

The product should feel sophisticated because complexity is handled behind the scenes.

> **Information flows forward. Joy prepares the work. Humans stay in control. The user always knows the next action.**
