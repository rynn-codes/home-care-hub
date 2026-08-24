# Handoff: Joy Health Operations Platform

## Overview

Joy Healthcare Services, LLC is a Houston, TX home health / home care agency. This handoff covers the full internal operations platform: a single web app the office staff live in all day, organized around **frontline work queues** ("what has to happen today") rather than reports and dashboards.

Twelve screens are designed. They cover the whole business:

| Domain | Screens |
|---|---|
| Daily command | **The Brain** (home — current), Command Center + Brief Band (earlier explorations) |
| Growth | Hiring, Admissions, Phone Intake, Assessment |
| Delivery | Scheduling, Clients, Employees |
| Money | Billing, Payroll |

**Last refreshed:** August 24, 2026. `designs/` holds the current files; `screenshots/` are older captures and are stale where noted below — trust the HTML over the PNGs.

The product thesis, and the thing to preserve above all else: **the software remembers the process, surfaces what is missing, and tells the user what should happen next.** The user should never have to know the process by heart, and should never re-type anything the agency already collected.

---

## About the Design Files

The files in `designs/` are **design references written as HTML prototypes.** They are not production code and should not be copied into the app.

They are written in a small in-house template runtime (`support.js`, `<x-dc>` custom element, `{{ }}` holes, `<sc-for>` / `<sc-if>`, inline styles only). That runtime exists so a designer can iterate quickly in a browser. **Do not port the runtime.** Do not port the inline-style approach either.

Your job: **recreate these screens in the target codebase's real environment,** using its established patterns. If there is no codebase yet, pick the stack (recommendation below) and build it properly:

- Components, not one 1000-line file per screen.
- A real design-token layer (CSS variables / Tailwind theme / theme object) seeded from the token table in this README.
- Real data models and API calls where the prototypes use hard-coded seed arrays.
- Real routing where the prototypes use `window.location.href = './Joy%20Health%20Billing.dc.html'`.

**Recommended stack if greenfield:** React + TypeScript + Vite, TanStack Router, TanStack Query, Tailwind (with the tokens below mapped into `theme.extend`), Radix primitives for menus/dialogs/tooltips, `dnd-kit` for the Scheduling drag-and-drop, `react-hook-form` + Zod for the Assessment and Phone Intake forms, Postgres + Prisma. Nothing in the designs requires more than that.

## Fidelity

**High fidelity.** Colors, type sizes, spacing, radii, copy, empty states, and interaction states are all final and intentional. Recreate them precisely. Every hex value, font size, and border radius in `designs/` is a decision, not a placeholder.

Two things are deliberately *not* final:
- Seed data (names, dollar amounts, dates) is illustrative. Marcus Bell, Susan Bell, Joan Robinson RN etc. are fictional.
- Any AI/"Joy" response text is scripted for the demo. Real behavior is described under **Joy (the assistant)** below.

---

## Design Tokens

### Color

Joy is a white, quiet, high-density product. The blue is used sparingly — for the primary action and for "you are here." If a screen looks colorful, it is wrong.

