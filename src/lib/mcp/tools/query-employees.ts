import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mockDB } from "@/lib/mockData";
import { requireAuth } from "../auth";

export default defineTool({
  name: "query_employees",
  title: "Query caregivers",
  description:
    "Search caregivers and staff by name, role, or status. Includes hours this week and credential expiry dates.",
  inputSchema: {
    search: z.string().optional(),
    role: z.enum(["Caregiver", "RN", "LPN", "Coordinator"]).optional(),
    status: z.enum(["active", "on-leave", "inactive"]).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ search, role, status, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;

    const rows = mockDB.employees
      .filter((e) => (role ? e.role === role : true))
      .filter((e) => (status ? e.status === status : true))
      .filter((e) => (search ? e.name.toLowerCase().includes(search.toLowerCase()) : true))
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        status: e.status,
        hoursThisWeek: e.hoursThisWeek,
        credentials: e.credentials,
        assignedClients: e.assignedClientIds.length,
      }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, employees: rows },
    };
  },
});
