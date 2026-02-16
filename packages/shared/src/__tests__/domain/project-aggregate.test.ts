import { describe, it, expect } from "vitest";
import { ProjectAggregate } from "../../domain/project-aggregate";

describe("ProjectAggregate", () => {
  const project = new ProjectAggregate("p1", "u1", "example.com", null);

  it("isOwnedBy returns true for matching userId", () => {
    expect(project.isOwnedBy("u1")).toBe(true);
  });

  it("isOwnedBy returns false for different userId", () => {
    expect(project.isOwnedBy("u2")).toBe(false);
  });

  it("canStartCrawl returns true when no active crawl and credits remain", () => {
    expect(project.canStartCrawl("starter", 5)).toBe(true);
  });

  it("canStartCrawl returns false when active crawl exists", () => {
    const busy = new ProjectAggregate("p1", "u1", "example.com", "crawl-123");
    expect(busy.canStartCrawl("starter", 5)).toBe(false);
  });

  it("canStartCrawl returns false when no credits remain", () => {
    expect(project.canStartCrawl("free", 0)).toBe(false);
  });

  it("canAddPage returns true when under plan limit", () => {
    expect(project.canAddPage(5, "free")).toBe(true); // free = 10 pages
  });

  it("canAddPage returns false when at plan limit", () => {
    expect(project.canAddPage(10, "free")).toBe(false);
  });
});
