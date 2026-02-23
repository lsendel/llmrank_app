import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server";

const FAKE_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("MCP Prompts", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createMcpServer({
      apiBaseUrl: "https://unused.test",
      apiToken: "llmb_unused",
    });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "1.0.0" });
    await server.mcpServer.connect(st);
    await client.connect(ct);
    cleanup = async () => {
      await client.close();
      await server.mcpServer.close();
    };
  });

  afterAll(async () => cleanup());

  it("lists 3 prompts", async () => {
    const result = await client.listPrompts();
    expect(result.prompts).toHaveLength(3);
    const names = result.prompts.map((p) => p.name).sort();
    expect(names).toEqual(["competitor-analysis", "fix-plan", "site-audit"]);
  });

  describe("site-audit", () => {
    it("includes projectId and tool references", async () => {
      const result = await client.getPrompt({
        name: "site-audit",
        arguments: { projectId: FAKE_UUID },
      });
      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain(FAKE_UUID);
      expect(text).toContain("get_site_score");
      expect(text).toContain("list_issues");
      expect(text).toContain("check_llms_txt");
    });
  });

  describe("fix-plan", () => {
    it("includes projectId and generate_fix reference", async () => {
      const result = await client.getPrompt({
        name: "fix-plan",
        arguments: { projectId: FAKE_UUID },
      });
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain(FAKE_UUID);
      expect(text).toContain("generate_fix");
      expect(text).toContain("list_issues");
    });

    it("advertises maxIssues argument in prompt listing", async () => {
      const result = await client.listPrompts();
      const fixPlan = result.prompts.find((p) => p.name === "fix-plan");
      expect(fixPlan).toBeDefined();
      const maxIssuesArg = fixPlan!.arguments?.find(
        (a) => a.name === "maxIssues",
      );
      expect(maxIssuesArg).toBeDefined();
      expect(maxIssuesArg!.required).toBe(false);
    });

    it("uses default maxIssues of 5", async () => {
      const result = await client.getPrompt({
        name: "fix-plan",
        arguments: { projectId: FAKE_UUID },
      });
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain("5");
    });
  });

  describe("competitor-analysis", () => {
    it("includes projectId and competitor tool references", async () => {
      const result = await client.getPrompt({
        name: "competitor-analysis",
        arguments: { projectId: FAKE_UUID },
      });
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain(FAKE_UUID);
      expect(text).toContain("list_competitors");
      expect(text).toContain("compare_competitor");
      expect(text).toContain("get_content_gaps");
    });
  });
});