| Token | Hex | Use |
|---|---|---|
| `--joy-blue` | `#1407A2` | Primary action, active nav, selected state, links |
| `--joy-blue-hover` | `#2A1BD1` | Link/hover on blue |
| `--joy-blue-wash` | `#EEF0FE` | Selected chip background, badge background |
| `--joy-blue-wash-2` | `#F7F8FE` | Selected card background, Joy assistant note background |
| `--joy-blue-border` | `#E0E3FB` / `#DDE0F8` | Joy note border / card hover border |
| `--joy-indigo-dot` | `#8FA0FF` | The animated Joy presence dot |
| `--ink` | `#191A2E` | Primary text, dark buttons, toast background |
| `--ink-2` | `#5B6274` | Body text, secondary buttons |
| `--ink-3` | `#6E6E76` | Nav item text (rest) |
| `--muted` | `#8A8A92` | Supporting text |
| `--muted-2` | `#9B9BA3` | Labels, meta |
| `--muted-3` | `#B9B9C1` | Disabled text, faint meta |
| `--muted-4` | `#C9C9D0` | Separators in text, empty marks |
| `--bg` | `#FDFDFC` | App background (warm white, NOT `#fff`) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--surface-2` | `#FCFCFD` | Table headers, nested/expanded regions |
| `--line` | `#ECECF1` | Card and input borders |
| `--line-2` | `#F3F3F6` | Row dividers |
| `--line-3` | `#F1F2F6` | Track/rail backgrounds, unselected pills |
| `--line-header` | `rgba(0,0,0,.06)` | Header/sidebar hairlines |
| `--green` | `#12B76A` | Done, ready, saved |
| `--green-wash` | `#ECFDF3` / `#F6FEF9` | Success pill / success card |
| `--green-border` | `#D3F0DF` | Success card border |
| `--teal` | `#0E9384` | "From phone intake" source tag, initials |
| `--teal-wash` | `#ECFDF7` | Teal pill |
| `--amber` | `#B54708` | Needs review, office owes, warnings |
| `--amber-text` | `#8A6220` | Body copy inside amber callouts |
| `--amber-wash` | `#FFFAEB` / `#FFFCF5` | Warning pill / warning card |
| `--amber-border` | `#FCE8B6` | Warning border, incomplete input border |
| `--orange` | `#F79009` | Saving indicator |

**Semantic rule:** amber = *a human still owes something*. Green = *done, verified by a human*. Blue = *the one primary action on this screen*. Never use red for routine states; red is reserved for destructive confirmation only.

### Typography

Public Sans (Google Fonts), weights 300–700, `-webkit-font-smoothing: antialiased`.

```
Page title (h1)      27px / 600 / -.025em / 1.2
Section heading      16px / 600 / -.015em
Card title           15px / 600 / -.01em
Metric number        19–20px / 600 / -.02em
Body                 14px / 400 / 1.6, text-wrap: pretty
Body small           13.5px / 400 / 1.55
UI default           13px / 400
Meta / secondary     12.5px / 400
Label                12px / 400
Micro label          11.5px / 400
Eyebrow (uppercase)  11px / 600 / .06–.09em / uppercase
Pill text            10.5–11px / 500
Signature (serif)    Georgia italic 27px  ← signature/initials rendering only
```

### Spacing, radius, elevation, motion

```
Spacing:  4 · 6 · 7 · 9 · 10 · 11 · 13 · 14 · 17 · 18 · 22 · 24 · 34px (gap-driven, flex/grid everywhere)
Radius:   8 (small control) · 9 (button) · 10–11 (input) · 12–13 (card) · 14–15 (panel) · 999px (pill)
Controls: chip/pill h36 · small button h34 · input h40–42 · primary button h46–48
Shadow:   cards have NO shadow — 1px borders only
          overlay:  0 16px 40px rgba(25,26,46,.14)
          popover:  0 16px 44px rgba(25,26,46,.16)
          toast:    0 12px 32px rgba(25,26,46,.24)
Motion:   .16s ease (state), .18s ease-out (section/toast enter)
          secIn:  translateY(6px)→0, opacity 0→1
          toastIn:translateY(8px)→0
          joyGlow: 2.6s infinite, opacity .5→.95 + scale 1→1.06 (the assistant dot only)
          Honor prefers-reduced-motion: disable all animation and transition.
```

### App shell

```
Min width           1180px (desktop tool; no mobile design exists yet — see Open Questions)
Left nav            252px fixed, sticky, border-right rgba(0,0,0,.06), own scroll
Top header          53px, sticky, background rgba(253,253,252,.94) + backdrop-filter: blur(10px)
Right context panel 296px, sticky, border-left, background #FCFCFD, conditional
Bottom action bar   sticky, same blur treatment, 11px 30px padding
Content column      max-width 720px centered for forms; full width for tables/boards
```

Left nav order (exact): **The Brain · Hiring · Clients · Employees · Admissions · Scheduling** — divider — **Payroll · Billing**. Active item: `background #F1F2F6`, text `#191A2E`. Icons are 15×15 inline SVG strokes at `#8A8A92`, `stroke-width 1.3`.

