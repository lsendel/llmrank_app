import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import type { TokenContext } from "../../services/api-token-service";

// ---------------------------------------------------------------------------
// Mock fns (declared before vi.mock so they're hoisted correctly)
// ---------------------------------------------------------------------------

const mockAuthenticate = vi.fn();
const mockCreate = vi.fn();
const mockList = vi.fn();
const mockRevoke = vi.fn();
const mockUserGetById = vi.fn();
const mockCrawlGetLatest = vi.fn();
const mockScoreListByJob = vi.fn();
const mockScoreListByJobWithPages = vi.fn();
const mockScoreGetIssuesByJob = vi.fn();
const mockVisListByProject = vi.fn();
const mockVisGetTrends = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../services/api-token-service", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createApiTokenService: vi.fn(() => ({
      authenticate: mockAuthenticate,
      create: mockCreate,
      list: mockList,
      revoke: mockRevoke,
    })),
  };
});

vi.mock("@llm-boost/db", () => ({
  apiTokenQueries: vi.fn(() => ({})),
  projectQueries: vi.fn(() => ({ getById: vi.fn() })),
  userQueries: vi.fn(() => ({ getById: mockUserGetById })),
  crawlQueries: vi.fn(() => ({
    getLatestByProject: mockCrawlGetLatest,
  })),
  scoreQueries: vi.fn(() => ({
    listByJob: mockScoreListByJob,
    listByJobWithPages: mockScoreListByJobWithPages,
    getIssuesByJob: mockScoreGetIssuesByJob,
  })),
  visibilityQueries: vi.fn(() => ({
    listByProject: mockVisListByProject,
    getTrends: mockVisGetTrends,
  })),
  createDb: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-1" },
        session: { id: "sess-1" },
      }),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Static imports (AFTER vi.mock declarations — vitest hoists mocks)
// ---------------------------------------------------------------------------

import { apiTokenAuth } from "../../middleware/api-token-auth";
import { tokenRoutes } from "../../routes/api-tokens";
import { v1Routes } from "../../routes/v1";

// ---------------------------------------------------------------------------
// Mock KV
// ---------------------------------------------------------------------------

function createMockKV(initialValues: Record<string, string> = {}): {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
} {
  const store = new Map(Object.entries(initialValues));
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
}

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => mockLogger,
} as unknown;

function setupMiddleware(c: { set: (key: string, value: unknown) => void }) {
  c.set("db", {} as unknown);
  c.set("requestId", "test-req-id");
  c.set("logger", mockLogger);
}

// ============================================================================
// 1. API Token Auth Middleware Tests
// ============================================================================

