import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFixGeneratorService } from "../../services/fix-generator-service";

// ---------------------------------------------------------------------------
// Mock Anthropic SDK
// ---------------------------------------------------------------------------

const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "Generated fix content" }],
  usage: { input_tokens: 100, output_tokens: 50 },
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockMessagesCreate },
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDeps() {
  return {
    contentFixes: {
      create: vi.fn().mockResolvedValue({
        id: "fix-1",
        userId: "user-1",
        projectId: "proj-1",
        issueCode: "MISSING_META_DESC",
        fixType: "meta_description",
        generatedFix: "Generated fix content",
        tokensUsed: 150,
        model: "claude-sonnet-4-5-20250929",
        createdAt: new Date(),
      }),
      countByUserThisMonth: vi.fn().mockResolvedValue(0),
    },
  };
}

const baseArgs = {
  userId: "user-1",
  projectId: "proj-1",
  pageId: "page-1",
  issueCode: "MISSING_META_DESC",
  context: {
    url: "https://example.com/page1",
    title: "Test Page",
    excerpt: "This is a test page excerpt for generating fixes.",
    domain: "example.com",
  },
  apiKey: "test-anthropic-key",
  planLimit: 50,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FixGeneratorService", () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
  });

  // ---- getSupportedIssueCodes ----

  it("getSupportedIssueCodes returns 13 codes", () => {
    const service = createFixGeneratorService(deps);
    const codes = service.getSupportedIssueCodes();
    expect(codes).toHaveLength(13);
    expect(codes).toContain("MISSING_META_DESC");
    expect(codes).toContain("MISSING_TITLE");
    expect(codes).toContain("NO_STRUCTURED_DATA");
    expect(codes).toContain("MISSING_LLMS_TXT");
    expect(codes).toContain("AI_CRAWLER_BLOCKED");
  });

  // ---- generateFix success ----

  it("generateFix succeeds for MISSING_META_DESC", async () => {
    const service = createFixGeneratorService(deps);
    const result = await service.generateFix(baseArgs);

    expect(result).toBeDefined();
    expect(result.id).toBe("fix-1");

    // Verify countByUserThisMonth was called
    expect(deps.contentFixes.countByUserThisMonth).toHaveBeenCalledWith(
      "user-1",
    );

    // Verify Anthropic was called
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);

    // Verify contentFixes.create was called with correct args
    expect(deps.contentFixes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "proj-1",
        pageId: "page-1",
        issueCode: "MISSING_META_DESC",
        fixType: "meta_description",
        generatedFix: "Generated fix content",
        tokensUsed: 150,
        model: "claude-sonnet-4-5-20250929",
      }),
    );
  });

  // ---- Plan limit reached ----

  it("generateFix throws PLAN_LIMIT_REACHED when limit exceeded", async () => {
    deps.contentFixes.countByUserThisMonth.mockResolvedValue(50);
    const service = createFixGeneratorService(deps);

    await expect(
      service.generateFix({ ...baseArgs, planLimit: 50 }),
    ).rejects.toThrow("Monthly AI fix limit reached");

    // Should not call Anthropic or create
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(deps.contentFixes.create).not.toHaveBeenCalled();
  });

  // ---- Unsupported issue code ----

  it("generateFix throws UNSUPPORTED_FIX for unknown issue code", async () => {
    const service = createFixGeneratorService(deps);

    await expect(
      service.generateFix({ ...baseArgs, issueCode: "INVALID_CODE" }),
    ).rejects.toThrow("No AI fix available for issue code: INVALID_CODE");

    // Should not call Anthropic or create
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(deps.contentFixes.create).not.toHaveBeenCalled();
  });

  // ---- Model passed correctly ----

  it("generateFix passes correct model to Anthropic", async () => {
    const service = createFixGeneratorService(deps);
    await service.generateFix(baseArgs);

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ]),
      }),
    );
  });
});