---

## Agency Business Rules (apply everywhere)

These are hard constraints from the owner. They are enumerations, not examples — do not widen them.

1. **Payer sources are exactly two:** `Private Pay` and `Private Pay + LTC Insurance`. There is no Medicaid, no Medicare, no VA, no third-party billing anywhere in the product. (`Not sure yet` is allowed as a *pre-qualification* value on a lead only, never on an active client.)
2. **Services are exactly three:** `Personal Care`, `Post-Surgical`, `Respite`. No companion care, no dementia-care line, no homemaker line.
3. **Partial payments do not exist.** An invoice is paid or unpaid. Do not model, display, or allow a partial-payment state on Billing, Clients, or anywhere else.
4. **The agency week runs Saturday → Friday.** Every week boundary in the product — the billing week, payroll week, scheduling week, the calendar's highlighted week — starts Saturday and ends Friday. Do not use a Sun–Sat or Mon–Sun week anywhere.
5. **Overtime** is >40 hrs at 1.5×. There are no weekend or holiday premium rates on intake quotes.
6. **Relationship labels are capitalized** in UI (`Son`, `Daughter`, `Wife`, `Niece`), not lowercase.

---

## Screens

### 0. The Brain (home — current design) ★
**File:** `designs/Joy Health The Brain.dc.html`
**Supersedes:** `Joy Health Dashboard - Command Center.dc.html` and `- Brief Band.dc.html`, which are earlier explorations kept for reference only. Build The Brain.

**Purpose:** The operator's home. Answers "what does the agency need from me right now" in one screen, in plain language.

**Structure — five tabs:** `Overview · My Work · Joy Operations · Calendar · Activity`.

- **Overview** — the **Brain Brief** (a written paragraph, not metrics: "Operations are in good shape. All of today's scheduled visits are covered…" with a "Why do you say that?" disclosure), then **What's Going On** (the small number of things actually needing attention), a **Calendar preview** card, a **Recent Activity** feed, and a **Joy Operations** snapshot. Each card ends with a text link into its full tab.
- **My Work** — date navigation (prev / next / Today) over three groups: **My Schedule**, **Needs Me**, **Waiting on Others**. Needs-Me rows are checkboxes that strike through on completion. Clicking a row opens a detail drawer.
- **Joy Operations** — what Joy is monitoring and what it has done, each item with an "Updated Nh ago" stamp and an **Audit** button. Includes a degraded-state banner ("payroll data unavailable — the brief above excludes payroll") with a retry.
- **Calendar** — month grid + an **Agenda** view toggle, prev/next/Today, Subscribe, and **Add event**. **Today's weekday column and the current billing week (Sat–Fri) are both visibly highlighted** — today's cell is the strongest mark, the billing week is a light blue band across the row. Do not label individual week-boundary days.
- **Activity** — the full chronological log.

**Ask the Brain** is a single AI dot in the header (an `8FA0FF` glowing dot, `joyGlow` 2.6s), not a persistent panel. Clicking it opens a compact ask popover with scoped suggested prompts; the answer renders inline at the top of Overview with a Clear action.

**Modals:** **Add task** (title, category, priority, due date, assignee, description) and **Add event** (title, date, start, end) are separate modals with real select dropdowns.

### 1. Command Center (superseded exploration)
**File:** `designs/Joy Health Dashboard - Command Center.dc.html`
**Variant:** `Joy Health Dashboard - Brief Band.dc.html` (same content, morning-brief band across the top instead of stacked cards — treat as an A/B of the header region only)

**Purpose:** The first screen every morning. Answers "what is on fire, what is due today, what is waiting on me."

**Layout:** Left nav · main column · no right panel. Content is a stack of queue cards, each card = one class of work with a count and the two or three rows that need action right now.

**Behavior:** Every row is a link into the owning module with that record selected. Counts are live. Nothing on this screen is a chart.

### 2. Hiring
**File:** `designs/Joy Health Hiring.dc.html`

**Purpose:** Caregiver applicant pipeline — the agency's hardest recurring problem is staffing.

