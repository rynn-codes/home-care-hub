import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mockDB } from "@/lib/mockData";
import { requireAuth } from "../auth";

function windowFor(when: string): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  switch (when) {
    case "tomorrow":
      start.setDate(start.getDate() + 1);
      end.setDate(start.getDate() + 1);
      break;
    case "this-week":
      end.setDate(start.getDate() + 7);
      break;
    case "next-week":
      start.setDate(start.getDate() + 7);
      end.setDate(start.getDate() + 7);
      break;
    case "past-week":
      start.setDate(start.getDate() - 7);
      break;
    default:
      end.setDate(start.getDate() + 1);
  }
  return [start, end];
}

export default defineTool({
  name: "query_shifts",
  title: "Query shifts",
  description:
    "Look up scheduled shifts in a date window, optionally filtered by caregiver, client, or shift status.",
  inputSchema: {
    when: z
      .enum(["today", "tomorrow", "this-week", "next-week", "past-week"])
      .default("today"),
    caregiverName: z.string().optional(),
    clientName: z.string().optional(),
    status: z
      .enum(["scheduled", "clocked-in", "completed", "missed", "cancelled"])
      .optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ when, caregiverName, clientName, status, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;

    const [from, to] = windowFor(when);
    const rows = mockDB.shifts
      .filter((s) => {
        const start = new Date(s.start);
        return start >= from && start < to;
      })
      .filter((s) => (status ? s.status === status : true))
      .map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        status: s.status,
        caregiver: mockDB.employees.find((e) => e.id === s.caregiverId)?.name ?? "Unknown",
        client: mockDB.clients.find((c) => c.id === s.clientId)?.name ?? "Unknown",
        notes: s.notes ?? null,
      }))
      .filter((s) =>
        caregiverName ? s.caregiver.toLowerCase().includes(caregiverName.toLowerCase()) : true,
      )
      .filter((s) =>
        clientName ? s.client.toLowerCase().includes(clientName.toLowerCase()) : true,
      )
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, limit);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, window: when, shifts: rows },
    };
  },
});
