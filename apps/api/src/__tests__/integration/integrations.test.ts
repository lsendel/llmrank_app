import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject, buildUser } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock @llm-boost/db queries used by integrations route
// ---------------------------------------------------------------------------

const mockProjectGetById = vi.fn().mockResolvedValue(null);
const mockUserGetById = vi.fn().mockResolvedValue(null);
const mockIntegrationListByProject = vi.fn().mockResolvedValue([]);
const mockIntegrationUpsert = vi.fn().mockResolvedValue({
  id: "int-1",
  provider: "psi",
  enabled: true,
  createdAt: new Date("2024-01-01"),
});
const mockIntegrationUpdateEnabled = vi.fn().mockResolvedValue(null);
const mockIntegrationRemove = vi.fn().mockResolvedValue(undefined);
const mockCrawlGetLatestByProject = vi.fn().mockResolvedValue(null);
const mockCrawlGetById = vi.fn().mockResolvedValue(null);
const mockEnrichmentListByJob = vi.fn().mockResolvedValue([]);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    projectQueries: () => ({
      getById: mockProjectGetById,
    }),
    userQueries: () => ({
      getById: mockUserGetById,
      getByClerkId: vi.fn().mockResolvedValue(null),
      upsertFromClerk: vi.fn().mockResolvedValue(buildUser()),
    }),
    integrationQueries: () => ({
      listByProject: mockIntegrationListByProject,
      upsert: mockIntegrationUpsert,
      updateEnabled: mockIntegrationUpdateEnabled,
      remove: mockIntegrationRemove,
    }),
    crawlQueries: () => ({
      getLatestByProject: mockCrawlGetLatestByProject,
      getById: mockCrawlGetById,
    }),
    enrichmentQueries: () => ({
      listByJob: mockEnrichmentListByJob,
      listByPage: vi.fn().mockResolvedValue([]),
    }),
    createDb: orig.createDb,
  };
});

// ---------------------------------------------------------------------------
// Mock crypto (encrypt/decrypt) used by the integration route
// ---------------------------------------------------------------------------

vi.mock("../../lib/crypto", () => ({
  encrypt: vi.fn().mockResolvedValue("encrypted-data"),
  decrypt: vi
    .fn()
    .mockResolvedValue(JSON.stringify({ apiKey: "test-key-123" })),
}));

// ---------------------------------------------------------------------------
// Mock google-oauth used by the integration route
// ---------------------------------------------------------------------------

vi.mock("../../lib/google-oauth", () => ({
  buildGoogleAuthUrl: vi
    .fn()
    .mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=true"),
  exchangeCodeForTokens: vi.fn().mockResolvedValue({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresIn: 3600,
    scope: "read",
  }),
  GOOGLE_SCOPES: {
    gsc: "https://www.googleapis.com/auth/webmasters.readonly",
    ga4: "https://www.googleapis.com/auth/analytics.readonly",
  },
}));

// ---------------------------------------------------------------------------
// Mock repositories — provide all 5 factories required by createContainer()
// ---------------------------------------------------------------------------

