import { useCallback, useMemo } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BillingInfo,
  type CrawledPage,
  type IntegrationInsights,
  type ProjectIntegration,
} from "@/lib/api";
import { useUser } from "@/lib/auth-hooks";
import {
  buildIntegrationDeltaMetrics,
  buildPageUrlLookup,
  buildSignalTaskPlan,
  type IntegrationDeltaMetric,
} from "./integrations-tab-helpers";

export function useIntegrationsTabData(projectId: string) {
  const { user } = useUser();
  const currentUserId = user?.id ?? null;

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );

  const { data: integrations, mutate: refreshIntegrations } = useApiSWR<
    ProjectIntegration[]
  >(
    `integrations-${projectId}`,
    useCallback(() => api.integrations.list(projectId), [projectId]),
  );

  const { data: integrationInsights, mutate: refreshInsights } =
    useApiSWR<IntegrationInsights>(
      `integrations-insights-${projectId}`,
      useCallback(() => api.integrations.insights(projectId), [projectId]),
    );

  const { data: crawlHistory } = useApiSWR(
    `integrations-crawls-${projectId}`,
    useCallback(() => api.crawls.list(projectId, { limit: 2 }), [projectId]),
  );

  const latestCrawlId = integrationInsights?.crawlId ?? null;
  const previousCrawlId = useMemo(() => {
    const crawls = crawlHistory?.data ?? [];
    if (crawls.length < 2) return null;
    return crawls.find((crawl) => crawl.id !== latestCrawlId)?.id ?? null;
  }, [crawlHistory, latestCrawlId]);

  const { data: previousInsights } = useApiSWR<IntegrationInsights>(
    previousCrawlId
      ? `integrations-insights-previous-${projectId}-${previousCrawlId}`
      : null,
    useCallback(
      () => api.integrations.insights(projectId, previousCrawlId!),
      [projectId, previousCrawlId],
    ),
  );

  const { data: crawlPages } = useApiSWR<CrawledPage[]>(
    latestCrawlId ? `integration-pages-${latestCrawlId}` : null,
    useCallback(async () => {
      const pages = await api.pages.list(latestCrawlId!);
      return pages.data;
    }, [latestCrawlId]),
  );

  const currentPlan = billing?.plan ?? "free";
  const hasConnectedIntegrations =
    integrations?.some(
      (integration) => integration.hasCredentials && integration.enabled,
    ) ?? false;

  const pageUrlLookup = useMemo(
    () => buildPageUrlLookup(crawlPages ?? []),
    [crawlPages],
  );

  const integrationDeltaMetrics = useMemo<IntegrationDeltaMetric[]>(
    () => buildIntegrationDeltaMetrics(integrationInsights, previousInsights),
    [integrationInsights, previousInsights],
  );

  const signalTaskPlan = useMemo(
    () =>
      buildSignalTaskPlan({
        integrationInsights,
        pageUrlLookup,
        currentUserId,
      }),
    [integrationInsights, pageUrlLookup, currentUserId],
  );

  return {
    currentPlan,
    integrations,
    integrationInsights,
    previousCrawlId,
    previousInsights,
    hasConnectedIntegrations,
    integrationDeltaMetrics,
    signalTaskPlan,
    refreshIntegrations,
    refreshInsights,
  };
}
