import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server";

describe("MCP Server Integration", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    // Mock fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    const server = createMcpServer({
      apiBaseUrl: "https://api.llmboost.io",
      apiToken: "llmb_test_token",
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await server.mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.mcpServer.close();
    };
  });

  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  describe("Tools", () => {
    it("lists all 25 registered tools", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBe(27);

      const toolNames = result.tools.map((t) => t.name).sort();
      expect(toolNames).toContain("list_projects");
      expect(toolNames).toContain("start_crawl");
      expect(toolNames).toContain("list_pages");
      expect(toolNames).toContain("get_site_score");
      expect(toolNames).toContain("list_issues");
      expect(toolNames).toContain("check_visibility");
      expect(toolNames).toContain("generate_fix");
      expect(toolNames).toContain("get_recommendations");
      expect(toolNames).toContain("list_competitors");
      expect(toolNames).toContain("generate_report");
      expect(toolNames).toContain("analyze_content");
      expect(toolNames).toContain("check_llms_txt");
      expect(toolNames).toContain("discover_keywords");
      expect(toolNames).toContain("suggest_queries");
    });

    it("calls list_projects and returns API response", async () => {
      const mockProjects = [
        { id: "p1", name: "Test Site", domain: "example.com" },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockProjects }),
      });

      const result = await client.callTool({
        name: "list_projects",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);

      const content = result.content[0];
      expect(content).toHaveProperty("type", "text");
      if (content.type === "text") {
        const parsed = JSON.parse(content.text);
        expect(parsed).toEqual(mockProjects);
      }

      // Verify correct API endpoint was called
      expect(fetch).toHaveBeenCalledWith(
        "https://api.llmboost.io/api/projects",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer llmb_test_token",
          }),
        }),
      );
    });

    it("calls get_project with projectId", async () => {
      const mockProject = { id: "p1", name: "Test", domain: "example.com" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockProject }),
      });

      const result = await client.callTool({
        name: "get_project",
        arguments: { projectId: "550e8400-e29b-41d4-a716-446655440000" },
      });

      expect(result.isError).toBeFalsy();
      expect(fetch).toHaveBeenCalledWith(
        "https://api.llmboost.io/api/projects/550e8400-e29b-41d4-a716-446655440000",
        expect.anything(),
      );
    });

    it("calls start_crawl with POST", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: "crawl_1" } }),
      });

      const result = await client.callTool({
        name: "start_crawl",
        arguments: {
          projectId: "550e8400-e29b-41d4-a716-446655440000",
          maxPages: 100,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(fetch).toHaveBeenCalledWith(
        "https://api.llmboost.io/api/crawls/",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"projectId"'),
        }),
      );
    });

    it("returns formatted error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: {
              code: "PLAN_LIMIT_REACHED",
              message: "Upgrade to Pro for more crawls",
            },
          }),
      });

      const result = await client.callTool({
        name: "list_projects",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      const content = result.content[0];
      if (content.type === "text") {
        expect(content.text).toContain("PLAN_LIMIT_REACHED");
        expect(content.text).toContain("Upgrade to Pro");
      }
    });

    it("returns formatted error on network failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await client.callTool({
        name: "list_projects",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === "text") {
        expect(content.text).toContain("Connection refused");
      }
    });
  });

  describe("Resources", () => {
    it("lists all 3 registered resources", async () => {
      const result = await client.listResources();
      expect(result.resources.length).toBe(3);

      const names = result.resources.map((r) => r.name).sort();
      expect(names).toEqual([
        "issue-catalog",
        "platform-requirements",
        "scoring-factors",
      ]);
    });

    it("reads scoring-factors resource", async () => {
      const result = await client.readResource({
        uri: "llmboost://scoring-factors",
      });

      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      const parsed = JSON.parse(content.text as string);
      expect(parsed.categories.technical.weight).toBe(0.25);
      expect(parsed.categories.content.weight).toBe(0.3);
      expect(parsed.categories.aiReadiness.weight).toBe(0.3);
      expect(parsed.categories.performance.weight).toBe(0.15);
      expect(parsed.grading.A).toBe("90-100");
    });

    it("reads issue-catalog resource with all issue codes", async () => {
      const result = await client.readResource({
        uri: "llmboost://issue-catalog",
      });

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text as string);
      // Should have issue definitions
      expect(Object.keys(parsed).length).toBeGreaterThan(0);
      // Check a known issue code
      expect(parsed).toHaveProperty("MISSING_TITLE");
    });

    it("reads platform-requirements resource", async () => {
      const result = await client.readResource({
        uri: "llmboost://platform-requirements",
      });

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text as string);
      expect(parsed.platforms).toContain("chatgpt");
      expect(parsed.platforms).toContain("claude");
      expect(parsed.platforms).toContain("perplexity");
      expect(parsed.platforms).toHaveLength(6);
    });
  });

  describe("Prompts", () => {
    it("lists all 3 registered prompts", async () => {
      const result = await client.listPrompts();
      expect(result.prompts.length).toBe(3);

      const names = result.prompts.map((p) => p.name).sort();
      expect(names).toEqual(["competitor-analysis", "fix-plan", "site-audit"]);
    });

    it("gets site-audit prompt with projectId", async () => {
      const result = await client.getPrompt({
        name: "site-audit",
        arguments: { projectId: "550e8400-e29b-41d4-a716-446655440000" },
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      const content = result.messages[0].content;
      if (typeof content === "object" && "text" in content) {
        expect(content.text).toContain("550e8400-e29b-41d4-a716-446655440000");
        expect(content.text).toContain("get_site_score");
        expect(content.text).toContain("list_issues");
      }
    });
  });
});
