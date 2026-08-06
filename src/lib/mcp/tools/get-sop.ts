import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mockDB } from "@/lib/mockData";
import { requireAuth } from "../auth";

export default defineTool({
  name: "get_sops",
  title: "Get SOPs",
  description:
    "List standard operating procedures, or fetch the latest content of one SOP by id or title match.",
  inputSchema: {
    search: z.string().optional().describe("Title or id to fetch full content for"),
    category: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ search, category }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;

    const filtered = mockDB.sops.filter((s) =>
      category ? s.category.toLowerCase() === category.toLowerCase() : true,
    );

    if (search) {
      const q = search.toLowerCase();
      const sop = filtered.find(
        (s) => s.id.toLowerCase() === q || s.title.toLowerCase().includes(q),
      );
      if (!sop) {
        return {
          content: [{ type: "text" as const, text: `No SOP matched "${search}".` }],
          isError: true,
        };
      }
      const latest = sop.versions[sop.versions.length - 1];
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${sop.title}\nCategory: ${sop.category}\nVersion ${latest?.version} · updated ${sop.updatedAt}\n\n${latest?.content ?? ""}`,
          },
        ],
      };
    }

    const rows = filtered.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      updatedAt: s.updatedAt,
      versions: s.versions.length,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, sops: rows },
    };
  },
});
