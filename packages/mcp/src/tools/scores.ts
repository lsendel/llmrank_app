import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerScoreTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_site_score",
    {
      title: "Get Site Score",
      description:
        "Get the overall AI-readiness score for a project. Returns score breakdown: overall (0-100), technical (25% weight), content (30%), AI readiness (30%), performance (15%). Includes letter grade (A-F) and top issues.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/v1/projects/${projectId}/metrics`,
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
    "compare_scores",
    {
      title: "Compare Scores",
      description:
        "Compare scores between two crawls to see improvements or regressions. Shows delta per category and which issues were fixed or introduced.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        crawlIdA: z.string().uuid().describe("Earlier crawl ID (baseline)"),
        crawlIdB: z.string().uuid().describe("Later crawl ID (comparison)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId: _projectId, crawlIdA, crawlIdB }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/crawls/${crawlIdA}/compare/${crawlIdB}`,
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
    "get_score_history",
    {
      title: "Get Score History",
      description:
        "Get score trends over time for a project. Returns historical scores per crawl, useful for tracking optimization progress.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of historical data points"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, limit }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/crawls/project/${projectId}/history?limit=${limit}`,
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
