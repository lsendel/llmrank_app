import { describe, it, expect } from "vitest";
import { createMcpServer } from "../server";

describe("MCP Server", () => {
  it("creates a server with config", () => {
    const server = createMcpServer({
      apiBaseUrl: "https://api.llmboost.io",
      apiToken: "llmb_test_token",
    });

    expect(server).toBeDefined();
    expect(server.mcpServer).toBeDefined();
    expect(typeof server.start).toBe("function");
  });

  it("exposes McpServer instance", () => {
    const server = createMcpServer({
      apiBaseUrl: "https://api.llmboost.io",
      apiToken: "llmb_test_token",
    });

    // McpServer should have been configured with tools, resources, and prompts
    expect(server.mcpServer).toBeDefined();
  });
});
