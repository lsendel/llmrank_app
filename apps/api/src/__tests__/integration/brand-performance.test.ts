import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject } from "../helpers/factories";

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

const mockProjectRepo = {
  listByUser: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "proj-1" }),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getDueForCrawl: vi.fn().mockResolvedValue([]),
  updateNextCrawl: vi.fn().mockResolvedValue(undefined),
};

const mockUserRepo = {
  getById: vi.fn().mockResolvedValue({ id: "test-user-id", plan: "starter" }),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
  createVisibilityRepository: () => ({}),
  createCompetitorRepository: () => ({}),
}));

const getSentimentSummaryMock = vi.fn();
const getHistoryMock = vi.fn();

vi.mock("@llm-boost/db", async () => {
  const actual = await vi.importActual("@llm-boost/db");
  return {
    ...(actual as Record<string, unknown>),
    visibilityQueries: () => ({
      getSentimentSummary: getSentimentSummaryMock,
    }),
    brandSentimentQueries: () => ({
      getHistory: getHistoryMock,
    }),
  };
});

describe("Brand Performance Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRepo.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
    mockUserRepo.getById.mockResolvedValue({ id: "test-user-id", plan: "pro" });
    getSentimentSummaryMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([]);
  });

  it("passes locale filters to sentiment summary query", async () => {
    const res = await request(
      "/api/brand/proj-1/sentiment?region=gb&language=en",
    );

    expect(res.status).toBe(200);
    expect(getSentimentSummaryMock).toHaveBeenCalledWith("proj-1", {
      region: "gb",
      language: "en",
    });
  });

  it("returns empty sentiment payload when no checks exist", async () => {
    const res = await request("/api/brand/proj-1/sentiment");

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.sampleSize).toBe(0);
    expect(body.data.distribution).toEqual({
      positive: 0,
      neutral: 0,
      negative: 0,
    });
  });

  it("forces starter locale requests to US English", async () => {
    mockUserRepo.getById.mockResolvedValue({
      id: "test-user-id",
      plan: "starter",
    });

    const res = await request(
      "/api/brand/proj-1/sentiment?region=gb&language=fr",
    );

    expect(res.status).toBe(200);
    expect(getSentimentSummaryMock).toHaveBeenCalledWith("proj-1", {
      region: "us",
      language: "en",
    });
  });

  it("returns sentiment history snapshots", async () => {
    getHistoryMock.mockResolvedValue([
      {
        id: "snap-1",
        projectId: "proj-1",
        period: "2026-W09",
        sentimentScore: 0.33,
        sampleSize: 12,
      },
    ]);

    const res = await request("/api/brand/proj-1/sentiment/history");

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toHaveLength(1);
    expect(getHistoryMock).toHaveBeenCalledWith("proj-1", 12);
  });

  it("returns provider perception breakdown", async () => {
    getSentimentSummaryMock.mockResolvedValue([
      {
        llmProvider: "chatgpt",
        sentiment: "positive",
        brandDescription: "Reliable platform for teams.",
        checkedAt: "2026-03-01T10:00:00.000Z",
      },
      {
        llmProvider: "chatgpt",
        sentiment: "negative",
        brandDescription: "Can be expensive at scale.",
        checkedAt: "2026-03-01T11:00:00.000Z",
      },
    ]);

    const res = await request(
      "/api/brand/proj-1/perception?region=us&language=en",
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      provider: "chatgpt",
      sampleSize: 2,
      sentimentScore: 0,
      distribution: { positive: 1, neutral: 0, negative: 1 },
    });
    expect(getSentimentSummaryMock).toHaveBeenCalledWith("proj-1", {
      region: "us",
      language: "en",
    });
  });
});
