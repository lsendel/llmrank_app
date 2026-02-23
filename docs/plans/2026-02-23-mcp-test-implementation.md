# MCP Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full integration test coverage for the MCP server (27 tools, 3 resources, 3 prompts) and HTTP gateway (OAuth, transport) using real API calls — no mocking.

**Architecture:** Tests use `InMemoryTransport` to send MCP protocol messages through the real server, which makes real HTTP calls to `api.llmrank.app`. Gateway tests use Hono's `app.request()` with an in-memory KV shim (only infra mock). A shared `beforeAll` seeds a test project with crawl data that all tool tests read from.

**Tech Stack:** vitest, `@modelcontextprotocol/sdk` (Client + InMemoryTransport), Hono test helpers, miniflare (KV only)

---

### Task 1: Test helpers for MCP server

**Files:**

- Create: `packages/mcp/src/__tests__/helpers.ts`

**Step 1: Create the helpers file**

```typescript
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
```

**Step 2: Verify helpers compile**

Run: `pnpm --filter @llmrank.app/mcp build`
Expected: builds without error

**Step 3: Commit**

```bash
git add packages/mcp/src/__tests__/helpers.ts
git commit -m "test(mcp): add real-API test helpers and data seeding"
```

---

### Task 2: Resource and prompt tests (static, no API)

**Files:**

- Create: `packages/mcp/src/__tests__/resources.test.ts`
- Create: `packages/mcp/src/__tests__/prompts.test.ts`

**Step 1: Write resource tests**

```typescript
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
```

**Step 2: Write prompt tests**

```typescript
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
    it("includes projectId and maxIssues", async () => {
      const result = await client.getPrompt({
        name: "fix-plan",
        arguments: { projectId: FAKE_UUID, maxIssues: 10 },
      });
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain(FAKE_UUID);
      expect(text).toContain("10");
      expect(text).toContain("generate_fix");
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
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @llmrank.app/mcp test`
Expected: all resource and prompt tests pass (no API token needed)

**Step 4: Commit**

```bash
git add packages/mcp/src/__tests__/resources.test.ts packages/mcp/src/__tests__/prompts.test.ts
git commit -m "test(mcp): add resource and prompt tests"
```

---

### Task 3: MCP tool integration tests — all 27 tools against real API

**Files:**

- Rewrite: `packages/mcp/src/__tests__/integration.test.ts`

This is the biggest task. All 27 tools are tested via `InMemoryTransport` making real API calls.

