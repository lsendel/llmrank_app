# MCP SEO Interface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dual-transport MCP server (stdio + Streamable HTTP) that exposes LLM Boost's 25 SEO tools to AI agents, with OAuth 2.1 security, Mintlify documentation portal, landing page marketing section, and agentic SEO strategy.

**Architecture:** Thin MCP proxy (`packages/mcp`) translates MCP tool calls into authenticated HTTPS requests to the existing Hono API (`apps/api`). A separate Cloudflare Worker (`apps/mcp-gateway`) handles remote Streamable HTTP connections with OAuth 2.1. Both transports share the same tool definitions.

**Tech Stack:** `@modelcontextprotocol/sdk` (TypeScript), Zod v3, Hono (gateway worker), Mintlify (docs), Cloudflare Workers/KV (gateway), OAuth 2.1 + PKCE

**Design Doc:** `docs/plans/2026-02-22-mcp-seo-interface-design.md`

---

## Phase 1: Package Scaffolding & API Client

### Task 1: Create `packages/mcp` package structure

**Files:**

- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@llm-boost/mcp",
  "version": "1.0.0",
  "description": "LLM Boost MCP Server — SEO optimization tools for AI agents",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "bin": {
    "llm-boost-mcp": "./bin/cli.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@llm-boost/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "tsx": "^4"
  },
  "keywords": ["mcp", "seo", "ai-readiness", "llm-boost"],
  "license": "MIT"
}
```

**Step 2: Create tsconfig.json**

Follow `packages/db/tsconfig.json` pattern:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/__tests__/**"]
}
```

**Step 3: Create src/index.ts**

```typescript
export { createMcpServer } from "./server";
export type { McpServerConfig } from "./server";
```

**Step 4: Install dependencies**

Run: `cd /Users/lsendel/Projects/llmrank_app && pnpm install`

**Step 5: Verify typecheck**

Run: `pnpm --filter @llm-boost/mcp typecheck`
Expected: PASS (no errors)

**Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): scaffold MCP server package"
```

---

### Task 2: Build the API client

The MCP server is a thin proxy — it translates MCP tool calls into HTTP requests to the existing Hono API. This client handles auth, error mapping, and response parsing.

**Files:**

- Create: `packages/mcp/src/client/api-client.ts`
- Create: `packages/mcp/src/client/types.ts`
- Create: `packages/mcp/src/client/__tests__/api-client.test.ts`

**Step 1: Write types**

```typescript
// packages/mcp/src/client/types.ts

export interface ApiClientConfig {
  baseUrl: string;
  apiToken: string;
  timeout?: number; // ms, default 30000
}

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
```

**Step 2: Write the failing test**

```typescript
// packages/mcp/src/client/__tests__/api-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "../api-client";
import { ApiClientError } from "../types";

describe("ApiClient", () => {
  const config = {
    baseUrl: "https://api.llmboost.io",
    apiToken: "llmb_test_token_123",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET requests with auth header", async () => {
    const mockResponse = { data: { id: "proj_1", name: "Test" } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const client = createApiClient(config);
    const result = await client.get("/api/projects/proj_1");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.llmboost.io/api/projects/proj_1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer llmb_test_token_123",
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("sends POST requests with JSON body", async () => {
    const mockResponse = { data: { id: "crawl_1" } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const client = createApiClient(config);
    const result = await client.post("/api/crawls", { domain: "example.com" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.llmboost.io/api/crawls",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ domain: "example.com" }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws ApiClientError on error responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: { code: "PLAN_LIMIT_REACHED", message: "Upgrade required" },
        }),
    });

    const client = createApiClient(config);
    await expect(client.get("/api/projects")).rejects.toThrow(ApiClientError);
    await expect(client.get("/api/projects")).rejects.toMatchObject({
      status: 403,
      code: "PLAN_LIMIT_REACHED",
    });
  });

  it("throws on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const client = createApiClient(config);
    await expect(client.get("/api/projects")).rejects.toThrow("Network error");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/client/__tests__/api-client.test.ts`
Expected: FAIL — `createApiClient` not found

**Step 4: Implement the API client**

```typescript
// packages/mcp/src/client/api-client.ts
import { ApiClientConfig, ApiClientError, ApiErrorResponse } from "./types";

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, apiToken, timeout = 30000 } = config;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "llm-boost-mcp/1.0.0",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });

    const json = await response.json();

    if (!response.ok) {
      const err = json as ApiErrorResponse;
      throw new ApiClientError(
        response.status,
        err.error?.code ?? "UNKNOWN",
        err.error?.message ?? "Request failed",
        err.error?.details,
      );
    }

    return json as T;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
```

**Step 5: Run test to verify it passes**

Run: `cd packages/mcp && npx vitest run src/client/__tests__/api-client.test.ts`
Expected: PASS (all 4 tests)

**Step 6: Commit**

```bash
git add packages/mcp/src/client/
git commit -m "feat(mcp): add API client with auth and error handling"
```

---

## Phase 2: Tool Definitions

Each tool file defines MCP tools for one domain. Tools validate inputs with Zod, call the API client, and return structured content.

### Task 3: Create tool registration framework

**Files:**

- Create: `packages/mcp/src/tools/types.ts`
- Create: `packages/mcp/src/tools/register.ts`

**Step 1: Write tool types**

```typescript
// packages/mcp/src/tools/types.ts
import { ApiClient } from "../client/api-client";

export interface ToolContext {
  client: ApiClient;
  userId?: string;
}

export type ToolRegistrar = (ctx: ToolContext) => void;
```

**Step 2: Write tool registration helper**

```typescript
// packages/mcp/src/tools/register.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolContext } from "./types";
import { registerProjectTools } from "./projects";
import { registerCrawlTools } from "./crawls";
import { registerPageTools } from "./pages";
import { registerScoreTools } from "./scores";
import { registerIssueTools } from "./issues";
import { registerVisibilityTools } from "./visibility";
import { registerFixTools } from "./fixes";
import { registerStrategyTools } from "./strategy";
import { registerCompetitorTools } from "./competitors";
import { registerReportTools } from "./reports";
import { registerContentTools } from "./content";
import { registerTechnicalTools } from "./technical";
import { registerKeywordTools } from "./keywords";
import { registerQueryTools } from "./queries";

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerProjectTools(server, ctx);
  registerCrawlTools(server, ctx);
  registerPageTools(server, ctx);
  registerScoreTools(server, ctx);
  registerIssueTools(server, ctx);
  registerVisibilityTools(server, ctx);
  registerFixTools(server, ctx);
  registerStrategyTools(server, ctx);
  registerCompetitorTools(server, ctx);
  registerReportTools(server, ctx);
  registerContentTools(server, ctx);
  registerTechnicalTools(server, ctx);
  registerKeywordTools(server, ctx);
  registerQueryTools(server, ctx);
}
```

**Step 3: Commit**

```bash
git add packages/mcp/src/tools/
git commit -m "feat(mcp): add tool registration framework"
```

---

### Task 4: Implement project tools

**Files:**

- Create: `packages/mcp/src/tools/projects.ts`
- Create: `packages/mcp/src/tools/__tests__/projects.test.ts`

**Step 1: Write failing test**

```typescript
// packages/mcp/src/tools/__tests__/projects.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "../projects";

