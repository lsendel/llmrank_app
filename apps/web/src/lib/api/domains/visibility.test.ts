import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { createVisibilityApi } from "./visibility";

describe("createVisibilityApi", () => {
  const visibilityApi = createVisibilityApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds filtered list requests and unwraps the response", async () => {
    getMock.mockResolvedValue({ data: [{ id: "check-1" }] });

    const result = await visibilityApi.list("proj-1", {
      region: "us",
      language: "en",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/visibility/proj-1?region=us&language=en",
    );
    expect(result).toEqual([{ id: "check-1" }]);
  });

  it("creates schedules through the nested schedules client", async () => {
    postMock.mockResolvedValue({
      data: { id: "sched-1", projectId: "proj-1" },
    });

    const result = await visibilityApi.schedules.create({
      projectId: "proj-1",
      query: "best seo software",
      providers: ["chatgpt"],
      frequency: "daily",
    });

    expect(postMock).toHaveBeenCalledWith("/api/visibility/schedules", {
      projectId: "proj-1",
      query: "best seo software",
      providers: ["chatgpt"],
      frequency: "daily",
    });
    expect(result).toEqual({ id: "sched-1", projectId: "proj-1" });
  });

  it("builds filtered ai score requests and unwraps the response", async () => {
    getMock.mockResolvedValue({ data: { overall: 88, grade: "B" } });

    const result = await visibilityApi.getAIScore("proj-1", { language: "en" });

    expect(getMock).toHaveBeenCalledWith(
      "/api/visibility/proj-1/ai-score?language=en",
    );
    expect(result).toEqual({ overall: 88, grade: "B" });
  });

  it("posts discover keyword requests with an empty payload", async () => {
    postMock.mockResolvedValue({
      data: { gscKeywords: [], llmKeywords: ["seo"] },
    });

    const result = await visibilityApi.discoverKeywords("proj-1");

    expect(postMock).toHaveBeenCalledWith(
      "/api/visibility/proj-1/discover-keywords",
      {},
    );
    expect(result).toEqual({ gscKeywords: [], llmKeywords: ["seo"] });
  });
});
