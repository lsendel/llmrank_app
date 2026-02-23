import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerPipelineTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "run_full_analysis",
    {
      title: "Run Full Analysis",
      description:
        "Run the full AI intelligence pipeline for a project: site description, personas, keywords, competitors, visibility checks, content optimization, and health check. Returns pipeline run status when complete.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID to analyze"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/rerun-auto-generation`,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Pipeline triggered.\n${JSON.stringify(result.data, null, 2)}`,
            },
          ],
        };
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_pipeline_status",
    {
      title: "Get Pipeline Status",
      description:
        "Get the latest pipeline run status and step results for a project. Shows which steps completed, failed, or were skipped.",
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
          `/api/pipeline/${projectId}/latest`,
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
    "validate_settings",
    {
      title: "Validate Project Settings",
      description:
        "Run a health check on project settings. Validates robots.txt AI crawler access, llms.txt presence, keyword coverage, competitor tracking, and crawl schedule configuration.",
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
          `/api/pipeline/${projectId}/health-check`,
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
    "update_pipeline_settings",
    {
      title: "Update Pipeline Settings",
      description:
        "Update pipeline settings for a project. Control auto-run on crawl, skip specific steps, and configure limits.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        autoRunOnCrawl: z
          .boolean()
          .optional()
          .describe("Auto-run pipeline when crawl completes"),
        skipSteps: z
          .array(z.string())
          .optional()
          .describe(
            "Steps to skip (e.g. competitors, visibility_check, content_optimization)",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, autoRunOnCrawl, skipSteps }) => {
      try {
        const settings: Record<string, unknown> = {};
        if (autoRunOnCrawl !== undefined)
          settings.autoRunOnCrawl = autoRunOnCrawl;
        if (skipSteps !== undefined) settings.skipSteps = skipSteps;

        const result = await ctx.client.patch<{ data: unknown }>(
          `/api/pipeline/${projectId}/settings`,
          settings,
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Pipeline settings updated.\n${JSON.stringify(result.data, null, 2)}`,
            },
          ],
        };
      } catch (e) {
        return formatError(e);
      }
    },
  );
}
