import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PlatformGuideDocumentationLink,
  PlatformGuideEmptyStateCard,
  PlatformGuideFailureSection,
  PlatformGuideHeader,
  PlatformGuideLoadingCard,
  PlatformGuidePassingSection,
  PlatformGuideProgressSummary,
  PlatformGuideTipsSection,
} from "./platform-guide-sections";

describe("platform guide sections", () => {
  it("renders the header, summary, loading, empty, and docs states", () => {
    render(
      <>
        <PlatformGuideHeader
          platformIcon="🤖"
          displayName="ChatGPT"
          description="Optimize for GPTBot."
          score={84}
          grade="A"
          scoreToneClass="text-success"
        />
        <PlatformGuideProgressSummary
          passCount={3}
          totalCount={5}
          passRate={60}
          criticalFailsCount={1}
          importantFailsCount={1}
          recommendedFailsCount={0}
          passingCount={3}
        />
        <PlatformGuideLoadingCard />
        <PlatformGuideEmptyStateCard displayName="ChatGPT" projectId="proj-1" />
        <PlatformGuideDocumentationLink
          displayName="ChatGPT"
          docUrl="https://example.com/docs"
        />
      </>,
    );

    expect(screen.getByText("ChatGPT Optimization Guide")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 checks passing")).toBeInTheDocument();
    expect(screen.getByText("Loading readiness data...")).toBeInTheDocument();
    expect(
      screen.getByText(/Run a crawl to see your ChatGPT readiness score/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to project overview" }),
    ).toHaveAttribute("href", "/dashboard/projects/proj-1?tab=overview");
    expect(
      screen.getByRole("link", { name: /ChatGPT Developer Documentation/i }),
    ).toHaveAttribute("href", "https://example.com/docs");
  });

  it("renders failure, passing, and tips sections", () => {
    render(
      <>
        <PlatformGuideFailureSection
          title="Critical Issues"
          tone="critical"
          checks={[
            {
              factor: "ai_crawlers",
              label: "AI crawlers",
              importance: "critical",
              pass: false,
            },
          ]}
        />
        <PlatformGuidePassingSection
          checks={[
            {
              factor: "faq",
              label: "FAQ section",
              importance: "recommended",
              pass: true,
            },
          ]}
        />
        <PlatformGuideTipsSection
          displayName="ChatGPT"
          tips={["Allow GPTBot", "Keep structured data current"]}
        />
      </>,
    );

    expect(screen.getByText("Critical Issues (1)")).toBeInTheDocument();
    expect(screen.getByText("AI crawlers")).toBeInTheDocument();
    expect(screen.getByText("How to fix:")).toBeInTheDocument();
    expect(screen.getByText("Passing Checks (1)")).toBeInTheDocument();
    expect(screen.getByText("FAQ section")).toBeInTheDocument();
    expect(screen.getByText("ChatGPT Tips")).toBeInTheDocument();
    expect(screen.getByText("Allow GPTBot")).toBeInTheDocument();
  });
});
