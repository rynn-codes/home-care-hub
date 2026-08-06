import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Returns an error result when the caller has no verified OAuth identity,
 * otherwise `null` so the tool can continue.
 */
export function requireAuth(ctx: ToolContext) {
  if (ctx?.isAuthenticated?.()) return null;
  return {
    content: [
      {
        type: "text" as const,
        text: "Not authenticated. Sign in to Home Care Hub to use this tool.",
      },
    ],
    isError: true,
  };
}
