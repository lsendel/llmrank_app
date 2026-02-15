import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";

// ---------------------------------------------------------------------------
// Mock auth + HMAC middleware to bypass verification in unit tests
// ---------------------------------------------------------------------------

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../../middleware/hmac", () => ({
  hmacMiddleware: vi.fn().mockImplementation(async (_c: any, next: any) => {
    await next();
  }),
  signPayload: vi.fn().mockResolvedValue({
    signature: "hmac-sha256=test",
    timestamp: "1234567890",
  }),
}));

// ---------------------------------------------------------------------------
// Mock puppeteer (@cloudflare/puppeteer) used by browser routes
// ---------------------------------------------------------------------------

const { mockEvaluate, mockPage, mockBrowser } = vi.hoisted(() => {
  const mockEvaluate = vi.fn().mockResolvedValue({
    ttfb: 200,
    h1Count: 1,
    hasSchema: true,
    title: "Test Page",
    url: "https://example.com",
  });

  const mockPage = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: mockEvaluate,
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { mockEvaluate, mockPage, mockBrowser };
});

vi.mock("@cloudflare/puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Browser Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockResolvedValue({
      ttfb: 200,
      h1Count: 1,
      hasSchema: true,
      title: "Test Page",
      url: "https://example.com",
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/browser/audit
  // -----------------------------------------------------------------------

  describe("POST /api/browser/audit", () => {
    it("returns 400 when url is missing", async () => {
      const res = await request("/api/browser/audit", {
        method: "POST",
        json: {},
      });
      expect(res.status).toBe(400);

      const body: any = await res.json();
      expect(body.error).toBe("URL is required");
    });

    it("returns 200 with audit results for valid URL", async () => {
      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("performance");
      expect(body.data).toHaveProperty("seo");
      expect(body.data).toHaveProperty("accessibility");
      expect(body.data).toHaveProperty("best_practices");
      expect(body.data).toHaveProperty("lh_r2_key");
      expect(body.data.lh_r2_key).toBeNull();
    });

    it("returns perfect seo score when exactly one h1", async () => {
      mockEvaluate.mockResolvedValue({
        ttfb: 100,
        h1Count: 1,
        hasSchema: false,
        title: "Test",
        url: "https://example.com",
      });

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.seo).toBe(1.0);
    });

    it("returns lower seo score when h1 count is not 1", async () => {
      mockEvaluate.mockResolvedValue({
        ttfb: 100,
        h1Count: 0,
        hasSchema: true,
        title: "Test",
        url: "https://example.com",
      });

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.seo).toBe(0.5);
    });

    it("returns accessibility 0.9 when schema is present", async () => {
      mockEvaluate.mockResolvedValue({
        ttfb: 100,
        h1Count: 1,
        hasSchema: true,
        title: "Test",
        url: "https://example.com",
      });

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.accessibility).toBe(0.9);
    });

    it("returns accessibility 0.7 when schema is absent", async () => {
      mockEvaluate.mockResolvedValue({
        ttfb: 100,
        h1Count: 1,
        hasSchema: false,
        title: "Test",
        url: "https://example.com",
      });

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.accessibility).toBe(0.7);
    });

    it("returns 500 when browser launch fails", async () => {
      const puppeteer = await import("@cloudflare/puppeteer");
      (puppeteer.default.launch as any).mockRejectedValueOnce(
        new Error("Browser unavailable"),
      );

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      // When puppeteer.launch throws before try/catch, Hono returns 500
      expect(res.status).toBe(500);
    });

    it("returns 500 when page navigation fails", async () => {
      mockPage.goto.mockRejectedValueOnce(new Error("Navigation timeout"));

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(500);

      const body: any = await res.json();
      expect(body.error).toBe("Audit failed");
      expect(body.message).toContain("Navigation timeout");
    });

    it("clamps performance score between 0 and 1", async () => {
      // Very high TTFB → performance near 0
      mockEvaluate.mockResolvedValue({
        ttfb: 5000,
        h1Count: 1,
        hasSchema: true,
        title: "Slow Page",
        url: "https://example.com",
      });

      const res = await request("/api/browser/audit", {
        method: "POST",
        json: { url: "https://example.com" },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data.performance).toBeGreaterThanOrEqual(0);
      expect(body.data.performance).toBeLessThanOrEqual(1);
    });
  });
});
