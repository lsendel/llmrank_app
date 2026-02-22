import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerFixTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "generate_fix",
    {
      title: "Generate Fix",
      description:
        "Generate an AI-powered fix for a specific page issue. Returns code snippets, content suggestions, or configuration changes that can be applied to resolve the issue and improve the AI-readiness score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
        issueCode: z
          .string()
          .describe("Issue code (e.g., MISSING_LLMS_TXT, THIN_CONTENT)"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, pageId, issueCode }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/fixes/generate`,
          { projectId, pageId, issueCode },
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