**Structure:** Stage queues (Applied → Screened → Interview → Credentialing → Ready to work), each applicant carrying credential expiry state. Credentialing is the gate: an applicant cannot reach "Ready to work" with a missing or expired credential, and the UI must say which one.

### 3. Clients
**File:** `designs/Joy Health Clients.dc.html`

**Purpose:** The active client roster. Row = client, with care plan, hours authorized vs. scheduled, primary caregiver, and payer.

### 4. Employees
**File:** `designs/Joy Health Employees.dc.html`

**Purpose:** Caregiver roster with credential status, availability, and current assignments. Credential expiry warnings surface here and on Scheduling.

### 5. Admissions
**File:** `designs/Joy Health Admissions.dc.html`

**Purpose:** Prospect → client. Stages: **Referral → Assessment → Pre-Onboarding → Ready for Admission → Client.**

**Queues (current):** `Needs You · Waiting · Moving Forward · Handled` — grouped by who owes the next move, not by funnel stage. Rows carry aging indicators, escalation awareness, and Joy's action history. An escalation banner states what Joy is monitoring and the recommended next step, never a generic reminder.

**Key rules from the spec:**
- Not a CRM pipeline. Restrained board, no bright status colors, no dozens of cards.
- Every record shows a single **"waiting on"** line in plain language ("Waiting on family signature", "Waiting on medication list") — never a raw status enum.
- The referral record is intentionally light. Do **not** force the full clinical packet at referral.
- Pre-Onboarding is a **readiness checklist**, not another giant form: phone intake ✓, assessment ✓ signed, service agreement, plan of care, payment setup, start of care.

**Quick Add — flexible entry (important, recently revised).** The `+` menu offers: **New lead · Start phone intake · Start assessment · Schedule · Upload document.** The design principle is that *the office can enter the process at any point* — a referral can arrive as a scheduled assessment with no intake ever having happened, and the software must accept that and keep the missing step visible instead of blocking.

- **New lead** is a *quick capture*, not a form: contact name + phone (or email) is the entire requirement. Everything else — email, ZIP, person needing care, relationship, referral source, note — is optional. **There is no date of birth field** (DOB is deferred to the assessment). Referral source is a select (Hospital, Case manager, Social worker, Physician / provider, Facility, Existing client or family, Professional referral, Community / networking, Website, Other); picking an institutional source reveals optional **Organization** and **Referrer** fields.
- **Duplicate detection** runs live against name and phone as they type. A match shows an amber inline card — name · phone · current stage — with **Use this record** or **Create new anyway**. Never a hard block.
- Save actions: **Save lead** and **Save & start intake**.
- **Start phone intake / Start assessment** open a person picker first (search by name, phone, or email, over non-admitted records) with **+ Start with a new person** always available. Choosing a lead with no completed intake for an *assessment* shows a non-blocking notice — "Phone intake not completed… information normally collected during intake may need to be completed during this assessment" — and a **Continue to assessment** button.
- **Schedule** is a three-step modal: pick **what** (Phone intake or Assessment) → pick **who** (search existing, or **+ Add new person**, which captures contact name, phone, optional person needing care, ZIP) → **details** (date, time, assigned team member, note; assessments also take meeting address and who will be present). Saving with a brand-new person creates the admissions record and drops it into New Leads; scheduling an assessment for someone without an intake fires a toast noting the intake is still outstanding.

### 6. Phone Intake
**File:** `designs/Joy Health Phone Intake.dc.html`

**Purpose:** The 6-minute call that starts everything. Designed to be filled *while talking*.

**Must capture (these feed the packet and must not be re-asked later):**
- Caller and relationship; client name, age, ZIP, phone. **DOB and full street address are deliberately deferred to the assessment** — do not ask for them on the call.
- Reason for the call, in the caller's words
- **Specific hours** — days Mon–Sun *and* a time window (`8am–1pm`) or a named window (`mornings`); free-text hours are a defect, the assessment needs real times
- **Pay For Care**: `Private Pay` / `Private Pay + LTC Insurance` / `Not sure yet` — those three only
- **LTCI carrier** when relevant
- Referral source
- Urgency

