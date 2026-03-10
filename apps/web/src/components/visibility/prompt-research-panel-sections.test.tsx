import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AIPrompt } from "@/lib/api";
import {
  PromptResearchEmptyStateCard,
  PromptResearchLoadingCard,
  PromptResearchResultsCard,
} from "./prompt-research-panel-sections";

const prompt: AIPrompt = {
  id: "prompt-1",
  projectId: "proj-1",
  prompt: "best ai seo tools for saas",
  category: "comparison",
  estimatedVolume: 1200,
  difficulty: 48,
  intent: "informational",
  yourMentioned: false,
  competitorsMentioned: ["competitor.com"],
  source: "discovered",
  discoveredAt: "2026-03-09T10:00:00.000Z",
};

describe("prompt research panel sections", () => {
  it("renders loading and empty states", () => {
    const onDiscover = vi.fn();

    render(
      <>
        <PromptResearchLoadingCard />
        <PromptResearchEmptyStateCard
          isDiscovering={false}
          onDiscover={onDiscover}
        />
      </>,
    );

    expect(screen.getAllByText("Prompt Research")).toHaveLength(2);
    expect(
      screen.getByText(
        /Discover what questions people ask AI about your industry/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discover Prompts" }));
    expect(onDiscover).toHaveBeenCalledTimes(1);
  });

  it("renders the prompt table and action callbacks", () => {
    const onCategoryFilterChange = vi.fn();
    const onMentionedFilterChange = vi.fn();
    const onDifficultyFilterChange = vi.fn();
    const onExportCsv = vi.fn();
    const onDiscover = vi.fn();
    const onRunCheck = vi.fn();
    const onTrackPrompt = vi.fn();
    const onDelete = vi.fn();

    render(
      <PromptResearchResultsCard
        prompts={[prompt]}
        filteredPrompts={[prompt]}
        meta={{ limit: 20, plan: "starter" }}
        categoryFilter="all"
        mentionedFilter="all"
        difficultyFilter="all"
        isDiscovering={false}
        runningPromptId={null}
        trackingPromptId={null}
        onCategoryFilterChange={onCategoryFilterChange}
        onMentionedFilterChange={onMentionedFilterChange}
        onDifficultyFilterChange={onDifficultyFilterChange}
        onExportCsv={onExportCsv}
        onDiscover={onDiscover}
        onRunCheck={onRunCheck}
        onTrackPrompt={onTrackPrompt}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("(1/20)")).toBeInTheDocument();
    expect(screen.getByText("best ai seo tools for saas")).toBeInTheDocument();
    expect(screen.getByText("comparison")).toBeInTheDocument();
    expect(screen.getByText("informational")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Discover More" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Track Weekly" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete best ai seo tools for saas" }),
    );

    expect(onExportCsv).toHaveBeenCalledTimes(1);
    expect(onDiscover).toHaveBeenCalledTimes(1);
    expect(onRunCheck).toHaveBeenCalledWith(prompt);
    expect(onTrackPrompt).toHaveBeenCalledWith(prompt);
    expect(onDelete).toHaveBeenCalledWith("prompt-1");
  });
});
