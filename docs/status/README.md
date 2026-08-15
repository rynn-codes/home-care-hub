# Stream status

Each parallel stream writes its own file here — `foundations.md`,
`scheduling.md`, `payroll.md` — and **does not edit
`docs/IMPLEMENTATION_STATUS.md`**. Three agents editing one status document is a
guaranteed merge conflict; the integrator merges from these instead.

Keep each file short and current:

- what works now
- what is not built yet
- migrations added, and their numbers
- blockers, including anything you had to guess
- test and build state
