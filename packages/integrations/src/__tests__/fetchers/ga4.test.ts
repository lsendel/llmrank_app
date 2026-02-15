import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGA4Data } from "../../fetchers/ga4";
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
    pageUrls: ["https://example.com/about", "https://example.com/pricing"],
    credentials: { accessToken: "test-token" },
    config: { propertyId: "123456" },
    ...overrides,
  };
}

describe("fetchGA4Data", () => {
  it("returns EnrichmentResult[] with provider 'ga4'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rows: [
            {
              dimensionValues: [{ value: "/about" }],
              metricValues: [
                { value: "0.45" },
                { value: "120" },
                { value: "500" },
                { value: "350" },
                { value: "42000" },
              ],
            },
          ],
        }),
    });

    const results = await fetchGA4Data(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe("ga4");
    expect(results[0].pageUrl).toBe("https://example.com/about");
    expect(results[0].data.bounceRate).toBe(0.45);
    expect(results[0].data.sessions).toBe(500);
  });

  it("throws when propertyId is missing", async () => {
    await expect(fetchGA4Data(makeCtx({ config: {} }))).rejects.toThrow(
      "GA4 property ID is required",
    );
  });

  it("throws on API error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(fetchGA4Data(makeCtx())).rejects.toThrow(
      "GA4 Data API error: 401",
    );
  });

  it("returns null metrics for pages not in GA4 data", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    });

    const results = await fetchGA4Data(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].data.bounceRate).toBeNull();
    expect(results[0].data.sessions).toBe(0);
  });

  it("matches page URLs to GA4 paths correctly", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rows: [
            {
              dimensionValues: [{ value: "/pricing" }],
              metricValues: [
                { value: "0.30" },
                { value: "90" },
                { value: "200" },
                { value: "150" },
                { value: "18000" },
              ],
            },
          ],
        }),
    });

    const results = await fetchGA4Data(makeCtx());
    // /about is not in GA4 data, /pricing is
    expect(results[0].data.bounceRate).toBeNull(); // /about
    expect(results[1].data.bounceRate).toBe(0.3); // /pricing
    expect(results[1].data.sessions).toBe(200);
  });
});
