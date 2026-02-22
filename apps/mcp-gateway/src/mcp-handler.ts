import { Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AccessToken } from "./oauth/types";

/**
 * Creates a per-request MCP server configured with the user's access token.
 * Stateless mode — each request gets a fresh server + transport.
 *
 * The MCP server proxies tool calls to the existing Hono API using the
 * user's API token (resolved from the OAuth access token).
 */
export async function handleMcpRequest(
  c: Context,
  token: AccessToken,
  apiBaseUrl: string,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  const server = createGatewayMcpServer(token, apiBaseUrl);
  await server.connect(transport);

  return transport.handleRequest(c.req.raw, {
    authInfo: {
      token: token.token,
      clientId: token.clientId,
      scopes: token.scopes,
    },
  });
}

/**
 * Creates an MCP server that proxies to the Hono API.
 * Uses the same tool definitions as packages/mcp but configured per-request
 * with the authenticated user's token.
 */
function createGatewayMcpServer(
  token: AccessToken,
  apiBaseUrl: string,
): McpServer {
  const server = new McpServer(
    { name: "llm-boost-gateway", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  const headers: Record<string, string> = {
    // The userId from the OAuth token is the user's API token
    Authorization: `Bearer ${token.userId}`,
    "Content-Type": "application/json",
    "User-Agent": "llm-boost-mcp-gateway/1.0.0",
  };

  // Helper to proxy API calls
  async function apiCall<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      const err = json as { error?: { code?: string; message?: string } };
      throw new Error(
        `API Error [${err.error?.code ?? response.status}]: ${err.error?.message ?? "Request failed"}`,
      );
    }

    return json as T;
  }

  function formatResult(data: unknown) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  }

  function formatError(e: unknown) {
    return {
      content: [
        {
          type: "text" as const,
          text: e instanceof Error ? e.message : String(e),
        },
      ],
      isError: true,
    };
  }

  // Register a subset of key tools for the gateway
  // (Same tools as packages/mcp but inline to avoid cross-package dependency)

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "List all projects in the user's account",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await apiCall<{ data: unknown }>("/api/projects");
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get Project",
      description: "Get detailed information about a specific project",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await apiCall<{ data: unknown }>(
          `/api/projects/${projectId}`,
        );
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "start_crawl",
    {
      title: "Start Crawl",
      description: "Start a new crawl for a project",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project to crawl"),
        maxPages: z.number().int().min(1).max(2000).optional(),
      }),
    },
    async ({ projectId, maxPages }) => {
      try {
        const result = await apiCall<{ data: unknown }>(
          `/api/projects/${projectId}/crawls`,
          { maxPages },
        );
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "get_site_score",
    {
      title: "Get Site Score",
      description: "Get the overall AI-readiness score for a project",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await apiCall<{ data: unknown }>(
          `/api/v1/projects/${projectId}/metrics`,
        );
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "list_issues",
    {
      title: "List Issues",
      description: "List issues found during the latest crawl",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        severity: z.enum(["critical", "warning", "info"]).optional(),
      }),
    },
    async ({ projectId, severity }) => {
      try {
        const qs = severity ? `?severity=${severity}` : "";
        const result = await apiCall<{ data: unknown }>(
          `/api/projects/${projectId}/issues${qs}`,
        );
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  server.registerTool(
    "check_visibility",
    {
      title: "Check AI Visibility",
      description: "Check if a domain is mentioned in AI search results",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        query: z.string().min(3).max(500).describe("Search query"),
      }),
    },
    async ({ projectId, query }) => {
      try {
        const result = await apiCall<{ data: unknown }>(
          `/api/projects/${projectId}/visibility/check`,
          { query },
        );
        return formatResult(result.data);
      } catch (e) {
        return formatError(e);
      }
    },
  );

  return server;
}
