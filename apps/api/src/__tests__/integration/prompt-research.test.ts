import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../helpers/test-app";
import { buildProject, buildUser } from "../helpers/factories";

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
  getById: vi.fn().mockResolvedValue(buildUser({ id: "test-user-id" })),
  decrementCrawlCredits: vi.fn().mockResolvedValue(true),
};

const mockVisibilityRepo = {
  listByProject: vi.fn().mockResolvedValue([]),
  getTrends: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockImplementation((data: Record<string, unknown>) =>
    Promise.resolve({
      id: "vis-1",
      ...data,
      checkedAt: new Date().toISOString(),
    }),
  ),
  countSince: vi.fn().mockResolvedValue(0),
};

const mockCompetitorRepo = {
  getById: vi.fn().mockResolvedValue(null),
  listByProject: vi.fn().mockResolvedValue([]),
  add: vi.fn().mockResolvedValue({ id: "comp-1" }),
  remove: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../repositories", () => ({
  createProjectRepository: () => mockProjectRepo,
  createUserRepository: () => mockUserRepo,
  createCrawlRepository: () => ({}),
  createScoreRepository: () => ({}),
  createPageRepository: () => ({}),
  createVisibilityRepository: () => mockVisibilityRepo,
  createCompetitorRepository: () => mockCompetitorRepo,
}));

const mockPromptQueries = {
  countByProject: vi.fn().mockResolvedValue(0),
  create: vi.fn().mockResolvedValue([]),
  listByProject: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  deleteById: vi.fn().mockResolvedValue(undefined),
  updateTracking: vi.fn().mockResolvedValue({ id: "prompt-1" }),
};

const mockSavedKeywordQueries = {
  listByProject: vi.fn().mockResolvedValue([]),
};

vi.mock("@llm-boost/db", async () => {
  const actual = await vi.importActual("@llm-boost/db");
  return {
    ...(actual as Record<string, unknown>),
    aiPromptQueries: () => mockPromptQueries,
    savedKeywordQueries: () => mockSavedKeywordQueries,
  };
});

vi.mock("@llm-boost/llm", () => ({
  discoverPrompts: vi.fn().mockResolvedValue([]),
  analyzeBrandSentiment: vi.fn().mockResolvedValue(null),
  VisibilityChecker: vi.fn().mockImplementation(() => ({
    checkAllProviders: vi.fn().mockResolvedValue([
      {
        provider: "chatgpt",
        query: "best llm rank alternatives",
        responseText: "example.com is one of the top choices.",
        brandMentioned: true,
        urlCited: true,
        citedUrl: "https://example.com/features",
        citationPosition: 1,
        competitorMentions: [
          { domain: "competitor.com", mentioned: true, position: 2 },
          { domain: "other.com", mentioned: false, position: null },
        ],
      },
    ]),
  })),
}));

describe("Prompt Research Routes", () => {
  const { request } = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRepo.getById.mockResolvedValue(
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    );
    mockProjectRepo.listByUser.mockResolvedValue([
      buildProject({ id: "proj-1", userId: "test-user-id" }),
    ]);
    mockUserRepo.getById.mockResolvedValue(buildUser({ id: "test-user-id" }));
    mockVisibilityRepo.countSince.mockResolvedValue(0);
    mockPromptQueries.getById.mockResolvedValue({
      id: "prompt-1",
      projectId: "proj-1",
      prompt: "best llm rank alternatives",
    });
  });

  it("runs prompt check by promptId and updates tracking fields", async () => {
    const res = await request("/api/prompt-research/proj-1/check", {
      method: "POST",
      json: {
        promptId: "prompt-1",
        providers: ["chatgpt"],
      },
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.promptId).toBe("prompt-1");
    expect(body.data.checkCount).toBe(1);
    expect(body.data.yourMentioned).toBe(true);
    expect(body.data.competitorsMentioned).toEqual(["competitor.com"]);
    expect(mockPromptQueries.updateTracking).toHaveBeenCalledWith(
      "prompt-1",
      "proj-1",
      {
        yourMentioned: true,
        competitorsMentioned: ["competitor.com"],
      },
    );
  });

  it("forces starter plan prompt checks to US English locale", async () => {
    mockUserRepo.getById.mockResolvedValue(
      buildUser({ id: "test-user-id", plan: "starter" }),
    );

    const res = await request("/api/prompt-research/proj-1/check", {
      method: "POST",
      json: {
        promptId: "prompt-1",
        region: "gb",
        language: "fr",
      },
    });

    expect(res.status).toBe(200);
    expect(mockVisibilityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "us",
        language: "en",
      }),
    );
  });

  it("returns 422 when Pro requests unsupported locale region", async () => {
    mockUserRepo.getById.mockResolvedValue(
      buildUser({ id: "test-user-id", plan: "pro" }),
    );

    const res = await request("/api/prompt-research/proj-1/check", {
      method: "POST",
      json: {
        promptId: "prompt-1",
        region: "mx",
      },
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when neither promptId nor prompt text is provided", async () => {
    const res = await request("/api/prompt-research/proj-1/check", {
      method: "POST",
      json: {},
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when promptId is not found", async () => {
    mockPromptQueries.getById.mockResolvedValue(null);

    const res = await request("/api/prompt-research/proj-1/check", {
      method: "POST",
      json: {
        promptId: "missing",
      },
    });

    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
