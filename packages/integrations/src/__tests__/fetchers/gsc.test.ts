import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGSCData } from "../../fetchers/gsc";
import type { IntegrationFetcherContext } from "../../types";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  responses: Array<{
    ok: boolean;
    status?: number;
    json?: () => Promise<unknown>;
  }>,
) {
  const fn = globalThis.fetch as ReturnType<typeof vi.fn>;
  for (const resp of responses) {
    fn.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: resp.json ?? (() => Promise.resolve({})),
      text: () => Promise.resolve(""),
    });
  }
}

function makeCtx(
  overrides?: Partial<IntegrationFetcherContext>,
): IntegrationFetcherContext {
  return {
    domain: "example.com",
    pageUrls: ["https://example.com/page1", "https://example.com/page2"],
    credentials: { accessToken: "test-token" },
    config: {},
    ...overrides,
  };
}

describe("fetchGSCData", () => {
  it("returns EnrichmentResult[] with provider 'gsc'", async () => {
    mockFetch([
      // Site list response
      {
        ok: true,
        json: () =>
          Promise.resolve({
            siteEntry: [{ siteUrl: "sc-domain:example.com" }],
          }),
      },
      // Search analytics response
      {
        ok: true,
        json: () =>
          Promise.resolve({
            rows: [
              {
                keys: ["https://example.com/page1", "seo tools"],
                clicks: 50,
                impressions: 1000,
                ctr: 0.05,
                position: 3.2,
              },
            ],
          }),
      },
      // URL inspection for page1
      {
        ok: true,
        json: () =>
          Promise.resolve({
            inspectionResult: {
              indexStatusResult: { coverageState: "Submitted and indexed" },
            },
          }),
      },
      // URL inspection for page2
      {
        ok: true,
        json: () =>
          Promise.resolve({
            inspectionResult: {
              indexStatusResult: { coverageState: "Discovered" },
            },
          }),
      },
    ]);

    const results = await fetchGSCData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe("gsc");
    expect(results[0].pageUrl).toBe("https://example.com/page1");
    expect(results[0].data.totalClicks).toBe(50);
    expect(results[0].data.indexedStatus).toBe("Submitted and indexed");
  });

  it("returns zero metrics for pages not in GSC data", async () => {
    mockFetch([
      // Site list response
      {
        ok: true,
        json: () =>
          Promise.resolve({
            siteEntry: [{ siteUrl: "sc-domain:example.com" }],
          }),
      },
      // No rows returned from analytics
      { ok: true, json: () => Promise.resolve({ rows: [] }) },
      // URL inspection for page1
      { ok: true, json: () => Promise.resolve({}) },
      // URL inspection for page2
      { ok: true, json: () => Promise.resolve({}) },
    ]);

    const results = await fetchGSCData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].data.totalClicks).toBe(0);
    expect(results[0].data.totalImpressions).toBe(0);
    expect((results[0].data.queries as unknown[]).length).toBe(0);
  });

  it("throws on search analytics API error", async () => {
    mockFetch([
      // Site list response
      {
        ok: true,
        json: () =>
          Promise.resolve({
            siteEntry: [{ siteUrl: "sc-domain:example.com" }],
          }),
      },
      { ok: false, status: 403 },
    ]);

    await expect(fetchGSCData(makeCtx())).rejects.toThrow(
      "GSC Search Analytics API error: 403",
    );
  });

  it("handles URL inspection failure gracefully", async () => {
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchFn
      // Site list response
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            siteEntry: [{ siteUrl: "sc-domain:example.com" }],
          }),
      })
      // Search analytics success
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ rows: [] }),
      })
      // URL inspection fails
      .mockRejectedValueOnce(new Error("Network error"))
      // URL inspection for second page
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

    const results = await fetchGSCData(makeCtx());
    expect(results).toHaveLength(2);
    // Failed inspection should result in null indexedStatus
    expect(results[0].data.indexedStatus).toBeNull();
  });

  it("aggregates queries per page correctly", async () => {
    mockFetch([
      // Site list response
      {
        ok: true,
        json: () =>
          Promise.resolve({
            siteEntry: [{ siteUrl: "sc-domain:example.com" }],
          }),
      },
      {
        ok: true,
        json: () =>
          Promise.resolve({
            rows: [
              {
                keys: ["https://example.com/page1", "query A"],
                clicks: 10,
                impressions: 100,
                ctr: 0.1,
                position: 2,
              },
              {
                keys: ["https://example.com/page1", "query B"],
                clicks: 20,
                impressions: 200,
                ctr: 0.1,
                position: 5,
              },
            ],
          }),
      },
      { ok: true, json: () => Promise.resolve({}) },
      { ok: true, json: () => Promise.resolve({}) },
    ]);

    const results = await fetchGSCData(makeCtx());
    expect(results[0].data.totalClicks).toBe(30);
    expect(results[0].data.totalImpressions).toBe(300);
    expect((results[0].data.queries as unknown[]).length).toBe(2);
  });
});
