import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerContentTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "analyze_content",
    {
      title: "Analyze Content",
      description:
        "Analyze a page's content for AI-readiness. Evaluates 37 factors across content depth, clarity, authority signals, E-E-A-T, structured data, and citation-worthiness. Returns detailed scores and improvement suggestions.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID to analyze"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/content-analysis`,
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
    "suggest_meta_tags",
    {
      title: "Suggest Meta Tags",
      description:
        "Generate optimized meta tags (title, description, Open Graph) for a page based on its content and AI-readiness best practices.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/suggest-meta`,
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
