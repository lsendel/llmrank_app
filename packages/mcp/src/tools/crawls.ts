import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerCrawlTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "start_crawl",
    {
      title: "Start Crawl",
      description:
        "Start a new crawl for a project. Crawls the domain's pages and scores them for AI-readiness across 37 factors. Returns a crawl job ID to track progress.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project to crawl"),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Maximum pages to crawl (limited by plan)"),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximum crawl depth from homepage"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, maxPages, maxDepth }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/crawls/`,
          { projectId, maxPages, maxDepth },
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
    "get_crawl_status",
    {
      title: "Get Crawl Status",
      description:
        "Check the progress of a crawl job. Returns status (pending, queued, crawling, scoring, complete, failed), pages crawled, and timing.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        crawlId: z.string().uuid().describe("Crawl job ID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId: _projectId, crawlId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/crawls/${crawlId}`,
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
    "list_crawls",
    {
      title: "List Crawls",
      description:
        "Get crawl history for a project. Returns past crawls with scores, page counts, and timestamps. Useful for tracking improvements over time.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of crawls to return"),
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
          `/api/crawls/project/${projectId}?limit=${limit}`,
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
