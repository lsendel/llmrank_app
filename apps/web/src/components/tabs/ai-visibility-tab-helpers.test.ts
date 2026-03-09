import { describe, expect, it } from "vitest";
import type { VisibilityCheck } from "@/lib/api";
import {
  buildKeywordRows,
  buildProviderMentionSummary,
  buildVisibilityMeta,
  calculateMentionRate,
  splitChecksByMode,
} from "./ai-visibility-tab-helpers";

describe("ai-visibility-tab helpers", () => {
  it("splits llm and ai-search checks and computes mention rates", () => {
    const checks = [
      { llmProvider: "chatgpt", brandMentioned: true },
      { llmProvider: "claude", brandMentioned: false },
      { llmProvider: "gemini_ai_mode", brandMentioned: true },
    ] as VisibilityCheck[];

    const { llmChecks, aiModeChecks } = splitChecksByMode(checks);

    expect(llmChecks).toHaveLength(2);
    expect(aiModeChecks).toHaveLength(1);
    expect(calculateMentionRate(llmChecks)).toBe(50);
    expect(calculateMentionRate(aiModeChecks)).toBe(100);
  });

  it("groups keyword rows by query and provider", () => {
    const checks = [
      {
        query: "best ai seo tools",
        llmProvider: "chatgpt",
        brandMentioned: true,
      },
      {
        query: "best ai seo tools",
        llmProvider: "claude",
        brandMentioned: false,
      },
      {
        query: "llm rank alternatives",
        llmProvider: "gemini_ai_mode",
        brandMentioned: true,
      },
    ] as VisibilityCheck[];

    expect(buildKeywordRows(checks)).toEqual([
      {
        query: "best ai seo tools",
        providers: { chatgpt: true, claude: false },
      },
      {
        query: "llm rank alternatives",
        providers: { gemini_ai_mode: true },
      },
    ]);
  });

  it("builds visibility freshness metadata and provider summaries", () => {
    const checks = [
      {
        query: "best ai seo tools",
        llmProvider: "chatgpt",
        brandMentioned: true,
        checkedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        query: "best ai seo tools",
        llmProvider: "claude",
        brandMentioned: false,
        checkedAt: "2024-01-03T00:00:00.000Z",
      },
      {
        query: "llm rank alternatives",
        llmProvider: "gemini_ai_mode",
        brandMentioned: true,
        checkedAt: "2024-01-02T00:00:00.000Z",
      },
    ] as VisibilityCheck[];

    expect(buildVisibilityMeta(checks)).toEqual({
      checks: 3,
      providerCount: 3,
      queryCount: 2,
      latestCheckedAt: "2024-01-03T00:00:00.000Z",
      confidence: { label: "Low", variant: "destructive" },
    });

    expect(buildProviderMentionSummary(checks.slice(0, 2))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "chatgpt", hasMentions: true }),
        expect.objectContaining({ provider: "claude", hasMentions: false }),
      ]),
    );
  });
});
