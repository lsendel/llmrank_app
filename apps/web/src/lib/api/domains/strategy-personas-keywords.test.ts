import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    put: vi.fn(),
    delete: deleteMock,
  },
}));

import { createDiscoveryApi } from "./discovery";
import { createKeywordsApi } from "./keywords";
import { createPersonasApi } from "./personas";
import { createStrategyApi } from "./strategy";

describe("strategy/personas/keywords/discovery api domains", () => {
  const strategyApi = createStrategyApi();
  const personasApi = createPersonasApi();
  const keywordsApi = createKeywordsApi();
  const discoveryApi = createDiscoveryApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts competitor additions with the expected payload", async () => {
    postMock.mockResolvedValue({
      data: { id: "comp-1", domain: "example.com" },
    });

    const result = await strategyApi.addCompetitor("proj-1", "example.com");

    expect(postMock).toHaveBeenCalledWith("/api/strategy/proj-1/competitors", {
      domain: "example.com",
    });
    expect(result).toEqual({ id: "comp-1", domain: "example.com" });
  });

  it("loads strategy topic maps", async () => {
    getMock.mockResolvedValue({ data: { nodes: [], edges: [], clusters: [] } });

    const result = await strategyApi.getTopicMap("proj-1");

    expect(getMock).toHaveBeenCalledWith("/api/strategy/proj-1/topic-map");
    expect(result).toEqual({ nodes: [], edges: [], clusters: [] });
  });

  it("patches personas by id", async () => {
    patchMock.mockResolvedValue({ data: { id: "persona-1", name: "CTO" } });

    const result = await personasApi.update("persona-1", { name: "CTO" });

    expect(patchMock).toHaveBeenCalledWith("/api/personas/persona-1", {
      name: "CTO",
    });
    expect(result).toEqual({ id: "persona-1", name: "CTO" });
  });

  it("posts persona generation requests with the selected role", async () => {
    postMock.mockResolvedValue({ data: { role: "SEO Manager" } });

    const result = await personasApi.generate("proj-1", "SEO Manager");

    expect(postMock).toHaveBeenCalledWith("/api/personas/proj-1/generate", {
      role: "SEO Manager",
    });
    expect(result).toEqual({ role: "SEO Manager" });
  });

  it("creates keyword batches", async () => {
    postMock.mockResolvedValue({
      data: [{ keyword: "seo audit" }, { keyword: "llms.txt" }],
    });

    const result = await keywordsApi.createBatch("proj-1", [
      "seo audit",
      "llms.txt",
    ]);

    expect(postMock).toHaveBeenCalledWith("/api/keywords/proj-1/batch", {
      keywords: ["seo audit", "llms.txt"],
    });
    expect(result).toEqual([{ keyword: "seo audit" }, { keyword: "llms.txt" }]);
  });

  it("deletes keywords by id", async () => {
    deleteMock.mockResolvedValue(undefined);

    await keywordsApi.remove("kw-1");

    expect(deleteMock).toHaveBeenCalledWith("/api/keywords/kw-1");
  });

  it("runs discovery with an empty payload", async () => {
    postMock.mockResolvedValue({
      data: { competitors: [], personas: [], keywords: [] },
    });

    const result = await discoveryApi.run("proj-1");

    expect(postMock).toHaveBeenCalledWith("/api/discovery/proj-1/run", {});
    expect(result).toEqual({ competitors: [], personas: [], keywords: [] });
  });
});
