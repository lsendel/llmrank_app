import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { AppEnv, Bindings } from "../../index";
import { reportUploadRoutes } from "../../routes/report-upload";
import { createReportRepository } from "../../repositories";

vi.mock("../../repositories", () => ({
  createReportRepository: vi.fn(),
  createPageRepository: () => ({}),
}));

const mockCreateRepo = vi.mocked(createReportRepository);

async function sign(
  secret: string,
  timestamp: string,
  reportId: string,
  r2Key: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = `${timestamp}${reportId}${r2Key}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `hmac-sha256=${hex}`;
}

function createBindings(): { env: Bindings; r2Put: ReturnType<typeof vi.fn> } {
  const r2Put = vi.fn().mockResolvedValue(undefined);
  const queue = { send: vi.fn().mockResolvedValue(undefined) } as any;
  const env: Bindings = {
    R2: { put: r2Put } as any,
    KV: {} as KVNamespace,
    SEEN_URLS: {} as KVNamespace,
    CRAWL_QUEUE: queue,
    REPORT_QUEUE: queue,
    REPORT_SERVICE_URL: "https://reports",
    BROWSER: null as unknown as import("@cloudflare/puppeteer").BrowserWorker,
    DATABASE_URL: "postgresql://test",
    SHARED_SECRET: "test-secret",
    ANTHROPIC_API_KEY: "key",
    OPENAI_API_KEY: "key",
    GOOGLE_API_KEY: "key",
    PERPLEXITY_API_KEY: "key",
    STRIPE_SECRET_KEY: "key",
    STRIPE_WEBHOOK_SECRET: "key",
    CRAWLER_URL: "https://crawler",
    INTEGRATION_ENCRYPTION_KEY: "0".repeat(64),
    GOOGLE_OAUTH_CLIENT_ID: "client",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    RESEND_API_KEY: "key",
    SENTRY_DSN: "",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "https://auth",
    APP_BASE_URL: "https://app",
    POSTHOG_API_KEY: "",
    BING_API_KEY: "key",
    GEMINI_API_KEY: "key",
  };
  return { env, r2Put };
}

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as any);
    await next();
  });
  app.route("/internal", reportUploadRoutes);
  return app;
}

describe("report upload route", () => {
  beforeEach(() => {
    mockCreateRepo.mockReset();
  });

  it("returns 422 when headers missing", async () => {
    const app = createApp();
    const { env } = createBindings();
    mockCreateRepo.mockReturnValue({ updateStatus: vi.fn() } as any);

    const res = await app.fetch(
      new Request("http://localhost/internal/report-upload", {
        method: "POST",
      }),
      env,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when signature invalid", async () => {
    const app = createApp();
    const { env } = createBindings();
    mockCreateRepo.mockReturnValue({ updateStatus: vi.fn() } as any);

    const res = await app.fetch(
      new Request("http://localhost/internal/report-upload", {
        method: "POST",
        headers: {
          "X-Signature": "hmac-sha256=deadbeef",
          "X-Timestamp": Math.floor(Date.now() / 1000).toString(),
          "X-Report-Id": "report-1",
          "X-R2-Key": "reports/r1.pdf",
          "X-Content-Type": "application/pdf",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      env,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("HMAC_INVALID");
  });

  it("stores file and updates report when signature matches", async () => {
    const app = createApp();
    const { env, r2Put } = createBindings();
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    mockCreateRepo.mockReturnValue({ updateStatus } as any);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const reportId = "report-1";
    const r2Key = "reports/report-1.pdf";
    const signature = await sign(env.SHARED_SECRET, timestamp, reportId, r2Key);
    const body = new Uint8Array([10, 20, 30]);

    const res = await app.fetch(
      new Request("http://localhost/internal/report-upload", {
        method: "POST",
        headers: {
          "X-Signature": signature,
          "X-Timestamp": timestamp,
          "X-Report-Id": reportId,
          "X-R2-Key": r2Key,
          "X-Content-Type": "application/pdf",
        },
        body,
      }),
      env,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ stored: true, r2Key, fileSize: body.byteLength });
    expect(r2Put).toHaveBeenCalledWith(r2Key, expect.any(ArrayBuffer), {
      httpMetadata: { contentType: "application/pdf" },
    });
    expect(updateStatus).toHaveBeenCalledWith(
      reportId,
      "complete",
      expect.objectContaining({ r2Key, fileSize: body.byteLength }),
    );
  });
});
