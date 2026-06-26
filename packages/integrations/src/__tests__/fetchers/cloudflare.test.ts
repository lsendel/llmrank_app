import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCloudflareData } from "../../fetchers/cloudflare";
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
    domain: "families.care",
    pageUrls: [
      "https://families.care/us/providers/age-well",
      "https://families.care/us/guides/medicaid",
    ],
    credentials: { apiKey: "cf-token" },
    config: {},
    ...overrides,
  };
}

function mockResponses(...responses: Array<{ ok?: boolean; body: unknown }>) {
  const fn = globalThis.fetch as ReturnType<typeof vi.fn>;
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.ok === false ? 500 : 200,
      json: () => Promise.resolve(r.body),
    });
  }
}

const ZONE_OK = { result: [{ id: "zone-123", name: "families.care" }] };

function graphqlGroups(
  groups: Array<{ path: string; ua: string; count: number }>,
) {
  return {
    data: {
      viewer: {
        zones: [
          {
            httpRequestsAdaptiveGroups: groups.map((g) => ({
              count: g.count,
              dimensions: { clientRequestPath: g.path, userAgent: g.ua },
            })),
          },
        ],
      },
    },
  };
}

describe("fetchCloudflareData", () => {
  it("maps AI-bot hits per path to crawled page URLs", async () => {
    mockResponses(
      { body: ZONE_OK },
      {
        body: graphqlGroups([
          { path: "/us/providers/age-well", ua: "GPTBot/1.0", count: 40 },
          { path: "/us/providers/age-well", ua: "ClaudeBot/1.0", count: 10 },
          { path: "/us/guides/medicaid", ua: "PerplexityBot", count: 7 },
          // Non-AI traffic is ignored:
          {
            path: "/us/providers/age-well",
            ua: "Mozilla/5.0 Chrome",
            count: 999,
          },
          // A path we didn't crawl is dropped:
          { path: "/other", ua: "GPTBot", count: 5 },
        ]),
      },
    );

    const results = await fetchCloudflareData(makeCtx());

    expect(results).toHaveLength(2);
    const providerPage = results.find((r) => r.pageUrl.endsWith("/age-well"))!;
    const activity = providerPage.data.aiCrawler as {
      byProvider: Record<string, number>;
      total: number;
    };
    expect(providerPage.provider).toBe("cloudflare");
    expect(activity.byProvider).toEqual({ chatgpt: 40, claude: 10 });
    expect(activity.total).toBe(50);

    const guide = results.find((r) => r.pageUrl.endsWith("/medicaid"))!;
    expect(
      (guide.data.aiCrawler as { byProvider: Record<string, number> })
        .byProvider,
    ).toEqual({
      perplexity: 7,
    });
  });

  it("uses a configured zoneId without a zone lookup", async () => {
    mockResponses({
      body: graphqlGroups([
        { path: "/us/providers/age-well", ua: "GPTBot", count: 3 },
      ]),
    });
    const results = await fetchCloudflareData(
      makeCtx({ config: { zoneId: "preset-zone" } }),
    );
    expect(results).toHaveLength(1);
    // Only the GraphQL call was made (no /zones lookup).
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(1);
  });

  it("returns [] when no pages received AI-crawler traffic", async () => {
    mockResponses(
      { body: ZONE_OK },
      { body: graphqlGroups([{ path: "/x", ua: "Mozilla/5.0", count: 100 }]) },
    );
    const results = await fetchCloudflareData(makeCtx());
    expect(results).toEqual([]);
  });

  it("throws when the domain has no zone on the account", async () => {
    mockResponses({ body: { result: [] } });
    await expect(fetchCloudflareData(makeCtx())).rejects.toThrow(
      /No Cloudflare zone/,
    );
  });

  it("throws on a GraphQL error", async () => {
    mockResponses(
      { body: ZONE_OK },
      { body: { errors: [{ message: "Authentication error" }] } },
    );
    await expect(fetchCloudflareData(makeCtx())).rejects.toThrow(
      /Authentication error/,
    );
  });

  it("throws when the API token is missing", async () => {
    await expect(
      fetchCloudflareData(makeCtx({ credentials: {} })),
    ).rejects.toThrow(/missing its API token/);
  });
});
