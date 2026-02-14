import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// We need to test the middleware and signPayload utility.
// The HMAC middleware depends on c.env.SHARED_SECRET and crypto.subtle.

// ---------------------------------------------------------------------------
// Helpers: compute HMAC the same way the middleware does
// ---------------------------------------------------------------------------

async function computeHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Mock @llm-boost/shared for ERROR_CODES
// ---------------------------------------------------------------------------

vi.mock("@llm-boost/shared", () => ({
  ERROR_CODES: {
    HMAC_INVALID: { status: 401, message: "HMAC verification failed" },
  },
}));

// Import after mock setup
const { hmacMiddleware, signPayload } = await import("../../middleware/hmac");

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const SHARED_SECRET = "test-hmac-secret-key-12345";

function createTestApp() {
  const app = new Hono<{
    Bindings: { SHARED_SECRET: string };
    Variables: { parsedBody: string };
  }>();

  app.use("/ingest/*", hmacMiddleware);
  app.post("/ingest/batch", (c) => {
    const body = c.get("parsedBody");
    return c.json({ ok: true, body });
  });

  return app;
}

async function makeSignedRequest(
  app: ReturnType<typeof createTestApp>,
  body: string,
  overrides: {
    secret?: string;
    timestamp?: string;
    signatureHeader?: string;
    omitSignature?: boolean;
    omitTimestamp?: boolean;
  } = {},
) {
  const secret = overrides.secret ?? SHARED_SECRET;
  const timestamp =
    overrides.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${body}`;
  const hex = await computeHmac(secret, message);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!overrides.omitSignature) {
    headers["X-Signature"] = overrides.signatureHeader ?? `hmac-sha256=${hex}`;
  }
  if (!overrides.omitTimestamp) {
    headers["X-Timestamp"] = timestamp;
  }

  return app.request(
    "/ingest/batch",
    {
      method: "POST",
      headers,
      body,
    },
    { SHARED_SECRET },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("hmacMiddleware", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("accepts a valid HMAC signature", async () => {
    const body = '{"jobId":"j1","pages":[]}';
    const res = await makeSignedRequest(app, body);

    expect(res.status).toBe(200);
    const json = await res.json<{ ok: boolean; body: string }>();
    expect(json).toEqual({ ok: true, body });
  });

  it("stores parsed body on context", async () => {
    const body = '{"test":"data"}';
    const res = await makeSignedRequest(app, body);

    expect(res.status).toBe(200);
    const json = await res.json<{ ok: boolean; body: string }>();
    expect(json.body).toBe(body);
  });

  it("rejects when X-Signature header is missing", async () => {
    const res = await makeSignedRequest(app, "{}", { omitSignature: true });

    expect(res.status).toBe(401);
    const json = await res.json<{ error: { code: string } }>();
    expect(json.error.code).toBe("HMAC_INVALID");
  });

  it("rejects when X-Timestamp header is missing", async () => {
    const res = await makeSignedRequest(app, "{}", { omitTimestamp: true });

    expect(res.status).toBe(401);
    const json = await res.json<{ error: { code: string } }>();
    expect(json.error.code).toBe("HMAC_INVALID");
  });

  it("rejects non-numeric timestamp", async () => {
    const body = "{}";
    const res = await makeSignedRequest(app, body, {
      timestamp: "not-a-number",
    });

    // The HMAC won't match because timestamp in header doesn't match signed content
    // But also timestamp parsing fails first
    expect(res.status).toBe(401);
  });

  it("rejects timestamp older than 5 minutes", async () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const res = await makeSignedRequest(app, "{}", {
      timestamp: oldTimestamp,
    });

    expect(res.status).toBe(401);
    const json = await res.json<{ error: { message: string } }>();
    expect(json.error.message).toContain("too old");
  });

  it("rejects timestamp from the future (>5 min)", async () => {
    const futureTimestamp = (Math.floor(Date.now() / 1000) + 600).toString();
    const res = await makeSignedRequest(app, "{}", {
      timestamp: futureTimestamp,
    });

    expect(res.status).toBe(401);
    const json = await res.json<{ error: { message: string } }>();
    expect(json.error.message).toContain("too far in the future");
  });

  it("rejects invalid signature format (no hmac-sha256= prefix)", async () => {
    const res = await makeSignedRequest(app, "{}", {
      signatureHeader: "invalid-format-hex",
    });

    expect(res.status).toBe(401);
    const json = await res.json<{ error: { message: string } }>();
    expect(json.error.message).toContain("Invalid signature format");
  });

  it("rejects tampered body", async () => {
    const body = '{"original":"data"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${body}`;
    const hex = await computeHmac(SHARED_SECRET, message);

    // Send different body than what was signed
    const res = await app.request(
      "/ingest/batch",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": `hmac-sha256=${hex}`,
          "X-Timestamp": timestamp,
        },
        body: '{"tampered":"data"}',
      },
      { SHARED_SECRET },
    );

    expect(res.status).toBe(401);
  });

  it("rejects wrong secret", async () => {
    const res = await makeSignedRequest(app, "{}", {
      secret: "wrong-secret-key",
    });

    expect(res.status).toBe(401);
  });

  it("accepts timestamp within 5-minute window", async () => {
    // 4 minutes ago — should still be valid
    const recentTimestamp = (Math.floor(Date.now() / 1000) - 240).toString();
    const res = await makeSignedRequest(app, '{"ok":true}', {
      timestamp: recentTimestamp,
    });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// signPayload utility
// ---------------------------------------------------------------------------

describe("signPayload", () => {
  it("returns signature with hmac-sha256= prefix", async () => {
    const body = '{"test":"payload"}';
    const result = await signPayload(SHARED_SECRET, body);

    expect(result.signature).toMatch(/^hmac-sha256=[a-f0-9]{64}$/);
    expect(result.timestamp).toMatch(/^\d+$/);
  });

  it("produces signature that matches manual HMAC computation", async () => {
    const body = '{"verify":"consistency"}';
    const result = await signPayload(SHARED_SECRET, body);

    const message = `${result.timestamp}${body}`;
    const expectedHex = await computeHmac(SHARED_SECRET, message);

    expect(result.signature).toBe(`hmac-sha256=${expectedHex}`);
  });

  it("produces different signatures for different bodies", async () => {
    const result1 = await signPayload(SHARED_SECRET, "body-a");
    const result2 = await signPayload(SHARED_SECRET, "body-b");

    // Timestamps might be same, but signatures must differ
    const sig1 = result1.signature.slice("hmac-sha256=".length);
    const sig2 = result2.signature.slice("hmac-sha256=".length);
    expect(sig1).not.toBe(sig2);
  });
});
