# The Brain — Home Screen Spec

Companion to `README.md`. This document covers **the home screen shell + the Overview tab + the My Work tab** in enough detail to build without opening the HTML. Reference implementation: `designs/Joy Health The Brain.dc.html` (open it alongside this; `support.js` must sit next to it).

**Fidelity: high.** Every hex, size, and radius below is a decision. Recreate precisely, using the target codebase's component patterns — do not port the prototype's inline styles or its `{{ }}` template runtime.

---

## 1. What this screen is

The Brain is the operator's home — Karynn Reed, Chief Executive, opening the app in the morning. It replaces the earlier Command Center / Brief Band explorations (kept in `designs/` for reference only; **build The Brain**).

The thesis: **a written brief, not a stat wall.** The screen leads with a paragraph a human could have written — "Operations are in good shape…" — because a stack of numbers makes the operator do the interpretation. Joy has already done it. Numbers appear only where a count is genuinely the information (Joy Operations' four states).

Corollary rules, which are the point of the design and easy to lose:
- **No charts anywhere on this screen.** Ever.
- **Every card ends with a text link into its own full tab.** The Overview is a set of previews, never a place to work.
- **Joy states what it did and when.** Every Joy line carries a timestamp or a next-action time ("contacted 7:48 AM · follow-up 10:00 AM"). Joy never reports a state without saying what it did about it.
- **Joy never decides.** Anything requiring judgment lands in **Needs You / Needs Me** with a human action attached.

---

## 2. Shell

```
Page min-width      1280px            (desktop tool; no responsive design exists — see README Open Questions)
Body background     #FCFCFC
Font                'Public Sans', -apple-system, 'Helvetica Neue', sans-serif
                    -webkit-font-smoothing: antialiased; base color #1B1B1F
Links               #1407A2, hover #2A1BD1
Scrollbar           8px, thumb rgba(0,0,0,.1) r8, transparent track
```

### Left nav — 230px

`background #FFFFFF` · `border-right 1px solid rgba(0,0,0,.06)` · `padding 24px 16px` · `position: sticky; top:0; height:100vh` · `box-sizing: border-box`.

Brand block: 22px `#1407A2` circle + "Joy Health" 13.5px/500/-.01em, `padding 0 10px 18px`, `border-bottom 1px solid rgba(0,0,0,.06)`, `margin-bottom 14px`.

Items — `display:flex; gap:11px; padding:9px 10px; border-radius:9px; font-size:13px`:

| State | Style |
|---|---|
| Rest | `color #6E6E76`, weight 400, icon stroke `#8A8A92` @ 1.3 |
| Hover | `background #FAFAFB`, `color #1B1B1F` |
| Active | `background #F1F2F6`, `color #191A2E`, weight 500, icon stroke `#1407A2` @ 1.4 |

Order: **Home · The Brain** — 14px spacer — **Clients · Employees · Scheduling · Billing · Payroll · Admissions · Hiring**. Icons are 15×15 inline SVG, `stroke-linecap/linejoin: round`, no fill.

Footer (pinned with `margin-top:auto`): 28px `#F0F0F2` avatar circle with 10px/600 `#6E6E76` initials, name 12.5px/500, role 11px `#9B9BA3`; wrapper `padding 10px`, `border 1px solid rgba(0,0,0,.06)`, `radius 12px`, `background #FCFCFD`.

### Header — sticky, 53px

`position:sticky; top:0; z-index:20` · `background rgba(252,252,252,.92)` + `backdrop-filter: blur(10px)` · `border-bottom 1px solid rgba(0,0,0,.06)` · `padding 14px 44px`.

Breadcrumb: `Home / The Brain / <active tab>` — 13px `#8A8A92`, separators `#C8C8D0`, the active tab 13.5px/500 `#1B1B1F`. Right side: 34px avatar circle.

### Content column

`padding 34px 44px 90px` · `max-width 1240px` · `flex column; gap 22px`.

### Page head

Two-column, wrapping. Left (`flex:1; min-width:340px`):

- **H1 "The Brain"** — 30px/700/-.03em, line-height 1.15, with a gradient text fill:
  `linear-gradient(96deg,#1B1B1F 0%,#3B2FB8 52%,#1407A2 100%)` + `background-clip:text` + `-webkit-text-fill-color:transparent`. **This is the only gradient in the entire product.** Do not repeat the treatment elsewhere.
- Subhead 14px `#8A8A92`: "Your agency at a glance. Joy is monitoring the details."
- Date 13px `#6E6E76`: "Sunday, Aug 23"

Right (`width:392px; flex:none`, right-aligned, gap 10px):

- **Range segmented control** — `Today · This Week · This Month · Custom`. Track `background #F7F7F9; border-radius:12px; padding:4px; gap:2px`. Selected segment: white pill, `radius 9px`, 12.5px/500 `#191A2E`, `box-shadow 0 1px 2px rgba(0,0,0,.05)`. Unselected: transparent, `#8A8A92`. **This filters the What's Going On feed** (see §3.2).
- **Add task** button — h36, `padding 0 15px`, `radius 11px`, `border 1px solid rgba(0,0,0,.08)`, white, 13px/500, plus-icon 13px; hover `#FAFAFB`.
- **Ask the Brain** — an icon-only round button holding a **9px `#8FA0FF` dot** animated with `joyGlow`. This is the *entire* AI surface in the header; there is no persistent assistant panel.

```css
@keyframes joyGlow {
  0%,100% { opacity:.5;  transform:scale(1);    }
  50%     { opacity:.95; transform:scale(1.06); }
}
/* animation: joyGlow 2.6s ease-in-out infinite */
```

### Tab bar

`display:flex; gap:26px; border-bottom:1px solid rgba(0,0,0,.07)`. Tabs: **Overview · My Work · Joy Operations · Calendar · Activity**. Active tab: 13.5px/500 `#191A2E` with a 2px `#1407A2` underline sitting on the border. Inactive: `#8A8A92`, no underline, hover to `#1B1B1F`.

### Card shell (used by every section on this screen)

```
background      #FFFFFF
border          1px solid rgba(0,0,0,.06)
border-radius   18px
box-shadow      0 1px 2px rgba(0,0,0,.02)      ← the only shadow on cards; near-invisible by design
padding         20px 24px   (24px 26px for the Brain Brief)
```

**Eyebrow label**, on every card: `11px / 600 / letter-spacing .13em / #9B9BA3`, uppercase — `BRAIN BRIEF`, `WHAT'S GOING ON`, `CALENDAR`, `RECENT ACTIVITY`, `JOY OPERATIONS`, `NEEDS ME`, `WAITING ON OTHERS`.

**Row divider** inside cards: `border-top: 1px solid rgba(0,0,0,.05)` on each row (not bottom — the first row gets the line, which reads as a rule under the eyebrow).

**"View X →" link**, ending every preview card: `align-self:flex-start`, transparent button, 12.5px/500 `#1407A2`, no padding.

### Ask the Brain — answer band

When an answer exists, a card renders directly under the tab bar, above the tab content:

- Border `1px solid rgba(20,7,162,.16)`, `radius 18px`, `box-shadow 0 1px 2px rgba(20,7,162,.05)`, `padding 20px 24px`.
- Head row: 22px `#191A2E` circle containing a 6px glowing `#8FA0FF` dot · the question echoed at 12.5px `#6E6E76` · **Clear** at 12.5px `#9B9BA3`, right-aligned.
- Answer: 15px, `line-height 1.7`, `#1B1B1F`, `max-width 800px`, `text-wrap: pretty`.
- Below it, a wrapping row (gap 16px) of 12.5px/500 deep links into the modules the answer drew on.

The popover itself is 340px, bottom-right, dark, with scoped suggested prompts as `#1407A2` pill buttons (`border 1px solid rgba(20,7,162,.16)`, `radius 20px`, `padding 6px 12px`) and a text input with a 28px `#1407A2` circular send button.

---

## 3. Overview tab

`flex column; gap 22px`. Five blocks: Brain Brief (full width) → a 2-up row → a second 2-up row.

Both 2-up rows use `display:grid; grid-template-columns: minmax(0,1.15fr) minmax(360px,1fr); gap:18px; align-items:stretch`.

### 3.1 Brain Brief

- Eyebrow `BRAIN BRIEF`
- **Verdict line** — 19px/500/-.018em, line-height 1.5: *"Operations are in good shape."*
- **Body** — 15px, line-height 1.75, `#3A3A42`, `max-width 800px`, `text-wrap: pretty`:
  > All of today's scheduled visits are covered. Payroll closes tomorrow with two timecards outstanding — Joy followed up with both caregivers at 7:42 AM. Billing is on schedule for the Aug 22–28 period, and no client issues currently require escalation.
- **See why →** link opens the *Behind the brief* drawer (§5.2).

**Generation rule.** The verdict is one of a small set of states (good shape / needs attention / something is wrong), chosen from the same derived facts the body cites. The body must be assembled from real records and every claim in it must be traceable in the drawer — this paragraph is not decorative prose, it is a citation surface.

### 3.2 What's Going On — left, row 1

Eyebrow, then a right-aligned filter row (gap 12px) of text-button categories: **All · People · Payroll · Clients · Billing** — active 12.5px/500 `#191A2E`, inactive `#9B9BA3`.

Rows: `display:flex; gap:20px; padding:14px 0`, top border.
- Date — 58px fixed, 12.5px/500 `#8A8A92` ("Aug 24")
- Title 14px/500/-.01em; meta 12.5px `#9B9BA3` under it (gap 3px)
- Right: category pill — 10.5px/500, `radius 999px`, `padding 4px 9px`, in that category's wash

Empty state, when the range/filter yields nothing: centered 13.5px `#9B9BA3`, `margin 24px 0` — "Nothing notable is scheduled for this period."

This feed is driven by the **range control** in the page head *and* the category filter together.

### 3.3 Calendar preview — right, row 1

Eyebrow `CALENDAR` with "August 2026" right-aligned at 12.5px `#8A8A92`.

Mini month: `display:grid; grid-template-columns:repeat(7,1fr); grid-auto-rows:1fr; gap:5px`. Day-of-week headers 10px/600/.06em `#B4B4BC`, centered. **The week starts Saturday** — headers read `Sat Sun Mon Tue Wed Thu Fri`.

Day cell states, strongest last:

| State | Style |
|---|---|
| Normal | 12px `#6E6E76`, centered |
| Outside month | `#D4D4DC` |
| In the billing week (Aug 22–28) | `background #DCE0FB`, `radius 8px` |
| **Today (Aug 23)** | `background #1407A2`, `color #fff`, weight 600, `radius 8px` |

Legend under the grid: a 22×10 `#DCE0FB` rounded swatch + 12px `#8A8A92` "Aug 22–28 · Billing Week 2 of 2". Then **View calendar →**.

Billing weeks run **Saturday → Friday** (agency rule; see README). Do not label the individual boundary days.

### 3.4 Recent Activity — left, row 2

Rows `display:flex; gap:18px; padding:13px 0` + top border: time 74px fixed 12.5px `#9B9BA3` ("8:12 AM"), then title 14px/500/-.01em line-height 1.45 and meta 12.5px `#9B9BA3` ("Joy · employees"). **View activity →** with `margin-top:14px`.

### 3.5 Joy Operations snapshot — right, row 2

A 2×2 metric grid (`gap:16px 12px`), each cell a number + an eyebrow-styled state label at 10.5px/600/.13em:

| Count | Label | Label color |
|---|---|---|
| 12 | HANDLED | `#15803D` |
| 3 | WORKING | `#1407A2` |
| 4 | WAITING | `#8A8A92` |
| 1 | NEEDS YOU | `#C2410C` (number too) |

Numbers are 22px/500/-.03em, line-height 1. **These four states are the product's AI vocabulary — use the same four words, in this order, everywhere Joy's work is summarized.**

Below, two representative rows: a 64px fixed state label (10.5px/600/.1em in the state's color) + title 13.5px/500 + meta 12.5px `#9B9BA3`. Then **View Joy Operations →**.

---

## 4. My Work tab

**Purpose:** the operator's own day — what's on their calendar, what needs their decision, and what they're waiting on someone else for. Structurally: a date scope + three sub-tabs.

### 4.1 Head

```
h2      "My Work"  20px / 600 / -.02em
sub     13.5px #8A8A92 — "Your schedule, decisions, and items you're tracking."
```

### 4.2 Control row

`display:flex; align-items:center; gap:14px; flex-wrap:wrap`.

**Date navigator** (gap 10px):
- `‹` and `›` — 30×30, `radius 9px`, `border 1px solid rgba(0,0,0,.08)`, white, `#6E6E76`, 13px
- Date label — 14px/500/-.01em, `min-width:150px`, centered — "Sunday, Aug 23"
- **Today** — h30-ish pill, 12.5px/500. Active (already on today): `background #F1F2F6`, `#191A2E`. Inactive: white with the same 1px border, `#6E6E76`

**Sub-tab segmented control** (`margin-left:6px`) — same track treatment as the range control (`#F7F7F9`, radius 12, padding 4, gap 2; selected = white pill radius 9 with `0 1px 2px rgba(0,0,0,.05)`):

`My Schedule · Needs Me · Waiting on Others`

Default sub-tab is **My Schedule**.

### 4.3 My Schedule

One card. Eyebrow is the day heading: `TODAY · SUNDAY, AUGUST 23` when on today, otherwise `MONDAY, AUGUST 24`.

**Event rows are `<button>`s** — `display:flex; gap:22px; align-items:flex-start; width:100%; text-align:left; padding:18px 8px 18px 0; border:none; border-top:1px solid rgba(0,0,0,.05); background:transparent; cursor:pointer`, hover `background #FCFCFD`.

Columns:
1. **Time block** — 88px fixed: time 13px/500, duration 11.5px under it
2. **Body** (gap 4px): title 15px/500/-.01em · meta 13px `#6E6E76` · Joy note 12.5px `#9B9BA3`
3. **Tag pill** — 10.5px/500, `radius 999px`, `padding 4px 10px`

**Completed events are dimmed, not hidden** — every color steps down one level:

| Element | Active | Completed |
|---|---|---|
| Time | `#8A8A92` | `#C8C8D0` |
| Duration | `#B4B4BC` | `#D4D4DC` |
| Title | `#1B1B1F` | `#9B9BA3` |
| Meta | `#6E6E76` | `#B4B4BC` |
| Joy note | `#9B9BA3` | `#C8C8D0` |
| Tag | `#EFEDFB` bg / `#1407A2` | `#F4F4F6` bg / `#9B9BA3` |

Seed data (`MY_EVENTS`):

| Time | Dur | Title | Meta | Joy note | Tag | done | drawer |
|---|---|---|---|---|---|---|---|
| 9:00 AM | 30 min | Weekly leadership sync | Office | Notes captured by Joy | Completed | ✓ | — |
| 2:00 PM | 45 min | Mrs. Davis's family care conference | With Joan Robinson, RN · client home | Family confirmed · care plan prepared | Open client | | ✓ |
| 4:00 PM | 1 hr | Field orientation · David Okoro | Shadowing Samantha Chen | Documents ready | Orientation | | — |

**Tomorrow peek** — below the rows, `margin-top:20px; padding-top:16px; border-top:1px solid rgba(0,0,0,.05)`: eyebrow `TOMORROW · MONDAY, AUGUST 24`, then compact 13.5px `#6E6E76` lines (88px time gutter at `#9B9BA3`, gap 22px) — `9:30 AM Payroll review`, `1:00 PM Client assessment · Patricia Green` — and a **View tomorrow →** link that advances the date navigator.

### 4.4 Needs Me

One card. Eyebrow `NEEDS ME` with a right-aligned count at 12.5px `#9B9BA3` ("2 items"), which **decrements as items are checked off**.

Rows: `display:flex; gap:20px; padding:20px 0`, top border.

**Checkbox** (left, a real `<button>` with `aria-label="Mark done"`) — 22×22, `radius 7px`:
- Unchecked: `border 1.5px solid #D4D4DC`, transparent
- Checked: `background #1407A2`, no border, white 10px check glyph revealed

**Checking an item strikes the row through** rather than removing it — `text-decoration: line-through` and the text drops to `#B4B4BC` / `#C8C8D0`; the CTA and due pill fade. The item stays visible for the rest of the session so the operator can see what they cleared and undo it. Toggling is reversible.

Body (gap 5px): title 15px/500/-.01em · subject 13px `#6E6E76` · Joy note 12.5px `#9B9BA3`.

Right rail (`flex:none`, right-aligned, gap 9px): **due pill** — 11px/500, `radius 999px`, `padding 4px 9px`; `Due today` in amber (`#B54708` on `#FFFAEB`), softer dates in grey (`#8A8A92` on `#F3F3F6`) — then the **CTA link**, 12.5px/500 `#1407A2`.

Seed data (`MY_NEEDS`):

| Title | Subject | Joy note | Due | CTA → |
|---|---|---|---|---|
| Approve client rate change | Susan Miller · $18.00/hr → $19.50/hr | Joy calculated the payroll impact and prepared the change. | Due today | Review & approve → Clients |
| Final payroll approval | Payroll · Aug 22–28 | 2 timecard corrections resolved by Joy. Payroll is ready for review. | Closes tomorrow | Review payroll → Payroll |

**Empty state** (all items checked) — `padding 44px 0 40px`, centered, gap 7px:
- 34px `#F1F2F6` circle with a 16px `#1407A2` check
- "You're all caught up." 16px/500/-.015em
- "Joy doesn't need any decisions from you right now." 13.5px `#9B9BA3`

Note the copy: it credits Joy with the absence. Every Needs-Me item exists because Joy prepared the work and stopped short of the decision — the empty state says so.

### 4.5 Waiting on Others

One card. Eyebrow `WAITING ON OTHERS` + right-aligned "4 items".

Rows `display:flex; gap:20px; padding:20px 0` + top border. **No checkbox** — these are not the operator's to complete.

Body (gap 5px): title 15px/500/-.01em · state 13px `#6E6E76` · **next action** 12.5px `#9B9BA3`. CTA link on the right, `align-self:center`, 12.5px/500.

The **next-action line is mandatory** and must name who is being waited on, when Joy last acted, and when it will act again. A waiting item with no next follow-up time is a defect — it means nothing is driving it.

Seed data (`MY_WAITING`):

| Title | State | Next |
|---|---|---|
| Sarah Johnson · background check | Waiting on provider · 3 days | Joy checked status today at 8:04 AM. Next check: tomorrow. |
| Mrs. Davis · care plan signature | Sent Tuesday · reminder sent this morning | Waiting on family. Joy follows up again tomorrow. |
| Mike Chen · CPR renewal | Expires Aug 29 | Upload requested · reminder sent today. |
| Jane Smith · Gusto onboarding | Step 2 of 4 · started Aug 19 | Joy nudged today. Escalates to HR if incomplete Aug 26. |

CTAs: View employee → / View client → / View credential → / View employee →.

---

## 5. Drawers

All drawers share one shell: `position:fixed; top:0; right:0; bottom:0; z-index:45; width:400px`, white, `border-left 1px solid rgba(0,0,0,.08)`, `box-shadow -12px 0 40px rgba(0,0,0,.08)`, own vertical scroll. Behind them, a scrim at `z-index:40`, `rgba(20,20,30,.14)`, click-to-close.

Header: `padding 22px 24px 16px`, bottom hairline `rgba(0,0,0,.05)` — title 17px/600/-.02em, subtitle 13px `#6E6E76`, tertiary line 12.5px `#9B9BA3`, and a 28×28 `✕` (`#9B9BA3`, hover `background #F1F2F6` / `#191A2E`).

Body sections: `padding 20px 24px` each, separated by the same hairline, each led by a 10.5px/600/.13em `#9B9BA3` eyebrow.

Only one drawer is open at a time — opening any resets the others.

### 5.1 Event drawer (My Work → My Schedule)

Opened by clicking an event row flagged `drawer: true`. Header: "Mrs. Davis" / "Family care conference · client home" / "Today · 2:00–2:45 PM". Sections:

- `STATUS` — "Family confirmed", 14px/500
- `JOY PREPARED` — checklist rows, 13.5px `#3A3A42` with a 13px `#15803D` check
- `ATTENDEES` — 13.5px `#3A3A42` lines
- Actions — primary **Open client** (h38, `radius 11px`, `#1407A2`, white 13px/500, hover `#2A1BD1`) over secondary **View care plan** (same size, white, `border 1px solid rgba(0,0,0,.08)`, `#1B1B1F`)

### 5.2 Behind the brief (Overview → See why)

Header "Behind the brief" / "Sunday, Aug 23 · records supporting today's summary". Body is `padding 20px 24px; gap 18px` — one block per claim in the brief, each with an eyebrow (`VISIT COVERAGE`, `PAYROLL`, `BILLING`, `CLIENT ISSUES`), a 13.5px `#3A3A42` line-height-1.6 sentence, and a 12.5px/500 deep link into the owning module.

Every sentence in the Brain Brief must be answerable here. This drawer is what makes the paragraph trustworthy — build it in the same pass, not later.

---

## 6. Modals

Centered, `radius 18px`, white, `padding ~24px`, scrim `rgba(20,20,30,.14)`. Field pattern: label 12px/500 `#6E6E76` above the control; inputs/selects h38, `radius 11px`, `border 1px solid rgba(0,0,0,.1)`, 13.5px, `font-family: inherit`. Footer buttons h38 `radius 11px` — cancel white/bordered, primary `#1407A2` white.

**Add task** — Title · Category (select) · Description (textarea, 3 rows) · Priority + Due date (2-col grid) · Assigned to (select).
**Add event** — Title · Date · Start + End (2-col grid).

Both use real `<select>` dropdowns, not chip rows.

---

## 7. State model

```ts
type BrainTab   = 'overview' | 'mywork' | 'operations' | 'calendar' | 'activity';
type MyWorkTab  = 'schedule' | 'needs' | 'waiting';
type Range      = 'today' | 'week' | 'month' | 'custom';

interface BrainState {
  tab: BrainTab;                       // default 'overview'
  range: Range;                        // default 'today' — filters What's Going On
  eventFilter: 'All'|'People'|'Payroll'|'Clients'|'Billing';

  myTab: MyWorkTab;                    // default 'schedule'
  myDay: number;                       // index into the day list; 0 = today
  myDone: Record<number, boolean>;     // Needs-Me checkboxes → strike-through

  ask: { open: boolean; q: string; question: string|null; answer: string|null };

  // drawers — mutually exclusive, all null/false = closed
  audit: number|null;                  // Joy Operations audit
  day: number|null;                    // calendar day detail
  sched: number|null;                  // My Schedule event
  why: boolean;                        // Behind the brief

  modal: 'task'|'event'|null;
}
```

Derived, never stored: the day heading, the needs count label, the empty-state flag, filtered event lists, mini-calendar cell styles, and every active-tab style.

**Production notes.** Counts and the brief must come from the same query layer the owning modules use — a stale Brain is worse than no Brain. Checking a Needs-Me item is an optimistic write against the underlying record (the rate change, the payroll approval), not a local checkbox; it must survive reload and appear in the audit log with actor and timestamp. Joy's degraded state is designed for: when a source is unavailable, the Joy Operations tab shows an amber banner ("payroll data unavailable — the brief above excludes payroll") with a retry, and **the brief must say what it excluded** rather than quietly narrowing.

---

## 8. Data shapes

```ts
interface MyEvent   { time: string; duration: string; title: string; meta: string;
                      joyNote: string; tag: string; done: boolean; drawer?: boolean }

interface NeedsItem { title: string; subject: string; joyNote: string;
                      due: string; cta: string; href: string }

interface WaitItem  { title: string; state: string; next: string;
                      cta: string; href: string }

interface OverviewEvent { date: string; title: string; meta: string;
                          tag: 'People'|'Payroll'|'Clients'|'Billing'; day: number }

interface ActivityItem  { time: string; title: string; meta: string;
                          cat: string; cta: string; href: string }
```

Routing in the prototype is `window.location.href = './Joy%20Health%20Clients.dc.html'` — replace every one of those with real routes.

---

## 9. Accessibility

- Tabs and sub-tabs need `role="tab"` / `aria-selected` and arrow-key movement; the prototype uses plain buttons.
- The Needs-Me checkbox carries `aria-label="Mark done"` — keep an accessible name, and pair the strike-through with `aria-checked` so the state isn't conveyed by decoration alone.
- Dimmed completed events rely on color contrast that is deliberately low. Keep the "Completed" tag text as the non-color signal; don't drop it.
- Drawers need focus trapping, `Esc` to close, and focus return to the triggering row.
- The Joy dot and the `secIn`/`toastIn` transitions must be disabled under `prefers-reduced-motion`.
- Icon-only controls (Ask the Brain, `‹`, `›`, `✕`) all need accessible names.

---

## 10. Build order within this screen

1. Shell — nav, header, tab bar, card primitive, eyebrow, the "View X →" link.
2. **My Work** — it is the only tab with real interaction (date nav, sub-tabs, checkboxes, drawer) and it exercises every primitive the other tabs need.
3. Overview previews — each one reads from the module it links to, so build it after that module exists.
4. Brain Brief + Behind the brief drawer, together. Never ship the brief without the drawer.
5. Ask the Brain.

The Brain is an aggregate; per the README it is step 8 of the overall build. Nothing else is blocked by it.
