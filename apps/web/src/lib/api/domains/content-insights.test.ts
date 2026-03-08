import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: vi.fn(),
    put: vi.fn(),
    delete: deleteMock,
  },
}));

import { createBacklinksApi } from "./backlinks";
import { createBrandApi } from "./brand";
import { createPromptResearchApi } from "./prompt-research";
import { createScoresApi } from "./scores";

describe("content insight api domains", () => {
  const scoresApi = createScoresApi();
  const brandApi = createBrandApi();
  const promptResearchApi = createPromptResearchApi();
  const backlinksApi = createBacklinksApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads page score details", async () => {
    getMock.mockResolvedValue({
      data: { id: "score-1", url: "https://example.com" },
    });

    const result = await scoresApi.getPage("page-1");

    expect(getMock).toHaveBeenCalledWith("/api/scores/page/page-1");
    expect(result).toEqual({ id: "score-1", url: "https://example.com" });
  });

  it("builds filtered brand sentiment requests", async () => {
    getMock.mockResolvedValue({ data: { overallSentiment: "positive" } });

    const result = await brandApi.getSentiment("proj-1", {
      region: "us",
      language: "en",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/brand/proj-1/sentiment?region=us&language=en",
    );
    expect(result).toEqual({ overallSentiment: "positive" });
  });

  it("keeps prompt research list responses intact", async () => {
    const response = {
      data: [{ id: "prompt-1" }],
      meta: { limit: 10, plan: "pro" },
    };
    getMock.mockResolvedValue(response);

    const result = await promptResearchApi.list("proj-1");

    expect(getMock).toHaveBeenCalledWith("/api/prompt-research/proj-1");
    expect(result).toBe(response);
  });

  it("posts prompt checks with the expected payload", async () => {
    postMock.mockResolvedValue({
      data: { prompt: "best seo tools", yourMentioned: true },
    });

    const result = await promptResearchApi.check({
      projectId: "proj-1",
      prompt: "best seo tools",
      providers: ["chatgpt"],
      region: "us",
      language: "en",
    });

    expect(postMock).toHaveBeenCalledWith("/api/prompt-research/proj-1/check", {
      promptId: undefined,
      prompt: "best seo tools",
      providers: ["chatgpt"],
      region: "us",
      language: "en",
    });
    expect(result).toEqual({ prompt: "best seo tools", yourMentioned: true });
  });

  it("loads backlink pages with limit and offset", async () => {
    getMock.mockResolvedValue({
      data: { links: [], total: 0, limit: 25, offset: 50 },
    });

    const result = await backlinksApi.getLinks("proj-1", 25, 50);

    expect(getMock).toHaveBeenCalledWith(
      "/api/backlinks/project/proj-1/links?limit=25&offset=50",
    );
    expect(result).toEqual({ links: [], total: 0, limit: 25, offset: 50 });
  });

  it("deletes prompt research entries by project and prompt id", async () => {
    deleteMock.mockResolvedValue(undefined);

    await promptResearchApi.remove("proj-1", "prompt-1");

    expect(deleteMock).toHaveBeenCalledWith(
      "/api/prompt-research/proj-1/prompt-1",
    );
  });
});
