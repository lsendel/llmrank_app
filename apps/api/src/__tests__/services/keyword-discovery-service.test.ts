import { describe, it, expect, vi } from "vitest";
import { createKeywordDiscoveryService } from "../../services/keyword-discovery-service";

describe("KeywordDiscoveryService", () => {
  const mockDeps = {
    projects: {
      getById: vi.fn().mockResolvedValue({
        id: "proj-1",
        userId: "user-1",
        domain: "example.com",
        name: "Example",
      }),
    },
    enrichments: {
      listByJobAndProvider: vi.fn().mockResolvedValue([
        {
          data: {
            queries: [
              { query: "best seo tools", clicks: 50, impressions: 500 },
              { query: "ai readiness check", clicks: 30, impressions: 300 },
              { query: "site audit tool", clicks: 20, impressions: 200 },
            ],
          },
        },
        {
          data: {
            queries: [
              { query: "llm optimization", clicks: 15, impressions: 150 },
            ],
          },
        },
      ]),
    },
    schedules: {
      listByProject: vi.fn().mockResolvedValue([
        { query: "best seo tools" }, // already tracked
      ]),
    },
    crawls: {
      getLatestByProject: vi.fn().mockResolvedValue({ id: "crawl-1" }),
    },
    llm: {
      generateKeywords: vi.fn().mockResolvedValue([
        "ai seo optimization",
        "llm visibility checker",
        "ai readiness check", // duplicate of GSC — should be deduped
      ]),
    },
  };

  it("returns GSC-based suggestions excluding already tracked", async () => {
    const service = createKeywordDiscoveryService(mockDeps as any);
    const result = await service.discover("user-1", "proj-1");

    // "best seo tools" is already tracked → excluded
    expect(result.gscKeywords).not.toContainEqual(
      expect.objectContaining({ keyword: "best seo tools" }),
    );
    expect(result.gscKeywords).toContainEqual(
      expect.objectContaining({ keyword: "ai readiness check" }),
    );
  });

  it("returns LLM-based suggestions deduped against GSC + tracked", async () => {
    const service = createKeywordDiscoveryService(mockDeps as any);
    const result = await service.discover("user-1", "proj-1");

    // "ai readiness check" appears in both GSC and LLM → only in GSC list
    expect(result.llmKeywords).not.toContain("ai readiness check");
    expect(result.llmKeywords).toContain("ai seo optimization");
  });
});
