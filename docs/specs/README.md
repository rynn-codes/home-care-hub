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

Where a module spec and the kickoff brief conflict, the brief wins on structure
and data, the module spec wins on UI detail and behaviour. Document any mismatch
rather than silently picking a side — section 2 and section 50.

## Still missing

Named as source of truth but not supplied. Any module depending on one of these
is under-specified until it arrives:

- `Joy_Health_Hiring_Screen_Roadmap.md` — blocks Hiring
- Client Intake Form, two pages — the data basis for `phone_intakes`
- Joy nursing assessment — the RN assessment content
- Joy Product Bible v1.0 Builder Edition
