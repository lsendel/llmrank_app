import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../../middleware/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockKV() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    put: vi.fn(
      async (key: string, value: string, opts?: { expirationTtl?: number }) => {
        store.set(key, { value, ttl: opts?.expirationTtl });
      },
    ),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

type MockKV = ReturnType<typeof createMockKV>;

interface TestEnv {
  Bindings: { KV: MockKV };
  Variables: { userId: string };
}

function buildApp(
  kv: MockKV,
  options: { limit: number; windowSeconds: number; keyPrefix: string },
) {
  const app = new Hono<TestEnv>();

  // Fake auth middleware — sets userId
  app.use("*", async (c, next) => {
    c.set("userId", "user-1");
    await next();
  });

  app.post("/test", rateLimit(options) as any, (c: any) =>
    c.json({ ok: true }),
  );
  return app;
}

function req(app: ReturnType<typeof buildApp>, kv: MockKV) {
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return app.fetch(request, { KV: kv } as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rateLimit middleware", () => {
  let kv: MockKV;

  beforeEach(() => {
    vi.clearAllMocks();
    kv = createMockKV();
  });

  it("allows requests within the limit", async () => {
    const app = buildApp(kv, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "rl:test",
    });
    const res = await req(app, kv);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  it("increments counter in KV", async () => {
    const app = buildApp(kv, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "rl:test",
    });
    await req(app, kv);

    expect(kv.put).toHaveBeenCalledWith("rl:test:user-1", "1", {
      expirationTtl: 60,
    });
  });

  it("returns 429 when limit is exceeded", async () => {
    kv._store.set("rl:test:user-1", { value: "5" });
    const app = buildApp(kv, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "rl:test",
    });
    const res = await req(app, kv);

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("sets X-RateLimit-Remaining to 0 at the limit boundary", async () => {
    kv._store.set("rl:test:user-1", { value: "4" });
    const app = buildApp(kv, {
      limit: 5,
      windowSeconds: 60,
      keyPrefix: "rl:test",
    });
    const res = await req(app, kv);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("uses keyPrefix and userId for isolation", async () => {
    const app = buildApp(kv, {
      limit: 10,
      windowSeconds: 3600,
      keyPrefix: "rl:crawl",
    });
    await req(app, kv);

    expect(kv.get).toHaveBeenCalledWith("rl:crawl:user-1");
    expect(kv.put).toHaveBeenCalledWith("rl:crawl:user-1", "1", {
      expirationTtl: 3600,
    });
  });

  it("does not call handler when rate limited", async () => {
    kv._store.set("rl:test:user-1", { value: "10" });
    const app = buildApp(kv, {
      limit: 10,
      windowSeconds: 60,
      keyPrefix: "rl:test",
    });
    const res = await req(app, kv);

    expect(res.status).toBe(429);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("sets correct TTL from windowSeconds", async () => {
    const app = buildApp(kv, {
      limit: 3,
      windowSeconds: 300,
      keyPrefix: "rl:slow",
    });
    await req(app, kv);

    expect(kv.put).toHaveBeenCalledWith("rl:slow:user-1", "1", {
      expirationTtl: 300,
    });
  });

  it("handles fresh KV (no existing key) as count 0", async () => {
    const app = buildApp(kv, {
      limit: 1,
      windowSeconds: 60,
      keyPrefix: "rl:fresh",
    });
    const res = await req(app, kv);

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith("rl:fresh:user-1", "1", {
      expirationTtl: 60,
    });
  });
});
