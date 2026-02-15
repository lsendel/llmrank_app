import { describe, it, expect, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";

// Mock fetch to avoid real network calls from the auth-check and debug-token routes
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

  describe("GET /api/health/auth-check", () => {
    it("returns 200 with JWKS status and DB status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ keys: [{ kid: "key-1" }] }),
      });

      const res = await request("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body).toHaveProperty("clerkSecretKeyPrefix");
      expect(body).toHaveProperty("jwksStatus");
      expect(body).toHaveProperty("jwksKeyCount");
      expect(body).toHaveProperty("dbStatus");
    });

    it("handles JWKS fetch failure gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const res = await request("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.jwksStatus).toContain("error:");
    });

    it("handles non-ok JWKS response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const res = await request("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.jwksStatus).toContain("401");
      expect(body.jwksKeyCount).toBe(0);
    });

    it("shows NOT SET when CLERK_SECRET_KEY is empty", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ keys: [] }),
      });

      const { request: reqNoKey } = createTestApp({
        envOverrides: { CLERK_SECRET_KEY: "" },
      });
      const res = await reqNoKey("/api/health/auth-check");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.clerkSecretKeyPrefix).toBe("NOT SET");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/health/debug-token
  // -----------------------------------------------------------------------

  describe("POST /api/health/debug-token", () => {
    it("returns 400 when no Bearer token provided", async () => {
      const res = await request("/api/health/debug-token", {
        method: "POST",
        headers: { Authorization: "" },
        json: {},
      });
      expect(res.status).toBe(400);

      const body: any = await res.json();
      expect(body.error).toContain("No Bearer token");
    });

    it("returns 400 when JWT has wrong number of parts", async () => {
      const res = await request("/api/health/debug-token", {
        method: "POST",
        headers: { Authorization: "Bearer not.a-jwt" },
        json: {},
      });
      expect(res.status).toBe(400);

      const body: any = await res.json();
      expect(body.error).toContain("Invalid JWT format");
    });

    it("returns 400 when JWT parts are not valid base64", async () => {
      const res = await request("/api/health/debug-token", {
        method: "POST",
        headers: { Authorization: "Bearer !!!.@@@.###" },
        json: {},
      });
      expect(res.status).toBe(400);

      const body: any = await res.json();
      expect(body.error).toContain("Failed to decode");
    });

    it("returns decoded JWT info for a valid token format", async () => {
      // Create a minimal JWT structure (not cryptographically valid, just well-formed)
      const header = btoa(
        JSON.stringify({ alg: "RS256", kid: "test-kid", typ: "JWT" }),
      );
      const payload = btoa(
        JSON.stringify({
          sub: "user_123",
          iss: "https://test.clerk.accounts.dev",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        }),
      );
      const signature = btoa("fake-signature");
      const token = `${header}.${payload}.${signature}`;

      // Mock the JWKS fetch for verification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ keys: [{ kid: "other-kid", kty: "RSA" }] }),
      });

      const res = await request("/api/health/debug-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body).toHaveProperty("header");
      expect(body).toHaveProperty("payload");
      expect(body.payload).toHaveProperty("sub", "user_123");
      expect(body).toHaveProperty("timeCheck");
      expect(body.timeCheck).toHaveProperty("expOk");
      expect(body).toHaveProperty("verifyResult");
    });

    it("handles JWKS fetch failure during verification", async () => {
      const header = btoa(JSON.stringify({ alg: "RS256", kid: "key-1" }));
      const payload = btoa(JSON.stringify({ sub: "u1" }));
      const sig = btoa("sig");
      const token = `${header}.${payload}.${sig}`;

      mockFetch.mockRejectedValueOnce(new Error("JWKS down"));

      const res = await request("/api/health/debug-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        json: {},
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.verifyResult).toContain("Error:");
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
