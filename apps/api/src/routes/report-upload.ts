import { Hono } from "hono";
import type { AppEnv } from "../index";
import { createReportRepository } from "../repositories";

export const reportUploadRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Custom HMAC verification for binary uploads
// Signs: timestamp + reportId + r2Key (not the binary body)
// ---------------------------------------------------------------------------

const MAX_TIMESTAMP_DRIFT_S = 300;

async function verifyUploadHmac(
  secret: string,
  signature: string,
  timestamp: string,
  reportId: string,
  r2Key: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_S) return false;

  const prefix = "hmac-sha256=";
  if (!signature.startsWith(prefix)) return false;
  const providedHex = signature.slice(prefix.length);

  const encoder = new TextEncoder();
  const message = `${timestamp}${reportId}${r2Key}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return providedHex === expectedHex;
}

// ---------------------------------------------------------------------------
// POST /internal/report-upload — Receive generated report file from Fly.io
// ---------------------------------------------------------------------------

reportUploadRoutes.post("/report-upload", async (c) => {
  const signature = c.req.header("X-Signature");
  const timestamp = c.req.header("X-Timestamp");
  const reportId = c.req.header("X-Report-Id");
  const r2Key = c.req.header("X-R2-Key");
  const contentType =
    c.req.header("X-Content-Type") ?? "application/octet-stream";

  if (!signature || !timestamp || !reportId || !r2Key) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required headers (X-Signature, X-Timestamp, X-Report-Id, X-R2-Key)",
        },
      },
      422,
    );
  }

  const valid = await verifyUploadHmac(
    c.env.SHARED_SECRET,
    signature,
    timestamp,
    reportId,
    r2Key,
  );
  if (!valid) {
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Invalid HMAC signature" } },
      401,
    );
  }

  // Read the binary body
  const body = await c.req.arrayBuffer();
  const fileSize = body.byteLength;

  if (fileSize === 0) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Empty file body" } },
      422,
    );
  }

  // Store in R2
  await c.env.R2.put(r2Key, body, {
    httpMetadata: { contentType },
  });

  // Update report record as complete
  const repo = createReportRepository(c.get("db"));
  await repo.updateStatus(reportId, "complete", {
    r2Key,
    fileSize,
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return c.json({ stored: true, r2Key, fileSize });
});