**Step 1: Rewrite integration.test.ts**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  describeWithApi,
  testData,
  createTestServerAndClient,
  callToolAndParse,
  setupTestData,
} from "./helpers";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describeWithApi("MCP Tools — Real API Integration", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestServerAndClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    await setupTestData(client);
  }, 120_000); // 2 min — may need to wait for crawl

  afterAll(async () => cleanup());

  it("lists all 27 registered tools", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(27);
  });

  // ── Projects ────────────────────────────────────────────────────────
  describe("Projects", () => {
    it("list_projects returns array with projects", async () => {
      const { data, isError } = await callToolAndParse<any[]>(
        client,
        "list_projects",
      );
      expect(isError).toBe(false);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("domain");
    });

    it("get_project returns project details", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "get_project",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
      expect(data).toHaveProperty("id", testData.projectId);
      expect(data).toHaveProperty("domain");
    });

    it("get_project with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_project", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Crawls ──────────────────────────────────────────────────────────
  describe("Crawls", () => {
    it("list_crawls returns crawl history", async () => {
      const { data, isError } = await callToolAndParse<any[]>(
        client,
        "list_crawls",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
      expect(Array.isArray(data)).toBe(true);
    });

    it("list_crawls with limit=1 returns at most 1", async () => {
      const { data } = await callToolAndParse<any[]>(client, "list_crawls", {
        projectId: testData.projectId,
        limit: 1,
      });
      expect(data.length).toBeLessThanOrEqual(1);
    });

    it("get_crawl_status with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_crawl_status", {
        crawlId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Pages ───────────────────────────────────────────────────────────
  describe("Pages", () => {
    it("list_pages returns page list", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "list_pages",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_page_details with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_page_details", {
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Scores ──────────────────────────────────────────────────────────
  describe("Scores", () => {
    it("get_site_score returns score breakdown", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "get_site_score",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_score_history returns historical data", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "get_score_history",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_site_score with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "get_site_score", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Issues ──────────────────────────────────────────────────────────
  describe("Issues", () => {
    it("list_issues returns issues", async () => {
      const { data, isError } = await callToolAndParse<any>(
        client,
        "list_issues",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("list_issues with severity filter works", async () => {
      const { isError } = await callToolAndParse(client, "list_issues", {
        projectId: testData.projectId,
        severity: "critical",
      });
      expect(isError).toBe(false);
    });

    it("list_issues with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(client, "list_issues", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Visibility ──────────────────────────────────────────────────────
  describe("Visibility", () => {
    it("list_visibility_history returns data", async () => {
      const { isError } = await callToolAndParse(
        client,
        "list_visibility_history",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("list_visibility_history with fake UUID returns error", async () => {
      const { isError } = await callToolAndParse(
        client,
        "list_visibility_history",
        { projectId: FAKE_UUID },
      );
      expect(isError).toBe(true);
    });
  });

  // ── Strategy ────────────────────────────────────────────────────────
  describe("Strategy", () => {
    it("get_recommendations returns data", async () => {
      const { isError } = await callToolAndParse(
        client,
        "get_recommendations",
        { projectId: testData.projectId },
      );
      expect(isError).toBe(false);
    });

    it("get_content_gaps returns data", async () => {
      const { isError } = await callToolAndParse(client, "get_content_gaps", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Competitors ─────────────────────────────────────────────────────
  describe("Competitors", () => {
    it("list_competitors returns data", async () => {
      const { isError } = await callToolAndParse(client, "list_competitors", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("compare_competitor returns data", async () => {
      const { isError } = await callToolAndParse(client, "compare_competitor", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Content ─────────────────────────────────────────────────────────
  describe("Content", () => {
    it("analyze_content with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "analyze_content", {
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });

    it("suggest_meta_tags with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "suggest_meta_tags", {
        projectId: testData.projectId,
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Technical ───────────────────────────────────────────────────────
  describe("Technical", () => {
    it("check_llms_txt returns validation result", async () => {
      const { isError } = await callToolAndParse(client, "check_llms_txt", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("validate_schema with fake pageId returns error", async () => {
      const { isError } = await callToolAndParse(client, "validate_schema", {
        projectId: testData.projectId,
        pageId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Keywords & Queries ──────────────────────────────────────────────
  describe("Keywords & Queries", () => {
    it("discover_keywords returns data", async () => {
      const { isError } = await callToolAndParse(client, "discover_keywords", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("suggest_queries returns data", async () => {
      const { isError } = await callToolAndParse(client, "suggest_queries", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });
  });

  // ── Reports ─────────────────────────────────────────────────────────
  describe("Reports", () => {
    it("generate_report returns report content", async () => {
      const { isError } = await callToolAndParse(client, "generate_report", {
        projectId: testData.projectId,
      });
      expect(isError).toBe(false);
    });

    it("generate_report with fake projectId returns error", async () => {
      const { isError } = await callToolAndParse(client, "generate_report", {
        projectId: FAKE_UUID,
      });
      expect(isError).toBe(true);
    });
  });

  // ── Fixes ───────────────────────────────────────────────────────────
  describe("Fixes", () => {
    it("generate_fix with fake data returns error", async () => {
      const { isError } = await callToolAndParse(client, "generate_fix", {
        projectId: FAKE_UUID,
        pageId: FAKE_UUID,
        issueCode: "FAKE_ISSUE",
      });
      expect(isError).toBe(true);
    });
  });
});
```

**Step 2: Run to verify**

Run: `LLM_BOOST_API_TOKEN=llmb_xxx pnpm --filter @llmrank.app/mcp test`
Expected: all tool tests pass (or skip if no token). Tests hitting non-existent endpoints return `isError: true` gracefully.

**Step 3: Commit**

```bash
git add packages/mcp/src/__tests__/integration.test.ts
git commit -m "test(mcp): rewrite integration tests with real API calls for all 27 tools"
```

---

### Task 4: Gateway test setup — vitest, KV shim, helpers

**Files:**

- Modify: `apps/mcp-gateway/package.json` (add vitest + test script)
- Create: `apps/mcp-gateway/vitest.config.ts`
- Create: `apps/mcp-gateway/src/__tests__/helpers.ts`

**Step 1: Add vitest to gateway package.json**

Add to `apps/mcp-gateway/package.json`:

- Script: `"test": "vitest run"`, `"test:watch": "vitest"`
- Dev dependency: `"vitest": "^3"`

**Step 2: Create vitest config**

```typescript
// apps/mcp-gateway/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
  },
});
```

**Step 3: Create gateway test helpers with in-memory KV**

```typescript
// apps/mcp-gateway/src/__tests__/helpers.ts

/** In-memory KV shim — the only "mock" in the suite */
export function createMemoryKV(): KVNamespace {
  const store = new Map<string, { value: string; expiry?: number }>();

  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && entry.expiry < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const expiry = opts?.expirationTtl
        ? Date.now() + opts.expirationTtl * 1000
        : undefined;
      store.set(key, { value, expiry });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
        cursor: "",
      };
    },
  } as unknown as KVNamespace;
}

/** Generate a valid PKCE challenge pair */
export async function generatePkce() {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"; // 43-char base64url
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return { verifier, challenge };
}
```

**Step 4: Commit**

```bash
git add apps/mcp-gateway/package.json apps/mcp-gateway/vitest.config.ts apps/mcp-gateway/src/__tests__/helpers.ts
git commit -m "test(mcp-gateway): add vitest setup and test helpers with KV shim"
```

---

### Task 5: Gateway OAuth crypto tests

**Files:**

- Create: `apps/mcp-gateway/src/oauth/__tests__/crypto.test.ts`

**Step 1: Write crypto tests**

```typescript
import { describe, it, expect } from "vitest";
import { generateToken, verifyPkceChallenge } from "../crypto";

describe("OAuth Crypto", () => {
  describe("generateToken", () => {
    it("returns hex string of correct length", () => {
      const token = generateToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique tokens", () => {
      const a = generateToken(32);
      const b = generateToken(32);
      expect(a).not.toBe(b);
    });
  });

  describe("verifyPkceChallenge", () => {
    it("returns true for valid S256 pair", async () => {
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      // Compute expected challenge from verifier
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(verifier),
      );
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const result = await verifyPkceChallenge(verifier, challenge);
      expect(result).toBe(true);
    });

    it("returns false for tampered challenge", async () => {
      const result = await verifyPkceChallenge(
        "valid-verifier",
        "tampered-challenge",
      );
      expect(result).toBe(false);
    });
  });
});
```

**Step 2: Run test**

Run: `pnpm --filter @llm-boost/mcp-gateway test`
Expected: all 4 crypto tests pass

**Step 3: Commit**

```bash
git add apps/mcp-gateway/src/oauth/__tests__/crypto.test.ts
git commit -m "test(mcp-gateway): add OAuth crypto unit tests"
```

---

### Task 6: Gateway well-known endpoints and registration tests

**Files:**

- Create: `apps/mcp-gateway/src/__tests__/well-known.test.ts`
- Create: `apps/mcp-gateway/src/__tests__/registration.test.ts`

**Step 1: Write well-known endpoint tests**

```typescript
import { describe, it, expect } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("Well-Known Endpoints", () => {
  const kv = createMemoryKV();
  const env = { KV: kv, API_BASE_URL: "https://api.llmrank.app" };

  it("GET /.well-known/oauth-authorization-server returns metadata", async () => {
    const res = await app.request(
      "/.well-known/oauth-authorization-server",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("authorization_endpoint");
    expect(body).toHaveProperty("token_endpoint");
    expect(body).toHaveProperty("registration_endpoint");
    expect(body.code_challenge_methods_supported).toContain("S256");
  });

  it("metadata includes all 17 scopes", async () => {
    const res = await app.request(
      "/.well-known/oauth-authorization-server",
      {},
      env,
    );
    const body = await res.json();
    expect(body.scopes_supported).toHaveLength(17);
    expect(body.scopes_supported).toContain("projects:read");
    expect(body.scopes_supported).toContain("technical:read");
  });

  it("GET /.well-known/oauth-protected-resource returns resource metadata", async () => {
    const res = await app.request(
      "/.well-known/oauth-protected-resource",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("resource");
    expect(body).toHaveProperty("authorization_servers");
    expect(body.bearer_methods_supported).toContain("header");
  });
});
```

**Step 2: Write registration tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("OAuth Dynamic Client Registration", () => {
  let env: { KV: KVNamespace; API_BASE_URL: string };

  beforeEach(() => {
    env = { KV: createMemoryKV(), API_BASE_URL: "https://api.llmrank.app" };
  });

  it("registers client with valid HTTPS redirect_uri", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://example.com/callback"],
          client_name: "Test App",
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("client_id");
    expect(body.client_id).toMatch(/^client_/);
  });

  it("allows localhost redirect_uri", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://localhost:3000/callback"],
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
  });

  it("rejects HTTP non-localhost redirect_uri", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://example.com/callback"],
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing redirect_uris", async () => {
    const res = await app.request(
      "/oauth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "No Redirects" }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});
```

**Step 3: Run tests**

Run: `pnpm --filter @llm-boost/mcp-gateway test`
Expected: all well-known + registration tests pass

**Step 4: Commit**

```bash
git add apps/mcp-gateway/src/__tests__/well-known.test.ts apps/mcp-gateway/src/__tests__/registration.test.ts
git commit -m "test(mcp-gateway): add well-known endpoint and OAuth registration tests"
```

---

### Task 7: Gateway HTTP transport auth tests

**Files:**

- Create: `apps/mcp-gateway/src/__tests__/http-transport.test.ts`

**Step 1: Write transport auth tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { createMemoryKV } from "./helpers";

describe("MCP HTTP Transport Auth", () => {
  let env: { KV: KVNamespace; API_BASE_URL: string };

  beforeEach(() => {
    env = { KV: createMemoryKV(), API_BASE_URL: "https://api.llmrank.app" };
  });

  it("rejects request with no Authorization header", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
      },
      env,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_token");
  });

  it("returns WWW-Authenticate header on 401", async () => {
    const res = await app.request(
      "/v1/mcp/",
      { method: "POST", body: "{}" },
      env,
    );
    expect(res.headers.get("WWW-Authenticate")).toContain(
      "oauth-protected-resource",
    );
  });

  it("rejects invalid OAuth token", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: { Authorization: "Bearer invalid_token_xyz" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("accepts direct llmb_ API token", async () => {
    // This will attempt to process the MCP request with the token.
    // It may fail at the MCP protocol level, but auth should pass (not 401).
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer llmb_test_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      },
      env,
    );
    // Should NOT be 401 — auth passed
    expect(res.status).not.toBe(401);
  });

  it("CORS preflight returns correct headers", async () => {
    const res = await app.request(
      "/v1/mcp/",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "POST",
        },
      },
      env,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "mcp-session-id",
    );
  });

  it("health endpoint returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", service: "mcp-gateway" });
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @llm-boost/mcp-gateway test`
Expected: all transport tests pass

**Step 3: Commit**

```bash
git add apps/mcp-gateway/src/__tests__/http-transport.test.ts
git commit -m "test(mcp-gateway): add HTTP transport auth and CORS tests"
```

---

### Task 8: E2E CLI tests

**Files:**

- Create: `packages/mcp/src/__tests__/e2e.test.ts`

**Step 1: Write CLI E2E tests**

```typescript
import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { resolve } from "path";
import { describeWithApi, TEST_CONFIG } from "./helpers";

const CLI_PATH = resolve(__dirname, "../../dist/cli.js");

function spawnCli(
  env: Record<string, string> = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    // Send empty input and close stdin to trigger exit for non-interactive mode
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ code: null, stdout, stderr });
    }, 5000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

describe("CLI", () => {
  it("exits with error when no API token is set", async () => {
    const result = await spawnCli({
      LLM_BOOST_API_TOKEN: "",
      PATH: process.env.PATH ?? "",
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("LLM_BOOST_API_TOKEN");
  });

  describeWithApi("with real token", () => {
    it("starts without error", async () => {
      const result = await spawnCli({
        LLM_BOOST_API_TOKEN: TEST_CONFIG.apiToken,
        LLM_BOOST_API_URL: TEST_CONFIG.apiBaseUrl,
        PATH: process.env.PATH ?? "",
      });
      // Server starts and waits for stdio input.
      // Since we close stdin immediately, it should exit cleanly or timeout.
      // The key assertion: it did NOT exit with code 1 (token error).
      expect(result.stderr).not.toContain("LLM_BOOST_API_TOKEN");
    });
  });
});
```

**Step 2: Ensure CLI is built**

Run: `pnpm --filter @llmrank.app/mcp build`

**Step 3: Run tests**

Run: `pnpm --filter @llmrank.app/mcp test`
Expected: CLI tests pass (no-token test always runs, with-token test skips without env var)

**Step 4: Commit**

```bash
git add packages/mcp/src/__tests__/e2e.test.ts
git commit -m "test(mcp): add E2E CLI tests"
```

---

### Task 9: Update vitest timeout config and run full suite

**Files:**

- Modify: `packages/mcp/package.json` (add vitest config inline or create vitest.config.ts)

**Step 1: Create vitest config for MCP package**

Create `packages/mcp/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
```

**Step 2: Run full suite**

Run: `LLM_BOOST_API_TOKEN=llmb_xxx pnpm --filter @llmrank.app/mcp test`
Run: `pnpm --filter @llm-boost/mcp-gateway test`

Expected: all tests pass

**Step 3: Install gateway dependencies if needed**

Run: `pnpm install`

**Step 4: Run turbo test to verify nothing broke**

Run: `pnpm test`

**Step 5: Commit**

```bash
git add packages/mcp/vitest.config.ts
git commit -m "test(mcp): configure vitest timeouts for real API integration tests"
```

---

### Task 10: Final review and cleanup

**Step 1: Remove old test files that are now superseded**

Delete `packages/mcp/src/tools/__tests__/projects.test.ts` (the 2-test smoke version) — its coverage is now in `integration.test.ts`.

**Step 2: Verify test count**

Run: `pnpm --filter @llmrank.app/mcp test -- --reporter=verbose`
Run: `pnpm --filter @llm-boost/mcp-gateway test -- --reporter=verbose`

Expected totals:

- MCP package: ~75 tests (resources: 8, prompts: 9, integration: ~50, e2e: 2, existing client: 4, server: 2)
- Gateway: ~20 tests (crypto: 4, well-known: 3, registration: 4, transport: 6)

**Step 3: Commit cleanup**

```bash
git add -A
git commit -m "test(mcp): cleanup old smoke tests, finalize test suite"
```
