import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApiClient } from "./client/api-client";
import { registerAllTools } from "./tools/register";
import { registerAllResources } from "./resources/register";
import { registerAllPrompts } from "./prompts/register";

export interface McpServerConfig {
  apiBaseUrl: string;
  apiToken: string;
  timeout?: number;
}

export function createMcpServer(config: McpServerConfig) {
  const mcpServer = new McpServer(
    {
      name: "llm-boost",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  const client = createApiClient({
    baseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    timeout: config.timeout,
  });

  const ctx = { client };

  registerAllTools(mcpServer, ctx);
  registerAllResources(mcpServer);
  registerAllPrompts(mcpServer);

  return {
    mcpServer,
    async start() {
      const transport = new StdioServerTransport();
      await mcpServer.connect(transport);
    },
  };
}
