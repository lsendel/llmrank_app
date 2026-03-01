import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildUser } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock auth middleware to bypass JWT verification
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

// ---------------------------------------------------------------------------
// Mock @llm-boost/db userQueries (used directly by account routes)
// ---------------------------------------------------------------------------

const mockUserGetById = vi.fn().mockResolvedValue(null);
const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("@llm-boost/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@llm-boost/db")>();
  return {
    ...orig,
    userQueries: () => ({
      getById: mockUserGetById,
      updateProfile: mockUpdateProfile,
      getByClerkId: vi.fn().mockResolvedValue(null),
      upsertFromClerk: vi.fn().mockResolvedValue(buildUser()),
    }),
    createDb: orig.createDb,
  };
});

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

describe("Account Routes", () => {
  const { request, kv } = createTestApp();

  beforeEach(async () => {
    vi.clearAllMocks();
    const keys = await kv.list();
    for (const key of keys.keys) {
      await kv.delete(key.name);
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/account
  // -----------------------------------------------------------------------

  describe("GET /api/account", () => {
    it("returns 200 with user data when user exists", async () => {
      const user = buildUser({ id: "test-user-id", name: "Alice" });
      mockUserGetById.mockResolvedValue(user);

      const res = await request("/api/account");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("id", "test-user-id");
      expect(body.data).toHaveProperty("name", "Alice");
      expect(body.data).toHaveProperty("email");
    });

    it("returns 404 when user does not exist", async () => {
      mockUserGetById.mockResolvedValue(null);

      const res = await request("/api/account");
      expect(res.status).toBe(404);

      const body: any = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("User not found");
    });
  });

  // -----------------------------------------------------------------------
  // PUT /api/account
  // -----------------------------------------------------------------------

  describe("PUT /api/account", () => {
    it("returns 200 with updated user data when valid", async () => {
      const updated = buildUser({ id: "test-user-id", name: "Bob" });
      mockUpdateProfile.mockResolvedValue(updated);

      const res = await request("/api/account", {
        method: "PUT",
        json: { name: "Bob", phone: "+12025551234" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("name", "Bob");
    });

    it("returns 422 when phone is invalid format", async () => {
      const res = await request("/api/account", {
        method: "PUT",
        json: { name: "Bob", phone: "invalid" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 when phone is empty string", async () => {
      const res = await request("/api/account", {
        method: "PUT",
        json: { name: "Bob", phone: "" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 when updating name and phone together", async () => {
      const updated = buildUser({
        id: "test-user-id",
        name: "Alice",
        phone: "+12025551234",
      });
      mockUpdateProfile.mockResolvedValue(updated);

      const res = await request("/api/account", {
        method: "PUT",
        json: { name: "Alice", phone: "+12025551234" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("name", "Alice");
      expect(body.data).toHaveProperty("phone", "+12025551234");
    });

    it("returns 422 when name is empty string", async () => {
      const res = await request("/api/account", {
        method: "PUT",
        json: { name: "", phone: "+12025551234" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // -----------------------------------------------------------------------
  // Account preferences
  // -----------------------------------------------------------------------

  describe("GET/PUT /api/account/preferences", () => {
    it("returns null preset when no server preference is stored", async () => {
      const res = await request("/api/account/preferences");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toEqual({ projectsDefaultPreset: null });
    });

    it("persists and reads back projects default preset", async () => {
      const put = await request("/api/account/preferences", {
        method: "PUT",
        json: { projectsDefaultPreset: "content_lead" },
      });
      expect(put.status).toBe(200);

      const storedRaw = await kv.get("account:preferences:test-user-id");
      expect(storedRaw).toContain("content_lead");

      const get = await request("/api/account/preferences");
      expect(get.status).toBe(200);
      const body: any = await get.json();
      expect(body.data).toEqual({ projectsDefaultPreset: "content_lead" });
    });

    it("accepts null to clear projects default preset", async () => {
      await kv.put(
        "account:preferences:test-user-id",
        JSON.stringify({ projectsDefaultPreset: "seo_manager" }),
      );

      const put = await request("/api/account/preferences", {
        method: "PUT",
        json: { projectsDefaultPreset: null },
      });
      expect(put.status).toBe(200);

      const body: any = await put.json();
      expect(body.data).toEqual({ projectsDefaultPreset: null });
    });

    it("returns 422 for invalid preset value", async () => {
      const res = await request("/api/account/preferences", {
        method: "PUT",
        json: { projectsDefaultPreset: "invalid_preset" },
      });
      expect(res.status).toBe(422);

      const body: any = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
