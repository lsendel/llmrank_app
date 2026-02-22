import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerCompetitorTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "list_competitors",
    {
      title: "List Competitors",
      description:
        "List tracked competitors for a project with their AI-readiness scores. Shows how your site compares to competitors in each scoring category.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/competitors`,
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
    "compare_competitor",
    {
      title: "Compare Competitor",
      description:
        "Get a detailed side-by-side comparison with a specific competitor. Shows score differences per category, strengths, weaknesses, and specific areas where each site excels.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        competitorId: z.string().uuid().describe("Competitor ID"),
      }),
    },
    async ({ projectId, competitorId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/competitors/${competitorId}/compare`,
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