### 7. Assessment ★
**File:** `designs/Joy Health Assessment.dc.html` — *the most complex and most important screen in the system. Read this section in full.*

**Purpose:** The RN's in-home visit. One pass through the assessment must produce (a) a signed clinical assessment, (b) a completely filled 26-page consent packet, and (c) a plan of care — with zero re-entry.

**Three stages inside one screen** (`stage: 'assess' | 'packet' | 'signing'`):

#### Stage 1 — `assess`: 15 sections + review
Left rail lists sections with a done/current/flagged mark and a progress bar. Main column shows one section at a time, max-width 720px. Bottom bar: Ask Joy · Voice note · Add photo · progress.

Sections in order:
1. **Client and contacts** — read-only rows carried from phone intake + emergency contacts table + "anything the office should correct"
2. **Identifiers and payer** — SSN, payer type, carrier + policy, advance directive, DNR
3. **Who we may talk to** — HIPAA disclosure list (name / relationship / phone) + anyone excluded
4. **Reason for care** — narrative, recent change chips, diagnosis
5. **Living situation and home safety** — living situation, hazards, **animals**, **smoking**, equipment, notes
6. **Functional status** — 8 ADLs (Bathing, Dressing, Toileting, Feeding, Meal prep, Mobility, Transfers, Continence) × levels
7. **Cognitive, behavioral and risk**
8. **Medications** — table, support needed, allergies
9. **Physicians and providers** — providers table + **pharmacy / DME supplier** table
10. **Services needed**
11. **Plan of care detail** — functional limitations, orientation, activities permitted, DME, goals, vital-sign call thresholds, transportation yes/no
12. **Schedule recommendation** — days, window, weekly hours, caregiver level, matching notes
13. **Special precautions**
14. **Emergency priority** — Level 1/2/3 for storms and outages
15. **Education provided**
16. **Review and sign**

**Level of assistance model (important, was revised):** levels are **Independent · Standby · Hands-on · Total**. "Supervision" is *not* a standalone level — supervision is implicit in any non-independent level. Meal prep is a first-class ADL. Any ADL at Hands-on or Total is labeled "Caregiver task" and flows into the plan of care interventions.

**Autosave** on every change (600ms simulated); header shows a dot + "Saved 10:42 AM" / "Saving…".

**"Needs review" engine** — the product's core safety feature. A right panel (296px, toggleable from the header) lists derived gaps and *conflicts*, each with a reason and a jump link. Current rules:
- medication row with a name but no dose
- fewer than two emergency contacts
- emergency priority not set
- caregiver level not selected
- **Mobility = Independent while intake reported a walker and falls** (cross-source conflict — this pattern is the point)
- smoking not documented
- animals not documented
- no home hazards selected (must explicitly choose "No hazards noted")

The assessment **cannot be signed** while any item is open. The sign button label states the blocker: "Resolve 3 items to sign".

**RN signature:** name, credentials, typed signature. Copy: *"Signing records your name, credentials and the date and time. Joy cannot complete an assessment for you."* On complete: toast, client moves to Pre-Onboarding.

