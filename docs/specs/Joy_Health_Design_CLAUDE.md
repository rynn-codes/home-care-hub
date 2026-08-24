# Joy Health Operations Platform — project rules

Read this first. It is the standing context for this project; do not re-derive it and do not ask the user to restate it.

## What this bundle is

`designs/*.dc.html` are **design references** — HTML prototypes showing intended look and behavior. They are not production code.

They use a small in-house template runtime (`support.js`, `<x-dc>`, `{{ }}` holes, `<sc-for>`/`<sc-if>`, inline styles only). **Do not port the runtime. Do not port the inline-style approach.** Recreate the screens in this codebase's real environment using its established patterns.

If a `.dc.html` file fails to open in a browser, `support.js` is missing from the same directory. It is in `designs/`.

**Fidelity is high.** Every hex value, font size, spacing value, and border radius is a decision, not a placeholder. Seed data (names, dollar amounts, dates) is illustrative and fictional.

## Documents, in reading order

| File | What it holds |
|---|---|
| `README.md` | Design tokens, app shell, all screens, cross-cutting interactions, state model, build order, open questions |
| `THE_BRAIN.md` | Full spec for the home screen + My Work tab — self-sufficient, build from it without opening the HTML |
| `reference/patient-consents.txt` | Extracted text of the real 26-page client agreement packet — source of truth for the fill engine |

## Agency business rules — hard constraints

These are enumerations, not examples. Do not widen them. Do not invent alternatives.

1. **Payer sources are exactly two:** `Private Pay`, `Private Pay + LTC Insurance`. No Medicaid, Medicare, VA, or third-party billing anywhere. (`Not sure yet` is allowed on a *lead* only, never an active client.)
2. **Services are exactly three:** `Personal Care`, `Post-Surgical`, `Respite`.
3. **Partial payments do not exist.** An invoice is paid or unpaid. Never model, display, or allow a partial state.
4. **The week runs Saturday → Friday.** Every week boundary — billing, payroll, scheduling, calendar highlighting — starts Saturday. Never Sun–Sat or Mon–Sun.
5. **Overtime** is >40 hrs at 1.5×. No weekend or holiday premium on intake quotes.
6. **Relationship labels are capitalized:** `Son`, `Daughter`, `Wife`, `Niece`.

## Product principles — do not design these away

- **The software remembers the process.** The user never needs to know the workflow by heart, and never re-types anything the agency already collected.
- **Joy (the AI) never decides.** It flags gaps and conflicts, drafts values, and states what it did with a timestamp. Every AI-drafted value is human-confirmed before it counts, and the audit trail records who confirmed it.
- **Joy's four states, used everywhere:** `HANDLED` · `WORKING` · `WAITING` · `NEEDS YOU`. Same four words, same order.
- **Gated actions state the blocker in their own label** ("Resolve 3 items to sign", "Fill 7 office fields first") — never hidden, never silently disabled.
- **Plain language over status enums.** "Waiting on family signature", not `PENDING_SIG`.
- **No charts on the home screen.** The Brain leads with a written brief, not metrics.
- **Amber = a human still owes something. Green = done, verified by a human. Blue = the one primary action.** Red is for destructive confirmation only.
- **Flexible entry:** the office can enter the process at any point. A missing prior step is kept visible, never used to block.

## Current screen set

12 designed screens: **The Brain** (home — current), Command Center + Brief Band (superseded explorations, reference only), Hiring, Clients, Employees, Admissions, Phone Intake, Assessment, Scheduling, Billing, Payroll.

**Known gaps, not yet designed** — flag rather than invent: caregiver mobile app (clock in/out, the source of the timecards Payroll and Billing consume), settings/admin (rates, holidays, users, roles), login and permissions, client/employee detail as full pages, invoice detail, timecard approval, documents library, tablet layout for the Assessment, family portal.

## Build order

1. App shell — nav, header, sticky regions, token layer, typography
2. Clients + Employees
3. Phone Intake → Admissions
4. Assessment stage 1 (section engine, autosave, needs-review engine, RN signature)
5. Assessment stages 2 and 3 (packet mapping, signing walkthrough — never ship 2 without 3)
6. Scheduling
7. Billing, then Payroll
8. The Brain last — it aggregates everything above

## Working agreement

- When a screen's detail is missing from these docs, **read the corresponding `designs/*.dc.html`** — do not guess and do not ask the user to describe it.
- When something is genuinely undecided, it is in README § Open Questions. Ask once, in a batch, rather than one question at a time.
- Do not restate these rules back to the user for confirmation. They are settled.
