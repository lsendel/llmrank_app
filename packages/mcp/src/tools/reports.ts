import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerReportTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "generate_report",
    {
      title: "Generate Report",
      description:
        "Generate a comprehensive AI-readiness report in Markdown format. Includes executive summary, score breakdown, issue analysis, recommendations, and competitor comparison. Suitable for sharing with stakeholders.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        format: z
          .enum(["markdown", "json"])
          .optional()
          .default("markdown")
          .describe("Report output format"),
      }),
    },
    async ({ projectId, format }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/reports/generate`,
          { projectId, format },
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