#### Stage 2 — `packet`: the 26-page client agreement packet
Four stat tiles (Pages 26 · Auto-filled · Office fields · Signatures). An amber "What the assessment cannot know" grid of office-only inputs (hourly rate, RN rate, deposit, invoice email, payment preference, SOC date, MR #). Then 18 collapsible document rows; expanding one lists its fields, each tagged by source:

| Tag | Color | Meaning |
|---|---|---|
| From this assessment | `#12B76A` on `#ECFDF3` | RN just captured it |
| From phone intake | `#0E9384` on `#ECFDF7` | Captured on the call |
| Standard language | `#5B6274` on `#F3F3F6` | Fixed legal text |
| Office must fill | `#B54708` on `#FFFAEB` | Rates and identifiers |
| Signature | `#1407A2` on `#EEF0FE` | Signed or initialed |

Primary action is gated: "Fill N office fields first" → "Review and sign with the family →".

The document list and its page mapping is in the code as the `PACKET` array, and the source document text is in `reference/patient-consents.txt`. **Both must be treated as the source of truth for the real PDF template mapping.** The packet is 26 pages; the assessment is 15 sections — do not conflate the two numbers.

#### Stage 3 — `signing`: the guided review walkthrough ★
This is the part the agency cares most about and the part most likely to be under-built. **It is an idiot-proofing device: the RN is sitting at a kitchen table with a family and must not skip anything, and must not be caught out by a clause the family reads later.**

Twelve review cards, in order, each containing:
- a number badge (turns into a green ✓ when reviewed)
- the page reference (`p. 2–4`) and a pill: **Signature** or **Initials**
- **what to say** — plain-language explanation, no legalese
- an amber **"SAY THIS"** callout — the specific trap in that clause that families miss (the late fee, the 24-hour suspension, the $0.70/mile, the HIV/drug/alcohol sentence, the 26-week liquidation fee, the fact that caregivers remind but never administer medication)
- **"Show the actual text they are signing"** — expands the verbatim excerpt from the consent document, so when the family asks "what does it actually say," the RN taps once instead of flipping paper
- **Mark reviewed** and **They had a question** (logs a follow-up task to the office and tints the card amber)

The twelve: services & schedule · cost and payment timing · changing/cancelling · consent for care and caregiver limits · privacy and disclosure list · rights and complaints · advance directives · photographs · transportation · medical records · non-solicitation · emergencies and storms.

**Sign once.** Below the walkthrough: signer's legal name + relationship, a Georgia-italic signature preview and an auto-derived initials block. A gate line states either "All 12 reviewed — you can sign" (green) or "Review the remaining N with the family before signing" (amber). An "applied to" table states exactly where the marks land: N signature lines with their page list, N initial blocks with theirs, the RN countersignature, and the shared timestamp. One button — **"Sign once — apply to all 26 pages"** — stamps every signature line and every initial block in a single action, writes one timestamp to all pages and to the audit log.

**Never make the family sign the same sentence twice.** That is the requirement this stage exists to satisfy.

### 8. Scheduling
**File:** `designs/Joy Health Scheduling.dc.html`

**Purpose:** Week view (Sat–Fri) by default, with a **Week / Agenda** view toggle matching The Brain's calendar. Drag-and-drop shifts between days. Conflict detection (double-booking, credential expiry, overtime threshold, travel time). An **AI proposal review** surface: Joy proposes batch moves, coverage matches, and an OT list; the scheduler approves or rejects as a batch. Joy never commits a schedule change on its own.

### 9. Billing
**File:** `designs/Joy Health Billing.dc.html`

**Purpose:** Built around the real weekly rhythm — **Monday invoice review → Wednesday payment deadline.**

- **Private mode**: an eye toggle masks all sensitive dollar figures so the screen can be open in a shared office. Persist the preference per user.
- **Profitability** tab (formerly "Items"): weekly drill-down by recipient — revenue, caregiver cost, margin per client per week.
- **Service period is a dropdown** of week ranges (e.g. `August 1–7, 2026`), Sat–Fri aligned — never a free-text field.
- **Export** button on the page exports the current view as shown.
- Invoice rows carry an approve action and a link into Scheduling for the underlying shifts.
- Right-rail order below **Review invoices**: the LTCI packet card, then the payment-needed card. Nothing about partial payment appears anywhere.

### 10. Payroll
**File:** `designs/Joy Health Payroll.dc.html`

**Purpose:** Monday readiness, not a payroll engine. Joy prepares; Gusto pays.

- Hero states one of three things: **not ready** (what is missing) → **ready** → **prepared for Gusto**.
- Week grid: per-employee hours and pay.
- Collapsible cycle checklist.
- **All Employees** tab: the full week grid with **totals in the footer row** and its own **Export** action that exports the grid exactly as displayed.
- **Payroll History**: clicking through shows *only* the payroll history grid — nothing below it. Each processed week has a **View** button that opens the All-Employees grid for that week.
- The export file is **auto-generated but withheld pending approval** — a human approves before anything leaves the building.

---

## Cross-cutting Interactions

**Joy (the assistant).** Present on every screen as a dark pill in the bottom bar with a glowing indigo dot. Three surfaces:
1. **Inline notes** — a `#F7F8FE` card at the top of a section: "Susan told intake about two falls this month… I drafted these — confirm or change them." Two actions: accept (marks RN-reviewed) or dismiss. **Joy never silently writes a value.**
2. **Ask panel** — bottom-right popover, 340px, with suggested prompts scoped to the current screen.
3. **Derived flags** — the "needs review" engine described above.

Non-negotiable rule, stated in the UI: *"Joy flags gaps and conflicts. It does not decide anything clinical — you do."* Every AI-drafted value must be human-confirmed before it is treated as recorded, and the audit trail must record who confirmed it.

**Voice and photo capture.** Voice note (a listening overlay) and Add photo exist on the assessment bottom bar. Photos may be read into fields by OCR, and the copy commits to this: *"a photo never becomes a finding on its own."*

**Toasts.** Bottom-center, dark `#191A2E`, 12px radius, min-width 340px, title + sub. Used for every save-with-consequence.

**Gated primary actions.** Throughout the app, a blocked primary button stays visible and *states the blocker in its own label* rather than being hidden or silently disabled. Disabled style: `#F1F2F6` background, `#B9B9C1` text, `cursor: not-allowed`.

---

## State Model

Per-screen local state in the prototypes maps to server state in production. For the Assessment:

```ts
type AssessmentStage = 'assess' | 'packet' | 'signing';

interface AssessmentState {
  stage: AssessmentStage;
  sectionIndex: number;               // 0..15, 15 = review
  data: Record<string, FieldValue>;   // FieldValue = string | string[] | Record<string,string> | string[][]
  touched: Record<string, boolean>;
  joyDismissed: Record<string, boolean>;
  saving: boolean; savedAt: string;

  rnName: string; rnCred: string; rnSignature: string; signed: boolean;

  office: Record<string, string>;     // rates + identifiers
  packetOpen: string | null;

  walkDone: Record<string, boolean>;  // 12 walkthrough items reviewed
  walkQ: Record<string, boolean>;     // family had a question → office task
  walkText: Record<string, boolean>;  // verbatim text disclosure open
  clientName: string; clientRel: string; packetSigned: boolean;
}
```

Derived, never stored: section completeness, the open-items list, walkthrough progress, initials (from `clientName`), and every gate (`canSign`, `canSend`).

**Persistence requirements:** autosave every field change with optimistic UI; the assessment must survive an offline gap in a client's home and resume (the RN will lose signal); signatures and completions are append-only audit events (`assessment.signed`, `agreement.signed`, `care_plan.approved`, `payment.setup`), each with actor, timestamp, and the values as of signing.

---

## Data & Integration Notes

- **The 26-page packet is a real document.** `reference/patient-consents.txt` is the extracted text, page-delimited. Build the fill engine against it. Every field in the `PACKET` array in the Assessment file names a real field on a real page.
- **Gusto** for payroll disbursement. Joy owns readiness and the export file; Gusto owns payment.
- **Payments**: card, debit, ACH. 2.9% card convenience fee, $5 ACH fee, $100 late fee after day three, suspension within 24 hours of non-payment — these are the agency's real terms and the Billing module must model them. **Payments are all-or-nothing; there is no partial payment state.**
- **Texas HHSC** complaint hotline and state-specific advance directive language appear in the packet; keep them configurable rather than hard-coded, since the agency may expand.
- Overtime is anything over 40 hours, billed at 1.5×. Scheduling's OT warnings and Billing's rates both derive from this. Intake quotes carry **no** weekend or holiday premium.

---

## Accessibility

- Every interactive element in the prototypes is a real `<button>` or `<a>`; keep it that way and add accessible names to the icon-only controls.
- The prototypes lean on color for state (green/amber). Production must pair color with text or an icon — the walkthrough cards and packet source tags already carry labels; make sure the nav marks and progress rings do too.
- Full keyboard path through the assessment: tab order follows visual order, Enter advances a section, the section rail is arrow-navigable.
- `prefers-reduced-motion` disables all animation (already in the prototype CSS).
- Minimum text size in the product is 11px for micro-labels; do not go smaller. Target 44px hit areas on any surface that will be used on a tablet in a client's home — the assessment is a tablet workflow in practice.

---

## Build Order

1. **App shell** — nav, header, sticky regions, token layer, typography. Everything else hangs off this.
2. **Clients + Employees** — the two core entities; nothing else is meaningful without them.
3. **Phone Intake → Admissions** — the pipeline and its "waiting on" language.
4. **Assessment stage 1** — the section engine, field kinds (`known`, `text`, `chips`, `single`, `cards`, `levels`, `rows`), autosave, the needs-review engine, RN signature.
5. **Assessment stages 2 and 3** — packet mapping and the signing walkthrough. Do not ship stage 2 without stage 3; an unsigned packet with no guided review is the workflow the agency is trying to escape.
6. **Scheduling** — drag-and-drop and conflicts.
7. **Billing**, then **Payroll**.
8. **The Brain** last — it is an aggregate of everything above and cannot be built honestly before them.

---

## Open Questions for the Product Owner

1. **No mobile or tablet design exists.** The assessment is realistically done on a tablet in a client's living room. The 1180px minimum will not hold. Ask before building a responsive layer.
2. **Offline assessment** is stated as a requirement but not designed. Conflict resolution on resume needs a decision.
3. **E-signature legal path** — the walkthrough stamps a typed signature. Whether that satisfies the agency's counsel, or whether this needs DocuSign/Dropbox Sign underneath, is unresolved.
4. **The three-page admissions journey** (Phone Intake → Assessment → Packet) has not been validated for friction; the owner has been asked whether it should compress.
5. **Roles and permissions** are described in the spec (office, RN, scheduler, client/family portal) but no permission matrix has been designed.

---

## Files

```
designs/
  Joy Health The Brain.dc.html                    ★ CURRENT home — Overview / My Work / Joy Ops / Calendar / Activity
  Joy Health Dashboard - Command Center.dc.html   earlier exploration — reference only
  Joy Health Dashboard - Brief Band.dc.html       earlier exploration — reference only
  Joy Health Hiring.dc.html                       caregiver applicant pipeline
  Joy Health Clients.dc.html                      client roster
  Joy Health Employees.dc.html                    caregiver roster + credentials
  Joy Health Admissions.dc.html                   referral → client pipeline
  Joy Health Phone Intake.dc.html                 the intake call form
  Joy Health Assessment.dc.html                   ★ 15-section RN visit + 26-page packet + signing walkthrough
  Joy Health Scheduling.dc.html                   week view, drag-and-drop, AI proposals
  Joy Health Billing.dc.html                      Monday review → Wednesday deadline, private mode, profitability
  Joy Health Payroll.dc.html                      Monday readiness → Gusto export
  support.js                                      prototype runtime — reference only, DO NOT PORT

reference/
  patient-consents.txt                            extracted text of the real 26-page client agreement packet

screenshots/                                      rendered captures of each screen
  01-command-center.png
  02-hiring.png
  03-clients.png
  04-employees.png
  05-admissions.png
  06-phone-intake.png
  07a-assessment-section.png                      section 1, with the needs-review panel
  07b-assessment-plan-of-care.png                 the plan-of-care detail section
  07c-assessment-review-sign.png                  review and RN signature
  08-scheduling.png
  09-billing.png
  10-payroll.png
  11-brief-band.png
```

**Screenshots are stale for The Brain, Admissions, Scheduling, Billing and Payroll** (captured before the revisions listed in the business-rules and screen sections above). Open the HTML for those five. Screenshots are above-the-fold captures — the packet and signing stages of the Assessment are reachable only by working through the flow in the browser, so open `designs/Joy Health Assessment.dc.html` to see them live.

To view a prototype: open any `.dc.html` in `designs/` directly in a browser (`support.js` must sit alongside them, and it does).
