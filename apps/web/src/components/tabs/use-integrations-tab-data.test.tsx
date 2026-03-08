import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationInsights, ProjectIntegration } from "@/lib/api";
import { useIntegrationsTabData } from "./use-integrations-tab-data";

const {
  mockUseApiSWR,
  mockBuildPageUrlLookup,
  mockBuildIntegrationDeltaMetrics,
  mockBuildSignalTaskPlan,
  pageUrlLookupResult,
  deltaMetricsResult,
  signalTaskPlanResult,
  refreshIntegrations,
  refreshInsights,
} = vi.hoisted(() => ({
  mockUseApiSWR: vi.fn(),
  mockBuildPageUrlLookup: vi.fn(),
  mockBuildIntegrationDeltaMetrics: vi.fn(),
  mockBuildSignalTaskPlan: vi.fn(),
  pageUrlLookupResult: { byFull: new Map(), byPath: new Map() },
  deltaMetricsResult: [
    {
      id: "metric-1",
      label: "Metric 1",
      currentValue: "12",
      deltaValue: "+2",
      direction: "positive" as const,
    },
  ],
  signalTaskPlanResult: { reasons: ["reason-1"], items: [] },
  refreshIntegrations: vi.fn(async () => undefined),
  refreshInsights: vi.fn(async () => undefined),
}));

let mockUserId: string | null = null;

vi.mock("@/lib/auth-hooks", () => ({
  useUser: () => ({ user: mockUserId ? { id: mockUserId } : null }),
}));

vi.mock("@/lib/use-api-swr", () => ({
  useApiSWR: (...args: unknown[]) => mockUseApiSWR(...args),
}));

vi.mock("./integrations-tab-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("./integrations-tab-helpers")
  >("./integrations-tab-helpers");

  return {
    ...actual,
    buildPageUrlLookup: (...args: unknown[]) => mockBuildPageUrlLookup(...args),
    buildIntegrationDeltaMetrics: (...args: unknown[]) =>
      mockBuildIntegrationDeltaMetrics(...args),
    buildSignalTaskPlan: (...args: unknown[]) =>
      mockBuildSignalTaskPlan(...args),
  };
});

function configureSWR(overrides?: {
  billing?: { plan: string } | undefined;
  integrations?: ProjectIntegration[] | undefined;
  integrationInsights?: IntegrationInsights | undefined;
  crawlHistory?: { data: Array<{ id: string }> } | undefined;
  previousInsights?: IntegrationInsights | undefined;
  crawlPages?: Array<{ id: string; url: string }> | undefined;
}) {
  mockUseApiSWR.mockImplementation((key: string | null) => {
    if (key === "billing-info") return { data: overrides?.billing };
    if (key === "integrations-proj-1") {
      return {
        data: overrides?.integrations,
        mutate: refreshIntegrations,
      };
    }
    if (key === "integrations-insights-proj-1") {
      return {
        data: overrides?.integrationInsights,
        mutate: refreshInsights,
      };
    }
    if (key === "integrations-crawls-proj-1") {
      return { data: overrides?.crawlHistory };
    }
    if (key === "integrations-insights-previous-proj-1-crawl-1") {
      return { data: overrides?.previousInsights };
    }
    if (key === "integration-pages-crawl-2") {
      return { data: overrides?.crawlPages };
    }
    if (key === null) return { data: undefined };
    return { data: undefined };
  });
}

describe("useIntegrationsTabData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = null;
    mockBuildPageUrlLookup.mockReturnValue(pageUrlLookupResult);
    mockBuildIntegrationDeltaMetrics.mockReturnValue(deltaMetricsResult);
    mockBuildSignalTaskPlan.mockReturnValue(signalTaskPlanResult);
  });

  it("derives integration data and helper-backed outputs from SWR state", () => {
    mockUserId = "user-1";
    const integrationInsights = {
      crawlId: "crawl-2",
      integrations: {},
    } as IntegrationInsights;
    const previousInsights = {
      crawlId: "crawl-1",
      integrations: {},
    } as IntegrationInsights;
    const crawlPages = [{ id: "page-1", url: "https://example.com/a" }];

    configureSWR({
      billing: { plan: "agency" },
      integrations: [
        {
          id: "gsc-1",
          provider: "gsc",
          hasCredentials: true,
          enabled: true,
        } as ProjectIntegration,
      ],
      integrationInsights,
      crawlHistory: { data: [{ id: "crawl-2" }, { id: "crawl-1" }] },
      previousInsights,
      crawlPages,
    });

    const { result } = renderHook(() => useIntegrationsTabData("proj-1"));

    expect(result.current.currentPlan).toBe("agency");
    expect(result.current.previousCrawlId).toBe("crawl-1");
    expect(result.current.hasConnectedIntegrations).toBe(true);
    expect(result.current.integrationDeltaMetrics).toBe(deltaMetricsResult);
    expect(result.current.signalTaskPlan).toBe(signalTaskPlanResult);
    expect(result.current.refreshIntegrations).toBe(refreshIntegrations);
    expect(result.current.refreshInsights).toBe(refreshInsights);
    expect(mockBuildPageUrlLookup).toHaveBeenCalledWith(crawlPages);
    expect(mockBuildIntegrationDeltaMetrics).toHaveBeenCalledWith(
      integrationInsights,
      previousInsights,
    );
    expect(mockBuildSignalTaskPlan).toHaveBeenCalledWith({
      integrationInsights,
      pageUrlLookup: pageUrlLookupResult,
      currentUserId: "user-1",
    });
  });

  it("falls back safely when optional integration data is missing", () => {
    configureSWR({
      billing: undefined,
      integrations: undefined,
      integrationInsights: undefined,
      crawlHistory: { data: [{ id: "crawl-1" }] },
      previousInsights: undefined,
      crawlPages: undefined,
    });

    const { result } = renderHook(() => useIntegrationsTabData("proj-1"));

    expect(result.current.currentPlan).toBe("free");
    expect(result.current.previousCrawlId).toBeNull();
    expect(result.current.hasConnectedIntegrations).toBe(false);
    expect(mockUseApiSWR).toHaveBeenCalledWith(null, expect.any(Function));
    expect(mockBuildPageUrlLookup).toHaveBeenCalledWith([]);
    expect(mockBuildIntegrationDeltaMetrics).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
    expect(mockBuildSignalTaskPlan).toHaveBeenCalledWith({
      integrationInsights: undefined,
      pageUrlLookup: pageUrlLookupResult,
      currentUserId: null,
    });
  });
});
