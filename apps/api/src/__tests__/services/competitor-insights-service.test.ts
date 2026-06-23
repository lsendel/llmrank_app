import { describe, expect, it, vi } from "vitest";
import {
  buildCompetitorWinningQueryMap,
  createCompetitorInsightsService,
  fetchHomepageSignals,
  inferThemes,
} from "../../services/competitor-insights-service";

describe("competitor-insights-service", () => {
  it("aggregates winning queries by competitor and query", () => {
    const result = buildCompetitorWinningQueryMap(
      [
        {
          query: "ai seo software",
          llmProvider: "chatgpt",
          checkedAt: "2024-01-01T00:00:00.000Z",
          brandMentioned: false,
          urlCited: false,
          competitorMentions: [
            { domain: "example.com", mentioned: true, position: 1 },
            { domain: "other.com", mentioned: false, position: null },
          ],
        },
        {
          query: "ai seo software",
          llmProvider: "perplexity",
          checkedAt: "2024-01-03T00:00:00.000Z",
          brandMentioned: true,
          urlCited: true,
          competitorMentions: [
            { domain: "example.com", mentioned: true, position: 2 },
          ],
        },
      ] as never[],
      ["example.com"],
    );

    expect(result.get("example.com")).toEqual([
      {
        query: "ai seo software",
        providers: ["chatgpt", "perplexity"],
        wins: 2,
        bestPosition: 1,
        avgPosition: 1.5,
        lastSeenAt: "2024-01-03T00:00:00.000Z",
        yourMentioned: true,
        yourCited: true,
      },
    ]);
  });

  it("infers mixed themes from homepage signals and winning queries", () => {
    const result = inferThemes({
      domain: "example.com",
      homepageSignals: {
        title: "AI SEO platform for SaaS teams",
        metaDescription: "Increase visibility in AI answers",
        headings: ["AI SEO workflows", "Visibility monitoring for SaaS"],
      },
      winningQueries: [
        {
          query: "best ai seo tools",
          providers: ["chatgpt"],
          wins: 2,
          bestPosition: 1,
          avgPosition: 1,
          lastSeenAt: "2024-01-01T00:00:00.000Z",
          yourMentioned: false,
          yourCited: false,
        },
      ],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.some(
        (theme) =>
          theme.label.includes("SEO") || theme.label.includes("Visibility"),
      ),
    ).toBe(true);
  });

  it("fetches homepage signals from public HTML", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "<html><head><title>AI SEO platform</title><meta name='description' content='Grow visibility in AI answers' /></head><body><h1>AI SEO platform</h1><h2>Visibility monitoring</h2></body></html>",
    });

    const result = await fetchHomepageSignals("example.com", fetchImpl);

    expect(fetchImpl).toHaveBeenCalled();
    expect(result).toEqual({
      title: "AI SEO platform",
      metaDescription: "Grow visibility in AI answers",
      headings: ["AI SEO platform", "Visibility monitoring"],
    });
  });

  it("combines visibility wins with inferred homepage themes", async () => {
    const service = createCompetitorInsightsService({
      visibility: {
        listByProject: vi.fn().mockResolvedValue([
          {
            query: "ai seo software",
            llmProvider: "chatgpt",
            checkedAt: "2024-01-01T00:00:00.000Z",
            brandMentioned: false,
            urlCited: false,
            competitorMentions: [
              { domain: "example.com", mentioned: true, position: 1 },
            ],
          },
        ]),
        getTrends: vi.fn(),
        create: vi.fn(),
        countSince: vi.fn(),
        countSinceByProjects: vi.fn(),
      },
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          "<html><head><title>AI SEO platform</title></head><body><h1>AI SEO workflows</h1></body></html>",
      }) as typeof fetch,
    });

    const result = await service.getProjectInsights({
      projectId: "proj-1",
      competitorDomains: ["example.com"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.competitorDomain).toBe("example.com");
    expect(result[0]?.winningQueries[0]?.query).toBe("ai seo software");
    expect(
      result[0]?.inferredThemes.some((theme) => theme.label.includes("SEO")),
    ).toBe(true);
  });
});