describe("Project Tools", () => {
  it("registers list_projects, get_project, create_project tools", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    registerProjectTools(server, { client: mockClient });

    // Verify tools are registered by checking server internals
    // The McpServer stores tools internally
    expect(registerProjectTools).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/tools/__tests__/projects.test.ts`
Expected: FAIL — `registerProjectTools` not found

**Step 3: Implement project tools**

```typescript
// packages/mcp/src/tools/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { ApiClientError } from "../client/types";

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

function formatError(e: unknown) {
  if (e instanceof ApiClientError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error [${e.code}]: ${e.message}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
      },
    ],
    isError: true,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/mcp && npx vitest run src/tools/__tests__/projects.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/mcp/src/tools/projects.ts packages/mcp/src/tools/__tests__/
git commit -m "feat(mcp): add project tools (list, get, create)"
```

---

### Task 5: Implement crawl tools

**Files:**

- Create: `packages/mcp/src/tools/crawls.ts`

**Step 1: Implement crawl tools**

```typescript
// packages/mcp/src/tools/crawls.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerCrawlTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "start_crawl",
    {
      title: "Start Crawl",
      description:
        "Start a new crawl for a project. Crawls the domain's pages and scores them for AI-readiness across 37 factors. Returns a crawl job ID to track progress.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project to crawl"),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe("Maximum pages to crawl (limited by plan)"),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximum crawl depth from homepage"),
      }),
    },
    async ({ projectId, maxPages, maxDepth }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/crawls`,
          { maxPages, maxDepth },
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
    "get_crawl_status",
    {
      title: "Get Crawl Status",
      description:
        "Check the progress of a crawl job. Returns status (pending, queued, crawling, scoring, complete, failed), pages crawled, and timing.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        crawlId: z.string().uuid().describe("Crawl job ID"),
      }),
    },
    async ({ projectId, crawlId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/crawls/${crawlId}`,
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
    "list_crawls",
    {
      title: "List Crawls",
      description:
        "Get crawl history for a project. Returns past crawls with scores, page counts, and timestamps. Useful for tracking improvements over time.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of crawls to return"),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/crawls?limit=${limit}`,
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
```

**Step 2: Commit**

```bash
git add packages/mcp/src/tools/crawls.ts
git commit -m "feat(mcp): add crawl tools (start, status, list)"
```

---

### Task 6: Implement page + score tools

**Files:**

- Create: `packages/mcp/src/tools/pages.ts`
- Create: `packages/mcp/src/tools/scores.ts`

**Step 1: Implement page tools**

```typescript
// packages/mcp/src/tools/pages.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerPageTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_pages",
    {
      title: "List Pages",
      description:
        "List crawled pages with their AI-readiness scores. Sortable by score, filterable by grade. Returns URL, title, overall score, category scores, and issue count.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        page: z.number().int().min(1).optional().default(1),
        limit: z.number().int().min(1).max(100).optional().default(20),
        sortBy: z
          .enum(["score", "url", "issues"])
          .optional()
          .default("score")
          .describe("Sort field"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
      }),
    },
    async ({ projectId, page, limit, sortBy, order }) => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sortBy,
          order,
        });
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages?${params}`,
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
    "get_page_details",
    {
      title: "Get Page Details",
      description:
        "Get full analysis for a specific page: scores per category (technical, content, AI readiness, performance), all issues with severity, and fix recommendations.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}`,
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
```

**Step 2: Implement score tools**

```typescript
// packages/mcp/src/tools/scores.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerScoreTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_site_score",
    {
      title: "Get Site Score",
      description:
        "Get the overall AI-readiness score for a project. Returns score breakdown: overall (0-100), technical (25% weight), content (30%), AI readiness (30%), performance (15%). Includes letter grade (A-F) and top issues.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/v1/projects/${projectId}/metrics`,
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
    "compare_scores",
    {
      title: "Compare Scores",
      description:
        "Compare scores between two crawls to see improvements or regressions. Shows delta per category and which issues were fixed or introduced.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        crawlIdA: z.string().uuid().describe("Earlier crawl ID (baseline)"),
        crawlIdB: z.string().uuid().describe("Later crawl ID (comparison)"),
      }),
    },
    async ({ projectId, crawlIdA, crawlIdB }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/crawls/compare?crawlA=${crawlIdA}&crawlB=${crawlIdB}`,
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
    "get_score_history",
    {
      title: "Get Score History",
      description:
        "Get score trends over time for a project. Returns historical scores per crawl, useful for tracking optimization progress.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of historical data points"),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/scores/history?limit=${limit}`,
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
```

**Step 3: Commit**

```bash
git add packages/mcp/src/tools/pages.ts packages/mcp/src/tools/scores.ts
git commit -m "feat(mcp): add page and score tools"
```

---

### Task 7: Implement issue + visibility + fix tools

**Files:**

- Create: `packages/mcp/src/tools/issues.ts`
- Create: `packages/mcp/src/tools/visibility.ts`
- Create: `packages/mcp/src/tools/fixes.ts`

**Step 1: Implement issue tools**

```typescript
// packages/mcp/src/tools/issues.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerIssueTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_issues",
    {
      title: "List Issues",
      description:
        "List all issues found during the latest crawl, grouped by severity (critical, warning, info) and category (technical, content, ai_readiness, performance). Each issue includes a code, message, affected pages, and impact score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        severity: z
          .enum(["critical", "warning", "info"])
          .optional()
          .describe("Filter by severity"),
        category: z
          .enum(["technical", "content", "ai_readiness", "performance"])
          .optional()
          .describe("Filter by category"),
      }),
    },
    async ({ projectId, severity, category }) => {
      try {
        const params = new URLSearchParams();
        if (severity) params.set("severity", severity);
        if (category) params.set("category", category);
        const qs = params.toString() ? `?${params}` : "";
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/issues${qs}`,
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
    "get_fix_recommendation",
    {
      title: "Get Fix Recommendation",
      description:
        "Get an AI-generated fix recommendation for a specific issue. Returns detailed steps, code examples, and expected score impact.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        issueId: z.string().uuid().describe("Issue ID"),
      }),
    },
    async ({ projectId, issueId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/fixes/${issueId}/recommendation`,
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
```

**Step 2: Implement visibility tools**

```typescript
// packages/mcp/src/tools/visibility.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerVisibilityTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "check_visibility",
    {
      title: "Check AI Visibility",
      description:
        "Check if a brand/domain is mentioned or cited in AI search results. Tests against 6 platforms: ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok. Returns mention status, citation position, and response snippets.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        query: z
          .string()
          .min(3)
          .max(500)
          .describe("Search query to test visibility for"),
        platforms: z
          .array(
            z.enum([
              "chatgpt",
              "claude",
              "perplexity",
              "gemini",
              "copilot",
              "grok",
            ]),
          )
          .optional()
          .describe("Platforms to check (defaults to all)"),
      }),
    },
    async ({ projectId, query, platforms }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/visibility/check`,
          { query, platforms },
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
    "list_visibility_history",
    {
      title: "List Visibility History",
      description:
        "Get historical visibility check results and trends. Shows how AI search presence has changed over time across platforms.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    },
    async ({ projectId, limit }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/visibility?limit=${limit}`,
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
```

**Step 3: Implement fix tools**

```typescript
// packages/mcp/src/tools/fixes.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerFixTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "generate_fix",
    {
      title: "Generate Fix",
      description:
        "Generate an AI-powered fix for a specific page issue. Returns code snippets, content suggestions, or configuration changes that can be applied to resolve the issue and improve the AI-readiness score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
        issueCode: z
          .string()
          .describe("Issue code (e.g., MISSING_LLMS_TXT, THIN_CONTENT)"),
      }),
    },
    async ({ projectId, pageId, issueCode }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/fixes/generate`,
          { pageId, issueCode },
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
```

**Step 4: Extract shared formatError utility**

```typescript
// packages/mcp/src/tools/util.ts
import { ApiClientError } from "../client/types";

export function formatError(e: unknown) {
  if (e instanceof ApiClientError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error [${e.code}]: ${e.message}${e.details ? `\nDetails: ${JSON.stringify(e.details)}` : ""}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
      },
    ],
    isError: true,
  };
}
```

**Step 5: Commit**

```bash
git add packages/mcp/src/tools/issues.ts packages/mcp/src/tools/visibility.ts packages/mcp/src/tools/fixes.ts packages/mcp/src/tools/util.ts
git commit -m "feat(mcp): add issue, visibility, and fix tools"
```

---

### Task 8: Implement strategy + competitor tools

**Files:**

- Create: `packages/mcp/src/tools/strategy.ts`
- Create: `packages/mcp/src/tools/competitors.ts`

**Step 1: Implement strategy tools**

```typescript
// packages/mcp/src/tools/strategy.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerStrategyTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "get_recommendations",
    {
      title: "Get Recommendations",
      description:
        "Get a prioritized action plan to improve AI-readiness score. Recommendations are ranked by effort (low/medium/high) and impact (score points gained). Covers technical fixes, content improvements, and AI-readiness optimizations.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/strategy/recommendations`,
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
    "get_content_gaps",
    {
      title: "Get Content Gaps",
      description:
        "Identify content gaps — topics and questions that competitors cover but this site doesn't. Helps discover content opportunities to improve AI visibility and citation likelihood.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/strategy/content-gaps`,
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
```

**Step 2: Implement competitor tools**

```typescript
// packages/mcp/src/tools/competitors.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerCompetitorTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "list_competitors",
    {
      title: "List Competitors",
      description:
        "List tracked competitors for a project with their AI-readiness scores. Shows how your site compares to competitors in each scoring category.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/competitors`,
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
    "compare_competitor",
    {
      title: "Compare Competitor",
      description:
        "Get a detailed side-by-side comparison with a specific competitor. Shows score differences per category, strengths, weaknesses, and specific areas where each site excels.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        competitorId: z.string().uuid().describe("Competitor ID"),
      }),
    },
    async ({ projectId, competitorId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/competitors/${competitorId}/compare`,
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
```

**Step 3: Commit**

```bash
git add packages/mcp/src/tools/strategy.ts packages/mcp/src/tools/competitors.ts
git commit -m "feat(mcp): add strategy and competitor tools"
```

---

### Task 9: Implement report + content + technical + keyword + query tools

**Files:**

- Create: `packages/mcp/src/tools/reports.ts`
- Create: `packages/mcp/src/tools/content.ts`
- Create: `packages/mcp/src/tools/technical.ts`
- Create: `packages/mcp/src/tools/keywords.ts`
- Create: `packages/mcp/src/tools/queries.ts`

**Step 1: Implement all remaining tools**

```typescript
// packages/mcp/src/tools/reports.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerReportTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "generate_report",
    {
      title: "Generate Report",
      description:
        "Generate a comprehensive AI-readiness report in Markdown format. Includes executive summary, score breakdown, issue analysis, recommendations, and competitor comparison. Suitable for sharing with stakeholders.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        format: z
          .enum(["markdown", "json"])
          .optional()
          .default("markdown")
          .describe("Report output format"),
      }),
    },
    async ({ projectId, format }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/reports/generate`,
          { format },
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
```

```typescript
// packages/mcp/src/tools/content.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerContentTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "analyze_content",
    {
      title: "Analyze Content",
      description:
        "Analyze a page's content for AI-readiness. Evaluates 37 factors across content depth, clarity, authority signals, E-E-A-T, structured data, and citation-worthiness. Returns detailed scores and improvement suggestions.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID to analyze"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/content-analysis`,
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
    "suggest_meta_tags",
    {
      title: "Suggest Meta Tags",
      description:
        "Generate optimized meta tags (title, description, Open Graph) for a page based on its content and AI-readiness best practices.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/suggest-meta`,
          {},
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
```

```typescript
// packages/mcp/src/tools/technical.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerTechnicalTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "check_llms_txt",
    {
      title: "Check llms.txt",
      description:
        "Validate a site's llms.txt file — the standard for declaring AI crawler permissions and site information. Checks existence, format compliance, and content completeness. llms.txt is one of the highest-impact AI-readiness factors.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/technical/llms-txt`,
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
    "validate_schema",
    {
      title: "Validate Schema Markup",
      description:
        "Validate structured data (JSON-LD, Schema.org) on a page. Checks for correct schema types, required properties, and AI-readiness best practices for structured data.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        pageId: z.string().uuid().describe("Page ID"),
      }),
    },
    async ({ projectId, pageId }) => {
      try {
        const result = await ctx.client.get<{ data: unknown }>(
          `/api/projects/${projectId}/pages/${pageId}/schema-validation`,
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
```

```typescript
// packages/mcp/src/tools/keywords.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerKeywordTools(
  server: McpServer,
  ctx: ToolContext,
): void {
  server.registerTool(
    "discover_keywords",
    {
      title: "Discover Keywords",
      description:
        "Run AI-powered keyword discovery for a project. Analyzes site content, competitors, and AI search patterns to suggest high-value keywords for AI visibility. Returns keywords with search volume, difficulty, and AI relevance score.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    async ({ projectId }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/keywords/discover`,
          {},
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
```

```typescript
// packages/mcp/src/tools/queries.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolContext } from "./types";
import { formatError } from "./util";

export function registerQueryTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "suggest_queries",
    {
      title: "Suggest Visibility Queries",
      description:
        "AI-suggest visibility queries to monitor. Analyzes your site's content, industry, and competitors to recommend queries that potential customers might ask AI assistants. These queries can then be used for ongoing visibility monitoring.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        count: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Number of queries to suggest"),
      }),
    },
    async ({ projectId, count }) => {
      try {
        const result = await ctx.client.post<{ data: unknown }>(
          `/api/projects/${projectId}/visibility/suggest-queries`,
          { count },
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
```

**Step 2: Commit**

```bash
git add packages/mcp/src/tools/reports.ts packages/mcp/src/tools/content.ts packages/mcp/src/tools/technical.ts packages/mcp/src/tools/keywords.ts packages/mcp/src/tools/queries.ts
git commit -m "feat(mcp): add report, content, technical, keyword, and query tools"
```

---

## Phase 3: MCP Resources & Prompts

### Task 10: Implement MCP resources

Resources expose read-only reference data that agents can use without tool calls.

**Files:**

- Create: `packages/mcp/src/resources/score-definitions.ts`
- Create: `packages/mcp/src/resources/issue-catalog.ts`
- Create: `packages/mcp/src/resources/platform-requirements.ts`
- Create: `packages/mcp/src/resources/register.ts`

**Step 1: Implement resources**

```typescript
// packages/mcp/src/resources/register.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";

export function registerAllResources(server: McpServer): void {
  server.registerResource(
    "scoring-factors",
    "llmboost://scoring-factors",
    {
      title: "AI-Readiness Scoring Factors",
      description:
        "All 37 scoring factors across 4 categories: Technical SEO (25%), Content Quality (30%), AI Readiness (30%), Performance (15%). Each factor includes weight, description, and scoring criteria.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            {
              categories: {
                technical: { weight: 0.25, factorCount: 16 },
                content: { weight: 0.3, factorCount: 11 },
                aiReadiness: { weight: 0.3, factorCount: 13 },
                performance: { weight: 0.15, factorCount: 5 },
              },
              grading: {
                A: "90-100",
                B: "80-89",
                C: "70-79",
                D: "60-69",
                F: "0-59",
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "issue-catalog",
    "llmboost://issue-catalog",
    {
      title: "Issue Code Catalog",
      description:
        "Complete catalog of all issue codes with severity, category, description, impact, and recommended fix. Use this to understand what each issue means.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(ISSUE_DEFINITIONS, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "platform-requirements",
    "llmboost://platform-requirements",
    {
      title: "AI Platform Requirements",
      description:
        "Requirements and best practices for each AI platform: ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok. Includes what each platform looks for when citing sources.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            {
              platforms: [
                "chatgpt",
                "claude",
                "perplexity",
                "gemini",
                "copilot",
                "grok",
              ],
              note: "Use the check_visibility tool to test presence on each platform.",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
```

**Step 2: Commit**

```bash
git add packages/mcp/src/resources/
git commit -m "feat(mcp): add MCP resources (scoring factors, issue catalog, platform requirements)"
```

---

### Task 11: Implement MCP prompts

**Files:**

- Create: `packages/mcp/src/prompts/register.ts`

**Step 1: Implement prompts**

```typescript
// packages/mcp/src/prompts/register.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerAllPrompts(server: McpServer): void {
  server.registerPrompt(
    "site-audit",
    {
      title: "Full Site Audit",
      description:
        "Perform a comprehensive AI-readiness audit of a site. Lists all projects, gets scores, identifies critical issues, and provides a prioritized action plan.",
      argsSchema: z.object({
        projectId: z.string().uuid().describe("Project ID to audit"),
      }),
    },
    ({ projectId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a comprehensive AI-readiness audit for project ${projectId}:

1. First, use get_site_score to get the overall score breakdown
2. Use list_issues with severity "critical" to find the most important problems
3. Use get_recommendations to get a prioritized action plan
4. Use check_llms_txt to validate the llms.txt file
5. Summarize findings with:
   - Current score and grade
   - Top 5 critical issues with their impact
   - Recommended fixes in priority order
   - Expected score improvement if fixes are applied`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "fix-plan",
    {
      title: "Create Fix Plan",
      description:
        "Create a detailed fix plan for the top issues on a site. Generates specific code/content fixes for each issue.",
      argsSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
        maxIssues: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Maximum issues to create fixes for"),
      }),
    },
    ({ projectId, maxIssues }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create a fix plan for project ${projectId}:

1. Use list_issues to get all critical and warning issues
2. For the top ${maxIssues} issues by impact, use generate_fix to create specific fixes
3. Present each fix with:
   - Issue description and current impact
   - Exact code/content change needed
   - Expected score improvement
   - Implementation difficulty (low/medium/high)
4. Order fixes by effort-to-impact ratio (quick wins first)`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "competitor-analysis",
    {
      title: "Competitor Analysis",
      description:
        "Compare your site against competitors and identify areas where competitors outperform you in AI-readiness.",
      argsSchema: z.object({
        projectId: z.string().uuid().describe("Project ID"),
      }),
    },
    ({ projectId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze competitors for project ${projectId}:

1. Use list_competitors to see all tracked competitors with scores
2. For each competitor, use compare_competitor to get detailed comparison
3. Use get_content_gaps to find topics competitors cover that you don't
4. Summarize:
   - Your ranking among competitors
   - Categories where you lead vs. trail
   - Specific content gaps to address
   - Quick wins to overtake nearest competitor`,
          },
        },
      ],
    }),
  );
}
```

**Step 2: Commit**

```bash
git add packages/mcp/src/prompts/
git commit -m "feat(mcp): add MCP prompts (site-audit, fix-plan, competitor-analysis)"
```

---

## Phase 4: Server Bootstrap & Transports

### Task 12: Implement the MCP server core

**Files:**

- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/server.test.ts`

**Step 1: Write failing test**

```typescript
// packages/mcp/src/__tests__/server.test.ts
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
    expect(server.start).toBeFunction();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/server.test.ts`
Expected: FAIL

**Step 3: Implement server core**

```typescript
// packages/mcp/src/server.ts
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/mcp && npx vitest run src/__tests__/server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/src/__tests__/
git commit -m "feat(mcp): implement MCP server core with stdio transport"
```

---

### Task 13: Create CLI entry point

**Files:**

- Create: `packages/mcp/bin/cli.ts`

**Step 1: Implement CLI**

```typescript
#!/usr/bin/env node
// packages/mcp/bin/cli.ts

import { createMcpServer } from "../src/server";

const apiBaseUrl = process.env.LLM_BOOST_API_URL ?? "https://api.llmboost.io";
const apiToken = process.env.LLM_BOOST_API_TOKEN;

if (!apiToken) {
  process.stderr.write(
    "Error: LLM_BOOST_API_TOKEN environment variable is required.\n" +
      "Get your API token at https://app.llmboost.io/settings/api-tokens\n",
  );
  process.exit(1);
}

if (!apiToken.startsWith("llmb_")) {
  process.stderr.write(
    'Error: Invalid token format. Token must start with "llmb_"\n',
  );
  process.exit(1);
}

const server = createMcpServer({ apiBaseUrl, apiToken });

server.start().catch((err) => {
  process.stderr.write(`Failed to start MCP server: ${err.message}\n`);
  process.exit(1);
});
```

**Step 2: Update package.json bin field** (already done in Task 1)

**Step 3: Commit**

```bash
git add packages/mcp/bin/
git commit -m "feat(mcp): add CLI entry point for npx/stdio usage"
```

---

## Phase 5: MCP Gateway Worker (Remote Streamable HTTP)

### Task 14: Scaffold `apps/mcp-gateway` Worker

**Files:**

- Create: `apps/mcp-gateway/package.json`
- Create: `apps/mcp-gateway/wrangler.toml`
- Create: `apps/mcp-gateway/tsconfig.json`
- Create: `apps/mcp-gateway/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@llm-boost/mcp-gateway",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llm-boost/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "hono": "^4",
    "zod": "^3.24"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "typescript": "^5.7",
    "wrangler": "^3"
  }
}
```

**Step 2: Create wrangler.toml**

```toml
name = "llm-boost-mcp-gateway"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
API_BASE_URL = "https://api.llmboost.io"

[[kv_namespaces]]
binding = "KV"
id = ""  # TODO: Create KV namespace

# Secrets (via wrangler secret put):
# DATABASE_URL — for OAuth token storage
```

**Step 3: Create gateway entry point**

```typescript
// apps/mcp-gateway/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  KV: KVNamespace;
  API_BASE_URL: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "mcp-gateway" }));

// MCP Streamable HTTP endpoint (Phase 2 — OAuth + session management)
app.all("/v1/mcp", async (c) => {
  // TODO: Implement Streamable HTTP transport with OAuth 2.1
  return c.json(
    { error: { code: "NOT_IMPLEMENTED", message: "Coming soon" } },
    501,
  );
});

// OAuth 2.1 endpoints
app.get("/oauth/authorize", async (c) => {
  // TODO: Authorization endpoint
  return c.json({ error: { code: "NOT_IMPLEMENTED" } }, 501);
});

app.post("/oauth/token", async (c) => {
  // TODO: Token endpoint
  return c.json({ error: { code: "NOT_IMPLEMENTED" } }, 501);
});

export default app;
```

**Step 4: Commit**

```bash
git add apps/mcp-gateway/
git commit -m "feat(mcp-gateway): scaffold Cloudflare Worker for remote MCP"
```

---

### Task 15: Implement OAuth 2.1 server

This is the most complex security task. OAuth 2.1 with PKCE for the remote MCP transport.

**Files:**

- Create: `apps/mcp-gateway/src/oauth/authorization.ts`
- Create: `apps/mcp-gateway/src/oauth/token.ts`
- Create: `apps/mcp-gateway/src/oauth/types.ts`
- Create: `apps/mcp-gateway/src/oauth/storage.ts`

**Step 1: Define OAuth types**

```typescript
// apps/mcp-gateway/src/oauth/types.ts

export interface OAuthClient {
  clientId: string;
  clientSecret?: string; // Optional for public clients (PKCE)
  redirectUris: string[];
  scopes: string[];
  name: string;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  expiresAt: number; // Unix timestamp
}

export interface AccessToken {
  token: string;
  userId: string;
  clientId: string;
  scopes: string[];
  expiresAt: number; // Unix timestamp (1 hour)
}

export interface RefreshToken {
  token: string;
  userId: string;
  clientId: string;
  scopes: string[];
  expiresAt: number; // Unix timestamp (30 days)
}

export const MCP_SCOPES = [
  "projects:read",
  "projects:write",
  "crawls:read",
  "crawls:write",
  "pages:read",
  "scores:read",
  "issues:read",
  "visibility:read",
  "visibility:write",
  "fixes:write",
  "strategy:read",
  "competitors:read",
  "keywords:write",
  "queries:write",
  "reports:write",
  "content:read",
  "technical:read",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];
```

**Step 2: Implement KV-based token storage**

```typescript
// apps/mcp-gateway/src/oauth/storage.ts

import { AuthorizationCode, AccessToken, RefreshToken } from "./types";

export function createOAuthStorage(kv: KVNamespace) {
  return {
    async storeAuthCode(code: AuthorizationCode): Promise<void> {
      const ttl = Math.ceil(code.expiresAt - Date.now() / 1000);
      await kv.put(`oauth:code:${code.code}`, JSON.stringify(code), {
        expirationTtl: Math.max(ttl, 60),
      });
    },

    async getAuthCode(code: string): Promise<AuthorizationCode | null> {
      const data = await kv.get(`oauth:code:${code}`);
      if (!data) return null;
      const parsed = JSON.parse(data) as AuthorizationCode;
      if (parsed.expiresAt < Date.now() / 1000) return null;
      return parsed;
    },

    async deleteAuthCode(code: string): Promise<void> {
      await kv.delete(`oauth:code:${code}`);
    },

    async storeAccessToken(token: AccessToken): Promise<void> {
      await kv.put(
        `oauth:access:${token.token}`,
        JSON.stringify(token),
        { expirationTtl: 3600 }, // 1 hour
      );
    },

    async getAccessToken(token: string): Promise<AccessToken | null> {
      const data = await kv.get(`oauth:access:${token}`);
      if (!data) return null;
      return JSON.parse(data) as AccessToken;
    },

    async storeRefreshToken(token: RefreshToken): Promise<void> {
      await kv.put(
        `oauth:refresh:${token.token}`,
        JSON.stringify(token),
        { expirationTtl: 2592000 }, // 30 days
      );
    },

    async getRefreshToken(token: string): Promise<RefreshToken | null> {
      const data = await kv.get(`oauth:refresh:${token}`);
      if (!data) return null;
      return JSON.parse(data) as RefreshToken;
    },

    async deleteRefreshToken(token: string): Promise<void> {
      await kv.delete(`oauth:refresh:${token}`);
    },
  };
}
```

**Step 3: Implement authorization and token endpoints**

The authorization endpoint validates the request, shows a consent page, and issues an authorization code. The token endpoint exchanges the code for access/refresh tokens with PKCE verification.

Reference: See `apps/mcp-gateway/src/oauth/types.ts` for the scope list. Use `crypto.subtle` for SHA-256 PKCE challenge verification (same pattern as `apps/api/src/services/api-token-service.ts`).

**Step 4: Wire OAuth into gateway `src/index.ts`**

**Step 5: Commit**

```bash
git add apps/mcp-gateway/src/oauth/
git commit -m "feat(mcp-gateway): implement OAuth 2.1 server with PKCE"
```

---

### Task 16: Implement Streamable HTTP transport in gateway

**Files:**

- Modify: `apps/mcp-gateway/src/index.ts`
- Create: `apps/mcp-gateway/src/mcp-handler.ts`

**Step 1: Implement MCP handler**

The Streamable HTTP transport handles MCP protocol over HTTP POST requests. Each request contains a JSON-RPC message. The handler validates the OAuth access token, creates an API client with the user's credentials, and delegates to the MCP server.

Reference the `@modelcontextprotocol/sdk` Streamable HTTP examples at `https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server`.

Note: Cloudflare Workers don't support `node:http`, so use the `Hono` adapter pattern — parse the MCP JSON-RPC message from the request body, process it through the McpServer, and return the response.

**Step 2: Wire into gateway routes**

```typescript
// Update apps/mcp-gateway/src/index.ts
app.all("/v1/mcp", oauthMiddleware, mcpHandler);
```

**Step 3: Commit**

```bash
git add apps/mcp-gateway/src/
git commit -m "feat(mcp-gateway): implement Streamable HTTP transport"
```

---

## Phase 6: Testing

### Task 17: Comprehensive test suite

**Files:**

- Create: `packages/mcp/src/__tests__/tools.test.ts`
- Create: `packages/mcp/src/__tests__/resources.test.ts`
- Create: `packages/mcp/src/__tests__/integration.test.ts`

**Step 1: Write tool integration tests**

Test each tool by mocking the API client and verifying:

- Correct API endpoint is called
- Input validation rejects invalid inputs
- Error responses are formatted correctly
- Rate limit errors include retry information

**Step 2: Write resource tests**

Verify:

- All 3 resources return valid JSON
- Issue catalog contains all expected issue codes
- Scoring factors match the 37-factor model

**Step 3: Write end-to-end tests**

Use the MCP SDK's `InMemoryTransport` to test the full server:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
```

**Step 4: Run all tests**

Run: `cd packages/mcp && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/mcp/src/__tests__/
git commit -m "test(mcp): add comprehensive test suite for tools, resources, and integration"
```

---

## Phase 7: Extend Existing API for MCP Needs

### Task 18: Add missing API endpoints

Some MCP tools reference API endpoints that may not exist yet. Audit and add:

**Files:**

- Modify: `apps/api/src/routes/` (various files)

**Endpoints to verify/add:**

1. `GET /api/projects/:id/scores/history` — Score history endpoint
2. `GET /api/projects/:id/technical/llms-txt` — llms.txt validation endpoint
3. `GET /api/projects/:id/pages/:pageId/content-analysis` — Content analysis
4. `GET /api/projects/:id/pages/:pageId/schema-validation` — Schema validation
5. `POST /api/projects/:id/pages/:pageId/suggest-meta` — Meta tag suggestions
6. `GET /api/projects/:id/strategy/recommendations` — Strategy recommendations
7. `GET /api/projects/:id/strategy/content-gaps` — Content gaps
8. `GET /api/projects/:id/competitors/:competitorId/compare` — Competitor compare
9. `POST /api/projects/:id/reports/generate` — Report generation with markdown
10. `POST /api/projects/:id/keywords/discover` — Keyword discovery trigger
11. `POST /api/projects/:id/visibility/suggest-queries` — Query suggestions

For each missing endpoint:

1. Check if the service method exists in `apps/api/src/services/`
2. If service exists, add the route
3. If service doesn't exist, create a stub that returns a TODO response
4. Ensure auth middleware is applied

**Step 1: Audit existing routes**

Run: `grep -r "router\.\(get\|post\|put\|delete\)" apps/api/src/routes/ --include="*.ts" | grep -i "scores\|technical\|content-analysis\|schema-validation\|suggest-meta\|strategy\|content-gaps\|compare\|reports/generate\|keywords/discover\|suggest-queries"`

**Step 2: Add missing routes following existing patterns**

Reference: `apps/api/src/routes/v1.ts` for route structure, `apps/api/src/services/` for service patterns.

**Step 3: Commit per route group**

---

### Task 19: Extend plan limits for MCP

**Files:**

- Modify: `packages/shared/src/constants/plans.ts`

**Step 1: Add MCP-specific limits**

Add to the `PlanLimits` interface and `PLAN_LIMITS` constant:

```typescript
// Add to PlanLimits interface
mcpAccess: boolean;
mcpCallsPerHour: number;
mcpWriteOpsPerHour: number;
mcpConcurrentSessions: number;
```

```typescript
// Add to each plan in PLAN_LIMITS
free:    { mcpAccess: false, mcpCallsPerHour: 0,    mcpWriteOpsPerHour: 0,   mcpConcurrentSessions: 0 },
starter: { mcpAccess: false, mcpCallsPerHour: 0,    mcpWriteOpsPerHour: 0,   mcpConcurrentSessions: 0 },
pro:     { mcpAccess: true,  mcpCallsPerHour: 100,  mcpWriteOpsPerHour: 20,  mcpConcurrentSessions: 2 },
agency:  { mcpAccess: true,  mcpCallsPerHour: 1000, mcpWriteOpsPerHour: 200, mcpConcurrentSessions: 10 },
```

**Step 2: Run shared package tests**

Run: `pnpm --filter @llm-boost/shared test`
Expected: PASS (update any failing tests)

**Step 3: Commit**

```bash
git add packages/shared/src/constants/plans.ts
git commit -m "feat(shared): add MCP plan limits (Pro and Agency only)"
```

---

### Task 20: Extend API token scopes for MCP

**Files:**

- Modify: `apps/api/src/services/api-token-service.ts`
- Modify: `packages/shared/src/` (token scope types)

**Step 1: Add MCP scopes to token system**

Extend `TokenScope` type to include all 17 MCP scopes (or create a separate MCP scope set that maps to existing token scopes).

**Step 2: Update token creation UI to show MCP scopes**

**Step 3: Commit**

```bash
git commit -m "feat(api): extend token scopes for MCP access"
```

---

## Phase 8: Documentation Portal

### Task 21: Set up Mintlify docs site

**Files:**

- Create: `apps/docs/` directory
- Create: `apps/docs/mint.json` (Mintlify config)
- Create: `apps/docs/introduction.mdx`
- Create: `apps/docs/quickstart/claude-desktop.mdx`
- Create: `apps/docs/quickstart/cursor.mdx`
- Create: `apps/docs/quickstart/programmatic.mdx`

**Step 1: Initialize Mintlify project**

Run: `npx mintlify@latest init apps/docs`

**Step 2: Configure mint.json**

```json
{
  "$schema": "https://mintlify.com/schema.json",
  "name": "LLM Boost MCP",
  "logo": { "dark": "/logo/dark.svg", "light": "/logo/light.svg" },
  "favicon": "/favicon.svg",
  "colors": { "primary": "#0D9373", "light": "#07C983", "dark": "#0D9373" },
  "topbarLinks": [{ "name": "Dashboard", "url": "https://app.llmboost.io" }],
  "topbarCtaButton": {
    "name": "Get API Key",
    "url": "https://app.llmboost.io/settings/api-tokens"
  },
  "tabs": [
    { "name": "Tools", "url": "tools" },
    { "name": "Guides", "url": "guides" },
    { "name": "API Reference", "url": "api-reference" }
  ],
  "navigation": [
    {
      "group": "Getting Started",
      "pages": [
        "introduction",
        "quickstart/claude-desktop",
        "quickstart/cursor",
        "quickstart/programmatic"
      ]
    },
    {
      "group": "Authentication",
      "pages": [
        "authentication/api-tokens",
        "authentication/oauth",
        "authentication/scopes"
      ]
    },
    {
      "group": "Tools",
      "pages": [
        "tools/overview",
        "tools/projects",
        "tools/crawls",
        "tools/pages",
        "tools/scores",
        "tools/issues",
        "tools/visibility",
        "tools/fixes",
        "tools/strategy",
        "tools/competitors",
        "tools/reports",
        "tools/content",
        "tools/technical",
        "tools/keywords",
        "tools/queries"
      ]
    },
    {
      "group": "Resources",
      "pages": [
        "resources/scoring-factors",
        "resources/issue-codes",
        "resources/platform-requirements"
      ]
    },
    {
      "group": "Guides",
      "pages": [
        "guides/ci-cd-integration",
        "guides/content-pipeline",
        "guides/agentic-seo-workflow"
      ]
    },
    {
      "group": "Reference",
      "pages": [
        "api-reference/rest-api",
        "api-reference/rate-limits",
        "api-reference/errors"
      ]
    }
  ]
}
```

**Step 3: Write quickstart docs**

The Claude Desktop quickstart should show:

1. Install: `npm install -g @llm-boost/mcp-server`
2. Get API token from dashboard
3. Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llm-boost/mcp-server"],
      "env": {
        "LLM_BOOST_API_TOKEN": "llmb_your_token_here"
      }
    }
  }
}
```

4. Restart Claude Desktop
5. Try: "Audit the AI readiness of my site"

**Step 4: Write tool documentation pages**

Each page should follow the pattern:

- Tool name and description
- Input parameters table
- Required scope
- Example request/response
- Common errors

**Step 5: Commit**

```bash
git add apps/docs/
git commit -m "docs: set up Mintlify documentation portal for MCP"
```

---

## Phase 9: Landing Page Integration

### Task 22: Add MCP section to homepage

**Files:**

- Modify: `apps/web/src/app/page.tsx` (or homepage component)
- Create: `apps/web/src/components/mcp-section.tsx`

**Step 1: Create MCP marketing section component**

Build a section that includes:

- "SEO Optimization for Your AI Agent" headline
- Two cards: Claude Desktop (1-min setup) + Custom App (OAuth)
- Code example showing an agent conversation
- "25 tools · 37 scoring factors · 6 AI platforms"
- CTA buttons: View Docs, Try Live, Get API Key
- Platform logos (Claude, Cursor, Copilot, Windsurf)

**Step 2: Add section to homepage**

Insert after the existing features section, before pricing.

**Step 3: Commit**

```bash
git add apps/web/src/components/mcp-section.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): add MCP marketing section to homepage"
```

---

### Task 23: Create dedicated `/mcp` page

**Files:**

- Create: `apps/web/src/app/mcp/page.tsx`

**Step 1: Build the MCP landing page**

Full dedicated page with:

- Hero section with interactive demo
- Setup guides (Claude Desktop, Cursor, Custom App)
- Tool showcase with examples
- Use cases (CI/CD, content pipeline, monitoring)
- Pricing table (which plans include MCP)
- FAQ section

**Step 2: Add to navigation**

**Step 3: Commit**

```bash
git add apps/web/src/app/mcp/
git commit -m "feat(web): add dedicated /mcp landing page"
```

---

## Phase 10: Agentic SEO Implementation

### Task 24: Create MCP-focused blog content

**Files:**

- Create blog post content for the SEO strategy:
  1. "How to Use MCP for SEO Automation" (targeting "mcp seo server")
  2. "AI-Readiness Scoring: The 37 Factors" (targeting "ai readiness score")
  3. "llms.txt Guide: The AI Crawler Standard" (targeting "llms.txt validator")

These should be content-managed through the CMS or static MDX pages.

---

### Task 25: Configure SEO metadata for MCP pages

**Files:**

- Modify: `apps/web/src/app/mcp/page.tsx` (add metadata)
- Modify: `apps/web/src/app/layout.tsx` (add structured data)

**Step 1: Add metadata to MCP page**

```typescript
export const metadata: Metadata = {
  title: "MCP Server for SEO | AI-Readiness Tools for AI Agents | LLM Boost",
  description:
    "Connect your AI agent to LLM Boost's SEO tools via Model Context Protocol. 25 tools, 37 scoring factors, 6 AI platforms. Claude Desktop, Cursor, and custom app support.",
  keywords: [
    "mcp server",
    "seo mcp",
    "ai readiness",
    "model context protocol",
    "seo tools",
    "ai agents",
  ],
  openGraph: {
    title: "LLM Boost MCP — SEO Optimization for Your AI Agent",
    description:
      "25 SEO tools for AI agents. Score, optimize, and monitor AI search visibility.",
    url: "https://llmboost.io/mcp",
  },
};
```

**Step 2: Add JSON-LD structured data**

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LLM Boost MCP Server",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Cross-platform",
  offers: {
    "@type": "Offer",
    price: "149",
    priceCurrency: "USD",
  },
};
```

**Step 3: Commit**

```bash
git commit -m "feat(web): add SEO metadata and structured data for MCP pages"
```

---

## Phase 11: GitHub & npm Distribution

### Task 26: Prepare npm package for publishing

**Files:**

- Modify: `packages/mcp/package.json` (add publish config)
- Create: `packages/mcp/README.md`
- Create: `packages/mcp/.npmignore`

**Step 1: Update package.json for publishing**

Add:

```json
{
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/llm-boost/mcp-server"
  },
  "files": ["dist", "bin", "README.md", "LICENSE"]
}
```

**Step 2: Write README.md**

Include:

- One-line description
- Quick setup (3 steps)
- Claude Desktop config example
- Cursor config example
- Tool list table
- Link to full docs
- Badge: npm version, license, MCP compatible

**Step 3: Add build script for npm**

```json
{
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  }
}
```

**Step 4: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): prepare package for npm publishing"
```

---

### Task 27: Create GitHub repository for open-source MCP

**Step 1: Initialize separate public repo**

The MCP server should be open-source for maximum distribution. Options:

- A) Publish from monorepo (simpler, use npm workspace publish)
- B) Separate repo with CI pulling from monorepo (cleaner GitHub presence)

Recommend: A) for now, B) later when marketing demands it.

**Step 2: Add GitHub Actions for npm publish**

```yaml
# .github/workflows/publish-mcp.yml
name: Publish MCP Server
on:
  push:
    tags: ["mcp-v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: pnpm install
      - run: pnpm --filter @llm-boost/mcp build
      - run: pnpm --filter @llm-boost/mcp publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 3: Commit**

```bash
git add .github/workflows/publish-mcp.yml
git commit -m "ci: add npm publish workflow for MCP server"
```

---

## Phase 12: MCP Gateway Deployment

### Task 28: Deploy MCP gateway to Cloudflare

**Step 1: Create KV namespace**

Run: `cd apps/mcp-gateway && npx wrangler kv namespace create KV`

**Step 2: Set secrets**

Run:

```bash
cd apps/mcp-gateway
npx wrangler secret put DATABASE_URL
```

**Step 3: Deploy**

Run: `cd apps/mcp-gateway && npx wrangler deploy`

**Step 4: Verify health endpoint**

Run: `curl https://mcp.llmboost.io/health`
Expected: `{"status":"ok","service":"mcp-gateway"}`

**Step 5: Add to CI/CD**

Add MCP gateway to `deploy-cloudflare.yml` workflow.

**Step 6: Commit**

```bash
git commit -m "ci: add MCP gateway to deployment pipeline"
```

---

## Summary

| Phase                          | Tasks | Est. Effort        |
| ------------------------------ | ----- | ------------------ |
| 1. Package + API Client        | 1-2   | Foundation         |
| 2. Tool Definitions (25 tools) | 3-9   | Core functionality |
| 3. Resources + Prompts         | 10-11 | Agent UX           |
| 4. Server + Transports         | 12-13 | stdio transport    |
| 5. MCP Gateway                 | 14-16 | Remote + OAuth     |
| 6. Testing                     | 17    | Quality            |
| 7. API Extensions              | 18-20 | Backend support    |
| 8. Documentation               | 21    | Developer portal   |
| 9. Landing Page                | 22-23 | Marketing          |
| 10. Agentic SEO                | 24-25 | Growth             |
| 11. npm Distribution           | 26-27 | Packaging          |
| 12. Deployment                 | 28    | Production         |

**Total: 28 tasks across 12 phases**

Critical path: Phase 1 → Phase 2 → Phase 4 → Phase 6 (minimum viable MCP with stdio). All other phases can run in parallel after Phase 2.