vi.mock("../../repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration Routes", () => {
  const { request } = createTestApp();
  const project = buildProject({ id: "proj-1", userId: "test-user-id" });
  const user = buildUser({ id: "test-user-id", plan: "agency" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectGetById.mockResolvedValue(project);
    mockUserGetById.mockResolvedValue(user);
    mockCrawlGetLatestByProject.mockResolvedValue(null);
    mockCrawlGetById.mockResolvedValue(null);
    mockEnrichmentListByJob.mockResolvedValue([]);
  });

  // -----------------------------------------------------------------------
  // GET /api/integrations/:projectId
  // -----------------------------------------------------------------------

  describe("GET /api/integrations/:projectId", () => {
    it("returns 200 with list of integrations (credentials stripped)", async () => {
      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-1",
          projectId: "proj-1",
          provider: "psi",
          enabled: true,
          encryptedCredentials: "encrypted-data",
          config: {},
          tokenExpiresAt: null,
          lastSyncAt: null,
          lastError: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ]);

      const res = await request("/api/integrations/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(1);
      expect(body.data[0]).toHaveProperty("hasCredentials", true);
      // Ensure encrypted credentials are NOT exposed
      expect(body.data[0]).not.toHaveProperty("encryptedCredentials");
    });

    it("returns 200 with empty array when no integrations", async () => {
      mockIntegrationListByProject.mockResolvedValue([]);

      const res = await request("/api/integrations/proj-1");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/nonexistent");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when project belongs to different user", async () => {
      mockProjectGetById.mockResolvedValue(
        buildProject({ id: "proj-1", userId: "other-user" }),
      );

      const res = await request("/api/integrations/proj-1");
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/integrations/:projectId/insights
  // -----------------------------------------------------------------------

  describe("GET /api/integrations/:projectId/insights", () => {
    it("returns aggregated insights for the latest crawl", async () => {
      mockCrawlGetLatestByProject.mockResolvedValue({
        id: "crawl-1",
        projectId: "proj-1",
      });
      mockEnrichmentListByJob.mockResolvedValue([
        {
          id: "enr-1",
          jobId: "crawl-1",
          pageId: "page-1",
          provider: "gsc",
          data: { query: "ai seo", impressions: 42, clicks: 4, position: 3 },
          createdAt: new Date("2024-01-01"),
        },
      ]);

      const res = await request("/api/integrations/proj-1/insights");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.crawlId).toBe("crawl-1");
      expect(body.data.integrations.gsc.topQueries[0].query).toBe("ai seo");
    });

    it("returns null integrations when no enrichments exist", async () => {
      mockCrawlGetLatestByProject.mockResolvedValue({
        id: "crawl-1",
        projectId: "proj-1",
      });
      mockEnrichmentListByJob.mockResolvedValue([]);

      const res = await request("/api/integrations/proj-1/insights");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.integrations).toBeNull();
    });

    it("supports selecting a crawl via query parameter", async () => {
      mockCrawlGetById.mockResolvedValue({
        id: "crawl-9",
        projectId: "proj-1",
      });
      const res = await request(
        "/api/integrations/proj-1/insights?crawlId=crawl-9",
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.crawlId).toBe("crawl-9");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/integrations/:projectId/connect
  // -----------------------------------------------------------------------

  describe("POST /api/integrations/:projectId/connect", () => {
    it("returns 201 when connecting PSI integration with valid API key", async () => {
      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { provider: "psi", apiKey: "my-api-key" },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("provider", "psi");
      expect(body.data).toHaveProperty("hasCredentials", true);
    });

    it("returns 201 when connecting Clarity with projectId", async () => {
      mockIntegrationUpsert.mockResolvedValue({
        id: "int-2",
        provider: "clarity",
        enabled: true,
        createdAt: new Date("2024-01-01"),
      });

      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: {
          provider: "clarity",
          apiKey: "clarity-key",
          clarityProjectId: "clarity-proj-123",
        },
      });
      expect(res.status).toBe(201);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("provider", "clarity");
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/nonexistent/connect", {
        method: "POST",
        json: { provider: "psi", apiKey: "key" },
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when user not found", async () => {
      mockUserGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { provider: "psi", apiKey: "key" },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.message).toContain("User not found");
    });

    it("returns 422 when validation fails (missing provider)", async () => {
      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { apiKey: "key" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when provider uses OAuth2 (gsc)", async () => {
      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { provider: "gsc", apiKey: "key" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("OAuth");
    });

    it("returns 422 when apiKey is missing for API-key integration", async () => {
      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { provider: "psi" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("apiKey");
    });

    it("returns 403 when plan does not support integration", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/integrations/proj-1/connect", {
        method: "POST",
        json: { provider: "psi", apiKey: "key" },
      });
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/integrations/:projectId/:id
  // -----------------------------------------------------------------------

  describe("PUT /api/integrations/:projectId/:id", () => {
    it("returns 200 when toggling integration enabled", async () => {
      mockIntegrationUpdateEnabled.mockResolvedValue({
        id: "int-1",
        provider: "psi",
        enabled: false,
      });

      const res = await request("/api/integrations/proj-1/int-1", {
        method: "PUT",
        json: { enabled: false },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("enabled", false);
    });

    it("returns 404 when integration not found during enable toggle", async () => {
      mockIntegrationUpdateEnabled.mockResolvedValue(null);

      const res = await request("/api/integrations/proj-1/int-1", {
        method: "PUT",
        json: { enabled: true },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("Integration not found");
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/nonexistent/int-1", {
        method: "PUT",
        json: { enabled: true },
      });
      expect(res.status).toBe(404);
    });

    it("returns 422 when validation fails", async () => {
      const res = await request("/api/integrations/proj-1/int-1", {
        method: "PUT",
        json: { enabled: "not-a-boolean" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 with id when enabled is undefined (no-op)", async () => {
      const res = await request("/api/integrations/proj-1/int-1", {
        method: "PUT",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "int-1");
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/integrations/:projectId/:id
  // -----------------------------------------------------------------------

  describe("DELETE /api/integrations/:projectId/:id", () => {
    it("returns 200 with deletion confirmation", async () => {
      const res = await request("/api/integrations/proj-1/int-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toEqual({ deleted: true });
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/nonexistent/int-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/integrations/:projectId/oauth/google/start
  // -----------------------------------------------------------------------

  describe("POST /api/integrations/:projectId/oauth/google/start", () => {
    it("returns 200 with Google auth URL for GSC", async () => {
      const res = await request("/api/integrations/proj-1/oauth/google/start", {
        method: "POST",
        json: { provider: "gsc" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
      expect(body.data.url).toContain("google.com");
    });

    it("returns 200 with Google auth URL for GA4", async () => {
      const res = await request("/api/integrations/proj-1/oauth/google/start", {
        method: "POST",
        json: { provider: "ga4" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
    });

    it("returns 422 when provider is invalid", async () => {
      const res = await request("/api/integrations/proj-1/oauth/google/start", {
        method: "POST",
        json: { provider: "psi" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("gsc or ga4");
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request(
        "/api/integrations/nonexistent/oauth/google/start",
        {
          method: "POST",
          json: { provider: "gsc" },
        },
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when user not found", async () => {
      mockUserGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/proj-1/oauth/google/start", {
        method: "POST",
        json: { provider: "gsc" },
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.message).toContain("User not found");
    });

    it("returns 403 when plan does not support OAuth integration", async () => {
      mockUserGetById.mockResolvedValue(
        buildUser({ id: "test-user-id", plan: "free" }),
      );

      const res = await request("/api/integrations/proj-1/oauth/google/start", {
        method: "POST",
        json: { provider: "gsc" },
      });
      expect(res.status).toBe(403);

      const body: any = await res.json();
      expect(body.error.code).toBe("PLAN_LIMIT_REACHED");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/integrations/oauth/google/callback
  // -----------------------------------------------------------------------

  describe("POST /api/integrations/oauth/google/callback", () => {
    it("returns 200 when code exchange succeeds", async () => {
      const state = btoa(
        JSON.stringify({
          projectId: "proj-1",
          provider: "gsc",
          userId: "test-user-id",
        }),
      );

      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: {
          code: "auth-code-123",
          state,
          redirectUri: "http://localhost/callback",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("hasCredentials", true);
    });

    it("returns 422 when code is missing", async () => {
      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: { state: "abc", redirectUri: "http://localhost" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("code");
    });

    it("returns 422 when state is missing", async () => {
      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: { code: "abc", redirectUri: "http://localhost" },
      });
      expect(res.status).toBe(422);
    });

    it("returns 422 when redirectUri is missing", async () => {
      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: { code: "abc", state: "abc" },
      });
      expect(res.status).toBe(422);
    });

    it("returns 422 when state is invalid base64/JSON", async () => {
      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: {
          code: "abc",
          state: "not-valid-base64!!!",
          redirectUri: "http://localhost",
        },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.message).toContain("Invalid state");
    });

    it("returns 401 when state userId does not match current user", async () => {
      const state = btoa(
        JSON.stringify({
          projectId: "proj-1",
          provider: "gsc",
          userId: "different-user",
        }),
      );

      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: {
          code: "abc",
          state,
          redirectUri: "http://localhost",
        },
      });
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toContain("State mismatch");
    });

    it("returns 404 when project in state does not exist", async () => {
      mockProjectGetById.mockResolvedValue(null);
      const state = btoa(
        JSON.stringify({
          projectId: "nonexistent",
          provider: "gsc",
          userId: "test-user-id",
        }),
      );

      const res = await request("/api/integrations/oauth/google/callback", {
        method: "POST",
        json: {
          code: "abc",
          state,
          redirectUri: "http://localhost",
        },
      });
      expect(res.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/integrations/:projectId/:id/test
  // -----------------------------------------------------------------------

  describe("POST /api/integrations/:projectId/:id/test", () => {
    it("returns 200 with test result for PSI integration", async () => {
      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-1",
          provider: "psi",
          encryptedCredentials: "encrypted-data",
        },
      ]);

      // Mock fetch for PSI test
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200 }) as any;

      const res = await request("/api/integrations/proj-1/int-1/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("ok", true);
      expect(body.data).toHaveProperty("message");
      expect(body.data.message).toContain("PSI");

      globalThis.fetch = originalFetch;
    });

    it("returns 404 when integration not found", async () => {
      mockIntegrationListByProject.mockResolvedValue([]);

      const res = await request("/api/integrations/proj-1/int-missing/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("not found");
    });

    it("returns 404 when integration has no credentials", async () => {
      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-1",
          provider: "psi",
          encryptedCredentials: null,
        },
      ]);

      const res = await request("/api/integrations/proj-1/int-1/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when project not found", async () => {
      mockProjectGetById.mockResolvedValue(null);

      const res = await request("/api/integrations/nonexistent/int-1/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(404);
    });

    it("returns ok:false when decrypt fails", async () => {
      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-1",
          provider: "psi",
          encryptedCredentials: "encrypted-data",
        },
      ]);

      const crypto = await import("../../lib/crypto");
      (crypto.decrypt as any).mockRejectedValueOnce(
        new Error("Decrypt failed"),
      );

      const res = await request("/api/integrations/proj-1/int-1/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("ok", false);
      expect(body.data.message).toContain("Decrypt failed");
    });

    it("returns test result for clarity integration", async () => {
      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-clarity",
          provider: "clarity",
          encryptedCredentials: "encrypted-data",
        },
      ]);

      const res = await request("/api/integrations/proj-1/int-clarity/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("ok", true);
      expect(body.data.message).toContain("Clarity");
    });

    it("returns test result for GSC (OAuth) integration", async () => {
      const crypto = await import("../../lib/crypto");
      (crypto.decrypt as any).mockResolvedValueOnce(
        JSON.stringify({ accessToken: "token", refreshToken: "refresh" }),
      );

      mockIntegrationListByProject.mockResolvedValue([
        {
          id: "int-gsc",
          provider: "gsc",
          encryptedCredentials: "encrypted-data",
        },
      ]);

      const res = await request("/api/integrations/proj-1/int-gsc/test", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("ok", true);
      expect(body.data.message).toContain("OAuth tokens present");
    });
  });
});
