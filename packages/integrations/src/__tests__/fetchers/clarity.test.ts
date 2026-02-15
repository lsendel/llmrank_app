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
        Promise.resolve({
          pages: [
            {
              url: "https://example.com/",
              deadClicks: 5,
              rageClicks: 2,
              scrollDepth: 75,
              engagementScore: 82,
              totalSessions: 1200,
            },
          ],
        }),
    });

    const results = await fetchClarityData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe("clarity");
    expect(results[0].data.deadClicks).toBe(5);
    expect(results[0].data.scrollDepth).toBe(75);
    expect(results[0].data.totalSessions).toBe(1200);
  });

  it("throws when projectId is missing", async () => {
    await expect(
      fetchClarityData(
        makeCtx({
          credentials: { apiKey: "key" },
          config: {},
        }),
      ),
    ).rejects.toThrow("Clarity project ID is required");
  });

  it("throws on API error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(fetchClarityData(makeCtx())).rejects.toThrow(
      "Clarity API error: 403",
    );
  });

  it("returns null metrics for pages not in Clarity data", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pages: [] }),
    });

    const results = await fetchClarityData(makeCtx());
    expect(results).toHaveLength(2);
    expect(results[0].data.deadClicks).toBeNull();
    expect(results[0].data.engagementScore).toBeNull();
    expect(results[0].data.totalSessions).toBe(0);
  });

  it("uses projectId from config when available", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pages: [] }),
    });

    await fetchClarityData(
      makeCtx({
        credentials: { apiKey: "key" },
        config: { projectId: "config-proj" },
      }),
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[0]).toContain("config-proj");
  });
});
