import { describe, expect, it } from "vitest";
import type { AIPrompt } from "@/lib/api";
import {
  buildPromptResearchCsv,
  buildPromptResearchCsvFilename,
  filterPromptResearchPrompts,
  getDifficultyBarClassName,
  getMentionedBadgeProps,
} from "./prompt-research-panel-helpers";

const prompts: AIPrompt[] = [
  {
    id: "prompt-1",
    projectId: "proj-1",
    prompt: 'best "ai" seo tools',
    category: "comparison",
    estimatedVolume: 1200,
    difficulty: 48,
    intent: "informational",
    yourMentioned: false,
    competitorsMentioned: [],
    source: "discovered",
    discoveredAt: "2026-03-09T10:00:00.000Z",
  },
  {
    id: "prompt-2",
    projectId: "proj-1",
    prompt: "how to improve llms.txt",
    category: "how-to",
    estimatedVolume: 300,
    difficulty: 22,
    intent: "transactional",
    yourMentioned: true,
    competitorsMentioned: [],
    source: "discovered",
    discoveredAt: "2026-03-09T11:00:00.000Z",
  },
];

describe("prompt research panel helpers", () => {
  it("filters prompts by category and mention state", () => {
    expect(
      filterPromptResearchPrompts(prompts, {
        categoryFilter: "all",
        mentionedFilter: "mentioned",
        difficultyFilter: "easy",
      }).map((prompt) => prompt.id),
    ).toEqual(["prompt-2"]);

    expect(
      filterPromptResearchPrompts(prompts, {
        categoryFilter: "comparison",
        mentionedFilter: "all",
        difficultyFilter: "hard",
      }).map((prompt) => prompt.id),
    ).toEqual(["prompt-1"]);
  });

  it("builds escaped csv output and filenames", () => {
    expect(buildPromptResearchCsv(prompts)).toContain(
      '"best ""ai"" seo tools"',
    );
    expect(
      buildPromptResearchCsvFilename(
        "proj-1",
        new Date("2026-03-09T12:00:00.000Z"),
      ),
    ).toBe("prompt-research-proj-1-2026-03-09.csv");
  });

  it("returns difficulty and mentioned badge metadata", () => {
    expect(getDifficultyBarClassName(80)).toBe("bg-red-500");
    expect(getDifficultyBarClassName(50)).toBe("bg-amber-500");
    expect(getDifficultyBarClassName(20)).toBe("bg-green-500");
    expect(getMentionedBadgeProps(true)).toEqual({
      label: "Yes",
      variant: "success",
    });
    expect(getMentionedBadgeProps(false)).toEqual({
      label: "No",
      variant: "outline",
    });
    expect(getMentionedBadgeProps(null)).toEqual({
      label: "Unknown",
      variant: "secondary",
    });
  });
});
