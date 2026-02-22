import { Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  registerAllTools,
  registerAllResources,
  registerAllPrompts,
  createApiClient,
} from "@llmrank.app/mcp";

export interface AuthenticatedUser {
  apiToken: string;
  scopes: string[];
}

/**
 * Creates a per-request MCP server configured with the user's API token.
 * Stateless mode — each request gets a fresh server + transport.
 *
 * Registers all 27 tools from packages/mcp (same tools as the stdio server),
 * plus resources and prompts.
 */
export async function handleMcpRequest(
  c: Context,
  user: AuthenticatedUser,
  apiBaseUrl: string,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  const server = new McpServer(
    { name: "llm-boost", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  const client = createApiClient({
    baseUrl: apiBaseUrl,
    apiToken: user.apiToken,
  });

  const ctx = { client };

  registerAllTools(server, ctx);
  registerAllResources(server);
  registerAllPrompts(server);

  await server.connect(transport);

  return transport.handleRequest(c.req.raw);
}
