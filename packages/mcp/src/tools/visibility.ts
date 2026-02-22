import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerVisibilityTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "check_visibility",
    {
      title: "Check AI Visibility",
      description:
        "Check if a brand/domain is mentioned or cited in AI search results. Tests against 6 platforms: ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok. Returns mention status, citation position, and response snippets.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        query: z
          .string()
          .min(3)
          .max(500)
          .describe("Search query to test visibility for"),
        platforms: z
          .array(
            z.enum([
              "chatgpt",
              "claude",
              "perplexity",
              "gemini",
              "copilot",
              "grok",
            ]),
          )
          .optional()
          .describe("Platforms to check (defaults to all)"),
      }),
    },
    async ({ projectId, query, platforms }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/visibility/check`,
          { query, platforms },
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
    "list_visibility_history",
    {
      title: "List Visibility History",
      description:
        "Get historical visibility check results and trends. Shows how AI search presence has changed over time across platforms.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/visibility?limit=${limit}`,
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
