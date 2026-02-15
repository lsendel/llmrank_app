import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../index";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factory runs
// ---------------------------------------------------------------------------

const { mockUserGetById, mockProjectListByUser } = vi.hoisted(() => ({
  mockUserGetById: vi.fn(),
  mockProjectListByUser: vi.fn(),
}));

vi.mock("@llm-boost/db", () => ({
  userQueries: vi.fn().mockReturnValue({
    getById: mockUserGetById,
  }),
  projectQueries: vi.fn().mockReturnValue({
    listByUser: mockProjectListByUser,
  }),
}));

import {
  enforceCrawlCredits,
  enforceProjectLimit,
} from "../../middleware/planLimits";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCrawlCreditsApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.use("*", enforceCrawlCredits);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

function createProjectLimitApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });
  app.use("*", enforceProjectLimit);
  app.post("/test", (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enforceCrawlCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when user has credits remaining", async () => {
    mockUserGetById.mockResolvedValueOnce({
      id: "user-1",
      plan: "pro",
      crawlCreditsRemaining: 5,
    });
    const app = createCrawlCreditsApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(200);
  });

  it("returns 429 when user has 0 credits", async () => {
    mockUserGetById.mockResolvedValueOnce({
      id: "user-1",
      plan: "pro",
      crawlCreditsRemaining: 0,
    });
    const app = createCrawlCreditsApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(429);
    const body: any = await res.json();
    expect(body.error.code).toBe("CRAWL_LIMIT_REACHED");
  });

  it("returns 404 when user is not found", async () => {
    mockUserGetById.mockResolvedValueOnce(null);
    const app = createCrawlCreditsApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("enforceProjectLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when user has room for more projects", async () => {
    mockUserGetById.mockResolvedValueOnce({
      id: "user-1",
      plan: "free",
    });
    mockProjectListByUser.mockResolvedValueOnce([]); // 0 projects, limit is 1

    const app = createProjectLimitApp();
    const res = await app.fetch(
      new Request("http://localhost/test", { method: "POST" }),
      {} as any,
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when user is at project limit", async () => {
    mockUserGetById.mockResolvedValueOnce({
      id: "user-1",
      plan: "free",
    });
    // Free plan allows 1 project, already have 1
    mockProjectListByUser.mockResolvedValueOnce([{ id: "proj-1" }]);

    const app = createProjectLimitApp();
    const res = await app.fetch(
      new Request("http://localhost/test", { method: "POST" }),
      {} as any,
    );
    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    expect(body.error.message).toContain("free");
  });

  it("returns 404 when user is not found", async () => {
    mockUserGetById.mockResolvedValueOnce(null);

    const app = createProjectLimitApp();
    const res = await app.fetch(
      new Request("http://localhost/test", { method: "POST" }),
      {} as any,
    );
    expect(res.status).toBe(404);
  });
});
