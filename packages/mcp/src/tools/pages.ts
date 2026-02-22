import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerPageTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_pages",
    {
      title: "List Pages",
      description:
        "List crawled pages with their AI-readiness scores. Sortable by score, filterable by grade. Returns URL, title, overall score, category scores, and issue count.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        page: z.number().int().min(1).optional().default(1),
        limit: z.number().int().min(1).max(100).optional().default(20),
        sortBy: z
          .enum(["score", "url", "issues"])
          .optional()
          .default("score")
          .describe("Sort field"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, page, limit, sortBy, order }) => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sortBy,
          order,
        });
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/v1/projects/${projectId}/pages?${params}`,
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
    "get_page_details",
    {
      title: "Get Page Details",
      description:
        "Get full analysis for a specific page: scores per category (technical, content, AI readiness, performance), all issues with severity, and fix recommendations.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId: _projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/pages/${pageId}`,
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