describe("apiTokenAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set defaults so tests that don't care about DB lookups still pass
    mockCrawlGetLatest.mockResolvedValue(null);
    mockScoreListByJob.mockResolvedValue([]);
    mockScoreListByJobWithPages.mockResolvedValue([]);
    mockScoreGetIssuesByJob.mockResolvedValue([]);
    mockVisListByProject.mockResolvedValue([]);
    mockVisGetTrends.mockResolvedValue([]);
  });

  function createTokenAuthApp(kvOverrides: Record<string, string> = {}) {
    const app = new Hono<AppEnv>();
    const kv = createMockKV(kvOverrides);

    app.use("*", async (c, next) => {
      setupMiddleware(c);
      (c.env as Record<string, unknown>) = { KV: kv, DATABASE_URL: "test" };
      await next();
    });

    app.use("*", apiTokenAuth);
    app.get("/test", (c) => {
      const tokenCtx = c.get("tokenCtx") as TokenContext;
      return c.json({ ok: true, tokenCtx });
    });

    return { app, kv };
  }

  it("returns 401 when Authorization header is missing", async () => {
    const { app } = createTokenAuthApp();
    const res = await app.fetch(new Request("http://localhost/test"));

    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Missing");
  });

  it("returns 401 when Authorization header has wrong scheme", async () => {
    const { app } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Basic abc123" },
      }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token does not start with llmb_", async () => {
    const { app } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer sk_invalid_token" },
      }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Invalid API token format");
  });

  it("returns 401 when service.authenticate returns null (invalid/expired token)", async () => {
    mockAuthenticate.mockResolvedValue(null);

    const { app } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_invalid_token_abc123" },
      }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Invalid or expired");
  });

  it("sets tokenCtx and calls next for valid token", async () => {
    const tokenCtx: TokenContext = {
      tokenId: "token-1",
      userId: "user-1",
      projectId: "proj-1",
      scopes: ["metrics:read", "scores:read"],
    };
    mockAuthenticate.mockResolvedValue(tokenCtx);
    mockUserGetById.mockResolvedValue({ id: "user-1", plan: "pro" });

    const { app } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_valid_token_xyz" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tokenCtx: TokenContext };
    expect(body.ok).toBe(true);
    expect(body.tokenCtx).toEqual(tokenCtx);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const tokenCtx: TokenContext = {
      tokenId: "token-rl",
      userId: "user-1",
      projectId: "proj-1",
      scopes: ["metrics:read"],
    };
    mockAuthenticate.mockResolvedValue(tokenCtx);
    mockUserGetById.mockResolvedValue({ id: "user-1", plan: "pro" });

    const { app } = createTokenAuthApp({ "ratelimit:token:token-rl": "500" });
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_ratelimited_token" },
      }),
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("increments rate limit counter in KV on valid request", async () => {
    const tokenCtx: TokenContext = {
      tokenId: "token-incr",
      userId: "user-1",
      projectId: "proj-1",
      scopes: ["metrics:read"],
    };
    mockAuthenticate.mockResolvedValue(tokenCtx);
    mockUserGetById.mockResolvedValue({ id: "user-1", plan: "pro" });

    const { app, kv } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_counter_token" },
      }),
    );

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith("ratelimit:token:token-incr", "1", {
      expirationTtl: 60,
    });
  });

  it("returns 401 when token owner is not found in DB", async () => {
    const tokenCtx: TokenContext = {
      tokenId: "token-ghost",
      userId: "ghost-user",
      projectId: "proj-1",
      scopes: ["metrics:read"],
    };
    mockAuthenticate.mockResolvedValue(tokenCtx);
    mockUserGetById.mockResolvedValue(null);

    const { app } = createTokenAuthApp();
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_ghost_user_token" },
      }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Token owner not found");
  });

  it("adds X-RateLimit headers to response", async () => {
    const tokenCtx: TokenContext = {
      tokenId: "token-hdr",
      userId: "user-1",
      projectId: "proj-1",
      scopes: ["metrics:read"],
    };
    mockAuthenticate.mockResolvedValue(tokenCtx);
    mockUserGetById.mockResolvedValue({ id: "user-1", plan: "agency" });

    const { app } = createTokenAuthApp({ "ratelimit:token:token-hdr": "10" });
    const res = await app.fetch(
      new Request("http://localhost/test", {
        headers: { Authorization: "Bearer llmb_header_token" },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("2000");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("1989");
  });
});

// ============================================================================
// 2. CRUD Routes Tests
// ============================================================================

describe("tokenRoutes (CRUD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createCrudApp() {
    const app = new Hono<AppEnv>();

    app.use("*", async (c, next) => {
      setupMiddleware(c);
      (c.env as Record<string, unknown>) = {
        KV: createMockKV(),
        DATABASE_URL: "test",
        BETTER_AUTH_SECRET: "test-secret",
      };
      await next();
    });

    app.route("/api/tokens", tokenRoutes);
    return app;
  }

  describe("POST /api/tokens", () => {
    it("creates a token and returns 201 with plaintext", async () => {
      mockUserGetById.mockResolvedValue({ id: "user-1", plan: "pro" });

      mockCreate.mockResolvedValue({
        plainToken: "llmb_plaintext_abc123",
        token: {
          id: "token-new",
          userId: "user-1",
          projectId: "proj-1",
          name: "CI Token",
          tokenPrefix: "llmb_plai",
          scopes: ["metrics:read"],
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2024-01-01"),
        },
      });

      const app = createCrudApp();
      const res = await app.fetch(
        new Request("http://localhost/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "proj-1",
            name: "CI Token",
            scopes: ["metrics:read"],
          }),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { plaintext: string; id: string; name: string };
      };
      expect(body.data.plaintext).toBe("llmb_plaintext_abc123");
      expect(body.data.id).toBe("token-new");
      expect(body.data.name).toBe("CI Token");
    });

    it("returns 422 when required fields are missing", async () => {
      const app = createCrudApp();
      const res = await app.fetch(
        new Request("http://localhost/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Token" }),
        }),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 for invalid scopes", async () => {
      mockUserGetById.mockResolvedValue({ id: "user-1", plan: "pro" });

      const app = createCrudApp();
      const res = await app.fetch(
        new Request("http://localhost/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: "proj-1",
            name: "Token",
            scopes: ["metrics:read", "admin:write"],
          }),
        }),
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("admin:write");
    });
  });

  describe("GET /api/tokens", () => {
    it("lists user tokens", async () => {
      const tokens = [
        {
          id: "t1",
          name: "Token 1",
          tokenPrefix: "llmb_abc",
          scopes: ["metrics:read"],
          projectId: "proj-1",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2024-01-01"),
        },
      ];
      mockList.mockResolvedValue(tokens);

      const app = createCrudApp();
      const res = await app.fetch(new Request("http://localhost/api/tokens"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("t1");
    });
  });

  describe("DELETE /api/tokens/:id", () => {
    it("revokes a token and returns it", async () => {
      mockRevoke.mockResolvedValue({
        id: "token-1",
        revokedAt: new Date("2024-01-02"),
      });

      const app = createCrudApp();
      const res = await app.fetch(
        new Request("http://localhost/api/tokens/token-1", {
          method: "DELETE",
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { id: string; revokedAt: string };
      };
      expect(body.data.id).toBe("token-1");
      expect(body.data.revokedAt).toBeDefined();
    });
  });
});

// ============================================================================
// 3. v1 Read-Only Routes Tests
// ============================================================================

describe("v1Routes (token-authenticated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults
    mockCrawlGetLatest.mockResolvedValue(null);
    mockScoreListByJob.mockResolvedValue([]);
    mockScoreListByJobWithPages.mockResolvedValue([]);
    mockScoreGetIssuesByJob.mockResolvedValue([]);
    mockVisListByProject.mockResolvedValue([]);
    mockVisGetTrends.mockResolvedValue([]);
  });

  function createV1App(tokenCtx: TokenContext | null = null) {
    const app = new Hono<AppEnv>();
    const kv = createMockKV();

    app.use("*", async (c, next) => {
      setupMiddleware(c);
      (c.env as Record<string, unknown>) = { KV: kv, DATABASE_URL: "test" };
      await next();
    });

    if (tokenCtx) {
      mockAuthenticate.mockResolvedValue(tokenCtx);
      mockUserGetById.mockResolvedValue({ id: tokenCtx.userId, plan: "pro" });
    } else {
      mockAuthenticate.mockResolvedValue(null);
    }

    app.route("/api/v1", v1Routes);
    return app;
  }

  describe("GET /api/v1/projects/:id/metrics", () => {
    it("returns 401 for unauthenticated request", async () => {
      const app = createV1App(null);
      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/metrics"),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 when token projectId does not match", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-other",
        scopes: ["metrics:read"],
      });

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/metrics", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("not authorized for this project");
    });

    it("returns 403 when scope is missing", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["scores:read"],
      });

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/metrics", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("metrics:read");
    });

    it("returns metrics for valid request", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read"],
      });

      mockCrawlGetLatest.mockResolvedValue({
        id: "crawl-1",
        status: "complete",
        completedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
      });
      mockScoreListByJob.mockResolvedValue([
        {
          overallScore: 85,
          technicalScore: 80,
          contentScore: 90,
          aiReadinessScore: 75,
        },
        {
          overallScore: 95,
          technicalScore: 90,
          contentScore: 88,
          aiReadinessScore: 85,
        },
      ]);

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/metrics", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          projectId: string;
          crawlId: string;
          totalPages: number;
          averageScores: Record<string, number>;
        };
      };
      expect(body.data.projectId).toBe("proj-1");
      expect(body.data.crawlId).toBe("crawl-1");
      expect(body.data.totalPages).toBe(2);
      expect(body.data.averageScores.overall).toBe(90);
      expect(body.data.averageScores.technical).toBe(85);
    });

    it("returns empty data when no crawl exists", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read"],
      });

      mockCrawlGetLatest.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/metrics", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { crawlId: null; scores: unknown[] };
      };
      expect(body.data.crawlId).toBeNull();
      expect(body.data.scores).toEqual([]);
    });
  });

  describe("GET /api/v1/projects/:id/pages", () => {
    it("returns 403 when scores:read scope is missing", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read"],
      });

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/pages", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(403);
    });

    it("returns paginated pages for valid request", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["scores:read"],
      });

      mockCrawlGetLatest.mockResolvedValue({
        id: "crawl-1",
        status: "complete",
      });
      mockScoreListByJobWithPages.mockResolvedValue([
        {
          pageId: "page-1",
          overallScore: 85,
          technicalScore: 80,
          contentScore: 90,
          aiReadinessScore: 75,
          issueCount: 3,
          page: { url: "https://example.com/1", title: "Page 1" },
        },
        {
          pageId: "page-2",
          overallScore: 70,
          technicalScore: 65,
          contentScore: 75,
          aiReadinessScore: 60,
          issueCount: 5,
          page: { url: "https://example.com/2", title: "Page 2" },
        },
      ]);

      const res = await app.fetch(
        new Request(
          "http://localhost/api/v1/projects/proj-1/pages?limit=1&offset=0",
          { headers: { Authorization: "Bearer llmb_test_token_123" } },
        ),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          pages: Array<{ url: string }>;
          total: number;
          limit: number;
          offset: number;
        };
      };
      expect(body.data.pages).toHaveLength(1);
      expect(body.data.total).toBe(2);
      expect(body.data.limit).toBe(1);
      expect(body.data.offset).toBe(0);
      expect(body.data.pages[0].url).toBe("https://example.com/1");
    });
  });

  describe("GET /api/v1/projects/:id/issues", () => {
    it("returns issues grouped by severity", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["scores:read"],
      });

      mockCrawlGetLatest.mockResolvedValue({
        id: "crawl-1",
        status: "complete",
      });
      mockScoreGetIssuesByJob.mockResolvedValue([
        {
          id: "iss-1",
          pageId: "page-1",
          category: "technical",
          severity: "critical",
          code: "MISSING_TITLE",
          message: "Title is missing",
          recommendation: "Add a title",
        },
        {
          id: "iss-2",
          pageId: "page-1",
          category: "content",
          severity: "warning",
          code: "SHORT_CONTENT",
          message: "Content is too short",
          recommendation: "Add more content",
        },
        {
          id: "iss-3",
          pageId: "page-2",
          category: "ai_readiness",
          severity: "info",
          code: "MISSING_LLMS_TXT",
          message: "No llms.txt found",
          recommendation: "Add llms.txt",
        },
      ]);

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/issues", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          issues: unknown[];
          summary: { critical: number; warning: number; info: number };
        };
      };
      expect(body.data.issues).toHaveLength(3);
      expect(body.data.summary).toEqual({ critical: 1, warning: 1, info: 1 });
    });
  });

  describe("GET /api/v1/projects/:id/visibility", () => {
    it("returns 403 when visibility:read scope is missing", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["metrics:read"],
      });

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/visibility", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(403);
    });

    it("returns visibility data for valid request", async () => {
      const app = createV1App({
        tokenId: "token-1",
        userId: "user-1",
        projectId: "proj-1",
        scopes: ["visibility:read"],
      });

      mockVisListByProject.mockResolvedValue([
        {
          id: "vis-1",
          llmProvider: "chatgpt",
          query: "best seo tool",
          brandMentioned: true,
          urlCited: true,
          citationPosition: 2,
          checkedAt: new Date("2024-01-01"),
        },
      ]);
      mockVisGetTrends.mockResolvedValue([
        {
          weekStart: "2024-01-01",
          provider: "chatgpt",
          mentionRate: 0.8,
          citationRate: 0.5,
          totalChecks: 10,
        },
      ]);

      const res = await app.fetch(
        new Request("http://localhost/api/v1/projects/proj-1/visibility", {
          headers: { Authorization: "Bearer llmb_test_token_123" },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          checks: Array<{ provider: string }>;
          trends: Array<{ mentionRate: number }>;
        };
      };
      expect(body.data.checks).toHaveLength(1);
      expect(body.data.checks[0].provider).toBe("chatgpt");
      expect(body.data.trends).toHaveLength(1);
      expect(body.data.trends[0].mentionRate).toBe(0.8);
    });
  });
});
