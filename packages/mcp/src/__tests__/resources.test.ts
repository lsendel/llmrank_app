import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server";

describe("MCP Resources", () => {
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

  it("lists 3 resources", async () => {
    const result = await client.listResources();
    expect(result.resources).toHaveLength(3);
    const names = result.resources.map((r) => r.name).sort();
    expect(names).toEqual([
      "issue-catalog",
      "platform-requirements",
      "scoring-factors",
    ]);
  });

  describe("scoring-factors", () => {
    it("contains 4 categories with correct weights", async () => {
      const result = await client.readResource({
        uri: "llmboost://scoring-factors",
      });
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.categories.technical.weight).toBe(0.25);
      expect(data.categories.content.weight).toBe(0.3);
      expect(data.categories.aiReadiness.weight).toBe(0.3);
      expect(data.categories.performance.weight).toBe(0.15);
    });

    it("weights sum to 1.0", async () => {
      const result = await client.readResource({
        uri: "llmboost://scoring-factors",
      });
      const data = JSON.parse(result.contents[0].text as string);
      const sum = Object.values(data.categories).reduce(
        (s: number, c: any) => s + c.weight,
        0,
      );
      expect(sum).toBeCloseTo(1.0);
    });

    it("has grading scale A through F", async () => {
      const result = await client.readResource({
        uri: "llmboost://scoring-factors",
      });
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.grading).toHaveProperty("A");
      expect(data.grading).toHaveProperty("B");
      expect(data.grading).toHaveProperty("C");
      expect(data.grading).toHaveProperty("D");
      expect(data.grading).toHaveProperty("F");
    });
  });

  describe("issue-catalog", () => {
    it("contains issue definitions", async () => {
      const result = await client.readResource({
        uri: "llmboost://issue-catalog",
      });
      const data = JSON.parse(result.contents[0].text as string);
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it("includes known critical issue codes", async () => {
      const result = await client.readResource({
        uri: "llmboost://issue-catalog",
      });
      const data = JSON.parse(result.contents[0].text as string);
      expect(data).toHaveProperty("MISSING_TITLE");
      expect(data).toHaveProperty("AI_CRAWLER_BLOCKED");
      expect(data).toHaveProperty("MISSING_LLMS_TXT");
    });
  });

  describe("platform-requirements", () => {
    it("lists 6 AI platforms", async () => {
      const result = await client.readResource({
        uri: "llmboost://platform-requirements",
      });
      const data = JSON.parse(result.contents[0].text as string);
      expect(data.platforms).toHaveLength(6);
      expect(data.platforms).toContain("chatgpt");
      expect(data.platforms).toContain("claude");
      expect(data.platforms).toContain("perplexity");
    });
  });
});
