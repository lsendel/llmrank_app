import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server";
import { describe } from "vitest";

export const TEST_CONFIG = {
  apiBaseUrl: process.env.LLM_BOOST_API_URL ?? "https://api.llmrank.app",
  apiToken: process.env.LLM_BOOST_API_TOKEN ?? "",
};

/** Use this instead of `describe` for tests that need a real API token */
export const describeWithApi = TEST_CONFIG.apiToken ? describe : describe.skip;

/** Shared test data — populated by setupTestData() in beforeAll */
export const testData = {
  projectId: "",
  crawlId: "",
  pageId: "",
  issueId: "",
};

/** Create MCP server + client via InMemoryTransport with real API calls */
export async function createTestServerAndClient() {
  const server = createMcpServer({
    apiBaseUrl: TEST_CONFIG.apiBaseUrl,
    apiToken: TEST_CONFIG.apiToken,
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  await server.mcpServer.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    async cleanup() {
      await client.close();
      await server.mcpServer.close();
    },
  };
}

/** Call an MCP tool and parse the JSON text response */
export async function callToolAndParse<T = unknown>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ data: T; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const isError = !!result.isError;
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content[0]?.text ?? "";
  try {
    return { data: JSON.parse(text) as T, isError };
  } catch {
    return { data: text as unknown as T, isError };
  }
}

/**
 * Populate testData by finding/creating a test project with crawl data.
 * Idempotent — reuses existing project if found.
 */
export async function setupTestData(client: Client) {
  // 1. Find existing test project
  const projects = await callToolAndParse<
    Array<{ id: string; domain: string }>
  >(client, "list_projects");

  const existing = (projects.data ?? []).find(
    (p) => p.domain === "example.com" || p.domain?.includes("test"),
  );

  if (existing) {
    testData.projectId = existing.id;
  } else {
    // Create test project
    const created = await callToolAndParse<{ id: string }>(
      client,
      "create_project",
      { name: "MCP Test Project", domain: "example.com" },
    );
    testData.projectId = created.data.id;
  }

  // 2. Find existing crawl
  const crawls = await callToolAndParse<Array<{ id: string; status: string }>>(
    client,
    "list_crawls",
    { projectId: testData.projectId, limit: 1 },
  );

  const completedCrawl = (crawls.data ?? []).find(
    (c) => c.status === "completed" || c.status === "scored",
  );

  if (completedCrawl) {
    testData.crawlId = completedCrawl.id;
  }
  // If no completed crawl, some tool tests will get empty results — that's OK

  // 3. Find a page if crawl exists
  if (testData.crawlId) {
    const pages = await callToolAndParse<
      Array<{ id?: string; pageId?: string }>
    >(client, "list_pages", {
      projectId: testData.projectId,
      page: 1,
      limit: 1,
    });
    const firstPage = (pages.data ?? [])[0];
    testData.pageId = firstPage?.pageId ?? firstPage?.id ?? "";
  }

  // 4. Find an issue if crawl exists
  if (testData.crawlId) {
    const issues = await callToolAndParse<Array<{ id: string }>>(
      client,
      "list_issues",
      { projectId: testData.projectId },
    );
    testData.issueId = (issues.data ?? [])[0]?.id ?? "";
  }
}
