#!/usr/bin/env node
/**
 * Re-score a completed crawl job in place via the HMAC-protected
 * POST /ingest/rescore-factors endpoint. Loops over the cursor until done.
 *
 * Usage:
 *   SHARED_SECRET=... node infra/scripts/rescore-job.mjs <job_id> [--limit 100] [--base https://api.llmrank.app]
 *
 * Defaults to the families.care crawl job if no job_id is given.
 */
import { createHmac } from "node:crypto";

const args = process.argv.slice(2);
const jobId =
  args.find((a) => !a.startsWith("--")) ??
  "d84798c2-a592-4fd1-a3f9-746f3fed51c7"; // families.care latest crawl
const limit = Number(valueOf("--limit") ?? 100);
const base = (valueOf("--base") ?? "https://api.llmrank.app").replace(/\/$/, "");
const secret = process.env.SHARED_SECRET;

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

if (!secret) {
  console.error("ERROR: set SHARED_SECRET in the environment.");
  process.exit(1);
}

const url = `${base}/ingest/rescore-factors`;

async function call(cursor) {
  const body = JSON.stringify({ job_id: jobId, cursor, limit });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}${body}`)
    .digest("hex");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": `hmac-sha256=${signature}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return JSON.parse(text).data;
}

let cursor;
let totalUpdated = 0;
let totalSkipped = 0;
let batch = 0;
console.log(`Re-scoring job ${jobId} (limit=${limit}) at ${url}`);
for (;;) {
  const r = await call(cursor);
  batch++;
  totalUpdated += r.updated;
  totalSkipped += r.skipped;
  console.log(
    `  batch ${batch}: processed=${r.processed} updated=${r.updated} skipped=${r.skipped} done=${r.done}`,
  );
  if (r.done) break;
  cursor = r.nextCursor;
}
console.log(
  `Done. ${batch} batches, ${totalUpdated} pages re-scored, ${totalSkipped} skipped.`,
);
