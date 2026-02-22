import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerQueryTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "suggest_queries",
    {
      title: "Suggest Visibility Queries",
      description:
        "AI-suggest visibility queries to monitor. Analyzes your site's content, industry, and competitors to recommend queries that potential customers might ask AI assistants. These queries can then be used for ongoing visibility monitoring.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        count: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Number of queries to suggest"),
      }),
    },
    async ({ projectId, count }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/visibility/suggest-queries`,
          { count },
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
