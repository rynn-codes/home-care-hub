import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mockDB } from "@/lib/mockData";
import { requireAuth } from "../auth";

export default defineTool({
  name: "query_invoices",
  title: "Query invoices",
  description:
    "List billing invoices, optionally filtered by status or client name, with totals for the matching set.",
  inputSchema: {
    status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
    clientName: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status, clientName, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;

    const rows = mockDB.invoices
      .filter((i) => (status ? i.status === status : true))
      .map((i) => ({
        id: i.id,
        number: i.number,
        client: mockDB.clients.find((c) => c.id === i.clientId)?.name ?? "Unknown",
        amount: i.amount,
        status: i.status,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        issuedAt: i.issuedAt,
      }))
      .filter((i) =>
        clientName ? i.client.toLowerCase().includes(clientName.toLowerCase()) : true,
      )
      .slice(0, limit);

    const total = rows.reduce((sum, r) => sum + r.amount, 0);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ total, invoices: rows }, null, 2) },
      ],
      structuredContent: { count: rows.length, total, invoices: rows },
    };
  },
});
