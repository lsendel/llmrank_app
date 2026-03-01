import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildCrawlJob } from "../helpers/factories";

// ---------------------------------------------------------------------------
// Mock repositories
// ---------------------------------------------------------------------------

const mockCrawlRepo = {
  create: vi.fn().mockResolvedValue(buildCrawlJob()),
  getById: vi.fn().mockResolvedValue(null),
  getLatestByProject: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  generateShareToken: vi.fn().mockResolvedValue("token"),
  disableSharing: vi.fn().mockResolvedValue(undefined),
};

const mockPageRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  createBatch: vi.fn().mockResolvedValue([{ id: "page-1" }]),
};

const mockScoreRepo = {
  listByJob: vi.fn().mockResolvedValue([]),
  getIssuesByJob: vi.fn().mockResolvedValue([]),
  listByJobWithPages: vi.fn().mockResolvedValue([]),
  getByPageWithIssues: vi.fn().mockResolvedValue(null),
  createBatch: vi.fn().mockResolvedValue([{ id: "score-1" }]),
  createIssues: vi.fn().mockResolvedValue(undefined),
};

const mockOutboxRepo = {
  enqueue: vi.fn().mockResolvedValue(undefined),
};

const mockCrawlInsightRepo = {
  replaceForCrawl: vi.fn().mockResolvedValue(undefined),
  listByCrawl: vi.fn().mockResolvedValue([]),
};

const mockPageInsightRepo = {
  replaceForCrawl: vi.fn().mockResolvedValue(undefined),
  listByCrawl: vi.fn().mockResolvedValue([]),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => ({}),
  createUserRepository: () => ({}),
  createCrawlRepository: () => mockCrawlRepo,
  createScoreRepository: () => mockScoreRepo,
  createPageRepository: () => mockPageRepo,
  createOutboxRepository: () => mockOutboxRepo,
  createCrawlInsightRepository: () => mockCrawlInsightRepo,
  createPageInsightRepository: () => mockPageInsightRepo,
}));

// Mock LLM scoring to prevent real API calls
vi.mock("../../services/llm-scoring", () => ({
  runLLMScoring: vi.fn().mockResolvedValue(undefined),
  rescoreLLM: vi.fn().mockResolvedValue({ rescored: 0 }),
}));

// Mock enrichments
vi.mock("../../services/enrichments", () => ({
  runIntegrationEnrichments: vi.fn().mockResolvedValue(undefined),
}));

// Mock summary
vi.mock("../../services/summary", () => ({
  generateCrawlSummary: vi.fn().mockResolvedValue(undefined),
  persistCrawlSummaryData: vi.fn().mockResolvedValue(undefined),
}));

