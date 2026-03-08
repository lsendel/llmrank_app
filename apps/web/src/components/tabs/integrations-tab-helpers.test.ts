import {
  buildPageUrlLookup,
  formatDeltaNumber,
  isNonIndexedStatus,
  planAllows,
  resolvePageIdForSignalUrl,
  truncateUrlPath,
} from "./integrations-tab-helpers";

describe("integrations-tab helpers", () => {
  it("enforces plan ordering for gated integrations", () => {
    expect(planAllows("pro", "pro")).toBe(true);
    expect(planAllows("agency", "pro")).toBe(true);
    expect(planAllows("starter", "pro")).toBe(false);
  });

  it("builds URL lookup keys and falls back from full URL to path", () => {
    const lookup = buildPageUrlLookup([
      { id: "page-home", url: "https://example.com/" },
      { id: "page-blog", url: "https://example.com/blog/post/" },
    ] as never[]);

    expect(
      resolvePageIdForSignalUrl("https://example.com/blog/post", lookup),
    ).toBe("page-blog");
    expect(
      resolvePageIdForSignalUrl("https://another-site.com/blog/post", lookup),
    ).toBe("page-blog");
    expect(resolvePageIdForSignalUrl("not-a-url", lookup)).toBeNull();
  });

  it("detects non-indexed statuses using common GSC wording", () => {
    expect(isNonIndexedStatus("Blocked by robots.txt")).toBe(true);
    expect(isNonIndexedStatus('Excluded by "noindex" tag')).toBe(true);
    expect(isNonIndexedStatus("Indexed")).toBe(false);
  });

  it("formats delta values with direction and suffix handling", () => {
    expect(formatDeltaNumber(72.4, 70.1, { decimals: 1, suffix: "%" })).toEqual(
      {
        currentValue: "72.4%",
        deltaValue: "+2.3%",
        direction: "positive",
      },
    );

    expect(
      formatDeltaNumber(68.2, 70.1, {
        decimals: 1,
        suffix: "%",
        higherIsBetter: false,
      }),
    ).toEqual({
      currentValue: "68.2%",
      deltaValue: "-1.9%",
      direction: "positive",
    });

    expect(formatDeltaNumber(10, 10)).toEqual({
      currentValue: "10",
      deltaValue: "0",
      direction: "neutral",
    });
  });

  it("truncates long parsed URL paths", () => {
    expect(
      truncateUrlPath(
        "https://example.com/this/is/a/very/long/url/path/that/should/be/truncated",
      ),
    ).toBe("/this/is/a/very/long/url/path/that/shou...");
    expect(truncateUrlPath("invalid-url")).toBe("invalid-url");
  });
});
