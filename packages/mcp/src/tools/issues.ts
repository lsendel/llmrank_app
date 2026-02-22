import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerIssueTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_issues",
    {
      title: "List Issues",
      description:
        "List all issues found during the latest crawl, grouped by severity (critical, warning, info) and category (technical, content, ai_readiness, performance). Each issue includes a code, message, affected pages, and impact score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        severity: z
          .enum(["critical", "warning", "info"])
          .optional()
          .describe("Filter by severity"),
        category: z
          .enum(["technical", "content", "ai_readiness", "performance"])
          .optional()
          .describe("Filter by category"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, severity, category }) => {
      try {
        const params = new URLSearchParams();
        if (severity) params.set("severity", severity);
        if (category) params.set("category", category);
        const qs = params.toString() ? `?${params}` : "";
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/v1/projects/${projectId}/issues${qs}`,
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
    "get_fix_recommendation",
    {
      title: "Get Fix Recommendation",
      description:
        "Get an AI-generated fix recommendation for a specific issue. Returns detailed steps, code examples, and expected score impact.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        issueId: z.string().uuid().describe("Issue ID"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, issueId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/fixes/${issueId}/recommendation`,
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
