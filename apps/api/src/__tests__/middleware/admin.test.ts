import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../index";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factory runs
// ---------------------------------------------------------------------------

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock("@llm-boost/db", () => ({
  userQueries: vi.fn().mockReturnValue({
    getById: mockGetById,
  }),
}));

import { adminMiddleware } from "../../middleware/admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("userId", "user-1");
    await next();
  });

  app.use("*", adminMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adminMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows access when user is admin", async () => {
    mockGetById.mockResolvedValueOnce({ id: "user-1", isAdmin: true });
    const app = createTestApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("returns 403 when user is not admin", async () => {
    mockGetById.mockResolvedValueOnce({ id: "user-1", isAdmin: false });
    const app = createTestApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("Admin access required");
  });

  it("returns 403 when user is null", async () => {
    mockGetById.mockResolvedValueOnce(null);
    const app = createTestApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when isAdmin field is undefined", async () => {
    mockGetById.mockResolvedValueOnce({ id: "user-1" });
    const app = createTestApp();

    const res = await app.fetch(
      new Request("http://localhost/test"),
      {} as any,
    );
    expect(res.status).toBe(403);
  });
});
