import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerTechnicalTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "check_llms_txt",
    {
      title: "Check llms.txt",
      description:
        "Validate a site's llms.txt file — the standard for declaring AI crawler permissions and site information. Checks existence, format compliance, and content completeness. llms.txt is one of the highest-impact AI-readiness factors.",
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
          `/api/projects/${projectId}/technical/llms-txt`,
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
    "validate_schema",
    {
      title: "Validate Schema Markup",
      description:
        "Validate structured data (JSON-LD, Schema.org) on a page. Checks for correct schema types, required properties, and AI-readiness best practices for structured data.",
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
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/schema-validation`,
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
