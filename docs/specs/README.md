# Approved specifications

The kickoff brief and the Claude Design specs, vendored into the repository so
anyone working here — human or agent — can read them without hunting for an
upload. Section 51 assumes the kickoff brief lives in the repo; section 2 makes
these the source of truth for their modules.

| File | Governs |
| --- | --- |
| `Joy_Health_Codex_Engineering_Kickoff.md` | Everything. The master brief, 52 sections |
| `Joy_Health_Admissions_Master_Build_Spec.md` | Admissions, referral entry, duplicate check, phone intake |
| `Joy_Health_Phone_Intake_Claude_Design_Master_Spec.md` | Phone intake UI and behaviour |
| `Joy_Health_Scheduling_Build_Spec.md` | Scheduling |
| `Joy_Health_Payroll_Mockup_Build_Spec.md` | Payroll |
| `Joy_Health_Dashboard_Claude_Revision_3.md` | The Home / Command Center screen |
| `Joy_Dashboard_Revision_Request.md` | Earlier Home revision. Superseded by Revision 3 where they disagree |
| `Joy_Health_V1_Design_Brief_Part_1.md` | Foundation and visual direction |
| `Patient_Consents_Packet.pdf` | The signing packet the RN assessment must fill. 26 pages |
| `Patient_Consents_Packet.txt` | Extracted text of the same, so the consent registry quotes it verbatim |

Where a module spec and the kickoff brief conflict, the brief wins on structure
and data, the module spec wins on UI detail and behaviour. Document any mismatch
rather than silently picking a side — section 2 and section 50.

## Governing but not yet vendored

**Joy Health Admissions, Billing, Payroll, Client Portal, and Stripe
Integration — coding specification v1.0, 21 August 2026.** Supplied in
conversation rather than as a file. It governs Billing, payment collection, the
client finance area and the Stripe adapter, and it supersedes earlier guesses
about all four.

Its Section 20 deliverables are complete and live in `docs/billing/` plus
`docs/DECISIONS/0002-stripe-integration.md`. **The spec itself should be dropped
into this directory** — every other source of truth here is vendored precisely so
nobody has to hunt for an upload, and the Phase 0 documents summarise it rather
than replacing it.

Note on its own provenance: Section 2.1 says the original uploaded sources
behind its evidence table (J-01 to J-11) are not present in that workspace
either, and preserves the citations rather than presenting them as fresh
approvals. Two of those sources — the Product Bible and the Hiring Roadmap — are
still missing here as well.

## Still missing

Named as source of truth but not supplied. Any module depending on one of these
is under-specified until it arrives:

- `Joy_Health_Hiring_Screen_Roadmap.md` — blocks Hiring
- Client Intake Form, two pages — reconciled 18 Aug 2026 against the paper form
  and now reflected in `src/domain/admissions/intake.ts`. The form itself is
  deliberately **not** vendored: the copy supplied is a completed one carrying a
  real client's name, address, telephone number, email and two cancer diagnoses,
  and committing it would put identifiable health information into git history
  permanently. A blank copy can be vendored safely if one is wanted.
- Joy nursing assessment — the RN's own clinical form. The consents packet defines
  what the assessment must *produce*; the nursing assessment would define how the
  RN captures it. The assessment is modelled from the packet's requirements in
  the meantime.
- Joy Product Bible v1.0 Builder Edition — cited as J-01 by the billing
  specification for "Billing & Payments is Phase 1" and the Tap to Pay fallback
  ladder. Those two decisions are therefore usable; the rest of the Bible is not
  available.

The visual designs these specs describe are vendored alongside them in
`docs/mockups/`, with a note on where the two disagree.
