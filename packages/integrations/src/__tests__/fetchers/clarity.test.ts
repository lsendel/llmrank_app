import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchClarityData } from "../../fetchers/clarity";
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
    pageUrls: ["https://example.com/", "https://example.com/about"],
    credentials: { apiKey: "clarity-key", projectId: "proj-123" },
    config: {},
    ...overrides,
  };
}

describe("fetchClarityData", () => {
  it("returns EnrichmentResult[] with provider 'clarity'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            metricName: "Traffic",
            information: [
              { URL: "https://example.com/", totalSessionCount: "1200" },
            ],
          },
          {
            metricName: "Dead Click Count",
            information: [
              { URL: "https://example.com/", "Dead Click Count": "5" },
            ],
          },
          {
            metricName: "Scroll Depth",
            information: [
              { URL: "https://example.com/", "Scroll Depth": "75" },
            ],
          },
        ]),
    });

    const results = await fetchClarityData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe("clarity");
    expect(results[0].data.deadClicks).toBe(5);
    expect(results[0].data.scrollDepth).toBe(75);
    expect(results[0].data.totalSessions).toBe(1200);
  });

  it("throws when API token is missing", async () => {
    await expect(
      fetchClarityData(
        makeCtx({
          credentials: {},
          config: {},
        }),
      ),
    ).rejects.toThrow("Clarity API token is required");
  });

  it("throws on API error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(""),
    });

    await expect(fetchClarityData(makeCtx())).rejects.toThrow(
      "Clarity API error: 403",
    );
  });

  it("returns null metrics for pages not in Clarity data", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const results = await fetchClarityData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].data.deadClicks).toBeNull();
    expect(results[0].data.engagementScore).toBeNull();
    expect(results[0].data.totalSessions).toBe(0);
  });

  it("sends bearer token in authorization header", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetchClarityData(makeCtx());

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[1].headers.Authorization).toBe("Bearer clarity-key");
  });
});
