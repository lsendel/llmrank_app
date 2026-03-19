import { describe, it, expect, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";

// Mock fetch to avoid real network calls from the auth-check and debug-token routes
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock repositories — provide all 5 factories required by createContainer()
// ---------------------------------------------------------------------------

vi.mock("@llm-boost/repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

describe("Health Routes", () => {
  const { request } = createTestApp();

  // -----------------------------------------------------------------------
  // GET /api/health
  // -----------------------------------------------------------------------

  it("GET /api/health returns 200 with status ok", async () => {
    const res = await request("/api/health");
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  // -----------------------------------------------------------------------
  // GET /api/health/auth-check
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // GET /api/health/auth-check
  // -----------------------------------------------------------------------

  describe("GET /api/health/auth-check", () => {
    it("returns 200 with Better Auth status and DB status", async () => {
      // Mock successful DB check
      const { request } = createTestApp(); // uses mocked DB from test-app helper which is mocked in global Setup or works with minimal setup

      const res = await request("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body).toHaveProperty("authProvider", "better-auth");
      expect(body).toHaveProperty("authSecretConfigured", true); // Default mock has secret
      expect(body).toHaveProperty("authStatus");
      expect(body).toHaveProperty("dbStatus");
    });

    it("reports authSecretConfigured as false when secret missing", async () => {
      const { request: reqNoKey } = createTestApp({
        envOverrides: { BETTER_AUTH_SECRET: "" },
      });
      const res = await reqNoKey("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.authSecretConfigured).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/health/deep
  // -----------------------------------------------------------------------

  describe("GET /api/health/deep", () => {
    it("returns comprehensive health status with all checks", async () => {
      // Mock successful crawler health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const res = await request("/api/health/deep");
      // Accept 200 or 503 depending on test environment
      expect([200, 503]).toContain(res.status);

      const body: any = await res.json();
      expect(body).toHaveProperty("status");
      expect(["healthy", "degraded", "down"]).toContain(body.status);
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("total_latency_ms");
      expect(body).toHaveProperty("checks");

      // Verify all expected checks are present
      expect(body.checks).toHaveProperty("database");
      expect(body.checks).toHaveProperty("r2_storage");
      expect(body.checks).toHaveProperty("kv_cache");
      expect(body.checks).toHaveProperty("crawler_service");
      expect(body.checks).toHaveProperty("anthropic_llm");
      expect(body.checks).toHaveProperty("openai_llm");

      // Each check should have status and latency
      Object.values(body.checks).forEach((check: any) => {
        expect(check).toHaveProperty("status");
        expect(["healthy", "degraded", "down"]).toContain(check.status);
        expect(check).toHaveProperty("latency");
      });
    });

    it("returns degraded status when crawler is down", async () => {
      // Mock failed crawler health check
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const res = await request("/api/health/deep");
      expect([200, 503]).toContain(res.status);

      const body: any = await res.json();
      expect(body.checks.crawler_service.status).toBe("down");
      expect(body.checks.crawler_service).toHaveProperty("error");
    });

    it("returns degraded when LLM keys not configured", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const { request: reqNoKeys } = createTestApp({
        envOverrides: {
          ANTHROPIC_API_KEY: "",
          OPENAI_API_KEY: "",
        },
      });

      const res = await reqNoKeys("/api/health/deep");
      expect([200, 503]).toContain(res.status);

      const body: any = await res.json();
      expect(body.checks.anthropic_llm.status).toBe("degraded");
      expect(body.checks.openai_llm.status).toBe("degraded");
    });
  });

  // -----------------------------------------------------------------------
  // 404 on unknown route
  // -----------------------------------------------------------------------

  it("returns 404 with error envelope for unknown routes", async () => {
    const res = await request("/api/nonexistent-route");
    expect(res.status).toBe(404);

    const body: any = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Route not found");
  });

  it("returns 404 for POST to non-existent path", async () => {
    const res = await request("/api/does-not-exist", {
      method: "POST",
      json: { foo: "bar" },
    });
    expect(res.status).toBe(404);

    const body: any = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
