import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerProjectTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description:
        "List all projects in the user's account with their domains and latest scores",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const result = await ctx.client.get<{ data: unknown[] }>(
          "/api/projects",
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
    "get_project",
    {
      title: "Get Project",
      description:
        "Get detailed information about a specific project including latest crawl score, domain, and settings",
      inputSchema: z.object({
        projectId: z
          .string()
          .uuid()
          .describe("The UUID of the project to retrieve"),
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
          `/api/projects/${projectId}`,
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
    "create_project",
    {
      title: "Create Project",
      description:
        "Create a new project by providing a domain to track. The domain will be validated and a project created for crawling.",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("Project display name"),
        domain: z
          .string()
          .min(1)
          .describe("Domain to crawl (e.g., example.com)"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, domain }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          "/api/projects",
          { name, domain },
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
