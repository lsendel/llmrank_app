import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerStrategyTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "get_recommendations",
    {
      title: "Get Recommendations",
      description:
        "Get a prioritized action plan to improve AI-readiness score. Recommendations are ranked by effort (low/medium/high) and impact (score points gained). Covers technical fixes, content improvements, and AI-readiness optimizations.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/strategy/recommendations`,
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

  server.registerTool(
    "get_content_gaps",
    {
      title: "Get Content Gaps",
      description:
        "Identify content gaps — topics and questions that competitors cover but this site doesn't. Helps discover content opportunities to improve AI visibility and citation likelihood.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/strategy/content-gaps`,
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