// Mock frontier service
vi.mock("../../services/frontier-service", () => ({
  createFrontierService: () => ({
    isSeen: vi.fn().mockResolvedValue(false),
    markSeen: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock notification service
vi.mock("../../services/notification-service", () => ({
  createNotificationService: () => ({
    sendCrawlComplete: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ---------------------------------------------------------------------------
// HMAC signature helper
// ---------------------------------------------------------------------------

async function computeHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signedRequest(
  request: (
    path: string,
    init?: RequestInit & { json?: unknown },
  ) => Promise<Response>,
  path: string,
  body: string,
  secret: string,
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${body}`;
  const hex = await computeHmac(secret, message);
  const signature = `hmac-sha256=${hex}`;

  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Ingest Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCrawlRepo.getById.mockResolvedValue(
      buildCrawlJob({ id: "crawl-1", projectId: "proj-1", status: "queued" }),
    );
  });

  // -----------------------------------------------------------------------
  // POST /ingest/batch — HMAC required
  // -----------------------------------------------------------------------

  describe("POST /ingest/batch", () => {
    it("returns 401 when HMAC headers are missing", async () => {
      const res = await request("/ingest/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: "crawl-1" }),
      });
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.error.code).toBe("HMAC_INVALID");
    });

    it("returns 401 when HMAC signature is invalid", async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const res = await request("/ingest/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature":
            "hmac-sha256=0000000000000000000000000000000000000000000000000000000000000000",
          "X-Timestamp": timestamp,
        },
        body: JSON.stringify({ job_id: "crawl-1" }),
      });
      expect(res.status).toBe(401);

      const body: any = await res.json();
      expect(body.error.code).toBe("HMAC_INVALID");
    });

    it("accepts valid HMAC-signed batch payload", async () => {
      const batchPayload = JSON.stringify({
        job_id: "crawl-1",
        batch_index: 0,
        is_final: true,
        pages: [
          {
            url: "https://example.com",
            status_code: 200,
            title: "Example",
            meta_description: "An example page",
            canonical_url: null,
            word_count: 500,
            content_hash: "abc123",
            html_r2_key: null,
            extracted: {
              h1: ["Example"],
              h2: [],
              h3: [],
              h4: [],
              h5: [],
              h6: [],
              schema_types: [],
              internal_links: [],
              external_links: [],
              images_without_alt: 0,
              has_robots_meta: false,
              robots_directives: [],
              og_tags: {},
              structured_data: [],
              pdf_links: [],
              cors_unsafe_blank_links: 0,
              cors_mixed_content: 0,
              cors_has_issues: false,
              sentence_length_variance: null,
              top_transition_words: [],
            },
          },
        ],
        stats: { pages_found: 1, pages_crawled: 1 },
      });

      const res = await signedRequest(
        request,
        "/ingest/batch",
        batchPayload,
        "test-secret",
      );

      // Should be 200 (processed) or 422 if schema validation fails,
      // but definitely NOT 401 (HMAC should pass)
      expect(res.status).not.toBe(401);
    });

    it("returns 401 when timestamp is expired", async () => {
      const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const body = JSON.stringify({ job_id: "crawl-1" });
      const hex = await computeHmac(
        "test-secret",
        `${expiredTimestamp}${body}`,
      );

      const res = await request("/ingest/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": `hmac-sha256=${hex}`,
          "X-Timestamp": expiredTimestamp,
        },
        body,
      });
      expect(res.status).toBe(401);

      const responseBody: any = await res.json();
      expect(responseBody.error.code).toBe("HMAC_INVALID");
      expect(responseBody.error.message).toContain("Timestamp");
    });

    it("returns 401 when signature format is wrong (missing prefix)", async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const res = await request("/ingest/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": "invalid-prefix=abc123",
          "X-Timestamp": timestamp,
        },
        body: JSON.stringify({ job_id: "crawl-1" }),
      });
      expect(res.status).toBe(401);

      const responseBody: any = await res.json();
      expect(responseBody.error.code).toBe("HMAC_INVALID");
      expect(responseBody.error.message).toContain("Invalid signature format");
    });

    it("returns 401 when timestamp is not a number", async () => {
      const res = await request("/ingest/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": "hmac-sha256=abc123",
          "X-Timestamp": "not-a-number",
        },
        body: JSON.stringify({ job_id: "crawl-1" }),
      });
      expect(res.status).toBe(401);

      const responseBody: any = await res.json();
      expect(responseBody.error.code).toBe("HMAC_INVALID");
      expect(responseBody.error.message).toContain("Invalid timestamp");
    });
  });

  // -----------------------------------------------------------------------
  // POST /ingest/rescore-llm — HMAC required
  // -----------------------------------------------------------------------

  describe("POST /ingest/rescore-llm", () => {
    it("returns 401 when HMAC headers are missing", async () => {
      const res = await request("/ingest/rescore-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: "crawl-1" }),
      });
      expect(res.status).toBe(401);

      const responseBody: any = await res.json();
      expect(responseBody.error.code).toBe("HMAC_INVALID");
    });

    it("accepts valid HMAC-signed rescore-llm request", async () => {
      const rescorePayload = JSON.stringify({ job_id: "crawl-1" });

      const res = await signedRequest(
        request,
        "/ingest/rescore-llm",
        rescorePayload,
        "test-secret",
      );

      // Should not be 401 (HMAC passes)
      expect(res.status).not.toBe(401);
    });
  });
});
