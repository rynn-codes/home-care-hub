# Agentic Command Center

A floating AI assistant available on every page, with threaded chats saved in your browser. It can answer questions about your agency data and propose changes to shifts (with approval).

## What you'll see

- **Floating launcher** (bottom-right of every page) — a button with the logo/sparkle that opens a chat panel.
- **Chat panel** (sheet sliding in from the right, ~520px wide) containing:
  - Thread sidebar: list of past chats, "New chat" button, click to switch, delete on hover.
  - Active chat view: streamed assistant responses, tool-call cards (e.g. "Looked up 5 shifts"), and an approval prompt before any shift change is applied.
- **Persistence**: threads + messages stored in `localStorage` (key `cc.threads`). Survives refresh, stays in this browser.

## What the agent can do

| Capability | How |
| --- | --- |
| Answer questions about clients, employees, shifts | Read-only tools the agent calls, e.g. "Who's on shift this afternoon?", "How many active clients does Maya have?" |
| Add a new shift | Tool call → user clicks Approve → shift inserted into the mock DataProvider |
| Change/cancel an existing shift | Tool call → user approves → DataProvider updated |

All data lives in the existing `DataProvider` mock store, so changes show up instantly across the dashboard, scheduling, etc.

## Technical approach

- **Backend**: enable Lovable Cloud, add a Supabase Edge Function `command-center-chat` that uses the AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview`) with `streamText`.
- **Tools are defined server-side WITHOUT `execute`** so they stream down to the client. The client (which owns the mock DataProvider) runs them via `useChat`'s `onToolCall` / `addToolResult`. Mutating tools (`add_shift`, `update_shift`) are gated by an in-UI approval card before the result is sent back.
- **Frontend**:
  - Install AI Elements primitives (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`).
  - `src/components/command-center/CommandCenterLauncher.tsx` — the FAB.
  - `src/components/command-center/CommandCenterPanel.tsx` — sheet with thread list + chat.
  - `src/components/command-center/ChatThread.tsx` — `useChat` wired to the edge function, renders message parts, tool cards, approval cards.
  - `src/lib/commandCenterStorage.ts` — localStorage helpers for threads.
  - Mount the launcher once inside `AppShell` so it appears on every route.

## Out of scope (prototype mode)

- No cross-device sync (localStorage only).
- No streaming markdown extras (sources, citations).
- No voice / file uploads.
- Tools only touch the in-memory mock data, not a real DB.
