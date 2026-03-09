import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AIVisibilityBacklinksAndDiscoverySection,
  AIVisibilityFreshnessSummary,
  AIVisibilityGapsSection,
  AIVisibilityKeywordPerformanceSection,
  AIVisibilitySummaryCards,
} from "./ai-visibility-tab-sections";

vi.mock("@/lib/insight-metadata", () => ({
  relativeTimeLabel: (value: string | null) => value ?? "never",
}));

describe("ai-visibility-tab sections", () => {
  it("renders freshness metadata once checks are available", () => {
    render(
      <AIVisibilityFreshnessSummary
        checks={[]}
        visibilityMeta={{
          checks: 12,
          providerCount: 4,
          queryCount: 6,
          latestCheckedAt: "2024-01-01T00:00:00.000Z",
          confidence: { label: "High", variant: "success" },
        }}
      />,
    );

    expect(screen.getByText(/Checks sampled: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Provider diversity: 4\/7/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: High/)).toBeInTheDocument();
  });

  it("renders summary cards and keyword performance rows", () => {
    render(
      <>
        <AIVisibilitySummaryCards
          score={null as never}
          scoreLoading={false}
          llmMentionRate={50}
          llmChecks={[{ id: "1", llmProvider: "chatgpt" }] as never[]}
          llmProviderCount={1}
          llmProviderSummary={[
            {
              provider: "chatgpt",
              label: "ChatGPT",
              checks: 1,
              mentioned: 1,
              hasMentions: true,
            },
          ]}
          aiModeRate={0}
          aiModeChecks={[]}
        />
        <AIVisibilityKeywordPerformanceSection
          keywordRows={[
            {
              query: "best ai seo tools",
              providers: { chatgpt: true, claude: false },
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText("LLM Mentions")).toBeInTheDocument();
    expect(screen.getAllByText("ChatGPT").length).toBeGreaterThan(0);
    expect(screen.getByText("best ai seo tools")).toBeInTheDocument();
    expect(screen.getByText("AI Search Presence")).toBeInTheDocument();
  });

  it("renders gap tracking and discovery results", () => {
    render(
      <>
        <AIVisibilityGapsSection
          gaps={
            [
              {
                query: "llm rank alternatives",
                competitorsCited: [{ domain: "example.com", position: 1 }],
              },
            ] as never[]
          }
          trackingGaps={false}
          onTrackGapsAsKeywords={async () => {}}
        />
        <AIVisibilityBacklinksAndDiscoverySection
          blSummary={null as never}
          blLoading={false}
          discovering={false}
          discoveryResult={{
            gscKeywords: [
              { keyword: "ai seo", source: "gsc", impressions: 100 },
            ],
            llmKeywords: ["llm rank reviews"],
          }}
          onDiscover={async () => {}}
        />
      </>,
    );

    expect(screen.getByText("Visibility Gaps")).toBeInTheDocument();
    expect(
      screen.getByText("Track 1 gap queries as keywords"),
    ).toBeInTheDocument();
    expect(screen.getByText("Keyword Discovery")).toBeInTheDocument();
    expect(screen.getByText("ai seo")).toBeInTheDocument();
    expect(screen.getByText("llm rank reviews")).toBeInTheDocument();
  });
});
