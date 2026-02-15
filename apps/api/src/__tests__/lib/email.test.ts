import { describe, it, expect } from "vitest";
import { crawlCompleteEmail, scoreDropEmail } from "../../lib/email";

describe("crawlCompleteEmail", () => {
  it("returns HTML containing project name and score", () => {
    const html = crawlCompleteEmail(
      "My Website",
      85,
      "B",
      "https://app.test/dashboard/crawl/123",
    );

    expect(html).toContain("My Website");
    expect(html).toContain("85");
    expect(html).toContain("B");
    expect(html).toContain("Crawl Complete");
    expect(html).toContain("https://app.test/dashboard/crawl/123");
    expect(html).toContain("View Full Report");
  });

  it("uses green color for high scores", () => {
    const html = crawlCompleteEmail("Site", 90, "A", "https://app.test");
    expect(html).toContain("#22c55e");
  });
});

describe("scoreDropEmail", () => {
  it("returns HTML containing drop information", () => {
    const html = scoreDropEmail(
      "My Website",
      85,
      72,
      "https://app.test/dashboard/project/1",
    );

    expect(html).toContain("My Website");
    expect(html).toContain("13"); // drop = 85 - 72
    expect(html).toContain("85");
    expect(html).toContain("72");
    expect(html).toContain("Score Alert");
    expect(html).toContain("View Details");
    expect(html).toContain("https://app.test/dashboard/project/1");
  });
});
