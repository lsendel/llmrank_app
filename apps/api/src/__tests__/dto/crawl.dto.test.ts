import { describe, expect, it } from "vitest";
import { toCrawlResponse } from "../../dto/crawl.dto";

describe("crawl DTO", () => {
  it("parses JSON config fields for frontend consumers", () => {
    expect(
      toCrawlResponse({
        id: "crawl-1",
        projectId: "project-1",
        status: "complete",
        config: JSON.stringify({ maxPages: 2000, maxDepth: 4 }),
        createdAt: "2026-06-28T00:00:00.000Z",
      }).config,
    ).toEqual({ maxPages: 2000, maxDepth: 4 });
  });
});
