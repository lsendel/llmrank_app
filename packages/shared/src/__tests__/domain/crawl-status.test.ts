import { describe, it, expect } from "vitest";
import { CrawlStatus } from "../../domain/crawl-status";

describe("CrawlStatus", () => {
  it("allows valid transition: pending → queued", () => {
    const status = CrawlStatus.from("pending");
    expect(status.canTransitionTo("queued")).toBe(true);
  });

  it("allows valid transition: pending → crawling", () => {
    const status = CrawlStatus.from("pending");
    expect(status.canTransitionTo("crawling")).toBe(true);
  });

  it("allows valid transition: crawling → scoring", () => {
    const status = CrawlStatus.from("crawling");
    expect(status.canTransitionTo("scoring")).toBe(true);
  });

  it("rejects invalid transition: complete → crawling", () => {
    const status = CrawlStatus.from("complete");
    expect(status.canTransitionTo("crawling")).toBe(false);
  });

  it("rejects invalid transition: pending → complete", () => {
    const status = CrawlStatus.from("pending");
    expect(status.canTransitionTo("complete")).toBe(false);
  });

  it("any non-terminal state can transition to failed", () => {
    for (const s of ["pending", "queued", "crawling", "scoring"]) {
      expect(CrawlStatus.from(s).canTransitionTo("failed")).toBe(true);
    }
  });

  it("any non-terminal state can transition to cancelled", () => {
    for (const s of ["pending", "queued", "crawling", "scoring"]) {
      expect(CrawlStatus.from(s).canTransitionTo("cancelled")).toBe(true);
    }
  });

  it("isTerminal returns true for complete, failed, cancelled", () => {
    expect(CrawlStatus.from("complete").isTerminal).toBe(true);
    expect(CrawlStatus.from("failed").isTerminal).toBe(true);
    expect(CrawlStatus.from("cancelled").isTerminal).toBe(true);
  });

  it("isActive returns true for non-terminal states", () => {
    expect(CrawlStatus.from("pending").isActive).toBe(true);
    expect(CrawlStatus.from("crawling").isActive).toBe(true);
  });

  it("transition returns new CrawlStatus", () => {
    const next = CrawlStatus.from("pending").transition("crawling");
    expect(next.value).toBe("crawling");
  });

  it("transition throws on invalid transition", () => {
    expect(() => CrawlStatus.from("complete").transition("crawling")).toThrow(
      "Invalid transition",
    );
  });

  it("rejects unknown status values", () => {
    expect(() => CrawlStatus.from("unknown")).toThrow("Invalid crawl status");
  });
});
