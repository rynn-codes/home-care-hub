# Joy Health

An AI-first Home Care Operating System for Joy Healthcare Services — admissions,
scheduling, billing, payroll and hiring in one place.

Joy is not a CRM, ATS, EHR or payroll app. The product principles it is built to,
and the specification every module answers to, live in
`Joy_Health_Codex_Engineering_Kickoff.md`:

> AI drafts. Humans approve. Enter once, reuse everywhere. Every workflow
> autosaves. Calm before complexity. One source of truth.

## Getting started

This project uses **npm**. Node 20 or newer.

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the values. `.env` is gitignored and
must never be committed — the integration secrets for OpenAI, Spruce, GoHighLevel
and Gusto all belong in that file.

| Command         | What it does                        |
| --------------- | ----------------------------------- |
| `npm run dev`   | Dev server                          |
| `npm run build` | Production build                    |
| `npm run lint`  | ESLint                              |
| `npm test`      | Vitest, single run                  |

### A note on the package manager

The project previously carried a `bun.lockb` alongside `package-lock.json`. That
hid a real dependency conflict: `date-fns@4` against `react-day-picker@8`, which
peers on v2 or v3. Bun's resolver tolerates it, so `npm install` failed with
`ERESOLVE` for anyone who did not use Bun. `react-day-picker` is now on v9, which
supports date-fns v4, and `package-lock.json` is the single committed lockfile.

If you reintroduce Bun, delete `package-lock.json` in the same change. Two
lockfiles in one repository will drift.

## Stack

React 18 · TypeScript · Vite · Tailwind · shadcn/ui · React Router · TanStack
Query · Supabase · Vitest

## Where things stand

The app shell matches the approved Joy navigation, and Home is built to the
approved Command Center layout. Most modules are specified but not yet
implemented — those routes render a screen that says so, rather than showing
invented data.

Foundations still to build, in order: database and migrations, the
`people`/`relationships` schema, authentication guard and role enforcement,
audit log and the domain event outbox. Admissions and Phone Intake are the first
full vertical slice and depend on all of it.
