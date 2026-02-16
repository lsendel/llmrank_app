import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { authMiddleware } from "../../middleware/auth";

// Mock createAuth
const mockGetSession = vi.fn();
const mockAuth = {
  api: {
    getSession: mockGetSession,
  },
};

vi.mock("../../lib/auth", () => ({
  createAuth: vi.fn(() => mockAuth),
}));

function createTestApp() {
  const app = new Hono<AppEnv>();

  // Pre-set variables that auth middleware expects
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    c.set("requestId", "ctx-id");
    c.set("logger", {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      }),
    } as any);
    await next();
  });

  app.use("*", authMiddleware);
  app.get("/test", (c) => c.json({ ok: true, userId: c.get("userId") }));
  return app;
}

const env: Record<string, string> = {
  BETTER_AUTH_SECRET: "test-secret",
};

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session retrieval fails", async () => {
    mockGetSession.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.fetch(
      new Request("http://localhost/test"),
      env as any,
    );

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("sets userId and calls next when session is valid", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user_123" },
      session: { id: "sess_123" },
    });

    const app = createTestApp();
    const res = await app.fetch(
      new Request("http://localhost/test"),
      env as any,
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("user_123");
  });

  it("passes headers to getSession", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createTestApp();
    await app.fetch(
      new Request("http://localhost/test", {
        headers: { "x-custom": "foo" },
      }),
      env as any,
    );

    expect(mockGetSession).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    // Verify the header is actually explicitly set in the request mock to be sure
    const callArgs = mockGetSession.mock.calls[0][0];
    expect(callArgs.headers.get("x-custom")).toBe("foo");
  });
});
