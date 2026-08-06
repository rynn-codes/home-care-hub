import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mockDB } from "@/lib/mockData";
import { requireAuth } from "../auth";

export default defineTool({
  name: "query_clients",
  title: "Query clients",
  description:
    "Search home-care clients by name or status. Returns matching clients with care plan, weekly hours, and primary caregiver.",
  inputSchema: {
    search: z.string().optional().describe("Partial, case-insensitive name match"),
    status: z.enum(["active", "on-hold", "discharged"]).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ search, status, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;

    const rows = mockDB.clients
      .filter((c) => (status ? c.status === status : true))
      .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) : true))
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        carePlan: c.carePlan,
        hoursPerWeek: c.hoursPerWeek,
        primaryCaregiver:
          mockDB.employees.find((e) => e.id === c.primaryCaregiverId)?.name ?? null,
      }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, clients: rows },
    };
  },
});
