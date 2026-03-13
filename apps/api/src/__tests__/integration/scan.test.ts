import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../../routes/public";

describe("Public Scan API", () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono();

    // Mock Env and Middleware setup similar to index.ts
    app.use("*", async (c, next) => {
      c.env = {
        KV: {
          get: vi.fn(),
          put: vi.fn(),
        },
        DATABASE_URL: "postgres://mock",
      };
      const noopLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      c.set("logger", noopLogger);
      c.set("db", {
        query: {
          scanResults: {
            findFirst: vi.fn(),
          },
        },
        insert: () => ({
          values: () => ({ returning: () => [{ id: "mock-scan-id" }] }),
        }),
      } as any);
      await next();
    });

    app.route("/api/public", publicRoutes);
  });

  it("should validate missing url", async () => {
    const res = await app.request("/api/public/scan", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as any;
    expect(json.error.message).toContain("url is required");
  });

  it("should perform scan for valid url", async () => {
    // Mock fetch to return success
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          "<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
        ),
    });

    const res = await app.request("/api/public/scan", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.domain).toBe("example.com");
    expect(json.data.scanResultId).toBe("mock-scan-id");
  });

  it("should handle fetch errors gracefully", async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    const res = await app.request("/api/public/scan", {
      method: "POST",
      body: JSON.stringify({ url: "https://fail.com" }),
    });

    expect(res.status).toBe(422);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe("FETCH_FAILED");
  });
});
