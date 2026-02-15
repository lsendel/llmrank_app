import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPSIData } from "../../fetchers/psi";
import type { IntegrationFetcherContext } from "../../types";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeCtx(
  overrides?: Partial<IntegrationFetcherContext>,
): IntegrationFetcherContext {
  return {
    domain: "example.com",
    pageUrls: ["https://example.com/"],
    credentials: { apiKey: "psi-key" },
    config: {},
    ...overrides,
  };
}

describe("fetchPSIData", () => {
  it("returns EnrichmentResult[] with provider 'psi'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          loadingExperience: {
            overall_category: "FAST",
            metrics: {
              LARGEST_CONTENTFUL_PAINT_MS: {
                percentile: 1200,
                category: "FAST",
              },
              FIRST_INPUT_DELAY_MS: { percentile: 50, category: "FAST" },
              CUMULATIVE_LAYOUT_SHIFT_SCORE: {
                percentile: 5,
                category: "FAST",
              },
              FIRST_CONTENTFUL_PAINT_MS: { percentile: 800, category: "FAST" },
              EXPERIMENTAL_TIME_TO_FIRST_BYTE: {
                percentile: 300,
                category: "FAST",
              },
            },
          },
          lighthouseResult: {
            categories: {
              performance: { score: 0.92 },
            },
            audits: {
              "speed-index": { numericValue: 1500 },
              "total-blocking-time": { numericValue: 100 },
            },
          },
        }),
    });

    const results = await fetchPSIData(makeCtx());
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe("psi");
    expect(results[0].data.cruxOverall).toBe("FAST");
    expect((results[0].data.lcp as Record<string, unknown>).value).toBe(1200);
    expect(results[0].data.labPerformanceScore).toBe(0.92);
    expect(results[0].data.labSpeedIndex).toBe(1500);
  });

  it("skips failed pages without crashing", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const results = await fetchPSIData(
      makeCtx({ pageUrls: ["https://example.com/bad"] }),
    );
    // Promise.allSettled swallows the error, so no result for the failed page
    expect(results).toHaveLength(0);
  });

  it("handles missing CrUX data gracefully", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          lighthouseResult: {
            categories: { performance: { score: 0.75 } },
            audits: {},
          },
        }),
    });

    const results = await fetchPSIData(makeCtx());
    expect(results).toHaveLength(1);
    expect(results[0].data.cruxOverall).toBeNull();
    expect((results[0].data.lcp as Record<string, unknown>).value).toBeNull();
    expect(results[0].data.labPerformanceScore).toBe(0.75);
  });

  it("processes multiple URLs in batches", async () => {
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    // 6 URLs should result in 6 fetch calls
    fetchFn.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          loadingExperience: { metrics: {} },
          lighthouseResult: { categories: {}, audits: {} },
        }),
    });

    const urls = Array.from(
      { length: 6 },
      (_, i) => `https://example.com/page${i}`,
    );
    const results = await fetchPSIData(makeCtx({ pageUrls: urls }));
    expect(results).toHaveLength(6);
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it("uses INP when FID is not available", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          loadingExperience: {
            metrics: {
              INTERACTION_TO_NEXT_PAINT: { percentile: 120, category: "GOOD" },
            },
          },
          lighthouseResult: { categories: {}, audits: {} },
        }),
    });

    const results = await fetchPSIData(makeCtx());
    expect((results[0].data.fid as Record<string, unknown>).value).toBe(120);
    expect((results[0].data.fid as Record<string, unknown>).category).toBe(
      "GOOD",
    );
  });
});
