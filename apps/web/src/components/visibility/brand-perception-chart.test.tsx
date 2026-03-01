import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { BrandPerceptionChart } from "./brand-perception-chart";
import type {
  BrandPerceptionProvider,
  BrandSentimentSnapshot,
} from "@/lib/api";

const useApiSWRMock = vi.fn();

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => useApiSWRMock(...args),
}));

vi.mock("@/lib/api", () => ({
  api: {
    brand: {
      getSentimentHistory: vi.fn(),
      getPerception: vi.fn(),
    },
  },
}));

describe("BrandPerceptionChart", () => {
  it("renders empty state when history is unavailable", () => {
    useApiSWRMock.mockImplementation((key: string) => {
      if (key.startsWith("brand-sentiment-history-")) {
        return { data: [], isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<BrandPerceptionChart projectId="proj-1" />);

    expect(screen.getByText("Brand Perception Trend")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Build weekly sentiment history to see how brand perception changes over time.",
      ),
    ).toBeInTheDocument();
  });

  it("renders latest score and wow delta badges when history exists", () => {
    const snapshots: BrandSentimentSnapshot[] = [
      {
        id: "s1",
        projectId: "proj-1",
        period: "2026-W08",
        overallSentiment: "neutral",
        sentimentScore: 0.1,
        keyAttributes: null,
        brandNarrative: null,
        strengthTopics: null,
        weaknessTopics: null,
        providerBreakdown: null,
        sampleSize: 12,
        createdAt: "2026-02-20T00:00:00.000Z",
      },
      {
        id: "s2",
        projectId: "proj-1",
        period: "2026-W09",
        overallSentiment: "positive",
        sentimentScore: 0.35,
        keyAttributes: null,
        brandNarrative: null,
        strengthTopics: null,
        weaknessTopics: null,
        providerBreakdown: null,
        sampleSize: 18,
        createdAt: "2026-02-27T00:00:00.000Z",
      },
    ];
    const perception: BrandPerceptionProvider[] = [
      {
        provider: "chatgpt",
        sampleSize: 5,
        overallSentiment: "positive",
        sentimentScore: 0.4,
        distribution: { positive: 3, neutral: 2, negative: 0 },
        descriptions: ["Strong, trusted choice for teams."],
      },
    ];

    useApiSWRMock.mockImplementation((key: string) => {
      if (key.startsWith("brand-sentiment-history-")) {
        return { data: snapshots, isLoading: false };
      }
      if (key.startsWith("brand-perception-providers-")) {
        return { data: perception, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<BrandPerceptionChart projectId="proj-1" />);

    expect(screen.getByText("Latest: +0.35")).toBeInTheDocument();
    expect(screen.getByText("+0.25 WoW")).toBeInTheDocument();
    expect(
      screen.getByText("How each platform describes you"),
    ).toBeInTheDocument();
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(
      screen.getByText("“Strong, trusted choice for teams.”"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });
});
