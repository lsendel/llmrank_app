import { describe, it, expect } from "vitest";
import { CrawlJobAggregate } from "../../domain/crawl-aggregate";

describe("CrawlJobAggregate", () => {
  it("canIngest returns true for active crawl", () => {
    const crawl = new CrawlJobAggregate("c1", "p1", "crawling");
    expect(crawl.canIngest()).toBe(true);
  });

  it("canIngest returns false for terminal crawl", () => {
    const crawl = new CrawlJobAggregate("c1", "p1", "complete");
    expect(crawl.canIngest()).toBe(false);
  });

  it("transition updates status", () => {
    const crawl = new CrawlJobAggregate("c1", "p1", "pending");
    const next = crawl.transition("crawling");
    expect(next.status.value).toBe("crawling");
  });

  it("transition throws on invalid move", () => {
    const crawl = new CrawlJobAggregate("c1", "p1", "complete");
    expect(() => crawl.transition("crawling")).toThrow("Invalid transition");
  });

  it("isExpired returns true after timeout", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const crawl = new CrawlJobAggregate("c1", "p1", "crawling", twoHoursAgo);
    expect(crawl.isExpired(60)).toBe(true); // 60 min timeout
  });

  it("isExpired returns false within timeout", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const crawl = new CrawlJobAggregate("c1", "p1", "crawling", fiveMinutesAgo);
    expect(crawl.isExpired(60)).toBe(false);
  });

  it("isExpired returns false when no startedAt", () => {
    const crawl = new CrawlJobAggregate("c1", "p1", "pending");
    expect(crawl.isExpired(60)).toBe(false);
  });
});
