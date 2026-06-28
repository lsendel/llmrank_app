import { describe, expect, it } from "vitest";
import {
  buildAiReadinessFactors,
  findActiveOverviewCrawl,
  buildOtherCategoryRows,
  buildOverviewMeta,
  buildOverviewStatusState,
  isOverviewActiveCrawl,
  selectTopIssues,
} from "./overview-tab-helpers";

describe("overview-tab helpers", () => {
  it("derives loading, error, and empty states from the crawl status", () => {
    expect(
      buildOverviewStatusState({ id: "crawl-1", status: "crawling" } as never),
    ).toEqual({
      kind: "loading",
      crawlId: "crawl-1",
    });
    expect(
      buildOverviewStatusState({
        status: "failed",
        errorMessage: "Boom",
      } as never),
    ).toEqual({
      kind: "error",
      errorMessage: "Boom",
    });
    expect(buildOverviewStatusState(undefined)).toEqual({ kind: "empty" });
  });

  it("builds overview metadata and category rows from crawl data", () => {
    const latestCrawl = {
      status: "complete",
      createdAt: "2024-01-01T00:00:00.000Z",
      completedAt: "2024-01-02T00:00:00.000Z",
      pagesScored: 8,
      pagesCrawled: 10,
      pagesFound: 12,
      scores: { technical: 75, content: 80, performance: 68 },
    } as never;

    expect(buildOverviewMeta(latestCrawl)).toEqual({
      hasScores: true,
      pagesSampled: 12,
      crawlTimestamp: "2024-01-02T00:00:00.000Z",
      dataConfidence: { label: "Low", variant: "destructive" },
      statusState: null,
    });

    expect(
      buildOtherCategoryRows(latestCrawl, {
        categoryDeltas: {
          technical: { delta: 4 },
          content: { delta: 0 },
          performance: { delta: -2 },
        },
      } as never),
    ).toEqual([
      { key: "technical", label: "Technical SEO (25%)", score: 75, delta: 4 },
      { key: "content", label: "Content Quality (30%)", score: 80, delta: 0 },
      { key: "performance", label: "Performance (15%)", score: 68, delta: -2 },
    ]);
  });

  it("prefers site context when evaluating ai readiness factors", () => {
    expect(
      buildAiReadinessFactors(
        [{ code: "MISSING_LLMS_TXT" }] as never,
        {
          hasLlmsTxt: true,
          aiCrawlersBlocked: ["GPTBot"],
          hasSitemap: false,
          sitemapAnalysis: { urlCount: 42 },
        } as never,
      ),
    ).toEqual([
      { code: "MISSING_LLMS_TXT", label: "llms.txt file", pass: true },
      {
        code: "AI_CRAWLER_BLOCKED",
        label: "AI crawlers allowed",
        pass: false,
        details: "Blocked: GPTBot",
      },
      {
        code: "NO_SITEMAP",
        label: "Sitemap found",
        pass: false,
        details: "42 URLs",
      },
      {
        code: "CITATION_WORTHINESS",
        label: "Citation-worthy content",
        pass: true,
      },
    ]);
  });

  it("selectTopIssues dedupes by code and sorts most-severe first", () => {
    const mk = (code: string, severity: "critical" | "warning" | "info") =>
      ({ code, category: "technical", severity, message: code }) as never;

    const issues = [
      mk("A_INFO", "info"),
      mk("B_CRIT", "critical"),
      mk("B_CRIT", "critical"), // same code on another page — should collapse
      mk("C_WARN", "warning"),
    ];

    const top = selectTopIssues(issues, 5);

    expect(top.map((i) => i.code)).toEqual(["B_CRIT", "C_WARN", "A_INFO"]);
  });

  it("selectTopIssues caps the result at the limit", () => {
    const mk = (code: string) =>
      ({
        code,
        category: "technical",
        severity: "critical",
        message: code,
      }) as never;
    const issues = Array.from({ length: 8 }, (_, i) => mk(`CODE_${i}`));

    expect(selectTopIssues(issues, 5)).toHaveLength(5);
  });

  it("finds active crawl history without treating terminal crawls as active", () => {
    expect(isOverviewActiveCrawl({ id: "crawl-1", status: "complete" })).toBe(
      false,
    );
    expect(isOverviewActiveCrawl({ id: "crawl-2", status: "queued" })).toBe(
      true,
    );
    expect(
      findActiveOverviewCrawl([
        { id: "crawl-1", status: "complete" },
        { id: "crawl-2", status: "crawling" },
      ]),
    ).toEqual({ id: "crawl-2", status: "crawling" });
  });
});
