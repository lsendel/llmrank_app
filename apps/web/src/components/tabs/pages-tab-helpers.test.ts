import { describe, expect, it } from "vitest";
import {
  filterPages,
  getAriaSort,
  getNextSortState,
  getRedirectCount,
  sortPages,
} from "./pages-tab-helpers";

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
];

describe("pages-tab helpers", () => {
  it("filters redirects and counts them", () => {
    expect(getRedirectCount(pages)).toBe(1);
    expect(filterPages(pages, false)).toEqual([pages[0]]);
    expect(filterPages(pages, true)).toEqual(pages);
  });

  it("sorts pages and computes next sort metadata", () => {
    expect(sortPages(pages, "url", "asc").map((page) => page.id)).toEqual([
      "page-2",
      "page-1",
    ]);
    expect(getNextSortState("url", "asc", "url")).toEqual({
      sortField: "url",
      sortDir: "desc",
    });
    expect(getNextSortState("url", "desc", "issueCount")).toEqual({
      sortField: "issueCount",
      sortDir: "asc",
    });
    expect(getAriaSort("url", "url", "asc")).toBe("ascending");
    expect(getAriaSort("title", "url", "asc")).toBe("none");
  });
});
