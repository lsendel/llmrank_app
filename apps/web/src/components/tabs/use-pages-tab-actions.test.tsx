import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagesTabActions } from "./use-pages-tab-actions";

const pages = [
  {
    id: "page-1",
    crawlId: "crawl-1",
    url: "https://example.com/b",
    statusCode: 200,
    title: "Beta",
    metaDescription: null,
    wordCount: 100,
    overallScore: 82,
    technicalScore: 80,
    contentScore: 81,
    aiReadinessScore: 82,
    performanceScore: 83,
    letterGrade: "B",
    issueCount: 2,
  },
  {
    id: "page-2",
    crawlId: "crawl-1",
    url: "https://example.com/a",
    statusCode: 301,
    title: "Alpha",
    metaDescription: null,
    wordCount: 100,
    overallScore: 91,
    technicalScore: 90,
    contentScore: 91,
    aiReadinessScore: 92,
    performanceScore: 93,
    letterGrade: "A",
    issueCount: 1,
    isCrossDomainRedirect: true,
    redirectUrl: "https://other.example.com/a",
  },
  {
    id: "page-3",
    crawlId: "crawl-1",
    url: "https://example.com/c",
    statusCode: 404,
    title: "Gamma",
    metaDescription: null,
    wordCount: 100,
    overallScore: 40,
    technicalScore: 41,
    contentScore: 42,
    aiReadinessScore: 43,
    performanceScore: 44,
    letterGrade: "F",
    issueCount: 5,
  },
];

describe("usePagesTabActions", () => {
  it("hides redirects by default and exposes sort/expand handlers", () => {
    const { result } = renderHook(() => usePagesTabActions({ pages }));

    expect(result.current.redirectCount).toBe(1);
    expect(result.current.showRedirects).toBe(false);
    expect(result.current.sortedPages.map((page) => page.id)).toEqual([
      "page-3",
      "page-1",
    ]);

    act(() => {
      result.current.handleShowRedirectsChange(true);
    });

    expect(result.current.sortedPages.map((page) => page.id)).toEqual([
      "page-3",
      "page-1",
      "page-2",
    ]);

    act(() => {
      result.current.handleSort("issueCount");
    });

    expect(result.current.sortField).toBe("issueCount");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.sortedPages.map((page) => page.id)).toEqual([
      "page-2",
      "page-1",
      "page-3",
    ]);

    act(() => {
      result.current.handleSort("issueCount");
      result.current.handleExpandedRowToggle("page-2");
    });

    expect(result.current.sortDir).toBe("desc");
    expect(result.current.expandedRow).toBe("page-2");

    act(() => {
      result.current.handleExpandedRowToggle("page-2");
    });

    expect(result.current.expandedRow).toBeNull();
  });
});
