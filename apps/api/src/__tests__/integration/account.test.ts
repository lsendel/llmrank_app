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
// Tests
// ---------------------------------------------------------------------------

describe("Account Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
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
});
