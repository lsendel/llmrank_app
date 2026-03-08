import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    patch: vi.fn(),
    put: putMock,
    delete: deleteMock,
  },
}));

import { createScoringProfilesApi } from "./scoring-profiles";
import { createTokensApi } from "./tokens";
import { createTrendsApi } from "./trends";

describe("trends/tokens/scoring-profiles api domains", () => {
  const trendsApi = createTrendsApi();
  const tokensApi = createTokensApi();
  const scoringProfilesApi = createScoringProfilesApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps trend points into stable chart-friendly output", async () => {
    getMock.mockResolvedValue({
      data: {
        points: [
          {
            date: "2025-01-01",
            overall: 88,
            content: 77,
            deltas: { overall: -4 },
          },
        ],
        deltas: {},
      },
    });

    const result = await trendsApi.get("proj-1", "30d");

    expect(getMock).toHaveBeenCalledWith("/api/trends/proj-1?period=30d");
    expect(result).toEqual([
      {
        date: "2025-01-01",
        overall: 88,
        technical: 0,
        content: 77,
        aiReadiness: 0,
        performance: 0,
        delta: -4,
      },
    ]);
  });

  it("loads regressions for a project", async () => {
    getMock.mockResolvedValue({ data: [{ category: "content", delta: -10 }] });

    const result = await trendsApi.getRegressions("proj-1");

    expect(getMock).toHaveBeenCalledWith("/api/trends/proj-1/regressions");
    expect(result).toEqual([{ category: "content", delta: -10 }]);
  });

  it("creates API tokens with the provided payload", async () => {
    postMock.mockResolvedValue({
      data: { id: "token-1", plaintext: "secret" },
    });

    const result = await tokensApi.create({
      name: "CI Token",
      type: "api",
      scopes: ["projects:read"],
    });

    expect(postMock).toHaveBeenCalledWith("/api/tokens", {
      name: "CI Token",
      type: "api",
      scopes: ["projects:read"],
    });
    expect(result).toEqual({ id: "token-1", plaintext: "secret" });
  });

  it("revokes tokens by id", async () => {
    deleteMock.mockResolvedValue(undefined);

    await tokensApi.revoke("token-1");

    expect(deleteMock).toHaveBeenCalledWith("/api/tokens/token-1");
  });

  it("updates scoring profiles by id", async () => {
    putMock.mockResolvedValue({ data: { id: "profile-1", name: "Balanced" } });

    const result = await scoringProfilesApi.update("profile-1", {
      name: "Balanced",
    });

    expect(putMock).toHaveBeenCalledWith("/api/scoring-profiles/profile-1", {
      name: "Balanced",
    });
    expect(result).toEqual({ id: "profile-1", name: "Balanced" });
  });
});
