import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerKeywordTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "discover_keywords",
    {
      title: "Discover Keywords",
      description:
        "Run AI-powered keyword discovery for a project. Analyzes site content, competitors, and AI search patterns to suggest high-value keywords for AI visibility. Returns keywords with search volume, difficulty, and AI relevance score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/visibility/${projectId}/discover-keywords`,
          {},
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
